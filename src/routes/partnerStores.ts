import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import prisma from '../utils/database';
import { logManualAction } from '../services/auditLogService';

const router = Router();

router.use(authenticate);

// GET /partner-stores
router.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const partnerStores = await prisma.partnerStore.findMany({
      include: {
        customer: true,
        checks: {
          orderBy: { tanggalCek: 'desc' }
        }
      },
      orderBy: { jadwalCekBerikutnya: 'asc' }
    });

    res.json(successResponse(partnerStores));
  } catch (error) {
    next(error);
  }
});

// POST /partner-stores
router.post('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const { customer_id, jadwal_cek_berikutnya, interval_hari } = req.body;
    
    if (!customer_id) {
      throw errorResponse('customer_id is required');
    }

    const partnerStore = await prisma.partnerStore.create({
      data: {
        customerId: customer_id,
        jadwalCekBerikutnya: jadwal_cek_berikutnya ? new Date(jadwal_cek_berikutnya) : null,
        intervalHari: interval_hari || 14,
      }
    });

    await logManualAction(
      req.user!.id,
      'CUSTOMER',
      'CREATE',
      `Partner Store ${partnerStore.id}`,
      `Partner store created for customer ${customer_id}`,
      'partner_stores',
      partnerStore.id
    );

    res.json(successResponse(partnerStore));
  } catch (error) {
    next(error);
  }
});

// POST /partner-stores/:id/checks
router.post('/:id/checks', async (req: AuthRequest, res: Response, next) => {
  try {
    const partnerStoreId = parseInt(String(req.params.id));
    const { tanggal_cek, catatan } = req.body;
    
    if (!tanggal_cek) {
      throw errorResponse('tanggal_cek is required');
    }

    const check = await prisma.partnerStoreCheck.create({
      data: {
        partnerStoreId,
        tanggalCek: new Date(tanggal_cek),
        catatan,
      }
    });

    // Update next check date
    const partnerStore = await prisma.partnerStore.findUnique({
      where: { id: partnerStoreId }
    });

    if (partnerStore) {
      const nextCheckDate = new Date(tanggal_cek);
      nextCheckDate.setDate(nextCheckDate.getDate() + partnerStore.intervalHari);
      
      await prisma.partnerStore.update({
        where: { id: partnerStoreId },
        data: {
          jadwalCekBerikutnya: nextCheckDate
        }
      });
    }

    await logManualAction(
      req.user!.id,
      'CUSTOMER',
      'CREATE',
      `Partner Check ${check.id}`,
      `Partner store check recorded`,
      'partner_store_checks',
      check.id
    );

    res.json(successResponse(check));
  } catch (error) {
    next(error);
  }
});

export default router;