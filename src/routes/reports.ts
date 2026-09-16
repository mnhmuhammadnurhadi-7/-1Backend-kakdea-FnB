import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { successResponse } from '../utils/response';
import prisma from '../utils/database';

const router = Router();

router.use(authenticate);

// GET /reports/neraca
router.get('/neraca', async (req: AuthRequest, res: Response, next) => {
  try {
    const { tanggal, business_unit } = req.query;
    
    const reportDate = tanggal ? new Date(tanggal as string) : new Date();
    
    const where: any = {
      journalEntry: {
        tanggal: { lte: reportDate }
      }
    };
    
    if (business_unit) {
      where.journalEntry.businessUnit = business_unit;
    }

    // Get all account balances
    const accountBalances = await prisma.journalEntryLine.groupBy({
      by: ['akunKode'],
      where,
      _sum: {
        debit: true,
        kredit: true
      }
    });

    // Get account details
    const accounts = await prisma.chartOfAccount.findMany({
      where: { isActive: true }
    });

    // Calculate balances
    const balanceSheet = accounts.map(account => {
      const balance = accountBalances.find(b => b.akunKode === account.kodeAkun);
      const debit = Number(balance?._sum.debit || 0);
      const kredit = Number(balance?._sum.kredit || 0);
      
      let netBalance = 0;
      if (account.normalBalance === 'DEBIT') {
        netBalance = debit - kredit;
      } else {
        netBalance = kredit - debit;
      }

      return {
        kode_akun: account.kodeAkun,
        nama_akun: account.namaAkun,
        tipe_akun: account.tipeAkun,
        saldo: netBalance,
      };
    });

    // Group by account type
    const grouped = balanceSheet.reduce((acc, account) => {
      if (!acc[account.tipe_akun]) {
        acc[account.tipe_akun] = [];
      }
      acc[account.tipe_akun].push(account);
      return acc;
    }, {} as Record<string, any[]>);

    res.json(successResponse(grouped));
  } catch (error) {
    next(error);
  }
});

// GET /reports/laba-rugi
router.get('/laba-rugi', async (req: AuthRequest, res: Response, next) => {
  try {
    const { tanggal_mulai, tanggal_selesai, business_unit } = req.query;
    
    const startDate = tanggal_mulai ? new Date(tanggal_mulai as string) : new Date(new Date().setDate(new Date().getDate() - 30));
    const endDate = tanggal_selesai ? new Date(tanggal_selesai as string) : new Date();
    
    const where: any = {
      journalEntry: {
        tanggal: { gte: startDate, lte: endDate }
      }
    };
    
    if (business_unit) {
      where.journalEntry.businessUnit = business_unit;
    }

    // Get revenue and expense accounts
    const accountBalances = await prisma.journalEntryLine.groupBy({
      by: ['akunKode'],
      where,
      _sum: {
        debit: true,
        kredit: true
      }
    });

    const accounts = await prisma.chartOfAccount.findMany({
      where: {
        isActive: true,
        tipeAkun: { in: ['PENDAPATAN', 'BIAYA_LANGSUNG', 'BIAYA_TIDAK_LANGSUNG', 'NON_OPERASIONAL'] }
      }
    });

    const incomeStatement = accounts.map(account => {
      const balance = accountBalances.find(b => b.akunKode === account.kodeAkun);
      const debit = Number(balance?._sum.debit || 0);
      const kredit = Number(balance?._sum.kredit || 0);
      
      let amount = 0;
      if (account.normalBalance === 'KREDIT') {
        amount = kredit - debit; // Revenue
      } else {
        amount = debit - kredit; // Expense
      }

      return {
        kode_akun: account.kodeAkun,
        nama_akun: account.namaAkun,
        tipe_akun: account.tipeAkun,
        jumlah: amount,
      };
    });

    // Group by account type
    const grouped = incomeStatement.reduce((acc, account) => {
      if (!acc[account.tipe_akun]) {
        acc[account.tipe_akun] = [];
      }
      acc[account.tipe_akun].push(account);
      return acc;
    }, {} as Record<string, any[]>);

    // Calculate totals
    const totals = {
      pendapatan_usaha: grouped['PENDAPATAN']?.reduce((sum, a) => sum + a.jumlah, 0) || 0,
      biaya_langsung: grouped['BIAYA_LANGSUNG']?.reduce((sum, a) => sum + a.jumlah, 0) || 0,
      biaya_tidak_langsung: grouped['BIAYA_TIDAK_LANGSUNG']?.reduce((sum, a) => sum + a.jumlah, 0) || 0,
      non_operasional: grouped['NON_OPERASIONAL']?.reduce((sum, a) => sum + a.jumlah, 0) || 0,
    };

    const laba_kotor = totals.pendapatan_usaha - totals.biaya_langsung;
    const laba_operasional = laba_kotor - totals.biaya_tidak_langsung;
    const laba_bersih = laba_operasional + totals.non_operasional;

    res.json(successResponse({
      grouped,
      totals: {
        ...totals,
        laba_kotor,
        laba_operasional,
        laba_bersih
      }
    }));
  } catch (error) {
    next(error);
  }
});

// GET /reports/perubahan-modal
router.get('/perubahan-modal', async (req: AuthRequest, res: Response, next) => {
  try {
    const { periode, business_unit } = req.query;
    
    // For simplicity, using current month as period
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    const where: any = {
      journalEntry: {
        tanggal: { gte: startDate, lte: endDate }
      }
    };
    
    if (business_unit) {
      where.journalEntry.businessUnit = business_unit;
    }

    // Get equity accounts
    const accountBalances = await prisma.journalEntryLine.groupBy({
      by: ['akunKode'],
      where,
      _sum: {
        debit: true,
        kredit: true
      }
    });

    const accounts = await prisma.chartOfAccount.findMany({
      where: {
        isActive: true,
        tipeAkun: 'MODAL'
      }
    });

    const equityChanges = accounts.map(account => {
      const balance = accountBalances.find(b => b.akunKode === account.kodeAkun);
      const debit = Number(balance?._sum.debit || 0);
      const kredit = Number(balance?._sum.kredit || 0);
      
      let amount = 0;
      if (account.normalBalance === 'KREDIT') {
        amount = kredit - debit;
      } else {
        amount = debit - kredit;
      }

      return {
        kode_akun: account.kodeAkun,
        nama_akun: account.namaAkun,
        perubahan: amount,
      };
    });

    res.json(successResponse(equityChanges));
  } catch (error) {
    next(error);
  }
});

// GET /reports/export (placeholder for Excel export)
router.get('/export', async (req: AuthRequest, res: Response, next) => {
  try {
    const { type, format } = req.query;
    
    // This is a placeholder - actual Excel export would require additional libraries
    res.json(successResponse({
      message: 'Export functionality - would generate Excel file',
      type,
      format,
      note: 'Implement with exceljs or similar library'
    }));
  } catch (error) {
    next(error);
  }
});

export default router;