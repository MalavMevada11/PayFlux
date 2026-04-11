require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initSchema } = require('./schema');

// Auto-initialize SQLite tables on startup
initSchema();

const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customers');
const itemRoutes = require('./routes/items');
const invoiceRoutes = require('./routes/invoices');
const paymentRoutes = require('./routes/payments');
const analyticsRoutes = require('./routes/analytics');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '4mb' }));

app.get('/health', (req, res) => res.json({ ok: true, db: 'sqlite' }));

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

app.listen(PORT, () => {
  console.log(`✓ PayFlux API listening on http://localhost:${PORT}`);
});
