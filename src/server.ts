import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import authRoutes from './routes/auth.routes';
import settingsRoutes from './routes/settings.routes';
import dashboardRoutes from './routes/dashboard.routes';
import categoryRoutes from './routes/category.routes';
import productRoutes from './routes/product.routes';
import branchRoutes from './routes/branch.routes';
import userRoutes from './routes/user.routes';
import promotionRoutes from './routes/promotion.routes';
import hrRoutes from './routes/hr.routes';
import memberRoutes from './routes/member.routes';
import cashflowRoutes from './routes/cashflow.routes';
import orderRoutes from './routes/order.routes';
import salesRoutes from './routes/sales.routes';
import expenseRoutes from './routes/expense.routes';
import financialRoutes from './routes/financial.routes';
import receiptRoutes from './routes/receipt.routes';
import orderHistoryRoutes from './routes/orderhistory.routes';
import kdsRoutes from './routes/kds.routes';
import customerOrderRoutes from './routes/customer.order.routes';

import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;


// Aktifkan helmet untuk keamanan header
app.use(helmet({
  crossOriginResourcePolicy: false, // Penting agar gambar bisa diakses lintas origin
  contentSecurityPolicy: false,     // Matikan CSP jika masih bermasalah saat development
}));

// Jika aplikasi diakses lewat proxy (Traefik), tambahkan ini:
app.set('trust proxy', 1);

// Middleware Global
app.use(cors({
    origin: '*', // Untuk development bisa gunakan '*'
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/api/settings', settingsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/users', userRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/cashflows', cashflowRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/financials', financialRoutes);
app.use('/api/receipt-settings', receiptRoutes);
app.use('/api/orders-history', orderHistoryRoutes);
app.use('/api/kds', kdsRoutes);
app.use('/api/customer', customerOrderRoutes);


// Root Endpoint
app.get('/', (req, res) => {
  res.send('EPS POS API is Running...');
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});