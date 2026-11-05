// Small helpers shared by the provider adapters.

const digits = (phone) => String(phone || '').replace(/\D/g, '');
const e164 = (phone) => `+${digits(phone)}`;
const trimSlash = (url) => String(url || '').trim().replace(/\/+$/, '');

class ProviderError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status && status >= 400 && status < 500 ? 400 : 502;
  }
}

/** fetch with a timeout; returns parsed JSON (or text) and throws ProviderError on HTTP errors. */
async function request(url, { method = 'GET', headers = {}, body, timeoutMs = 10000 } = {}) {
  let res;
  try {
    res = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    throw new ProviderError(`Could not reach provider: ${err.message}`);
  }
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const detail = data?.error?.message || data?.message || data?.meta?.developer_message || data?.raw || res.statusText;
    throw new ProviderError(`Provider returned ${res.status}: ${String(detail).slice(0, 300)}`, res.status);
  }
  return data;
}

module.exports = { digits, e164, trimSlash, request, ProviderError };
