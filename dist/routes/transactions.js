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
const auditLogService_1 = require("../services/auditLogService");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// Generate kode transaksi yang atomic & aman untuk concurrent request
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
 * Pembuat entri transaksi generik - dipakai oleh endpoint POST / di file ini.
 */
async function createEntriTransaksi(params) {
    const jenisTrx = await database_1.default.jenisTransaksi.findUnique({ where: { id: params.jenisTransaksiId } });
    if (!jenisTrx || !jenisTrx.aktif) {
        throw (0, response_1.errorResponse)('Jenis transaksi tidak ditemukan atau nonaktif', 404);
    }
    return database_1.default.$transaction(async (tx) => {
        const kode = await generateKodeTransaksi(tx, jenisTrx.kode);
        const entri = await tx.transaksi.create({
            data: {
                kode,
                tanggal: params.tanggal,
                unitBisnis: params.unitBisnis || null,
                jenisTransaksiId: jenisTrx.id,
                namaTransaksi: jenisTrx.namaTransaksi,
                detail: params.detail || null,
                jenisKas: params.jenisKas || null,
                nominal: params.nominal,
                debit: params.debit || null,
                kredit: params.kredit || null,
                customData: params.customData || undefined,
                sumberInput: params.sumberInput || client_1.SumberInput.MANUAL,
                dibuatOleh: params.dibuatOleh,
            },
        });
        return entri;
    });
}
// GET /transactions
router.get('/', async (req, res, next) => {
    try {
        const { business_unit, unit_bisnis, jenis_transaksi_id, transaction_type_id, tanggal_mulai, tanggal_selesai, search, page = '1', limit = '50' } = req.query;
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
        const skip = (Number(page) - 1) * Number(limit);
        const [transactions, total] = await Promise.all([
            database_1.default.transaksi.findMany({
                where,
                include: {
                    jenisTransaksi: { include: { kolomCustom: { where: { aktif: true } } } },
                },
                orderBy: [{ tanggal: 'desc' }, { dibuatPada: 'desc' }, { id: 'desc' }],
                skip,
                take: Number(limit),
            }),
            database_1.default.transaksi.count({ where }),
        ]);
        res.json((0, response_1.successResponse)({
            data: transactions,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit)),
            },
        }));
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
// POST /transactions
router.post('/', async (req, res, next) => {
    try {
        const { tanggal, unit_bisnis, business_unit, jenis_transaksi_id, transaction_type_id, detail, keterangan, jenis_kas, jenisKas, nominal, debit, kredit, custom_data, customData, sumber_input, sumberInput, } = req.body;
        const jTrxId = jenis_transaksi_id || transaction_type_id;
        const finalNominal = Number(nominal);
        if (!tanggal || !jTrxId || !finalNominal) {
            throw (0, response_1.errorResponse)('tanggal, jenis_transaksi_id, dan nominal wajib diisi');
        }
        const entri = await createEntriTransaksi({
            jenisTransaksiId: parseInt(String(jTrxId)),
            tanggal: new Date(tanggal),
            unitBisnis: unit_bisnis || business_unit,
            detail: detail || keterangan,
            jenisKas: jenisKas || jenis_kas,
            nominal: finalNominal,
            debit: debit || null,
            kredit: kredit || null,
            customData: customData || custom_data,
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
// PUT /transactions/:id
router.put('/:id', async (req, res, next) => {
    try {
        const id = parseInt(String(req.params.id));
        const before = await database_1.default.transaksi.findUnique({ where: { id } });
        if (!before)
            throw (0, response_1.errorResponse)('Transaksi tidak ditemukan', 404);
        const { tanggal, detail, keterangan, jenis_kas, jenisKas, nominal, debit, kredit, custom_data, customData } = req.body;
        const data = {};
        if (tanggal !== undefined)
            data.tanggal = new Date(tanggal);
        if ((detail ?? keterangan) !== undefined)
            data.detail = detail ?? keterangan;
        if ((jenisKas ?? jenis_kas) !== undefined)
            data.jenisKas = jenisKas ?? jenis_kas;
        if (nominal !== undefined)
            data.nominal = Number(nominal);
        if (debit !== undefined)
            data.debit = debit;
        if (kredit !== undefined)
            data.kredit = kredit;
        if ((customData ?? custom_data) !== undefined)
            data.customData = customData ?? custom_data;
        const updated = await database_1.default.transaksi.update({ where: { id }, data });
        await (0, auditLogService_1.logManualAction)(req.user.id, 'transaksi', client_1.AksiLog.UBAH, updated.kode, `Transaksi diubah: ${updated.kode}`, updated.id, before, updated);
        res.json((0, response_1.successResponse)(updated));
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
        await database_1.default.transaksi.delete({ where: { id } });
        await (0, auditLogService_1.logManualAction)(req.user.id, 'transaksi', client_1.AksiLog.HAPUS, trx.kode, `Transaksi dihapus: ${trx.kode}`, trx.id, trx, undefined);
        res.json((0, response_1.successResponse)({ message: 'Transaksi dihapus' }));
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
