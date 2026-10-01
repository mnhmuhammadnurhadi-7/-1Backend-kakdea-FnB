import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import prisma from '../utils/database';
import { logManualAction } from '../services/auditLogService';
import { AksiLog, SumberInput } from '@prisma/client';

const router = Router();

router.use(authenticate);

// Generate kode transaksi yang atomic & aman untuk concurrent request:
// pakai MAX(id) dalam prefix kode jenis, bukan count() (yang bisa
// collide kalau ada row yang sudah dihapus).
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
  detail?: string | null; // Keterangan
  jenisKas?: string | null;
  nominal: number;
  debit?: string | null; // teks bebas, opsional
  kredit?: string | null; // teks bebas, opsional
  customData?: Record<string, any> | null;
  pemasokId?: number | null;
  hutangId?: number | null;
  pelangganId?: number | null;
  produkId?: number | null;
  jumlah?: number | null;
  hargaSatuan?: number | null;
  jumlahBayar?: number | null;
  sisaPiutang?: number | null;
  sumberOrder?: string | null;
  sumberInput?: SumberInput;
  dibuatOleh: number;
}

/**
 * Pembuat entri transaksi generik - dipakai oleh endpoint POST / di file
 * ini, DAN oleh orders.ts / debts.ts. Sejak revisi 29 Sep 2026: TIDAK
 * ADA lagi validasi akun/jurnal - Debit/Kredit murni teks bebas yang
 * diketik user (boleh kosong), Neraca otomatis di luar scope.
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
        pemasokId: params.pemasokId || null,
        hutangId: params.hutangId || null,
        pelangganId: params.pelangganId || null,
        produkId: params.produkId || null,
        jumlah: params.jumlah ?? null,
        hargaSatuan: params.hargaSatuan ?? null,
        jumlahBayar: params.jumlahBayar ?? null,
        sisaPiutang: params.sisaPiutang ?? null,
        sumberOrder: params.sumberOrder || null,
        sumberInput: params.sumberInput || SumberInput.MANUAL,
        dibuatOleh: params.dibuatOleh,
      },
    });

    // Update saldo hutang pemasok kalau entri ini terkait pemasok (cek
    // ada-tidaknya pemasokId, tidak lagi terikat enum tipe apapun).
    if (params.pemasokId) {
      await tx.dataPemasok.update({
        where: { id: params.pemasokId },
        data: { saldoHutang: { increment: params.nominal } },
      });
    }

    return entri;
  });
}

// GET /transactions  -- tanpa filter jenis_transaksi_id = feed gabungan
// SEMUA entri lintas jenis, ini yang dipakai tab "Master Transaksi" di
// webf (kolom default saja: tanggal, keterangan, jenis, nominal).
router.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const { business_unit, unit_bisnis, jenis_transaksi_id, transaction_type_id, tanggal_mulai, tanggal_selesai, search } = req.query;

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

    const transactions = await prisma.transaksi.findMany({
      where,
      include: {
        jenisTransaksi: { include: { kolomCustom: { where: { aktif: true } } } },
        pemasok: true,
        pelanggan: true,
        produk: true,
        hutang: true,
      },
      orderBy: { tanggal: 'desc' },
    });

    res.json(successResponse(transactions));
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
        pemasok: true,
        pelanggan: true,
        produk: true,
        hutang: true,
      },
    });
    if (!trx) throw errorResponse('Transaksi tidak ditemukan', 404);
    res.json(successResponse(trx));
  } catch (error) {
    next(error);
  }
});

// POST /transactions  -- endpoint generic utama, dipakai form "Tambah
// Transaksi" di webf. Debit/Kredit opsional (teks bebas).
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
      pemasok_id,
      pemasokId,
      pelanggan_id,
      pelangganId,
      produk_id,
      produkId,
      hutang_id,
      hutangId,
      jumlah,
      harga_satuan,
      hargaSatuan,
      jumlah_bayar,
      jumlahBayar,
      sumber_order,
      sumberOrder,
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
      pemasokId: (pemasokId ?? pemasok_id) ? parseInt(String(pemasokId ?? pemasok_id)) : null,
      hutangId: (hutangId ?? hutang_id) ? parseInt(String(hutangId ?? hutang_id)) : null,
      pelangganId: (pelangganId ?? pelanggan_id) ? parseInt(String(pelangganId ?? pelanggan_id)) : null,
      produkId: (produkId ?? produk_id) ? parseInt(String(produkId ?? produk_id)) : null,
      jumlah: jumlah ? parseInt(String(jumlah)) : null,
      hargaSatuan: (hargaSatuan ?? harga_satuan) ? Number(hargaSatuan ?? harga_satuan) : null,
      jumlahBayar: (jumlahBayar ?? jumlah_bayar) !== undefined ? Number(jumlahBayar ?? jumlah_bayar) : null,
      sumberOrder: sumberOrder || sumber_order,
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

// PUT /transactions/:id  -- edit satu baris entri
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

    await prisma.$transaction(async (tx) => {
      await tx.transaksi.delete({ where: { id } });

      if (trx.hutangId) {
        await tx.hutang.update({
          where: { id: trx.hutangId },
          data: { sisaHutang: { increment: trx.nominal } },
        });
      }
      if (trx.pemasokId) {
        await tx.dataPemasok.update({
          where: { id: trx.pemasokId },
          data: { saldoHutang: { decrement: trx.nominal } },
        });
      }
    });

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
