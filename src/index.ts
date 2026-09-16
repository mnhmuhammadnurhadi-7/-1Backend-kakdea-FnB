import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import dashboardRoutes from './routes/dashboard';
import productRoutes from './routes/products';
import customerRoutes from './routes/customers';
import supplierRoutes from './routes/suppliers';
import accountRoutes from './routes/accounts';
import transactionTypeRoutes from './routes/transactionTypes';
import transactionRoutes from './routes/transactions';
import stockRoutes from './routes/stock';
import orderRoutes from './routes/orders';
import debtRoutes from './routes/debts';
import reportRoutes from './routes/reports';
import auditLogRoutes from './routes/auditLog';
import partnerStoreRoutes from './routes/partnerStores';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/suppliers', supplierRoutes);
app.use('/api/v1/accounts', accountRoutes);
app.use('/api/v1/transaction-types', transactionTypeRoutes);
app.use('/api/v1/transactions', transactionRoutes);
app.use('/api/v1/stock', stockRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/debts', debtRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/audit-log', auditLogRoutes);
app.use('/api/v1/partner-stores', partnerStoreRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});