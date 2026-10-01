import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import prisma from '../utils/database';
import { logManualAction } from '../services/auditLogService';
import { AksiLog, ArahTransaksi, TipeDataKolom } from '@prisma/client';

const router = Router();

router.use(authenticate);

// ================= JENIS TRANSAKSI (Master Transaksi) =================
// Ini daftar "tab" (Biaya Tak Langsung, Frozen Food, dst) - dipakai
// webf buat generate ChipSelector dinamis. Endpoint feed gabungan semua
// entrinya sendiri ada di GET /transactions (tanpa filter).

// GET /transaction-types
router.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const { unit_bisnis, business_unit, aktif } = req.query;
    const finalUnit = unit_bisnis || business_unit;

    const where: any = {};
    if (finalUnit) where.unitBisnis = finalUnit as string;
    if (aktif !== undefined) where.aktif = aktif === 'true';
    else where.aktif = true;

    const jenisList = await prisma.jenisTransaksi.findMany({
      where,
      include: {
        kolomCustom: { where: { aktif: true }, orderBy: { urutan: 'asc' } },
        _count: { select: { transaksi: true } },
      },
      orderBy: { kode: 'asc' },
    });

    res.json(successResponse(jenisList));
  } catch (error) {
    next(error);
  }
});

// GET /transaction-types/:id
router.get('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const id = parseInt(String(req.params.id));
    const jenis = await prisma.jenisTransaksi.findUnique({
      where: { id },
      include: { kolomCustom: { where: { aktif: true }, orderBy: { urutan: 'asc' } } },
    });
    if (!jenis) throw errorResponse('Jenis transaksi tidak ditemukan', 404);
    res.json(successResponse(jenis));
  } catch (error) {
    next(error);
  }
});

// POST /transaction-types  -- buat jenis baru. Cuma kode, nama, arah
// yang wajib - jenisAkun sekadar saran teks bebas, opsional.
router.post('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const { kode, nama_transaksi, namaTransaksi, arah, jenis_akun, jenisAkun, unit_bisnis, unitBisnis } = req.body;

    const finalKode = kode;
    const finalNama = namaTransaksi || nama_transaksi;
    const finalArah = arah as ArahTransaksi;

    if (!finalKode || !finalNama || !finalArah) {
      throw errorResponse('kode, nama_transaksi, dan arah wajib diisi');
    }
    if (!['PEMASUKAN', 'PENGELUARAN'].includes(finalArah)) {
      throw errorResponse('arah harus PEMASUKAN atau PENGELUARAN');
    }

    const existing = await prisma.jenisTransaksi.findUnique({ where: { kode: finalKode } });
    if (existing) throw errorResponse(`Kode "${finalKode}" sudah dipakai`, 409);

    const jenis = await prisma.jenisTransaksi.create({
      data: {
        kode: finalKode,
        namaTransaksi: finalNama,
        arah: finalArah,
        jenisAkun: jenisAkun || jenis_akun || null,
        unitBisnis: unitBisnis || unit_bisnis || null,
        dibuatOleh: req.user!.id,
      },
    });

    await logManualAction(
      req.user!.id,
      'jenis_transaksi',
      AksiLog.TAMBAH,
      jenis.namaTransaksi,
      `Jenis transaksi baru: ${jenis.kode} - ${jenis.namaTransaksi}`,
      jenis.id,
      undefined,
      jenis
    );

    res.json(successResponse(jenis));
  } catch (error) {
    next(error);
  }
});

