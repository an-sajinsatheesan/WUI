import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ApiService } from '../core/api.service';
import { AuthService, errorMessage } from '../core/auth';
import { Account, TICKET_PRIORITIES, TICKET_STATUSES, Ticket, User, prioritySeverity, statusLabel, statusSeverity } from '../core/models';
import { TicketDialog } from '../shared/ticket-dialog';

@Component({
  selector: 'app-tickets',
  imports: [DatePipe, FormsModule, RouterLink, ButtonModule, InputTextModule, SelectModule, TableModule, TagModule, TooltipModule, TicketDialog],
  template: `
    <div class="px-4 py-5 lg:px-8 lg:py-6">
      <div class="rounded-xl border border-slate-200 bg-white shadow-xs">
        <!-- Toolbar -->
        <div class="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3">
          <span class="relative">
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400"></i>
            <input pInputText class="w-56 !pl-8" placeholder="Search subject or #" [(ngModel)]="f.search" (ngModelChange)="debounced()" />
          </span>
          <p-select [options]="statusOptions" optionLabel="label" optionValue="value" [(ngModel)]="f.status" (onChange)="load()" placeholder="Status" [showClear]="true" styleClass="w-40" />
          <p-select [options]="priorities" optionLabel="label" optionValue="value" [(ngModel)]="f.priority" (onChange)="load()" placeholder="Priority" [showClear]="true" styleClass="w-36" />
          <p-select [options]="assigneeOptions()" optionLabel="label" optionValue="value" [(ngModel)]="f.assignedTo" (onChange)="load()" placeholder="Assignee" [showClear]="true" styleClass="w-44" />
          <p-select [options]="accounts()" optionLabel="name" optionValue="id" [(ngModel)]="f.accountId" (onChange)="load()" placeholder="WhatsApp number" [showClear]="true" styleClass="w-44" />
          <div class="ml-auto">
            <p-button label="New ticket" icon="pi pi-plus" (onClick)="open(null)" />
          </div>
        </div>

        <p-table [value]="tickets()" [loading]="loading()" [paginator]="tickets().length > 15" [rows]="15" dataKey="id" styleClass="text-sm" [tableStyle]="{ 'min-width': '60rem' }">
          <ng-template #header>
            <tr>
              <th class="w-20" pSortableColumn="number"># <p-sortIcon field="number" /></th>
              <th>Subject</th>
              <th>Customer</th>
              <th>Number</th>
              <th pSortableColumn="status">Status <p-sortIcon field="status" /></th>
              <th pSortableColumn="priority">Priority <p-sortIcon field="priority" /></th>
              <th>Assignee</th>
              <th pSortableColumn="updatedAt">Updated <p-sortIcon field="updatedAt" /></th>
              <th class="w-32"></th>
            </tr>
          </ng-template>
          <ng-template #body let-t>
            <tr>
              <td class="text-slate-500">{{ t.number }}</td>
              <td>
                <button class="text-left font-medium text-slate-800 hover:text-emerald-700" (click)="open(t)">{{ t.subject }}</button>
              </td>
              <td>
                <a [routerLink]="['/customers', t.customer?.id]" class="whitespace-nowrap hover:text-emerald-700">{{ t.customer?.name }}</a>
              </td>
              <td>
                @if (t.account) {
                  <span class="inline-flex items-center gap-1.5 text-slate-600">
                    <span class="size-2 rounded-full" [style.background]="t.account.color"></span>{{ t.account.name }}
                  </span>
                } @else {
                  <span class="text-slate-400">—</span>
                }
              </td>
              <td><p-tag [value]="statusLabel(t.status)" [severity]="statusSeverity(t.status)" /></td>
              <td><p-tag [value]="t.priority" [severity]="prioritySeverity(t.priority)" styleClass="capitalize" /></td>
              <td class="text-slate-600">{{ t.assignedTo?.name || 'Unassigned' }}</td>
              <td class="whitespace-nowrap text-slate-500">{{ t.updatedAt | date: 'MMM d, HH:mm' }}</td>
              <td class="text-right">
                @if (t.conversation) {
                  <p-button icon="pi pi-comments" [text]="true" severity="secondary" size="small" pTooltip="Open conversation" [routerLink]="['/inbox', t.conversation]" />
                }
                @if (t.status !== 'closed') {
                  <p-button icon="pi pi-check" [text]="true" severity="secondary" size="small" pTooltip="Close ticket" (onClick)="close(t)" />
                }
                @if (auth.can('tickets.delete')) {
                  <p-button icon="pi pi-trash" [text]="true" severity="danger" size="small" pTooltip="Delete" (onClick)="remove(t)" />
                }
              </td>
            </tr>
          </ng-template>
          <ng-template #emptymessage>
            <tr><td colspan="9" class="p-8 text-center text-slate-500">No tickets match these filters.</td></tr>
          </ng-template>
        </p-table>
      </div>
    </div>

    <app-ticket-dialog [(visible)]="dialog" [ticket]="editing()" (saved)="load()" />
  `,
})
export class TicketsPage {
  private api = inject(ApiService);
  private toast = inject(MessageService);
  private confirm = inject(ConfirmationService);
  protected auth = inject(AuthService);

