"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const response_1 = require("../utils/response");
const database_1 = __importDefault(require("../utils/database"));
const auditLogService_1 = require("../services/auditLogService");
const journalService_1 = require("../services/journalService");
const client_1 = require("@prisma/client");
const jenisBawaan_1 = require("../utils/jenisBawaan");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// Order dulu dikenali lewat `tipe: TipeTransaksi.DATA_ORDER` (enum tetap).
// Sekarang order adalah entri biasa di bawah jenis bawaan "Pendapatan
// Frozen" / "Pendapatan Siap Saji" (lihat prisma/seed.ts) - keduanya
// dibedakan dari transaksi lain oleh field `sumberOrder` yang wajib diisi.
// Filter di bawah ini mencari SEMUA transaksi yang punya sumberOrder
// (bukan null) sebagai pengganti filter tipe lama.
const ORDER_JENIS_KODE = [jenisBawaan_1.KODE_JENIS_BAWAAN.PENDAPATAN_FROZEN, jenisBawaan_1.KODE_JENIS_BAWAAN.PENDAPATAN_SIAP_SAJI];
async function orderJenisIds() {
    const list = await database_1.default.jenisTransaksi.findMany({
        where: { kode: { in: ORDER_JENIS_KODE } },
        select: { id: true },
    });
    return list.map((j) => j.id);
}
async function generateOrderKode(tx) {
    const rows = await tx.$queryRaw `
    SELECT MAX(CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(kode, '-', 1), 'JO', -1) AS UNSIGNED)) as maxNum
    FROM transaksi WHERE kode LIKE 'JO%'
  `;
    const next = (Number(rows[0]?.maxNum) || 0) + 1;
    return `JO${String(next).padStart(3, '0')}-${Date.now().toString().slice(-5)}`;
}
// GET /orders
router.get('/', async (req, res, next) => {
    try {
        const { business_unit, unit_bisnis, jenis_order, customer_id, pelanggan_id, tanggal_mulai, tanggal_selesai } = req.query;
        const jenisIds = await orderJenisIds();
        const where = { jenisTransaksiId: { in: jenisIds } };
        const finalUnit = unit_bisnis || business_unit;
        if (finalUnit)
            where.unitBisnis = finalUnit;
        if (jenis_order)
            where.sumberOrder = jenis_order;
        const cId = pelanggan_id || customer_id;
        if (cId)
            where.pelangganId = parseInt(cId);
        if (tanggal_mulai || tanggal_selesai) {
            where.tanggal = {};
            if (tanggal_mulai)
                where.tanggal.gte = new Date(tanggal_mulai);
            if (tanggal_selesai)
                where.tanggal.lte = new Date(tanggal_selesai);
        }
        const orders = await database_1.default.transaksi.findMany({
            where,
            include: { pelanggan: true, produk: true, jurnalEntri: { include: { baris: true } } },
            orderBy: { tanggal: 'desc' },
        });
        const transformed = orders.map((o) => ({
            ...o,
            total_invoice: o.nominal,
            totalInvoice: o.nominal,
            jumlah_pesan: o.jumlah,
            jumlahPesan: o.jumlah,
            harga_satuan: o.hargaSatuan,
            hargaSatuan: o.hargaSatuan,
            jumlah_bayar: o.jumlahBayar,
            jumlahBayar: o.jumlahBayar,
            sisa_piutang: o.sisaPiutang,
            sisaPiutang: o.sisaPiutang,
            jenis_order: o.sumberOrder,
            jenisOrder: o.sumberOrder,
            customer: o.pelanggan,
            product: o.produk,
            kode_order: o.kode,
            kodeOrder: o.kode,
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
            include: { pelanggan: true, produk: true, jurnalEntri: { include: { baris: true } } },
        });
        if (!order)
            throw (0, response_1.errorResponse)('Order tidak ditemukan', 404);
        const transformed = {
            ...order,
            total_invoice: order.nominal,
            totalInvoice: order.nominal,
            jumlah_pesan: order.jumlah,
            jumlahPesan: order.jumlah,
            harga_satuan: order.hargaSatuan,
            hargaSatuan: order.hargaSatuan,
            jumlah_bayar: order.jumlahBayar,
            jumlahBayar: order.jumlahBayar,
            sisa_piutang: order.sisaPiutang,
            sisaPiutang: order.sisaPiutang,
            jenis_order: order.sumberOrder,
            jenisOrder: order.sumberOrder,
            customer: order.pelanggan,
            product: order.produk,
            kode_order: order.kode,
            kodeOrder: order.kode,
        };
        res.json((0, response_1.successResponse)(transformed));
    }
    catch (error) {
        next(error);
    }
});
// POST /orders
router.post('/', async (req, res, next) => {
    try {
        const { tanggal, business_unit, unit_bisnis, jenis_order, sumber_order, sumberOrder, customer_id, pelanggan_id, pelangganId, product_id, produk_id, produkId, keterangan, detail, jumlah_pesan, jumlah, harga_satuan, hargaSatuan, jumlah_bayar, jumlahBayar, jenis_kas, jenisKas, } = req.body;
        const finalUnit = unit_bisnis || business_unit || 'DISTRIBUTOR';
        const finalOrderSrc = sumberOrder || sumber_order || jenis_order || 'FROZEN';
        const finalPrdId = produkId ?? produk_id ?? product_id;
        const finalCustId = pelangganId ?? pelanggan_id ?? customer_id;
        const qty = Number(jumlah ?? jumlah_pesan);
        const unitPrice = Number(hargaSatuan ?? harga_satuan);
        if (!tanggal || !finalPrdId || !qty || !unitPrice) {
            throw (0, response_1.errorResponse)('Field wajib: tanggal, product_id, jumlah_pesan, harga_satuan');
        }
        const totalInvoice = qty * unitPrice;
        const paidAmount = Number(jumlahBayar ?? jumlah_bayar ?? 0);
        const sisaPiutang = Math.max(0, totalInvoice - paidAmount);
        const product = await database_1.default.produk.findUnique({ where: { id: parseInt(String(finalPrdId)) } });
        if (!product)
            throw (0, response_1.errorResponse)('Produk tidak ditemukan', 404);
        // Order Frozen vs Siap Saji dipilih dari jenis bawaan - fallback ke
        // Frozen kalau sumber order tidak match keduanya secara eksplisit
        const jenisKode = (finalOrderSrc || '').toUpperCase().includes('SIAP') || (finalOrderSrc || '').toUpperCase() === 'WA' || (finalOrderSrc || '').toUpperCase() === 'IG'
            ? jenisBawaan_1.KODE_JENIS_BAWAAN.PENDAPATAN_SIAP_SAJI
            : jenisBawaan_1.KODE_JENIS_BAWAAN.PENDAPATAN_FROZEN;
        const jenisTrx = await (0, jenisBawaan_1.getJenisBawaan)(jenisKode);
        const debitAccount = paidAmount >= totalInvoice ? '11100' : '11210'; // Kas Utama kalau lunas, Piutang Usaha kalau belum
        const result = await database_1.default.$transaction(async (tx) => {
            const kode = await generateOrderKode(tx);
            const journalEntry = await (0, journalService_1.createJournalEntry)(tx, {
                tanggal: new Date(tanggal),
                deskripsi: `Order ${kode} - ${product.namaBarang}`,
                unitBisnis: finalUnit,
                dibuatOleh: req.user.id,
                viaAi: false,
                baris: [
                    { akunKode: debitAccount, debit: totalInvoice, kredit: 0 },
                    { akunKode: jenisTrx.akunKreditKode, debit: 0, kredit: totalInvoice },
                ],
            });
            const order = await tx.transaksi.create({
                data: {
                    kode,
                    tanggal: new Date(tanggal),
                    unitBisnis: finalUnit,
                    jenisTransaksiId: jenisTrx.id,
                    namaTransaksi: jenisTrx.namaTransaksi,
                    detail: detail || keterangan || `Pesanan ${product.namaBarang} x${qty}`,
                    jenisKas: jenisKas || jenis_kas || 'Kas Utama',
                    nominal: totalInvoice,
                    akunDebitKode: debitAccount,
                    akunKreditKode: jenisTrx.akunKreditKode,
                    pelangganId: finalCustId ? parseInt(String(finalCustId)) : null,
                    produkId: product.id,
                    jumlah: qty,
                    hargaSatuan: unitPrice,
                    jumlahBayar: paidAmount,
                    sisaPiutang,
                    sumberOrder: finalOrderSrc,
                    jurnalEntriId: journalEntry.id,
                    sumberInput: client_1.SumberInput.MANUAL,
                    dibuatOleh: req.user.id,
                },
            });
            if (finalCustId && sisaPiutang > 0) {
                await tx.dataPelanggan.update({
                    where: { id: parseInt(String(finalCustId)) },
                    data: { saldoPiutang: { increment: sisaPiutang } },
                });
            }
            return order;
        });
        await (0, auditLogService_1.logManualAction)(req.user.id, 'transaksi', client_1.AksiLog.TAMBAH, result.kode, `Order dibuat: ${result.kode}`, result.id);
        res.json((0, response_1.successResponse)(result));
    }
    catch (error) {
        next(error);
    }
});
// PUT /orders/:id (update pembayaran)
router.put('/:id', async (req, res, next) => {
    try {
        const id = parseInt(String(req.params.id));
        const { jumlah_bayar, jumlahBayar } = req.body;
        const paidInput = jumlahBayar ?? jumlah_bayar;
        if (paidInput === undefined)
            throw (0, response_1.errorResponse)('jumlahBayar (jumlah_bayar) wajib diisi');
        const jenisIds = await orderJenisIds();
        const result = await database_1.default.$transaction(async (tx) => {
            const existingOrder = await tx.transaksi.findFirst({
                where: { id, jenisTransaksiId: { in: jenisIds } },
                include: { pelanggan: true },
            });
            if (!existingOrder)
                throw (0, response_1.errorResponse)('Order tidak ditemukan', 404);
            const totalInvoice = Number(existingOrder.nominal);
            const newPaid = Number(paidInput);
            const paymentIncrease = newPaid - Number(existingOrder.jumlahBayar || 0);
            const newSisaPiutang = Math.max(0, totalInvoice - newPaid);
            const updatedOrder = await tx.transaksi.update({
                where: { id },
                data: { jumlahBayar: newPaid, sisaPiutang: newSisaPiutang },
            });
            if (existingOrder.pelangganId && paymentIncrease !== 0) {
                await tx.dataPelanggan.update({
                    where: { id: existingOrder.pelangganId },
                    data: { saldoPiutang: { decrement: paymentIncrease } },
                });
            }
            return updatedOrder;
        });
        await (0, auditLogService_1.logManualAction)(req.user.id, 'transaksi', client_1.AksiLog.UBAH, result.kode, `Pembayaran order diubah: ${result.kode}`, result.id, {}, { jumlahBayar: paidInput });
        res.json((0, response_1.successResponse)(result));
    }
    catch (error) {
        next(error);
    }
});
// DELETE /orders/:id
router.delete('/:id', async (req, res, next) => {
    try {
        const id = parseInt(String(req.params.id));
        const jenisIds = await orderJenisIds();
        const order = await database_1.default.transaksi.findFirst({
            where: { id, jenisTransaksiId: { in: jenisIds } },
            include: { pelanggan: true, produk: true },
        });
        if (!order)
            throw (0, response_1.errorResponse)('Order tidak ditemukan', 404);
        await database_1.default.$transaction(async (tx) => {
            if (order.jurnalEntriId) {
                await tx.jurnalEntri.delete({ where: { id: order.jurnalEntriId } });
            }
            if (order.pelangganId && Number(order.sisaPiutang) > 0) {
                await tx.dataPelanggan.update({
                    where: { id: order.pelangganId },
                    data: { saldoPiutang: { decrement: Number(order.sisaPiutang) } },
                });
            }
            await tx.transaksi.delete({ where: { id } });
        });
        await (0, auditLogService_1.logManualAction)(req.user.id, 'transaksi', client_1.AksiLog.HAPUS, order.kode, `Order dihapus: ${order.kode}`, order.id);
        res.json((0, response_1.successResponse)({ message: 'Order berhasil dihapus' }));
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
