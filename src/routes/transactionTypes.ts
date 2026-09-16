import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { successResponse } from '../utils/response';
import prisma from '../utils/database';

const router = Router();

router.use(authenticate);

// GET /transaction-types?kategori=
router.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const { kategori } = req.query;
    
    const where: any = { isActive: true };
    if (kategori) {
      where.kategori = kategori;
    }

    const transactionTypes = await prisma.transactionType.findMany({
      where,
      orderBy: { kategori: 'asc' }
    });

    res.json(successResponse(transactionTypes));
  } catch (error) {
    next(error);
  }
});

export default router;