import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import prisma from '../utils/database';
import { logManualAction } from '../services/auditLogService';
import { AksiLog, TipeDataKolom } from '@prisma/client';

const router = Router();

router.use(authenticate);

// GET /free-tables
router.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const tables = await prisma.tabelBebas.findMany({
      include: { kolom: { orderBy: { urutan: 'asc' } }, _count: { select: { baris: true } } },
      orderBy: { dibuatPada: 'desc' },
    });
    res.json(successResponse(tables));
  } catch (error) {
    next(error);
  }
});

// GET /free-tables/:id
router.get('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const id = parseInt(String(req.params.id));
    const table = await prisma.tabelBebas.findUnique({
      where: { id },
      include: { kolom: { orderBy: { urutan: 'asc' } }, baris: { orderBy: { dibuatPada: 'desc' } } },
    });
    if (!table) throw errorResponse('Tabel tidak ditemukan', 404);
    res.json(successResponse(table));
  } catch (error) {
    next(error);
  }
});

// POST /free-tables  { nama_tabel, deskripsi, kolom: [{nama_kolom, tipe_data, opsi_dropdown}] }
router.post('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const { nama_tabel, namaTabel, deskripsi, kolom } = req.body;
    const finalNama = namaTabel || nama_tabel;
    if (!finalNama) throw errorResponse('nama_tabel wajib diisi');

    const existing = await prisma.tabelBebas.findUnique({ where: { namaTabel: finalNama } });
    if (existing) throw errorResponse(`Nama tabel "${finalNama}" sudah dipakai`, 409);

    const kolomList = Array.isArray(kolom) ? kolom : [];
    for (const k of kolomList) {
      const tipe = k.tipeData || k.tipe_data;
      if (!k.namaKolom && !k.nama_kolom) throw errorResponse('Setiap kolom wajib punya nama_kolom');
      if (!['TEKS', 'ANGKA', 'TANGGAL', 'DROPDOWN'].includes(tipe)) {
        throw errorResponse('tipe_data kolom harus TEKS, ANGKA, TANGGAL, atau DROPDOWN');
      }
      if (tipe === 'DROPDOWN' && !(k.opsiDropdown || k.opsi_dropdown)?.length) {
        throw errorResponse(`Kolom "${k.namaKolom || k.nama_kolom}" bertipe DROPDOWN wajib punya opsi_dropdown`);
      }
    }

    const table = await prisma.tabelBebas.create({
      data: {
        namaTabel: finalNama,
        deskripsi: deskripsi || null,
        dibuatOleh: req.user!.id,
        kolom: {
          create: kolomList.map((k: any, idx: number) => ({
            namaKolom: k.namaKolom || k.nama_kolom,
            tipeData: (k.tipeData || k.tipe_data) as TipeDataKolom,
            opsiDropdown: k.opsiDropdown || k.opsi_dropdown || undefined,
            urutan: k.urutan ?? idx,
          })),
        },
      },
      include: { kolom: true },
    });

    await logManualAction(req.user!.id, 'tabel_bebas', AksiLog.TAMBAH, table.namaTabel, `Tabel bebas baru: ${table.namaTabel}`, table.id);

    res.json(successResponse(table));
  } catch (error) {
    next(error);
  }
});

// PUT /free-tables/:id  (ubah nama/deskripsi tabel)
router.put('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const id = parseInt(String(req.params.id));
    const before = await prisma.tabelBebas.findUnique({ where: { id } });
    if (!before) throw errorResponse('Tabel tidak ditemukan', 404);

    const { nama_tabel, namaTabel, deskripsi } = req.body;
    const data: any = {};
    if ((namaTabel || nama_tabel) !== undefined) data.namaTabel = namaTabel || nama_tabel;
    if (deskripsi !== undefined) data.deskripsi = deskripsi;

    const updated = await prisma.tabelBebas.update({ where: { id }, data });
    await logManualAction(req.user!.id, 'tabel_bebas', AksiLog.UBAH, updated.namaTabel, `Tabel bebas diubah: ${updated.namaTabel}`, updated.id, before, updated);

    res.json(successResponse(updated));
  } catch (error) {
    next(error);
  }
});

// DELETE /free-tables/:id  (cascade hapus kolom & baris - ini pendataan
// bebas, bukan data finansial, jadi cascade delete aman di sini)
router.delete('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const id = parseInt(String(req.params.id));
    const table = await prisma.tabelBebas.findUnique({ where: { id } });
    if (!table) throw errorResponse('Tabel tidak ditemukan', 404);

    await prisma.tabelBebas.delete({ where: { id } });
    await logManualAction(req.user!.id, 'tabel_bebas', AksiLog.HAPUS, table.namaTabel, `Tabel bebas dihapus: ${table.namaTabel}`, table.id);

    res.json(successResponse({ message: 'Tabel dihapus' }));
  } catch (error) {
    next(error);
  }
});

// ---- Kolom ----

