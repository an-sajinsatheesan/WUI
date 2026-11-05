const config = require('../config');
const mockProvider = require('./mockProvider');

const providers = {
  mock: mockProvider,
  // meta: require('./metaProvider'),  // future real WhatsApp Cloud API provider
};

function getProvider() {
  const p = providers[config.whatsappProvider];
  if (!p) throw new Error(`Unknown WHATSAPP_PROVIDER "${config.whatsappProvider}"`);
  return p;
}

module.exports = { getProvider };
