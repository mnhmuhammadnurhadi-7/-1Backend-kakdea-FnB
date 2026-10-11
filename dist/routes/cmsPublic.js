"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const response_1 = require("../utils/response");
const database_1 = __importDefault(require("../utils/database"));
const router = (0, express_1.Router)();
// ================= PUBLIC CMS CONTENT =================
// Tanpa authentication - untuk customer page
// GET /public/cms/content
router.get('/content', async (req, res, next) => {
    try {
        const { key } = req.query;
        const where = { aktif: true };
        if (key)
            where.key = key;
        const content = await database_1.default.cmsContent.findMany({
            where,
            orderBy: { key: 'asc' },
        });
        res.json((0, response_1.successResponse)(content));
    }
    catch (error) {
        next(error);
    }
});
// GET /public/cms/content/:key
router.get('/content/:key', async (req, res, next) => {
    try {
        const { key } = req.params;
        const content = await database_1.default.cmsContent.findUnique({
            where: { key },
        });
        if (!content) {
            // Return default content instead of 404
            if (key === 'tentang_kami') {
                res.json((0, response_1.successResponse)({
                    key: 'tentang_kami',
                    judul: 'Tentang Kami',
                    subJudul: 'Kualitas dan Kepercayaan',
                    konten: 'Buku Dapur hadir untuk memenuhi kebutuhan makanan Anda dengan kualitas terbaik. Kami menyediakan berbagai pilihan frozen food dan makanan siap saji yang lezat dan praktis.',
                    aktif: true,
                }));
                return;
            }
            if (key === 'kontak') {
                res.json((0, response_1.successResponse)({
                    key: 'kontak',
                    judul: '+62 812 3456 7890',
                    subJudul: 'info@bukudapur.com',
                    konten: 'Jl. Contoh No. 123\nKota, Provinsi 12345',
                    aktif: true,
                }));
                return;
            }
            if (key === 'produk_unggulan') {
                res.json((0, response_1.successResponse)({
                    key: 'produk_unggulan',
                    judul: 'Produk Unggulan',
                    subJudul: 'Maksimal 5 produk',
                    konten: '[]',
                    aktif: true,
                }));
                return;
            }
            res.json((0, response_1.successResponse)({
                key,
                judul: 'Selamat Datang di Buku Dapur',
                subJudul: 'Frozen Food & Siap Saji Terbaik',
                konten: '',
                aktif: true,
            }));
            return;
        }
        res.json((0, response_1.successResponse)(content));
    }
    catch (error) {
        next(error);
    }
});
// ================= PUBLIC CMS MENU =================
// Tanpa authentication - untuk customer page
// GET /public/cms/menu
router.get('/menu', async (req, res, next) => {
    try {
        const menu = await database_1.default.cmsMenu.findMany({
            where: { aktif: true },
            orderBy: { urutan: 'asc' },
        });
        res.json((0, response_1.successResponse)(menu));
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
