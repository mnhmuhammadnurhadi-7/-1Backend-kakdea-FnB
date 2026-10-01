import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { successResponse } from '../utils/response';
import prisma from '../utils/database';
import { SumberInput } from '@prisma/client';

const router = Router();

router.use(authenticate);

// GET /audit-log
router.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const { sheet, tabelTarget, tabel, source, sumber, search, page = '1', limit = '50', days } = req.query;
    
    const where: any = {};
    const finalTable = tabel || tabelTarget || sheet;
    if (finalTable && finalTable !== 'semua') {
      where.tabelTarget = { contains: String(finalTable).toLowerCase() };
    }
    const finalSource = sumber || source;
    if (finalSource && finalSource !== 'semua') {
      where.sumber = String(finalSource).toUpperCase() as SumberInput;
    }
    if (search) {
      where.OR = [
        { labelRecord: { contains: search as string } },
        { detail: { contains: search as string } },
      ];
    }
    // Default tampil 7 hari terakhir (UI). Kirim ?days=30, ?days=90, dst
    // untuk lihat lebih lama - data lama TIDAK pernah dihapus dari DB,
    // ini murni filter tampilan. ?days=0 atau ?days=all menampilkan semua.
    const rangeDays = days === 'all' || days === '0' ? null : Number(days || 7);
    if (rangeDays) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - rangeDays);
      where.dibuatPada = { gte: startDate };
    }

    const skip = (Number(page) - 1) * Number(limit);
    
    const [logs, total] = await Promise.all([
      prisma.logAudit.findMany({
        where,
        include: {
          pengguna: {
            select: {
              nama: true,
              email: true
            }
          }
        },
        orderBy: { dibuatPada: 'desc' },
        skip,
        take: Number(limit)
      }),
      prisma.logAudit.count({ where })
    ]);

    const transformedLogs = logs.map(l => ({
      ...l,
      sheet: l.tabelTarget,
      source: l.sumber,
      action: l.aksi,
      recordLabel: l.labelRecord,
      createdAt: l.dibuatPada,
      user: l.pengguna,
    }));

    res.json(successResponse({
      logs: transformedLogs,
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