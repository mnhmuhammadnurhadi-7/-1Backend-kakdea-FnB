"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJenisBawaan = exports.KODE_JENIS_BAWAAN = void 0;
const database_1 = __importDefault(require("./database"));
const response_1 = require("./response");
/**
 * Kode JenisTransaksi bawaan yang di-seed lewat prisma/seed.ts supaya
 * order & pembayaran hutang langsung jalan tanpa setup manual. Ini CUMA
 * daftar kode acuan untuk kode kita sendiri (orders.ts, debts.ts) -
 * jenisnya sendiri tetap baris biasa di tabel jenis_transaksi yang full
 * CRUD oleh user (lihat isBawaan flag di schema).
 */
exports.KODE_JENIS_BAWAAN = {
    PENDAPATAN_FROZEN: 'DO1',
    PENDAPATAN_SIAP_SAJI: 'DO2',
    PEMBAYARAN_CICILAN_HUTANG: 'MT1',
};
/**
 * Ambil JenisTransaksi berdasarkan kode bawaan. Kalau user sudah
 * menghapus/mengubah jenis bawaan ini (dia full-CRUD, jadi ini mungkin
 * terjadi), lempar error yang jelas alih-alih gagal diam-diam - order/
 * hutang butuh jenis ini supaya debit=kredit tetap valid.
 */
const getJenisBawaan = async (kode) => {
    const jenis = await database_1.default.jenisTransaksi.findUnique({ where: { kode } });
    if (!jenis || !jenis.aktif) {
        throw (0, response_1.errorResponse)(`Jenis transaksi bawaan "${kode}" tidak ditemukan atau nonaktif. ` +
            `Cek di Master Transaksi - fitur ini butuh jenis tersebut untuk mencatat entrinya.`, 500);
    }
    return jenis;
};
exports.getJenisBawaan = getJenisBawaan;
