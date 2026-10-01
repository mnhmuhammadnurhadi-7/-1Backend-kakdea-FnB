"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = exports.login = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = __importDefault(require("../utils/database"));
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';
const login = async (params) => {
    const user = await database_1.default.pengguna.findUnique({
        where: { email: params.email }
    });
    if (!user) {
        throw new Error('Invalid credentials');
    }
    const isValidPassword = await bcrypt_1.default.compare(params.password, user.passwordHash);
    if (!isValidPassword) {
        throw new Error('Invalid credentials');
    }
    const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    return {
        token,
        user: {
            id: user.id,
            nama: user.nama,
            email: user.email,
        }
    };
};
exports.login = login;
const hashPassword = async (password) => {
    return await bcrypt_1.default.hash(password, 10);
};
exports.hashPassword = hashPassword;
