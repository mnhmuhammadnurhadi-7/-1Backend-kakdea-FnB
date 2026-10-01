import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import prisma from '../utils/database';
import { logManualAction } from '../services/auditLogService';
import { AksiLog } from '@prisma/client';

const router = Router();

router.use(authenticate);

// GET /suppliers
router.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const { search } = req.query;
    
    const where: any = {};
    if (search) {
      where.OR = [
        { nama: { contains: search as string } },
        { kode: { contains: search as string } },
      ];
    }

    const suppliers = await prisma.dataPemasok.findMany({
      where,
      orderBy: { dibuatPada: 'desc' }
    });

    res.json(successResponse(suppliers));
  } catch (error) {
    next(error);
  }
});

// GET /suppliers/:id
router.get('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const supplier = await prisma.dataPemasok.findUnique({
      where: { id: parseInt(String(req.params.id)) }
    });

    if (!supplier) {
      throw errorResponse('Supplier not found', 404);
    }

    res.json(successResponse(supplier));
  } catch (error) {
    next(error);
  }
});

// POST /suppliers
router.post('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const {
      kode,
      kode_supplier,
      nama,
      alamat,
      kontakPerson,
      contact_person,
      telepon,
      telp,
      bankNama,
      bank_nama,
      rekening,
      keterangan
    } = req.body;
    
    const finalKode = kode || kode_supplier;
    if (!finalKode || !nama) {
      throw errorResponse('kode (kode_supplier) and nama are required');
    }

    const supplier = await prisma.dataPemasok.create({
      data: {
        kode: finalKode,
        nama,
        alamat,
        kontakPerson: kontakPerson || contact_person,
        telepon: telepon || telp,
        bankNama: bankNama || bank_nama,
        rekening,
        keterangan,
      }
    });

    await logManualAction(
      req.user!.id,
      'data_pemasok',
      AksiLog.TAMBAH,
      supplier.nama,
      `Data Pemasok created: ${supplier.nama}`,
      supplier.id
    );

    res.json(successResponse(supplier));
  } catch (error) {
    next(error);
  }
});

// PUT /suppliers/:id
router.put('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const id = parseInt(String(req.params.id));
    const {
      kode,
      kode_supplier,
      nama,
      alamat,
      kontakPerson,
      contact_person,
      telepon,
      telp,
      bankNama,
      bank_nama,
      rekening,
      saldoHutang,
      saldo_hutang,
      keterangan
    } = req.body;
    
    const existing = await prisma.dataPemasok.findUnique({ where: { id } });
    if (!existing) {
      throw errorResponse('Supplier not found', 404);
    }

    const updateData: any = {};
    if (kode || kode_supplier) updateData.kode = kode || kode_supplier;
    if (nama !== undefined) updateData.nama = nama;
    if (alamat !== undefined) updateData.alamat = alamat;
    if (kontakPerson !== undefined || contact_person !== undefined) updateData.kontakPerson = kontakPerson || contact_person;
    if (telepon !== undefined || telp !== undefined) updateData.telepon = telepon || telp;
    if (bankNama !== undefined || bank_nama !== undefined) updateData.bankNama = bankNama || bank_nama;
    if (rekening !== undefined) updateData.rekening = rekening;
    if (saldoHutang !== undefined || saldo_hutang !== undefined) updateData.saldoHutang = saldoHutang ?? saldo_hutang;
    if (keterangan !== undefined) updateData.keterangan = keterangan;

    const supplier = await prisma.dataPemasok.update({
      where: { id },
      data: updateData
    });

    await logManualAction(
      req.user!.id,
      'data_pemasok',
      AksiLog.UBAH,
      supplier.nama,
      `Data Pemasok updated: ${supplier.nama}`,
      supplier.id,
      existing,
      updateData
    );

    res.json(successResponse(supplier));
  } catch (error) {
    next(error);
  }
});

// DELETE /suppliers/:id
router.delete('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const id = parseInt(String(req.params.id));
    
    const supplier = await prisma.dataPemasok.delete({
      where: { id }
    });

    await logManualAction(
      req.user!.id,
      'data_pemasok',
      AksiLog.HAPUS,
      supplier.nama,
      `Data Pemasok deleted: ${supplier.nama}`,
      supplier.id
    );

    res.json(successResponse({ message: 'Supplier deleted successfully' }));
  } catch (error) {
    next(error);
  }
});

export default router;