"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const response_1 = require("../utils/response");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
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
router.get('/', async (req, res) => {
    res.json((0, response_1.successResponse)({ message: 'Modul partner stores sedang dipark pada versi skema saat ini', data: [] }));
});
exports.default = router;
