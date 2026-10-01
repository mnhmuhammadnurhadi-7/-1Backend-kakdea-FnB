// ============================================================
// DEPRECATED sejak revisi arsitektur 27 Sep 2026: bulk Excel import
// sudah tidak dipakai lagi - semua data transaksi mulai kosong, diisi
// user lewat GUI CRUD. File ini juga sudah tidak kompatibel dengan
// schema.prisma yang baru (TipeTransaksi enum sudah dihapus, diganti
// JenisTransaksi dinamis). Dibiarkan ada untuk referensi histori Chart
// of Accounts saja (sudah dipindah ke prisma/seed.ts) - JANGAN dijalankan.
// ============================================================
throw new Error(
  'import-excel.ts sudah deprecated - bulk import Excel tidak dipakai lagi sejak revisi arsitektur ' +
  '27 Sep 2026. Chart of Accounts sudah ada di prisma/seed.ts (jalankan `npm run prisma:seed`).'
);

import { PrismaClient, TipeTransaksi, SumberInput } from '@prisma/client';
import * as XLSX from 'xlsx';
import path from 'path';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Helper to normalize strings for comparison
function normalize(s: string | null | undefined): string {
  if (!s) return '';
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Chart of Accounts Master Data
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

function resolveAkunKode(name: string | null | undefined): string | null {
  if (!name) return null;
  const n = normalize(name);
  const found = masterAccounts.find(a => normalize(a.namaAkun) === n);
  if (found) return found.kodeAkun;
  if (n.includes('kasutama') || n === 'kas') return '11100';
  if (n.includes('hutangusaha')) return '21100';
  if (n.includes('biayaperlengkapan')) return '51500';
  if (n.includes('peralatandanfurnitur') || n.includes('peralatan')) return '12400';
  if (n.includes('biayaperbaikan')) return '52700';
  if (n.includes('biayasewa')) return '52600';
  if (n.includes('biayalistrik')) return '52200';
  if (n.includes('biayakonsumsi')) return '51400';
  if (n.includes('privepemilik') || n.includes('prive')) return '31100';
  if (n.includes('administrasibank') || n.includes('adminbank')) return '62100';
  if (n.includes('internettelepon') || n.includes('internet')) return '52210';
  if (n.includes('pelatihandanbuku') || n.includes('pelatihan')) return '52900';
  if (n.includes('pendapatannonoperasi')) return '61900';
  return null;
}

// Parse Indonesian dates like "Sen, 5 Jan 26" or "Rab, 1 Nov 23"
function parseIndonesianDate(str: string): Date {
  if (!str) return new Date();
  const clean = String(str).replace(/^[A-Za-z]+,\s*/, '').trim();
  const parts = clean.split(/\s+/);
  if (parts.length < 3) return new Date();
  const day = parseInt(parts[0], 10);
  const monthStr = parts[1].toLowerCase();
  let year = parseInt(parts[2], 10);
  if (year < 100) year += 2000;

  const monthMap: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, mei: 4, jun: 5,
    jul: 6, agu: 7, ags: 7, sep: 8, okt: 9, nov: 10, des: 11
  };
  const month = monthMap[monthStr] ?? 0;
  return new Date(Date.UTC(year, month, day));
}

// Parse month string from header (e.g. "MAR 24") to last day of month
function parseMonthHeaderToDate(headerStr: string): Date {
  const parts = headerStr.trim().split(/\s+/);
  const monthStr = parts[0].toLowerCase();
  let year = parseInt(parts[1], 10);
  if (year < 100) year += 2000;

  const monthMap: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, mei: 4, jun: 5,
    jul: 6, agu: 7, agt: 7, ags: 7, sep: 8, okt: 9, nov: 10, des: 11
  };
  const month = monthMap[monthStr] ?? 0;
  // Last day of this month
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, lastDay));
}

