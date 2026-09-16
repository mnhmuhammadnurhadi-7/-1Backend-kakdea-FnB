import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { successResponse } from '../utils/response';
import prisma from '../utils/database';

const router = Router();

router.use(authenticate);

// GET /audit-log
router.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const { sheet, source, search, page = '1', limit = '50' } = req.query;
    
    const where: any = {};
    if (sheet && sheet !== 'semua') {
      where.sheet = sheet;
    }
    if (source && source !== 'semua') {
      where.source = source;
    }
    if (search) {
      where.OR = [
        { recordLabel: { contains: search as string } },
        { detail: { contains: search as string } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    
    const [logs, total] = await Promise.all([
      prisma.aiAuditLog.findMany({
        where,
        include: {
          user: {
            select: {
              nama: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit)
      }),
      prisma.aiAuditLog.count({ where })
    ]);

    res.json(successResponse({
      logs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    }));
  } catch (error) {
    next(error);
  }
});

export default router;