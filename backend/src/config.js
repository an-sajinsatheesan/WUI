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
  whatsappProvider: process.env.WHATSAPP_PROVIDER || 'mock',
};

if (!config.jwtSecret) {
  if (config.env === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  config.jwtSecret = 'dev-only-secret-change-me';
}

module.exports = config;
