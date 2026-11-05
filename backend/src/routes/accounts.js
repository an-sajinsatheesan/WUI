const router = require('express').Router();
const { Account, Conversation } = require('../models');
const { requireAdmin } = require('../middleware/auth');
const { getProvider, catalog, credentialsFor, missingFields } = require('../providers');
const { encrypt } = require('../crypto');
const { pick } = require('../utils');

const FIELDS = ['name', 'phoneNumber', 'color', 'department', 'active'];

// Everyone signed in can list numbers (inbox filter). Secrets are never included.
router.get('/', async (_req, res) => {
  const [accounts, stats] = await Promise.all([
    Account.find().sort({ name: 1 }),
    Conversation.aggregate([{ $group: { _id: '$account', unread: { $sum: '$unreadCount' }, conversations: { $sum: 1 } } }]),
  ]);
  const map = Object.fromEntries(stats.map((u) => [String(u._id), u]));
  res.json(accounts.map((a) => ({ ...a.toJSON(), unread: map[a.id]?.unread || 0, conversations: map[a.id]?.conversations || 0 })));
});

// Provider list and the settings each one needs (for the admin form).
router.get('/providers', requireAdmin, (_req, res) => res.json(catalog()));

/** Apply provider settings from the request. Secrets: empty = keep, null = clear. */
function applyProvider(account, body) {
  const next = body.provider || account.provider || 'mock';
  const provider = getProvider(next);
  if (next !== account.provider) {
    account.provider = next;
    account.providerConfig = {};
    account.providerSecrets = {};
  }
  const cfg = { ...(account.providerConfig || {}) };
  const secrets = { ...(account.providerSecrets || {}) };
  for (const f of provider.fields) {
    if (f.type === 'secret') {
      const v = body.providerSecrets?.[f.key];
      if (v === null) delete secrets[f.key];
      else if (typeof v === 'string' && v.trim()) secrets[f.key] = encrypt(v.trim());
    } else {
      const v = body.providerConfig?.[f.key];
      if (typeof v === 'string') cfg[f.key] = v.trim();
      if (!cfg[f.key] && f.default) cfg[f.key] = f.default;
    }
  }
  account.providerConfig = cfg;
  account.providerSecrets = secrets;
  account.markModified('providerConfig');
  account.markModified('providerSecrets');

  // Reset status; a fresh "Test connection" confirms it.
  const missing = missingFields(account);
  account.connectionStatus = account.provider === 'mock' ? 'simulated' : 'not_configured';
  account.statusMessage = missing.length ? `Missing: ${missing.join(', ')}` : account.provider === 'mock' ? '' : 'Saved. Run "Test connection" to verify.';
  account.lastCheckedAt = null;
}

router.post('/', requireAdmin, async (req, res) => {
  const account = new Account(pick(req.body, FIELDS));
  applyProvider(account, req.body || {});
  await account.save();
  res.status(201).json(account);
});

router.put('/:id', requireAdmin, async (req, res) => {
  const account = await Account.findById(req.params.id).select('+providerSecrets');
  if (!account) return res.status(404).json({ error: 'Account not found' });
  Object.assign(account, pick(req.body, FIELDS));
  if (req.body?.provider || req.body?.providerConfig || req.body?.providerSecrets) applyProvider(account, req.body);
  await account.save();
  res.json(account);
});

// Check credentials against the provider and store the result.
router.post('/:id/test', requireAdmin, async (req, res) => {
  const account = await Account.findById(req.params.id).select('+providerSecrets');
  if (!account) return res.status(404).json({ error: 'Account not found' });
  const missing = missingFields(account);
  let result;
  if (missing.length) {
    result = { status: 'not_configured', message: `Missing: ${missing.join(', ')}` };
  } else {
    try {
      result = await getProvider(account.provider).testConnection(account, credentialsFor(account));
    } catch (err) {
      result = { status: 'error', message: err.message };
    }
  }
  account.connectionStatus = result.status;
  account.statusMessage = result.message;
  account.lastCheckedAt = new Date();
  await account.save();
  res.json(account);
});

module.exports = router;
