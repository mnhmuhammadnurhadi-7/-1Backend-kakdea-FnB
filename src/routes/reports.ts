import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import prisma from '../utils/database';

const router = Router();

router.use(authenticate);

// GET /reports/neraca
// DINONAKTIFKAN sejak 29 Sep 2026: Debit/Kredit di Transaksi sekarang
// teks bebas yang diketik user (bukan referensi akun yang konsisten),
// jadi Neraca (Aset = Hutang + Modal) tidak bisa dihitung otomatis lagi.
// Ini keputusan sadar - lihat schema-decisions.md. Endpoint dipertahankan
// (bukan dihapus) supaya frontend lama tidak 404 keras, tapi selalu
// menjawab "tidak tersedia" - JANGAN mengembalikan angka yang terlihat
// benar padahal sebenarnya kosong/salah.
router.get('/neraca', async (req: AuthRequest, res: Response, next) => {
  try {
    throw errorResponse(
      'Neraca otomatis tidak tersedia - Debit/Kredit sekarang teks bebas (bukan akun yang divalidasi), ' +
        'jadi saldo per akun tidak bisa dihitung otomatis lagi. Ini keputusan scope yang disepakati.',
      501
    );
  } catch (error) {
    next(error);
  }
});

// GET /reports/laba-rugi
// Dihitung LANGSUNG dari Transaksi + JenisTransaksi.arah (bukan dari
// jurnal lagi) - ini yang tetap dalam scope karena cuma butuh nominal
// + arah (Pemasukan/Pengeluaran), tidak butuh Debit/Kredit sama sekali.
router.get('/laba-rugi', async (req: AuthRequest, res: Response, next) => {
  try {
    const { tanggal_mulai, tanggal_selesai, business_unit, unit_bisnis } = req.query;

    const startDate = tanggal_mulai ? new Date(tanggal_mulai as string) : new Date(new Date().setDate(new Date().getDate() - 30));
    const endDate = tanggal_selesai ? new Date(tanggal_selesai as string) : new Date();
    const finalUnit = unit_bisnis || business_unit;

    const where: any = {
      tanggal: { gte: startDate, lte: endDate },
    };
    if (finalUnit) where.unitBisnis = finalUnit as string;

    const rows = await prisma.transaksi.groupBy({
      by: ['jenisTransaksiId'],
      where,
      _sum: { nominal: true },
    });

    const jenisIds = rows.map((r) => r.jenisTransaksiId);
    const jenisList = await prisma.jenisTransaksi.findMany({ where: { id: { in: jenisIds } } });
    const jenisMap = new Map(jenisList.map((j) => [j.id, j]));

    const perJenis = rows.map((r) => {
      const jenis = jenisMap.get(r.jenisTransaksiId);
      return {
        jenis_transaksi_id: r.jenisTransaksiId,
        kode: jenis?.kode,
        nama_transaksi: jenis?.namaTransaksi,
        arah: jenis?.arah,
        jumlah: Number(r._sum.nominal || 0),
      };
    });

    const totalPemasukan = perJenis.filter((p) => p.arah === 'PEMASUKAN').reduce((sum, p) => sum + p.jumlah, 0);
    const totalPengeluaran = perJenis.filter((p) => p.arah === 'PENGELUARAN').reduce((sum, p) => sum + p.jumlah, 0);
    const labaBersih = totalPemasukan - totalPengeluaran;

    res.json(
      successResponse({
        per_jenis: perJenis,
        totals: {
          total_pemasukan: totalPemasukan,
          total_pengeluaran: totalPengeluaran,
          laba_bersih: labaBersih,
        },
      })
    );
  } catch (error) {
    next(error);
  }
});

// GET /reports/perubahan-modal
// DINONAKTIFKAN dengan alasan sama seperti Neraca (butuh akun MODAL yang
// tervalidasi, sudah tidak ada sejak Debit/Kredit jadi teks bebas).
router.get('/perubahan-modal', async (req: AuthRequest, res: Response, next) => {
  try {
    throw errorResponse(
      'Laporan perubahan modal tidak tersedia - bergantung pada akun yang divalidasi (Neraca), ' +
        'yang sudah di luar scope sejak Debit/Kredit jadi teks bebas.',
      501
    );
  } catch (error) {
    next(error);
  }
});

// GET /reports/export (placeholder for Excel export)
router.get('/export', async (req: AuthRequest, res: Response, next) => {
  try {
    const { type, format } = req.query;

    res.json(successResponse({
      message: 'Export functionality - generates Excel file',
      type,
      format,
    }));
  } catch (error) {
    next(error);
  }
});

export default router;
