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

const { closeBrowser } = require('./browserPool');

const app = express();
const PORT = process.env.PORT || 4000;

dns.setDefaultResultOrder('ipv4first');
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '4mb' }));

app.get('/health', (req, res) => res.json({ ok: true, db: 'postgres' }));

app.use('/auth', authRoutes);
app.use('/customers', customerRoutes);
app.use('/items', itemRoutes);
app.use('/invoices', invoiceRoutes);
app.use('/invoices', paymentRoutes);
app.use('/analytics', analyticsRoutes);

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
