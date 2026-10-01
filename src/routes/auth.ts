import { Router, Request, Response } from 'express';
import { login } from '../services/authService';
import { authenticate, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import prisma from '../utils/database';

const router = Router();

// POST /auth/login
router.post('/login', async (req: Request, res: Response, next) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      throw errorResponse('Email and password are required');
    }

    const result = await login({ email, password });
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

// GET /auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response, next) => {
  try {
    const user = await prisma.pengguna.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        nama: true,
        email: true,
        dibuatPada: true,
      }
    });

    if (!user) {
      throw errorResponse('User not found', 404);
    }

    res.json(successResponse(user));
  } catch (error) {
    next(error);
  }
});

export default router;