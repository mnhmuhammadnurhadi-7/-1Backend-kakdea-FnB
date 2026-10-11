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
      orderBy: { dibuatPada: 'desc' }
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
      where: { id: parseInt(String(req.params.id)) }
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

export default router;
