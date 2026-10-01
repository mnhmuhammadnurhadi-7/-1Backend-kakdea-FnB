import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { successResponse } from '../utils/response';

const router = Router();

router.use(authenticate);

// NOTE: Fitur PartnerStore & PartnerStoreCheck (toko mitra & jadwal cek)
// dipark pada restrukturisasi skema Bahasa Indonesia karena di luar fokus data Excel client.
// Route logic di bawah dikomentari agar mudah direstore jika modul ini diaktifkan kembali.

/*
// GET /partner-stores
router.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    res.json(successResponse([]));
  } catch (error) {
    next(error);
  }
});

// POST /partner-stores
router.post('/', async (req: AuthRequest, res: Response, next) => {
  try {
    res.json(successResponse({ message: 'Partner stores are parked in current schema' }));
  } catch (error) {
    next(error);
  }
});

// POST /partner-stores/:id/checks
router.post('/:id/checks', async (req: AuthRequest, res: Response, next) => {
  try {
    res.json(successResponse({ message: 'Partner store checks are parked in current schema' }));
  } catch (error) {
    next(error);
  }
});
*/

// Placeholder fallback handler
router.get('/', async (req: AuthRequest, res: Response) => {
  res.json(successResponse({ message: 'Modul partner stores sedang dipark pada versi skema saat ini', data: [] }));
});

export default router;