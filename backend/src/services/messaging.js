const { Account, Customer, Conversation, Message } = require('../models');
const { getProvider, credentialsFor, missingFields } = require('../providers');
const { digits } = require('../providers/http');

/** Send an agent reply through the conversation's account provider and store it. */
async function sendOutbound(conversationId, text, userId) {
  const conv = await Conversation.findById(conversationId).populate('customer');
  if (!conv) throw Object.assign(new Error('Conversation not found'), { status: 404 });
  const account = await Account.findById(conv.account).select('+providerSecrets');
  if (!account) throw Object.assign(new Error('WhatsApp account not found'), { status: 404 });
  if (!account.active) throw Object.assign(new Error(`The ${account.name} number is deactivated. An admin can activate it under WhatsApp Accounts.`), { status: 409 });
  const missing = missingFields(account);
  if (missing.length) throw Object.assign(new Error(`${account.name} is not fully configured (missing: ${missing.join(', ')})`), { status: 409 });

  const result = await getProvider(account.provider).sendMessage(account, credentialsFor(account), { to: conv.customer.phone, text });

  const msg = await Message.create({
    conversation: conv._id,
    direction: 'outbound',
    text,
    status: result.status,
    sentBy: userId || null,
    providerMessageId: result.providerMessageId,
  });

  conv.lastMessage = text;
  conv.lastMessageAt = msg.createdAt;
  if (conv.status === 'closed') conv.status = 'open';
  await conv.save();
  return msg;
}

/** Find the business account a message was sent to. */
async function findAccount({ accountId, to, phoneNumberId }) {
  if (accountId) return Account.findById(accountId);
  if (phoneNumberId) {
    const byId = await Account.findOne({ 'providerConfig.phoneNumberId': phoneNumberId });
    if (byId) return byId;
  }
  const d = digits(to);
  if (!d) return null;
  const accounts = await Account.find();
  return accounts.find((a) => digits(a.phoneNumber) === d) || null;
}

/**
 * Store an incoming customer message. Used by webhooks and the simulator,
 * so a provider only needs to translate its payload into { from, to, text }.
 */
async function receiveInbound({ accountId, from, to, phoneNumberId, text, providerMessageId, timestamp, customerName }) {
  const account = await findAccount({ accountId, to, phoneNumberId });
  if (!account) throw Object.assign(new Error(`No business account for number ${to || phoneNumberId}`), { status: 404 });

  if (providerMessageId && (await Message.exists({ providerMessageId }))) return { duplicate: true }; // provider retry

  let customer = await Customer.findOne({ phone: from });
  if (!customer) customer = await Customer.create({ name: customerName || from, phone: from });

  const at = timestamp || new Date();
  const conv = await Conversation.findOneAndUpdate(
    { account: account._id, customer: customer._id },
    { $set: { lastMessage: text, lastMessageAt: at, status: 'open' }, $inc: { unreadCount: 1 } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );

  const msg = await Message.create({
    conversation: conv._id,
    direction: 'inbound',
    text,
    status: 'received',
    providerMessageId: providerMessageId || '',
    createdAt: at,
  });
  return { conversation: conv, message: msg };
}

module.exports = { sendOutbound, receiveInbound };
