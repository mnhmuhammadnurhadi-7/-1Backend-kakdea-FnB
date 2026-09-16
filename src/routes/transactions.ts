import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import prisma from '../utils/database';
import { createFromSource, deleteBySource } from '../services/journalService';
import { logManualAction } from '../services/auditLogService';

const router = Router();

router.use(authenticate);

// GET /transactions (union of direct_costs, indirect_costs, cash_transactions)
router.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const { business_unit, tanggal_mulai, tanggal_selesai, search } = req.query;
    
    const where: any = {};
    if (business_unit) {
      where.businessUnit = business_unit;
    }
    if (tanggal_mulai || tanggal_selesai) {
      where.tanggal = {};
      if (tanggal_mulai) {
        where.tanggal.gte = new Date(tanggal_mulai as string);
      }
      if (tanggal_selesai) {
        where.tanggal.lte = new Date(tanggal_selesai as string);
      }
    }
    if (search) {
      where.OR = [
        { transaksi: { contains: search as string } },
        { detailTransaksi: { contains: search as string } },
      ];
    }

    // Fetch from all three tables
    const [directCosts, indirectCosts, cashTransactions] = await Promise.all([
      prisma.directCost.findMany({
        where,
        include: {
          journalEntry: {
            include: {
              lines: true
            }
          }
        },
        orderBy: { tanggal: 'desc' }
      }),
      prisma.indirectCost.findMany({
        where,
        include: {
          journalEntry: {
            include: {
              lines: true
            }
          }
        },
        orderBy: { tanggal: 'desc' }
      }),
      prisma.cashTransaction.findMany({
        where,
        include: {
          journalEntry: {
            include: {
              lines: true
            }
          }
        },
        orderBy: { tanggal: 'desc' }
      })
    ]);

    // Transform to unified format
    const unified = [
      ...directCosts.map(dc => ({
        ...dc,
        type: 'DIRECT_COST',
        debit: Number(dc.journalEntry?.lines.find(l => Number(l.debit) > 0)?.debit || 0),
        kredit: Number(dc.journalEntry?.lines.find(l => Number(l.kredit) > 0)?.kredit || 0),
      })),
      ...indirectCosts.map(ic => ({
        ...ic,
        type: 'INDIRECT_COST',
        debit: Number(ic.journalEntry?.lines.find(l => Number(l.debit) > 0)?.debit || 0),
        kredit: Number(ic.journalEntry?.lines.find(l => Number(l.kredit) > 0)?.kredit || 0),
      })),
      ...cashTransactions.map(ct => ({
        ...ct,
        type: 'CASH_TRANSACTION',
        debit: Number(ct.journalEntry?.lines.find(l => Number(l.debit) > 0)?.debit || 0),
        kredit: Number(ct.journalEntry?.lines.find(l => Number(l.kredit) > 0)?.kredit || 0),
      }))
    ].sort((a, b) => b.tanggal.getTime() - a.tanggal.getTime());

    res.json(successResponse(unified));
  } catch (error) {
    next(error);
  }
});

