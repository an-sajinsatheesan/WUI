const crypto = require('crypto');

/**
 * Mock WhatsApp provider. No network calls, no API keys.
 *
 * Every provider implements the same interface:
 *   name: string
 *   sendMessage({ from, to, text }) -> Promise<{ providerMessageId, status }>
 *   parseWebhook(body) -> Array<{ from, to, text, providerMessageId, timestamp }>
 *
 * To integrate the real WhatsApp Cloud API later, add e.g. `metaProvider.js`
 * implementing this interface and select it with WHATSAPP_PROVIDER=meta.
 */
const mockProvider = {
  name: 'mock',

  async sendMessage({ from, to, text }) {
    if (!from || !to || !text) throw new Error('from, to and text are required');
    return { providerMessageId: `mock.${crypto.randomUUID()}`, status: 'delivered' };
  },

  // Accepts our own simple simulated webhook shape:
  // { messages: [{ from: "+9715...", to: "+9714...", text: "Hi" }] }
  parseWebhook(body) {
    const list = Array.isArray(body?.messages) ? body.messages : [];
    return list
      .filter((m) => m && m.from && m.to && m.text)
      .map((m) => ({
        from: String(m.from),
        to: String(m.to),
        text: String(m.text),
        providerMessageId: m.id || `mock.${crypto.randomUUID()}`,
        timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
      }));
  },
};

module.exports = mockProvider;
