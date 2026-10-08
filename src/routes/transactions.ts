import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import prisma from '../utils/database';
import { logManualAction } from '../services/auditLogService';
import { AksiLog, SumberInput } from '@prisma/client';

const router = Router();

router.use(authenticate);

// Generate kode transaksi yang atomic & aman untuk concurrent request
async function generateKodeTransaksi(tx: any, prefixKode: string): Promise<string> {
  const rows: Array<{ maxNum: number | null }> = await tx.$queryRaw`
    SELECT MAX(CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(kode, '-', 1), ${prefixKode}, -1) AS UNSIGNED)) as maxNum
    FROM transaksi
    WHERE kode LIKE ${prefixKode + '%'}
  `;
  const next = (Number(rows[0]?.maxNum) || 0) + 1;
  return `${prefixKode}${String(next).padStart(3, '0')}-${Date.now().toString().slice(-5)}`;
}

interface CreateEntriParams {
  jenisTransaksiId: number;
  tanggal: Date;
  unitBisnis?: string | null;
  detail?: string | null;
  jenisKas?: string | null;
  nominal: number;
  debit?: string | null;
  kredit?: string | null;
  customData?: Record<string, any> | null;
  sumberInput?: SumberInput;
  dibuatOleh: number;
}

/**
 * Pembuat entri transaksi generik - dipakai oleh endpoint POST / di file ini.
 */
export async function createEntriTransaksi(params: CreateEntriParams) {
  const jenisTrx = await prisma.jenisTransaksi.findUnique({ where: { id: params.jenisTransaksiId } });
  if (!jenisTrx || !jenisTrx.aktif) {
    throw errorResponse('Jenis transaksi tidak ditemukan atau nonaktif', 404);
  }

  return prisma.$transaction(async (tx) => {
    const kode = await generateKodeTransaksi(tx, jenisTrx.kode);

    const entri = await tx.transaksi.create({
      data: {
        kode,
        tanggal: params.tanggal,
        unitBisnis: params.unitBisnis || null,
        jenisTransaksiId: jenisTrx.id,
        namaTransaksi: jenisTrx.namaTransaksi,
        detail: params.detail || null,
        jenisKas: params.jenisKas || null,
        nominal: params.nominal,
        debit: params.debit || null,
        kredit: params.kredit || null,
        customData: params.customData || undefined,
        sumberInput: params.sumberInput || SumberInput.MANUAL,
        dibuatOleh: params.dibuatOleh,
      },
    });

    return entri;
  });
}

// GET /transactions
router.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const { business_unit, unit_bisnis, jenis_transaksi_id, transaction_type_id, tanggal_mulai, tanggal_selesai, search, page = '1', limit = '50' } = req.query;

    const where: any = {};
    const finalUnit = unit_bisnis || business_unit;
    if (finalUnit) where.unitBisnis = finalUnit as string;
    const jTrxId = jenis_transaksi_id || transaction_type_id;
    if (jTrxId) where.jenisTransaksiId = parseInt(String(jTrxId));
    if (tanggal_mulai || tanggal_selesai) {
      where.tanggal = {};
      if (tanggal_mulai) where.tanggal.gte = new Date(tanggal_mulai as string);
      if (tanggal_selesai) where.tanggal.lte = new Date(tanggal_selesai as string);
    }
    if (search) {
      where.OR = [
        { namaTransaksi: { contains: search as string } },
        { detail: { contains: search as string } },
        { kode: { contains: search as string } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [transactions, total] = await Promise.all([
      prisma.transaksi.findMany({
        where,
        include: {
          jenisTransaksi: { include: { kolomCustom: { where: { aktif: true } } } },
        },
        orderBy: { tanggal: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.transaksi.count({ where }),
    ]);

    res.json(successResponse({
      data: transactions,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    }));
  } catch (error) {
    next(error);
  }
});

// GET /transactions/:id
router.get('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const id = parseInt(String(req.params.id));
    const trx = await prisma.transaksi.findUnique({
      where: { id },
      include: {
        jenisTransaksi: { include: { kolomCustom: { where: { aktif: true } } } },
      },
    });
    if (!trx) throw errorResponse('Transaksi tidak ditemukan', 404);
    res.json(successResponse(trx));
  } catch (error) {
    next(error);
  }
});

// POST /transactions
router.post('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const {
      tanggal,
      unit_bisnis,
      business_unit,
      jenis_transaksi_id,
      transaction_type_id,
      detail,
      keterangan,
      jenis_kas,
      jenisKas,
      nominal,
      debit,
      kredit,
      custom_data,
      customData,
      sumber_input,
      sumberInput,
    } = req.body;

    const jTrxId = jenis_transaksi_id || transaction_type_id;
    const finalNominal = Number(nominal);
    if (!tanggal || !jTrxId || !finalNominal) {
      throw errorResponse('tanggal, jenis_transaksi_id, dan nominal wajib diisi');
    }

    const entri = await createEntriTransaksi({
      jenisTransaksiId: parseInt(String(jTrxId)),
      tanggal: new Date(tanggal),
      unitBisnis: unit_bisnis || business_unit,
      detail: detail || keterangan,
      jenisKas: jenisKas || jenis_kas,
      nominal: finalNominal,
      debit: debit || null,
      kredit: kredit || null,
      customData: customData || custom_data,
      sumberInput: (sumberInput || sumber_input) === 'AI' ? SumberInput.AI : SumberInput.MANUAL,
      dibuatOleh: req.user!.id,
    });

    await logManualAction(
      req.user!.id,
      'transaksi',
      AksiLog.TAMBAH,
      entri.kode,
      `Transaksi baru: ${entri.namaTransaksi}`,
      entri.id,
      undefined,
      entri
    );

    res.json(successResponse(entri));
  } catch (error) {
    next(error);
  }
});

// PUT /transactions/:id
router.put('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const id = parseInt(String(req.params.id));
    const before = await prisma.transaksi.findUnique({ where: { id } });
    if (!before) throw errorResponse('Transaksi tidak ditemukan', 404);

    const { tanggal, detail, keterangan, jenis_kas, jenisKas, nominal, debit, kredit, custom_data, customData } = req.body;

    const data: any = {};
    if (tanggal !== undefined) data.tanggal = new Date(tanggal);
    if ((detail ?? keterangan) !== undefined) data.detail = detail ?? keterangan;
    if ((jenisKas ?? jenis_kas) !== undefined) data.jenisKas = jenisKas ?? jenis_kas;
    if (nominal !== undefined) data.nominal = Number(nominal);
    if (debit !== undefined) data.debit = debit;
    if (kredit !== undefined) data.kredit = kredit;
    if ((customData ?? custom_data) !== undefined) data.customData = customData ?? custom_data;

    const updated = await prisma.transaksi.update({ where: { id }, data });

    await logManualAction(
      req.user!.id, 'transaksi', AksiLog.UBAH, updated.kode,
      `Transaksi diubah: ${updated.kode}`, updated.id, before, updated
    );

    res.json(successResponse(updated));
  } catch (error) {
    next(error);
  }
});

// DELETE /transactions/:id
router.delete('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) return next();

    const trx = await prisma.transaksi.findUnique({ where: { id } });
    if (!trx) throw errorResponse('Transaksi tidak ditemukan', 404);

    await prisma.transaksi.delete({ where: { id } });

    await logManualAction(
      req.user!.id, 'transaksi', AksiLog.HAPUS, trx.kode,
      `Transaksi dihapus: ${trx.kode}`, trx.id, trx, undefined
    );

    res.json(successResponse({ message: 'Transaksi dihapus' }));
  } catch (error) {
    next(error);
  }
});

export default router;
