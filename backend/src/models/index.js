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
      active: { type: Boolean, default: true },
    },
    opts
  )
);

// A WhatsApp Business number the company owns.
const Account = model(
  'Account',
  new Schema(
    {
      name: { type: String, required: true, trim: true },
      phoneNumber: { type: String, required: true, unique: true, trim: true },
      color: { type: String, default: '#16a34a' },
      provider: { type: String, default: 'mock' },
      // Placeholder for a real provider's phone-number id (e.g. Meta Cloud API).
      providerPhoneId: { type: String, default: '' },
    },
    opts
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
  const c = await Counter.findByIdAndUpdate(name, { $inc: { seq: 1 } }, { new: true, upsert: true });
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
  nextSeq,
  TICKET_STATUSES,
  TICKET_PRIORITIES,
};
