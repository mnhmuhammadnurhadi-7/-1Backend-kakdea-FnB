"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteJournalEntry = exports.createJournalEntry = void 0;
const database_1 = __importDefault(require("../utils/database"));
const response_1 = require("../utils/response");
// Toleransi pembulatan desimal (Decimal(15,2)) - hindari false-positive
// karena floating point.
const EPSILON = 0.005;
/**
 * Buat jurnal entri. WAJIB dipanggil di dalam prisma.$transaction yang
 * sama dengan pembuatan baris Transaksi terkait (pass `tx`, bukan
 * `prisma` langsung), supaya kalau validasi debit != kredit gagal,
 * insert Transaksi yang terkait ikut di-rollback juga.
 */
const createJournalEntry = async (tx, params) => {
    const totalDebit = params.baris.reduce((sum, b) => sum + Number(b.debit || 0), 0);
    const totalKredit = params.baris.reduce((sum, b) => sum + Number(b.kredit || 0), 0);
    if (Math.abs(totalDebit - totalKredit) > EPSILON) {
        throw (0, response_1.errorResponse)(`Jurnal tidak balance: total debit (${totalDebit}) != total kredit (${totalKredit})`, 400);
    }
    const journalEntry = await tx.jurnalEntri.create({
        data: {
            tanggal: params.tanggal,
            deskripsi: params.deskripsi || null,
            unitBisnis: params.unitBisnis || null,
            dibuatOleh: params.dibuatOleh,
            viaAi: params.viaAi || false,
            baris: {
                create: params.baris.map((b) => ({
                    akunKode: b.akunKode,
                    debit: b.debit,
                    kredit: b.kredit,
                })),
            },
        },
        include: {
            baris: true,
        },
    });
    return journalEntry;
};
exports.createJournalEntry = createJournalEntry;
const deleteJournalEntry = async (id) => {
    await database_1.default.jurnalEntri.delete({
        where: { id },
    });
};
exports.deleteJournalEntry = deleteJournalEntry;