// POST /transactions/direct-cost
router.post('/direct-cost', async (req: AuthRequest, res: Response, next) => {
  try {
    const { tanggal, business_unit, transaction_type_id, detail_transaksi, supplier_id, jenis_kas, nominal } = req.body;
    
    if (!tanggal || !business_unit || !transaction_type_id || !nominal) {
      throw errorResponse('Missing required fields');
    }

    // Get transaction type to resolve accounts
    const transactionType = await prisma.transactionType.findUnique({
      where: { id: transaction_type_id }
    });

    if (!transactionType) {
      throw errorResponse('Transaction type not found', 404);
    }

    const result = await prisma.$transaction(async (tx) => {
      // Generate code
      const count = await tx.directCost.count();
      const kode = `BP${String(count + 1).padStart(2, '0')}`;

      // Create direct cost
      const directCost = await tx.directCost.create({
        data: {
          kode,
          tanggal: new Date(tanggal),
          businessUnit: business_unit,
          transaksi: transactionType.namaTransaksi,
          detailTransaksi: detail_transaksi,
          supplierId: supplier_id,
          jenisKas: jenis_kas,
          nominal,
          sumberInput: 'MANUAL',
        }
      });

      // Create journal entry
      const journalEntry = await createFromSource({
        tanggal: new Date(tanggal),
        deskripsi: transactionType.namaTransaksi,
        sumberTabel: 'DIRECT_COST',
        sumberId: directCost.id,
        businessUnit: business_unit,
        dibuatOleh: req.user!.id,
        viaAi: false,
        lines: [
          {
            akunKode: transactionType.akunDebitKode || '51100',
            debit: nominal,
            kredit: 0,
          },
          {
            akunKode: transactionType.akunKreditKode || '21100',
            debit: 0,
            kredit: nominal,
          }
        ]
      });

      // Update direct cost with journal entry ID
      await tx.directCost.update({
        where: { id: directCost.id },
        data: { journalEntryId: journalEntry.id }
      });

      // Update supplier debt if applicable
      if (supplier_id && transactionType.kategori === 'BIAYA_LANGSUNG') {
        await tx.supplier.update({
          where: { id: supplier_id },
          data: {
            saldoHutang: { increment: nominal }
          }
        });
      }

      return directCost;
    });

    await logManualAction(
      req.user!.id,
      'TRANSAKSI',
      'CREATE',
      result.kode,
      `Direct cost created: ${result.transaksi}`,
      'direct_costs',
      result.id
    );

    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

// POST /transactions/indirect-cost
router.post('/indirect-cost', async (req: AuthRequest, res: Response, next) => {
  try {
    const { tanggal, business_unit, transaction_type_id, detail, jenis_kas, nominal } = req.body;
    
    if (!tanggal || !business_unit || !transaction_type_id || !nominal) {
      throw errorResponse('Missing required fields');
    }

    const transactionType = await prisma.transactionType.findUnique({
      where: { id: transaction_type_id }
    });

    if (!transactionType) {
      throw errorResponse('Transaction type not found', 404);
    }

    const result = await prisma.$transaction(async (tx) => {
      const count = await tx.indirectCost.count();
      const kode = `BI${String(count + 1).padStart(2, '0')}`;

      const indirectCost = await tx.indirectCost.create({
        data: {
          kode,
          tanggal: new Date(tanggal),
          businessUnit: business_unit,
          transaksi: transactionType.namaTransaksi,
          detail,
          jenisKas: jenis_kas,
          nominal,
          akunDebitKode: transactionType.akunDebitKode,
          akunKreditKode: transactionType.akunKreditKode,
          sumberInput: 'MANUAL',
        }
      });

      const journalEntry = await createFromSource({
        tanggal: new Date(tanggal),
        deskripsi: transactionType.namaTransaksi,
        sumberTabel: 'INDIRECT_COST',
        sumberId: indirectCost.id,
        businessUnit: business_unit,
        dibuatOleh: req.user!.id,
        viaAi: false,
        lines: [
          {
            akunKode: transactionType.akunDebitKode || '52100',
            debit: nominal,
            kredit: 0,
          },
          {
            akunKode: transactionType.akunKreditKode || '11100',
            debit: 0,
            kredit: nominal,
          }
        ]
      });

      await tx.indirectCost.update({
        where: { id: indirectCost.id },
        data: { journalEntryId: journalEntry.id }
      });

      return indirectCost;
    });

    await logManualAction(
      req.user!.id,
      'TRANSAKSI',
      'CREATE',
      result.kode,
      `Indirect cost created: ${result.transaksi}`,
      'indirect_costs',
      result.id
    );

    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

// POST /transactions/cash
router.post('/cash', async (req: AuthRequest, res: Response, next) => {
  try {
    const { tanggal, business_unit, tipe, transaction_type_id, keterangan, jenis_kas, nominal } = req.body;
    
    if (!tanggal || !business_unit || !tipe || !nominal) {
      throw errorResponse('Missing required fields');
    }

    let transactionType = null;
    if (transaction_type_id) {
      transactionType = await prisma.transactionType.findUnique({
        where: { id: transaction_type_id }
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const count = await tx.cashTransaction.count();
      const kode = `CS${String(count + 1).padStart(2, '0')}`;

      const cashTransaction = await tx.cashTransaction.create({
        data: {
          kode,
          tanggal: new Date(tanggal),
          businessUnit: business_unit,
          tipe,
          transaksi: transactionType?.namaTransaksi || keterangan || 'Cash Transaction',
          keterangan,
          jenisKas: jenis_kas,
          nominal,
          akunDebitKode: transactionType?.akunDebitKode,
          akunKreditKode: transactionType?.akunKreditKode,
          sumberInput: 'MANUAL',
        }
      });

      const debitAccount = tipe === 'CASH_IN' ? '11100' : (transactionType?.akunDebitKode || '52100');
      const creditAccount = tipe === 'CASH_IN' ? (transactionType?.akunKreditKode || '41000') : '11100';

      const journalEntry = await createFromSource({
        tanggal: new Date(tanggal),
        deskripsi: cashTransaction.transaksi,
        sumberTabel: 'CASH_TRANSACTION',
        sumberId: cashTransaction.id,
        businessUnit: business_unit,
        dibuatOleh: req.user!.id,
        viaAi: false,
        lines: [
          {
            akunKode: debitAccount,
            debit: nominal,
            kredit: 0,
          },
          {
            akunKode: creditAccount,
            debit: 0,
            kredit: nominal,
          }
        ]
      });

      await tx.cashTransaction.update({
        where: { id: cashTransaction.id },
        data: { journalEntryId: journalEntry.id }
      });

      return cashTransaction;
    });

    await logManualAction(
      req.user!.id,
      'TRANSAKSI',
      'CREATE',
      result.kode,
      `Cash transaction created: ${result.transaksi}`,
      'cash_transactions',
      result.id
    );

    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

// DELETE /transactions/:sumber_tabel/:id
router.delete('/:sumber_tabel/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { sumber_tabel, id } = req.params;
    const numericId = parseInt(String(id));

    await prisma.$transaction(async (tx) => {
      // Delete journal entry first (cascade will handle lines)
      await deleteBySource(String(sumber_tabel).toUpperCase(), numericId);

      // Delete the source record
      switch (String(sumber_tabel).toUpperCase()) {
        case 'DIRECT_COST':
          await tx.directCost.delete({ where: { id: numericId } });
          break;
        case 'INDIRECT_COST':
          await tx.indirectCost.delete({ where: { id: numericId } });
          break;
        case 'CASH_TRANSACTION':
          await tx.cashTransaction.delete({ where: { id: numericId } });
          break;
        default:
          throw errorResponse('Invalid source table', 400);
      }
    });

    await logManualAction(
      req.user!.id,
      'TRANSAKSI',
      'DELETE',
      `${sumber_tabel}-${id}`,
      `Transaction deleted: ${sumber_tabel} #${id}`,
      String(sumber_tabel),
      numericId
    );

    res.json(successResponse({ message: 'Transaction deleted successfully' }));
  } catch (error) {
    next(error);
  }
});

export default router;