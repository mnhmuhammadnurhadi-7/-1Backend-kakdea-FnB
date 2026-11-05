import { Router, Request, Response } from 'express';
import { successResponse, errorResponse } from '../utils/response';
import prisma from '../utils/database';

const router = Router();

// GET /public/products - Public endpoint to get active products
router.get('/', async (req: Request, res: Response, next) => {
  try {
    const { search } = req.query;

    const where: any = { aktif: true };
    if (search) {
      where.OR = [
        { namaBarang: { contains: search as string } },
        { varian: { contains: search as string } },
        { kode: { contains: search as string } },
      ];
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

// GET /public/products/:id - Public endpoint to get product by ID
router.get('/:id', async (req: Request, res: Response, next) => {
  try {
    const product = await prisma.produk.findUnique({
      where: { id: parseInt(String(req.params.id)) },
      select: { id: true, kode: true, namaBarang: true, varian: true, satuan: true, hargaDefault: true, gambar: true, deskripsi: true, aktif: true, dibuatPada: true }
    });

    if (!product) {
      throw errorResponse('Product not found', 404);
    }

    if (!product.aktif) {
      throw errorResponse('Product is not available', 404);
    }

    res.json(successResponse(product));
  } catch (error) {
    next(error);
  }
});

// GET /public/products/:id/image
router.get('/:id/image', async (req: Request, res: Response, next) => {
  try {
    const product = await prisma.produk.findUnique({
      where: { id: parseInt(String(req.params.id)) },
      select: { gambarData: true, gambarMime: true, aktif: true },
    });
    if (!product?.gambarData || !product.gambarMime || !product.aktif) {
      throw errorResponse('Gambar tidak ditemukan', 404);
    }
    res.type(product.gambarMime).set('Cache-Control', 'public, max-age=3600').send(Buffer.from(product.gambarData));
  } catch (error) {
    next(error);
  }
});

export default router;
