import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import prisma from '../utils/database';
import * as XLSX from 'xlsx';

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

// GET /reports/export/transactions — download Excel file
router.get('/export/transactions', async (req: AuthRequest, res: Response, next) => {
  try {
    const { jenis_transaksi_id, tanggal_mulai, tanggal_selesai } = req.query;
    const where: any = {};
    if (jenis_transaksi_id) where.jenisTransaksiId = parseInt(String(jenis_transaksi_id));
    if (tanggal_mulai || tanggal_selesai) {
      where.tanggal = {};
      if (tanggal_mulai) where.tanggal.gte = new Date(tanggal_mulai as string);
      if (tanggal_selesai) where.tanggal.lte = new Date(tanggal_selesai as string);
    }

    const transactions = await prisma.transaksi.findMany({
      where,
      include: { jenisTransaksi: true },
      orderBy: { tanggal: 'desc' },
    });

    const rows = transactions.map(t => ({
      'Kode': t.kode,
      'Tanggal': t.tanggal.toISOString().split('T')[0],
      'Jenis Transaksi': t.namaTransaksi,
      'Keterangan': t.detail || '',
      'Nominal': Number(t.nominal),
      'Debit': t.debit || '',
      'Kredit': t.kredit || '',
      'Arah': t.jenisTransaksi?.arah || '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transaksi');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=transaksi_${Date.now()}.xlsx`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    next(error);
  }
});

// GET /reports/export/free-table/:id — download Tabel Bebas as Excel
router.get('/export/free-table/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const id = parseInt(String(req.params.id));
    const table = await prisma.tabelBebas.findUnique({
      where: { id },
      include: {
        kolom: { orderBy: { urutan: 'asc' } },
        baris: { orderBy: { dibuatPada: 'desc' } },
      },
    });
    if (!table) throw errorResponse('Tabel tidak ditemukan', 404);

    const rows = table.baris.map(b => {
      const rowData: Record<string, any> = {};
      for (const k of table.kolom) {
        rowData[k.namaKolom] = (b.data as any)?.[String(k.id)] ?? '';
      }
      return rowData;
    });

    const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{}]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, table.namaTabel.slice(0, 31));
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const safeName = table.namaTabel.replace(/[^a-zA-Z0-9]/g, '_');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${safeName}_${Date.now()}.xlsx`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    next(error);
  }
});

export default router;
