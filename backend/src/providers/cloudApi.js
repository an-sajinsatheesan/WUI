// Shared logic for providers that speak the WhatsApp Cloud API message format
// (Meta directly, and 360dialog which proxies the same format).
const { digits } = require('./http');

function textMessageBody(to, text) {
  return JSON.stringify({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: digits(to),
    type: 'text',
    text: { preview_url: false, body: text },
  });
}

/** Cloud API webhook payload -> normalized inbound messages. */
function parseCloudWebhook(body) {
  const out = [];
  for (const entry of body?.entry || []) {
    for (const change of entry?.changes || []) {
      const value = change?.value || {};
      const to = value.metadata?.display_phone_number || '';
      const phoneNumberId = value.metadata?.phone_number_id || '';
      const names = Object.fromEntries((value.contacts || []).map((c) => [c.wa_id, c.profile?.name]));
      for (const m of value.messages || []) {
        const text = m.type === 'text' ? m.text?.body : m[m.type]?.caption || `[${m.type} message]`;
        out.push({
          from: `+${digits(m.from)}`,
          to,
          phoneNumberId,
          text: String(text || ''),
          providerMessageId: m.id,
          timestamp: m.timestamp ? new Date(Number(m.timestamp) * 1000) : new Date(),
          customerName: names[m.from],
        });
      }
    }
  }
  return out.filter((m) => m.text);
}

module.exports = { textMessageBody, parseCloudWebhook };
