const router = require('express').Router();
const { getProvider } = require('../providers');
const { receiveInbound } = require('../services/messaging');

/**
 * POST /api/webhooks/whatsapp
 * Provider-agnostic inbound endpoint. The active provider translates its own
 * payload format; storage logic is shared. If WEBHOOK_TOKEN is set, callers
 * must send it in the `x-webhook-token` header.
 */
router.post('/whatsapp', async (req, res) => {
  const expected = process.env.WEBHOOK_TOKEN;
  if (expected && req.headers['x-webhook-token'] !== expected) {
    return res.status(401).json({ error: 'Invalid webhook token' });
  }
  const incoming = getProvider().parseWebhook(req.body);
  const results = [];
  for (const m of incoming) {
    try {
      const { message } = await receiveInbound(m);
      results.push({ id: message.id, ok: true });
    } catch (err) {
      results.push({ ok: false, error: err.message });
    }
  }
  res.json({ received: results.length, results });
});

module.exports = router;
