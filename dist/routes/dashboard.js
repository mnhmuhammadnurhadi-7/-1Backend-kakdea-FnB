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
        // Saldo kas: net pemasukan - pengeluaran
        const [pemasukanAgg, pengeluaranAgg] = await Promise.all([
            database_1.default.transaksi.aggregate({
                where: { tanggal: { lte: today }, jenisTransaksi: { arah: 'PEMASUKAN' } },
                _sum: { nominal: true },
            }),
            database_1.default.transaksi.aggregate({
                where: { tanggal: { lte: today }, jenisTransaksi: { arah: 'PENGELUARAN' } },
                _sum: { nominal: true },
            }),
        ]);
        const saldo_kas = Number(pemasukanAgg._sum.nominal || 0) - Number(pengeluaranAgg._sum.nominal || 0);
        // Get order count
        const orderCount = await database_1.default.transaksi.count({
            where: {
                jenisTransaksiId: { in: await orderJenisIds() },
                tanggal: { gte: startDate }
            }
        });
        res.json((0, response_1.successResponse)({
            saldo_kas,
            order_baru: {
                total: orderCount
            }
        }));
    }
    catch (error) {
        next(error);
    }
});
// GET /dashboard/grafik-kas
router.get('/grafik-kas', async (req, res, next) => {
    try {
        const { periode = '7d' } = req.query;
        const allTime = periode === 'semua' || periode === 'all';
        const days = periode === 'bulanan' || periode === '30d' ? 30 : 7;
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const startDate = new Date(today);
        startDate.setUTCDate(startDate.getUTCDate() - days + 1);
        const transactions = await database_1.default.transaksi.findMany({
            where: {
                tanggal: allTime ? { lte: today } : { gte: startDate, lte: today }
            },
            orderBy: [{ tanggal: 'asc' }, { dibuatPada: 'asc' }, { id: 'asc' }],
            select: {
                id: true,
                tanggal: true,
                detail: true,
                namaTransaksi: true,
                nominal: true,
                jenisTransaksi: { select: { arah: true } },
            }
        });
        const entriesByDate = new Map();
        for (const transaction of transactions) {
            const dateKey = transaction.tanggal.toISOString().split('T')[0];
            const entries = entriesByDate.get(dateKey) || [];
            entries.push({
                id: transaction.id,
                detail: transaction.detail || transaction.namaTransaksi,
                jenis: transaction.namaTransaksi,
                arah: transaction.jenisTransaksi.arah,
                nominal: Number(transaction.nominal),
            });
            entriesByDate.set(dateKey, entries);
        }
        const firstDate = allTime
            ? transactions.reduce((first, transaction) => transaction.tanggal < first ? transaction.tanggal : first, transactions[0]?.tanggal || today)
            : startDate;
        const rangeDays = allTime && transactions.length
            ? Math.floor((today.getTime() - firstDate.getTime()) / 86_400_000) + 1
            : allTime ? 0 : days;
        const result = Array.from({ length: rangeDays }, (_, index) => {
            const date = new Date(firstDate);
            date.setUTCDate(firstDate.getUTCDate() + index);
            const tanggal = date.toISOString().split('T')[0];
            const entries = entriesByDate.get(tanggal) || [];
            return {
                tanggal,
                pemasukan: entries.filter((entry) => entry.arah === 'PEMASUKAN').reduce((sum, entry) => sum + entry.nominal, 0),
                pengeluaran: entries.filter((entry) => entry.arah === 'PENGELUARAN').reduce((sum, entry) => sum + entry.nominal, 0),
                transaksi: entries,
            };
        });
        res.json((0, response_1.successResponse)(result));
    }
    catch (error) {
        next(error);
    }
});
// GET /dashboard/sumber-input
router.get('/sumber-input', async (req, res, next) => {
    try {
        const days = req.query.periode === '7d' ? 7 : 30;
        const end = new Date();
        end.setUTCHours(0, 0, 0, 0);
        const start = new Date(end);
        start.setUTCDate(start.getUTCDate() - days + 1);
        const grouped = await database_1.default.transaksi.groupBy({
            by: ['sumberInput'],
            where: { tanggal: { gte: start, lte: end } },
            _count: { _all: true },
        });
        const ai = grouped.find((row) => row.sumberInput === 'AI')?._count._all || 0;
        const manual = grouped.find((row) => row.sumberInput === 'MANUAL')?._count._all || 0;
        const total = ai + manual;
        res.json((0, response_1.successResponse)({
            ai,
            manual,
            total,
            aiPersen: total ? Math.round((ai / total) * 100) : 0,
            manualPersen: total ? 100 - Math.round((ai / total) * 100) : 0,
        }));
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
// GET /dashboard/pemasukan-pengeluaran
router.get('/pemasukan-pengeluaran', async (req, res, next) => {
    try {
        const { periode = '30d' } = req.query;
        const today = new Date();
        const startDate = new Date();
        if (periode === '7d')
            startDate.setDate(today.getDate() - 7);
        else if (periode === '30d')
            startDate.setDate(today.getDate() - 30);
        else
            startDate.setDate(today.getDate() - 90);
        const transactions = await database_1.default.transaksi.findMany({
            where: { tanggal: { gte: startDate, lte: today } },
            select: { tanggal: true, nominal: true, jenisTransaksi: { select: { arah: true } } },
        });
        const dailyData = {};
        for (const t of transactions) {
            const key = t.tanggal.toISOString().split('T')[0];
            if (!dailyData[key])
                dailyData[key] = { pemasukan: 0, pengeluaran: 0 };
            if (t.jenisTransaksi.arah === 'PEMASUKAN') {
                dailyData[key].pemasukan += Number(t.nominal);
            }
            else {
                dailyData[key].pengeluaran += Number(t.nominal);
            }
        }
        const result = Object.entries(dailyData)
            .map(([tanggal, data]) => ({ tanggal, ...data }))
            .sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());
        const totalPemasukan = result.reduce((s, r) => s + r.pemasukan, 0);
        const totalPengeluaran = result.reduce((s, r) => s + r.pengeluaran, 0);
        res.json((0, response_1.successResponse)({
            daily: result,
            totals: {
                pemasukan: totalPemasukan,
                pengeluaran: totalPengeluaran,
                laba: totalPemasukan - totalPengeluaran,
            },
        }));
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
