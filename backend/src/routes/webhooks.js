const router = require('express').Router();
const express = require('express');
const config = require('../config');
const { getProvider } = require('../providers');
const { receiveInbound } = require('../services/messaging');

/**
 * Incoming messages from providers.
 *
 *   POST /api/webhooks/whatsapp            simulated/mock JSON format (kept for compatibility)
 *   POST /api/webhooks/:provider           meta | 360dialog | wati | twilio | mock
 *   GET  /api/webhooks/meta                Meta webhook verification (hub.challenge)
 *
 * Optional ?account=<id> pins the business account (needed for WATI).
 * If WEBHOOK_TOKEN is set, callers must send it as ?token= or the x-webhook-token header.
 */
router.use(express.urlencoded({ extended: false, limit: '100kb' })); // Twilio posts form data

router.get('/meta', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  if (mode === 'subscribe' && config.metaVerifyToken && token === config.metaVerifyToken) {
    return res.status(200).send(String(req.query['hub.challenge'] || ''));
  }
  res.status(403).send('Verification failed');
});

router.post('/:provider', async (req, res) => {
  if (config.webhookToken && (req.query.token || req.headers['x-webhook-token']) !== config.webhookToken) {
    return res.status(401).json({ error: 'Invalid webhook token' });
  }
  const name = req.params.provider === 'whatsapp' ? 'mock' : req.params.provider;
  const provider = getProvider(name);

  const incoming = provider.parseWebhook(req);
  const results = [];
  for (const m of incoming) {
    try {
      const r = await receiveInbound({ ...m, accountId: req.query.account || undefined });
      results.push({ ok: true, id: r.message?.id, duplicate: !!r.duplicate });
    } catch (err) {
      results.push({ ok: false, error: err.message });
    }
  }

  // Providers only need a fast 200; Twilio expects TwiML.
  if (name === 'twilio') return res.type('text/xml').send('<Response></Response>');
  res.json({ received: results.length, results });
});

module.exports = router;
