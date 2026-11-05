const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { requireAuth, signToken } = require('../middleware/auth');
const { permissionsFor } = require('../permissions');

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  const user = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (!user || !user.active || !(await bcrypt.compare(String(password), user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  user.lastLoginAt = new Date();
  await user.save();
  res.json({ token: signToken(user), user: { ...user.toJSON(), permissions: await permissionsFor(user) } });
});

router.get('/me', requireAuth, async (req, res) => res.json({ ...req.user.toJSON(), permissions: await permissionsFor(req.user) }));

module.exports = router;
