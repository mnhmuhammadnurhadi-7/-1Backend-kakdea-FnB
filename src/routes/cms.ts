import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import prisma from '../utils/database';
import { logManualAction } from '../services/auditLogService';
import { AksiLog } from '@prisma/client';

const router = Router();

router.use(authenticate);


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

export default router;
