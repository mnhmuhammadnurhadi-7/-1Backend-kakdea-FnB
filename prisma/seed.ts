import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Seed Chart of Accounts
  console.log('Seeding Chart of Accounts...');
  const chartOfAccounts = [
    { kodeAkun: '10000', namaAkun: 'ASET', tipeAkun: 'ASET', parentKode: null, normalBalance: 'DEBIT' },
    { kodeAkun: '11000', namaAkun: 'KAS & SETARA KAS', tipeAkun: 'ASET', parentKode: '10000', normalBalance: 'DEBIT' },
    { kodeAkun: '11100', namaAkun: 'Kas Utama', tipeAkun: 'ASET', parentKode: '11000', normalBalance: 'DEBIT' },
    { kodeAkun: '11200', namaAkun: 'PIUTANG', tipeAkun: 'ASET', parentKode: '10000', normalBalance: 'DEBIT' },
    { kodeAkun: '11210', namaAkun: 'Piutang Usaha', tipeAkun: 'ASET', parentKode: '11200', normalBalance: 'DEBIT' },
    { kodeAkun: '12000', namaAkun: 'ASET TETAP', tipeAkun: 'ASET', parentKode: '10000', normalBalance: 'DEBIT' },
    { kodeAkun: '12100', namaAkun: 'Tanah', tipeAkun: 'ASET', parentKode: '12000', normalBalance: 'DEBIT' },
    { kodeAkun: '12200', namaAkun: 'Bangunan', tipeAkun: 'ASET', parentKode: '12000', normalBalance: 'DEBIT' },
    { kodeAkun: '12210', namaAkun: 'Akumulasi Penyusutan Bangunan', tipeAkun: 'ASET', parentKode: '12200', normalBalance: 'KREDIT' },
    { kodeAkun: '12300', namaAkun: 'Kendaraan', tipeAkun: 'ASET', parentKode: '12000', normalBalance: 'DEBIT' },
    { kodeAkun: '12310', namaAkun: 'Akumulasi Penyusutan Kendaraan', tipeAkun: 'ASET', parentKode: '12300', normalBalance: 'KREDIT' },
    { kodeAkun: '12400', namaAkun: 'Peralatan dan Furnitur', tipeAkun: 'ASET', parentKode: '12000', normalBalance: 'DEBIT' },
    { kodeAkun: '12410', namaAkun: 'Akumulasi Penyusutan Peralatan', tipeAkun: 'ASET', parentKode: '12400', normalBalance: 'KREDIT' },
    { kodeAkun: '20000', namaAkun: 'HUTANG', tipeAkun: 'HUTANG', parentKode: null, normalBalance: 'KREDIT' },
    { kodeAkun: '21000', namaAkun: 'HUTANG LANCAR', tipeAkun: 'HUTANG', parentKode: '20000', normalBalance: 'KREDIT' },
    { kodeAkun: '21100', namaAkun: 'Hutang Usaha', tipeAkun: 'HUTANG', parentKode: '21000', normalBalance: 'KREDIT' },
    { kodeAkun: '30000', namaAkun: 'MODAL', tipeAkun: 'MODAL', parentKode: null, normalBalance: 'KREDIT' },
    { kodeAkun: '31000', namaAkun: 'Modal Awal', tipeAkun: 'MODAL', parentKode: '30000', normalBalance: 'KREDIT' },
    { kodeAkun: '31100', namaAkun: 'Prive Pemilik', tipeAkun: 'MODAL', parentKode: '30000', normalBalance: 'DEBIT' },
    { kodeAkun: '32300', namaAkun: 'Akumulasi Laba', tipeAkun: 'MODAL', parentKode: '30000', normalBalance: 'KREDIT' },
    { kodeAkun: '40000', namaAkun: 'PENDAPATAN USAHA', tipeAkun: 'PENDAPATAN', parentKode: null, normalBalance: 'KREDIT' },
    { kodeAkun: '41000', namaAkun: 'Pendapatan FROZEN', tipeAkun: 'PENDAPATAN', parentKode: '40000', normalBalance: 'KREDIT' },
    { kodeAkun: '42000', namaAkun: 'Pendapatan MAKLON', tipeAkun: 'PENDAPATAN', parentKode: '40000', normalBalance: 'KREDIT' },
    { kodeAkun: '43000', namaAkun: 'Pendapatan BOOTH', tipeAkun: 'PENDAPATAN', parentKode: '40000', normalBalance: 'KREDIT' },
    { kodeAkun: '44000', namaAkun: 'Pendapatan PESANAN', tipeAkun: 'PENDAPATAN', parentKode: '40000', normalBalance: 'KREDIT' },
    { kodeAkun: '49000', namaAkun: 'Pendapatan Lain', tipeAkun: 'PENDAPATAN', parentKode: '40000', normalBalance: 'KREDIT' },
    { kodeAkun: '51000', namaAkun: 'BIAYA LANGSUNG', tipeAkun: 'BIAYA_LANGSUNG', parentKode: null, normalBalance: 'DEBIT' },
    { kodeAkun: '51100', namaAkun: 'Biaya Bahan', tipeAkun: 'BIAYA_LANGSUNG', parentKode: '51000', normalBalance: 'DEBIT' },
    { kodeAkun: '51200', namaAkun: 'Biaya Kemasan', tipeAkun: 'BIAYA_LANGSUNG', parentKode: '51000', normalBalance: 'DEBIT' },
    { kodeAkun: '51400', namaAkun: 'Biaya Konsumsi', tipeAkun: 'BIAYA_LANGSUNG', parentKode: '51000', normalBalance: 'DEBIT' },
    { kodeAkun: '51500', namaAkun: 'Biaya Perlengkapan', tipeAkun: 'BIAYA_LANGSUNG', parentKode: '51000', normalBalance: 'DEBIT' },
    { kodeAkun: '51800', namaAkun: 'Biaya Kirim / Transport', tipeAkun: 'BIAYA_LANGSUNG', parentKode: '51000', normalBalance: 'DEBIT' },
    { kodeAkun: '51900', namaAkun: 'Biaya Langsung Lain', tipeAkun: 'BIAYA_LANGSUNG', parentKode: '51000', normalBalance: 'DEBIT' },
    { kodeAkun: '52000', namaAkun: 'BIAYA TIDAK LANGSUNG', tipeAkun: 'BIAYA_TIDAK_LANGSUNG', parentKode: null, normalBalance: 'DEBIT' },
    { kodeAkun: '52100', namaAkun: 'Biaya Gaji Karyawan', tipeAkun: 'BIAYA_TIDAK_LANGSUNG', parentKode: '52000', normalBalance: 'DEBIT' },
    { kodeAkun: '52200', namaAkun: 'Biaya Listrik', tipeAkun: 'BIAYA_TIDAK_LANGSUNG', parentKode: '52000', normalBalance: 'DEBIT' },
    { kodeAkun: '52210', namaAkun: 'Biaya Internet Telepon', tipeAkun: 'BIAYA_TIDAK_LANGSUNG', parentKode: '52000', normalBalance: 'DEBIT' },
    { kodeAkun: '52400', namaAkun: 'Biaya Perlengkapan & ATK', tipeAkun: 'BIAYA_TIDAK_LANGSUNG', parentKode: '52000', normalBalance: 'DEBIT' },
    { kodeAkun: '52600', namaAkun: 'Biaya Sewa', tipeAkun: 'BIAYA_TIDAK_LANGSUNG', parentKode: '52000', normalBalance: 'DEBIT' },
    { kodeAkun: '52700', namaAkun: 'Biaya Perbaikan', tipeAkun: 'BIAYA_TIDAK_LANGSUNG', parentKode: '52000', normalBalance: 'DEBIT' },
    { kodeAkun: '52800', namaAkun: 'Biaya Transportasi Umum', tipeAkun: 'BIAYA_TIDAK_LANGSUNG', parentKode: '52000', normalBalance: 'DEBIT' },
    { kodeAkun: '52900', namaAkun: 'Biaya Pelatihan dan Buku', tipeAkun: 'BIAYA_TIDAK_LANGSUNG', parentKode: '52000', normalBalance: 'DEBIT' },
    { kodeAkun: '52910', namaAkun: 'Biaya Penyusutan Bangunan', tipeAkun: 'BIAYA_TIDAK_LANGSUNG', parentKode: '52000', normalBalance: 'DEBIT' },
    { kodeAkun: '52920', namaAkun: 'Biaya Penyusutan Kendaraan', tipeAkun: 'BIAYA_TIDAK_LANGSUNG', parentKode: '52000', normalBalance: 'DEBIT' },
    { kodeAkun: '52930', namaAkun: 'Biaya Penyusutan Peralatan', tipeAkun: 'BIAYA_TIDAK_LANGSUNG', parentKode: '52000', normalBalance: 'DEBIT' },
    { kodeAkun: '52940', namaAkun: 'Biaya Tidak Langsung Lain', tipeAkun: 'BIAYA_TIDAK_LANGSUNG', parentKode: '52000', normalBalance: 'DEBIT' },
    { kodeAkun: '61000', namaAkun: 'PENDAPATAN NON OPERASI', tipeAkun: 'NON_OPERASIONAL', parentKode: '40000', normalBalance: 'KREDIT' },
    { kodeAkun: '61900', namaAkun: 'Pendapatan Non Operasi Lain', tipeAkun: 'NON_OPERASIONAL', parentKode: '61000', normalBalance: 'KREDIT' },
    { kodeAkun: '62000', namaAkun: 'BIAYA NON OPERASI', tipeAkun: 'NON_OPERASIONAL', parentKode: '52000', normalBalance: 'DEBIT' },
    { kodeAkun: '62100', namaAkun: 'Biaya Administrasi Bank', tipeAkun: 'NON_OPERASIONAL', parentKode: '62000', normalBalance: 'DEBIT' },
  ];

  for (const account of chartOfAccounts) {
    await prisma.chartOfAccount.upsert({
      where: { kodeAkun: account.kodeAkun },
      update: {},
      create: account,
    });
  }

  // Seed Transaction Types
  console.log('Seeding Transaction Types...');
  const transactionTypes = [
    { kategori: 'DATA_ORDER', namaTransaksi: 'Pendapatan FROZEN', akunDebitKode: null, akunKreditKode: '41000' },
    { kategori: 'DATA_ORDER', namaTransaksi: 'Pendapatan MAKLON', akunDebitKode: null, akunKreditKode: '42000' },
    { kategori: 'DATA_ORDER', namaTransaksi: 'Pendapatan BOOTH', akunDebitKode: null, akunKreditKode: '43000' },
    { kategori: 'DATA_ORDER', namaTransaksi: 'Pendapatan PESANAN', akunDebitKode: null, akunKreditKode: '44000' },
    { kategori: 'DATA_ORDER', namaTransaksi: 'Pendapatan Lain', akunDebitKode: null, akunKreditKode: '49000' },
    { kategori: 'CASH_IN', namaTransaksi: 'Hutang Jangka Pendek', akunDebitKode: null, akunKreditKode: '21100' },
    { kategori: 'CASH_IN', namaTransaksi: 'Pendapatan Non Operasi Lain', akunDebitKode: null, akunKreditKode: '61900' },
    { kategori: 'BIAYA_LANGSUNG', namaTransaksi: 'Hutang Bahan', akunDebitKode: '51100', akunKreditKode: '21100' },
    { kategori: 'BIAYA_LANGSUNG', namaTransaksi: 'Bayar Hutang Bahan', akunDebitKode: '21100', akunKreditKode: '21100' },
    { kategori: 'BIAYA_LANGSUNG', namaTransaksi: 'Pembelian Bahan Tunai', akunDebitKode: '51100', akunKreditKode: '21100' },
    { kategori: 'BIAYA_LANGSUNG', namaTransaksi: 'Biaya Kemasan', akunDebitKode: '51200', akunKreditKode: '21100' },
    { kategori: 'BIAYA_LANGSUNG', namaTransaksi: 'Biaya Konsumsi', akunDebitKode: '51400', akunKreditKode: '21100' },
    { kategori: 'BIAYA_LANGSUNG', namaTransaksi: 'Biaya Perlengkapan', akunDebitKode: '51500', akunKreditKode: '21100' },
    { kategori: 'BIAYA_LANGSUNG', namaTransaksi: 'Biaya Kirim / Transport', akunDebitKode: '51800', akunKreditKode: '21100' },
    { kategori: 'BIAYA_LANGSUNG', namaTransaksi: 'Biaya Langsung Lain', akunDebitKode: '51900', akunKreditKode: '21100' },
    { kategori: 'BIAYA_TAK_LANGSUNG', namaTransaksi: 'Biaya Gaji', akunDebitKode: '52100', akunKreditKode: null },
    { kategori: 'BIAYA_TAK_LANGSUNG', namaTransaksi: 'Biaya Listrik', akunDebitKode: '52200', akunKreditKode: null },
    { kategori: 'BIAYA_TAK_LANGSUNG', namaTransaksi: 'Biaya Internet / telepon', akunDebitKode: '52210', akunKreditKode: null },
    { kategori: 'BIAYA_TAK_LANGSUNG', namaTransaksi: 'Biaya Perlengkapan & ATK', akunDebitKode: '52400', akunKreditKode: null },
    { kategori: 'BIAYA_TAK_LANGSUNG', namaTransaksi: 'Pembelian Peralatan', akunDebitKode: '12400', akunKreditKode: null },
    { kategori: 'BIAYA_TAK_LANGSUNG', namaTransaksi: 'Biaya Konsumsi', akunDebitKode: '51400', akunKreditKode: null },
    { kategori: 'BIAYA_TAK_LANGSUNG', namaTransaksi: 'Biaya Sewa', akunDebitKode: '52600', akunKreditKode: null },
    { kategori: 'BIAYA_TAK_LANGSUNG', namaTransaksi: 'Perbaikan / servis peralatan', akunDebitKode: '52700', akunKreditKode: null },
    { kategori: 'BIAYA_TAK_LANGSUNG', namaTransaksi: 'Biaya Transportasi Umum', akunDebitKode: '52800', akunKreditKode: null },
    { kategori: 'BIAYA_TAK_LANGSUNG', namaTransaksi: 'Biaya Pelatihan & Buku', akunDebitKode: '52900', akunKreditKode: null },
    { kategori: 'BIAYA_TAK_LANGSUNG', namaTransaksi: 'Biaya Parkir', akunDebitKode: '52940', akunKreditKode: null },
    { kategori: 'BIAYA_TAK_LANGSUNG', namaTransaksi: 'Biaya Admin Bank', akunDebitKode: '62100', akunKreditKode: null },
    { kategori: 'BIAYA_TAK_LANGSUNG', namaTransaksi: 'Bayar Hutang', akunDebitKode: '21100', akunKreditKode: null },
    { kategori: 'BIAYA_TAK_LANGSUNG', namaTransaksi: 'Penarikan Prive', akunDebitKode: '31100', akunKreditKode: null },
    { kategori: 'MUTASI', namaTransaksi: 'Mutasi dari KAS ke BANK', akunDebitKode: null, akunKreditKode: null },
    { kategori: 'MUTASI', namaTransaksi: 'Mutasi dari BANK ke KAS', akunDebitKode: null, akunKreditKode: null },
    { kategori: 'PENYUSUTAN', namaTransaksi: 'Biaya Penyusutan Bangunan', akunDebitKode: '52910', akunKreditKode: '12210' },
    { kategori: 'PENYUSUTAN', namaTransaksi: 'Biaya Penyusutan Kendaraan', akunDebitKode: '52920', akunKreditKode: '12310' },
    { kategori: 'PENYUSUTAN', namaTransaksi: 'Biaya Penyusutan Peralatan', akunDebitKode: '52930', akunKreditKode: '12410' },
  ];

  for (const transType of transactionTypes) {
    await prisma.transactionType.upsert({
      where: { id: 0 }, // This will create new entries since id is auto-increment
      update: {},
      create: transType,
    });
  }

  // Create a default user for testing
  console.log('Creating default user...');
  const bcrypt = require('bcrypt');
  const passwordHash = await bcrypt.hash('password123', 10);
  
  await prisma.user.upsert({
    where: { email: 'admin@bukudapur.com' },
    update: {},
    create: {
      nama: 'Admin',
      email: 'admin@bukudapur.com',
      passwordHash,
    },
  });

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });