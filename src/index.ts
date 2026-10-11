import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './routes/auth';
import dashboardRoutes from './routes/dashboard';
import productRoutes from './routes/products';
import productsPublicRoutes from './routes/productsPublic';
import transactionTypeRoutes from './routes/transactionTypes';
import transactionRoutes from './routes/transactions';
import orderRoutes from './routes/orders';
import reportRoutes from './routes/reports';
import auditLogRoutes from './routes/auditLog';
import freeTableRoutes from './routes/freeTables';
import cmsRoutes from './routes/cms';
import cmsPublicRoutes from './routes/cmsPublic';

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

// Serve static files from public/uploads across all common paths
const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
app.use('/uploads', express.static(uploadsDir));
app.use('/api/v1/uploads', express.static(uploadsDir));
app.use('/api/public/uploads', express.static(uploadsDir));
app.use('/api/v1/cms/uploads', express.static(uploadsDir));

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/transaction-types', transactionTypeRoutes);
app.use('/api/v1/transactions', transactionRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/audit-log', auditLogRoutes);
app.use('/api/v1/free-tables', freeTableRoutes);
app.use('/api/v1/cms', cmsRoutes);

// Public endpoints (untuk customer page tanpa auth)
app.use('/api/public/cms', cmsPublicRoutes);
app.use('/api/public/products', productsPublicRoutes);

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