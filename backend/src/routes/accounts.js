const router = require('express').Router();
const { Account, Conversation } = require('../models');
const { requireAdmin } = require('../middleware/auth');
const { pick } = require('../utils');

const FIELDS = ['name', 'phoneNumber', 'color'];

router.get('/', async (_req, res) => {
  const [accounts, unread] = await Promise.all([
    Account.find().sort({ name: 1 }),
    Conversation.aggregate([{ $group: { _id: '$account', unread: { $sum: '$unreadCount' } } }]),
  ]);
  const map = Object.fromEntries(unread.map((u) => [String(u._id), u.unread]));
  res.json(accounts.map((a) => ({ ...a.toJSON(), unread: map[a.id] || 0 })));
});

router.post('/', requireAdmin, async (req, res) => {
  res.status(201).json(await Account.create(pick(req.body, FIELDS)));
});

router.put('/:id', requireAdmin, async (req, res) => {
  const a = await Account.findByIdAndUpdate(req.params.id, pick(req.body, FIELDS), { new: true, runValidators: true });
  if (!a) return res.status(404).json({ error: 'Account not found' });
  res.json(a);
});

module.exports = router;
