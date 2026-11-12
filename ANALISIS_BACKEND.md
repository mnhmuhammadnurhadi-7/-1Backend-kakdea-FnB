# Analisis Backend Buku Dapur

Analisis ini membaca implementasi aktif di `backend/src` dan `backend/prisma`, bukan menganggap dokumen lama atau `backend/dist` sebagai sumber kebenaran. `dist` adalah JavaScript hasil build dan tidak dihitung ulang sebagai implementasi terpisah. Kode lengkap setiap fungsi tetap berada di file sumber yang ditautkan di bawah; laporan ini menyertakan lokasi fungsi, endpoint, alur input-proses-output, dan potongan pola utama agar tidak menduplikasi ribuan baris kode yang sama.

## 1. Ringkasan arsitektur dan aliran data

```text
Web/mobile -> Express (src/index.ts) -> route -> authenticate (kecuali route public)
           -> Prisma Client (utils/database.ts) -> MySQL
           -> response success/error; perubahan tertentu juga menulis LogAudit
```

`src/index.ts` memuat konfigurasi dotenv, CORS, JSON/form parser, mendaftarkan route, health/root endpoint, error handler, lalu membuka port. Route memakai Prisma langsung; service terpisah hanya untuk login/hash password dan audit. Dengan demikian implementasi bukan arsitektur service untuk semua domain.

Pola respons JSON umumnya `{ success: true, data: ..., message?: ... }`. Jika route meneruskan error ke `next`, error handler pusat merespons `{ success: false, message }` dengan `status` dari error atau 500.

### Urutan request transaksi contoh

1. Client mengirim `POST /api/v1/transactions` dengan Bearer JWT dan JSON transaksi.
2. `authenticate` memverifikasi token menggunakan `JWT_SECRET`, lalu mengisi `req.user`.
3. Route menerima variasi nama field snake_case/camelCase, memastikan tanggal, tipe transaksi, dan nominal truthy.
4. `createEntriTransaksi` memastikan jenis transaksi aktif, membuat kode dan menyimpan record melalui transaksi Prisma.
5. Route menulis audit log lalu mengembalikan record.

Contoh inti (sumber lengkap: [transactions.ts](src/routes/transactions.ts:13)):

```ts
const entri = await tx.transaksi.create({
  data: {
    kode, tanggal: params.tanggal, unitBisnis: params.unitBisnis || null,
    jenisTransaksiId: jenisTrx.id, namaTransaksi: jenisTrx.namaTransaksi,
    detail: params.detail || null, jenisKas: params.jenisKas || null,
    nominal: params.nominal, debit: params.debit || null,
    kredit: params.kredit || null, customData: params.customData || undefined,
    sumberInput: params.sumberInput || SumberInput.MANUAL,
    dibuatOleh: params.dibuatOleh,
  },
});
```

## 2. Peta endpoint dan fungsi per file

### `src/index.ts` — bootstrap

- Membuat `app`, memilih `PORT` (default 4000), memasang CORS (`CORS_ORIGIN`, default localhost:3000), parser JSON 7 MB dan urlencoded.
- Mendaftarkan route privat `/api/v1/{auth,dashboard,products,transaction-types,transactions,orders,reports,audit-log,free-tables,cms}` dan route publik `/api/public/{cms,products}`.
- `GET /`: info server; `GET /health`: status dan waktu ISO.
- Error middleware: log error server dan mengubahnya menjadi JSON.
- `app.listen`: mulai menerima request.

Perlu dicatat: tidak ada route customer/supplier/stock yang dipasang di source aktif meskipun disebut README atau ada file JS lama di `dist`.

### `src/middleware/auth.ts` — autentikasi

- `AuthRequest`: menambahkan tipe `user {id,email}` ke Express Request.
- `authenticate`: mensyaratkan `Authorization: Bearer ...`; gagal 401 jika token hilang/tidak valid. Gagal 500 jika `JWT_SECRET` tidak dikonfigurasi. JWT tidak melakukan lookup user pada setiap request.

### `src/utils/response.ts`, `database.ts`, `jenisBawaan.ts`

