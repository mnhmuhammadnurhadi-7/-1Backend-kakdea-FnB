"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const response_1 = require("../utils/response");
const authenticate = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw (0, response_1.errorResponse)('Unauthorized - No token provided', 401);
        }
        const token = authHeader.substring(7);
        const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (error) {
        next((0, response_1.errorResponse)('Unauthorized - Invalid token', 401));
    }
};
exports.authenticate = authenticate;
