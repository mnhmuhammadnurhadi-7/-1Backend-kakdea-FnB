"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_1 = __importDefault(require("./routes/auth"));
const dashboard_1 = __importDefault(require("./routes/dashboard"));
const products_1 = __importDefault(require("./routes/products"));
const customers_1 = __importDefault(require("./routes/customers"));
const suppliers_1 = __importDefault(require("./routes/suppliers"));
const accounts_1 = __importDefault(require("./routes/accounts"));
const transactionTypes_1 = __importDefault(require("./routes/transactionTypes"));
const transactions_1 = __importDefault(require("./routes/transactions"));
const stock_1 = __importDefault(require("./routes/stock"));
const orders_1 = __importDefault(require("./routes/orders"));
const debts_1 = __importDefault(require("./routes/debts"));
const reports_1 = __importDefault(require("./routes/reports"));
const auditLog_1 = __importDefault(require("./routes/auditLog"));
const partnerStores_1 = __importDefault(require("./routes/partnerStores"));
const freeTables_1 = __importDefault(require("./routes/freeTables"));
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
// Routes
app.use('/api/v1/auth', auth_1.default);
app.use('/api/v1/dashboard', dashboard_1.default);
app.use('/api/v1/products', products_1.default);
app.use('/api/v1/customers', customers_1.default);
app.use('/api/v1/suppliers', suppliers_1.default);
app.use('/api/v1/accounts', accounts_1.default);
app.use('/api/v1/transaction-types', transactionTypes_1.default);
app.use('/api/v1/transactions', transactions_1.default);
app.use('/api/v1/stock', stock_1.default);
app.use('/api/v1/orders', orders_1.default);
app.use('/api/v1/debts', debts_1.default);
app.use('/api/v1/reports', reports_1.default);
app.use('/api/v1/audit-log', auditLog_1.default);
app.use('/api/v1/partner-stores', partnerStores_1.default);
app.use('/api/v1/free-tables', freeTables_1.default);
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
