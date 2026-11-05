export type Role = 'admin' | 'agent';
export type TicketStatus = 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt?: string;
}

export interface Account {
  id: string;
  name: string;
  phoneNumber: string;
  color: string;
  provider?: string;
  unread?: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  company?: string;
  notes?: string;
  conversations?: number;
  openTickets?: number;
  lastMessageAt?: string | null;
  createdAt?: string;
}

export interface Message {
  id: string;
  conversation: string;
  direction: 'inbound' | 'outbound';
  text: string;
  status: 'received' | 'sent' | 'delivered' | 'read' | 'failed';
  sentBy?: { id: string; name: string } | null;
  createdAt: string;
}

export interface Conversation {
  id: string;
  account: Account;
  customer: Customer;
  status: 'open' | 'closed';
  assignedTo: Pick<User, 'id' | 'name' | 'role'> | null;
  unreadCount: number;
  lastMessage: string;
  lastMessageAt: string;
  messages?: Message[];
}

export interface Ticket {
  id: string;
  number: number;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  customer: Pick<Customer, 'id' | 'name' | 'phone'>;
  conversation: string | null;
  account: Pick<Account, 'id' | 'name' | 'phoneNumber' | 'color'> | null;
  assignedTo: Pick<User, 'id' | 'name' | 'role'> | null;
  createdBy: Pick<User, 'id' | 'name'> | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerDetail extends Omit<Customer, 'conversations'> {
  conversations: (Conversation & { messages: Message[] })[];
  tickets: Ticket[];
}

export interface Dashboard {
  totals: {
    conversations: number;
    unreadMessages: number;
    unreadConversations: number;
    openTickets: number;
    inProgressTickets: number;
    resolvedTickets: number;
    closedTickets: number;
  };
  accounts: (Account & { conversations: number; unread: number; openConversations: number })[];
  recentTickets: Ticket[];
}

export const TICKET_STATUSES: { label: string; value: TicketStatus }[] = [
  { label: 'Open', value: 'open' },
  { label: 'In progress', value: 'in_progress' },
  { label: 'Pending', value: 'pending' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Closed', value: 'closed' },
];

export const TICKET_PRIORITIES: { label: string; value: TicketPriority }[] = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
  { label: 'Urgent', value: 'urgent' },
];

type Severity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

export function statusSeverity(s: TicketStatus): Severity {
  return ({ open: 'info', in_progress: 'warn', pending: 'secondary', resolved: 'success', closed: 'contrast' } as const)[s];
}
export function prioritySeverity(p: TicketPriority): Severity {
  return ({ low: 'secondary', medium: 'info', high: 'warn', urgent: 'danger' } as const)[p];
}
export function statusLabel(s: string): string {
  return TICKET_STATUSES.find((x) => x.value === s)?.label ?? s;
}
