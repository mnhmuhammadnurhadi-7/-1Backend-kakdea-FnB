"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const response_1 = require("../utils/response");
const database_1 = __importDefault(require("../utils/database"));
const jenisBawaan_1 = require("../utils/jenisBawaan");
const router = (0, express_1.Router)();
// Tidak di-cache secara sengaja: jenis bawaan ini full-CRUD oleh user,
// jadi ID-nya bisa berubah kapan saja - selalu query ulang.
async function orderJenisIds() {
    const list = await database_1.default.jenisTransaksi.findMany({
        where: { kode: { in: [jenisBawaan_1.KODE_JENIS_BAWAAN.PENDAPATAN_FROZEN, jenisBawaan_1.KODE_JENIS_BAWAAN.PENDAPATAN_SIAP_SAJI] } },
        select: { id: true },
    });
    return list.map((j) => j.id);
}
router.use(auth_1.authenticate);
// GET /dashboard/summary
router.get('/summary', async (req, res, next) => {
    try {
        const { periode = '7d' } = req.query;
        // Calculate date range
        const today = new Date();
        let startDate = new Date();
        if (periode === 'today') {
            startDate = today;
        }
        else if (periode === '7d') {
            startDate.setDate(today.getDate() - 7);
        }
        else if (periode === '30d') {
            startDate.setDate(today.getDate() - 30);
        }
        // Get cash balance (account 11100 - Kas Utama)
        const cashBalance = await database_1.default.jurnalEntriBaris.aggregate({
            where: {
                akunKode: '11100',
                jurnalEntri: {
                    tanggal: { lte: today }
                }
            },
            _sum: {
                debit: true,
                kredit: true
            }
        });
        const saldo_kas = Number(cashBalance._sum.debit || 0) - Number(cashBalance._sum.kredit || 0);
        // Get accounts receivable
        const customersWithDebt = await database_1.default.dataPelanggan.findMany({
            where: { saldoPiutang: { gt: 0 } }
        });
        const piutang_customer = {
            total: customersWithDebt.reduce((sum, c) => sum + Number(c.saldoPiutang), 0),
            jumlah_customer: customersWithDebt.length
        };
        // Get accounts payable
        const suppliersWithDebt = await database_1.default.dataPemasok.findMany({
            where: { saldoHutang: { gt: 0 } }
        });
        const hutang_supplier = {
            total: suppliersWithDebt.reduce((sum, s) => sum + Number(s.saldoHutang), 0)
        };
        // Get new orders
        const newOrders = await database_1.default.transaksi.findMany({
            where: {
                jenisTransaksiId: { in: await orderJenisIds() },
                tanggal: { gte: startDate }
            }
        });
        const orderBreakdown = newOrders.reduce((acc, order) => {
            const src = order.sumberOrder || 'LAIN';
            acc[src] = (acc[src] || 0) + 1;
            return acc;
        }, {});
        res.json((0, response_1.successResponse)({
            saldo_kas,
            piutang_customer,
            hutang_supplier,
            order_baru: {
                total: newOrders.length,
                breakdown: orderBreakdown
            }
        }));
    }
    catch (error) {
        next(error);
    }
});
// GET /dashboard/tren-penjualan
router.get('/tren-penjualan', async (req, res, next) => {
    try {
        const { periode = '7d' } = req.query;
        const today = new Date();
        let startDate = new Date();
        if (periode === '7d') {
            startDate.setDate(today.getDate() - 7);
        }
        else if (periode === '30d') {
            startDate.setDate(today.getDate() - 30);
        }
        const orders = await database_1.default.transaksi.findMany({
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
        }, {});
        const result = Object.values(trendData).sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());
        res.json((0, response_1.successResponse)(result));
    }
    catch (error) {
        next(error);
    }
});
// GET /dashboard/peringatan-stok (parked)
router.get('/peringatan-stok', async (req, res) => {
    res.json((0, response_1.successResponse)([]));
});
// GET /dashboard/aktivitas-terbaru
router.get('/aktivitas-terbaru', async (req, res, next) => {
    try {
        const { limit = 10 } = req.query;
        const activities = await database_1.default.logAudit.findMany({
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
        res.json((0, response_1.successResponse)(transformed));
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
