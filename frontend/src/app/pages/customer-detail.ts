import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../core/api.service';
import { AuthService, errorMessage } from '../core/auth';
import { CustomerDetail, Ticket, statusLabel, statusSeverity } from '../core/models';
import { TicketDialog } from '../shared/ticket-dialog';
import { CustomerForm } from './customer-form';

@Component({
  selector: 'app-customer-detail',
  imports: [DatePipe, RouterLink, ButtonModule, TagModule, TicketDialog, CustomerForm],
  template: `
    <div class="mx-auto max-w-7xl p-4 lg:p-6">
      <a routerLink="/customers" class="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800">
        <i class="pi pi-arrow-left text-[10px]"></i> Customers
      </a>
      @if (c(); as c) {
        <div class="grid gap-6 lg:grid-cols-3">
          <!-- Profile + tickets -->
          <div class="space-y-6">
            <section class="rounded-lg border border-slate-200 bg-white">
              <header class="flex items-center gap-3 border-b border-slate-200 p-4">
                <span class="flex size-10 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700">{{ initials() }}</span>
                <div class="min-w-0 flex-1">
                  <div class="truncate font-semibold text-slate-900">{{ c.name }}</div>
                  <div class="text-xs text-slate-500">Customer since {{ c.createdAt | date: 'MMM y' }}</div>
                </div>
                <p-button icon="pi pi-pencil" [text]="true" severity="secondary" (onClick)="editOpen.set(true)" ariaLabel="Edit" />
                @if (auth.isAdmin()) {
                  <p-button icon="pi pi-trash" [text]="true" severity="danger" (onClick)="remove()" ariaLabel="Delete" />
                }
              </header>
              <dl class="grid grid-cols-[6rem_1fr] gap-y-2 p-4">
                <dt class="text-xs text-slate-500">Phone</dt><dd class="text-slate-800">{{ c.phone }}</dd>
                <dt class="text-xs text-slate-500">Email</dt><dd class="break-all text-slate-800">{{ c.email || '—' }}</dd>
                <dt class="text-xs text-slate-500">Company</dt><dd class="text-slate-800">{{ c.company || '—' }}</dd>
                <dt class="text-xs text-slate-500">Notes</dt><dd class="whitespace-pre-wrap text-slate-800">{{ c.notes || '—' }}</dd>
              </dl>
            </section>

            <section class="rounded-lg border border-slate-200 bg-white">
              <header class="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <span class="font-medium text-slate-900">Tickets</span>
                <p-button label="New" icon="pi pi-plus" size="small" [text]="true" (onClick)="openTicket(null)" />
              </header>
              <ul>
                @for (t of c.tickets; track t.id) {
                  <li class="border-b border-slate-100 last:border-0">
                    <button class="w-full px-4 py-3 text-left hover:bg-slate-50" (click)="openTicket(t)">
                      <div class="flex gap-2">
                        <span class="flex-1 font-medium text-slate-800">{{ t.subject }}</span>
                        <span class="text-xs text-slate-400">#{{ t.number }}</span>
                      </div>
                      <div class="mt-1.5 flex items-center gap-2 text-xs text-slate-500">
                        <p-tag [value]="statusLabel(t.status)" [severity]="statusSeverity(t.status)" styleClass="!text-[11px]" />
                        <span class="capitalize">{{ t.priority }}</span>
                        <span class="ml-auto">{{ t.assignedTo?.name || 'Unassigned' }}</span>
                      </div>
                    </button>
                  </li>
                } @empty {
                  <li class="p-4 text-xs text-slate-500">No tickets yet.</li>
                }
              </ul>
            </section>
          </div>

          <!-- Conversation history -->
          <section class="rounded-lg border border-slate-200 bg-white lg:col-span-2">
            <header class="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3">
              <span class="mr-2 font-medium text-slate-900">Conversation history</span>
              @for (conv of c.conversations; track conv.id) {
                <button
                  class="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs"
                  [class]="conv.id === selectedConv()?.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'"
                  (click)="selected.set(conv.id)"
                >
                  <span class="size-1.5 rounded-full" [style.background]="conv.account.color"></span>
                  {{ conv.account.name }} <span class="opacity-60">({{ conv.messages.length }})</span>
                </button>
              }
            </header>
            @if (selectedConv(); as conv) {
              <div class="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
                <span>Via {{ conv.account.name }} {{ conv.account.phoneNumber }} · {{ conv.status }}</span>
                <a [routerLink]="['/inbox', conv.id]" class="font-medium text-emerald-700 hover:underline">Open in inbox</a>
              </div>
              <div class="max-h-[60vh] space-y-2 overflow-y-auto bg-slate-50 p-4">
                @for (m of conv.messages; track m.id) {
                  <div class="flex" [class.justify-end]="m.direction === 'outbound'">
                    <div class="max-w-[75%] rounded-lg border px-3 py-2" [class]="m.direction === 'outbound' ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'">
                      <div class="whitespace-pre-wrap text-slate-800">{{ m.text }}</div>
                      <div class="mt-1 text-right text-[11px] text-slate-400">
                        @if (m.sentBy) {
                          {{ m.sentBy.name }} ·
                        }
                        {{ m.createdAt | date: 'MMM d, HH:mm' }}
                      </div>
                    </div>
                  </div>
                }
              </div>
            } @else {
              <div class="p-8 text-center text-slate-500">No conversations with this customer yet.</div>
            }
          </section>
        </div>

        <app-ticket-dialog [(visible)]="ticketOpen" [ticket]="editing()" [customerId]="c.id" (saved)="load()" />
        <app-customer-form [(visible)]="editOpen" [customer]="$any(c)" (saved)="load()" />
      } @else {
        <div class="p-10 text-center text-slate-500">Loading…</div>
      }
    </div>
  `,
})
export class CustomerDetailPage {
  private api = inject(ApiService);
  private router = inject(Router);
  private toast = inject(MessageService);
  private confirm = inject(ConfirmationService);
  protected auth = inject(AuthService);

