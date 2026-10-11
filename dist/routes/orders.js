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
router.use(auth_1.authenticate);
// Order dikenali lewat jenis bawaan "Pendapatan Frozen"/"Pendapatan Siap Saji"
const ORDER_JENIS_KODE = [jenisBawaan_1.KODE_JENIS_BAWAAN.PENDAPATAN_FROZEN, jenisBawaan_1.KODE_JENIS_BAWAAN.PENDAPATAN_SIAP_SAJI];
async function orderJenisIds() {
    const list = await database_1.default.jenisTransaksi.findMany({
        where: { kode: { in: ORDER_JENIS_KODE } },
        select: { id: true },
    });
    return list.map((j) => j.id);
}
// GET /orders
router.get('/', async (req, res, next) => {
    try {
        const { business_unit, unit_bisnis, tanggal_mulai, tanggal_selesai } = req.query;
        const jenisIds = await orderJenisIds();
        const where = { jenisTransaksiId: { in: jenisIds } };
        const finalUnit = unit_bisnis || business_unit;
        if (finalUnit)
            where.unitBisnis = finalUnit;
        if (tanggal_mulai || tanggal_selesai) {
            where.tanggal = {};
            if (tanggal_mulai)
                where.tanggal.gte = new Date(tanggal_mulai);
            if (tanggal_selesai)
                where.tanggal.lte = new Date(tanggal_selesai);
        }
        const orders = await database_1.default.transaksi.findMany({
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
        res.json((0, response_1.successResponse)(transformed));
    }
    catch (error) {
        next(error);
    }
});
// GET /orders/:id
router.get('/:id', async (req, res, next) => {
    try {
        const id = parseInt(String(req.params.id));
        const jenisIds = await orderJenisIds();
        const order = await database_1.default.transaksi.findFirst({
            where: { id, jenisTransaksiId: { in: jenisIds } },
            include: { jenisTransaksi: true },
        });
        if (!order)
            throw (0, response_1.errorResponse)('Order tidak ditemukan', 404);
        res.json((0, response_1.successResponse)({
            ...order,
            totalInvoice: order.nominal,
            jenisOrder: order.namaTransaksi,
            kodeOrder: order.kode,
        }));
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
