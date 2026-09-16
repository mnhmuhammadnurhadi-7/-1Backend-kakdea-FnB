import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import prisma from '../utils/database';
import { createFromSource } from '../services/journalService';
import { logManualAction } from '../services/auditLogService';

const router = Router();

router.use(authenticate);

// GET /debts
router.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const debts = await prisma.debt.findMany({
      include: {
        payments: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(successResponse(debts));
  } catch (error) {
    next(error);
  }
});

// GET /debts/:id/payments
router.get('/:id/payments', async (req: AuthRequest, res: Response, next) => {
  try {
    const payments = await prisma.debtPayment.findMany({
      where: { debtId: parseInt(String(req.params.id)) },
      orderBy: { periode: 'desc' }
    });

    res.json(successResponse(payments));
  } catch (error) {
    next(error);
  }
});

// POST /debts
router.post('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const { nama_kreditur, jaminan, jumlah_pinjaman, tanggal_mulai } = req.body;
    
    if (!nama_kreditur || !jumlah_pinjaman) {
      throw errorResponse('nama_kreditur and jumlah_pinjaman are required');
    }

    const debt = await prisma.debt.create({
      data: {
        namaKreditur: nama_kreditur,
        jaminan,
        jumlahPinjaman: jumlah_pinjaman,
        tanggalMulai: tanggal_mulai ? new Date(tanggal_mulai) : null,
        sisaHutang: jumlah_pinjaman,
      }
    });

    await logManualAction(
      req.user!.id,
      'TRANSAKSI',
      'CREATE',
      debt.namaKreditur,
      `Debt created: ${debt.namaKreditur}`,
      'debts',
      debt.id
    );

    res.json(successResponse(debt));
  } catch (error) {
    next(error);
  }
});

// POST /debts/:id/payments
router.post('/:id/payments', async (req: AuthRequest, res: Response, next) => {
  try {
    const debtId = parseInt(String(req.params.id));
    const { periode, jumlah_bayar } = req.body;
    
    if (!periode || !jumlah_bayar) {
      throw errorResponse('periode and jumlah_bayar are required');
    }

    const result = await prisma.$transaction(async (tx) => {
      const debt = await tx.debt.findUnique({
        where: { id: debtId }
      });

      if (!debt) {
        throw errorResponse('Debt not found', 404);
      }

      // Create payment
      const payment = await tx.debtPayment.create({
        data: {
          debtId,
          periode,
          jumlahBayar: jumlah_bayar,
          statusBayar: Number(jumlah_bayar) >= Number(debt.sisaHutang) ? 'LUNAS' : 'SEBAGIAN',
        }
      });

      // Create journal entry
      const journalEntry = await createFromSource({
        tanggal: new Date(),
        deskripsi: `Debt payment - ${debt.namaKreditur}`,
        sumberTabel: 'DEBT_PAYMENT',
        sumberId: payment.id,
        businessUnit: 'PABRIK',
        dibuatOleh: req.user!.id,
        viaAi: false,
        lines: [
          {
            akunKode: '21100', // Hutang Usaha
            debit: jumlah_bayar,
            kredit: 0,
          },
          {
            akunKode: '11100', // Kas Utama
            debit: 0,
            kredit: jumlah_bayar,
          }
        ]
      });

      // Update payment with journal entry ID
      await tx.debtPayment.update({
        where: { id: payment.id },
        data: { journalEntryId: journalEntry.id }
      });

      // Update debt balance
      await tx.debt.update({
        where: { id: debtId },
        data: {
          sisaHutang: { decrement: jumlah_bayar }
        }
      });

      return payment;
    });

    await logManualAction(
      req.user!.id,
      'TRANSAKSI',
      'CREATE',
      `Payment-${periode}`,
      `Debt payment created: ${periode}`,
      'debt_payments',
      result.id
    );

    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

export default router;