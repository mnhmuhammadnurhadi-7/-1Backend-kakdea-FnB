import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import prisma from '../utils/database';
import { logManualAction } from '../services/auditLogService';

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
        { kodeCustomer: { contains: search as string } },
      ];
    }
    if (status) {
      where.status = status;
    }

    const customers = await prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' }
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
    
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        orders: {
          orderBy: { tanggal: 'desc' },
          take: 1,
          select: {
            id: true,
            tanggal: true,
            totalInvoice: true,
          }
        }
      }
    });

    if (!customer) {
      throw errorResponse('Customer not found', 404);
    }

    const response = {
      ...customer,
      order_terakhir: customer.orders[0] || null,
      orders: undefined,
    };

    res.json(successResponse(response));
  } catch (error) {
    next(error);
  }
});

// POST /customers
router.post('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const { kode_customer, nama, status, alamat, contact_person, telp, bank_nama, rekening, keterangan } = req.body;
    
    if (!kode_customer || !nama) {
      throw errorResponse('kode_customer and nama are required');
    }

    const customer = await prisma.customer.create({
      data: {
        kodeCustomer: kode_customer,
        nama,
        status,
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
      'CUSTOMER',
      'CREATE',
      customer.nama,
      `Customer created: ${customer.nama}`,
      'customers',
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
    const updates = req.body;
    
    const customer = await prisma.customer.update({
      where: { id },
      data: updates
    });

    await logManualAction(
      req.user!.id,
      'CUSTOMER',
      'UPDATE',
      customer.nama,
      `Customer updated: ${customer.nama}`,
      'customers',
      customer.id,
      { field: 'customer', sebelum: '', sesudah: JSON.stringify(updates) }
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
    
    const customer = await prisma.customer.delete({
      where: { id }
    });

    await logManualAction(
      req.user!.id,
      'CUSTOMER',
      'DELETE',
      customer.nama,
      `Customer deleted: ${customer.nama}`,
      'customers',
      customer.id
    );

    res.json(successResponse({ message: 'Customer deleted successfully' }));
  } catch (error) {
    next(error);
  }
});

export default router;