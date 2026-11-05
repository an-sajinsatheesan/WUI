const express = require('express');
const cors = require('cors');
const config = require('./config');
const { connectDB } = require('./db');
const { requireAuth } = require('./middleware/auth');

const app = express();

// --- CORS: only the configured frontend origins may call the API ---
function originAllowed(origin) {
  return config.corsOrigins.some((allowed) => {
    if (allowed === '*') return true;
    if (allowed.includes('*')) {
      const rx = new RegExp('^' + allowed.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^.]+') + '$');
      return rx.test(origin);
    }
    return allowed === origin;
  });
}

app.use(
  cors({
    origin(origin, cb) {
      // Allow non-browser clients (curl, server-to-server webhooks) which send no Origin.
      if (!origin || originAllowed(origin)) return cb(null, true);
      return cb(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-webhook-token'],
    maxAge: 86400,
  })
);
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, provider: config.whatsappProvider }));

// Ensure a DB connection for every API call (cached; cheap on warm serverless instances).
app.use('/api', async (_req, _res, next) => {
  try {
    await connectDB();
    // Optional one-time demo data for a fresh deployment (SEED_ON_EMPTY=true).
    if (process.env.SEED_ON_EMPTY === 'true' && !global.__seedChecked) {
      global.__seedChecked = true;
      await require('./seed').seed({ ifEmpty: true });
    }
    next();
  } catch (err) {
    next(Object.assign(err, { status: 503, expose: 'Database unavailable' }));
  }
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/webhooks', require('./routes/webhooks'));

app.use('/api', requireAuth);
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/conversations', require('./routes/conversations'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/users', require('./routes/users'));
app.use('/api/simulate', require('./routes/simulate'));

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  let status = err.status || 500;
  let message = err.expose || err.message || 'Server error';
  if (err.name === 'CastError') [status, message] = [400, 'Invalid id'];
  if (err.name === 'ValidationError') status = 400;
  if (err.code === 11000) [status, message] = [409, 'A record with this value already exists'];
  if (status >= 500) {
    console.error(err);
    if (config.env === 'production' && !err.expose) message = 'Server error';
  }
  res.status(status).json({ error: message });
});

module.exports = app;
