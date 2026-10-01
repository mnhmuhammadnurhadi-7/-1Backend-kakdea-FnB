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
const jenisBawaan_1 = require("../utils/jenisBawaan");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// GET /customers
router.get('/', async (req, res, next) => {
    try {
        const { search, status } = req.query;
        const where = {};
        if (search) {
            where.OR = [
                { nama: { contains: search } },
                { kode: { contains: search } },
            ];
        }
        if (status) {
            where.status = status;
        }
        const customers = await database_1.default.dataPelanggan.findMany({
            where,
            orderBy: { dibuatPada: 'desc' }
        });
        res.json((0, response_1.successResponse)(customers));
    }
    catch (error) {
        next(error);
    }
});
// GET /customers/:id
router.get('/:id', async (req, res, next) => {
    try {
        const id = parseInt(String(req.params.id));
        const orderJenis = await database_1.default.jenisTransaksi.findMany({
            where: { kode: { in: [jenisBawaan_1.KODE_JENIS_BAWAAN.PENDAPATAN_FROZEN, jenisBawaan_1.KODE_JENIS_BAWAAN.PENDAPATAN_SIAP_SAJI] } },
            select: { id: true },
        });
        const customer = await database_1.default.dataPelanggan.findUnique({
            where: { id },
            include: {
                transaksi: {
                    where: { jenisTransaksiId: { in: orderJenis.map((j) => j.id) } },
                    orderBy: { tanggal: 'desc' },
                    take: 1,
                    select: {
                        id: true,
                        kode: true,
                        tanggal: true,
                        nominal: true,
                    }
                }
            }
        });
        if (!customer) {
            throw (0, response_1.errorResponse)('Customer not found', 404);
        }
        const response = {
            ...customer,
            order_terakhir: customer.transaksi[0] || null,
            transaksi: undefined,
        };
        res.json((0, response_1.successResponse)(response));
    }
    catch (error) {
        next(error);
    }
});
// POST /customers
router.post('/', async (req, res, next) => {
    try {
        const { kode, kode_customer, nama, status, alamat, kontakPerson, contact_person, telepon, telp, bankNama, bank_nama, rekening, keterangan } = req.body;
        const finalKode = kode || kode_customer;
        if (!finalKode || !nama) {
            throw (0, response_1.errorResponse)('kode (kode_customer) and nama are required');
        }
        const customer = await database_1.default.dataPelanggan.create({
            data: {
                kode: finalKode,
                nama,
                status,
                alamat,
                kontakPerson: kontakPerson || contact_person,
                telepon: telepon || telp,
                bankNama: bankNama || bank_nama,
                rekening,
                keterangan,
            }
        });
        await (0, auditLogService_1.logManualAction)(req.user.id, 'data_pelanggan', client_1.AksiLog.TAMBAH, customer.nama, `Data Pelanggan created: ${customer.nama}`, customer.id);
        res.json((0, response_1.successResponse)(customer));
    }
    catch (error) {
        next(error);
    }
});
// PUT /customers/:id
router.put('/:id', async (req, res, next) => {
    try {
        const id = parseInt(String(req.params.id));
        const { kode, kode_customer, nama, status, alamat, kontakPerson, contact_person, telepon, telp, bankNama, bank_nama, rekening, saldoPiutang, saldo_piutang, keterangan } = req.body;
        const existing = await database_1.default.dataPelanggan.findUnique({ where: { id } });
        if (!existing) {
            throw (0, response_1.errorResponse)('Customer not found', 404);
        }
        const updateData = {};
        if (kode || kode_customer)
            updateData.kode = kode || kode_customer;
        if (nama !== undefined)
            updateData.nama = nama;
        if (status !== undefined)
            updateData.status = status;
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
        if (saldoPiutang !== undefined || saldo_piutang !== undefined)
            updateData.saldoPiutang = saldoPiutang ?? saldo_piutang;
        if (keterangan !== undefined)
            updateData.keterangan = keterangan;
        const customer = await database_1.default.dataPelanggan.update({
            where: { id },
            data: updateData
        });
        await (0, auditLogService_1.logManualAction)(req.user.id, 'data_pelanggan', client_1.AksiLog.UBAH, customer.nama, `Data Pelanggan updated: ${customer.nama}`, customer.id, existing, updateData);
        res.json((0, response_1.successResponse)(customer));
    }
    catch (error) {
        next(error);
    }
});
// DELETE /customers/:id
router.delete('/:id', async (req, res, next) => {
    try {
        const id = parseInt(String(req.params.id));
        const customer = await database_1.default.dataPelanggan.delete({
            where: { id }
        });
        await (0, auditLogService_1.logManualAction)(req.user.id, 'data_pelanggan', client_1.AksiLog.HAPUS, customer.nama, `Data Pelanggan deleted: ${customer.nama}`, customer.id);
        res.json((0, response_1.successResponse)({ message: 'Customer deleted successfully' }));
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
