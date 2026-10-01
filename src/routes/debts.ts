import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import prisma from '../utils/database';
import { logManualAction } from '../services/auditLogService';
import { AksiLog, SumberInput } from '@prisma/client';
import { KODE_JENIS_BAWAAN, getJenisBawaan } from '../utils/jenisBawaan';

const router = Router();

router.use(authenticate);

// GET /debts
router.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const debts = await prisma.hutang.findMany({
      include: { transaksi: { orderBy: { tanggal: 'desc' } } },
      orderBy: { dibuatPada: 'desc' },
    });
    res.json(successResponse(debts));
  } catch (error) {
    next(error);
  }
});

// GET /debts/:id/payments
router.get('/:id/payments', async (req: AuthRequest, res: Response, next) => {
  try {
    const debtId = parseInt(String(req.params.id));
    const payments = await prisma.transaksi.findMany({
      where: { hutangId: debtId },
      orderBy: { tanggal: 'desc' },
    });
    res.json(successResponse(payments));
  } catch (error) {
    next(error);
  }
});

// POST /debts
router.post('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const { nama_kreditur, namaKreditur, jaminan, jumlah_pinjaman, jumlahPinjaman, tanggal_mulai, tanggalMulai } = req.body;

    const finalKreditur = namaKreditur || nama_kreditur;
    const finalJumlah = jumlahPinjaman ?? jumlah_pinjaman;

    if (!finalKreditur || !finalJumlah) {
      throw errorResponse('namaKreditur (nama_kreditur) dan jumlahPinjaman (jumlah_pinjaman) wajib diisi');
    }

    const debt = await prisma.hutang.create({
      data: {
        namaKreditur: finalKreditur,
        jaminan,
        jumlahPinjaman: finalJumlah,
        tanggalMulai: (tanggalMulai || tanggal_mulai) ? new Date(tanggalMulai || tanggal_mulai) : null,
        sisaHutang: finalJumlah,
      },
    });

    await logManualAction(req.user!.id, 'hutang', AksiLog.TAMBAH, debt.namaKreditur, `Hutang baru: ${debt.namaKreditur}`, debt.id);

    res.json(successResponse(debt));
  } catch (error) {
    next(error);
  }
});

// POST /debts/:id/payments
router.post('/:id/payments', async (req: AuthRequest, res: Response, next) => {
  try {
    const debtId = parseInt(String(req.params.id));
    const { periode, jumlah_bayar, nominal, tanggal, detail, jenisKas, jenis_kas } = req.body;

    const amount = Number(nominal ?? jumlah_bayar);
    if (!amount || amount <= 0) {
      throw errorResponse('nominal (jumlah_bayar) wajib diisi dan harus > 0');
    }

    const hutang = await prisma.hutang.findUnique({ where: { id: debtId } });
    if (!hutang) throw errorResponse('Hutang tidak ditemukan', 404);

    const payDate = tanggal ? new Date(tanggal) : new Date();
    const cashType = jenisKas || jenis_kas || 'Kas Utama';

    // Jenis bawaan (kode MT1, di-seed di prisma/seed.ts) - tetap full-CRUD
    // oleh user seperti jenis lain. Sejak 29 Sep 2026 tidak ada lagi
    // jurnal - sisaHutang di tabel Hutang tetap jadi sumber kebenaran.
    const jenisTrx = await getJenisBawaan(KODE_JENIS_BAWAAN.PEMBAYARAN_CICILAN_HUTANG);

    const result = await prisma.$transaction(async (tx) => {
      const trxKode = `MT-H${debtId}-${Date.now()}`;

      const trx = await tx.transaksi.create({
        data: {
          kode: trxKode,
          tanggal: payDate,
          unitBisnis: 'PABRIK',
          jenisTransaksiId: jenisTrx.id,
          namaTransaksi: jenisTrx.namaTransaksi,
          detail: detail || `Pembayaran cicilan hutang ${hutang.namaKreditur}${periode ? ` periode ${periode}` : ''}`,
          jenisKas: cashType,
          nominal: amount,
          debit: 'Hutang Usaha', // label informasional, teks bebas
          kredit: cashType,
          hutangId: debtId,
          sumberInput: SumberInput.MANUAL,
          dibuatOleh: req.user!.id,
        },
      });

      const newSisa = Math.max(0, Number(hutang.sisaHutang) - amount);
      await tx.hutang.update({ where: { id: debtId }, data: { sisaHutang: newSisa } });

      return trx;
    });

    await logManualAction(
      req.user!.id, 'transaksi', AksiLog.TAMBAH, result.kode,
      `Pembayaran hutang dicatat: ${hutang.namaKreditur} Rp ${amount}`, result.id
    );

    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

export default router;
