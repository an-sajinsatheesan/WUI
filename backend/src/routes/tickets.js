const router = require('express').Router();
const mongoose = require('mongoose');
const { Ticket, Customer, Conversation, User, nextSeq, TICKET_STATUSES, TICKET_PRIORITIES } = require('../models');
const { requirePermission, can } = require('../permissions');
const { pick, escapeRegex } = require('../utils');

const FIELDS = ['subject', 'description', 'status', 'priority', 'customer', 'conversation', 'assignedTo'];

const populateTicket = (q) =>
  q
    .populate('customer', 'name phone')
    .populate('account', 'name phoneNumber color')
    .populate('assignedTo', 'name role')
    .populate('createdBy', 'name');

async function normalize(body, isCreate, user, current) {
  const data = pick(body, FIELDS);
  // Assigning to someone else needs tickets.assign; assigning to yourself is always allowed.
  if (data.assignedTo !== undefined) {
    const target = data.assignedTo ? String(data.assignedTo) : null;
    const unchanged = current && String(current.assignedTo || '') === String(target || '');
    if (!unchanged && target && target !== user.id && !(await can(user, 'tickets.assign'))) {
      throw Object.assign(new Error('You do not have permission to assign tickets to others'), { status: 403 });
    }
  }
  for (const k of ['conversation', 'assignedTo']) if (data[k] === '') data[k] = null;
  if (data.status && !TICKET_STATUSES.includes(data.status)) throw badRequest('Invalid status');
  if (data.priority && !TICKET_PRIORITIES.includes(data.priority)) throw badRequest('Invalid priority');
  if (isCreate && !data.customer && !data.conversation) throw badRequest('Customer or conversation is required');
  if (data.assignedTo && !(await User.exists({ _id: data.assignedTo }))) throw badRequest('Assignee not found');

  if (data.conversation) {
    const conv = await Conversation.findById(data.conversation);
    if (!conv) throw badRequest('Conversation not found');
    data.customer = conv.customer;
    data.account = conv.account;
  } else if (data.customer && !(await Customer.exists({ _id: data.customer }))) {
    throw badRequest('Customer not found');
  }
  if (data.status) data.closedAt = ['resolved', 'closed'].includes(data.status) ? new Date() : null;
  return data;
}

function badRequest(msg) {
  return Object.assign(new Error(msg), { status: 400 });
}

// GET /api/tickets?status=&priority=&assignedTo=&accountId=&customerId=&conversationId=&search=
router.get('/', async (req, res) => {
  const q = req.query;
  const filter = {};
  if (q.status) filter.status = { $in: String(q.status).split(',') };
  if (q.priority) filter.priority = q.priority;
  if (q.assignedTo === 'unassigned') filter.assignedTo = null;
  else if (q.assignedTo === 'me') filter.assignedTo = req.user._id;
  else if (mongoose.isValidObjectId(q.assignedTo)) filter.assignedTo = q.assignedTo;
  if (mongoose.isValidObjectId(q.accountId)) filter.account = q.accountId;
  if (mongoose.isValidObjectId(q.customerId)) filter.customer = q.customerId;
  if (mongoose.isValidObjectId(q.conversationId)) filter.conversation = q.conversationId;
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), 'i');
    const or = [{ subject: rx }];
    if (/^\d+$/.test(q.search)) or.push({ number: Number(q.search) });
    filter.$or = or;
  }
  res.json(await populateTicket(Ticket.find(filter).sort({ updatedAt: -1 }).limit(500)));
});

router.get('/:id', async (req, res) => {
  const t = await populateTicket(Ticket.findById(req.params.id));
  if (!t) return res.status(404).json({ error: 'Ticket not found' });
  res.json(t);
});

router.post('/', async (req, res) => {
  const data = await normalize(req.body, true, req.user, null);
  if (!data.subject) return res.status(400).json({ error: 'Subject is required' });
  const t = await Ticket.create({ ...data, number: await nextSeq('ticket'), createdBy: req.user._id });
  res.status(201).json(await populateTicket(Ticket.findById(t._id)));
});

router.put('/:id', async (req, res) => {
  const current = await Ticket.findById(req.params.id);
  if (!current) return res.status(404).json({ error: 'Ticket not found' });
  const data = await normalize(req.body, false, req.user, current);
  const t = await populateTicket(Ticket.findByIdAndUpdate(req.params.id, data, { returnDocument: 'after', runValidators: true }));
  if (!t) return res.status(404).json({ error: 'Ticket not found' });
  res.json(t);
});

router.delete('/:id', requirePermission('tickets.delete'), async (req, res) => {
  const t = await Ticket.findByIdAndDelete(req.params.id);
  if (!t) return res.status(404).json({ error: 'Ticket not found' });
  res.json({ ok: true });
});

module.exports = router;
