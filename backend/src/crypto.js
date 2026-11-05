const crypto = require('crypto');
const config = require('./config');

// AES-256-GCM encryption for provider credentials stored in MongoDB.
// Format: v1:<iv>:<tag>:<ciphertext> (base64 parts).
function key() {
  const material = config.encryptionKey || config.jwtSecret;
  if (!material) throw new Error('ENCRYPTION_KEY or JWT_SECRET must be set to store credentials');
  return crypto.createHash('sha256').update(material).digest();
}

function encrypt(plain) {
  if (!plain) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), enc.toString('base64')].join(':');
}

function decrypt(value) {
  if (!value) return '';
  const [v, iv, tag, data] = String(value).split(':');
  if (v !== 'v1') throw new Error('Unknown credential format');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };
