import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding CMS data...');

  // Get admin user (assuming admin exists)
  const admin = await prisma.pengguna.findFirst({
    where: { email: 'admin@bukudapur.com' }
  });

  if (!admin) {
    console.error('Admin user not found. Please create admin user first.');
    process.exit(1);
  }

  // Create headline beranda
  const headline = await prisma.cmsContent.upsert({
    where: { key: 'headline_beranda' },
    update: {},
    create: {
      key: 'headline_beranda',
      judul: 'Selamat Datang di Buku Dapur',
      subJudul: 'Frozen Food & Siap Saji Terbaik',
      konten: 'Nikmati berbagai menu makanan lezat dengan kualitas terbaik. Dari frozen food hingga siap saji, semua tersedia untuk Anda.',
      aktif: true,
      dibuatOleh: admin.id,
    },
  });

  console.log('Headline beranda created:', headline);

  // Create tentang kami content
  const tentang = await prisma.cmsContent.upsert({
    where: { key: 'tentang_kami' },
    update: {},
    create: {
      key: 'tentang_kami',
      judul: 'Tentang Kami',
      subJudul: 'Kualitas dan Kepercayaan',
      konten: 'Buku Dapur hadir untuk memenuhi kebutuhan makanan Anda dengan kualitas terbaik. Kami menyediakan berbagai pilihan frozen food dan makanan siap saji yang lezat dan praktis.',
      aktif: true,
      dibuatOleh: admin.id,
    },
  });

  console.log('Tentang kami created:', tentang);

  // Create kontak content
  const kontak = await prisma.cmsContent.upsert({
    where: { key: 'kontak' },
    update: {},
    create: {
      key: 'kontak',
      judul: '+62 812 3456 7890',
      subJudul: 'info@bukudapur.com',
      konten: 'Jl. Contoh No. 123\nKota, Provinsi 12345',
      aktif: true,
      dibuatOleh: admin.id,
    },
  });

  console.log('Kontak created:', kontak);

  // Create produk_unggulan content
  const produkUnggulan = await prisma.cmsContent.upsert({
    where: { key: 'produk_unggulan' },
    update: {},
    create: {
      key: 'produk_unggulan',
      judul: 'Produk Unggulan',
      subJudul: 'Maksimal 5 produk',
      konten: '[]',
      aktif: true,
      dibuatOleh: admin.id,
    },
  });

  console.log('Produk unggulan created:', produkUnggulan);

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
