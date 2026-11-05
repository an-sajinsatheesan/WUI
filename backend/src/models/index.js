const mongoose = require('mongoose');
const { Schema, model } = mongoose;
const { ObjectId } = Schema.Types;

const opts = {
  timestamps: true,
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret) => {
      delete ret._id;
      delete ret.passwordHash;
      return ret;
    },
  },
};

const User = model(
  'User',
  new Schema(
    {
      name: { type: String, required: true, trim: true },
      email: { type: String, required: true, unique: true, lowercase: true, trim: true },
      passwordHash: { type: String, required: true },
      role: { type: String, enum: ['admin', 'agent'], default: 'agent' },
      department: { type: String, default: '' },
      active: { type: Boolean, default: true },
      lastLoginAt: { type: Date, default: null },
    },
    opts
  )
);

const PROVIDERS = ['mock', 'meta', '360dialog', 'wati', 'twilio'];
const CONNECTION_STATUSES = ['simulated', 'not_configured', 'connected', 'error'];

// A WhatsApp Business number the company owns, and how it connects to a provider.
const Account = model(
  'Account',
  new Schema(
    {
      name: { type: String, required: true, trim: true },
      phoneNumber: { type: String, required: true, unique: true, trim: true },
      color: { type: String, default: '#16a34a' },
      department: { type: String, default: '' },
      active: { type: Boolean, default: true },
      provider: { type: String, enum: PROVIDERS, default: 'mock' },
      // Non-secret provider settings (API URL, phone number id, account SID ...).
      providerConfig: { type: Schema.Types.Mixed, default: {} },
      // Secret provider settings, AES-256-GCM encrypted. Never sent to the browser.
      providerSecrets: { type: Schema.Types.Mixed, default: {}, select: false },
      connectionStatus: { type: String, enum: CONNECTION_STATUSES, default: 'simulated' },
      statusMessage: { type: String, default: '' },
      lastCheckedAt: { type: Date, default: null },
    },
    {
      ...opts,
      minimize: false,
      toJSON: {
        ...opts.toJSON,
        transform: (_doc, ret) => {
          delete ret._id;
          // Only report which secrets are saved, never their values.
          const secrets = ret.providerSecrets || {};
          ret.secretsSet = Object.fromEntries(Object.keys(secrets).filter((k) => secrets[k]).map((k) => [k, true]));
          delete ret.providerSecrets;
          return ret;
        },
      },
    }
  )
);

// Single app-wide settings document (_id: 'app').
const Settings = model(
  'Settings',
  new Schema(
    {
      _id: { type: String, default: 'app' },
      companyName: { type: String, default: 'Unified Inbox' },
      logoUrl: { type: String, default: '' },
      departments: { type: [String], default: ['Sales', 'Support', 'Billing', 'Deliveries'] },
      // Permission key -> allowed, for the Agent role. Admins always have every permission.
      agentPermissions: { type: Schema.Types.Mixed, default: {} },
    },
    { timestamps: true, minimize: false, toJSON: { versionKey: false } }
  )
);

const Customer = model(
  'Customer',
  new Schema(
    {
      name: { type: String, required: true, trim: true },
      phone: { type: String, required: true, unique: true, trim: true },
      email: { type: String, trim: true, default: '' },
      company: { type: String, trim: true, default: '' },
      notes: { type: String, default: '' },
    },
    opts
  )
);

// One thread per (business account, customer).
const conversationSchema = new Schema(
  {
    account: { type: ObjectId, ref: 'Account', required: true },
    customer: { type: ObjectId, ref: 'Customer', required: true },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    assignedTo: { type: ObjectId, ref: 'User', default: null },
    unreadCount: { type: Number, default: 0 },
    lastMessage: { type: String, default: '' },
    lastMessageAt: { type: Date, default: Date.now },
  },
  opts
);
conversationSchema.index({ account: 1, customer: 1 }, { unique: true });
conversationSchema.index({ lastMessageAt: -1 });
const Conversation = model('Conversation', conversationSchema);

const messageSchema = new Schema(
  {
    conversation: { type: ObjectId, ref: 'Conversation', required: true },
    direction: { type: String, enum: ['inbound', 'outbound'], required: true },
    text: { type: String, required: true },
    status: { type: String, enum: ['received', 'sent', 'delivered', 'read', 'failed'], default: 'sent' },
    sentBy: { type: ObjectId, ref: 'User', default: null },
    providerMessageId: { type: String, default: '' },
  },
  opts
);
messageSchema.index({ conversation: 1, createdAt: 1 });
const Message = model('Message', messageSchema);

const TICKET_STATUSES = ['open', 'in_progress', 'pending', 'resolved', 'closed'];
const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const Ticket = model(
  'Ticket',
  new Schema(
    {
      number: { type: Number, unique: true },
      subject: { type: String, required: true, trim: true },
      description: { type: String, default: '' },
      status: { type: String, enum: TICKET_STATUSES, default: 'open' },
      priority: { type: String, enum: TICKET_PRIORITIES, default: 'medium' },
      customer: { type: ObjectId, ref: 'Customer', required: true },
      conversation: { type: ObjectId, ref: 'Conversation', default: null },
      account: { type: ObjectId, ref: 'Account', default: null },
      assignedTo: { type: ObjectId, ref: 'User', default: null },
      createdBy: { type: ObjectId, ref: 'User', default: null },
      closedAt: { type: Date, default: null },
    },
    opts
  )
);

// Simple atomic counter for human-friendly ticket numbers.
const Counter = model('Counter', new Schema({ _id: String, seq: { type: Number, default: 0 } }));

async function nextSeq(name) {
  const c = await Counter.findByIdAndUpdate(name, { $inc: { seq: 1 } }, { returnDocument: 'after', upsert: true });
  return c.seq;
}

module.exports = {
  User,
  Account,
  Customer,
  Conversation,
  Message,
  Ticket,
  Counter,
  Settings,
  nextSeq,
  PROVIDERS,
  CONNECTION_STATUSES,
  TICKET_STATUSES,
  TICKET_PRIORITIES,
};
