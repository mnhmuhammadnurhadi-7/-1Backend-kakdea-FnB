import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { successResponse } from '../utils/response';
import prisma from '../utils/database';

const router = Router();

router.use(authenticate);

// GET /accounts (read-only)
router.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const accounts = await prisma.jenisAkun.findMany({
      where: { aktif: true },
      orderBy: { kodeAkun: 'asc' }
    });

    res.json(successResponse(accounts));
  } catch (error) {
    next(error);
  }
});

export default router;