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

// GET /dashboard/grafik-kas
router.get('/grafik-kas', async (req: AuthRequest, res: Response, next) => {
  try {
    const { periode = '7d' } = req.query;
    const allTime = periode === 'semua' || periode === 'all';
    const days = periode === 'bulanan' || periode === '30d' ? 30 : 7;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const startDate = new Date(today);
    startDate.setUTCDate(startDate.getUTCDate() - days + 1);

    const transactions = await prisma.transaksi.findMany({
      where: {
        tanggal: allTime ? { lte: today } : { gte: startDate, lte: today }
      },
      orderBy: [{ tanggal: 'asc' }, { dibuatPada: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        tanggal: true,
        detail: true,
        namaTransaksi: true,
        nominal: true,
        jenisTransaksi: { select: { arah: true } },
      }
    });

    const entriesByDate = new Map<string, Array<{ id: number; detail: string; jenis: string; arah: string; nominal: number }>>();
    for (const transaction of transactions) {
      const dateKey = transaction.tanggal.toISOString().split('T')[0];
      const entries = entriesByDate.get(dateKey) || [];
      entries.push({
        id: transaction.id,
        detail: transaction.detail || transaction.namaTransaksi,
        jenis: transaction.namaTransaksi,
        arah: transaction.jenisTransaksi.arah,
        nominal: Number(transaction.nominal),
      });
      entriesByDate.set(dateKey, entries);
    }

    const firstDate = allTime
      ? transactions.reduce((first, transaction) => transaction.tanggal < first ? transaction.tanggal : first, transactions[0]?.tanggal || today)
      : startDate;
    const rangeDays = allTime && transactions.length
      ? Math.floor((today.getTime() - firstDate.getTime()) / 86_400_000) + 1
      : allTime ? 0 : days;
    const result = Array.from({ length: rangeDays }, (_, index) => {
      const date = new Date(firstDate);
      date.setUTCDate(firstDate.getUTCDate() + index);
      const tanggal = date.toISOString().split('T')[0];
      const entries = entriesByDate.get(tanggal) || [];
      return {
        tanggal,
        pemasukan: entries.filter((entry) => entry.arah === 'PEMASUKAN').reduce((sum, entry) => sum + entry.nominal, 0),
        pengeluaran: entries.filter((entry) => entry.arah === 'PENGELUARAN').reduce((sum, entry) => sum + entry.nominal, 0),
        transaksi: entries,
      };
    });

    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

// GET /dashboard/sumber-input
router.get('/sumber-input', async (req: AuthRequest, res: Response, next) => {
  try {
    const days = req.query.periode === '7d' ? 7 : 30;
    const end = new Date();
    end.setUTCHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - days + 1);

    const grouped = await prisma.transaksi.groupBy({
      by: ['sumberInput'],
      where: { tanggal: { gte: start, lte: end } },
      _count: { _all: true },
    });
    const ai = grouped.find((row) => row.sumberInput === 'AI')?._count._all || 0;
    const manual = grouped.find((row) => row.sumberInput === 'MANUAL')?._count._all || 0;
    const total = ai + manual;

    res.json(successResponse({
      ai,
      manual,
      total,
      aiPersen: total ? Math.round((ai / total) * 100) : 0,
      manualPersen: total ? 100 - Math.round((ai / total) * 100) : 0,
    }));
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
