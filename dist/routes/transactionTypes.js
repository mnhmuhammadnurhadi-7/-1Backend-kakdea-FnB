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
// ================= JENIS TRANSAKSI (Master Transaksi) =================
// Ini daftar "tab" (Biaya Tak Langsung, Frozen Food, dst) - dipakai
// webf buat generate ChipSelector dinamis. Endpoint feed gabungan semua
// entrinya sendiri ada di GET /transactions (tanpa filter).
// GET /transaction-types
router.get('/', async (req, res, next) => {
    try {
        const { unit_bisnis, business_unit, aktif } = req.query;
        const finalUnit = unit_bisnis || business_unit;
        const where = {};
        if (finalUnit)
            where.unitBisnis = finalUnit;
        if (aktif !== undefined)
            where.aktif = aktif === 'true';
        else
            where.aktif = true;
        const jenisList = await database_1.default.jenisTransaksi.findMany({
            where,
            include: {
                kolomCustom: { where: { aktif: true }, orderBy: { urutan: 'asc' } },
                _count: { select: { transaksi: true } },
            },
            orderBy: { kode: 'asc' },
        });
        res.json((0, response_1.successResponse)(jenisList));
    }
    catch (error) {
        next(error);
    }
});
// GET /transaction-types/:id
router.get('/:id', async (req, res, next) => {
    try {
        const id = parseInt(String(req.params.id));
        const jenis = await database_1.default.jenisTransaksi.findUnique({
            where: { id },
            include: { kolomCustom: { where: { aktif: true }, orderBy: { urutan: 'asc' } } },
        });
        if (!jenis)
            throw (0, response_1.errorResponse)('Jenis transaksi tidak ditemukan', 404);
        res.json((0, response_1.successResponse)(jenis));
    }
    catch (error) {
        next(error);
    }
});
// POST /transaction-types  -- buat jenis baru. Cuma kode, nama, arah
// yang wajib - jenisAkun sekadar saran teks bebas, opsional.
router.post('/', async (req, res, next) => {
    try {
        const { kode, nama_transaksi, namaTransaksi, arah, jenis_akun, jenisAkun, unit_bisnis, unitBisnis } = req.body;
        const finalKode = kode;
        const finalNama = namaTransaksi || nama_transaksi;
        const finalArah = arah;
        if (!finalKode || !finalNama || !finalArah) {
            throw (0, response_1.errorResponse)('kode, nama_transaksi, dan arah wajib diisi');
        }
        if (!['PEMASUKAN', 'PENGELUARAN'].includes(finalArah)) {
            throw (0, response_1.errorResponse)('arah harus PEMASUKAN atau PENGELUARAN');
        }
        const existing = await database_1.default.jenisTransaksi.findUnique({ where: { kode: finalKode } });
        if (existing)
            throw (0, response_1.errorResponse)(`Kode "${finalKode}" sudah dipakai`, 409);
        const jenis = await database_1.default.jenisTransaksi.create({
            data: {
                kode: finalKode,
                namaTransaksi: finalNama,
                arah: finalArah,
                jenisAkun: jenisAkun || jenis_akun || null,
                unitBisnis: unitBisnis || unit_bisnis || null,
                dibuatOleh: req.user.id,
            },
        });
        await (0, auditLogService_1.logManualAction)(req.user.id, 'jenis_transaksi', client_1.AksiLog.TAMBAH, jenis.namaTransaksi, `Jenis transaksi baru: ${jenis.kode} - ${jenis.namaTransaksi}`, jenis.id, undefined, jenis);
        res.json((0, response_1.successResponse)(jenis));
    }
    catch (error) {
        next(error);
    }
});
// PUT /transaction-types/:id  -- ini juga yang dipakai modal "Edit Table"
// (ubah nama/arah/jenisAkun jenis, bukan edit satu baris entri)
router.put('/:id', async (req, res, next) => {
    try {
        const id = parseInt(String(req.params.id));
        const before = await database_1.default.jenisTransaksi.findUnique({ where: { id } });
        if (!before)
            throw (0, response_1.errorResponse)('Jenis transaksi tidak ditemukan', 404);
        const { kode, nama_transaksi, namaTransaksi, arah, jenis_akun, jenisAkun, unit_bisnis, unitBisnis, aktif } = req.body;
        const data = {};
        if (kode !== undefined)
            data.kode = kode;
        if ((namaTransaksi ?? nama_transaksi) !== undefined)
            data.namaTransaksi = namaTransaksi ?? nama_transaksi;
        if (arah !== undefined) {
            if (!['PEMASUKAN', 'PENGELUARAN'].includes(arah)) {
                throw (0, response_1.errorResponse)('arah harus PEMASUKAN atau PENGELUARAN');
            }
            data.arah = arah;
        }
        if ((jenisAkun ?? jenis_akun) !== undefined)
            data.jenisAkun = jenisAkun ?? jenis_akun;
        if ((unitBisnis ?? unit_bisnis) !== undefined)
            data.unitBisnis = unitBisnis ?? unit_bisnis;
        if (aktif !== undefined)
            data.aktif = aktif;
        const updated = await database_1.default.jenisTransaksi.update({ where: { id }, data });
        await (0, auditLogService_1.logManualAction)(req.user.id, 'jenis_transaksi', client_1.AksiLog.UBAH, updated.namaTransaksi, `Jenis transaksi diubah: ${updated.kode}`, updated.id, before, updated);
        res.json((0, response_1.successResponse)(updated));
    }
    catch (error) {
        next(error);
    }
});
// DELETE /transaction-types/:id  -- ini "Hapus Table" di modal Edit Table.
// Menolak hapus kalau masih ada entri (409) - sarankan nonaktifkan.
router.delete('/:id', async (req, res, next) => {
    try {
        const id = parseInt(String(req.params.id));
        const jenis = await database_1.default.jenisTransaksi.findUnique({ where: { id } });
        if (!jenis)
            throw (0, response_1.errorResponse)('Jenis transaksi tidak ditemukan', 404);
        const jumlahEntri = await database_1.default.transaksi.count({ where: { jenisTransaksiId: id } });
        if (jumlahEntri > 0) {
            throw (0, response_1.errorResponse)(`Tidak bisa hapus - masih ada ${jumlahEntri} entri transaksi yang memakai jenis ini. ` +
                `Nonaktifkan saja (PUT dengan aktif=false) kalau tidak mau dipakai lagi.`, 409);
        }
        await database_1.default.$transaction(async (tx) => {
            await tx.kolomCustom.deleteMany({ where: { jenisTransaksiId: id } });
            await tx.jenisTransaksi.delete({ where: { id } });
        });
        await (0, auditLogService_1.logManualAction)(req.user.id, 'jenis_transaksi', client_1.AksiLog.HAPUS, jenis.namaTransaksi, `Jenis transaksi dihapus: ${jenis.kode}`, jenis.id, jenis, undefined);
        res.json((0, response_1.successResponse)({ message: 'Jenis transaksi dihapus' }));
    }
    catch (error) {
        next(error);
    }
});
// ================= KOLOM CUSTOM (per Jenis Transaksi) =================
// Tidak berubah dari revisi sebelumnya.
// GET /transaction-types/:id/columns
router.get('/:id/columns', async (req, res, next) => {
    try {
        const jenisTransaksiId = parseInt(String(req.params.id));
        const kolom = await database_1.default.kolomCustom.findMany({
            where: { jenisTransaksiId, aktif: true },
            orderBy: { urutan: 'asc' },
        });
        res.json((0, response_1.successResponse)(kolom));
    }
    catch (error) {
        next(error);
    }
});
// POST /transaction-types/:id/columns
router.post('/:id/columns', async (req, res, next) => {
    try {
        const jenisTransaksiId = parseInt(String(req.params.id));
        const jenis = await database_1.default.jenisTransaksi.findUnique({ where: { id: jenisTransaksiId } });
        if (!jenis)
            throw (0, response_1.errorResponse)('Jenis transaksi tidak ditemukan', 404);
        const { nama_kolom, namaKolom, tipe_data, tipeData, opsi_dropdown, opsiDropdown, urutan } = req.body;
        const finalNama = namaKolom || nama_kolom;
        const finalTipe = (tipeData || tipe_data);
        const finalOpsi = opsiDropdown || opsi_dropdown;
        if (!finalNama || !finalTipe) {
            throw (0, response_1.errorResponse)('nama_kolom dan tipe_data wajib diisi');
        }
        if (!['TEKS', 'ANGKA', 'TANGGAL', 'DROPDOWN'].includes(finalTipe)) {
            throw (0, response_1.errorResponse)('tipe_data harus TEKS, ANGKA, TANGGAL, atau DROPDOWN');
        }
        if (finalTipe === 'DROPDOWN' && (!finalOpsi || !Array.isArray(finalOpsi) || finalOpsi.length === 0)) {
            throw (0, response_1.errorResponse)('opsi_dropdown wajib diisi (array tidak kosong) untuk tipe_data DROPDOWN');
        }
        const kolom = await database_1.default.kolomCustom.create({
            data: {
                jenisTransaksiId,
                namaKolom: finalNama,
                tipeData: finalTipe,
                opsiDropdown: finalTipe === 'DROPDOWN' ? finalOpsi : undefined,
                urutan: urutan ?? 0,
                dibuatOleh: req.user.id,
            },
        });
        await (0, auditLogService_1.logManualAction)(req.user.id, 'kolom_custom', client_1.AksiLog.TAMBAH, kolom.namaKolom, `Kolom custom baru di jenis "${jenis.namaTransaksi}": ${kolom.namaKolom}`, kolom.id);
        res.json((0, response_1.successResponse)(kolom));
    }
    catch (error) {
        next(error);
    }
});
// PUT /transaction-types/:id/columns/:columnId
router.put('/:id/columns/:columnId', async (req, res, next) => {
    try {
        const columnId = parseInt(String(req.params.columnId));
        const before = await database_1.default.kolomCustom.findUnique({ where: { id: columnId } });
        if (!before)
            throw (0, response_1.errorResponse)('Kolom tidak ditemukan', 404);
        const { nama_kolom, namaKolom, tipe_data, tipeData, opsi_dropdown, opsiDropdown, urutan } = req.body;
        const data = {};
        if ((namaKolom || nama_kolom) !== undefined)
            data.namaKolom = namaKolom || nama_kolom;
        if ((tipeData || tipe_data) !== undefined) {
            const t = tipeData || tipe_data;
            if (!['TEKS', 'ANGKA', 'TANGGAL', 'DROPDOWN'].includes(t)) {
                throw (0, response_1.errorResponse)('tipe_data harus TEKS, ANGKA, TANGGAL, atau DROPDOWN');
            }
            data.tipeData = t;
        }
        if ((opsiDropdown || opsi_dropdown) !== undefined)
            data.opsiDropdown = opsiDropdown || opsi_dropdown;
        if (urutan !== undefined)
            data.urutan = urutan;
        const updated = await database_1.default.kolomCustom.update({ where: { id: columnId }, data });
        await (0, auditLogService_1.logManualAction)(req.user.id, 'kolom_custom', client_1.AksiLog.UBAH, updated.namaKolom, `Kolom custom diubah: ${updated.namaKolom}`, updated.id, before, updated);
        res.json((0, response_1.successResponse)(updated));
    }
    catch (error) {
        next(error);
    }
});
// DELETE /transaction-types/:id/columns/:columnId
router.delete('/:id/columns/:columnId', async (req, res, next) => {
    try {
        const columnId = parseInt(String(req.params.columnId));
        const kolom = await database_1.default.kolomCustom.findUnique({ where: { id: columnId } });
        if (!kolom)
            throw (0, response_1.errorResponse)('Kolom tidak ditemukan', 404);
        const pakaiRows = await database_1.default.$queryRaw `
      SELECT COUNT(*) as cnt FROM transaksi
      WHERE jenis_transaksi_id = ${kolom.jenisTransaksiId}
        AND JSON_CONTAINS_PATH(custom_data, 'one', ${'$."' + columnId + '"'})
    `;
        const dipakai = Number(pakaiRows[0]?.cnt || 0) > 0;
        if (dipakai) {
            const updated = await database_1.default.kolomCustom.update({
                where: { id: columnId },
                data: { aktif: false },
            });
            await (0, auditLogService_1.logManualAction)(req.user.id, 'kolom_custom', client_1.AksiLog.UBAH, updated.namaKolom, `Kolom custom dinonaktifkan (masih ada data historis): ${updated.namaKolom}`, updated.id);
            return res.json((0, response_1.successResponse)(updated, 'Kolom masih punya data historis - dinonaktifkan, bukan dihapus permanen'));
        }
        await database_1.default.kolomCustom.delete({ where: { id: columnId } });
        await (0, auditLogService_1.logManualAction)(req.user.id, 'kolom_custom', client_1.AksiLog.HAPUS, kolom.namaKolom, `Kolom custom dihapus: ${kolom.namaKolom}`, kolom.id);
        res.json((0, response_1.successResponse)({ message: 'Kolom dihapus' }));
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
