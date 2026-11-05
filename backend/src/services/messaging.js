const { Account, Customer, Conversation, Message } = require('../models');
const { getProvider } = require('../providers');

/** Send an agent reply through the active provider and store it. */
async function sendOutbound(conversation, text, userId) {
  const conv = await Conversation.findById(conversation._id || conversation).populate('account customer');
  if (!conv) throw Object.assign(new Error('Conversation not found'), { status: 404 });

  let result;
  try {
    result = await getProvider().sendMessage({ from: conv.account.phoneNumber, to: conv.customer.phone, text });
  } catch (err) {
    result = { providerMessageId: '', status: 'failed' };
  }

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

/**
 * Store an incoming customer message. Used by both the webhook and the simulator,
 * so a real provider only needs to translate its payload into { from, to, text }.
 */
async function receiveInbound({ from, to, text, providerMessageId, timestamp, customerName }) {
  const account = await Account.findOne({ phoneNumber: to });
  if (!account) throw Object.assign(new Error(`No business account for number ${to}`), { status: 404 });

  let customer = await Customer.findOne({ phone: from });
  if (!customer) customer = await Customer.create({ name: customerName || from, phone: from });

  const at = timestamp || new Date();
  const conv = await Conversation.findOneAndUpdate(
    { account: account._id, customer: customer._id },
    {
      $set: { lastMessage: text, lastMessageAt: at, status: 'open' },
      $inc: { unreadCount: 1 },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
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