// PUT /transaction-types/:id  -- ini juga yang dipakai modal "Edit Table"
// (ubah nama/arah/jenisAkun jenis, bukan edit satu baris entri)
router.put('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const id = parseInt(String(req.params.id));
    const before = await prisma.jenisTransaksi.findUnique({ where: { id } });
    if (!before) throw errorResponse('Jenis transaksi tidak ditemukan', 404);

    const { kode, nama_transaksi, namaTransaksi, arah, jenis_akun, jenisAkun, unit_bisnis, unitBisnis, aktif } = req.body;

    const data: any = {};
    if (kode !== undefined) data.kode = kode;
    if ((namaTransaksi ?? nama_transaksi) !== undefined) data.namaTransaksi = namaTransaksi ?? nama_transaksi;
    if (arah !== undefined) {
      if (!['PEMASUKAN', 'PENGELUARAN'].includes(arah)) {
        throw errorResponse('arah harus PEMASUKAN atau PENGELUARAN');
      }
      data.arah = arah;
    }
    if ((jenisAkun ?? jenis_akun) !== undefined) data.jenisAkun = jenisAkun ?? jenis_akun;
    if ((unitBisnis ?? unit_bisnis) !== undefined) data.unitBisnis = unitBisnis ?? unit_bisnis;
    if (aktif !== undefined) data.aktif = aktif;

    const updated = await prisma.jenisTransaksi.update({ where: { id }, data });

    await logManualAction(
      req.user!.id,
      'jenis_transaksi',
      AksiLog.UBAH,
      updated.namaTransaksi,
      `Jenis transaksi diubah: ${updated.kode}`,
      updated.id,
      before,
      updated
    );

    res.json(successResponse(updated));
  } catch (error) {
    next(error);
  }
});

// DELETE /transaction-types/:id  -- ini "Hapus Table" di modal Edit Table.
// Menolak hapus kalau masih ada entri (409) - sarankan nonaktifkan.
router.delete('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const id = parseInt(String(req.params.id));
    const jenis = await prisma.jenisTransaksi.findUnique({ where: { id } });
    if (!jenis) throw errorResponse('Jenis transaksi tidak ditemukan', 404);

    const jumlahEntri = await prisma.transaksi.count({ where: { jenisTransaksiId: id } });
    if (jumlahEntri > 0) {
      throw errorResponse(
        `Tidak bisa hapus - masih ada ${jumlahEntri} entri transaksi yang memakai jenis ini. ` +
          `Nonaktifkan saja (PUT dengan aktif=false) kalau tidak mau dipakai lagi.`,
        409
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.kolomCustom.deleteMany({ where: { jenisTransaksiId: id } });
      await tx.jenisTransaksi.delete({ where: { id } });
    });

    await logManualAction(
      req.user!.id,
      'jenis_transaksi',
      AksiLog.HAPUS,
      jenis.namaTransaksi,
      `Jenis transaksi dihapus: ${jenis.kode}`,
      jenis.id,
      jenis,
      undefined
    );

    res.json(successResponse({ message: 'Jenis transaksi dihapus' }));
  } catch (error) {
    next(error);
  }
});

// ================= KOLOM CUSTOM (per Jenis Transaksi) =================
// Tidak berubah dari revisi sebelumnya.

// GET /transaction-types/:id/columns
router.get('/:id/columns', async (req: AuthRequest, res: Response, next) => {
  try {
    const jenisTransaksiId = parseInt(String(req.params.id));
    const kolom = await prisma.kolomCustom.findMany({
      where: { jenisTransaksiId, aktif: true },
      orderBy: { urutan: 'asc' },
    });
    res.json(successResponse(kolom));
  } catch (error) {
    next(error);
  }
});

// POST /transaction-types/:id/columns
router.post('/:id/columns', async (req: AuthRequest, res: Response, next) => {
  try {
    const jenisTransaksiId = parseInt(String(req.params.id));
    const jenis = await prisma.jenisTransaksi.findUnique({ where: { id: jenisTransaksiId } });
    if (!jenis) throw errorResponse('Jenis transaksi tidak ditemukan', 404);

    const { nama_kolom, namaKolom, tipe_data, tipeData, opsi_dropdown, opsiDropdown, urutan } = req.body;

    const finalNama = namaKolom || nama_kolom;
    const finalTipe = (tipeData || tipe_data) as TipeDataKolom;
    const finalOpsi = opsiDropdown || opsi_dropdown;

    if (!finalNama || !finalTipe) {
      throw errorResponse('nama_kolom dan tipe_data wajib diisi');
    }
    if (!['TEKS', 'ANGKA', 'TANGGAL', 'DROPDOWN'].includes(finalTipe)) {
      throw errorResponse('tipe_data harus TEKS, ANGKA, TANGGAL, atau DROPDOWN');
    }
    if (finalTipe === 'DROPDOWN' && (!finalOpsi || !Array.isArray(finalOpsi) || finalOpsi.length === 0)) {
      throw errorResponse('opsi_dropdown wajib diisi (array tidak kosong) untuk tipe_data DROPDOWN');
    }

    const kolom = await prisma.kolomCustom.create({
      data: {
        jenisTransaksiId,
        namaKolom: finalNama,
        tipeData: finalTipe,
        opsiDropdown: finalTipe === 'DROPDOWN' ? finalOpsi : undefined,
        urutan: urutan ?? 0,
        dibuatOleh: req.user!.id,
      },
    });

    await logManualAction(
      req.user!.id,
      'kolom_custom',
      AksiLog.TAMBAH,
      kolom.namaKolom,
      `Kolom custom baru di jenis "${jenis.namaTransaksi}": ${kolom.namaKolom}`,
      kolom.id
    );

    res.json(successResponse(kolom));
  } catch (error) {
    next(error);
  }
});

