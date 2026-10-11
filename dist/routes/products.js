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
// All routes require authentication
router.use(auth_1.authenticate);
// GET /products
router.get('/', async (req, res, next) => {
    try {
        const { search, is_active, aktif } = req.query;
        const where = {};
        if (search) {
            where.OR = [
                { namaBarang: { contains: search } },
                { varian: { contains: search } },
                { kode: { contains: search } },
            ];
        }
        if (aktif !== undefined) {
            where.aktif = aktif === 'true';
        }
        else if (is_active !== undefined) {
            where.aktif = is_active === 'true';
        }
        const products = await database_1.default.produk.findMany({
            where,
            orderBy: { dibuatPada: 'desc' }
        });
        res.json((0, response_1.successResponse)(products));
    }
    catch (error) {
        next(error);
    }
});
// GET /products/:id
router.get('/:id', async (req, res, next) => {
    try {
        const product = await database_1.default.produk.findUnique({
            where: { id: parseInt(String(req.params.id)) }
        });
        if (!product) {
            throw (0, response_1.errorResponse)('Product not found', 404);
        }
        res.json((0, response_1.successResponse)(product));
    }
    catch (error) {
        next(error);
    }
});
// POST /products
router.post('/', async (req, res, next) => {
    try {
        const { kode, kode_produk, nama_barang, namaBarang, varian, satuan, harga_default, hargaDefault, gambar, deskripsi, } = req.body;
        const finalKode = kode || kode_produk || `PRD${Date.now()}`;
        const finalNama = namaBarang || nama_barang;
        if (!finalNama) {
            throw (0, response_1.errorResponse)('namaBarang (nama_barang) is required');
        }
        const product = await database_1.default.produk.create({
            data: {
                kode: finalKode,
                namaBarang: finalNama,
                varian,
                satuan: satuan || 'pcs',
                hargaDefault: (hargaDefault ?? harga_default) || 0,
                gambar,
                deskripsi,
                aktif: true,
            }
        });
        // Log audit
        await (0, auditLogService_1.logManualAction)(req.user.id, 'produk', client_1.AksiLog.TAMBAH, product.namaBarang, `Product created: ${product.namaBarang}`, product.id);
        res.json((0, response_1.successResponse)(product));
    }
    catch (error) {
        next(error);
    }
});
// PUT /products/:id
router.put('/:id', async (req, res, next) => {
    try {
        const id = parseInt(String(req.params.id));
        const { kode, kode_produk, nama_barang, namaBarang, varian, satuan, harga_default, hargaDefault, gambar, deskripsi, aktif, is_active } = req.body;
        const existing = await database_1.default.produk.findUnique({ where: { id } });
        if (!existing) {
            throw (0, response_1.errorResponse)('Product not found', 404);
        }
        const updateData = {};
        if (kode || kode_produk)
            updateData.kode = kode || kode_produk;
        if (namaBarang || nama_barang)
            updateData.namaBarang = namaBarang || nama_barang;
        if (varian !== undefined)
            updateData.varian = varian;
        if (satuan !== undefined)
            updateData.satuan = satuan;
        if (hargaDefault !== undefined || harga_default !== undefined)
            updateData.hargaDefault = hargaDefault ?? harga_default;
        if (gambar !== undefined)
            updateData.gambar = gambar;
        if (deskripsi !== undefined)
            updateData.deskripsi = deskripsi;
        if (aktif !== undefined || is_active !== undefined)
            updateData.aktif = (aktif !== undefined ? aktif : is_active) === true;
        const product = await database_1.default.produk.update({
            where: { id },
            data: updateData
        });
        // Log audit
        await (0, auditLogService_1.logManualAction)(req.user.id, 'produk', client_1.AksiLog.UBAH, product.namaBarang, `Product updated: ${product.namaBarang}`, product.id, existing, updateData);
        res.json((0, response_1.successResponse)(product));
    }
    catch (error) {
        next(error);
    }
});
// DELETE /products/:id (soft delete)
router.delete('/:id', async (req, res, next) => {
    try {
        const id = parseInt(String(req.params.id));
        const product = await database_1.default.produk.update({
            where: { id },
            data: { aktif: false }
        });
        // Log audit
        await (0, auditLogService_1.logManualAction)(req.user.id, 'produk', client_1.AksiLog.HAPUS, product.namaBarang, `Product soft deleted: ${product.namaBarang}`, product.id);
        res.json((0, response_1.successResponse)({ message: 'Product deleted successfully' }));
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
