import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import prisma from '../utils/database';
import { logManualAction } from '../services/auditLogService';

const router = Router();

router.use(authenticate);

// GET /stock
router.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { namaBarang: 'asc' }
    });

    const stockData = products.map(p => {
      const status = p.stokSaatIni <= p.stokMinimum ? 'MENIPIS' : 'AMAN';
      const level = p.stokSaatIni === 0 ? 'KRITIS' : status;
      
      return {
        ...p,
        status,
        level,
      };
    });

    res.json(successResponse(stockData));
  } catch (error) {
    next(error);
  }
});

// GET /stock/:product_id/movements
router.get('/:product_id/movements', async (req: AuthRequest, res: Response, next) => {
  try {
    const productId = parseInt(String(req.params.product_id));
    
    const movements = await prisma.stockMovement.findMany({
      where: { productId },
      include: {
        order: {
          select: {
            kodeOrder: true,
            jenisOrder: true,
          }
        }
      },
      orderBy: { tanggal: 'desc' }
    });

    res.json(successResponse(movements));
  } catch (error) {
    next(error);
  }
});

// POST /stock/movements
router.post('/movements', async (req: AuthRequest, res: Response, next) => {
  try {
    const { product_id, tanggal, tipe, jumlah, keterangan, order_id } = req.body;
    
    if (!product_id || !tanggal || !tipe || !jumlah) {
      throw errorResponse('Missing required fields');
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create stock movement
      const movement = await tx.stockMovement.create({
        data: {
          productId: product_id,
          tanggal: new Date(tanggal),
          tipe,
          jumlah,
          keterangan,
          orderId: order_id,
          sumberInput: 'MANUAL',
        }
      });

      // Update product stock
      const stockChange = tipe === 'MASUK' || tipe === 'RETUR' ? jumlah : -jumlah;
      await tx.product.update({
        where: { id: product_id },
        data: {
          stokSaatIni: { increment: stockChange }
        }
      });

      return movement;
    });

    const product = await prisma.product.findUnique({
      where: { id: product_id }
    });

    await logManualAction(
      req.user!.id,
      'STOK',
      'CREATE',
      product?.namaBarang || 'Unknown',
      `Stock movement: ${tipe} ${jumlah} units`,
      'stock_movements',
      result.id
    );

    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

export default router;