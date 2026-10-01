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
// GET /free-tables
router.get('/', async (req, res, next) => {
    try {
        const tables = await database_1.default.tabelBebas.findMany({
            include: { kolom: { orderBy: { urutan: 'asc' } }, _count: { select: { baris: true } } },
            orderBy: { dibuatPada: 'desc' },
        });
        res.json((0, response_1.successResponse)(tables));
    }
    catch (error) {
        next(error);
    }
});
// GET /free-tables/:id
router.get('/:id', async (req, res, next) => {
    try {
        const id = parseInt(String(req.params.id));
        const table = await database_1.default.tabelBebas.findUnique({
            where: { id },
            include: { kolom: { orderBy: { urutan: 'asc' } }, baris: { orderBy: { dibuatPada: 'desc' } } },
        });
        if (!table)
            throw (0, response_1.errorResponse)('Tabel tidak ditemukan', 404);
        res.json((0, response_1.successResponse)(table));
    }
    catch (error) {
        next(error);
    }
});
// POST /free-tables  { nama_tabel, deskripsi, kolom: [{nama_kolom, tipe_data, opsi_dropdown}] }
router.post('/', async (req, res, next) => {
    try {
        const { nama_tabel, namaTabel, deskripsi, kolom } = req.body;
        const finalNama = namaTabel || nama_tabel;
        if (!finalNama)
            throw (0, response_1.errorResponse)('nama_tabel wajib diisi');
        const existing = await database_1.default.tabelBebas.findUnique({ where: { namaTabel: finalNama } });
        if (existing)
            throw (0, response_1.errorResponse)(`Nama tabel "${finalNama}" sudah dipakai`, 409);
        const kolomList = Array.isArray(kolom) ? kolom : [];
        for (const k of kolomList) {
            const tipe = k.tipeData || k.tipe_data;
            if (!k.namaKolom && !k.nama_kolom)
                throw (0, response_1.errorResponse)('Setiap kolom wajib punya nama_kolom');
            if (!['TEKS', 'ANGKA', 'TANGGAL', 'DROPDOWN'].includes(tipe)) {
                throw (0, response_1.errorResponse)('tipe_data kolom harus TEKS, ANGKA, TANGGAL, atau DROPDOWN');
            }
            if (tipe === 'DROPDOWN' && !(k.opsiDropdown || k.opsi_dropdown)?.length) {
                throw (0, response_1.errorResponse)(`Kolom "${k.namaKolom || k.nama_kolom}" bertipe DROPDOWN wajib punya opsi_dropdown`);
            }
        }
        const table = await database_1.default.tabelBebas.create({
            data: {
                namaTabel: finalNama,
                deskripsi: deskripsi || null,
                dibuatOleh: req.user.id,
                kolom: {
                    create: kolomList.map((k, idx) => ({
                        namaKolom: k.namaKolom || k.nama_kolom,
                        tipeData: (k.tipeData || k.tipe_data),
                        opsiDropdown: k.opsiDropdown || k.opsi_dropdown || undefined,
                        urutan: k.urutan ?? idx,
                    })),
                },
            },
            include: { kolom: true },
        });
        await (0, auditLogService_1.logManualAction)(req.user.id, 'tabel_bebas', client_1.AksiLog.TAMBAH, table.namaTabel, `Tabel bebas baru: ${table.namaTabel}`, table.id);
        res.json((0, response_1.successResponse)(table));
    }
    catch (error) {
        next(error);
    }
});
// PUT /free-tables/:id  (ubah nama/deskripsi tabel)
router.put('/:id', async (req, res, next) => {
    try {
        const id = parseInt(String(req.params.id));
        const before = await database_1.default.tabelBebas.findUnique({ where: { id } });
        if (!before)
            throw (0, response_1.errorResponse)('Tabel tidak ditemukan', 404);
        const { nama_tabel, namaTabel, deskripsi } = req.body;
        const data = {};
        if ((namaTabel || nama_tabel) !== undefined)
            data.namaTabel = namaTabel || nama_tabel;
        if (deskripsi !== undefined)
            data.deskripsi = deskripsi;
        const updated = await database_1.default.tabelBebas.update({ where: { id }, data });
        await (0, auditLogService_1.logManualAction)(req.user.id, 'tabel_bebas', client_1.AksiLog.UBAH, updated.namaTabel, `Tabel bebas diubah: ${updated.namaTabel}`, updated.id, before, updated);
        res.json((0, response_1.successResponse)(updated));
    }
    catch (error) {
        next(error);
    }
});
// DELETE /free-tables/:id  (cascade hapus kolom & baris - ini pendataan
// bebas, bukan data finansial, jadi cascade delete aman di sini)
router.delete('/:id', async (req, res, next) => {
    try {
        const id = parseInt(String(req.params.id));
        const table = await database_1.default.tabelBebas.findUnique({ where: { id } });
        if (!table)
            throw (0, response_1.errorResponse)('Tabel tidak ditemukan', 404);
        await database_1.default.tabelBebas.delete({ where: { id } });
        await (0, auditLogService_1.logManualAction)(req.user.id, 'tabel_bebas', client_1.AksiLog.HAPUS, table.namaTabel, `Tabel bebas dihapus: ${table.namaTabel}`, table.id);
        res.json((0, response_1.successResponse)({ message: 'Tabel dihapus' }));
    }
    catch (error) {
        next(error);
    }
});
// ---- Kolom ----
// POST /free-tables/:id/columns
router.post('/:id/columns', async (req, res, next) => {
    try {
        const tabelBebasId = parseInt(String(req.params.id));
        const table = await database_1.default.tabelBebas.findUnique({ where: { id: tabelBebasId } });
        if (!table)
            throw (0, response_1.errorResponse)('Tabel tidak ditemukan', 404);
        const { nama_kolom, namaKolom, tipe_data, tipeData, opsi_dropdown, opsiDropdown, urutan } = req.body;
        const finalNama = namaKolom || nama_kolom;
        const finalTipe = (tipeData || tipe_data);
        if (!finalNama || !finalTipe)
            throw (0, response_1.errorResponse)('nama_kolom dan tipe_data wajib diisi');
        if (!['TEKS', 'ANGKA', 'TANGGAL', 'DROPDOWN'].includes(finalTipe)) {
            throw (0, response_1.errorResponse)('tipe_data harus TEKS, ANGKA, TANGGAL, atau DROPDOWN');
        }
        if (finalTipe === 'DROPDOWN' && !(opsiDropdown || opsi_dropdown)?.length) {
            throw (0, response_1.errorResponse)('opsi_dropdown wajib diisi untuk tipe_data DROPDOWN');
        }
        const col = await database_1.default.kolomTabelBebas.create({
            data: {
                tabelBebasId,
                namaKolom: finalNama,
                tipeData: finalTipe,
                opsiDropdown: (opsiDropdown || opsi_dropdown) || undefined,
                urutan: urutan ?? 0,
            },
        });
        res.json((0, response_1.successResponse)(col));
    }
    catch (error) {
        next(error);
    }
});
// PUT /free-tables/:id/columns/:columnId
router.put('/:id/columns/:columnId', async (req, res, next) => {
    try {
        const columnId = parseInt(String(req.params.columnId));
        const before = await database_1.default.kolomTabelBebas.findUnique({ where: { id: columnId } });
        if (!before)
            throw (0, response_1.errorResponse)('Kolom tidak ditemukan', 404);
        const { nama_kolom, namaKolom, tipe_data, tipeData, opsi_dropdown, opsiDropdown, urutan } = req.body;
        const data = {};
        if ((namaKolom || nama_kolom) !== undefined)
            data.namaKolom = namaKolom || nama_kolom;
        if ((tipeData || tipe_data) !== undefined)
            data.tipeData = tipeData || tipe_data;
        if ((opsiDropdown || opsi_dropdown) !== undefined)
            data.opsiDropdown = opsiDropdown || opsi_dropdown;
        if (urutan !== undefined)
            data.urutan = urutan;
        const updated = await database_1.default.kolomTabelBebas.update({ where: { id: columnId }, data });
        res.json((0, response_1.successResponse)(updated));
    }
    catch (error) {
        next(error);
    }
});
// DELETE /free-tables/:id/columns/:columnId
// (Tabel bebas murni pendataan, bukan akuntansi - hard delete kolom
// termasuk data barisnya dianggap acceptable di sini, beda dengan
// KolomCustom di Master Transaksi yang soft-delete.)
router.delete('/:id/columns/:columnId', async (req, res, next) => {
    try {
        const columnId = parseInt(String(req.params.columnId));
        const col = await database_1.default.kolomTabelBebas.findUnique({ where: { id: columnId } });
        if (!col)
            throw (0, response_1.errorResponse)('Kolom tidak ditemukan', 404);
        await database_1.default.kolomTabelBebas.delete({ where: { id: columnId } });
        res.json((0, response_1.successResponse)({ message: 'Kolom dihapus' }));
    }
    catch (error) {
        next(error);
    }
});
// ---- Baris ----
// POST /free-tables/:id/rows  { data: { "<kolomId>": value, ... } }
router.post('/:id/rows', async (req, res, next) => {
    try {
        const tabelBebasId = parseInt(String(req.params.id));
        const table = await database_1.default.tabelBebas.findUnique({ where: { id: tabelBebasId } });
        if (!table)
            throw (0, response_1.errorResponse)('Tabel tidak ditemukan', 404);
        const { data } = req.body;
        if (!data || typeof data !== 'object')
            throw (0, response_1.errorResponse)('data (object) wajib diisi');
        const row = await database_1.default.barisTabelBebas.create({ data: { tabelBebasId, data } });
        await (0, auditLogService_1.logManualAction)(req.user.id, 'baris_tabel_bebas', client_1.AksiLog.TAMBAH, table.namaTabel, `Baris baru di "${table.namaTabel}"`, row.id);
        res.json((0, response_1.successResponse)(row));
    }
    catch (error) {
        next(error);
    }
});
// PUT /free-tables/:id/rows/:rowId
router.put('/:id/rows/:rowId', async (req, res, next) => {
    try {
        const rowId = parseInt(String(req.params.rowId));
        const before = await database_1.default.barisTabelBebas.findUnique({ where: { id: rowId } });
        if (!before)
            throw (0, response_1.errorResponse)('Baris tidak ditemukan', 404);
        const { data } = req.body;
        if (!data || typeof data !== 'object')
            throw (0, response_1.errorResponse)('data (object) wajib diisi');
        const updated = await database_1.default.barisTabelBebas.update({ where: { id: rowId }, data: { data } });
        res.json((0, response_1.successResponse)(updated));
    }
    catch (error) {
        next(error);
    }
});
// DELETE /free-tables/:id/rows/:rowId
router.delete('/:id/rows/:rowId', async (req, res, next) => {
    try {
        const rowId = parseInt(String(req.params.rowId));
        const row = await database_1.default.barisTabelBebas.findUnique({ where: { id: rowId } });
        if (!row)
            throw (0, response_1.errorResponse)('Baris tidak ditemukan', 404);
        await database_1.default.barisTabelBebas.delete({ where: { id: rowId } });
        res.json((0, response_1.successResponse)({ message: 'Baris dihapus' }));
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
