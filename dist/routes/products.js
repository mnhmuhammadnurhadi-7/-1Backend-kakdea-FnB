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
const imageDataFrom = (value) => {
    if (typeof value !== 'string' || !value.startsWith('data:image/'))
        return null;
    const match = value.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/]+=*)$/);
    if (!match)
        throw (0, response_1.errorResponse)('Format gambar tidak valid', 400);
    const data = Buffer.from(match[2], 'base64');
    if (!data.length || data.length > 5 * 1024 * 1024)
        throw (0, response_1.errorResponse)('Ukuran gambar maksimal 5 MB', 400);
    return { data, mime: match[1] };
};
const withoutImageData = (product) => {
    const { gambarData: _data, gambarMime: _mime, ...safeProduct } = product;
    return safeProduct;
};
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
            orderBy: { dibuatPada: 'desc' },
            select: { id: true, kode: true, namaBarang: true, varian: true, satuan: true, hargaDefault: true, gambar: true, deskripsi: true, aktif: true, dibuatPada: true }
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
            where: { id: parseInt(String(req.params.id)) },
            select: { id: true, kode: true, namaBarang: true, varian: true, satuan: true, hargaDefault: true, gambar: true, deskripsi: true, aktif: true, dibuatPada: true }
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
// Mengirim gambar langsung dari kolom BLOB.
router.get('/:id/image', async (req, res, next) => {
    try {
        const product = await database_1.default.produk.findUnique({
            where: { id: parseInt(String(req.params.id)) },
            select: { gambarData: true, gambarMime: true, gambar: true },
        });
        if (!product?.gambarData || !product.gambarMime)
            throw (0, response_1.errorResponse)('Gambar tidak ditemukan', 404);
        res.type(product.gambarMime).set('Cache-Control', 'public, max-age=3600').send(Buffer.from(product.gambarData));
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
        const image = imageDataFrom(gambar);
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
                gambar: image ? null : gambar,
                ...(image ? { gambarData: image.data, gambarMime: image.mime } : {}),
                deskripsi,
                aktif: true,
            }
        });
        // Log audit
        await (0, auditLogService_1.logManualAction)(req.user.id, 'produk', client_1.AksiLog.TAMBAH, product.namaBarang, `Product created: ${product.namaBarang}`, product.id);
        if (image) {
            await database_1.default.produk.update({ where: { id: product.id }, data: { gambar: `/api/public/products/${product.id}/image` } });
            product.gambar = `/api/public/products/${product.id}/image`;
        }
        res.json((0, response_1.successResponse)(withoutImageData(product)));
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
        const existing = await database_1.default.produk.findUnique({
            where: { id },
            select: { id: true, kode: true, namaBarang: true, varian: true, satuan: true, hargaDefault: true, gambar: true, deskripsi: true, aktif: true, dibuatPada: true }
        });
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
        if (gambar !== undefined) {
            const image = imageDataFrom(gambar);
            if (image) {
                updateData.gambar = `/api/public/products/${id}/image`;
                updateData.gambarData = image.data;
                updateData.gambarMime = image.mime;
            }
            else if (gambar === '') {
                updateData.gambar = null;
                updateData.gambarData = null;
                updateData.gambarMime = null;
            }
            else
                updateData.gambar = gambar;
        }
        if (deskripsi !== undefined)
            updateData.deskripsi = deskripsi;
        if (aktif !== undefined || is_active !== undefined)
            updateData.aktif = (aktif !== undefined ? aktif : is_active) === true;
        const product = await database_1.default.produk.update({
            where: { id },
            data: updateData
        });
        // Log audit
        await (0, auditLogService_1.logManualAction)(req.user.id, 'produk', client_1.AksiLog.UBAH, product.namaBarang, `Product updated: ${product.namaBarang}`, product.id, existing, Object.fromEntries(Object.entries(updateData).filter(([key]) => key !== 'gambarData')));
        res.json((0, response_1.successResponse)(withoutImageData(product)));
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
