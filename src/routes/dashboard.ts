import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { successResponse } from '../utils/response';
import prisma from '../utils/database';
import { KODE_JENIS_BAWAAN } from '../utils/jenisBawaan';

const router = Router();

async function orderJenisIds(): Promise<number[]> {
  const list = await prisma.jenisTransaksi.findMany({
    where: { kode: { in: [KODE_JENIS_BAWAAN.PENDAPATAN_FROZEN, KODE_JENIS_BAWAAN.PENDAPATAN_SIAP_SAJI] } },
    select: { id: true },
  });
  return list.map((j) => j.id);
}

router.use(authenticate);

// GET /dashboard/summary
router.get('/summary', async (req: AuthRequest, res: Response, next) => {
  try {
    const { periode = '7d' } = req.query;
    
    const today = new Date();
    let startDate = new Date();
    
    if (periode === 'today') {
      startDate = today;
    } else if (periode === '7d') {
      startDate.setDate(today.getDate() - 7);
    } else if (periode === '30d') {
      startDate.setDate(today.getDate() - 30);
    }

    // Saldo kas: net pemasukan - pengeluaran
    const [pemasukanAgg, pengeluaranAgg] = await Promise.all([
      prisma.transaksi.aggregate({
        where: { tanggal: { lte: today }, jenisTransaksi: { arah: 'PEMASUKAN' } },
        _sum: { nominal: true },
      }),
      prisma.transaksi.aggregate({
        where: { tanggal: { lte: today }, jenisTransaksi: { arah: 'PENGELUARAN' } },
        _sum: { nominal: true },
      }),
    ]);

    const saldo_kas = Number(pemasukanAgg._sum.nominal || 0) - Number(pengeluaranAgg._sum.nominal || 0);

    // Get order count
    const orderCount = await prisma.transaksi.count({
      where: {
        jenisTransaksiId: { in: await orderJenisIds() },
        tanggal: { gte: startDate }
      }
    });

    res.json(successResponse({
      saldo_kas,
      order_baru: {
        total: orderCount
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

    const orders = await prisma.transaksi.findMany({
      where: {
        jenisTransaksiId: { in: await orderJenisIds() },
        tanggal: { gte: startDate, lte: today }
      },
      select: {
        tanggal: true,
        nominal: true,
      }
    });

    // Group by date
    const trendData = orders.reduce((acc, order) => {
      const dateKey = order.tanggal.toISOString().split('T')[0];
      if (!acc[dateKey]) {
        acc[dateKey] = { tanggal: dateKey, total: 0 };
      }
      acc[dateKey].total += Number(order.nominal);
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

// GET /dashboard/peringatan-stok (parked)
router.get('/peringatan-stok', async (req: AuthRequest, res: Response) => {
  res.json(successResponse([]));
});

// GET /dashboard/aktivitas-terbaru
router.get('/aktivitas-terbaru', async (req: AuthRequest, res: Response, next) => {
  try {
    const { limit = 10 } = req.query;
    
    const activities = await prisma.logAudit.findMany({
      take: Number(limit),
      orderBy: { dibuatPada: 'desc' },
      include: {
        pengguna: {
          select: {
            nama: true,
            email: true
          }
        }
      }
    });

    const transformed = activities.map(a => ({
      ...a,
      sheet: a.tabelTarget,
      source: a.sumber,
      action: a.aksi,
      recordLabel: a.labelRecord,
      createdAt: a.dibuatPada,
      user: a.pengguna,
    }));

    res.json(successResponse(transformed));
  } catch (error) {
    next(error);
  }
});

// GET /dashboard/pemasukan-pengeluaran
router.get('/pemasukan-pengeluaran', async (req: AuthRequest, res: Response, next) => {
  try {
    const { periode = '30d' } = req.query;
    const today = new Date();
    const startDate = new Date();
    if (periode === '7d') startDate.setDate(today.getDate() - 7);
    else if (periode === '30d') startDate.setDate(today.getDate() - 30);
    else startDate.setDate(today.getDate() - 90);

    const transactions = await prisma.transaksi.findMany({
      where: { tanggal: { gte: startDate, lte: today } },
      select: { tanggal: true, nominal: true, jenisTransaksi: { select: { arah: true } } },
    });

    const dailyData: Record<string, { pemasukan: number; pengeluaran: number }> = {};
    for (const t of transactions) {
      const key = t.tanggal.toISOString().split('T')[0];
      if (!dailyData[key]) dailyData[key] = { pemasukan: 0, pengeluaran: 0 };
      if (t.jenisTransaksi.arah === 'PEMASUKAN') {
        dailyData[key].pemasukan += Number(t.nominal);
      } else {
        dailyData[key].pengeluaran += Number(t.nominal);
      }
    }

    const result = Object.entries(dailyData)
      .map(([tanggal, data]) => ({ tanggal, ...data }))
      .sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());

    const totalPemasukan = result.reduce((s, r) => s + r.pemasukan, 0);
    const totalPengeluaran = result.reduce((s, r) => s + r.pengeluaran, 0);

    res.json(successResponse({
      daily: result,
      totals: {
        pemasukan: totalPemasukan,
        pengeluaran: totalPengeluaran,
        laba: totalPemasukan - totalPengeluaran,
      },
    }));
  } catch (error) {
    next(error);
  }
});

export default router;