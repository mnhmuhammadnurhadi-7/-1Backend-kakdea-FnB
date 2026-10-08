import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning up database transactions, custom types, free tables, and audit logs...');

  // Delete dependent tables first due to FK constraints
  await prisma.transaksi.deleteMany({});
  await prisma.kolomCustom.deleteMany({});
  await prisma.jenisTransaksi.deleteMany({});
  
  await prisma.barisTabelBebas.deleteMany({});
  await prisma.kolomTabelBebas.deleteMany({});
  await prisma.tabelBebas.deleteMany({});
  
  await prisma.logAudit.deleteMany({});
  await prisma.produk.deleteMany({});

  console.log('✅ Database successfully cleaned!');
  console.log('Preserved tables: pengguna (for login).');
}

main()
  .catch((e) => {
    console.error('❌ Clean failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
