import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import prisma from '../utils/database';
import { logManualAction } from '../services/auditLogService';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /products
router.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const { search, is_active } = req.query;
    
    const where: any = {};
    if (search) {
      where.OR = [
        { namaBarang: { contains: search as string } },
        { varian: { contains: search as string } },
        { kodeProduk: { contains: search as string } },
      ];
    }
    if (is_active !== undefined) {
      where.isActive = is_active === 'true';
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    res.json(successResponse(products));
  } catch (error) {
    next(error);
  }
});

// GET /products/:id
router.get('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const product = await prisma.product.findUnique({
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
    const { kode_produk, nama_barang, varian, satuan, harga_default, stok_minimum } = req.body;
    
    if (!kode_produk || !nama_barang) {
      throw errorResponse('kode_produk and nama_barang are required');
    }

    const product = await prisma.product.create({
      data: {
        kodeProduk: kode_produk,
        namaBarang: nama_barang,
        varian,
        satuan: satuan || 'pcs',
        hargaDefault: harga_default || 0,
        stokMinimum: stok_minimum || 0,
      }
    });

    // Log audit
    await logManualAction(
      req.user!.id,
      'STOK',
      'CREATE',
      product.namaBarang,
      `Product created: ${product.namaBarang}`,
      'products',
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
    const updates = req.body;
    
    // Remove calculated fields
    delete updates.stok_saat_ini;
    delete updates.created_at;

    const product = await prisma.product.update({
      where: { id },
      data: updates
    });

    // Log audit
    await logManualAction(
      req.user!.id,
      'STOK',
      'UPDATE',
      product.namaBarang,
      `Product updated: ${product.namaBarang}`,
      'products',
      product.id,
      { field: 'product', sebelum: '', sesudah: JSON.stringify(updates) }
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
    
    const product = await prisma.product.update({
      where: { id },
      data: { isActive: false }
    });

    // Log audit
    await logManualAction(
      req.user!.id,
      'STOK',
      'DELETE',
      product.namaBarang,
      `Product soft deleted: ${product.namaBarang}`,
      'products',
      product.id
    );

    res.json(successResponse({ message: 'Product deleted successfully' }));
  } catch (error) {
    next(error);
  }
});

export default router;