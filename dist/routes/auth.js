"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authService_1 = require("../services/authService");
const auth_1 = require("../middleware/auth");
const response_1 = require("../utils/response");
const database_1 = __importDefault(require("../utils/database"));
const router = (0, express_1.Router)();
// POST /auth/login
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            throw (0, response_1.errorResponse)('Email and password are required');
        }
        const result = await (0, authService_1.login)({ email, password });
        res.json((0, response_1.successResponse)(result));
    }
    catch (error) {
        next(error);
    }
});
// GET /auth/me
router.get('/me', auth_1.authenticate, async (req, res, next) => {
    try {
        const user = await database_1.default.pengguna.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                nama: true,
                email: true,
                dibuatPada: true,
            }
        });
        if (!user) {
            throw (0, response_1.errorResponse)('User not found', 404);
        }
        res.json((0, response_1.successResponse)(user));
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
