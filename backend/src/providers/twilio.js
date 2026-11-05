const { request, trimSlash, e164 } = require('./http');

const basic = (sid, token) => `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`;
const stripWa = (v) => String(v || '').replace(/^whatsapp:/, '');

/** Twilio Programmable Messaging with a WhatsApp sender. */
module.exports = {
  name: 'twilio',
  label: 'Twilio',
  description: 'Messaging APIs including WhatsApp. Per-message Twilio fee on top of Meta fees.',
  docsUrl: 'https://www.twilio.com/docs/whatsapp/api',
  fields: [
    { key: 'apiUrl', label: 'API base URL', type: 'url', default: 'https://api.twilio.com', required: true },
    { key: 'accountSid', label: 'Account SID', type: 'text', required: true, placeholder: 'AC...' },
    { key: 'fromNumber', label: 'WhatsApp sender number', type: 'text', required: false, help: 'Leave blank to use this account\'s phone number' },
    { key: 'authToken', label: 'Auth token', type: 'secret', required: true },
  ],

  async sendMessage(account, creds, { to, text }) {
    const cfg = account.providerConfig || {};
    const form = new URLSearchParams({
      From: `whatsapp:${e164(cfg.fromNumber || account.phoneNumber)}`,
      To: `whatsapp:${e164(to)}`,
      Body: text,
    });
    const data = await request(`${trimSlash(cfg.apiUrl)}/2010-04-01/Accounts/${encodeURIComponent(cfg.accountSid)}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: basic(cfg.accountSid, creds.authToken), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    return { providerMessageId: data?.sid || '', status: 'sent' };
  },

  async testConnection(account, creds) {
    const cfg = account.providerConfig || {};
    const data = await request(`${trimSlash(cfg.apiUrl)}/2010-04-01/Accounts/${encodeURIComponent(cfg.accountSid)}.json`, {
      headers: { Authorization: basic(cfg.accountSid, creds.authToken) },
    });
    return { status: 'connected', message: `Connected: ${data.friendly_name || cfg.accountSid} (${data.status || 'active'})` };
  },

  // Twilio posts application/x-www-form-urlencoded fields.
  parseWebhook(req) {
    const b = req.body || {};
    if (!b.From || !b.MessageSid) return [];
    const media = Number(b.NumMedia || 0) > 0 ? '[media message]' : '';
    return [
      {
        from: e164(stripWa(b.From)),
        to: e164(stripWa(b.To)),
        text: String(b.Body || media),
        providerMessageId: b.MessageSid,
        timestamp: new Date(),
        customerName: b.ProfileName,
      },
    ].filter((m) => m.text);
  },
};