- `successResponse(data,message?)`: pembungkus sukses JSON.
- `errorResponse(message,status=400)`: membuat Error dengan property status untuk diteruskan ke middleware.
- `prisma`: singleton PrismaClient dengan log query/warn/error dalam development dan error saja di mode lain.
- `KODE_JENIS_BAWAAN`: konstanta `DO1`, `DO2`, `MT1`.
- `getJenisBawaan(kode)`: lookup jenis berdasarkan kode, error 500 jika hilang/nonaktif. Saat ini helper tersebut tidak dipanggil oleh route; fungsi order/dashboard mencari ID kode mereka sendiri.

### `src/services/authService.ts`, `routes/auth.ts`

- `login({email,password})`: lookup Pengguna, bcrypt compare, baca secret pada saat runtime, tandatangani JWT 7 hari `{id,email}`, kembalikan token dan profil minimum. Kredensial salah menghasilkan pesan umum.
- `hashPassword(password)`: bcrypt hash dengan cost 10; disediakan untuk penggunaan service/seed.
- `POST /auth/login`: cek kedua field ada, panggil service, bungkus sukses.
- `GET /auth/me`: autentikasi, lookup user dari ID token, pilih id/nama/email/dibuatPada, 404 bila user telah hilang.

Kode service: [authService.ts](src/services/authService.ts:10). Route: [auth.ts](src/routes/auth.ts:10).

### `src/routes/transactions.ts` — transaksi inti

- `generateKodeTransaksi(tx,prefixKode)`: ambil nomor maksimum dari kode yang cocok prefix melalui raw SQL lalu buat kode `PREFIX###-5digitEpoch`. Dipanggil di dalam transaksi Prisma.
- `createEntriTransaksi(params)`: cek jenis aktif, buat kode, snapshot nama transaksi, tulis nominal/detail/kas/debit/kredit/customData/sumber/pengguna. Validasi jenis dilakukan sebelum `$transaction`; transaksi ini hanya membungkus pembuatan record.
- `GET /`: filter unit, jenis, rentang tanggal, pencarian kode/nama/detail; pagination; sertakan jenis dan kolom custom aktif.
- `GET /:id`: ambil satu transaksi plus jenis dan kolom aktif; 404 jika tidak ada.
- `POST /`: adaptasi nama field snake/camel, validasi minimal, panggil helper, tulis audit tambah, kembalikan entri.
- `PUT /:id`: baca snapshot lama, hanya patch field yang dikirim, update, audit sebelum/sesudah.
- `DELETE /:id`: baca, hapus permanen, audit snapshot sebelum penghapusan.

### `src/services/auditLogService.ts`, `routes/auditLog.ts`

- `createAuditLog(params)`: simpan tabel target, ID, aksi/sumber, label/detail dan serialize snapshot sebelum/sesudah menjadi JSON string.
- `logManualAction(...)`: wrapper yang menetapkan sumber `MANUAL` lalu mendelegasikan ke `createAuditLog`.
- `GET /audit-log`: filter target/sumber/pencarian/rentang hari; default 7 hari, `days=all` atau `0` tanpa batas; pagination dan include profil pembuat. Tambahkan alias field untuk kompatibilitas UI.

### `src/routes/transactionTypes.ts` — master jenis & kolom dinamis

- `GET /`: daftar aktif (default), opsional filter unit dan `aktif`, sertakan kolom aktif/count transaksi.
- `GET /:id`: satu jenis bersama kolom aktif.
- `POST /`: validasi kode/nama/arah dan keunikan kode; buat jenis dengan pemilik dari JWT; audit tambah.
- `PUT /:id`: patch kode/nama/arah/akun/unit/aktif; arah dibatasi PEMASUKAN/PENGELUARAN; audit sebelum/sesudah.
- `DELETE /:id`: menolak penghapusan saat masih dipakai transaksi (409), jika aman hapus kolom dan jenis di transaksi DB; audit sesudah hapus.
- `GET /:id/columns`: ambil kolom aktif menurut urutan.
- `POST /:id/columns`: cek parent, nama/tipe; dropdown wajib beropsi; buat kolom dan audit.
- `PUT /:id/columns/:columnId`: patch definisi kolom dan audit.
- `DELETE /:id/columns/:columnId`: cek JSON transaksi historis. Jika pernah dipakai, nonaktifkan; jika tidak, hapus permanen; audit kedua jalur.

### `src/routes/freeTables.ts` — tabel spreadsheet bebas

