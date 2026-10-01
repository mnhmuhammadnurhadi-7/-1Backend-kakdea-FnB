"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const response_1 = require("../utils/response");
const database_1 = __importDefault(require("../utils/database"));
const journalService_1 = require("../services/journalService");
const auditLogService_1 = require("../services/auditLogService");
const client_1 = require("@prisma/client");
const jenisBawaan_1 = require("../utils/jenisBawaan");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// GET /debts
router.get('/', async (req, res, next) => {
    try {
        const debts = await database_1.default.hutang.findMany({
            include: { transaksi: { orderBy: { tanggal: 'desc' } } },
            orderBy: { dibuatPada: 'desc' },
        });
        res.json((0, response_1.successResponse)(debts));
    }
    catch (error) {
        next(error);
    }
});
// GET /debts/:id/payments
router.get('/:id/payments', async (req, res, next) => {
    try {
        const debtId = parseInt(String(req.params.id));
        const payments = await database_1.default.transaksi.findMany({
            where: { hutangId: debtId },
            orderBy: { tanggal: 'desc' },
        });
        res.json((0, response_1.successResponse)(payments));
    }
    catch (error) {
        next(error);
    }
});
// POST /debts
router.post('/', async (req, res, next) => {
    try {
        const { nama_kreditur, namaKreditur, jaminan, jumlah_pinjaman, jumlahPinjaman, tanggal_mulai, tanggalMulai } = req.body;
        const finalKreditur = namaKreditur || nama_kreditur;
        const finalJumlah = jumlahPinjaman ?? jumlah_pinjaman;
        if (!finalKreditur || !finalJumlah) {
            throw (0, response_1.errorResponse)('namaKreditur (nama_kreditur) dan jumlahPinjaman (jumlah_pinjaman) wajib diisi');
        }
        const debt = await database_1.default.hutang.create({
            data: {
                namaKreditur: finalKreditur,
                jaminan,
                jumlahPinjaman: finalJumlah,
                tanggalMulai: (tanggalMulai || tanggal_mulai) ? new Date(tanggalMulai || tanggal_mulai) : null,
                sisaHutang: finalJumlah,
            },
        });
        await (0, auditLogService_1.logManualAction)(req.user.id, 'hutang', client_1.AksiLog.TAMBAH, debt.namaKreditur, `Hutang baru: ${debt.namaKreditur}`, debt.id);
        res.json((0, response_1.successResponse)(debt));
    }
    catch (error) {
        next(error);
    }
});
// POST /debts/:id/payments
router.post('/:id/payments', async (req, res, next) => {
    try {
        const debtId = parseInt(String(req.params.id));
        const { periode, jumlah_bayar, nominal, tanggal, detail, jenisKas, jenis_kas } = req.body;
        const amount = Number(nominal ?? jumlah_bayar);
        if (!amount || amount <= 0) {
            throw (0, response_1.errorResponse)('nominal (jumlah_bayar) wajib diisi dan harus > 0');
        }
        const hutang = await database_1.default.hutang.findUnique({ where: { id: debtId } });
        if (!hutang)
            throw (0, response_1.errorResponse)('Hutang tidak ditemukan', 404);
        const payDate = tanggal ? new Date(tanggal) : new Date();
        const cashType = jenisKas || jenis_kas || 'Kas Utama';
        // Dulu dicari via `tipe: MUTASI, namaTransaksi: 'Pembayaran Cicilan
        // Hutang'`. Sekarang jenis ini adalah jenis bawaan (kode MT1, di-seed
        // di prisma/seed.ts, tetap full-CRUD oleh user seperti jenis lain).
        const jenisTrx = await (0, jenisBawaan_1.getJenisBawaan)(jenisBawaan_1.KODE_JENIS_BAWAAN.PEMBAYARAN_CICILAN_HUTANG);
        const result = await database_1.default.$transaction(async (tx) => {
            const journalEntry = await (0, journalService_1.createJournalEntry)(tx, {
                tanggal: payDate,
                deskripsi: `Pembayaran Cicilan Hutang ${hutang.namaKreditur}${periode ? ` - ${periode}` : ''}`,
                unitBisnis: 'PABRIK',
                dibuatOleh: req.user.id,
                viaAi: false,
                baris: [
                    { akunKode: jenisTrx.akunDebitKode, debit: amount, kredit: 0 }, // Hutang berkurang (Debit)
                    { akunKode: jenisTrx.akunKreditKode, debit: 0, kredit: amount }, // Kas berkurang (Kredit)
                ],
            });
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
                    akunDebitKode: jenisTrx.akunDebitKode,
                    akunKreditKode: jenisTrx.akunKreditKode,
                    hutangId: debtId,
                    jurnalEntriId: journalEntry.id,
                    sumberInput: client_1.SumberInput.MANUAL,
                    dibuatOleh: req.user.id,
                },
            });
            const newSisa = Math.max(0, Number(hutang.sisaHutang) - amount);
            await tx.hutang.update({ where: { id: debtId }, data: { sisaHutang: newSisa } });
            return trx;
        });
        await (0, auditLogService_1.logManualAction)(req.user.id, 'transaksi', client_1.AksiLog.TAMBAH, result.kode, `Pembayaran hutang dicatat: ${hutang.namaKreditur} Rp ${amount}`, result.id);
        res.json((0, response_1.successResponse)(result));
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