// PUT /transaction-types/:id/columns/:columnId
router.put('/:id/columns/:columnId', async (req: AuthRequest, res: Response, next) => {
  try {
    const columnId = parseInt(String(req.params.columnId));
    const before = await prisma.kolomCustom.findUnique({ where: { id: columnId } });
    if (!before) throw errorResponse('Kolom tidak ditemukan', 404);

    const { nama_kolom, namaKolom, tipe_data, tipeData, opsi_dropdown, opsiDropdown, urutan } = req.body;
    const data: any = {};
    if ((namaKolom || nama_kolom) !== undefined) data.namaKolom = namaKolom || nama_kolom;
    if ((tipeData || tipe_data) !== undefined) {
      const t = tipeData || tipe_data;
      if (!['TEKS', 'ANGKA', 'TANGGAL', 'DROPDOWN'].includes(t)) {
        throw errorResponse('tipe_data harus TEKS, ANGKA, TANGGAL, atau DROPDOWN');
      }
      data.tipeData = t;
    }
    if ((opsiDropdown || opsi_dropdown) !== undefined) data.opsiDropdown = opsiDropdown || opsi_dropdown;
    if (urutan !== undefined) data.urutan = urutan;

    const updated = await prisma.kolomCustom.update({ where: { id: columnId }, data });

    await logManualAction(
      req.user!.id,
      'kolom_custom',
      AksiLog.UBAH,
      updated.namaKolom,
      `Kolom custom diubah: ${updated.namaKolom}`,
      updated.id,
      before,
      updated
    );

    res.json(successResponse(updated));
  } catch (error) {
    next(error);
  }
});

// DELETE /transaction-types/:id/columns/:columnId
router.delete('/:id/columns/:columnId', async (req: AuthRequest, res: Response, next) => {
  try {
    const columnId = parseInt(String(req.params.columnId));
    const kolom = await prisma.kolomCustom.findUnique({ where: { id: columnId } });
    if (!kolom) throw errorResponse('Kolom tidak ditemukan', 404);

    const pakaiRows: Array<{ cnt: bigint }> = await prisma.$queryRaw`
      SELECT COUNT(*) as cnt FROM transaksi
      WHERE jenis_transaksi_id = ${kolom.jenisTransaksiId}
        AND JSON_CONTAINS_PATH(custom_data, 'one', ${'$."' + columnId + '"'})
    `;
    const dipakai = Number(pakaiRows[0]?.cnt || 0) > 0;

    if (dipakai) {
      const updated = await prisma.kolomCustom.update({
        where: { id: columnId },
        data: { aktif: false },
      });
      await logManualAction(
        req.user!.id,
        'kolom_custom',
        AksiLog.UBAH,
        updated.namaKolom,
        `Kolom custom dinonaktifkan (masih ada data historis): ${updated.namaKolom}`,
        updated.id
      );
      return res.json(
        successResponse(updated, 'Kolom masih punya data historis - dinonaktifkan, bukan dihapus permanen')
      );
    }

    await prisma.kolomCustom.delete({ where: { id: columnId } });

    await logManualAction(
      req.user!.id,
      'kolom_custom',
      AksiLog.HAPUS,
      kolom.namaKolom,
      `Kolom custom dihapus: ${kolom.namaKolom}`,
      kolom.id
    );

    res.json(successResponse({ message: 'Kolom dihapus' }));
  } catch (error) {
    next(error);
  }
});

export default router;