- `GET /`, `GET /:id`: daftar/detail struktur kolom dan baris, dengan urutan kolom/baris.
- `POST /`: validasi nama unik, validasi tiap kolom/opsi dropdown, buat tabel dan kolom bersarang, audit.
- `PUT /:id`, `DELETE /:id`: ubah nama/deskripsi atau hapus tabel (relasi cascade menghapus baris/kolom); audit tabel.
- `POST /:id/columns`, `PUT /:id/columns/:columnId`, `DELETE /:id/columns/:columnId`: CRUD kolom bebas. Validasi create terbatas; edit tidak memvalidasi enum/opsi secara lengkap; operasi kolom tidak semua tercatat di audit.
- `POST /:id/rows`, `PUT /:id/rows/:rowId`, `DELETE /:id/rows/:rowId`: menyimpan JSON row, patch penuh `data`, atau hapus. Pembuatan tercatat di audit, update/delete tidak.

### `src/routes/orders.ts` — tampilan transaksi yang dianggap order

- `orderJenisIds()`: cari ID jenis berkode DO1/DO2.
- `GET /`: ambil transaksi di jenis tersebut, filter unit/tanggal, ubah bentuk respons dengan alias order (`totalInvoice`, `jenisOrder`, `kodeOrder` dan snake_case).
- `GET /:id`: satu transaksi dengan jenis yang masuk kategori order; 404 jika tidak ditemukan.
- Tidak ada POST/PUT/DELETE order; order dibuat/diubah melalui `/transactions`.

### `src/routes/dashboard.ts` — agregasi ringkasan

- `orderJenisIds()`: lookup ID DO1/DO2.
- `GET /summary`: hitung saldo pemasukan dikurangi pengeluaran sampai hari ini (saldo tidak dibatasi periode); hitung order dari start periode (7 hari default, hari ini, atau 30 hari). Tidak memakai filter unit.
- `GET /grafik-kas`: ambil transaksi per rentang (7/30 hari atau semua), kelompokkan di memori per tanggal menjadi pemasukan, pengeluaran, dan daftar transaksi.
- `GET /sumber-input`: hitung jumlah sumber AI/manual per tanggal untuk 7 atau 30 hari, sekaligus persentase.
- `GET /peringatan-stok`: saat ini selalu mengembalikan array kosong (placeholder).
- `GET /aktivitas-terbaru`: ambil audit terbaru dengan limit lalu tambah alias UI.
- `GET /pemasukan-pengeluaran`: ambil transaksi 7/30/90 hari, kelompok harian, jumlahkan total dan selisih laba.

### `src/routes/reports.ts` — laporan/export

- `GET /neraca`: sengaja 501; debit/kredit sekarang teks bebas sehingga neraca akun tidak dapat dihitung secara sahih.
- `GET /laba-rugi`: groupBy nominal menurut jenis, gabungkan nama/arah jenis, filter tanggal default 30 hari dan unit; hitung pemasukan, pengeluaran, laba bersih.
- `GET /perubahan-modal`: sengaja 501 karena akun modal tervalidasi tidak ada.
- `GET /export/transactions`: ekspor filter transaksi ke workbook Excel satu sheet.
- `GET /export/free-table/:id`: baca skema dan baris, konversi ID kolom ke label, ekspor Excel. Semua route laporan memerlukan JWT.

### `src/routes/products.ts`, `productsPublic.ts` — katalog produk

- `imageDataFrom(value)`: menerima data URI JPEG/PNG/WEBP/GIF, decode base64, batas 5 MB; menolak format/ukuran salah.
- `withoutImageData(product)`: buang BLOB/MIME dari response JSON.
- Route admin semuanya dilindungi JWT: `GET /` pencarian/status; `GET /:id` detail; `GET /:id/image` kirim BLOB; `POST /` buat produk; `PUT /:id` patch; `DELETE /:id` soft-delete dengan `aktif=false`. Create/update menulis audit. Harga tidak divalidasi sebagai angka nonnegatif.
- Route publik `GET /api/public/products` daftar aktif dengan pencarian; `GET /:id` detail tetapi menolak produk nonaktif; `GET /:id/image` hanya gambar produk aktif, cache satu jam. Bentuk detail menyertakan metadata `gambar` namun bukan BLOB.

