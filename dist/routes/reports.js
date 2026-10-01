"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const response_1 = require("../utils/response");
const database_1 = __importDefault(require("../utils/database"));
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// GET /reports/neraca
router.get('/neraca', async (req, res, next) => {
    try {
        const { tanggal, business_unit, unit_bisnis } = req.query;
        const reportDate = tanggal ? new Date(tanggal) : new Date();
        const finalUnit = unit_bisnis || business_unit;
        const where = {
            jurnalEntri: {
                tanggal: { lte: reportDate }
            }
        };
        if (finalUnit) {
            where.jurnalEntri.unitBisnis = finalUnit;
        }
        // Get all account balances
        const accountBalances = await database_1.default.jurnalEntriBaris.groupBy({
            by: ['akunKode'],
            where,
            _sum: {
                debit: true,
                kredit: true
            }
        });
        // Get account details
        const accounts = await database_1.default.jenisAkun.findMany({
            where: { aktif: true }
        });
        // Calculate balances
        const balanceSheet = accounts.map(account => {
            const balance = accountBalances.find(b => b.akunKode === account.kodeAkun);
            const debit = Number(balance?._sum.debit || 0);
            const kredit = Number(balance?._sum.kredit || 0);
            let netBalance = 0;
            if (account.saldoNormal === 'DEBIT') {
                netBalance = debit - kredit;
            }
            else {
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
        }, {});
        res.json((0, response_1.successResponse)(grouped));
    }
    catch (error) {
        next(error);
    }
});
// GET /reports/laba-rugi
router.get('/laba-rugi', async (req, res, next) => {
    try {
        const { tanggal_mulai, tanggal_selesai, business_unit, unit_bisnis } = req.query;
        const startDate = tanggal_mulai ? new Date(tanggal_mulai) : new Date(new Date().setDate(new Date().getDate() - 30));
        const endDate = tanggal_selesai ? new Date(tanggal_selesai) : new Date();
        const finalUnit = unit_bisnis || business_unit;
        const where = {
            jurnalEntri: {
                tanggal: { gte: startDate, lte: endDate }
            }
        };
        if (finalUnit) {
            where.jurnalEntri.unitBisnis = finalUnit;
        }
        // Get revenue and expense accounts
        const accountBalances = await database_1.default.jurnalEntriBaris.groupBy({
            by: ['akunKode'],
            where,
            _sum: {
                debit: true,
                kredit: true
            }
        });
        const accounts = await database_1.default.jenisAkun.findMany({
            where: {
                aktif: true,
                tipeAkun: { in: ['PENDAPATAN', 'BIAYA_LANGSUNG', 'BIAYA_TIDAK_LANGSUNG', 'NON_OPERASIONAL'] }
            }
        });
        const incomeStatement = accounts.map(account => {
            const balance = accountBalances.find(b => b.akunKode === account.kodeAkun);
            const debit = Number(balance?._sum.debit || 0);
            const kredit = Number(balance?._sum.kredit || 0);
            let amount = 0;
            if (account.saldoNormal === 'KREDIT') {
                amount = kredit - debit; // Revenue
            }
            else {
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
        }, {});
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
        res.json((0, response_1.successResponse)({
            grouped,
            totals: {
                ...totals,
                laba_kotor,
                laba_operasional,
                laba_bersih
            }
        }));
    }
    catch (error) {
        next(error);
    }
});
// GET /reports/perubahan-modal
router.get('/perubahan-modal', async (req, res, next) => {
    try {
        const { business_unit, unit_bisnis } = req.query;
        // For simplicity, using current month as period
        const today = new Date();
        const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        const finalUnit = unit_bisnis || business_unit;
        const where = {
            jurnalEntri: {
                tanggal: { gte: startDate, lte: endDate }
            }
        };
        if (finalUnit) {
            where.jurnalEntri.unitBisnis = finalUnit;
        }
        // Get equity accounts
        const accountBalances = await database_1.default.jurnalEntriBaris.groupBy({
            by: ['akunKode'],
            where,
            _sum: {
                debit: true,
                kredit: true
            }
        });
        const accounts = await database_1.default.jenisAkun.findMany({
            where: {
                aktif: true,
                tipeAkun: 'MODAL'
            }
        });
        const equityChanges = accounts.map(account => {
            const balance = accountBalances.find(b => b.akunKode === account.kodeAkun);
            const debit = Number(balance?._sum.debit || 0);
            const kredit = Number(balance?._sum.kredit || 0);
            let amount = 0;
            if (account.saldoNormal === 'KREDIT') {
                amount = kredit - debit;
            }
            else {
                amount = debit - kredit;
            }
            return {
                kode_akun: account.kodeAkun,
                nama_akun: account.namaAkun,
                perubahan: amount,
            };
        });
        res.json((0, response_1.successResponse)(equityChanges));
    }
    catch (error) {
        next(error);
    }
});
// GET /reports/export (placeholder for Excel export)
router.get('/export', async (req, res, next) => {
    try {
        const { type, format } = req.query;
        res.json((0, response_1.successResponse)({
            message: 'Export functionality - generates Excel file',
            type,
            format,
        }));
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
