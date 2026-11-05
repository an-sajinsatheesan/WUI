const { request, trimSlash } = require('./http');
const { textMessageBody, parseCloudWebhook } = require('./cloudApi');

/** 360dialog: a WhatsApp BSP exposing the Cloud API format with a D360-API-KEY header. */
module.exports = {
  name: '360dialog',
  label: '360dialog',
  description: 'WhatsApp-focused provider. Flat monthly fee per number; Meta message fees passed through.',
  docsUrl: 'https://docs.360dialog.com/docs/waba-messaging/messaging',
  fields: [
    { key: 'apiUrl', label: 'API base URL', type: 'url', default: 'https://waba-v2.360dialog.io', required: true },
    { key: 'apiKey', label: 'API key (D360-API-KEY)', type: 'secret', required: true, help: '360dialog Hub → your number → Generate API key' },
  ],

  async sendMessage(account, creds, { to, text }) {
    const data = await request(`${trimSlash(account.providerConfig?.apiUrl)}/messages`, {
      method: 'POST',
      headers: { 'D360-API-KEY': creds.apiKey, 'Content-Type': 'application/json' },
      body: textMessageBody(to, text),
    });
    return { providerMessageId: data?.messages?.[0]?.id || '', status: 'sent' };
  },

  async testConnection(account, creds) {
    const data = await request(`${trimSlash(account.providerConfig?.apiUrl)}/v1/configs/webhook`, {
      headers: { 'D360-API-KEY': creds.apiKey },
    });
    return { status: 'connected', message: data?.url ? `Connected. Webhook: ${data.url}` : 'Connected (no webhook URL set at 360dialog yet)' };
  },

  parseWebhook(req) {
    return parseCloudWebhook(req.body);
  },
};