### `src/routes/cms.ts`, `cmsPublic.ts` — konten customer page

- Route admin memakai JWT.
- Content: `GET /content` filter key/status; `GET /content/:key` detail; `POST /content` membuat key unik; `PUT /content/:key` membuat jika belum ada atau patch jika ada; `DELETE /content/:key` hapus. Mutasi membuat audit.
- Route publik `GET /content` hanya konten aktif; `GET /content/:key` mengambil berdasarkan key dan menyediakan fallback konten default bila tidak ditemukan.
- Fitur menu CMS telah dihapus pada 12 Nov 2026: menu customer saat ini tetap ditentukan oleh array navigasi statis di WebF. Route menu admin/publik dan helper API-nya dihapus.

## 3. Prisma: model data yang benar-benar aktif

Sumber: [schema.prisma](prisma/schema.prisma:1). MySQL via `DATABASE_URL`; Prisma Client v5.

- Enum: `ArahTransaksi` (PEMASUKAN/PENGELUARAN), `TipeDataKolom` (TEKS/ANGKA/TANGGAL/DROPDOWN), `SumberInput` (MANUAL/AI), `AksiLog` (TAMBAH/UBAH/HAPUS).
- `Pengguna`: akun, hash password, relasi ke transaksi, audit, jenis, tabel bebas, CMS.
- `JenisTransaksi`: master tipe dengan kode unik, arah, unit dan status aktif; punya custom columns dan transaksi.
- `KolomCustom`: definisi input dinamis bagi tipe transaksi, opsi JSON dan urutan.
- `Produk`: katalog termasuk URL gambar dan BLOB + MIME, harga dan status.
- `Transaksi`: record finansial inti, snapshot nama jenis, nominal Decimal, teks debit/kredit, JSON custom fields, input source dan pembuat.
- `TabelBebas`, `KolomTabelBebas`, `BarisTabelBebas`: struktur dinamis; isi tiap baris disimpan sebagai JSON; relasi baris/kolom cascade.
- `LogAudit`: metadata aksi dan snapshot JSON yang diserialisasi sebagai text.
- `CmsContent`: konten landing/customer page. Tidak ada model `CmsMenu`; navigasi customer berasal dari kode frontend.

Catatan penting: schema aktif TIDAK memiliki model stok, customer, supplier, order tersendiri, hutang, jurnal atau chart of accounts. Debit dan kredit berupa string opsional. `journalService.ts` ditandai deprecated dan hanya `export {}`. Laba-rugi masih dapat dihitung dari arah jenis; neraca/perubahan modal sengaja dimatikan.

## 4. Prisma scripts dan utilitas

- `prisma/seed.ts` `main()`: upsert admin `admin@bukudapur.com` dengan password default `password123`, upsert jenis DO1/DO2/MT1, upsert headline CMS. Idempotent pada key/email; tidak mengisi transaksi. Jalankan hanya dengan kesadaran bahwa kredensial default harus diganti untuk deployment.
- `prisma/seed-cms.ts` `main()`: perlu admin lebih dulu, lalu upsert headline/tentang/kontak/produk unggulan; semua upsert mempertahankan data lama (`update: {}`).
- `prisma/clean-db.ts` `main()`: hapus transaksi, kolom/jenis, tabel bebas, audit dan produk; mempertahankan pengguna. Ini operasi penghapusan data.
- `prisma/import-excel.ts`: diberi penanda deprecated; baris pertama langsung melempar Error sehingga tidak menjalankan import. Kode lama setelahnya sudah tidak kompatibel dengan schema sekarang. Jangan jalankan.
- `prisma/migrations/20261112060000_drop_cms_menu/migration.sql`: menghapus tabel CMS menu yang tidak digunakan frontend; migrasi sudah diterapkan ke database lokal.
- `services/journalService.ts`: file kosong untuk jejak histori, bukan service aktif.

## 5. Perbedaan dokumen, source, dan build

- README lama menyebut customers/suppliers/stock dan endpoint CRUD-nya; modul tersebut tidak ada di `src` dan tidak didaftarkan di `index.ts`.
- `dist` berisi route JS lama seperti accounts/customers/debts/stock/partnerStores yang tidak ada pada source TypeScript saat ini. Start script menjalankan `dist/index.js`; karena itu setelah perubahan source, build wajib diperbarui agar produksi tidak menjalankan implementasi lama.
- `DOKUMENTASI_ALUR_KERJA.md` dan `database.md` menjelaskan desain sebelumnya (jurnal/stock/customer/supplier). Cocokkan dengan schema Prisma sebelum dijadikan spesifikasi backend aktif.

