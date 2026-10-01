"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorResponse = exports.successResponse = void 0;
const successResponse = (data, message) => {
    return {
        success: true,
        data,
        ...(message && { message })
    };
};
exports.successResponse = successResponse;
const errorResponse = (message, status = 400) => {
    const error = new Error(message);
    error.status = status;
    return error;
};
exports.errorResponse = errorResponse;
