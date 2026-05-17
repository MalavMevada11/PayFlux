require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initSchema } = require('./schema');
const dns = require('dns');

const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customers');
const itemRoutes = require('./routes/items');
const invoiceRoutes = require('./routes/invoices');
const paymentRoutes = require('./routes/payments');
const analyticsRoutes = require('./routes/analytics');
const linkRoutes = require('./routes/links');
const adminRoutes = require('./routes/admin');
const portalRoutes = require('./routes/portal');
const razorpayRoutes = require('./routes/razorpay');

const { authMiddleware } = require('./middleware/auth');
const { requireRole } = require('./middleware/rbac');
const { closeBrowser } = require('./browserPool');

const app = express();
const PORT = process.env.PORT || 4000;

dns.setDefaultResultOrder('ipv4first');
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '4mb' }));

app.get('/health', (req, res) => res.json({ ok: true, db: 'postgres' }));

// ── Public auth routes (login, register) ──
app.use('/auth', authRoutes);

// ── Business routes (admin + business can access) ──
app.use('/customers', authMiddleware, requireRole('admin', 'business'), customerRoutes);
app.use('/items', authMiddleware, requireRole('admin', 'business'), itemRoutes);
app.use('/invoices', authMiddleware, requireRole('admin', 'business'), invoiceRoutes);
app.use('/invoices', authMiddleware, requireRole('admin', 'business'), paymentRoutes);
app.use('/analytics', authMiddleware, requireRole('admin', 'business'), analyticsRoutes);

// ── Link management (business + customer) ──
app.use('/links', linkRoutes);

// ── Admin panel ──
app.use('/admin', adminRoutes);

// ── Customer portal ──
app.use('/portal', portalRoutes);

// ── Razorpay payment gateway ──
app.use('/razorpay', razorpayRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Async startup: initialize schema then listen
(async () => {
  try {
    await initSchema();
    app.listen(PORT, () => {
      console.log(`✓ PayFlux API listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  }
})();

// Graceful shutdown — close the shared Puppeteer browser
process.on('SIGINT', async () => {
  console.log('\n⏻ Shutting down...');
  await closeBrowser();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await closeBrowser();
  process.exit(0);
});
