import { Router, Response } from 'express';
import { successResponse, errorResponse } from '../utils/response';
import prisma from '../utils/database';

const router = Router();

// ================= PUBLIC CMS CONTENT =================
// Tanpa authentication - untuk customer page

// GET /public/cms/content
router.get('/content', async (req: any, res: Response, next) => {
  try {
    const { key } = req.query;
    const where: any = { aktif: true };
    if (key) where.key = key as string;

    const content = await prisma.cmsContent.findMany({
      where,
      orderBy: { key: 'asc' },
    });
    res.json(successResponse(content));
  } catch (error) {
    next(error);
  }
});

// GET /public/cms/content/:key
router.get('/content/:key', async (req: any, res: Response, next) => {
  try {
    const { key } = req.params;
    const content = await prisma.cmsContent.findUnique({
      where: { key },
    });
    if (!content) {
      // Return default content instead of 404
      if (key === 'tentang_kami') {
        res.json(successResponse({
          key: 'tentang_kami',
          judul: 'Tentang Kami',
          subJudul: 'Kualitas dan Kepercayaan',
          konten: 'Buku Dapur hadir untuk memenuhi kebutuhan makanan Anda dengan kualitas terbaik. Kami menyediakan berbagai pilihan frozen food dan makanan siap saji yang lezat dan praktis.',
          aktif: true,
        }));
        return;
      }
      if (key === 'kontak') {
        res.json(successResponse({
          key: 'kontak',
          judul: '+62 812 3456 7890',
          subJudul: 'info@bukudapur.com',
          konten: 'Jl. Contoh No. 123\nKota, Provinsi 12345',
          aktif: true,
        }));
        return;
      }
      if (key === 'produk_unggulan') {
        res.json(successResponse({
          key: 'produk_unggulan',
          judul: 'Produk Unggulan',
          subJudul: 'Maksimal 5 produk',
          konten: '[]',
          aktif: true,
        }));
        return;
      }
      res.json(successResponse({
        key,
        judul: 'Selamat Datang di Buku Dapur',
        subJudul: 'Frozen Food & Siap Saji Terbaik',
        konten: '',
        aktif: true,
      }));
      return;
    }
    res.json(successResponse(content));
  } catch (error) {
    next(error);
  }
});

// ================= PUBLIC CMS MENU =================
// Tanpa authentication - untuk customer page

// GET /public/cms/menu
router.get('/menu', async (req: any, res: Response, next) => {
  try {
    const menu = await prisma.cmsMenu.findMany({
      where: { aktif: true },
      orderBy: { urutan: 'asc' },
    });
    res.json(successResponse(menu));
  } catch (error) {
    next(error);
  }
});

export default router;
