const router = require('express').Router();
const { Account, Customer, Conversation } = require('../models');
const { receiveInbound } = require('../services/messaging');
const { requirePermission } = require('../permissions');

router.use(requirePermission('simulate.messages'));

const SAMPLE_TEXTS = [
  'Hi, is my order shipped yet?',
  'Can I change the delivery address?',
  'The payment failed twice, can you check?',
  'Thanks for the quick help!',
  'Do you have this in a larger size?',
  'I still have not received the refund.',
  'What are your opening hours on Friday?',
  'Can someone call me back please?',
  'The product arrived damaged.',
  'Is there any discount for bulk orders?',
];

const randomOf = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * POST /api/simulate/incoming
 * body: { conversationId? } | { accountId?, customerId? }, text?
 * Pretends a customer sent a WhatsApp message. Goes through the same
 * receiveInbound() path a real webhook would use.
 */
router.post('/incoming', async (req, res) => {
  const { conversationId, accountId, customerId } = req.body || {};
  const text = String(req.body?.text || '').trim() || randomOf(SAMPLE_TEXTS);

  let account;
  let customer;
  if (conversationId) {
    const conv = await Conversation.findById(conversationId).populate('account customer');
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    account = conv.account;
    customer = conv.customer;
  } else {
    account = accountId ? await Account.findById(accountId) : randomOf(await Account.find({ active: true }));
    customer = customerId ? await Customer.findById(customerId) : randomOf(await Customer.find());
  }
  if (!account || !customer) return res.status(400).json({ error: 'No account/customer available. Run the seed first.' });

  const result = await receiveInbound({ accountId: account._id, from: customer.phone, text });
  res.status(201).json(result);
});

module.exports = router;
