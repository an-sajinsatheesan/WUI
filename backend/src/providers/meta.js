const { request, trimSlash } = require('./http');
const { textMessageBody, parseCloudWebhook } = require('./cloudApi');

/** Meta WhatsApp Cloud API (direct). */
module.exports = {
  name: 'meta',
  label: 'Meta WhatsApp Cloud API',
  description: 'Direct integration with Meta. No platform fee; you pay only Meta message fees.',
  docsUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started',
  fields: [
    { key: 'apiUrl', label: 'API base URL', type: 'url', default: 'https://graph.facebook.com/v23.0', required: true },
    { key: 'phoneNumberId', label: 'Phone number ID', type: 'text', required: true, help: 'WhatsApp Manager → Phone numbers, or the API Setup page of your Meta app' },
    { key: 'businessAccountId', label: 'WhatsApp Business Account ID', type: 'text', required: false },
    { key: 'accessToken', label: 'Access token', type: 'secret', required: true, help: 'Use a permanent System User token, not the 24-hour temporary token' },
  ],

  async sendMessage(account, creds, { to, text }) {
    const cfg = account.providerConfig || {};
    const data = await request(`${trimSlash(cfg.apiUrl)}/${encodeURIComponent(cfg.phoneNumberId)}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${creds.accessToken}`, 'Content-Type': 'application/json' },
      body: textMessageBody(to, text),
    });
    return { providerMessageId: data?.messages?.[0]?.id || '', status: 'sent' };
  },

  async testConnection(account, creds) {
    const cfg = account.providerConfig || {};
    const data = await request(
      `${trimSlash(cfg.apiUrl)}/${encodeURIComponent(cfg.phoneNumberId)}?fields=display_phone_number,verified_name,quality_rating`,
      { headers: { Authorization: `Bearer ${creds.accessToken}` } }
    );
    return { status: 'connected', message: `Connected: ${data.verified_name || 'number'} (${data.display_phone_number || cfg.phoneNumberId})` };
  },

  parseWebhook(req) {
    return parseCloudWebhook(req.body);
  },
};
