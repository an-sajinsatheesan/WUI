const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { User, Ticket, Conversation } = require('../models');
const { requireAdmin } = require('../middleware/auth');
const { pick } = require('../utils');

// Any signed-in user can list users (needed for assignment dropdowns).
router.get('/', async (_req, res) => {
  res.json(await User.find().sort({ role: 1, name: 1 }));
});

router.post('/', requireAdmin, async (req, res) => {
  const data = pick(req.body, ['name', 'email', 'role', 'active']);
  const { password } = req.body || {};
  if (!data.name || !data.email) return res.status(400).json({ error: 'Name and email are required' });
  if (!password || String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (await User.exists({ email: String(data.email).toLowerCase().trim() })) {
    return res.status(409).json({ error: 'Email already in use' });
  }
  const user = await User.create({ ...data, passwordHash: await bcrypt.hash(String(password), 10) });
  res.status(201).json(user);
});

router.put('/:id', requireAdmin, async (req, res) => {
  const data = pick(req.body, ['name', 'email', 'role', 'active']);
  if (req.body?.password) {
    if (String(req.body.password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    data.passwordHash = await bcrypt.hash(String(req.body.password), 10);
  }
  // Prevent an admin from locking themselves out.
  if (req.params.id === req.user.id && (data.role === 'agent' || data.active === false)) {
    return res.status(400).json({ error: 'You cannot demote or deactivate yourself' });
  }
  const user = await User.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

router.delete('/:id', requireAdmin, async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'You cannot delete yourself' });
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  await Promise.all([
    Ticket.updateMany({ assignedTo: user._id }, { assignedTo: null }),
    Conversation.updateMany({ assignedTo: user._id }, { assignedTo: null }),
  ]);
  res.json({ ok: true });
});

module.exports = router;
