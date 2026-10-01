import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import prisma from '../utils/database';
import { logManualAction } from '../services/auditLogService';
import { AksiLog } from '@prisma/client';
import { KODE_JENIS_BAWAAN } from '../utils/jenisBawaan';

const router = Router();

router.use(authenticate);

// GET /customers
router.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const { search, status } = req.query;
    
    const where: any = {};
    if (search) {
      where.OR = [
        { nama: { contains: search as string } },
        { kode: { contains: search as string } },
      ];
    }
    if (status) {
      where.status = status as string;
    }

    const customers = await prisma.dataPelanggan.findMany({
      where,
      orderBy: { dibuatPada: 'desc' }
    });

    res.json(successResponse(customers));
  } catch (error) {
    next(error);
  }
});

// GET /customers/:id
router.get('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const id = parseInt(String(req.params.id));
    
    const orderJenis = await prisma.jenisTransaksi.findMany({
      where: { kode: { in: [KODE_JENIS_BAWAAN.PENDAPATAN_FROZEN, KODE_JENIS_BAWAAN.PENDAPATAN_SIAP_SAJI] } },
      select: { id: true },
    });
    const customer = await prisma.dataPelanggan.findUnique({
      where: { id },
      include: {
        transaksi: {
          where: { jenisTransaksiId: { in: orderJenis.map((j) => j.id) } },
          orderBy: { tanggal: 'desc' },
          take: 1,
          select: {
            id: true,
            kode: true,
            tanggal: true,
            nominal: true,
          }
        }
      }
    });

    if (!customer) {
      throw errorResponse('Customer not found', 404);
    }

    const response = {
      ...customer,
      order_terakhir: customer.transaksi[0] || null,
      transaksi: undefined,
    };

    res.json(successResponse(response));
  } catch (error) {
    next(error);
  }
});

// POST /customers
router.post('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const {
      kode,
      kode_customer,
      nama,
      status,
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
    
    const finalKode = kode || kode_customer;
    if (!finalKode || !nama) {
      throw errorResponse('kode (kode_customer) and nama are required');
    }

    const customer = await prisma.dataPelanggan.create({
      data: {
        kode: finalKode,
        nama,
        status,
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
      'data_pelanggan',
      AksiLog.TAMBAH,
      customer.nama,
      `Data Pelanggan created: ${customer.nama}`,
      customer.id
    );

    res.json(successResponse(customer));
  } catch (error) {
    next(error);
  }
});

// PUT /customers/:id
router.put('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const id = parseInt(String(req.params.id));
    const {
      kode,
      kode_customer,
      nama,
      status,
      alamat,
      kontakPerson,
      contact_person,
      telepon,
      telp,
      bankNama,
      bank_nama,
      rekening,
      saldoPiutang,
      saldo_piutang,
      keterangan
    } = req.body;
    
    const existing = await prisma.dataPelanggan.findUnique({ where: { id } });
    if (!existing) {
      throw errorResponse('Customer not found', 404);
    }

    const updateData: any = {};
    if (kode || kode_customer) updateData.kode = kode || kode_customer;
    if (nama !== undefined) updateData.nama = nama;
    if (status !== undefined) updateData.status = status;
    if (alamat !== undefined) updateData.alamat = alamat;
    if (kontakPerson !== undefined || contact_person !== undefined) updateData.kontakPerson = kontakPerson || contact_person;
    if (telepon !== undefined || telp !== undefined) updateData.telepon = telepon || telp;
    if (bankNama !== undefined || bank_nama !== undefined) updateData.bankNama = bankNama || bank_nama;
    if (rekening !== undefined) updateData.rekening = rekening;
    if (saldoPiutang !== undefined || saldo_piutang !== undefined) updateData.saldoPiutang = saldoPiutang ?? saldo_piutang;
    if (keterangan !== undefined) updateData.keterangan = keterangan;

    const customer = await prisma.dataPelanggan.update({
      where: { id },
      data: updateData
    });

    await logManualAction(
      req.user!.id,
      'data_pelanggan',
      AksiLog.UBAH,
      customer.nama,
      `Data Pelanggan updated: ${customer.nama}`,
      customer.id,
      existing,
      updateData
    );

    res.json(successResponse(customer));
  } catch (error) {
    next(error);
  }
});

// DELETE /customers/:id
router.delete('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const id = parseInt(String(req.params.id));
    
    const customer = await prisma.dataPelanggan.delete({
      where: { id }
    });

    await logManualAction(
      req.user!.id,
      'data_pelanggan',
      AksiLog.HAPUS,
      customer.nama,
      `Data Pelanggan deleted: ${customer.nama}`,
      customer.id
    );

    res.json(successResponse({ message: 'Customer deleted successfully' }));
  } catch (error) {
    next(error);
  }
});

export default router;