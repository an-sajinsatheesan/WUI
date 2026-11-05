// Vercel serverless entry point. vercel.json routes every request here;
// the Express app handles the /api/* paths itself.
module.exports = require('../src/app');