// POST /free-tables/:id/columns
router.post('/:id/columns', async (req: AuthRequest, res: Response, next) => {
  try {
    const tabelBebasId = parseInt(String(req.params.id));
    const table = await prisma.tabelBebas.findUnique({ where: { id: tabelBebasId } });
    if (!table) throw errorResponse('Tabel tidak ditemukan', 404);

    const { nama_kolom, namaKolom, tipe_data, tipeData, opsi_dropdown, opsiDropdown, urutan } = req.body;
    const finalNama = namaKolom || nama_kolom;
    const finalTipe = (tipeData || tipe_data) as TipeDataKolom;
    if (!finalNama || !finalTipe) throw errorResponse('nama_kolom dan tipe_data wajib diisi');
    if (!['TEKS', 'ANGKA', 'TANGGAL', 'DROPDOWN'].includes(finalTipe)) {
      throw errorResponse('tipe_data harus TEKS, ANGKA, TANGGAL, atau DROPDOWN');
    }
    if (finalTipe === 'DROPDOWN' && !(opsiDropdown || opsi_dropdown)?.length) {
      throw errorResponse('opsi_dropdown wajib diisi untuk tipe_data DROPDOWN');
    }

    const col = await prisma.kolomTabelBebas.create({
      data: {
        tabelBebasId,
        namaKolom: finalNama,
        tipeData: finalTipe,
        opsiDropdown: (opsiDropdown || opsi_dropdown) || undefined,
        urutan: urutan ?? 0,
      },
    });

    res.json(successResponse(col));
  } catch (error) {
    next(error);
  }
});

// PUT /free-tables/:id/columns/:columnId
router.put('/:id/columns/:columnId', async (req: AuthRequest, res: Response, next) => {
  try {
    const columnId = parseInt(String(req.params.columnId));
    const before = await prisma.kolomTabelBebas.findUnique({ where: { id: columnId } });
    if (!before) throw errorResponse('Kolom tidak ditemukan', 404);

    const { nama_kolom, namaKolom, tipe_data, tipeData, opsi_dropdown, opsiDropdown, urutan } = req.body;
    const data: any = {};
    if ((namaKolom || nama_kolom) !== undefined) data.namaKolom = namaKolom || nama_kolom;
    if ((tipeData || tipe_data) !== undefined) data.tipeData = tipeData || tipe_data;
    if ((opsiDropdown || opsi_dropdown) !== undefined) data.opsiDropdown = opsiDropdown || opsi_dropdown;
    if (urutan !== undefined) data.urutan = urutan;

    const updated = await prisma.kolomTabelBebas.update({ where: { id: columnId }, data });
    res.json(successResponse(updated));
  } catch (error) {
    next(error);
  }
});

// DELETE /free-tables/:id/columns/:columnId
// (Tabel bebas murni pendataan, bukan akuntansi - hard delete kolom
// termasuk data barisnya dianggap acceptable di sini, beda dengan
// KolomCustom di Master Transaksi yang soft-delete.)
router.delete('/:id/columns/:columnId', async (req: AuthRequest, res: Response, next) => {
  try {
    const columnId = parseInt(String(req.params.columnId));
    const col = await prisma.kolomTabelBebas.findUnique({ where: { id: columnId } });
    if (!col) throw errorResponse('Kolom tidak ditemukan', 404);

    await prisma.kolomTabelBebas.delete({ where: { id: columnId } });
    res.json(successResponse({ message: 'Kolom dihapus' }));
  } catch (error) {
    next(error);
  }
});

// ---- Baris ----

// POST /free-tables/:id/rows  { data: { "<kolomId>": value, ... } }
router.post('/:id/rows', async (req: AuthRequest, res: Response, next) => {
  try {
    const tabelBebasId = parseInt(String(req.params.id));
    const table = await prisma.tabelBebas.findUnique({ where: { id: tabelBebasId } });
    if (!table) throw errorResponse('Tabel tidak ditemukan', 404);

    const { data } = req.body;
    if (!data || typeof data !== 'object') throw errorResponse('data (object) wajib diisi');

    const row = await prisma.barisTabelBebas.create({ data: { tabelBebasId, data } });

    await logManualAction(req.user!.id, 'baris_tabel_bebas', AksiLog.TAMBAH, table.namaTabel, `Baris baru di "${table.namaTabel}"`, row.id);

    res.json(successResponse(row));
  } catch (error) {
    next(error);
  }
});

// PUT /free-tables/:id/rows/:rowId
router.put('/:id/rows/:rowId', async (req: AuthRequest, res: Response, next) => {
  try {
    const rowId = parseInt(String(req.params.rowId));
    const before = await prisma.barisTabelBebas.findUnique({ where: { id: rowId } });
    if (!before) throw errorResponse('Baris tidak ditemukan', 404);

    const { data } = req.body;
    if (!data || typeof data !== 'object') throw errorResponse('data (object) wajib diisi');

    const updated = await prisma.barisTabelBebas.update({ where: { id: rowId }, data: { data } });
    res.json(successResponse(updated));
  } catch (error) {
    next(error);
  }
});

// DELETE /free-tables/:id/rows/:rowId
router.delete('/:id/rows/:rowId', async (req: AuthRequest, res: Response, next) => {
  try {
    const rowId = parseInt(String(req.params.rowId));
    const row = await prisma.barisTabelBebas.findUnique({ where: { id: rowId } });
    if (!row) throw errorResponse('Baris tidak ditemukan', 404);

    await prisma.barisTabelBebas.delete({ where: { id: rowId } });
    res.json(successResponse({ message: 'Baris dihapus' }));
  } catch (error) {
    next(error);
  }
});

export default router;
