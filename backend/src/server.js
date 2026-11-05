const app = require('./app');
const config = require('./config');
const { connectDB } = require('./db');

connectDB()
  .then(() => {
    app.listen(config.port, () => {
      console.log(`API listening on http://localhost:${config.port}/api (db: ${config.mongoDb})`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });
