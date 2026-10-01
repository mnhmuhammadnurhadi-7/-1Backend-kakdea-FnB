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
// GET /audit-log
router.get('/', async (req, res, next) => {
    try {
        const { sheet, tabelTarget, tabel, source, sumber, search, page = '1', limit = '50', days } = req.query;
        const where = {};
        const finalTable = tabel || tabelTarget || sheet;
        if (finalTable && finalTable !== 'semua') {
            where.tabelTarget = { contains: String(finalTable).toLowerCase() };
        }
        const finalSource = sumber || source;
        if (finalSource && finalSource !== 'semua') {
            where.sumber = String(finalSource).toUpperCase();
        }
        if (search) {
            where.OR = [
                { labelRecord: { contains: search } },
                { detail: { contains: search } },
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
            database_1.default.logAudit.findMany({
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
            database_1.default.logAudit.count({ where })
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
        res.json((0, response_1.successResponse)({
            logs: transformedLogs,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit))
            }
        }));
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
