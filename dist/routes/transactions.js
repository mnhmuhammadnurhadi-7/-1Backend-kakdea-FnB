"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEntriTransaksi = createEntriTransaksi;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const response_1 = require("../utils/response");
const database_1 = __importDefault(require("../utils/database"));
const journalService_1 = require("../services/journalService");
const auditLogService_1 = require("../services/auditLogService");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// Generate kode transaksi yang atomic & aman untuk concurrent request:
// pakai MAX(id) dalam prefix kode jenis, bukan count() (yang bisa
// collide kalau ada row yang sudah dihapus - bug lama yang diperbaiki
// di sini).
async function generateKodeTransaksi(tx, prefixKode) {
    const rows = await tx.$queryRaw `
    SELECT MAX(CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(kode, '-', 1), ${prefixKode}, -1) AS UNSIGNED)) as maxNum
    FROM transaksi
    WHERE kode LIKE ${prefixKode + '%'}
  `;
    const next = (Number(rows[0]?.maxNum) || 0) + 1;
    return `${prefixKode}${String(next).padStart(3, '0')}-${Date.now().toString().slice(-5)}`;
}
/**
 * Pembuat entri transaksi generik - dipakai oleh endpoint POST / di file
 * ini, DAN oleh orders.ts / debts.ts supaya semua jalur transaksi lewat
 * satu tempat yang sama (validasi debit=kredit, generate kode, dst).
 */
