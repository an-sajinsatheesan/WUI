const { Settings } = require('./models');

/**
 * Permissions an Admin can switch on/off for the Agent role (Settings → Roles & permissions).
 * Admins always have every permission. Managing users, WhatsApp accounts, provider
 * credentials and settings is always Admin-only and not configurable.
 */
const PERMISSIONS = [
  { key: 'conversations.assign', label: 'Assign conversations', description: 'Assign or unassign conversations to any team member', agentDefault: true },
  { key: 'conversations.close', label: 'Close and reopen conversations', description: 'Change a conversation between open and closed', agentDefault: true },
  { key: 'tickets.assign', label: 'Assign tickets to others', description: 'Agents can always assign tickets to themselves', agentDefault: true },
  { key: 'tickets.delete', label: 'Delete tickets', description: 'Permanently delete tickets', agentDefault: false },
  { key: 'customers.edit', label: 'Create and edit customers', description: 'Add customers and change their details', agentDefault: true },
  { key: 'customers.delete', label: 'Delete customers', description: 'Delete a customer with their conversations and tickets', agentDefault: false },
  { key: 'simulate.messages', label: 'Use message simulator', description: 'Generate simulated incoming WhatsApp messages', agentDefault: true },
];

const KEYS = PERMISSIONS.map((p) => p.key);

async function getSettings() {
  let s = await Settings.findById('app');
  if (!s) s = await Settings.create({ _id: 'app' });
  return s;
}

function agentPermissionMap(settings) {
  const saved = settings?.agentPermissions || {};
  return Object.fromEntries(PERMISSIONS.map((p) => [p.key, typeof saved[p.key] === 'boolean' ? saved[p.key] : p.agentDefault]));
}

/** List of permission keys the user has. */
async function permissionsFor(user) {
  if (!user) return [];
  if (user.role === 'admin') return [...KEYS];
  const map = agentPermissionMap(await getSettings());
  return KEYS.filter((k) => map[k]);
}

async function can(user, key) {
  return (await permissionsFor(user)).includes(key);
}

function requirePermission(key) {
  return async (req, res, next) => {
    try {
      if (await can(req.user, key)) return next();
      res.status(403).json({ error: 'You do not have permission to do this' });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { PERMISSIONS, KEYS, getSettings, agentPermissionMap, permissionsFor, can, requirePermission };
