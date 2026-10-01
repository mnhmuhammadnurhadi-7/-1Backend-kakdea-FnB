import prisma from './database';
import { errorResponse } from './response';

/**
 * Kode JenisTransaksi bawaan yang di-seed lewat prisma/seed.ts supaya
 * order & pembayaran hutang langsung jalan tanpa setup manual. Ini CUMA
 * daftar kode acuan untuk kode kita sendiri (orders.ts, debts.ts) -
 * jenisnya sendiri tetap baris biasa di tabel jenis_transaksi yang full
 * CRUD oleh user (lihat isBawaan flag di schema).
 */
export const KODE_JENIS_BAWAAN = {
  PENDAPATAN_FROZEN: 'DO1',
  PENDAPATAN_SIAP_SAJI: 'DO2',
  PEMBAYARAN_CICILAN_HUTANG: 'MT1',
} as const;

/**
 * Ambil JenisTransaksi berdasarkan kode bawaan. Kalau user sudah
 * menghapus/mengubah jenis bawaan ini (dia full-CRUD, jadi ini mungkin
 * terjadi), lempar error yang jelas alih-alih gagal diam-diam - order/
 * hutang butuh jenis ini supaya debit=kredit tetap valid.
 */
export const getJenisBawaan = async (kode: string) => {
  const jenis = await prisma.jenisTransaksi.findUnique({ where: { kode } });
  if (!jenis || !jenis.aktif) {
    throw errorResponse(
      `Jenis transaksi bawaan "${kode}" tidak ditemukan atau nonaktif. ` +
        `Cek di Master Transaksi - fitur ini butuh jenis tersebut untuk mencatat entrinya.`,
      500
    );
  }
  return jenis;
};
