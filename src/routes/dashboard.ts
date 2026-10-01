import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { successResponse } from '../utils/response';
import prisma from '../utils/database';
import { KODE_JENIS_BAWAAN } from '../utils/jenisBawaan';

const router = Router();

// Tidak di-cache secara sengaja: jenis bawaan ini full-CRUD oleh user,
// jadi ID-nya bisa berubah kapan saja - selalu query ulang.
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

    // Saldo kas: sejak Debit/Kredit jadi teks bebas (bukan akun yang
    // divalidasi), "Kas Utama" beneran tidak bisa dihitung lagi dari
    // jurnal. Estimasi terbaik yang masih valid: net kas masuk (semua
    // entri arah PEMASUKAN) dikurangi kas keluar (arah PENGELUARAN) dari
    // seluruh histori transaksi - sama seperti dasar hitung Laba-Rugi.
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

    // Get accounts receivable
    const customersWithDebt = await prisma.dataPelanggan.findMany({
      where: { saldoPiutang: { gt: 0 } }
    });

    const piutang_customer = {
      total: customersWithDebt.reduce((sum, c) => sum + Number(c.saldoPiutang), 0),
      jumlah_customer: customersWithDebt.length
    };

    // Get accounts payable
    const suppliersWithDebt = await prisma.dataPemasok.findMany({
      where: { saldoHutang: { gt: 0 } }
    });

    const hutang_supplier = {
      total: suppliersWithDebt.reduce((sum, s) => sum + Number(s.saldoHutang), 0)
    };

    // Get new orders
    const newOrders = await prisma.transaksi.findMany({
      where: {
        jenisTransaksiId: { in: await orderJenisIds() },
        tanggal: { gte: startDate }
      }
    });

    const orderBreakdown = newOrders.reduce((acc, order) => {
      const src = order.sumberOrder || 'LAIN';
      acc[src] = (acc[src] || 0) + 1;
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

export default router;