async function createEntriTransaksi(params) {
    const jenisTrx = await database_1.default.jenisTransaksi.findUnique({ where: { id: params.jenisTransaksiId } });
    if (!jenisTrx || !jenisTrx.aktif) {
        throw (0, response_1.errorResponse)('Jenis transaksi tidak ditemukan atau nonaktif', 404);
    }
    const akunDebit = params.akunDebitOverride || jenisTrx.akunDebitKode;
    const akunKredit = params.akunKreditOverride || jenisTrx.akunKreditKode;
    return database_1.default.$transaction(async (tx) => {
        const kode = await generateKodeTransaksi(tx, jenisTrx.kode);
        const journalEntry = await (0, journalService_1.createJournalEntry)(tx, {
            tanggal: params.tanggal,
            deskripsi: params.deskripsiJurnal || `${jenisTrx.namaTransaksi}${params.detail ? ` - ${params.detail}` : ''}`,
            unitBisnis: params.unitBisnis || undefined,
            dibuatOleh: params.dibuatOleh,
            viaAi: params.sumberInput === client_1.SumberInput.AI,
            baris: [
                { akunKode: akunDebit, debit: params.nominal, kredit: 0 },
                { akunKode: akunKredit, debit: 0, kredit: params.nominal },
            ],
        });
        const entri = await tx.transaksi.create({
            data: {
                kode,
                tanggal: params.tanggal,
                unitBisnis: params.unitBisnis || null,
                jenisTransaksiId: jenisTrx.id,
                namaTransaksi: jenisTrx.namaTransaksi,
                detail: params.detail || null,
                jenisKas: params.jenisKas || 'Kas Utama',
                nominal: params.nominal,
                akunDebitKode: akunDebit,
                akunKreditKode: akunKredit,
                customData: params.customData || undefined,
                pemasokId: params.pemasokId || null,
                hutangId: params.hutangId || null,
                pelangganId: params.pelangganId || null,
                produkId: params.produkId || null,
                jumlah: params.jumlah ?? null,
                hargaSatuan: params.hargaSatuan ?? null,
                jumlahBayar: params.jumlahBayar ?? null,
                sisaPiutang: params.sisaPiutang ?? null,
                sumberOrder: params.sumberOrder || null,
                jurnalEntriId: journalEntry.id,
                sumberInput: params.sumberInput || client_1.SumberInput.MANUAL,
                dibuatOleh: params.dibuatOleh,
            },
        });
        // Update saldo hutang pemasok kalau entri ini terkait pemasok
        // (dulu ini dicek pakai `tipe === BIAYA_LANGSUNG`, sekarang cukup
        // cek ada tidaknya pemasokId - lebih generic & tidak terikat enum)
        if (params.pemasokId) {
            await tx.dataPemasok.update({
                where: { id: params.pemasokId },
                data: { saldoHutang: { increment: params.nominal } },
            });
        }
        return entri;
    });
}
// GET /transactions
router.get('/', async (req, res, next) => {
    try {
        const { business_unit, unit_bisnis, jenis_transaksi_id, transaction_type_id, tanggal_mulai, tanggal_selesai, search } = req.query;
        const where = {};
        const finalUnit = unit_bisnis || business_unit;
        if (finalUnit)
            where.unitBisnis = finalUnit;
        const jTrxId = jenis_transaksi_id || transaction_type_id;
        if (jTrxId)
            where.jenisTransaksiId = parseInt(String(jTrxId));
        if (tanggal_mulai || tanggal_selesai) {
            where.tanggal = {};
            if (tanggal_mulai)
                where.tanggal.gte = new Date(tanggal_mulai);
            if (tanggal_selesai)
                where.tanggal.lte = new Date(tanggal_selesai);
        }
        if (search) {
            where.OR = [
                { namaTransaksi: { contains: search } },
                { detail: { contains: search } },
                { kode: { contains: search } },
            ];
        }
        const transactions = await database_1.default.transaksi.findMany({
            where,
            include: {
                jenisTransaksi: { include: { kolomCustom: { where: { aktif: true } } } },
                pemasok: true,
                pelanggan: true,
                produk: true,
                hutang: true,
                jurnalEntri: { include: { baris: true } },
            },
            orderBy: { tanggal: 'desc' },
        });
        res.json((0, response_1.successResponse)(transactions));
    }
    catch (error) {
        next(error);
    }
});
// GET /transactions/:id
router.get('/:id', async (req, res, next) => {
    try {
        const id = parseInt(String(req.params.id));
        const trx = await database_1.default.transaksi.findUnique({
            where: { id },
            include: {
                jenisTransaksi: { include: { kolomCustom: { where: { aktif: true } } } },
                pemasok: true,
                pelanggan: true,
                produk: true,
                hutang: true,
                jurnalEntri: { include: { baris: true } },
            },
        });
        if (!trx)
            throw (0, response_1.errorResponse)('Transaksi tidak ditemukan', 404);
        res.json((0, response_1.successResponse)(trx));
    }
    catch (error) {
        next(error);
    }
});
// POST /transactions  -- endpoint generic utama, dipakai UI baru
router.post('/', async (req, res, next) => {
    try {
        const { tanggal, unit_bisnis, business_unit, jenis_transaksi_id, transaction_type_id, detail, jenis_kas, jenisKas, nominal, custom_data, customData, pemasok_id, pemasokId, pelanggan_id, pelangganId, produk_id, produkId, hutang_id, hutangId, jumlah, harga_satuan, hargaSatuan, jumlah_bayar, jumlahBayar, sumber_order, sumberOrder, sumber_input, sumberInput, } = req.body;
        const jTrxId = jenis_transaksi_id || transaction_type_id;
        const finalNominal = Number(nominal);
        if (!tanggal || !jTrxId || !finalNominal) {
            throw (0, response_1.errorResponse)('tanggal, jenis_transaksi_id, dan nominal wajib diisi');
        }
        const entri = await createEntriTransaksi({
            jenisTransaksiId: parseInt(String(jTrxId)),
            tanggal: new Date(tanggal),
            unitBisnis: unit_bisnis || business_unit,
            detail,
            jenisKas: jenisKas || jenis_kas,
            nominal: finalNominal,
            customData: customData || custom_data,
            pemasokId: (pemasokId ?? pemasok_id) ? parseInt(String(pemasokId ?? pemasok_id)) : null,
            hutangId: (hutangId ?? hutang_id) ? parseInt(String(hutangId ?? hutang_id)) : null,
            pelangganId: (pelangganId ?? pelanggan_id) ? parseInt(String(pelangganId ?? pelanggan_id)) : null,
            produkId: (produkId ?? produk_id) ? parseInt(String(produkId ?? produk_id)) : null,
            jumlah: jumlah ? parseInt(String(jumlah)) : null,
            hargaSatuan: (hargaSatuan ?? harga_satuan) ? Number(hargaSatuan ?? harga_satuan) : null,
            jumlahBayar: (jumlahBayar ?? jumlah_bayar) !== undefined ? Number(jumlahBayar ?? jumlah_bayar) : null,
            sumberOrder: sumberOrder || sumber_order,
            sumberInput: (sumberInput || sumber_input) === 'AI' ? client_1.SumberInput.AI : client_1.SumberInput.MANUAL,
            dibuatOleh: req.user.id,
        });
        await (0, auditLogService_1.logManualAction)(req.user.id, 'transaksi', client_1.AksiLog.TAMBAH, entri.kode, `Transaksi baru: ${entri.namaTransaksi}`, entri.id, undefined, entri);
        res.json((0, response_1.successResponse)(entri));
    }
    catch (error) {
        next(error);
    }
});
// -------- Alias tipis untuk kompatibilitas webf lama (sampai webf --------
// -------- direfactor ke endpoint generic di atas) -------------------------
// POST /transactions/direct-cost  (biaya langsung, biasanya ada pemasok)
router.post('/direct-cost', async (req, res, next) => {
    try {
        const { tanggal, business_unit, unit_bisnis, transaction_type_id, jenis_transaksi_id, detail_transaksi, detail, supplier_id, pemasok_id, jenis_kas, nominal, } = req.body;
        const jTrxId = jenis_transaksi_id || transaction_type_id;
        const finalNominal = Number(nominal);
        if (!tanggal || !jTrxId || !finalNominal) {
            throw (0, response_1.errorResponse)('tanggal, jenis_transaksi_id, dan nominal wajib diisi');
        }
        const entri = await createEntriTransaksi({
            jenisTransaksiId: parseInt(String(jTrxId)),
            tanggal: new Date(tanggal),
            unitBisnis: unit_bisnis || business_unit || 'PABRIK',
            detail: detail || detail_transaksi,
            jenisKas: jenis_kas,
            nominal: finalNominal,
            pemasokId: (pemasok_id ?? supplier_id) ? parseInt(String(pemasok_id ?? supplier_id)) : null,
            dibuatOleh: req.user.id,
        });
        await (0, auditLogService_1.logManualAction)(req.user.id, 'transaksi', client_1.AksiLog.TAMBAH, entri.kode, `Biaya langsung baru: ${entri.namaTransaksi}`, entri.id);
        res.json((0, response_1.successResponse)(entri));
    }
    catch (error) {
        next(error);
    }
});
// POST /transactions/indirect-cost  (biaya tak langsung)
router.post('/indirect-cost', async (req, res, next) => {
    try {
        const { tanggal, business_unit, unit_bisnis, transaction_type_id, jenis_transaksi_id, detail, jenis_kas, nominal, } = req.body;
        const jTrxId = jenis_transaksi_id || transaction_type_id;
        const finalNominal = Number(nominal);
        if (!tanggal || !jTrxId || !finalNominal) {
            throw (0, response_1.errorResponse)('tanggal, jenis_transaksi_id, dan nominal wajib diisi');
        }
        const entri = await createEntriTransaksi({
            jenisTransaksiId: parseInt(String(jTrxId)),
            tanggal: new Date(tanggal),
            unitBisnis: unit_bisnis || business_unit || 'PABRIK',
            detail,
            jenisKas: jenis_kas,
            nominal: finalNominal,
            dibuatOleh: req.user.id,
        });
        await (0, auditLogService_1.logManualAction)(req.user.id, 'transaksi', client_1.AksiLog.TAMBAH, entri.kode, `Biaya tak langsung baru: ${entri.namaTransaksi}`, entri.id);
        res.json((0, response_1.successResponse)(entri));
    }
    catch (error) {
        next(error);
    }
});
// POST /transactions/cash  (cash-in / mutasi kas)
router.post('/cash', async (req, res, next) => {
    try {
        const { tanggal, business_unit, unit_bisnis, transaction_type_id, jenis_transaksi_id, keterangan, detail, jenis_kas, nominal, } = req.body;
        const jTrxId = jenis_transaksi_id || transaction_type_id;
        const finalNominal = Number(nominal);
        if (!tanggal || !jTrxId || !finalNominal) {
            throw (0, response_1.errorResponse)('tanggal, jenis_transaksi_id, dan nominal wajib diisi (pilih jenis Cash In atau Mutasi dari Master Transaksi)');
        }
        const entri = await createEntriTransaksi({
            jenisTransaksiId: parseInt(String(jTrxId)),
            tanggal: new Date(tanggal),
            unitBisnis: unit_bisnis || business_unit || 'NEXT_LEVEL',
            detail: detail || keterangan,
            jenisKas: jenis_kas,
            nominal: finalNominal,
            dibuatOleh: req.user.id,
        });
        await (0, auditLogService_1.logManualAction)(req.user.id, 'transaksi', client_1.AksiLog.TAMBAH, entri.kode, `Transaksi kas baru: ${entri.namaTransaksi}`, entri.id);
        res.json((0, response_1.successResponse)(entri));
    }
    catch (error) {
        next(error);
    }
});
// DELETE /transactions/:id
router.delete('/:id', async (req, res, next) => {
    try {
        const id = parseInt(String(req.params.id));
        if (isNaN(id))
            return next();
        const trx = await database_1.default.transaksi.findUnique({ where: { id } });
        if (!trx)
            throw (0, response_1.errorResponse)('Transaksi tidak ditemukan', 404);
        await database_1.default.$transaction(async (tx) => {
            await tx.transaksi.delete({ where: { id } });
            if (trx.jurnalEntriId) {
                await tx.jurnalEntri.delete({ where: { id: trx.jurnalEntriId } });
            }
            if (trx.hutangId) {
                await tx.hutang.update({
                    where: { id: trx.hutangId },
                    data: { sisaHutang: { increment: trx.nominal } },
                });
            }
            // Rollback saldo hutang pemasok - dulu dicek `tipe === BIAYA_LANGSUNG`,
            // sekarang cukup cek ada tidaknya pemasokId (lihat catatan di
            // createEntriTransaksi di atas)
            if (trx.pemasokId) {
                await tx.dataPemasok.update({
                    where: { id: trx.pemasokId },
                    data: { saldoHutang: { decrement: trx.nominal } },
                });
            }
        });
        await (0, auditLogService_1.logManualAction)(req.user.id, 'transaksi', client_1.AksiLog.HAPUS, trx.kode, `Transaksi dihapus: ${trx.kode}`, trx.id, trx, undefined);
        res.json((0, response_1.successResponse)({ message: 'Transaksi dihapus' }));
    }
    catch (error) {
        next(error);
    }
});
// DELETE /transactions/:sumber_tabel/:id  (backwards compatibility - webf lama)
router.delete('/:sumber_tabel/:id', async (req, res, next) => {
    try {
        const id = parseInt(String(req.params.id));
        const trx = await database_1.default.transaksi.findUnique({ where: { id } });
        if (!trx)
            throw (0, response_1.errorResponse)('Transaksi tidak ditemukan', 404);
        await database_1.default.$transaction(async (tx) => {
            await tx.transaksi.delete({ where: { id } });
            if (trx.jurnalEntriId) {
                await tx.jurnalEntri.delete({ where: { id: trx.jurnalEntriId } });
            }
            if (trx.pemasokId) {
                await tx.dataPemasok.update({
                    where: { id: trx.pemasokId },
                    data: { saldoHutang: { decrement: trx.nominal } },
                });
            }
        });
        await (0, auditLogService_1.logManualAction)(req.user.id, 'transaksi', client_1.AksiLog.HAPUS, trx.kode, `Transaksi dihapus: ${trx.kode}`, trx.id);
        res.json((0, response_1.successResponse)({ message: 'Transaksi dihapus' }));
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
