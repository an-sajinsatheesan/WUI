require('dotenv').config({ quiet: true });

const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  mongoUri: process.env.MONGODB_URI || '',
  // Always a dedicated database. Never point this at an existing database.
  mongoDb: process.env.MONGODB_DB || 'whatsapp_mvp',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  // Comma-separated list. Supports a leading wildcard host, e.g. https://*.vercel.app
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:4200')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  // Default provider for new WhatsApp accounts. Each account can override it in the UI.
  whatsappProvider: process.env.WHATSAPP_PROVIDER || 'mock',
  // Key for encrypting provider credentials (API keys, tokens) in MongoDB.
  // Falls back to JWT_SECRET. Changing it makes saved credentials unreadable (re-enter them).
  encryptionKey: process.env.ENCRYPTION_KEY || '',
  // Optional shared secret for incoming webhooks (?token= or x-webhook-token header).
  webhookToken: process.env.WEBHOOK_TOKEN || '',
  // Token you enter in the Meta App dashboard when verifying the webhook URL.
  metaVerifyToken: process.env.META_VERIFY_TOKEN || '',
};

// Required settings that are missing. In production the API answers every call with a
// clear 503 listing them (see app.js) instead of crashing.
config.missing = [!config.mongoUri && 'MONGODB_URI', !config.jwtSecret && config.env === 'production' && 'JWT_SECRET'].filter(Boolean);

if (!config.jwtSecret && config.env !== 'production') config.jwtSecret = 'dev-only-secret-change-me';

module.exports = config;
