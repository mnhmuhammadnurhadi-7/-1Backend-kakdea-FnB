"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const response_1 = require("../utils/response");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// NOTE: Fitur Stok & StockMovement dipark pada restrukturisasi skema Bahasa Indonesia
// (Model StockMovement tidak dibawa ke schema baru karena di luar fokus data Excel client).
// Route logic di bawah dikomentari agar mudah direstore jika modul stok diaktifkan kembali.
/*
// GET /stock
router.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const products = await prisma.produk.findMany({
      where: { aktif: true },
      orderBy: { namaBarang: 'asc' }
    });
    res.json(successResponse(products));
  } catch (error) {
    next(error);
  }
});

// GET /stock/:product_id/movements
router.get('/:product_id/movements', async (req: AuthRequest, res: Response, next) => {
  try {
    res.json(successResponse([]));
  } catch (error) {
    next(error);
  }
});

// POST /stock/movements
router.post('/movements', async (req: AuthRequest, res: Response, next) => {
  try {
    res.json(successResponse({ message: 'Stock movements are parked in current schema' }));
  } catch (error) {
    next(error);
  }
});
*/
// Placeholder fallback handler
router.get('/', async (req, res) => {
    res.json((0, response_1.successResponse)({ message: 'Modul stok sedang dipark pada versi skema saat ini', data: [] }));
});
exports.default = router;
