import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Chart of Accounts - dipindah dari import-excel.ts (COA tetap
// dipertahankan, cuma bagian import transaksi massal dari Excel yang
// dihapus sesuai keputusan "semua data mulai kosong").
const masterAccounts = [
  { kodeAkun: '10000', namaAkun: 'ASET', tipeAkun: 'ASET', parentKode: null, saldoNormal: 'DEBIT' },
  { kodeAkun: '11000', namaAkun: 'KAS & SETARA KAS', tipeAkun: 'ASET', parentKode: '10000', saldoNormal: 'DEBIT' },
  { kodeAkun: '11100', namaAkun: 'Kas Utama', tipeAkun: 'ASET', parentKode: '11000', saldoNormal: 'DEBIT' },
  { kodeAkun: '11200', namaAkun: 'PIUTANG', tipeAkun: 'ASET', parentKode: '10000', saldoNormal: 'DEBIT' },
  { kodeAkun: '11210', namaAkun: 'Piutang Usaha', tipeAkun: 'ASET', parentKode: '11200', saldoNormal: 'DEBIT' },
  { kodeAkun: '12000', namaAkun: 'ASET TETAP', tipeAkun: 'ASET', parentKode: '10000', saldoNormal: 'DEBIT' },
  { kodeAkun: '12100', namaAkun: 'Tanah', tipeAkun: 'ASET', parentKode: '12000', saldoNormal: 'DEBIT' },
  { kodeAkun: '12200', namaAkun: 'Bangunan', tipeAkun: 'ASET', parentKode: '12000', saldoNormal: 'DEBIT' },
  { kodeAkun: '12210', namaAkun: 'Akumulasi Penyusutan Bangunan', tipeAkun: 'ASET', parentKode: '12200', saldoNormal: 'KREDIT' },
  { kodeAkun: '12300', namaAkun: 'Kendaraan', tipeAkun: 'ASET', parentKode: '12000', saldoNormal: 'DEBIT' },
  { kodeAkun: '12310', namaAkun: 'Akumulasi Penyusutan Kendaraan', tipeAkun: 'ASET', parentKode: '12300', saldoNormal: 'KREDIT' },
  { kodeAkun: '12400', namaAkun: 'Peralatan dan Furnitur', tipeAkun: 'ASET', parentKode: '12000', saldoNormal: 'DEBIT' },
  { kodeAkun: '12410', namaAkun: 'Akumulasi Penyusutan Peralatan', tipeAkun: 'ASET', parentKode: '12400', saldoNormal: 'KREDIT' },
  { kodeAkun: '20000', namaAkun: 'HUTANG', tipeAkun: 'HUTANG', parentKode: null, saldoNormal: 'KREDIT' },
  { kodeAkun: '21000', namaAkun: 'HUTANG LANCAR', tipeAkun: 'HUTANG', parentKode: '20000', saldoNormal: 'KREDIT' },
  { kodeAkun: '21100', namaAkun: 'Hutang Usaha', tipeAkun: 'HUTANG', parentKode: '21000', saldoNormal: 'KREDIT' },
  { kodeAkun: '30000', namaAkun: 'MODAL', tipeAkun: 'MODAL', parentKode: null, saldoNormal: 'KREDIT' },
  { kodeAkun: '31000', namaAkun: 'Modal Awal', tipeAkun: 'MODAL', parentKode: '30000', saldoNormal: 'KREDIT' },
  { kodeAkun: '31100', namaAkun: 'Prive Pemilik', tipeAkun: 'MODAL', parentKode: '30000', saldoNormal: 'DEBIT' },
  { kodeAkun: '32300', namaAkun: 'Akumulasi Laba', tipeAkun: 'MODAL', parentKode: '30000', saldoNormal: 'KREDIT' },
  { kodeAkun: '40000', namaAkun: 'PENDAPATAN USAHA', tipeAkun: 'PENDAPATAN', parentKode: null, saldoNormal: 'KREDIT' },
  { kodeAkun: '41000', namaAkun: 'Pendapatan FROZEN', tipeAkun: 'PENDAPATAN', parentKode: '40000', saldoNormal: 'KREDIT' },
  { kodeAkun: '42000', namaAkun: 'Pendapatan MAKLON', tipeAkun: 'PENDAPATAN', parentKode: '40000', saldoNormal: 'KREDIT' },
  { kodeAkun: '43000', namaAkun: 'Pendapatan BOOTH', tipeAkun: 'PENDAPATAN', parentKode: '40000', saldoNormal: 'KREDIT' },
  { kodeAkun: '44000', namaAkun: 'Pendapatan PESANAN', tipeAkun: 'PENDAPATAN', parentKode: '40000', saldoNormal: 'KREDIT' },
  { kodeAkun: '49000', namaAkun: 'Pendapatan Lain', tipeAkun: 'PENDAPATAN', parentKode: '40000', saldoNormal: 'KREDIT' },
  { kodeAkun: '51000', namaAkun: 'BIAYA LANGSUNG', tipeAkun: 'BIAYA_LANGSUNG', parentKode: null, saldoNormal: 'DEBIT' },
  { kodeAkun: '51100', namaAkun: 'Biaya Bahan', tipeAkun: 'BIAYA_LANGSUNG', parentKode: '51000', saldoNormal: 'DEBIT' },
  { kodeAkun: '51200', namaAkun: 'Biaya Kemasan', tipeAkun: 'BIAYA_LANGSUNG', parentKode: '51000', saldoNormal: 'DEBIT' },
  { kodeAkun: '51400', namaAkun: 'Biaya Konsumsi', tipeAkun: 'BIAYA_LANGSUNG', parentKode: '51000', saldoNormal: 'DEBIT' },
  { kodeAkun: '51500', namaAkun: 'Biaya Perlengkapan', tipeAkun: 'BIAYA_LANGSUNG', parentKode: '51000', saldoNormal: 'DEBIT' },
  { kodeAkun: '51800', namaAkun: 'Biaya Kirim / Transport', tipeAkun: 'BIAYA_LANGSUNG', parentKode: '51000', saldoNormal: 'DEBIT' },
  { kodeAkun: '51900', namaAkun: 'Biaya Langsung Lain', tipeAkun: 'BIAYA_LANGSUNG', parentKode: '51000', saldoNormal: 'DEBIT' },
  { kodeAkun: '52000', namaAkun: 'BIAYA TIDAK LANGSUNG', tipeAkun: 'BIAYA_TIDAK_LANGSUNG', parentKode: null, saldoNormal: 'DEBIT' },
  { kodeAkun: '52100', namaAkun: 'Biaya Gaji Karyawan', tipeAkun: 'BIAYA_TIDAK_LANGSUNG', parentKode: '52000', saldoNormal: 'DEBIT' },
  { kodeAkun: '52200', namaAkun: 'Biaya Listrik', tipeAkun: 'BIAYA_TIDAK_LANGSUNG', parentKode: '52000', saldoNormal: 'DEBIT' },
  { kodeAkun: '52210', namaAkun: 'Biaya Internet Telepon', tipeAkun: 'BIAYA_TIDAK_LANGSUNG', parentKode: '52000', saldoNormal: 'DEBIT' },
  { kodeAkun: '52400', namaAkun: 'Biaya Perlengkapan & ATK', tipeAkun: 'BIAYA_TIDAK_LANGSUNG', parentKode: '52000', saldoNormal: 'DEBIT' },
  { kodeAkun: '52600', namaAkun: 'Biaya Sewa', tipeAkun: 'BIAYA_TIDAK_LANGSUNG', parentKode: '52000', saldoNormal: 'DEBIT' },
  { kodeAkun: '52700', namaAkun: 'Biaya Perbaikan', tipeAkun: 'BIAYA_TIDAK_LANGSUNG', parentKode: '52000', saldoNormal: 'DEBIT' },
  { kodeAkun: '52800', namaAkun: 'Biaya Transportasi Umum', tipeAkun: 'BIAYA_TIDAK_LANGSUNG', parentKode: '52000', saldoNormal: 'DEBIT' },
  { kodeAkun: '52900', namaAkun: 'Biaya Pelatihan dan Buku', tipeAkun: 'BIAYA_TIDAK_LANGSUNG', parentKode: '52000', saldoNormal: 'DEBIT' },
  { kodeAkun: '52910', namaAkun: 'Biaya Penyusutan Bangunan', tipeAkun: 'BIAYA_TIDAK_LANGSUNG', parentKode: '52000', saldoNormal: 'DEBIT' },
  { kodeAkun: '52920', namaAkun: 'Biaya Penyusutan Kendaraan', tipeAkun: 'BIAYA_TIDAK_LANGSUNG', parentKode: '52000', saldoNormal: 'DEBIT' },
  { kodeAkun: '52930', namaAkun: 'Biaya Penyusutan Peralatan', tipeAkun: 'BIAYA_TIDAK_LANGSUNG', parentKode: '52000', saldoNormal: 'DEBIT' },
  { kodeAkun: '52940', namaAkun: 'Biaya Tidak Langsung Lain', tipeAkun: 'BIAYA_TIDAK_LANGSUNG', parentKode: '52000', saldoNormal: 'DEBIT' },
  { kodeAkun: '61000', namaAkun: 'PENDAPATAN NON OPERASI', tipeAkun: 'NON_OPERASIONAL', parentKode: '40000', saldoNormal: 'KREDIT' },
  { kodeAkun: '61900', namaAkun: 'Pendapatan Non Operasi Lain', tipeAkun: 'NON_OPERASIONAL', parentKode: '61000', saldoNormal: 'KREDIT' },
  { kodeAkun: '62000', namaAkun: 'BIAYA NON OPERASI', tipeAkun: 'NON_OPERASIONAL', parentKode: '52000', saldoNormal: 'DEBIT' },
  { kodeAkun: '62100', namaAkun: 'Biaya Administrasi Bank', tipeAkun: 'NON_OPERASIONAL', parentKode: '62000', saldoNormal: 'DEBIT' },
];

async function main() {
  console.log('Seeding Chart of Accounts...');
  // Urutan penting: parent sebelum anak (parentKode adalah FK).
  for (const acc of masterAccounts) {
    await prisma.jenisAkun.upsert({
      where: { kodeAkun: acc.kodeAkun },
      update: {},
      create: {
        kodeAkun: acc.kodeAkun,
        namaAkun: acc.namaAkun,
        tipeAkun: acc.tipeAkun,
        parentKode: acc.parentKode,
        saldoNormal: acc.saldoNormal,
      },
    });
  }

  console.log('Seeding admin user...');
  const passwordHash = await bcrypt.hash('password123', 10);
  const adminUser = await prisma.pengguna.upsert({
    where: { email: 'admin@bukudapur.com' },
    update: {},
    create: {
      nama: 'Admin',
      email: 'admin@bukudapur.com',
      passwordHash,
    },
  });

  console.log('Seeding jenis transaksi bawaan (supaya order & hutang langsung jalan)...');
  // Ini CUMA seed awal - user tetap full CRUD atas ketiganya lewat GUI.
  // jenisAkun di sini cuma SARAN teks bebas (bukan referensi akun yang
  // divalidasi) sejak Debit/Kredit jadi opsional & bebas diketik.
  const jenisBawaan = [
    {
      kode: 'DO1',
      namaTransaksi: 'Pendapatan Frozen',
      arah: 'PEMASUKAN' as const,
      jenisAkun: 'Pendapatan FROZEN',
    },
    {
      kode: 'DO2',
      namaTransaksi: 'Pendapatan Siap Saji',
      arah: 'PEMASUKAN' as const,
      jenisAkun: 'Pendapatan PESANAN',
    },
    {
      kode: 'MT1',
      namaTransaksi: 'Pembayaran Cicilan Hutang',
      arah: 'PENGELUARAN' as const,
      jenisAkun: 'Hutang Usaha',
    },
  ];

  for (const j of jenisBawaan) {
    await prisma.jenisTransaksi.upsert({
      where: { kode: j.kode },
      update: {},
      create: {
        kode: j.kode,
        namaTransaksi: j.namaTransaksi,
        arah: j.arah,
        jenisAkun: j.jenisAkun,
        isBawaan: true,
        dibuatOleh: adminUser.id,
      },
    });
  }

  console.log('Seed selesai. Semua data transaksi/entri sengaja dibiarkan KOSONG - diisi user lewat GUI.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
