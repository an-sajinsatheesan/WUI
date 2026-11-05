const router = require('express').Router();
const { Account, Conversation, Ticket } = require('../models');

router.get('/', async (_req, res) => {
  const [conversations, unreadAgg, openTickets, inProgressTickets, resolvedTickets, closedTickets, accounts, perAccount, recentTickets] =
    await Promise.all([
      Conversation.countDocuments(),
      Conversation.aggregate([{ $group: { _id: null, total: { $sum: '$unreadCount' }, conversations: { $sum: { $cond: [{ $gt: ['$unreadCount', 0] }, 1, 0] } } } }]),
      Ticket.countDocuments({ status: 'open' }),
      Ticket.countDocuments({ status: { $in: ['in_progress', 'pending'] } }),
      Ticket.countDocuments({ status: 'resolved' }),
      Ticket.countDocuments({ status: 'closed' }),
      Account.find().sort({ name: 1 }),
      Conversation.aggregate([
        { $group: { _id: '$account', conversations: { $sum: 1 }, unread: { $sum: '$unreadCount' }, open: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } } } },
      ]),
      Ticket.find().sort({ updatedAt: -1 }).limit(6).populate('customer', 'name phone').populate('assignedTo', 'name'),
    ]);

  const byId = Object.fromEntries(perAccount.map((a) => [String(a._id), a]));
  res.json({
    totals: {
      conversations,
      unreadMessages: unreadAgg[0]?.total || 0,
      unreadConversations: unreadAgg[0]?.conversations || 0,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      closedTickets,
    },
    accounts: accounts.map((a) => ({
      ...a.toJSON(),
      conversations: byId[a.id]?.conversations || 0,
      unread: byId[a.id]?.unread || 0,
      openConversations: byId[a.id]?.open || 0,
    })),
    recentTickets,
  });
});

module.exports = router;
