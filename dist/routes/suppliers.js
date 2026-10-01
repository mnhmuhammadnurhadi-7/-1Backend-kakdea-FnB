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
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// GET /suppliers
router.get('/', async (req, res, next) => {
    try {
        const { search } = req.query;
        const where = {};
        if (search) {
            where.OR = [
                { nama: { contains: search } },
                { kode: { contains: search } },
            ];
        }
        const suppliers = await database_1.default.dataPemasok.findMany({
            where,
            orderBy: { dibuatPada: 'desc' }
        });
        res.json((0, response_1.successResponse)(suppliers));
    }
    catch (error) {
        next(error);
    }
});
// GET /suppliers/:id
router.get('/:id', async (req, res, next) => {
    try {
        const supplier = await database_1.default.dataPemasok.findUnique({
            where: { id: parseInt(String(req.params.id)) }
        });
        if (!supplier) {
            throw (0, response_1.errorResponse)('Supplier not found', 404);
        }
        res.json((0, response_1.successResponse)(supplier));
    }
    catch (error) {
        next(error);
    }
});
// POST /suppliers
router.post('/', async (req, res, next) => {
    try {
        const { kode, kode_supplier, nama, alamat, kontakPerson, contact_person, telepon, telp, bankNama, bank_nama, rekening, keterangan } = req.body;
        const finalKode = kode || kode_supplier;
        if (!finalKode || !nama) {
            throw (0, response_1.errorResponse)('kode (kode_supplier) and nama are required');
        }
        const supplier = await database_1.default.dataPemasok.create({
            data: {
                kode: finalKode,
                nama,
                alamat,
                kontakPerson: kontakPerson || contact_person,
                telepon: telepon || telp,
                bankNama: bankNama || bank_nama,
                rekening,
                keterangan,
            }
        });
        await (0, auditLogService_1.logManualAction)(req.user.id, 'data_pemasok', client_1.AksiLog.TAMBAH, supplier.nama, `Data Pemasok created: ${supplier.nama}`, supplier.id);
        res.json((0, response_1.successResponse)(supplier));
    }
    catch (error) {
        next(error);
    }
});
// PUT /suppliers/:id
router.put('/:id', async (req, res, next) => {
    try {
        const id = parseInt(String(req.params.id));
        const { kode, kode_supplier, nama, alamat, kontakPerson, contact_person, telepon, telp, bankNama, bank_nama, rekening, saldoHutang, saldo_hutang, keterangan } = req.body;
        const existing = await database_1.default.dataPemasok.findUnique({ where: { id } });
        if (!existing) {
            throw (0, response_1.errorResponse)('Supplier not found', 404);
        }
        const updateData = {};
        if (kode || kode_supplier)
            updateData.kode = kode || kode_supplier;
        if (nama !== undefined)
            updateData.nama = nama;
        if (alamat !== undefined)
            updateData.alamat = alamat;
        if (kontakPerson !== undefined || contact_person !== undefined)
            updateData.kontakPerson = kontakPerson || contact_person;
        if (telepon !== undefined || telp !== undefined)
            updateData.telepon = telepon || telp;
        if (bankNama !== undefined || bank_nama !== undefined)
            updateData.bankNama = bankNama || bank_nama;
        if (rekening !== undefined)
            updateData.rekening = rekening;
        if (saldoHutang !== undefined || saldo_hutang !== undefined)
            updateData.saldoHutang = saldoHutang ?? saldo_hutang;
        if (keterangan !== undefined)
            updateData.keterangan = keterangan;
        const supplier = await database_1.default.dataPemasok.update({
            where: { id },
            data: updateData
        });
        await (0, auditLogService_1.logManualAction)(req.user.id, 'data_pemasok', client_1.AksiLog.UBAH, supplier.nama, `Data Pemasok updated: ${supplier.nama}`, supplier.id, existing, updateData);
        res.json((0, response_1.successResponse)(supplier));
    }
    catch (error) {
        next(error);
    }
});
// DELETE /suppliers/:id
router.delete('/:id', async (req, res, next) => {
    try {
        const id = parseInt(String(req.params.id));
        const supplier = await database_1.default.dataPemasok.delete({
            where: { id }
        });
        await (0, auditLogService_1.logManualAction)(req.user.id, 'data_pemasok', client_1.AksiLog.HAPUS, supplier.nama, `Data Pemasok deleted: ${supplier.nama}`, supplier.id);
        res.json((0, response_1.successResponse)({ message: 'Supplier deleted successfully' }));
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
