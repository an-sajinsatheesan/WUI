/**
 * Seeds demo data into the dedicated `whatsapp_mvp` database.
 *
 *   npm run seed              -> wipes ONLY this app's collections in whatsapp_mvp and re-seeds
 *   npm run seed -- --if-empty -> seeds only when there are no users yet
 *
 * Safety: refuses to run against any database other than `whatsapp_mvp`,
 * and never drops databases. Other databases in your cluster are untouched.
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('./config');
const { connectDB } = require('./db');
const { User, Account, Customer, Conversation, Message, Ticket, Counter } = require('./models');

const SAFE_DB = 'whatsapp_mvp';

const minutesAgo = (m) => new Date(Date.now() - m * 60 * 1000);

const ACCOUNTS = [
  { name: 'Sales', phoneNumber: '+97145550101', color: '#16a34a' },
  { name: 'Support', phoneNumber: '+97145550102', color: '#2563eb' },
  { name: 'Billing', phoneNumber: '+97145550103', color: '#d97706' },
  { name: 'Deliveries', phoneNumber: '+97145550104', color: '#7c3aed' },
];

const CUSTOMERS = [
  { name: 'Aisha Rahman', phone: '+971501110001', email: 'aisha.rahman@example.com', company: 'Rahman Trading' },
  { name: 'Omar Haddad', phone: '+971501110002', email: 'omar.h@example.com', company: '' },
  { name: 'Priya Nair', phone: '+971501110003', email: 'priya.nair@example.com', company: 'Nair Interiors' },
  { name: 'Daniel Brooks', phone: '+971501110004', email: 'dbrooks@example.com', company: 'Brooks Logistics' },
  { name: 'Fatima Al Zaabi', phone: '+971501110005', email: 'fatima.z@example.com', company: '' },
  { name: 'Lucas Martin', phone: '+971501110006', email: 'lucas.martin@example.com', company: 'Martin & Co' },
  { name: 'Sara Kim', phone: '+971501110007', email: 'sara.kim@example.com', company: '' },
  { name: 'Hassan Ali', phone: '+971501110008', email: 'hassan.ali@example.com', company: 'Ali Electronics' },
  { name: 'Elena Petrova', phone: '+971501110009', email: 'elena.p@example.com', company: '' },
  { name: 'Ravi Kumar', phone: '+971501110010', email: 'ravi.kumar@example.com', company: 'Kumar Foods' },
];

// [accountIdx, customerIdx, status, unread, messages: [direction, text, minutesAgo]]
const THREADS = [
  [0, 0, 'open', 2, [['in', 'Hi, I saw your offer on the office chairs. Is it still valid?', 300], ['out', 'Hello Aisha, yes, the offer runs until Sunday.', 290], ['in', 'Great. Can I get 12 units delivered to Business Bay?', 25], ['in', 'Also need an invoice in the company name.', 24]]],
  [0, 3, 'open', 0, [['in', 'Do you offer bulk pricing for 50+ units?', 1500], ['out', 'Hi Daniel, yes. 10% off above 50 units. Shall I prepare a quote?', 1490], ['in', 'Please do, thanks.', 1480], ['out', 'Quote sent to dbrooks@example.com.', 1400]]],
  [0, 5, 'open', 1, [['in', 'Hello, what colours are available for the standing desk?', 45]]],
  [0, 9, 'closed', 0, [['in', 'Can I visit the showroom on Saturday?', 4000], ['out', 'Sure Ravi, we are open 10am to 8pm.', 3990], ['in', 'Perfect, see you then.', 3980]]],
  [1, 1, 'open', 3, [['in', 'My laptop stand arrived with a broken hinge.', 90], ['in', 'Order number is #48213.', 89], ['in', 'Can you send a replacement?', 60]]],
  [1, 2, 'open', 0, [['in', 'The assembly instructions are missing from the box.', 600], ['out', 'Sorry about that Priya. I will email you the PDF now.', 590], ['in', 'Received, thank you!', 580]]],
  [1, 4, 'open', 1, [['in', 'How do I reset the smart lamp?', 15]]],
  [1, 7, 'open', 0, [['in', 'The warranty card has a different serial number.', 2000], ['out', 'Thanks Hassan, could you share a photo of both serial numbers?', 1990]]],
  [1, 0, 'open', 0, [['in', 'Quick question about the chair warranty period.', 2500], ['out', 'All chairs carry a 2-year warranty.', 2490]]],
  [2, 6, 'open', 2, [['in', 'I was charged twice for my last order.', 120], ['in', 'Please refund the duplicate payment.', 118]]],
  [2, 8, 'open', 0, [['in', 'Can I pay by bank transfer?', 900], ['out', 'Yes Elena, I will share our bank details.', 880]]],
  [2, 3, 'closed', 0, [['in', 'Need a VAT invoice for order #47110.', 5000], ['out', 'Sent to your email. Anything else?', 4950], ['in', 'All good, thanks.', 4940]]],
  [3, 1, 'open', 1, [['in', 'Where is my delivery? Tracking has not updated since yesterday.', 35]]],
  [3, 5, 'open', 0, [['in', 'Can the driver call before arriving?', 700], ['out', 'Done, a note has been added for the driver.', 690]]],
  [3, 9, 'open', 1, [['in', 'Please deliver after 5pm tomorrow.', 8]]],
];

// [subject, description, status, priority, threadIdx, assigneeIdx(null=unassigned)]
const TICKETS = [
  ['Bulk order: 12 office chairs', 'Customer wants 12 chairs delivered to Business Bay with company invoice.', 'open', 'high', 0, 1],
  ['Replacement for broken laptop stand', 'Order #48213 arrived with broken hinge. Send replacement.', 'in_progress', 'high', 4, 1],
  ['Duplicate payment refund', 'Customer charged twice on last order.', 'open', 'urgent', 9, null],
  ['Missing assembly instructions', 'Emailed PDF manual.', 'resolved', 'low', 5, 2],
  ['Serial number mismatch on warranty card', 'Waiting for customer photos.', 'pending', 'medium', 7, 2],
  ['Delayed delivery - tracking not updating', 'Check with courier.', 'open', 'medium', 12, null],
  ['Bulk pricing quote for 50+ units', 'Quote sent.', 'resolved', 'medium', 1, 1],
  ['VAT invoice for order #47110', 'Invoice issued.', 'closed', 'low', 11, 2],
  ['Smart lamp reset help', '', 'open', 'low', 6, null],
];

async function seed() {
  if (config.mongoDb !== SAFE_DB && process.env.ALLOW_SEED_ANY_DB !== 'true') {
    throw new Error(`Refusing to seed database "${config.mongoDb}". Expected "${SAFE_DB}".`);
  }
  await connectDB();
  const dbName = mongoose.connection.db.databaseName;
  if (dbName !== config.mongoDb) throw new Error(`Connected to unexpected database "${dbName}"`);

  if (process.argv.includes('--if-empty') && (await User.estimatedDocumentCount()) > 0) {
    console.log(`Database "${dbName}" already has data; skipping seed.`);
    return;
  }

  console.log(`Seeding database "${dbName}" ...`);
  // Clear only this app's own collections.
  await Promise.all([User, Account, Customer, Conversation, Message, Ticket, Counter].map((M) => M.deleteMany({})));

  const [adminHash, agentHash] = await Promise.all([bcrypt.hash('Admin@123', 10), bcrypt.hash('Agent@123', 10)]);
  const users = await User.insertMany([
    { name: 'Admin User', email: 'admin@demo.com', passwordHash: adminHash, role: 'admin' },
    { name: 'Sam Agent', email: 'agent1@demo.com', passwordHash: agentHash, role: 'agent' },
    { name: 'Nora Agent', email: 'agent2@demo.com', passwordHash: agentHash, role: 'agent' },
  ]);
  const accounts = await Account.insertMany(ACCOUNTS);
  const customers = await Customer.insertMany(CUSTOMERS);

  const conversations = [];
  for (const [ai, ci, status, unread, msgs] of THREADS) {
    const last = msgs[msgs.length - 1];
    const conv = await Conversation.create({
      account: accounts[ai]._id,
      customer: customers[ci]._id,
      status,
      unreadCount: unread,
      assignedTo: ai === 1 ? users[1]._id : ai === 2 ? users[2]._id : null,
      lastMessage: last[1],
      lastMessageAt: minutesAgo(last[2]),
    });
    conversations.push(conv);
    await Message.insertMany(
      msgs.map(([dir, text, ago], i) => ({
        conversation: conv._id,
        direction: dir === 'in' ? 'inbound' : 'outbound',
        text,
        status: dir === 'in' ? (i >= msgs.length - unread ? 'received' : 'read') : 'read',
        sentBy: dir === 'out' ? conv.assignedTo || users[0]._id : null,
        providerMessageId: `seed.${conv._id}.${i}`,
        createdAt: minutesAgo(ago),
        updatedAt: minutesAgo(ago),
      }))
    );
  }

  let n = 1000;
  for (const [subject, description, status, priority, ti, ui] of TICKETS) {
    const conv = conversations[ti];
    await Ticket.create({
      number: ++n,
      subject,
      description,
      status,
      priority,
      conversation: conv._id,
      customer: conv.customer,
      account: conv.account,
      assignedTo: ui === null ? null : users[ui]._id,
      createdBy: users[0]._id,
      closedAt: ['resolved', 'closed'].includes(status) ? new Date() : null,
    });
  }
  await Counter.create({ _id: 'ticket', seq: n });

  console.log(`Seeded ${users.length} users, ${accounts.length} accounts, ${customers.length} customers, ${conversations.length} conversations, ${TICKETS.length} tickets.`);
  console.log('Logins: admin@demo.com / Admin@123   agent1@demo.com / Agent@123   agent2@demo.com / Agent@123');
}

if (require.main === module) {
  seed()
    .then(() => mongoose.disconnect())
    .catch(async (err) => {
      console.error('Seed failed:', err.message);
      await mongoose.disconnect();
      process.exit(1);
    });
}

module.exports = { seed };
