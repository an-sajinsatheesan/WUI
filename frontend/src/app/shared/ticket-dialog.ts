import { Component, inject, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { ApiService } from '../core/api.service';
import { errorMessage } from '../core/auth';
import { Customer, TICKET_PRIORITIES, TICKET_STATUSES, Ticket, User } from '../core/models';

interface TicketForm {
  subject: string;
  description: string;
  status: string;
  priority: string;
  customer: string | null;
  assignedTo: string | null;
}

/** Create / edit ticket dialog, shared by the Tickets page, Inbox and Customer page. */
@Component({
  selector: 'app-ticket-dialog',
  imports: [FormsModule, DialogModule, ButtonModule, InputTextModule, SelectModule, TextareaModule],
  template: `
    <p-dialog
      [header]="ticket() ? 'Edit ticket #' + ticket()!.number : 'New ticket'"
      [(visible)]="visible"
      [modal]="true"
      [draggable]="false"
      [style]="{ width: '34rem' }"
      [breakpoints]="{ '640px': '95vw' }"
      (onShow)="init()"
    >
      <form id="ticketForm" class="space-y-4" (ngSubmit)="save()">
        <div class="space-y-1.5">
          <label class="block text-xs font-medium text-slate-600" for="t-subject">Subject *</label>
          <input pInputText id="t-subject" name="subject" class="w-full" [(ngModel)]="form.subject" required />
        </div>
        @if (!conversationId() && !ticket()) {
          <div class="space-y-1.5">
            <label class="block text-xs font-medium text-slate-600" for="t-customer">Customer *</label>
            <p-select
              inputId="t-customer"
              name="customer"
              [options]="customers()"
              optionLabel="name"
              optionValue="id"
              [(ngModel)]="form.customer"
              [filter]="true"
              filterBy="name,phone"
              placeholder="Select customer"
              appendTo="body"
              styleClass="w-full"
            />
          </div>
        }
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <label class="block text-xs font-medium text-slate-600" for="t-status">Status</label>
            <p-select inputId="t-status" name="status" [options]="statuses" optionLabel="label" optionValue="value" [(ngModel)]="form.status" appendTo="body" styleClass="w-full" />
          </div>
          <div class="space-y-1.5">
            <label class="block text-xs font-medium text-slate-600" for="t-priority">Priority</label>
            <p-select inputId="t-priority" name="priority" [options]="priorities" optionLabel="label" optionValue="value" [(ngModel)]="form.priority" appendTo="body" styleClass="w-full" />
          </div>
        </div>
        <div class="space-y-1.5">
          <label class="block text-xs font-medium text-slate-600" for="t-assignee">Assignee</label>
          <p-select
            inputId="t-assignee"
            name="assignedTo"
            [options]="users()"
            optionLabel="name"
            optionValue="id"
            [(ngModel)]="form.assignedTo"
            [showClear]="true"
            placeholder="Unassigned"
            appendTo="body"
            styleClass="w-full"
          />
        </div>
        <div class="space-y-1.5">
          <label class="block text-xs font-medium text-slate-600" for="t-desc">Description</label>
          <textarea pTextarea id="t-desc" name="description" rows="4" class="w-full" [(ngModel)]="form.description"></textarea>
        </div>
      </form>
      <ng-template #footer>
        <p-button label="Cancel" severity="secondary" [text]="true" (onClick)="visible.set(false)" />
        <p-button [label]="ticket() ? 'Save changes' : 'Create ticket'" [loading]="saving()" (onClick)="save()" />
      </ng-template>
    </p-dialog>
  `,
})
export class TicketDialog {
  private api = inject(ApiService);
  private toast = inject(MessageService);

  visible = model(false);
  ticket = input<Ticket | null>(null);
  conversationId = input<string | null>(null);
  customerId = input<string | null>(null);
  defaultSubject = input('');
  saved = output<Ticket>();

  protected statuses = TICKET_STATUSES;
  protected priorities = TICKET_PRIORITIES;
  protected users = signal<User[]>([]);
  protected customers = signal<Customer[]>([]);
  protected saving = signal(false);
  protected form: TicketForm = this.blank();

  private blank(): TicketForm {
    return { subject: '', description: '', status: 'open', priority: 'medium', customer: null, assignedTo: null };
  }

  init() {
    const t = this.ticket();
    this.form = t
      ? {
          subject: t.subject,
          description: t.description,
          status: t.status,
          priority: t.priority,
          customer: t.customer?.id ?? null,
          assignedTo: t.assignedTo?.id ?? null,
        }
      : { ...this.blank(), subject: this.defaultSubject(), customer: this.customerId() };
    this.api.users().subscribe((u) => this.users.set(u.filter((x) => x.active)));
    if (!this.conversationId() && !t) this.api.customers().subscribe((c) => this.customers.set(c));
  }

  save() {
    if (this.saving()) return;
    if (!this.form.subject.trim()) {
      this.toast.add({ severity: 'warn', summary: 'Subject is required' });
      return;
    }
    const t = this.ticket();
    const body: Record<string, unknown> = { ...this.form, assignedTo: this.form.assignedTo || null };
    if (!t && this.conversationId()) body['conversation'] = this.conversationId();
    if (!t && !body['conversation'] && !body['customer']) {
      this.toast.add({ severity: 'warn', summary: 'Select a customer' });
      return;
    }
    if (t) delete body['customer'];

    this.saving.set(true);
    const req = t ? this.api.updateTicket(t.id, body) : this.api.createTicket(body);
    req.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.toast.add({ severity: 'success', summary: t ? 'Ticket updated' : `Ticket #${res.number} created` });
        this.visible.set(false);
        this.saved.emit(res);
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.add({ severity: 'error', summary: 'Could not save ticket', detail: errorMessage(e) });
      },
    });
  }
}
