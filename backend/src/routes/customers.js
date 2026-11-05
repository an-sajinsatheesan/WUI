const router = require('express').Router();
const { Customer, Conversation, Message, Ticket } = require('../models');
const { requirePermission } = require('../permissions');
const { pick, escapeRegex } = require('../utils');

const FIELDS = ['name', 'phone', 'email', 'company', 'notes'];

router.get('/', async (req, res) => {
  const filter = {};
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(req.query.search), 'i');
    filter.$or = [{ name: rx }, { phone: rx }, { email: rx }, { company: rx }];
  }
  const customers = await Customer.find(filter).sort({ name: 1 }).limit(500);
  const ids = customers.map((c) => c._id);
  const [convs, tickets] = await Promise.all([
    Conversation.aggregate([
      { $match: { customer: { $in: ids } } },
      { $group: { _id: '$customer', conversations: { $sum: 1 }, lastMessageAt: { $max: '$lastMessageAt' } } },
    ]),
    Ticket.aggregate([
      { $match: { customer: { $in: ids }, status: { $nin: ['resolved', 'closed'] } } },
      { $group: { _id: '$customer', openTickets: { $sum: 1 } } },
    ]),
  ]);
  const cm = Object.fromEntries(convs.map((c) => [String(c._id), c]));
  const tm = Object.fromEntries(tickets.map((t) => [String(t._id), t]));
  res.json(
    customers.map((c) => ({
      ...c.toJSON(),
      conversations: cm[c.id]?.conversations || 0,
      lastMessageAt: cm[c.id]?.lastMessageAt || null,
      openTickets: tm[c.id]?.openTickets || 0,
    }))
  );
});

// Customer profile with full conversation history across all business numbers
router.get('/:id', async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  const conversations = await Conversation.find({ customer: customer._id })
    .sort({ lastMessageAt: -1 })
    .populate('account', 'name phoneNumber color')
    .populate('assignedTo', 'name');
  const messages = await Message.find({ conversation: { $in: conversations.map((c) => c._id) } })
    .sort({ createdAt: 1 })
    .populate('sentBy', 'name');
  const tickets = await Ticket.find({ customer: customer._id })
    .sort({ updatedAt: -1 })
    .populate('assignedTo', 'name')
    .populate('account', 'name color');

  res.json({
    ...customer.toJSON(),
    conversations: conversations.map((c) => ({
      ...c.toJSON(),
      messages: messages.filter((m) => String(m.conversation) === c.id),
    })),
    tickets,
  });
});

router.post('/', requirePermission('customers.edit'), async (req, res) => {
  const data = pick(req.body, FIELDS);
  if (!data.name || !data.phone) return res.status(400).json({ error: 'Name and phone are required' });
  res.status(201).json(await Customer.create(data));
});

router.put('/:id', requirePermission('customers.edit'), async (req, res) => {
  const c = await Customer.findByIdAndUpdate(req.params.id, pick(req.body, FIELDS), { returnDocument: 'after', runValidators: true });
  if (!c) return res.status(404).json({ error: 'Customer not found' });
  res.json(c);
});

// Admin only: removes the customer and their conversations, messages and tickets.
router.delete('/:id', requirePermission('customers.delete'), async (req, res) => {
  const c = await Customer.findById(req.params.id);
  if (!c) return res.status(404).json({ error: 'Customer not found' });
  const convIds = (await Conversation.find({ customer: c._id }).select('_id')).map((x) => x._id);
  await Promise.all([
    Message.deleteMany({ conversation: { $in: convIds } }),
    Conversation.deleteMany({ customer: c._id }),
    Ticket.deleteMany({ customer: c._id }),
  ]);
  await c.deleteOne();
  res.json({ ok: true });
});

module.exports = router;
