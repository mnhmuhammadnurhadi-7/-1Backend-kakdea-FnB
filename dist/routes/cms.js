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
// ================= CMS CONTENT =================
// Untuk headline beranda, konten tentang kami, dll
// GET /cms/content
router.get('/content', async (req, res, next) => {
    try {
        const { key, aktif } = req.query;
        const where = {};
        if (key)
            where.key = Array.isArray(key) ? key[0] : key;
        if (aktif !== undefined)
            where.aktif = aktif === 'true';
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
// GET /cms/content/:key
router.get('/content/:key', async (req, res, next) => {
    try {
        const { key } = req.params;
        const content = await database_1.default.cmsContent.findUnique({
            where: { key: Array.isArray(key) ? key[0] : key },
        });
        if (!content)
            throw (0, response_1.errorResponse)('Konten tidak ditemukan', 404);
        res.json((0, response_1.successResponse)(content));
    }
    catch (error) {
        next(error);
    }
});
// POST /cms/content
router.post('/content', async (req, res, next) => {
    try {
        const { key, judul, sub_judul, subJudul, konten, aktif } = req.body;
        if (!key || !judul) {
            throw (0, response_1.errorResponse)('key dan judul wajib diisi');
        }
        // @ts-ignore - Prisma client needs to be regenerated after schema update
        const existing = await database_1.default.cmsContent.findUnique({ where: { key } });
        if (existing)
            throw (0, response_1.errorResponse)(`Key "${key}" sudah dipakai`, 409);
        // @ts-ignore - Prisma client needs to be regenerated after schema update
        const content = await database_1.default.cmsContent.create({
            data: {
                key,
                judul,
                subJudul: subJudul || sub_judul,
                konten,
                aktif: aktif !== undefined ? aktif : true,
                dibuatOleh: req.user.id,
            },
        });
        await (0, auditLogService_1.logManualAction)(req.user.id, 'cms_content', client_1.AksiLog.TAMBAH, content.judul, `CMS content baru: ${content.key}`, content.id, undefined, content);
        res.json((0, response_1.successResponse)(content));
    }
    catch (error) {
        next(error);
    }
});
// PUT /cms/content/:key
router.put('/content/:key', async (req, res, next) => {
    try {
        const { key } = req.params;
        const keyStr = Array.isArray(key) ? key[0] : key;
        const before = await database_1.default.cmsContent.findUnique({ where: { key: keyStr } });
        const { judul, sub_judul, subJudul, konten, aktif } = req.body;
        let updated;
        if (!before) {
            updated = await database_1.default.cmsContent.create({
                data: {
                    key: keyStr,
                    judul: judul || keyStr,
                    subJudul: subJudul ?? sub_judul ?? null,
                    konten: konten ?? null,
                    aktif: aktif !== undefined ? aktif : true,
                    dibuatOleh: req.user.id,
                },
            });
            await (0, auditLogService_1.logManualAction)(req.user.id, 'cms_content', client_1.AksiLog.TAMBAH, updated.judul, `CMS content dibuat: ${updated.key}`, updated.id, undefined, updated);
        }
        else {
            const data = {};
            if (judul !== undefined)
                data.judul = judul;
            if ((subJudul ?? sub_judul) !== undefined)
                data.subJudul = subJudul ?? sub_judul;
            if (konten !== undefined)
                data.konten = konten;
            if (aktif !== undefined)
                data.aktif = aktif;
            updated = await database_1.default.cmsContent.update({
                where: { key: keyStr },
                data
            });
            await (0, auditLogService_1.logManualAction)(req.user.id, 'cms_content', client_1.AksiLog.UBAH, updated.judul, `CMS content diubah: ${updated.key}`, updated.id, before, updated);
        }
        res.json((0, response_1.successResponse)(updated));
    }
    catch (error) {
        next(error);
    }
});
// DELETE /cms/content/:key
router.delete('/content/:key', async (req, res, next) => {
    try {
        const { key } = req.params;
        // @ts-ignore - Prisma client needs to be regenerated after schema update
        const content = await database_1.default.cmsContent.findUnique({ where: { key } });
        if (!content)
            throw (0, response_1.errorResponse)('Konten tidak ditemukan', 404);
        // @ts-ignore - Prisma client needs to be regenerated after schema update
        await database_1.default.cmsContent.delete({ where: { key } });
        await (0, auditLogService_1.logManualAction)(req.user.id, 'cms_content', client_1.AksiLog.HAPUS, content.judul, `CMS content dihapus: ${content.key}`, content.id, content, undefined);
        res.json((0, response_1.successResponse)({ message: 'Konten dihapus' }));
    }
    catch (error) {
        next(error);
    }
});
// ================= CMS MENU =================
// Untuk navigasi customer page
// GET /cms/menu
router.get('/menu', async (req, res, next) => {
    try {
        const { aktif } = req.query;
        const where = {};
        if (aktif !== undefined)
            where.aktif = aktif === 'true';
        // @ts-ignore - Prisma client needs to be regenerated after schema update
        const menu = await database_1.default.cmsMenu.findMany({
            where,
            orderBy: { urutan: 'asc' },
        });
        res.json((0, response_1.successResponse)(menu));
    }
    catch (error) {
        next(error);
    }
});
// GET /cms/menu/:id
router.get('/menu/:id', async (req, res, next) => {
    try {
        const id = parseInt(String(req.params.id));
        // @ts-ignore - Prisma client needs to be regenerated after schema update
        const menu = await database_1.default.cmsMenu.findUnique({
            where: { id },
        });
        if (!menu)
            throw (0, response_1.errorResponse)('Menu tidak ditemukan', 404);
        res.json((0, response_1.successResponse)(menu));
    }
    catch (error) {
        next(error);
    }
});
// POST /cms/menu
router.post('/menu', async (req, res, next) => {
    try {
        const { label, path, urutan, aktif } = req.body;
        if (!label || !path) {
            throw (0, response_1.errorResponse)('label dan path wajib diisi');
        }
        // @ts-ignore - Prisma client needs to be regenerated after schema update
        const menu = await database_1.default.cmsMenu.create({
            data: {
                label,
                path,
                urutan: urutan ?? 0,
                aktif: aktif !== undefined ? aktif : true,
                dibuatOleh: req.user.id,
            },
        });
        await (0, auditLogService_1.logManualAction)(req.user.id, 'cms_menu', client_1.AksiLog.TAMBAH, menu.label, `CMS menu baru: ${menu.label}`, menu.id, undefined, menu);
        res.json((0, response_1.successResponse)(menu));
    }
    catch (error) {
        next(error);
    }
});
// PUT /cms/menu/:id
router.put('/menu/:id', async (req, res, next) => {
    try {
        const id = parseInt(String(req.params.id));
        // @ts-ignore - Prisma client needs to be regenerated after schema update
        const before = await database_1.default.cmsMenu.findUnique({ where: { id } });
        if (!before)
            throw (0, response_1.errorResponse)('Menu tidak ditemukan', 404);
        const { label, path, urutan, aktif } = req.body;
        const data = {};
        if (label !== undefined)
            data.label = label;
        if (path !== undefined)
            data.path = path;
        if (urutan !== undefined)
            data.urutan = urutan;
        if (aktif !== undefined)
            data.aktif = aktif;
        // @ts-ignore - Prisma client needs to be regenerated after schema update
        const updated = await database_1.default.cmsMenu.update({ where: { id }, data });
        await (0, auditLogService_1.logManualAction)(req.user.id, 'cms_menu', client_1.AksiLog.UBAH, updated.label, `CMS menu diubah: ${updated.label}`, updated.id, before, updated);
        res.json((0, response_1.successResponse)(updated));
    }
    catch (error) {
        next(error);
    }
});
// DELETE /cms/menu/:id
router.delete('/menu/:id', async (req, res, next) => {
    try {
        const id = parseInt(String(req.params.id));
        // @ts-ignore - Prisma client needs to be regenerated after schema update
        const menu = await database_1.default.cmsMenu.findUnique({ where: { id } });
        if (!menu)
            throw (0, response_1.errorResponse)('Menu tidak ditemukan', 404);
        // @ts-ignore - Prisma client needs to be regenerated after schema update
        await database_1.default.cmsMenu.delete({ where: { id } });
        await (0, auditLogService_1.logManualAction)(req.user.id, 'cms_menu', client_1.AksiLog.HAPUS, menu.label, `CMS menu dihapus: ${menu.label}`, menu.id, menu, undefined);
        res.json((0, response_1.successResponse)({ message: 'Menu dihapus' }));
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
