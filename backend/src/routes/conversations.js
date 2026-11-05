const router = require('express').Router();
const mongoose = require('mongoose');
const { Conversation, Customer, Message, User } = require('../models');
const { sendOutbound } = require('../services/messaging');
const { escapeRegex } = require('../utils');
const { can } = require('../permissions');

const populateConv = (q) =>
  q.populate('account', 'name phoneNumber color').populate('customer', 'name phone email company').populate('assignedTo', 'name role');

// GET /api/conversations?accountId=&status=&unread=true&search=
router.get('/', async (req, res) => {
  const { accountId, status, unread, search } = req.query;
  const filter = {};
  if (accountId && mongoose.isValidObjectId(accountId)) filter.account = accountId;
  if (status === 'open' || status === 'closed') filter.status = status;
  if (unread === 'true') filter.unreadCount = { $gt: 0 };
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    const customers = await Customer.find({ $or: [{ name: rx }, { phone: rx }] }).select('_id');
    filter.$or = [{ customer: { $in: customers.map((c) => c._id) } }, { lastMessage: rx }];
  }
  res.json(await populateConv(Conversation.find(filter).sort({ lastMessageAt: -1 }).limit(200)));
});

router.get('/:id', async (req, res) => {
  const conv = await populateConv(Conversation.findById(req.params.id));
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  const messages = await Message.find({ conversation: conv._id }).sort({ createdAt: 1 }).populate('sentBy', 'name');
  res.json({ ...conv.toJSON(), messages });
});

router.post('/:id/read', async (req, res) => {
  const conv = await Conversation.findByIdAndUpdate(req.params.id, { unreadCount: 0 }, { returnDocument: 'after' });
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  await Message.updateMany({ conversation: conv._id, direction: 'inbound', status: 'received' }, { status: 'read' });
  res.json({ ok: true });
});

// Update status / assignee
router.patch('/:id', async (req, res) => {
  const update = {};
  if (['open', 'closed'].includes(req.body?.status)) {
    if (!(await can(req.user, 'conversations.close'))) return res.status(403).json({ error: 'You do not have permission to close or reopen conversations' });
    update.status = req.body.status;
  }
  if (req.body?.assignedTo !== undefined) {
    if (!(await can(req.user, 'conversations.assign'))) return res.status(403).json({ error: 'You do not have permission to assign conversations' });
    const id = req.body.assignedTo || null;
    if (id && !(await User.exists({ _id: id }))) return res.status(400).json({ error: 'User not found' });
    update.assignedTo = id;
  }
  const conv = await populateConv(Conversation.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after' }));
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  res.json(conv);
});

router.post('/:id/messages', async (req, res) => {
  const text = String(req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Message text is required' });
  if (text.length > 4096) return res.status(400).json({ error: 'Message too long (max 4096 chars)' });
  const msg = await sendOutbound(req.params.id, text, req.user.id);
  await msg.populate('sentBy', 'name');
  res.status(201).json(msg);
});

module.exports = router;