## 6. Temuan risiko/ketidaksesuaian dari pembacaan kode

1. **Validasi input terbatas.** `parseInt`, tanggal, page/limit dan tipe data belum divalidasi konsisten. `nominal=0` ditolak karena pemeriksaan `!finalNominal`; tanggal invalid atau limit negatif dapat berakhir sebagai error Prisma/500.
2. **Audit bukan atomik dengan perubahan.** Transaksi/produk dan audit ditulis dalam operasi terpisah. Jika penulisan audit gagal, perubahan utama sudah tersimpan tetapi API error. Beberapa operasi tabel bebas/kolom juga tidak diaudit lengkap.
3. **Sumber AI menjadi audit MANUAL.** `POST /transactions` menerima `sumberInput=AI`, tetapi memanggil `logManualAction`, sehingga sumber log tidak mencerminkan sumber record.
4. **Otorisasi hanya autentikasi.** Route privat memastikan user login tetapi belum membatasi akses berdasarkan pemilik data; endpoint tabel bebas bahkan menerima rowId/columnId tanpa memastikan resource itu milik `:id` di URL.
5. **Audit mengandung respons data.** `dataSebelum/dataSesudah` dapat menyimpan seluruh record; pertimbangkan data sensitif dan konsistensi snapshot.
6. **Bug/edge case filter waktu:** laporan memakai tanggal DB `DATE` tapi membandingkan dengan `Date`; batas akhir tanggal dapat perlu diuji zona waktu. `/dashboard/summary` tidak menerapkan `periode` pada saldo walau parameternya diterima.
7. **CMS publik berdasarkan key:** `GET /public/cms/content/:key` tidak memeriksa `aktif`, sehingga konten nonaktif tetap dapat dibaca bila key diketahui.
8. **Produk:** detail admin mengembalikan produk nonaktif; `PUT` mengubah aktif hanya jika nilai boolean literal `true` (string `"true"` menjadi false). `gambar` URL arbitrary diterima jika bukan data URI.
9. **Kode kode transaksi:** query MAX lalu nomor baru tidak dikunci; dua request serentak berpotensi memilih nomor sama, walaupun constraint unique akan menolak salah satunya. Klaim komentar atomic tidak sepenuhnya dijamin oleh query ini.
10. **Seeding kredensial tetap:** seed menciptakan password default yang diketahui dan tidak memaksa pergantian.

Temuan ini merupakan hasil pembacaan source; belum dijalankan pengujian runtime atau database.

## 7. Daftar kode sumber lengkap

Bootstrap/utilitas: [index.ts](src/index.ts), [auth.ts middleware](src/middleware/auth.ts), [response.ts](src/utils/response.ts), [database.ts](src/utils/database.ts), [jenisBawaan.ts](src/utils/jenisBawaan.ts).

Route: [auth.ts](src/routes/auth.ts), [transactions.ts](src/routes/transactions.ts), [transactionTypes.ts](src/routes/transactionTypes.ts), [orders.ts](src/routes/orders.ts), [dashboard.ts](src/routes/dashboard.ts), [reports.ts](src/routes/reports.ts), [products.ts](src/routes/products.ts), [productsPublic.ts](src/routes/productsPublic.ts), [freeTables.ts](src/routes/freeTables.ts), [auditLog.ts](src/routes/auditLog.ts), [cms.ts](src/routes/cms.ts), [cmsPublic.ts](src/routes/cmsPublic.ts).

Service/database setup: [authService.ts](src/services/authService.ts), [auditLogService.ts](src/services/auditLogService.ts), [journalService.ts](src/services/journalService.ts), [schema.prisma](prisma/schema.prisma), [seed.ts](prisma/seed.ts), [seed-cms.ts](prisma/seed-cms.ts), [clean-db.ts](prisma/clean-db.ts), [import-excel.ts](prisma/import-excel.ts), [migration drop cms_menu](prisma/migrations/20261112060000_drop_cms_menu/migration.sql).

