import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {

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

  console.log('Seeding CMS content...');
  await prisma.cmsContent.upsert({
    where: { key: 'headline_beranda' },
    update: {},
    create: {
      key: 'headline_beranda',
      judul: 'Selamat Datang di Buku Dapur',
      subJudul: 'Frozen Food & Siap Saji Terbaik',
      konten: 'Kami menyediakan berbagai makanan frozen food dan siap saji berkualitas tinggi untuk kebutuhan bisnis dan rumah tangga Anda.',
      aktif: true,
      dibuatOleh: adminUser.id,
    },
  });

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