  protected tickets = signal<Ticket[]>([]);
  protected accounts = signal<Account[]>([]);
  protected assigneeOptions = signal<{ label: string; value: string }[]>([]);
  protected loading = signal(true);
  protected dialog = signal(false);
  protected editing = signal<Ticket | null>(null);

  protected statusOptions = [{ label: 'Active (not closed)', value: 'open,in_progress,pending,resolved' }, ...TICKET_STATUSES];
  protected priorities = TICKET_PRIORITIES;
  protected f = { search: '', status: null as string | null, priority: null as string | null, assignedTo: null as string | null, accountId: null as string | null };

  protected statusLabel = statusLabel;
  protected statusSeverity = statusSeverity;
  protected prioritySeverity = prioritySeverity;
  private timer: ReturnType<typeof setTimeout> | undefined;

  /** ?q= from global search / notifications prefills the search box. */
  q = input<string | undefined>();

  constructor() {
    effect(() => {
      const q = this.q();
      untracked(() => {
        this.f.search = q ?? this.f.search;
        this.load();
      });
    });
    this.api.accounts().subscribe((a) => this.accounts.set(a));
    this.api.users().subscribe((u: User[]) =>
      this.assigneeOptions.set([
        { label: 'Assigned to me', value: 'me' },
        { label: 'Unassigned', value: 'unassigned' },
        ...u.map((x) => ({ label: x.name, value: x.id })),
      ])
    );
  }

  load() {
    this.loading.set(true);
    this.api.tickets(this.f).subscribe({
      next: (t) => {
        this.tickets.set(t);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  debounced() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.load(), 300);
  }

  open(t: Ticket | null) {
    this.editing.set(t);
    this.dialog.set(true);
  }

  close(t: Ticket) {
    this.api.updateTicket(t.id, { status: 'closed' }).subscribe({
      next: () => {
        this.toast.add({ severity: 'success', summary: `Ticket #${t.number} closed` });
        this.load();
      },
      error: (e) => this.toast.add({ severity: 'error', summary: 'Could not close ticket', detail: errorMessage(e) }),
    });
  }

  remove(t: Ticket) {
    this.confirm.confirm({
      header: 'Delete ticket',
      message: `Delete ticket #${t.number} "${t.subject}"? This cannot be undone.`,
      acceptButtonProps: { label: 'Delete', severity: 'danger' },
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', text: true },
      accept: () =>
        this.api.deleteTicket(t.id).subscribe({
          next: () => {
            this.toast.add({ severity: 'success', summary: 'Ticket deleted' });
            this.load();
          },
          error: (e) => this.toast.add({ severity: 'error', summary: 'Delete failed', detail: errorMessage(e) }),
        }),
    });
  }
}
