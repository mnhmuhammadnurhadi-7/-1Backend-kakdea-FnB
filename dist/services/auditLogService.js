"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logManualAction = exports.createAuditLog = void 0;
const database_1 = __importDefault(require("../utils/database"));
const client_1 = require("@prisma/client");
const createAuditLog = async (params) => {
    return await database_1.default.logAudit.create({
        data: {
            penggunaId: params.penggunaId,
            tabelTarget: params.tabelTarget,
            targetId: params.targetId || null,
            aksi: params.aksi,
            sumber: params.sumber,
            command: params.command || null,
            labelRecord: params.labelRecord,
            detail: params.detail || null,
            dataSebelum: params.dataSebelum ? JSON.stringify(params.dataSebelum) : null,
            dataSesudah: params.dataSesudah ? JSON.stringify(params.dataSesudah) : null,
        },
    });
};
exports.createAuditLog = createAuditLog;
const logManualAction = async (penggunaId, tabelTarget, aksi, labelRecord, detail, targetId, dataSebelum, dataSesudah) => {
    return await (0, exports.createAuditLog)({
        penggunaId,
        tabelTarget,
        aksi,
        sumber: client_1.SumberInput.MANUAL,
        labelRecord,
        detail,
        targetId,
        dataSebelum,
        dataSesudah,
    });
};
exports.logManualAction = logManualAction;
