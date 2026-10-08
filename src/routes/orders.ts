import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import prisma from '../utils/database';
import { logManualAction } from '../services/auditLogService';
import { AksiLog, SumberInput } from '@prisma/client';
import { KODE_JENIS_BAWAAN } from '../utils/jenisBawaan';

const router = Router();

router.use(authenticate);

// Order dikenali lewat jenis bawaan "Pendapatan Frozen"/"Pendapatan Siap Saji"
const ORDER_JENIS_KODE = [KODE_JENIS_BAWAAN.PENDAPATAN_FROZEN, KODE_JENIS_BAWAAN.PENDAPATAN_SIAP_SAJI];

async function orderJenisIds(): Promise<number[]> {
  const list = await prisma.jenisTransaksi.findMany({
    where: { kode: { in: ORDER_JENIS_KODE } },
    select: { id: true },
  });
  return list.map((j) => j.id);
}

// GET /orders
router.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const { business_unit, unit_bisnis, tanggal_mulai, tanggal_selesai } = req.query;

    const jenisIds = await orderJenisIds();
    const where: any = { jenisTransaksiId: { in: jenisIds } };
    const finalUnit = unit_bisnis || business_unit;
    if (finalUnit) where.unitBisnis = finalUnit as string;
    if (tanggal_mulai || tanggal_selesai) {
      where.tanggal = {};
      if (tanggal_mulai) where.tanggal.gte = new Date(tanggal_mulai as string);
      if (tanggal_selesai) where.tanggal.lte = new Date(tanggal_selesai as string);
    }

    const orders = await prisma.transaksi.findMany({
      where,
      include: { jenisTransaksi: true },
      orderBy: { tanggal: 'desc' },
    });

    const transformed = orders.map((o) => ({
      ...o,
      totalInvoice: o.nominal,
      total_invoice: o.nominal,
      jenisOrder: o.namaTransaksi,
      jenis_order: o.namaTransaksi,
      kodeOrder: o.kode,
      kode_order: o.kode,
    }));

    res.json(successResponse(transformed));
  } catch (error) {
    next(error);
  }
});

// GET /orders/:id
router.get('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const id = parseInt(String(req.params.id));
    const jenisIds = await orderJenisIds();
    const order = await prisma.transaksi.findFirst({
      where: { id, jenisTransaksiId: { in: jenisIds } },
      include: { jenisTransaksi: true },
    });

    if (!order) throw errorResponse('Order tidak ditemukan', 404);

    res.json(successResponse({
      ...order,
      totalInvoice: order.nominal,
      jenisOrder: order.namaTransaksi,
      kodeOrder: order.kode,
    }));
  } catch (error) {
    next(error);
  }
});

export default router;
