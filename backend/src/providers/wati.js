const { request, trimSlash, digits } = require('./http');

const bearer = (token) => `Bearer ${String(token || '').replace(/^Bearer\s+/i, '')}`;

/** WATI: shared inbox / automation platform with a REST API per tenant. */
module.exports = {
  name: 'wati',
  label: 'WATI',
  description: 'Shared inbox and automation platform. Monthly plan plus WhatsApp message fees.',
  docsUrl: 'https://docs.wati.io/reference/introduction',
  fields: [
    { key: 'apiUrl', label: 'API endpoint', type: 'url', default: '', required: true, placeholder: 'https://live-mt-server.wati.io/123456', help: 'WATI dashboard → API Docs → API Endpoint (includes your tenant ID)' },
    { key: 'accessToken', label: 'Access token', type: 'secret', required: true, help: 'WATI dashboard → API Docs → Access Token' },
  ],

  async sendMessage(account, creds, { to, text }) {
    const url = `${trimSlash(account.providerConfig?.apiUrl)}/api/v1/sendSessionMessage/${digits(to)}?messageText=${encodeURIComponent(text)}`;
    const data = await request(url, { method: 'POST', headers: { Authorization: bearer(creds.accessToken) } });
    if (data?.result === false) throw Object.assign(new Error(data?.info || 'WATI rejected the message'), { status: 502 });
    return { providerMessageId: data?.message?.id || data?.id || '', status: 'sent' };
  },

  async testConnection(account, creds) {
    await request(`${trimSlash(account.providerConfig?.apiUrl)}/api/v1/getContacts?pageSize=1&pageNumber=1`, {
      headers: { Authorization: bearer(creds.accessToken) },
    });
    return { status: 'connected', message: 'Connected to WATI' };
  },

  // WATI "message received" webhook. The business number is identified by the ?account= query param.
  parseWebhook(req) {
    const b = req.body || {};
    if (!b.waId || !(b.text || b.type)) return [];
    if (b.owner === true || b.eventType === 'sessionMessageSent') return []; // our own outgoing messages
    return [
      {
        from: `+${digits(b.waId)}`,
        to: '',
        text: String(b.text || `[${b.type} message]`),
        providerMessageId: b.whatsappMessageId || b.id || '',
        timestamp: b.timestamp ? new Date(Number(b.timestamp) * 1000) : new Date(),
        customerName: b.senderName,
      },
    ];
  },
};