async function main() {
  console.log('====================================================');
  console.log('STARTING IDEMPOTENT DATA IMPORT & DUMMY GENERATION');
  console.log('====================================================');

  const warnings: string[] = [];

  // 1. Clean existing data in dependency order
  console.log('\n--- Cleaning existing database tables...');
  await prisma.jurnalEntriBaris.deleteMany({});
  await prisma.transaksi.deleteMany({});
  await prisma.jurnalEntri.deleteMany({});
  await prisma.logAudit.deleteMany({});
  await prisma.hutang.deleteMany({});
  await prisma.produk.deleteMany({});
  await prisma.dataPelanggan.deleteMany({});
  await prisma.dataPemasok.deleteMany({});
  await prisma.jenisTransaksi.deleteMany({});
  await prisma.jenisAkun.deleteMany({});
  await prisma.pengguna.deleteMany({});
  console.log('✓ All tables cleaned.');

  // 2. Create Default Admin User
  console.log('\n--- Creating default Pengguna...');
  const passwordHash = await bcrypt.hash('password123', 10);
  const adminUser = await prisma.pengguna.create({
    data: {
      nama: 'Admin Buku Dapur',
      email: 'admin@bukudapur.com',
      passwordHash,
    },
  });
  console.log(`✓ Pengguna created: id=${adminUser.id}, email=${adminUser.email}`);

  // 3. Seed JenisAkun
  console.log('\n--- Seeding JenisAkun (Chart of Accounts)...');
  for (const acc of masterAccounts) {
    await prisma.jenisAkun.create({
      data: {
        kodeAkun: acc.kodeAkun,
        namaAkun: acc.namaAkun,
        tipeAkun: acc.tipeAkun,
        parentKode: acc.parentKode,
        saldoNormal: acc.saldoNormal,
        aktif: true,
      },
    });
  }
  console.log(`✓ ${masterAccounts.length} JenisAkun records seeded.`);

  // Load Excel File
  const filePath = path.join(__dirname, 'source-data/SOJU_CORP_FINANCE_MASTER.xlsx');
  const wb = XLSX.readFile(filePath);

  // 4. Sheet "MASTER TRANSAKSI" -> JenisTransaksi
  console.log('\n--- Importing Sheet: MASTER TRANSAKSI -> JenisTransaksi...');
  const wsMasterTrx = wb.Sheets['MASTER TRANSAKSI'];
  const masterTrxRows: any[][] = XLSX.utils.sheet_to_json(wsMasterTrx, { header: 1, defval: null });

  const tipeMapping: Record<string, { tipe: TipeTransaksi; prefix: string }> = {
    'DATA ORDER': { tipe: TipeTransaksi.DATA_ORDER, prefix: 'JO' },
    'CASH IN': { tipe: TipeTransaksi.CASH_IN, prefix: 'CS' },
    'BIAYA LANGSUNG': { tipe: TipeTransaksi.BIAYA_LANGSUNG, prefix: 'BL' },
    'BIAYA TAK LANGSUNG': { tipe: TipeTransaksi.BIAYA_TAK_LANGSUNG, prefix: 'BP' },
    'MUTASI': { tipe: TipeTransaksi.MUTASI, prefix: 'MT' },
    'PENYUSUTAN': { tipe: TipeTransaksi.PENYUSUTAN, prefix: 'PY' },
  };

  let countJenisTransaksi = 0;
  // Row index 3 is header (0-indexed: 2), data starts at row index 4 (0-indexed: 3)
  for (let i = 3; i < masterTrxRows.length; i++) {
    const row = masterTrxRows[i];
    if (!row || row[0] === null || !row[1] || !row[2]) continue;

    const rawKode = String(row[0]).trim();
    const rawTipe = String(row[1]).trim();
    const namaTrx = String(row[2]).trim();
    const mapping = tipeMapping[rawTipe];

    if (!mapping) {
      warnings.push(`MASTER TRANSAKSI row ${i + 1}: Unrecognized tipe "${rawTipe}"`);
      continue;
    }

    // Resolve Debit & Kredit codes
    let akunDebitKode: string | null = row[6] ? String(row[6]).trim() : null;
    let akunKreditKode: string | null = row[7] ? String(row[7]).trim() : null;

    if (!akunDebitKode && row[3]) {
      akunDebitKode = resolveAkunKode(String(row[3]));
    }
    if (!akunKreditKode && row[4]) {
      akunKreditKode = resolveAkunKode(String(row[4]));
    }

    // Verify against JenisAkun
    if (akunDebitKode && !masterAccounts.some(a => a.kodeAkun === akunDebitKode)) {
      warnings.push(`MASTER TRANSAKSI row ${i + 1} (${namaTrx}): debit code ${akunDebitKode} not in JenisAkun`);
      akunDebitKode = null;
    }
    if (akunKreditKode && !masterAccounts.some(a => a.kodeAkun === akunKreditKode)) {
      warnings.push(`MASTER TRANSAKSI row ${i + 1} (${namaTrx}): kredit code ${akunKreditKode} not in JenisAkun`);
      akunKreditKode = null;
    }

    await prisma.jenisTransaksi.create({
      data: {
        kode: rawKode,
        tipe: mapping.tipe,
        namaTransaksi: namaTrx,
        prefixKode: mapping.prefix,
        akunDebitKode,
        akunKreditKode,
        aktif: true,
      },
    });
    countJenisTransaksi++;
  }

  // Also ensure JenisTransaksi for Hutang Repayment exists
  const existingHutangTrx = await prisma.jenisTransaksi.findFirst({
    where: { tipe: TipeTransaksi.MUTASI, namaTransaksi: 'Pembayaran Cicilan Hutang' },
  });
  if (!existingHutangTrx) {
    await prisma.jenisTransaksi.create({
      data: {
        kode: 'MT-HTG',
        tipe: TipeTransaksi.MUTASI,
        namaTransaksi: 'Pembayaran Cicilan Hutang',
        prefixKode: 'MT',
        akunDebitKode: '21100', // Hutang Usaha
        akunKreditKode: '11100', // Kas Utama
        aktif: true,
      },
    });
    countJenisTransaksi++;
  }
  console.log(`✓ ${countJenisTransaksi} JenisTransaksi records imported.`);

  // 5. Sheet "DATA SUPPLIER" -> DataPemasok
  console.log('\n--- Importing Sheet: DATA SUPPLIER -> DataPemasok...');
  const wsSupplier = wb.Sheets['DATA SUPPLIER'];
  const supplierRows: any[][] = XLSX.utils.sheet_to_json(wsSupplier, { header: 1, defval: null });
  let countPemasok = 0;

  // Header is row 3 (0-indexed 2), data starts row 4 (0-indexed 3)
  for (let i = 3; i < supplierRows.length; i++) {
    const row = supplierRows[i];
    if (!row || !row[1] || !row[2]) continue; // needs KODE and SUPPLIER

    const kode = String(row[1]).trim();
    const nama = String(row[2]).trim();
    const alamat = row[3] ? String(row[3]).trim() : null;
    const kontakPerson = row[4] ? String(row[4]).trim() : null;
    const telepon = row[5] ? String(row[5]).trim() : null;
    const bankNama = row[6] ? String(row[6]).trim() : null;
    const rekening = row[7] ? String(row[7]).trim() : null;
    const saldoHutang = Number(row[8]) || 0;
    const keterangan = row[9] ? String(row[9]).trim() : null;

    await prisma.dataPemasok.create({
      data: {
        kode,
        nama,
        alamat,
        kontakPerson,
        telepon,
        bankNama,
        rekening,
        saldoHutang,
        keterangan,
      },
    });
    countPemasok++;
  }
  console.log(`✓ ${countPemasok} DataPemasok records imported.`);

  // 6. Sheet "DATA CUSTOMER" -> DataPelanggan
  console.log('\n--- Importing Sheet: DATA CUSTOMER -> DataPelanggan...');
  const wsCustomer = wb.Sheets['DATA CUSTOMER'];
  const customerRows: any[][] = XLSX.utils.sheet_to_json(wsCustomer, { header: 1, defval: null });
  let countPelanggan = 0;

  for (let i = 3; i < customerRows.length; i++) {
    const row = customerRows[i];
    if (!row || !row[0] || !row[1]) continue; // needs KODE and CUSTOMER

    const kode = String(row[0]).trim();
    const nama = String(row[1]).trim();
    const status = row[2] ? String(row[2]).trim() : null;
    const alamat = row[3] ? String(row[3]).trim() : null;
    const kontakPerson = row[4] ? String(row[4]).trim() : null;
    const telepon = row[5] ? String(row[5]).trim() : null;
    const bankNama = row[6] ? String(row[6]).trim() : null;
    const rekening = row[7] ? String(row[7]).trim() : null;
    const saldoPiutang = Number(row[8]) || 0;
    const keterangan = row[9] ? String(row[9]).trim() : null;

    await prisma.dataPelanggan.create({
      data: {
        kode,
        nama,
        status,
        alamat,
        kontakPerson,
        telepon,
        bankNama,
        rekening,
        saldoPiutang,
        keterangan,
      },
    });
    countPelanggan++;
  }
  console.log(`✓ ${countPelanggan} DataPelanggan records imported.`);

  // 7. Seed Standard Products (Produk) so DATA_ORDER transactions can reference them
  console.log('\n--- Seeding Master Produk...');
  const masterProdukList = [
    { kode: 'PRD-01', namaBarang: 'Sosis Jumbo Sapi', varian: '500 GRAM', hargaDefault: 45000 },
    { kode: 'PRD-02', namaBarang: 'Dimsum Ayam Ori', varian: 'ISI 10', hargaDefault: 35000 },
    { kode: 'PRD-03', namaBarang: 'Nugget Ayam Crispy', varian: '500 GRAM', hargaDefault: 38000 },
    { kode: 'PRD-04', namaBarang: 'Siomay Ikan Frozen', varian: 'ISI 12', hargaDefault: 32000 },
    { kode: 'PRD-05', namaBarang: 'Bakso Sapi Urat', varian: '500 GRAM', hargaDefault: 55000 },
    { kode: 'PRD-06', namaBarang: 'Tahu Bakso Ayam', varian: 'ISI 10', hargaDefault: 30000 },
    { kode: 'PRD-07', namaBarang: 'Cireng Crispy Bumbu Rujak', varian: 'PACK', hargaDefault: 20000 },
    { kode: 'PRD-08', namaBarang: 'Kebab Mini Frozen', varian: 'ISI 5', hargaDefault: 40000 },
  ];
  for (const p of masterProdukList) {
    await prisma.produk.create({
      data: {
        kode: p.kode,
        namaBarang: p.namaBarang,
        varian: p.varian,
        hargaDefault: p.hargaDefault,
        satuan: 'pcs',
        aktif: true,
      },
    });
  }
  console.log(`✓ ${masterProdukList.length} master Produk seeded.`);

  // Fetch all JenisTransaksi for reference lookup
  const allJenisTransaksi = await prisma.jenisTransaksi.findMany();

  // 8. Sheet "SP - BIAYA TAK LANGSUNG" -> Transaksi + JurnalEntri
  console.log('\n--- Importing Sheet: SP - BIAYA TAK LANGSUNG -> Transaksi...');
  const wsIndirect = wb.Sheets['SP - BIAYA TAK LANGSUNG'];
  const indirectRows: any[][] = XLSX.utils.sheet_to_json(wsIndirect, { header: 1, defval: null });
  let countRealIndirect = 0;

  for (let i = 3; i < indirectRows.length; i++) {
    const row = indirectRows[i];
    if (!row || !row[0] || row[3] === 'TOTAL') continue;

    const kode = String(row[0]).trim();
    const tanggal = parseIndonesianDate(String(row[1]));
    const namaTrx = String(row[2]).trim();
    const detail = row[3] ? String(row[3]).trim() : null;
    const jenisKas = row[4] ? String(row[4]).trim() : 'Kas Utama';
    const nominal = Number(row[5]) || 0;
    const debitName = row[6] ? String(row[6]).trim() : null;
    const kreditName = row[7] ? String(row[7]).trim() : null;

    // Match JenisTransaksi
    const matchJenisTrx = allJenisTransaksi.find(
      jt => jt.tipe === TipeTransaksi.BIAYA_TAK_LANGSUNG && normalize(jt.namaTransaksi) === normalize(namaTrx)
    ) || allJenisTransaksi.find(
      jt => jt.tipe === TipeTransaksi.BIAYA_TAK_LANGSUNG && normalize(namaTrx).includes(normalize(jt.namaTransaksi))
    );

    if (!matchJenisTrx) {
      warnings.push(`BIAYA TAK LANGSUNG row ${i + 1} (${kode}): No matching JenisTransaksi for "${namaTrx}"`);
    }

    const jenisTrxId = matchJenisTrx ? matchJenisTrx.id : allJenisTransaksi.find(jt => jt.tipe === TipeTransaksi.BIAYA_TAK_LANGSUNG)!.id;

    // Resolve Account Codes
    let akunDebitKode = resolveAkunKode(debitName) || matchJenisTrx?.akunDebitKode || null;
    let akunKreditKode = resolveAkunKode(kreditName) || '11100'; // Default Kas Utama

    if (!akunDebitKode) {
      warnings.push(`BIAYA TAK LANGSUNG row ${i + 1} (${kode}): Failed to resolve DEBIT account for "${debitName}"`);
    }
    if (!akunKreditKode) {
      warnings.push(`BIAYA TAK LANGSUNG row ${i + 1} (${kode}): Failed to resolve KREDIT account for "${kreditName}"`);
    }

    // Auto-generate JurnalEntri + JurnalEntriBaris
    const jurnal = await prisma.jurnalEntri.create({
      data: {
        tanggal,
        deskripsi: `${namaTrx} - ${detail || ''}`.trim(),
        unitBisnis: 'PABRIK',
        dibuatOleh: adminUser.id,
        viaAi: false,
        baris: {
          create: [
            ...(akunDebitKode ? [{ akunKode: akunDebitKode, debit: nominal, kredit: 0 }] : []),
            ...(akunKreditKode ? [{ akunKode: akunKreditKode, debit: 0, kredit: nominal }] : []),
          ],
        },
      },
    });

    // Create Transaksi
    await prisma.transaksi.create({
      data: {
        kode,
        tanggal,
        unitBisnis: 'PABRIK',
        jenisTransaksiId: jenisTrxId,
        tipe: TipeTransaksi.BIAYA_TAK_LANGSUNG,
        namaTransaksi: namaTrx,
        detail,
        jenisKas,
        nominal,
        akunDebitKode,
        akunKreditKode,
        jurnalEntriId: jurnal.id,
        sumberInput: SumberInput.MANUAL,
        dibuatOleh: adminUser.id,
      },
    });
    countRealIndirect++;
  }
  console.log(`✓ ${countRealIndirect} real BIAYA_TAK_LANGSUNG Transaksi records imported.`);

  // 9. Sheet "CASH IN" -> Transaksi + JurnalEntri
  console.log('\n--- Importing Sheet: CASH IN -> Transaksi...');
  const wsCashIn = wb.Sheets['CASH IN'];
  const cashInRows: any[][] = XLSX.utils.sheet_to_json(wsCashIn, { header: 1, defval: null });
  let countRealCashIn = 0;

  for (let i = 3; i < cashInRows.length; i++) {
    const row = cashInRows[i];
    if (!row || !row[0]) continue;

    const kode = String(row[0]).trim();
    const tanggal = parseIndonesianDate(String(row[1]));
    const rawNamaTrx = String(row[2]).trim();
    const detail = row[3] ? String(row[3]).trim() : null;
    const jenisKas = row[4] ? String(row[4]).trim() : 'Kas Utama';
    const nominal = Number(row[5]) || 0;
    const debitName = row[6] ? String(row[6]).trim() : null;
    const kreditName = row[7] ? String(row[7]).trim() : null;

    // Use first line of rawNamaTrx for matching
    const cleanNamaTrx = rawNamaTrx.split(/[\r\n]+/)[0].trim();

    const matchJenisTrx = allJenisTransaksi.find(
      jt => jt.tipe === TipeTransaksi.CASH_IN && normalize(jt.namaTransaksi) === normalize(cleanNamaTrx)
    ) || allJenisTransaksi.find(
      jt => jt.tipe === TipeTransaksi.CASH_IN && normalize(cleanNamaTrx).includes(normalize(jt.namaTransaksi))
    );

    if (!matchJenisTrx) {
      warnings.push(`CASH IN row ${i + 1} (${kode}): No matching JenisTransaksi for "${cleanNamaTrx}"`);
    }

    const jenisTrxId = matchJenisTrx ? matchJenisTrx.id : allJenisTransaksi.find(jt => jt.tipe === TipeTransaksi.CASH_IN)!.id;

    let akunDebitKode = resolveAkunKode(debitName) || '11100'; // Kas Utama
    let akunKreditKode = resolveAkunKode(kreditName) || '21100'; // Hutang Usaha

    const jurnal = await prisma.jurnalEntri.create({
      data: {
        tanggal,
        deskripsi: `${cleanNamaTrx} - ${detail || ''}`.trim(),
        unitBisnis: 'NEXT_LEVEL',
        dibuatOleh: adminUser.id,
        viaAi: false,
        baris: {
          create: [
            ...(akunDebitKode ? [{ akunKode: akunDebitKode, debit: nominal, kredit: 0 }] : []),
            ...(akunKreditKode ? [{ akunKode: akunKreditKode, debit: 0, kredit: nominal }] : []),
          ],
        },
      },
    });

    await prisma.transaksi.create({
      data: {
        kode,
        tanggal,
        unitBisnis: 'NEXT_LEVEL',
        jenisTransaksiId: jenisTrxId,
        tipe: TipeTransaksi.CASH_IN,
        namaTransaksi: cleanNamaTrx,
        detail,
        jenisKas,
        nominal,
        akunDebitKode,
        akunKreditKode,
        jurnalEntriId: jurnal.id,
        sumberInput: SumberInput.MANUAL,
        dibuatOleh: adminUser.id,
      },
    });
    countRealCashIn++;
  }
  console.log(`✓ ${countRealCashIn} real CASH_IN Transaksi records imported.`);

  // 10. Sheet "HUTANG PLANNING 2" -> Hutang + Transaksi repayments
  console.log('\n--- Importing Sheet: HUTANG PLANNING 2 -> Hutang & Repayment Transaksi...');
  const wsHutang = wb.Sheets['HUTANG PLANNING 2'];
  const hutangRows: any[][] = XLSX.utils.sheet_to_json(wsHutang, { header: 1, defval: null });
  const monthHeaders: { colIndex: number; header: string; date: Date }[] = [];

  // Month columns start from column index 4 ("MAR 24") up to column 16 ("MAR 25")
  const headerRow = hutangRows[2]; // row index 2 is row 3
  for (let c = 4; c < headerRow.length; c++) {
    if (headerRow[c]) {
      const hStr = String(headerRow[c]).trim();
      monthHeaders.push({
        colIndex: c,
        header: hStr,
        date: parseMonthHeaderToDate(hStr),
      });
    }
  }

  const hutangJenisTrx = allJenisTransaksi.find(
    jt => jt.tipe === TipeTransaksi.MUTASI && jt.namaTransaksi === 'Pembayaran Cicilan Hutang'
  ) || allJenisTransaksi.find(jt => jt.tipe === TipeTransaksi.MUTASI)!;

  let countHutang = 0;
  let countRepaymentTrx = 0;
  const hutangResults: { namaKreditur: string; pinjaman: number; dibayar: number; sisa: number }[] = [];

  for (let i = 3; i < hutangRows.length; i++) {
    const row = hutangRows[i];
    if (!row || !row[1] || String(row[1]).includes('TOTAL SISA DEBT')) continue;

    const namaKreditur = String(row[1]).trim();
    const jaminan = row[2] ? String(row[2]).trim() : null;
    const jumlahPinjaman = Number(row[3]) || 0;

    const hutangRecord = await prisma.hutang.create({
      data: {
        namaKreditur,
        jaminan,
        jumlahPinjaman,
        sisaHutang: jumlahPinjaman, // Initial before repayments
      },
    });
    countHutang++;

    let totalDibayar = 0;

    // Check each month column for repayment
    for (const m of monthHeaders) {
      const amount = Number(row[m.colIndex]) || 0;
      if (amount > 0) {
        totalDibayar += amount;
        const trxKode = `MT-H${hutangRecord.id}-${m.header.replace(/\s+/g, '')}`;

        const jurnal = await prisma.jurnalEntri.create({
          data: {
            tanggal: m.date,
            deskripsi: `Pembayaran Cicilan Hutang ${namaKreditur} - ${m.header}`,
            unitBisnis: 'PABRIK',
            dibuatOleh: adminUser.id,
            viaAi: false,
            baris: {
              create: [
                { akunKode: '21100', debit: amount, kredit: 0 }, // Hutang Usaha berkurang (Debit)
                { akunKode: '11100', debit: 0, kredit: amount }, // Kas berkurang (Kredit)
              ],
            },
          },
        });

        await prisma.transaksi.create({
          data: {
            kode: trxKode,
            tanggal: m.date,
            unitBisnis: 'PABRIK',
            jenisTransaksiId: hutangJenisTrx.id,
            tipe: TipeTransaksi.MUTASI,
            namaTransaksi: 'Pembayaran Cicilan Hutang',
            detail: `Pembayaran cicilan hutang ${namaKreditur} periode ${m.header}`,
            jenisKas: 'Kas Utama',
            nominal: amount,
            akunDebitKode: '21100',
            akunKreditKode: '11100',
            hutangId: hutangRecord.id,
            jurnalEntriId: jurnal.id,
            sumberInput: SumberInput.MANUAL,
            dibuatOleh: adminUser.id,
          },
        });
        countRepaymentTrx++;
      }
    }

    const sisaHutang = Math.max(0, jumlahPinjaman - totalDibayar);
    await prisma.hutang.update({
      where: { id: hutangRecord.id },
      data: { sisaHutang },
    });

    hutangResults.push({
      namaKreditur,
      pinjaman: jumlahPinjaman,
      dibayar: totalDibayar,
      sisa: sisaHutang,
    });
  }
  console.log(`✓ ${countHutang} Hutang records created with ${countRepaymentTrx} repayment transactions.`);

  // 11. STEP 3 — Generate Clearly Marked DUMMY DATA for gaps (DATA_ORDER & BIAYA_LANGSUNG)
  console.log('\n--- Generating Clearly Marked DUMMY DATA for DATA_ORDER & BIAYA_LANGSUNG...');

  const pelangganList = await prisma.dataPelanggan.findMany();
  const pemasokList = await prisma.dataPemasok.findMany();
  const produkList = await prisma.produk.findMany();

  const dummyRowIds: { kode: string; tipe: string; nominal: number; detail: string }[] = [];

  // 11.a Dummy DATA_ORDER (12 rows)
  const dataOrderJenis = allJenisTransaksi.filter(jt => jt.tipe === TipeTransaksi.DATA_ORDER);
  const dummyOrderConfigs = [
    { customerIdx: 1, productIdx: 0, qty: 10, unitPrice: 45000, day: 6, month: 0, jenisIdx: 0, orderSrc: 'WA' },
    { customerIdx: 2, productIdx: 1, qty: 15, unitPrice: 35000, day: 8, month: 0, jenisIdx: 0, orderSrc: 'WA' },
    { customerIdx: 3, productIdx: 2, qty: 8, unitPrice: 38000, day: 12, month: 0, jenisIdx: 0, orderSrc: 'GRABFOOD' },
    { customerIdx: 10, productIdx: 0, qty: 20, unitPrice: 40000, day: 15, month: 0, jenisIdx: 1, orderSrc: 'MAKLON' },
    { customerIdx: 4, productIdx: 3, qty: 12, unitPrice: 32000, day: 19, month: 0, jenisIdx: 0, orderSrc: 'WA' },
    { customerIdx: 5, productIdx: 4, qty: 6, unitPrice: 55000, day: 24, month: 0, jenisIdx: 0, orderSrc: 'DM_INSTAGRAM' },
    { customerIdx: 6, productIdx: 5, qty: 14, unitPrice: 30000, day: 28, month: 0, jenisIdx: 0, orderSrc: 'WA' },
    { customerIdx: 0, productIdx: 6, qty: 10, unitPrice: 20000, day: 2, month: 1, jenisIdx: 2, orderSrc: 'BOOTH' },
    { customerIdx: 7, productIdx: 7, qty: 15, unitPrice: 40000, day: 7, month: 1, jenisIdx: 0, orderSrc: 'WA' },
    { customerIdx: 8, productIdx: 1, qty: 25, unitPrice: 35000, day: 14, month: 1, jenisIdx: 0, orderSrc: 'WA' },
    { customerIdx: 9, productIdx: 2, qty: 18, unitPrice: 38000, day: 20, month: 1, jenisIdx: 0, orderSrc: 'WA' },
    { customerIdx: 11, productIdx: 0, qty: 5, unitPrice: 45000, day: 26, month: 1, jenisIdx: 3, orderSrc: 'PESANAN' },
  ];

  let dummyOrderCount = 0;
  for (let idx = 0; idx < dummyOrderConfigs.length; idx++) {
    const cfg = dummyOrderConfigs[idx];
    const customer = pelangganList[cfg.customerIdx % pelangganList.length];
    const product = produkList[cfg.productIdx % produkList.length];
    const jenisTrx = dataOrderJenis[cfg.jenisIdx % dataOrderJenis.length];
    const totalAmount = cfg.qty * cfg.unitPrice;
    const tanggal = new Date(Date.UTC(2026, cfg.month, cfg.day));
    const kode = `JO-DUMMY-${String(idx + 1).padStart(2, '0')}`;
    const detail = `[DATA DUMMY] Pesanan ${product.namaBarang} x${cfg.qty} untuk ${customer.nama}`;

    const akunDebit = '11100'; // Kas Utama
    const akunKredit = jenisTrx.akunKreditKode || '41000'; // Pendapatan FROZEN

    const jurnal = await prisma.jurnalEntri.create({
      data: {
        tanggal,
        deskripsi: detail,
        unitBisnis: 'DISTRIBUTOR',
        dibuatOleh: adminUser.id,
        viaAi: false,
        baris: {
          create: [
            { akunKode: akunDebit, debit: totalAmount, kredit: 0 },
            { akunKode: akunKredit, debit: 0, kredit: totalAmount },
          ],
        },
      },
    });

    const trx = await prisma.transaksi.create({
      data: {
        kode,
        tanggal,
        unitBisnis: 'DISTRIBUTOR',
        jenisTransaksiId: jenisTrx.id,
        tipe: TipeTransaksi.DATA_ORDER,
        namaTransaksi: jenisTrx.namaTransaksi,
        detail,
        jenisKas: 'Kas Utama',
        nominal: totalAmount,
        akunDebitKode: akunDebit,
        akunKreditKode: akunKredit,
        pelangganId: customer.id,
        produkId: product.id,
        jumlah: cfg.qty,
        hargaSatuan: cfg.unitPrice,
        jumlahBayar: totalAmount,
        sisaPiutang: 0,
        sumberOrder: cfg.orderSrc,
        jurnalEntriId: jurnal.id,
        sumberInput: SumberInput.MANUAL,
        dibuatOleh: adminUser.id,
      },
    });

    dummyRowIds.push({ kode: trx.kode, tipe: 'DATA_ORDER', nominal: totalAmount, detail });
    dummyOrderCount++;
  }
  console.log(`✓ ${dummyOrderCount} dummy DATA_ORDER rows generated.`);

  // 11.b Dummy BIAYA_LANGSUNG (9 rows)
  const biayaLangsungJenis = allJenisTransaksi.filter(jt => jt.tipe === TipeTransaksi.BIAYA_LANGSUNG);
  const dummyDirectConfigs = [
    { supplierIdx: 0, nominal: 750000, day: 5, month: 0, jenisIdx: 2, note: 'Pembelian casing box & bumbu sosis' },
    { supplierIdx: 1, nominal: 320000, day: 9, month: 0, jenisIdx: 2, note: 'Pembelian kentang & kembang tahu' },
    { supplierIdx: 3, nominal: 1250000, day: 14, month: 0, jenisIdx: 2, note: 'Pembelian bahan ikan tenggiri pempek' },
    { supplierIdx: 4, nominal: 680000, day: 18, month: 0, jenisIdx: 2, note: 'Pembelian daging ayam jagal' },
    { supplierIdx: 9, nominal: 450000, day: 22, month: 0, jenisIdx: 3, note: 'Pembelian plastik vacuum & stiker pack' },
    { supplierIdx: 13, nominal: 120000, day: 27, month: 0, jenisIdx: 4, note: 'Pembelian es batu balok produksi' },
    { supplierIdx: 0, nominal: 890000, day: 4, month: 1, jenisIdx: 2, note: 'Restock bahan baku sosis jumbo' },
    { supplierIdx: 3, nominal: 1100000, day: 11, month: 1, jenisIdx: 2, note: 'Restock bahan ikan dimsum & siomay' },
    { supplierIdx: 4, nominal: 540000, day: 18, month: 1, jenisIdx: 2, note: 'Pembelian daging ayam segar' },
  ];

  let dummyDirectCount = 0;
  for (let idx = 0; idx < dummyDirectConfigs.length; idx++) {
    const cfg = dummyDirectConfigs[idx];
    const supplier = pemasokList[cfg.supplierIdx % pemasokList.length];
    const jenisTrx = biayaLangsungJenis[cfg.jenisIdx % biayaLangsungJenis.length];
    const tanggal = new Date(Date.UTC(2026, cfg.month, cfg.day));
    const kode = `BL-DUMMY-${String(idx + 1).padStart(2, '0')}`;
    const detail = `[DATA DUMMY] ${cfg.note} (${supplier.nama})`;

    const akunDebit = jenisTrx.akunDebitKode || '51100'; // Biaya Bahan
    const akunKredit = '11100'; // Kas Utama

    const jurnal = await prisma.jurnalEntri.create({
      data: {
        tanggal,
        deskripsi: detail,
        unitBisnis: 'PABRIK',
        dibuatOleh: adminUser.id,
        viaAi: false,
        baris: {
          create: [
            { akunKode: akunDebit, debit: cfg.nominal, kredit: 0 },
            { akunKode: akunKredit, debit: 0, kredit: cfg.nominal },
          ],
        },
      },
    });

    const trx = await prisma.transaksi.create({
      data: {
        kode,
        tanggal,
        unitBisnis: 'PABRIK',
        jenisTransaksiId: jenisTrx.id,
        tipe: TipeTransaksi.BIAYA_LANGSUNG,
        namaTransaksi: jenisTrx.namaTransaksi,
        detail,
        jenisKas: 'Kas Utama',
        nominal: cfg.nominal,
        akunDebitKode: akunDebit,
        akunKreditKode: akunKredit,
        pemasokId: supplier.id,
        jurnalEntriId: jurnal.id,
        sumberInput: SumberInput.MANUAL,
        dibuatOleh: adminUser.id,
      },
    });

    dummyRowIds.push({ kode: trx.kode, tipe: 'BIAYA_LANGSUNG', nominal: cfg.nominal, detail });
    dummyDirectCount++;
  }
  console.log(`✓ ${dummyDirectCount} dummy BIAYA_LANGSUNG rows generated.`);

  // 12. Print Final Summary
  console.log('\n====================================================');
  console.log('IMPORT & DUMMY DATA GENERATION COMPLETED SUCCESSFULLY');
  console.log('====================================================');

  console.log('\n📊 ROW COUNTS IMPORTED PER TABLE:');
  console.log('----------------------------------------------------');
  console.log(`- Pengguna (Users)       : 1 (Admin default)`);
  console.log(`- JenisAkun (COA)        : ${masterAccounts.length} (Master)`);
  console.log(`- JenisTransaksi         : ${countJenisTransaksi} (Master)`);
  console.log(`- DataPemasok (Suppliers): ${countPemasok} (Real Excel)`);
  console.log(`- DataPelanggan (Cust.)  : ${countPelanggan} (Real Excel)`);
  console.log(`- Produk (Master Items)  : ${masterProdukList.length} (Master)`);
  console.log(`- Hutang (Creditors)     : ${countHutang} (Real Excel)`);
  console.log(`- Transaksi (Total)      : ${countRealIndirect + countRealCashIn + countRepaymentTrx + dummyOrderCount + dummyDirectCount}`);
  console.log(`    • Real BIAYA_TAK_LANGSUNG : ${countRealIndirect}`);
  console.log(`    • Real CASH_IN            : ${countRealCashIn}`);
  console.log(`    • Real Cicilan HUTANG     : ${countRepaymentTrx}`);
  console.log(`    • Dummy DATA_ORDER        : ${dummyOrderCount}`);
  console.log(`    • Dummy BIAYA_LANGSUNG    : ${dummyDirectCount}`);
  console.log(`- JurnalEntri            : ${countRealIndirect + countRealCashIn + countRepaymentTrx + dummyOrderCount + dummyDirectCount}`);

  console.log('\n💳 REKAPITULASI SISA HUTANG (DEBT BALANCES):');
  console.log('----------------------------------------------------');
  for (const h of hutangResults) {
    console.log(`• ${h.namaKreditur.padEnd(20)}: Pinjaman Rp ${h.pinjaman.toLocaleString('id-ID')}, Dibayar Rp ${h.dibayar.toLocaleString('id-ID')}, Sisa Rp ${h.sisa.toLocaleString('id-ID')}`);
  }

  console.log('\n🏷️  LIST OF DUMMY ROWS CREATED:');
  console.log('----------------------------------------------------');
  for (const d of dummyRowIds) {
    console.log(`[${d.kode}] (${d.tipe}) Rp ${d.nominal.toLocaleString('id-ID')} -> ${d.detail}`);
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS ENCOUNTERED:');
    warnings.forEach(w => console.log(`  - ${w}`));
  } else {
    console.log('\n✓ No mapping errors or unresolved account codes.');
  }
}

main()
  .catch((e) => {
    console.error('Fatal error during import:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
