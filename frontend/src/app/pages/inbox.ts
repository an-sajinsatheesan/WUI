import { Component, DestroyRef, ElementRef, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';
import { ApiService } from '../core/api.service';
import { errorMessage } from '../core/auth';
import { Account, Conversation, Ticket, User, statusLabel, statusSeverity } from '../core/models';
import { TicketDialog } from '../shared/ticket-dialog';

type View = 'all' | 'unread' | 'open' | 'closed';

@Component({
  selector: 'app-inbox',
  imports: [DatePipe, FormsModule, RouterLink, ButtonModule, InputTextModule, SelectModule, TagModule, TextareaModule, TooltipModule, TicketDialog],
  template: `
    <div class="flex h-full min-h-0 bg-white">
      <!-- Column 1: filters + conversation list -->
      <section class="flex w-full min-w-0 flex-col border-r border-slate-200 md:w-80 md:shrink-0" [class.max-md:hidden]="!!id()">
        <div class="space-y-2 border-b border-slate-200 p-3">
          <div class="flex gap-2">
            <p-select
              class="min-w-0 flex-1"
              styleClass="w-full"
              [options]="accountOptions()"
              optionLabel="label"
              optionValue="value"
              [ngModel]="accountId()"
              (ngModelChange)="setAccount($event)"
              placeholder="All numbers"
            >
              <ng-template #item let-o>
                <div class="flex w-full items-center gap-2">
                  <span class="size-2 rounded-full" [style.background]="o.color || '#94a3b8'"></span>
                  <span class="flex-1">{{ o.label }}</span>
                  @if (o.unread) {
                    <span class="text-xs font-semibold text-emerald-700">{{ o.unread }}</span>
                  }
                </div>
              </ng-template>
            </p-select>
            <p-button icon="pi pi-bolt" severity="secondary" [outlined]="true" pTooltip="Simulate an incoming message" tooltipPosition="bottom" (onClick)="simulate()" ariaLabel="Simulate incoming" />
          </div>
          <span class="relative block">
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400"></i>
            <input pInputText class="w-full !pl-8" placeholder="Search name, phone or text" [ngModel]="search()" (ngModelChange)="onSearch($event)" />
          </span>
          <div class="flex gap-1 text-xs">
            @for (v of views; track v.value) {
              <button
                class="rounded-md px-2.5 py-1 font-medium"
                [class]="view() === v.value ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'"
                (click)="setView(v.value)"
              >
                {{ v.label }}
              </button>
            }
          </div>
        </div>
        <ul class="min-h-0 flex-1 overflow-y-auto">
          @for (c of conversations(); track c.id) {
            <li>
              <a
                [routerLink]="['/inbox', c.id]"
                queryParamsHandling="preserve"
                class="flex gap-3 border-b border-slate-100 px-3 py-3 hover:bg-slate-50"
                [class.bg-emerald-50]="c.id === id()"
              >
                <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">{{ initials(c.customer.name) }}</span>
                <span class="min-w-0 flex-1">
                  <span class="flex items-baseline gap-2">
                    <span class="flex-1 truncate text-slate-900" [class.font-semibold]="c.unreadCount">{{ c.customer.name }}</span>
                    <span class="shrink-0 text-[11px] text-slate-400">{{ shortTime(c.lastMessageAt) }}</span>
                  </span>
                  <span class="flex items-center gap-2">
                    <span class="flex-1 truncate text-xs" [class]="c.unreadCount ? 'text-slate-800' : 'text-slate-500'">{{ c.lastMessage }}</span>
                    @if (c.unreadCount) {
                      <span class="rounded-full bg-emerald-600 px-1.5 text-[11px] font-medium leading-4 text-white">{{ c.unreadCount }}</span>
                    }
                  </span>
                  <span class="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                    <span class="size-1.5 rounded-full" [style.background]="c.account.color"></span>
                    {{ c.account.name }}
                    @if (c.status === 'closed') {
                      <span class="text-slate-400">· closed</span>
                    }
                  </span>
                </span>
              </a>
            </li>
          } @empty {
            <li class="p-6 text-center text-slate-500">{{ loadingList() ? 'Loading…' : 'No conversations' }}</li>
          }
        </ul>
      </section>

      <!-- Column 2: thread -->
      <section class="flex min-w-0 flex-1 flex-col bg-slate-50" [class.max-md:hidden]="!id()">
        @if (active(); as c) {
          <header class="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
            <a routerLink="/inbox" queryParamsHandling="preserve" class="text-slate-500 md:hidden" aria-label="Back"><i class="pi pi-arrow-left"></i></a>
            <div class="min-w-0 flex-1">
              <div class="truncate font-semibold text-slate-900">{{ c.customer.name }}</div>
              <div class="flex items-center gap-1.5 text-xs text-slate-500">
                {{ c.customer.phone }}
                <span class="text-slate-300">→</span>
                <span class="size-1.5 rounded-full" [style.background]="c.account.color"></span>
                {{ c.account.name }} {{ c.account.phoneNumber }}
              </div>
            </div>
            <p-button icon="pi pi-bolt" label="Simulate reply" size="small" severity="secondary" [text]="true" (onClick)="simulate(c.id)" styleClass="max-sm:!hidden" />
            <p-button
              size="small"
              [label]="c.status === 'open' ? 'Close' : 'Reopen'"
              [icon]="c.status === 'open' ? 'pi pi-check' : 'pi pi-replay'"
              severity="secondary"
              [outlined]="true"
              (onClick)="toggleStatus(c)"
            />
          </header>

          <div #scroller class="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4 lg:px-8">
            @for (m of c.messages; track m.id; let i = $index) {
              @if (i === 0 || day(m.createdAt) !== day(c.messages![i - 1].createdAt)) {
                <div class="py-2 text-center text-[11px] font-medium text-slate-400">{{ m.createdAt | date: 'EEEE, MMM d' }}</div>
              }
              <div class="flex" [class.justify-end]="m.direction === 'outbound'">
                <div
                  class="max-w-[75%] rounded-lg border px-3 py-2"
                  [class]="m.direction === 'outbound' ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'"
                >
                  <div class="whitespace-pre-wrap break-words text-slate-800">{{ m.text }}</div>
                  <div class="mt-1 flex items-center justify-end gap-1 text-[11px] text-slate-400">
                    @if (m.direction === 'outbound' && m.sentBy) {
                      <span>{{ m.sentBy.name }} ·</span>
                    }
                    {{ m.createdAt | date: 'HH:mm' }}
                    @if (m.direction === 'outbound') {
                      <i class="pi text-[10px]" [class]="m.status === 'failed' ? 'pi-exclamation-circle text-red-500' : m.status === 'read' ? 'pi-check-circle text-emerald-600' : 'pi-check'"></i>
                    }
                  </div>
                </div>
              </div>
            }
          </div>

          <form class="flex items-end gap-2 border-t border-slate-200 bg-white p-3" (ngSubmit)="send()">
            <textarea
              pTextarea
              name="reply"
              rows="1"
              [autoResize]="true"
              class="max-h-40 min-w-0 flex-1"
              placeholder="Type a reply…"
              title="Enter to send, Shift+Enter for a new line"
              [(ngModel)]="draft"
              (keydown.enter)="onEnter($event)"
            ></textarea>
            <p-button type="submit" icon="pi pi-send" [loading]="sending()" [disabled]="!draft.trim()" ariaLabel="Send" />
          </form>
        } @else {
          <div class="flex flex-1 flex-col items-center justify-center gap-2 text-slate-400">
            <i class="pi pi-comments text-3xl"></i>
            <span>Select a conversation</span>
          </div>
        }
      </section>

      <!-- Column 3: customer + tickets -->
      @if (active(); as c) {
        <aside class="hidden w-80 shrink-0 overflow-y-auto border-l border-slate-200 bg-white xl:block">
          <div class="border-b border-slate-200 p-4">
            <div class="mb-3 flex items-center justify-between">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer</h3>
              <a [routerLink]="['/customers', c.customer.id]" class="text-xs font-medium text-emerald-700 hover:underline">Profile</a>
            </div>
            <dl class="space-y-2">
              <div><dt class="text-xs text-slate-500">Name</dt><dd class="text-slate-800">{{ c.customer.name }}</dd></div>
              <div><dt class="text-xs text-slate-500">Phone</dt><dd class="text-slate-800">{{ c.customer.phone }}</dd></div>
              <div><dt class="text-xs text-slate-500">Email</dt><dd class="break-all text-slate-800">{{ c.customer.email || '—' }}</dd></div>
              <div><dt class="text-xs text-slate-500">Company</dt><dd class="text-slate-800">{{ c.customer.company || '—' }}</dd></div>
            </dl>
          </div>
          <div class="space-y-3 border-b border-slate-200 p-4">
            <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Conversation</h3>
            <div class="space-y-1.5">
              <label class="block text-xs text-slate-500" for="assignee">Assigned to</label>
              <p-select
                inputId="assignee"
                styleClass="w-full"
                [options]="users()"
                optionLabel="name"
                optionValue="id"
                [ngModel]="c.assignedTo?.id ?? null"
                (ngModelChange)="assign(c, $event)"
                [showClear]="true"
                placeholder="Unassigned"
              />
            </div>
            <div class="flex items-center justify-between text-xs">
              <span class="text-slate-500">Status</span>
              <span class="font-medium capitalize" [class]="c.status === 'open' ? 'text-emerald-700' : 'text-slate-500'">{{ c.status }}</span>
            </div>
          </div>
          <div class="p-4">
            <div class="mb-3 flex items-center justify-between">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Tickets</h3>
              <p-button label="New" icon="pi pi-plus" size="small" [text]="true" (onClick)="openTicket(null)" />
            </div>
            <ul class="space-y-2">
              @for (t of tickets(); track t.id) {
                <li>
                  <button class="w-full rounded-md border border-slate-200 p-2.5 text-left hover:border-slate-300 hover:bg-slate-50" (click)="openTicket(t)">
                    <div class="flex items-start gap-2">
                      <span class="flex-1 font-medium text-slate-800">{{ t.subject }}</span>
                      <span class="text-xs text-slate-400">#{{ t.number }}</span>
                    </div>
                    <div class="mt-1.5 flex items-center gap-2">
                      <p-tag [value]="statusLabel(t.status)" [severity]="statusSeverity(t.status)" styleClass="!text-[11px]" />
                      <span class="text-xs capitalize text-slate-500">{{ t.priority }}</span>
                      <span class="ml-auto truncate text-xs text-slate-500">{{ t.assignedTo?.name || 'Unassigned' }}</span>
                    </div>
                  </button>
                </li>
              } @empty {
                <li class="text-xs text-slate-500">No tickets for this conversation.</li>
              }
            </ul>
          </div>
        </aside>

        <app-ticket-dialog
          [(visible)]="ticketDialog"
          [ticket]="editing()"
          [conversationId]="c.id"
          [defaultSubject]="c.lastMessage.slice(0, 80)"
          (saved)="loadTickets(c.id)"
        />
      }
    </div>
  `,
})
export class InboxPage {
  private api = inject(ApiService);
  private toast = inject(MessageService);
  private router = inject(Router);

  /** Route param /inbox/:id and query param ?account= (bound via withComponentInputBinding). */
  id = input<string | undefined>();
  account = input<string | undefined>();

  protected views: { label: string; value: View }[] = [
    { label: 'All', value: 'all' },
    { label: 'Unread', value: 'unread' },
    { label: 'Open', value: 'open' },
    { label: 'Closed', value: 'closed' },
  ];

  protected accounts = signal<Account[]>([]);
  protected users = signal<User[]>([]);
  protected conversations = signal<Conversation[]>([]);
  protected active = signal<Conversation | null>(null);
  protected tickets = signal<Ticket[]>([]);
  protected loadingList = signal(true);
  protected sending = signal(false);
  protected view = signal<View>('all');
  protected search = signal('');
  protected accountId = computed(() => this.account() ?? null);
  protected ticketDialog = signal(false);
  protected editing = signal<Ticket | null>(null);
  protected draft = '';

  protected accountOptions = computed(() => [
    { label: 'All numbers', value: null, color: null, unread: this.accounts().reduce((s, a) => s + (a.unread || 0), 0) },
    ...this.accounts().map((a) => ({ label: `${a.name} · ${a.phoneNumber}`, value: a.id, color: a.color, unread: a.unread })),
  ]);

  protected statusLabel = statusLabel;
  protected statusSeverity = statusSeverity;

  private scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  private lastCount = 0;

  constructor() {
    this.api.users().subscribe((u) => this.users.set(u.filter((x) => x.active)));

    // Reload list whenever the account filter (query param) changes.
    effect(() => {
      this.accountId();
      untracked(() => this.loadList());
    });

    // Open conversation from the route.
    effect(() => {
      const id = this.id();
      untracked(() => {
        this.lastCount = 0;
        if (id) this.openConversation(id);
        else {
          this.active.set(null);
          this.tickets.set([]);
        }
      });
    });

    // Light polling to pick up simulated / webhook messages. Serverless friendly (no websockets).
    interval(8000)
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => {
        this.loadList(true);
        const id = this.id();
        if (id) this.openConversation(id, true);
      });
  }

  loadList(silent = false) {
    if (!silent) this.loadingList.set(true);
    const v = this.view();
    this.api
      .conversations({
        accountId: this.accountId(),
        search: this.search(),
        unread: v === 'unread' ? true : null,
        status: v === 'open' || v === 'closed' ? v : null,
      })
      .subscribe({
        next: (list) => {
          this.conversations.set(list);
          this.loadingList.set(false);
        },
        error: () => this.loadingList.set(false),
      });
    this.api.accounts().subscribe((a) => this.accounts.set(a));
  }

  openConversation(id: string, silent = false) {
    this.api.conversation(id).subscribe({
      next: (c) => {
        this.active.set(c);
        if (c.unreadCount > 0) {
          this.api.markRead(c.id).subscribe(() => {
            this.conversations.update((list) => list.map((x) => (x.id === c.id ? { ...x, unreadCount: 0 } : x)));
            this.accounts.update((list) => list.map((a) => (a.id === c.account.id ? { ...a, unread: Math.max(0, (a.unread || 0) - c.unreadCount) } : a)));
          });
        }
        this.scrollToBottom();
        if (!silent) this.loadTickets(id);
      },
      error: (e) => {
        if (!silent) this.toast.add({ severity: 'error', summary: 'Conversation not found', detail: errorMessage(e) });
      },
    });
  }

  loadTickets(conversationId: string) {
    this.api.tickets({ conversationId }).subscribe((t) => this.tickets.set(t));
  }

  setAccount(value: string | null) {
    this.router.navigate([], { queryParams: { account: value || null }, queryParamsHandling: 'merge' });
  }

  setView(v: View) {
    this.view.set(v);
    this.loadList();
  }

  onSearch(value: string) {
    this.search.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.loadList(), 300);
  }

  onEnter(e: Event) {
    const ke = e as KeyboardEvent;
    if (!ke.shiftKey) {
      e.preventDefault();
      this.send();
    }
  }

  send() {
    const c = this.active();
    const text = this.draft.trim();
    if (!c || !text || this.sending()) return;
    this.sending.set(true);
    this.api.sendMessage(c.id, text).subscribe({
      next: (m) => {
        this.draft = '';
        this.sending.set(false);
        this.active.set({ ...c, status: 'open', lastMessage: text, messages: [...(c.messages || []), m] });
        this.conversations.update((list) =>
          [{ ...(list.find((x) => x.id === c.id) || c), lastMessage: text, lastMessageAt: m.createdAt, status: 'open' as const }, ...list.filter((x) => x.id !== c.id)]
        );
        this.scrollToBottom();
      },
      error: (e) => {
        this.sending.set(false);
        this.toast.add({ severity: 'error', summary: 'Message not sent', detail: errorMessage(e) });
      },
    });
  }

  simulate(conversationId?: string) {
    const body = conversationId ? { conversationId } : { accountId: this.accountId() || undefined };
    this.api.simulateIncoming(body).subscribe({
      next: () => {
        this.toast.add({ severity: 'info', summary: 'Incoming message simulated', life: 2000 });
        this.loadList(true);
        if (this.id()) this.openConversation(this.id()!, true);
      },
      error: (e) => this.toast.add({ severity: 'error', summary: 'Simulation failed', detail: errorMessage(e) }),
    });
  }

  toggleStatus(c: Conversation) {
    const status = c.status === 'open' ? 'closed' : 'open';
    this.api.updateConversation(c.id, { status }).subscribe((u) => {
      this.active.set({ ...c, status: u.status });
      this.conversations.update((list) => list.map((x) => (x.id === c.id ? { ...x, status: u.status } : x)));
    });
  }

  assign(c: Conversation, userId: string | null) {
    this.api.updateConversation(c.id, { assignedTo: userId }).subscribe((u) => {
      this.active.set({ ...c, assignedTo: u.assignedTo });
      this.toast.add({ severity: 'success', summary: u.assignedTo ? `Assigned to ${u.assignedTo.name}` : 'Unassigned', life: 2000 });
    });
  }

  openTicket(t: Ticket | null) {
    this.editing.set(t);
    this.ticketDialog.set(true);
  }

  private scrollToBottom() {
    const count = this.active()?.messages?.length ?? 0;
    if (count === this.lastCount) return;
    this.lastCount = count;
    setTimeout(() => {
      const el = this.scroller()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  protected initials(name: string) {
    return name
      .split(' ')
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  protected day(d: string) {
    return new Date(d).toDateString();
  }

  protected shortTime(d: string) {
    const date = new Date(d);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const diff = (now.getTime() - date.getTime()) / 86400000;
    if (diff < 6) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}
