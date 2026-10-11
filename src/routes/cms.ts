import { Router, Response, Request } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import prisma from '../utils/database';
import { logManualAction } from '../services/auditLogService';
import { AksiLog } from '@prisma/client';
import multer, { StorageEngine, FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import express from 'express';

// Setup multer untuk upload gambar
const storage: StorageEngine = multer.diskStorage({
  destination: (req: Request, file: any, cb: (error: Error | null, destination: string) => void) => {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req: Request, file: any, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req: Request, file: any, cb: FileFilterCallback) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

const router = Router();

router.use(authenticate);


// Upload endpoint untuk gambar
router.post('/upload', upload.single('file'), async (req: any, res: Response, next) => {
  try {
    if (!req.file) {
      throw errorResponse('No file uploaded', 400);
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json(successResponse({ url: fileUrl, filename: req.file.filename }));
  } catch (error) {
    next(error);
  }
});

// ================= CMS CONTENT =================
// Untuk headline beranda, konten tentang kami, dll

// GET /cms/content
router.get('/content', async (req: AuthRequest, res: Response, next) => {
  try {
    const { key, aktif } = req.query;
    const where: any = {};
    if (key) where.key = Array.isArray(key) ? key[0] : key;
    if (aktif !== undefined) where.aktif = aktif === 'true';

    const content = await prisma.cmsContent.findMany({
      where,
      orderBy: { key: 'asc' },
    });
    res.json(successResponse(content));
  } catch (error) {
    next(error);
  }
});

// GET /cms/content/:key
router.get('/content/:key', async (req: AuthRequest, res: Response, next) => {
  try {
    const { key } = req.params;
    const content = await prisma.cmsContent.findUnique({
      where: { key: Array.isArray(key) ? key[0] : key },
    });
    if (!content) throw errorResponse('Konten tidak ditemukan', 404);
    res.json(successResponse(content));
  } catch (error) {
    next(error);
  }
});

// POST /cms/content
router.post('/content', async (req: AuthRequest, res: Response, next) => {
  try {
    const { key, judul, sub_judul, subJudul, konten, aktif } = req.body;

    if (!key || !judul) {
      throw errorResponse('key dan judul wajib diisi');
    }

    // @ts-ignore - Prisma client needs to be regenerated after schema update
    const existing = await prisma.cmsContent.findUnique({ where: { key } });
    if (existing) throw errorResponse(`Key "${key}" sudah dipakai`, 409);

    // @ts-ignore - Prisma client needs to be regenerated after schema update
    const content = await prisma.cmsContent.create({
      data: {
        key,
        judul,
        subJudul: subJudul || sub_judul,
        konten,
        aktif: aktif !== undefined ? aktif : true,
        dibuatOleh: req.user!.id,
      },
    });

    await logManualAction(
      req.user!.id,
      'cms_content',
      AksiLog.TAMBAH,
      content.judul,
      `CMS content baru: ${content.key}`,
      content.id,
      undefined,
      content
    );

    res.json(successResponse(content));
  } catch (error) {
    next(error);
  }
});

// PUT /cms/content/:key
router.put('/content/:key', async (req: AuthRequest, res: Response, next) => {
  try {
    const { key } = req.params;
    const keyStr = Array.isArray(key) ? key[0] : key;
    const before = await prisma.cmsContent.findUnique({ where: { key: keyStr } });

    const { judul, sub_judul, subJudul, konten, aktif } = req.body;
    let updated;

    if (!before) {
      updated = await prisma.cmsContent.create({
        data: {
          key: keyStr,
          judul: judul || keyStr,
          subJudul: subJudul ?? sub_judul ?? null,
          konten: konten ?? null,
          aktif: aktif !== undefined ? aktif : true,
          dibuatOleh: req.user!.id,
        },
      });

      await logManualAction(
        req.user!.id,
        'cms_content',
        AksiLog.TAMBAH,
        updated.judul,
        `CMS content dibuat: ${updated.key}`,
        updated.id,
        undefined,
        updated
      );
    } else {
      const data: any = {};
      if (judul !== undefined) data.judul = judul;
      if ((subJudul ?? sub_judul) !== undefined) data.subJudul = subJudul ?? sub_judul;
      if (konten !== undefined) data.konten = konten;
      if (aktif !== undefined) data.aktif = aktif;

      updated = await prisma.cmsContent.update({
        where: { key: keyStr },
        data
      });

      await logManualAction(
        req.user!.id,
        'cms_content',
        AksiLog.UBAH,
        updated.judul,
        `CMS content diubah: ${updated.key}`,
        updated.id,
        before,
        updated
      );
    }

    res.json(successResponse(updated));
  } catch (error) {
    next(error);
  }
});

// DELETE /cms/content/:key
router.delete('/content/:key', async (req: AuthRequest, res: Response, next) => {
  try {
    const { key } = req.params;
    // @ts-ignore - Prisma client needs to be regenerated after schema update
    const content = await prisma.cmsContent.findUnique({ where: { key } });
    if (!content) throw errorResponse('Konten tidak ditemukan', 404);

    // @ts-ignore - Prisma client needs to be regenerated after schema update
    await prisma.cmsContent.delete({ where: { key } });

    await logManualAction(
      req.user!.id,
      'cms_content',
      AksiLog.HAPUS,
      content.judul,
      `CMS content dihapus: ${content.key}`,
      content.id,
      content,
      undefined
    );

    res.json(successResponse({ message: 'Konten dihapus' }));
  } catch (error) {
    next(error);
  }
});

// ================= CMS MENU =================
// Untuk navigasi customer page

// GET /cms/menu
router.get('/menu', async (req: AuthRequest, res: Response, next) => {
  try {
    const { aktif } = req.query;
    const where: any = {};
    if (aktif !== undefined) where.aktif = aktif === 'true';

    // @ts-ignore - Prisma client needs to be regenerated after schema update
    const menu = await prisma.cmsMenu.findMany({
      where,
      orderBy: { urutan: 'asc' },
    });
    res.json(successResponse(menu));
  } catch (error) {
    next(error);
  }
});

// GET /cms/menu/:id
router.get('/menu/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const id = parseInt(String(req.params.id));
    // @ts-ignore - Prisma client needs to be regenerated after schema update
    const menu = await prisma.cmsMenu.findUnique({
      where: { id },
    });
    if (!menu) throw errorResponse('Menu tidak ditemukan', 404);
    res.json(successResponse(menu));
  } catch (error) {
    next(error);
  }
});

// POST /cms/menu
router.post('/menu', async (req: AuthRequest, res: Response, next) => {
  try {
    const { label, path, urutan, aktif } = req.body;

    if (!label || !path) {
      throw errorResponse('label dan path wajib diisi');
    }

    // @ts-ignore - Prisma client needs to be regenerated after schema update
    const menu = await prisma.cmsMenu.create({
      data: {
        label,
        path,
        urutan: urutan ?? 0,
        aktif: aktif !== undefined ? aktif : true,
        dibuatOleh: req.user!.id,
      },
    });

    await logManualAction(
      req.user!.id,
      'cms_menu',
      AksiLog.TAMBAH,
      menu.label,
      `CMS menu baru: ${menu.label}`,
      menu.id,
      undefined,
      menu
    );

    res.json(successResponse(menu));
  } catch (error) {
    next(error);
  }
});

// PUT /cms/menu/:id
router.put('/menu/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const id = parseInt(String(req.params.id));
    // @ts-ignore - Prisma client needs to be regenerated after schema update
    const before = await prisma.cmsMenu.findUnique({ where: { id } });
    if (!before) throw errorResponse('Menu tidak ditemukan', 404);

    const { label, path, urutan, aktif } = req.body;
    const data: any = {};
    if (label !== undefined) data.label = label;
    if (path !== undefined) data.path = path;
    if (urutan !== undefined) data.urutan = urutan;
    if (aktif !== undefined) data.aktif = aktif;

    // @ts-ignore - Prisma client needs to be regenerated after schema update
    const updated = await prisma.cmsMenu.update({ where: { id }, data });

    await logManualAction(
      req.user!.id,
      'cms_menu',
      AksiLog.UBAH,
      updated.label,
      `CMS menu diubah: ${updated.label}`,
      updated.id,
      before,
      updated
    );

    res.json(successResponse(updated));
  } catch (error) {
    next(error);
  }
});

// DELETE /cms/menu/:id
router.delete('/menu/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const id = parseInt(String(req.params.id));
    // @ts-ignore - Prisma client needs to be regenerated after schema update
    const menu = await prisma.cmsMenu.findUnique({ where: { id } });
    if (!menu) throw errorResponse('Menu tidak ditemukan', 404);

    // @ts-ignore - Prisma client needs to be regenerated after schema update
    await prisma.cmsMenu.delete({ where: { id } });

    await logManualAction(
      req.user!.id,
      'cms_menu',
      AksiLog.HAPUS,
      menu.label,
      `CMS menu dihapus: ${menu.label}`,
      menu.id,
      menu,
      undefined
    );

    res.json(successResponse({ message: 'Menu dihapus' }));
  } catch (error) {
    next(error);
  }
});

export default router;
