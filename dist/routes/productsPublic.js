"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const response_1 = require("../utils/response");
const database_1 = __importDefault(require("../utils/database"));
const router = (0, express_1.Router)();
// GET /public/products - Public endpoint to get active products
router.get('/', async (req, res, next) => {
    try {
        const { search } = req.query;
        const where = { aktif: true };
        if (search) {
            where.OR = [
                { namaBarang: { contains: search } },
                { varian: { contains: search } },
                { kode: { contains: search } },
            ];
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
// GET /public/products/:id - Public endpoint to get product by ID
router.get('/:id', async (req, res, next) => {
    try {
        const product = await database_1.default.produk.findUnique({
            where: { id: parseInt(String(req.params.id)) },
            select: { id: true, kode: true, namaBarang: true, varian: true, satuan: true, hargaDefault: true, gambar: true, deskripsi: true, aktif: true, dibuatPada: true }
        });
        if (!product) {
            throw (0, response_1.errorResponse)('Product not found', 404);
        }
        if (!product.aktif) {
            throw (0, response_1.errorResponse)('Product is not available', 404);
        }
        res.json((0, response_1.successResponse)(product));
    }
    catch (error) {
        next(error);
    }
});
// GET /public/products/:id/image
router.get('/:id/image', async (req, res, next) => {
    try {
        const product = await database_1.default.produk.findUnique({
            where: { id: parseInt(String(req.params.id)) },
            select: { gambarData: true, gambarMime: true, aktif: true },
        });
        if (!product?.gambarData || !product.gambarMime || !product.aktif) {
            throw (0, response_1.errorResponse)('Gambar tidak ditemukan', 404);
        }
        res.type(product.gambarMime).set('Cache-Control', 'public, max-age=3600').send(Buffer.from(product.gambarData));
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
