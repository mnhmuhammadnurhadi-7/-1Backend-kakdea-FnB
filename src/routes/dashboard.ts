import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { successResponse } from '../utils/response';
import prisma from '../utils/database';

const router = Router();

router.use(authenticate);

// GET /dashboard/summary
router.get('/summary', async (req: AuthRequest, res: Response, next) => {
  try {
    const { periode = '7d' } = req.query;
    
    // Calculate date range
    const today = new Date();
    let startDate = new Date();
    
    if (periode === 'today') {
      startDate = today;
    } else if (periode === '7d') {
      startDate.setDate(today.getDate() - 7);
    } else if (periode === '30d') {
      startDate.setDate(today.getDate() - 30);
    }

    // Get cash balance (account 11100 - Kas Utama)
    const cashBalance = await prisma.journalEntryLine.aggregate({
      where: {
        akunKode: '11100',
        journalEntry: {
          tanggal: { lte: today }
        }
      },
      _sum: {
        debit: true,
        kredit: true
      }
    });

    const saldo_kas = Number(cashBalance._sum.debit || 0) - Number(cashBalance._sum.kredit || 0);

    // Get accounts receivable
    const customersWithDebt = await prisma.customer.findMany({
      where: { saldoPiutang: { gt: 0 } }
    });

    const piutang_customer = {
      total: customersWithDebt.reduce((sum, c) => sum + Number(c.saldoPiutang), 0),
      jumlah_customer: customersWithDebt.length
    };

    // Get accounts payable
    const suppliersWithDebt = await prisma.supplier.findMany({
      where: { saldoHutang: { gt: 0 } }
    });

    const hutang_supplier = {
      total: suppliersWithDebt.reduce((sum, s) => sum + Number(s.saldoHutang), 0)
    };

    // Get new orders
    const newOrders = await prisma.order.findMany({
      where: {
        tanggal: { gte: startDate }
      }
    });

    const orderBreakdown = newOrders.reduce((acc, order) => {
      acc[order.jenisOrder] = (acc[order.jenisOrder] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    res.json(successResponse({
      saldo_kas,
      piutang_customer,
      hutang_supplier,
      order_baru: {
        total: newOrders.length,
        breakdown: orderBreakdown
      }
    }));
  } catch (error) {
    next(error);
  }
});

// GET /dashboard/tren-penjualan
router.get('/tren-penjualan', async (req: AuthRequest, res: Response, next) => {
  try {
    const { periode = '7d' } = req.query;
    
    const today = new Date();
    let startDate = new Date();
    
    if (periode === '7d') {
      startDate.setDate(today.getDate() - 7);
    } else if (periode === '30d') {
      startDate.setDate(today.getDate() - 30);
    }

    const orders = await prisma.order.findMany({
      where: {
        tanggal: { gte: startDate, lte: today }
      },
      select: {
        tanggal: true,
        totalInvoice: true
      }
    });

    // Group by date
    const trendData = orders.reduce((acc, order) => {
      const dateKey = order.tanggal.toISOString().split('T')[0];
      if (!acc[dateKey]) {
        acc[dateKey] = { tanggal: dateKey, total: 0 };
      }
      acc[dateKey].total += Number(order.totalInvoice);
      return acc;
    }, {} as Record<string, { tanggal: string; total: number }>);

    const result = Object.values(trendData).sort((a, b) => 
      new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime()
    );

    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

// GET /dashboard/peringatan-stok
router.get('/peringatan-stok', async (req: AuthRequest, res: Response, next) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        stokSaatIni: { lte: prisma.product.fields.stokMinimum }
      }
    });

    const warnings = products.map(p => ({
      product: p.namaBarang,
      stok_saat_ini: p.stokSaatIni,
      stok_minimum: p.stokMinimum,
      level: p.stokSaatIni === 0 ? 'KRITIS' : 'MENIPIS'
    }));

    res.json(successResponse(warnings));
  } catch (error) {
    next(error);
  }
});

// GET /dashboard/aktivitas-terbaru
router.get('/aktivitas-terbaru', async (req: AuthRequest, res: Response, next) => {
  try {
    const { limit = 10 } = req.query;
    
    const activities = await prisma.aiAuditLog.findMany({
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            nama: true,
            email: true
          }
        }
      }
    });

    res.json(successResponse(activities));
  } catch (error) {
    next(error);
  }
});

export default router;