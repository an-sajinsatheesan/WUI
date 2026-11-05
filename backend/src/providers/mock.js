const crypto = require('crypto');

/** Simulated provider: no network calls, no credentials. */
module.exports = {
  name: 'mock',
  label: 'Simulated (demo)',
  description: 'No real WhatsApp connection. Use the simulator buttons in the inbox to create incoming messages.',
  docsUrl: '',
  fields: [],

  async sendMessage() {
    return { providerMessageId: `mock.${crypto.randomUUID()}`, status: 'delivered' };
  },

  async testConnection() {
    return { status: 'simulated', message: 'Simulated provider: always available' };
  },

  // Simple JSON shape: { messages: [{ from: "+9715...", to: "+9714...", text: "Hi" }] }
  parseWebhook(req) {
    const list = Array.isArray(req.body?.messages) ? req.body.messages : [];
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
