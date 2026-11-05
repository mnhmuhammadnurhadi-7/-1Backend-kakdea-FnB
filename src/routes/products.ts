import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import prisma from '../utils/database';
import { logManualAction } from '../services/auditLogService';
import { AksiLog } from '@prisma/client';

const router = Router();

const imageDataFrom = (value: unknown): { data: Buffer; mime: string } | null => {
  if (typeof value !== 'string' || !value.startsWith('data:image/')) return null;
  const match = value.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/]+=*)$/);
  if (!match) throw errorResponse('Format gambar tidak valid', 400);
  const data = Buffer.from(match[2], 'base64');
  if (!data.length || data.length > 5 * 1024 * 1024) throw errorResponse('Ukuran gambar maksimal 5 MB', 400);
  return { data, mime: match[1] };
};

const withoutImageData = <T extends { gambarData?: Uint8Array | null; gambarMime?: string | null }>(product: T) => {
  const { gambarData: _data, gambarMime: _mime, ...safeProduct } = product;
  return safeProduct;
};

// All routes require authentication
router.use(authenticate);

// GET /products
router.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const { search, is_active, aktif } = req.query;
    
    const where: any = {};
    if (search) {
      where.OR = [
        { namaBarang: { contains: search as string } },
        { varian: { contains: search as string } },
        { kode: { contains: search as string } },
      ];
    }
    if (aktif !== undefined) {
      where.aktif = aktif === 'true';
    } else if (is_active !== undefined) {
      where.aktif = is_active === 'true';
    }

    const products = await prisma.produk.findMany({
      where,
      orderBy: { dibuatPada: 'desc' },
      select: { id: true, kode: true, namaBarang: true, varian: true, satuan: true, hargaDefault: true, gambar: true, deskripsi: true, aktif: true, dibuatPada: true }
    });

    res.json(successResponse(products));
  } catch (error) {
    next(error);
  }
});

// GET /products/:id
router.get('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const product = await prisma.produk.findUnique({
      where: { id: parseInt(String(req.params.id)) },
      select: { id: true, kode: true, namaBarang: true, varian: true, satuan: true, hargaDefault: true, gambar: true, deskripsi: true, aktif: true, dibuatPada: true }
    });

    if (!product) {
      throw errorResponse('Product not found', 404);
    }

    res.json(successResponse(product));
  } catch (error) {
    next(error);
  }
});

// Mengirim gambar langsung dari kolom BLOB.
router.get('/:id/image', async (req: Request, res: Response, next) => {
  try {
    const product = await prisma.produk.findUnique({
      where: { id: parseInt(String(req.params.id)) },
      select: { gambarData: true, gambarMime: true, gambar: true },
    });
    if (!product?.gambarData || !product.gambarMime) throw errorResponse('Gambar tidak ditemukan', 404);
    res.type(product.gambarMime).set('Cache-Control', 'public, max-age=3600').send(Buffer.from(product.gambarData));
  } catch (error) {
    next(error);
  }
});

// POST /products
router.post('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const {
      kode,
      kode_produk,
      nama_barang,
      namaBarang,
      varian,
      satuan,
      harga_default,
      hargaDefault,
      gambar,
      deskripsi,
    } = req.body;

    const finalKode = kode || kode_produk || `PRD${Date.now()}`;
    const finalNama = namaBarang || nama_barang;
    const image = imageDataFrom(gambar);

    if (!finalNama) {
      throw errorResponse('namaBarang (nama_barang) is required');
    }

    const product = await prisma.produk.create({
      data: {
        kode: finalKode,
        namaBarang: finalNama,
        varian,
        satuan: satuan || 'pcs',
        hargaDefault: (hargaDefault ?? harga_default) || 0,
        gambar: image ? null : gambar,
        ...(image ? { gambarData: image.data, gambarMime: image.mime } : {}),
        deskripsi,
        aktif: true,
      }
    });

    // Log audit
    await logManualAction(
      req.user!.id,
      'produk',
      AksiLog.TAMBAH,
      product.namaBarang,
      `Product created: ${product.namaBarang}`,
      product.id
    );

    if (image) {
      await prisma.produk.update({ where: { id: product.id }, data: { gambar: `/api/public/products/${product.id}/image` } });
      product.gambar = `/api/public/products/${product.id}/image`;
    }
    res.json(successResponse(withoutImageData(product)));
  } catch (error) {
    next(error);
  }
});

// PUT /products/:id
router.put('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const id = parseInt(String(req.params.id));
    const {
      kode,
      kode_produk,
      nama_barang,
      namaBarang,
      varian,
      satuan,
      harga_default,
      hargaDefault,
      gambar,
      deskripsi,
      aktif,
      is_active
    } = req.body;

    const existing = await prisma.produk.findUnique({
      where: { id },
      select: { id: true, kode: true, namaBarang: true, varian: true, satuan: true, hargaDefault: true, gambar: true, deskripsi: true, aktif: true, dibuatPada: true }
    });
    if (!existing) {
      throw errorResponse('Product not found', 404);
    }

    const updateData: any = {};
    if (kode || kode_produk) updateData.kode = kode || kode_produk;
    if (namaBarang || nama_barang) updateData.namaBarang = namaBarang || nama_barang;
    if (varian !== undefined) updateData.varian = varian;
    if (satuan !== undefined) updateData.satuan = satuan;
    if (hargaDefault !== undefined || harga_default !== undefined) updateData.hargaDefault = hargaDefault ?? harga_default;
    if (gambar !== undefined) {
      const image = imageDataFrom(gambar);
      if (image) {
        updateData.gambar = `/api/public/products/${id}/image`;
        updateData.gambarData = image.data;
        updateData.gambarMime = image.mime;
      } else if (gambar === '') {
        updateData.gambar = null;
        updateData.gambarData = null;
        updateData.gambarMime = null;
      } else updateData.gambar = gambar;
    }
    if (deskripsi !== undefined) updateData.deskripsi = deskripsi;
    if (aktif !== undefined || is_active !== undefined) updateData.aktif = (aktif !== undefined ? aktif : is_active) === true;

    const product = await prisma.produk.update({
      where: { id },
      data: updateData
    });

    // Log audit
    await logManualAction(
      req.user!.id,
      'produk',
      AksiLog.UBAH,
      product.namaBarang,
      `Product updated: ${product.namaBarang}`,
      product.id,
      existing,
      Object.fromEntries(Object.entries(updateData).filter(([key]) => key !== 'gambarData'))
    );

    res.json(successResponse(withoutImageData(product)));
  } catch (error) {
    next(error);
  }
});

// DELETE /products/:id (soft delete)
router.delete('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const id = parseInt(String(req.params.id));
    
    const product = await prisma.produk.update({
      where: { id },
      data: { aktif: false }
    });

    // Log audit
    await logManualAction(
      req.user!.id,
      'produk',
      AksiLog.HAPUS,
      product.namaBarang,
      `Product soft deleted: ${product.namaBarang}`,
      product.id
    );

    res.json(successResponse({ message: 'Product deleted successfully' }));
  } catch (error) {
    next(error);
  }
});

export default router;
