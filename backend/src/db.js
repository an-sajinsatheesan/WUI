const mongoose = require('mongoose');
const config = require('./config');

// Cache the connection across serverless invocations (Vercel reuses warm instances).
let cached = global.__mongoose;
if (!cached) cached = global.__mongoose = { conn: null, promise: null };

async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!config.mongoUri) throw new Error('MONGODB_URI is not set');
  if (!cached.promise) {
    cached.promise = mongoose
      .connect(config.mongoUri, {
        dbName: config.mongoDb, // all collections live in this database only
        maxPoolSize: 5, // keep well within Atlas M0 connection limits
        serverSelectionTimeoutMS: 10000,
      })
      .then((m) => m)
      .catch((err) => {
        cached.promise = null;
        throw err;
      });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = { connectDB };
