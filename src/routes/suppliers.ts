import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import prisma from '../utils/database';
import { logManualAction } from '../services/auditLogService';

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
        { kodeSupplier: { contains: search as string } },
      ];
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    res.json(successResponse(suppliers));
  } catch (error) {
    next(error);
  }
});

// GET /suppliers/:id
router.get('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const supplier = await prisma.supplier.findUnique({
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
    const { kode_supplier, nama, alamat, contact_person, telp, bank_nama, rekening, keterangan } = req.body;
    
    if (!kode_supplier || !nama) {
      throw errorResponse('kode_supplier and nama are required');
    }

    const supplier = await prisma.supplier.create({
      data: {
        kodeSupplier: kode_supplier,
        nama,
        alamat,
        contactPerson: contact_person,
        telp,
        bankNama: bank_nama,
        rekening,
        keterangan,
      }
    });

    await logManualAction(
      req.user!.id,
      'SUPPLIER',
      'CREATE',
      supplier.nama,
      `Supplier created: ${supplier.nama}`,
      'suppliers',
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
    const updates = req.body;
    
    const supplier = await prisma.supplier.update({
      where: { id },
      data: updates
    });

    await logManualAction(
      req.user!.id,
      'SUPPLIER',
      'UPDATE',
      supplier.nama,
      `Supplier updated: ${supplier.nama}`,
      'suppliers',
      supplier.id,
      { field: 'supplier', sebelum: '', sesudah: JSON.stringify(updates) }
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
    
    const supplier = await prisma.supplier.delete({
      where: { id }
    });

    await logManualAction(
      req.user!.id,
      'SUPPLIER',
      'DELETE',
      supplier.nama,
      `Supplier deleted: ${supplier.nama}`,
      'suppliers',
      supplier.id
    );

    res.json(successResponse({ message: 'Supplier deleted successfully' }));
  } catch (error) {
    next(error);
  }
});

export default router;