  id = input.required<string>();
  protected c = signal<CustomerDetail | null>(null);
  protected selected = signal<string | null>(null);
  protected selectedConv = computed(() => {
    const c = this.c();
    if (!c) return null;
    return c.conversations.find((x) => x.id === this.selected()) ?? c.conversations[0] ?? null;
  });
  protected initials = computed(() =>
    (this.c()?.name || '')
      .split(' ')
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  );
  protected ticketOpen = signal(false);
  protected editOpen = signal(false);
  protected editing = signal<Ticket | null>(null);
  protected statusLabel = statusLabel;
  protected statusSeverity = statusSeverity;

  constructor() {
    effect(() => {
      this.id();
      untracked(() => this.load());
    });
  }

  load() {
    this.api.customer(this.id()).subscribe({
      next: (c) => this.c.set(c),
      error: (e) => {
        this.toast.add({ severity: 'error', summary: 'Customer not found', detail: errorMessage(e) });
        this.router.navigate(['/customers']);
      },
    });
  }

  openTicket(t: Ticket | null) {
    this.editing.set(t);
    this.ticketOpen.set(true);
  }

  remove() {
    const c = this.c();
    if (!c) return;
    this.confirm.confirm({
      header: 'Delete customer',
      message: `Delete ${c.name} together with their conversations, messages and tickets?`,
      acceptButtonProps: { label: 'Delete', severity: 'danger' },
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', text: true },
      accept: () =>
        this.api.deleteCustomer(c.id).subscribe({
          next: () => {
            this.toast.add({ severity: 'success', summary: 'Customer deleted' });
            this.router.navigate(['/customers']);
          },
          error: (e) => this.toast.add({ severity: 'error', summary: 'Delete failed', detail: errorMessage(e) }),
        }),
    });
  }
}
