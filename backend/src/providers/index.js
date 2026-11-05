const { decrypt } = require('../crypto');

/**
 * Provider registry. Every adapter implements:
 *   sendMessage(account, credentials, { to, text }) -> { providerMessageId, status }
 *   testConnection(account, credentials)            -> { status, message }
 *   parseWebhook(req)                                -> [{ from, to, text, providerMessageId, timestamp, customerName? }]
 * and describes its settings in `fields` (type "secret" fields are stored encrypted).
 */
const providers = {
  mock: require('./mock'),
  meta: require('./meta'),
  '360dialog': require('./dialog360'),
  wati: require('./wati'),
  twilio: require('./twilio'),
};

function getProvider(name) {
  const p = providers[name || 'mock'];
  if (!p) throw Object.assign(new Error(`Unknown provider "${name}"`), { status: 400 });
  return p;
}

/** Public description used by the admin UI to render the configuration form. */
function catalog() {
  return Object.values(providers).map(({ name, label, description, docsUrl, fields }) => ({ name, label, description, docsUrl, fields }));
}

/** Decrypted secrets for an account loaded with .select('+providerSecrets'). */
function credentialsFor(account) {
  const out = {};
  for (const [k, v] of Object.entries(account.providerSecrets || {})) out[k] = v ? decrypt(v) : '';
  return out;
}

/** Names of required fields that are still empty for this account. */
function missingFields(account) {
  const p = getProvider(account.provider);
  const cfg = account.providerConfig || {};
  const secrets = account.providerSecrets || {};
  return p.fields.filter((f) => f.required && !(f.type === 'secret' ? secrets[f.key] : cfg[f.key])).map((f) => f.label);
}

module.exports = { getProvider, catalog, credentialsFor, missingFields };
