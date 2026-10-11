"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const auth_1 = __importDefault(require("./routes/auth"));
const dashboard_1 = __importDefault(require("./routes/dashboard"));
const products_1 = __importDefault(require("./routes/products"));
const productsPublic_1 = __importDefault(require("./routes/productsPublic"));
const transactionTypes_1 = __importDefault(require("./routes/transactionTypes"));
const transactions_1 = __importDefault(require("./routes/transactions"));
const orders_1 = __importDefault(require("./routes/orders"));
const reports_1 = __importDefault(require("./routes/reports"));
const auditLog_1 = __importDefault(require("./routes/auditLog"));
const freeTables_1 = __importDefault(require("./routes/freeTables"));
const cms_1 = __importDefault(require("./routes/cms"));
const cmsPublic_1 = __importDefault(require("./routes/cmsPublic"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
// Middleware
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Serve static files from public/uploads across all common paths
const uploadsDir = path_1.default.join(process.cwd(), 'public', 'uploads');
app.use('/uploads', express_1.default.static(uploadsDir));
app.use('/api/v1/uploads', express_1.default.static(uploadsDir));
app.use('/api/public/uploads', express_1.default.static(uploadsDir));
app.use('/api/v1/cms/uploads', express_1.default.static(uploadsDir));
// Routes
app.use('/api/v1/auth', auth_1.default);
app.use('/api/v1/dashboard', dashboard_1.default);
app.use('/api/v1/products', products_1.default);
app.use('/api/v1/transaction-types', transactionTypes_1.default);
app.use('/api/v1/transactions', transactions_1.default);
app.use('/api/v1/orders', orders_1.default);
app.use('/api/v1/reports', reports_1.default);
app.use('/api/v1/audit-log', auditLog_1.default);
app.use('/api/v1/free-tables', freeTables_1.default);
app.use('/api/v1/cms', cms_1.default);
// Public endpoints (untuk customer page tanpa auth)
app.use('/api/public/cms', cmsPublic_1.default);
app.use('/api/public/products', productsPublic_1.default);
// Root info endpoint
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Buku Dapur Backend API Server Running',
        version: '1.0.0',
        webUI: 'http://localhost:3000'
    });
});
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Error handling
app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error'
    });
});
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
