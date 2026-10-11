import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import prisma from '../utils/database';
import { logManualAction } from '../services/auditLogService';
import { AksiLog } from '@prisma/client';

const router = Router();

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
      orderBy: { dibuatPada: 'desc' }
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
      where: { id: parseInt(String(req.params.id)) }
    });

    if (!product) {
      throw errorResponse('Product not found', 404);
    }

    res.json(successResponse(product));
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
        gambar,
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

    res.json(successResponse(product));
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

    const existing = await prisma.produk.findUnique({ where: { id } });
    if (!existing) {
      throw errorResponse('Product not found', 404);
    }

    const updateData: any = {};
    if (kode || kode_produk) updateData.kode = kode || kode_produk;
    if (namaBarang || nama_barang) updateData.namaBarang = namaBarang || nama_barang;
    if (varian !== undefined) updateData.varian = varian;
    if (satuan !== undefined) updateData.satuan = satuan;
    if (hargaDefault !== undefined || harga_default !== undefined) updateData.hargaDefault = hargaDefault ?? harga_default;
    if (gambar !== undefined) updateData.gambar = gambar;
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
      updateData
    );

    res.json(successResponse(product));
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