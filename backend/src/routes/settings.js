const router = require('express').Router();
const { requireAdmin } = require('../middleware/auth');
const { PERMISSIONS, getSettings, agentPermissionMap, permissionsFor } = require('../permissions');

function view(settings) {
  return {
    companyName: settings.companyName,
    logoUrl: settings.logoUrl,
    departments: settings.departments,
    permissions: PERMISSIONS.map(({ key, label, description }) => ({ key, label, description })),
    agentPermissions: agentPermissionMap(settings),
  };
}

// Everyone signed in: company name/logo, departments, and their own permissions.
router.get('/', async (req, res) => {
  const s = await getSettings();
  res.json({ ...view(s), myPermissions: await permissionsFor(req.user) });
});

// Admin only.
router.put('/', requireAdmin, async (req, res) => {
  const s = await getSettings();
  const b = req.body || {};
  if (typeof b.companyName === 'string') {
    if (!b.companyName.trim()) return res.status(400).json({ error: 'Company name is required' });
    s.companyName = b.companyName.trim().slice(0, 80);
  }
  if (typeof b.logoUrl === 'string') {
    const url = b.logoUrl.trim();
    if (url && !/^https:\/\//i.test(url)) return res.status(400).json({ error: 'Logo URL must start with https://' });
    s.logoUrl = url;
  }
  if (Array.isArray(b.departments)) {
    s.departments = [...new Set(b.departments.map((d) => String(d).trim()).filter(Boolean))].slice(0, 50);
  }
  if (b.agentPermissions && typeof b.agentPermissions === 'object') {
    const next = agentPermissionMap(s);
    for (const p of PERMISSIONS) if (typeof b.agentPermissions[p.key] === 'boolean') next[p.key] = b.agentPermissions[p.key];
    s.agentPermissions = next;
    s.markModified('agentPermissions');
  }
  await s.save();
  res.json({ ...view(s), myPermissions: await permissionsFor(req.user) });
});

module.exports = router;
