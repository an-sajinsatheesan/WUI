/**
 * Optional: run the API against a throwaway in-memory MongoDB (no Atlas needed).
 * Data is lost when the process stops. Useful for a quick try-out or offline work.
 *   npm run dev:memory
 */
const { MongoMemoryServer } = require('mongodb-memory-server');

(async () => {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.MONGODB_DB = 'whatsapp_mvp';
  const { seed } = require('../src/seed');
  await seed();
  require('../src/server');
})();
