"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const response_1 = require("../utils/response");
const database_1 = __importDefault(require("../utils/database"));
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// GET /accounts (read-only)
router.get('/', async (req, res, next) => {
    try {
        const accounts = await database_1.default.jenisAkun.findMany({
            where: { aktif: true },
            orderBy: { kodeAkun: 'asc' }
        });
        res.json((0, response_1.successResponse)(accounts));
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
