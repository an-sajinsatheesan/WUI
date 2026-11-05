import { Component, inject, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ApiService } from '../core/api.service';
import { errorMessage } from '../core/auth';
import { Customer } from '../core/models';

@Component({
  selector: 'app-customer-form',
  imports: [FormsModule, DialogModule, ButtonModule, InputTextModule, TextareaModule],
  template: `
    <p-dialog [header]="customer() ? 'Edit customer' : 'New customer'" [(visible)]="visible" [modal]="true" [draggable]="false" [style]="{ width: '30rem' }" [breakpoints]="{ '640px': '95vw' }" (onShow)="init()">
      <form class="space-y-4" (ngSubmit)="save()">
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-1.5">
            <label class="block text-xs font-medium text-slate-600" for="c-name">Name *</label>
            <input pInputText id="c-name" name="name" class="w-full" [(ngModel)]="form.name" required />
          </div>
          <div class="space-y-1.5">
            <label class="block text-xs font-medium text-slate-600" for="c-phone">WhatsApp phone *</label>
            <input pInputText id="c-phone" name="phone" class="w-full" placeholder="+9715…" [(ngModel)]="form.phone" required />
          </div>
          <div class="space-y-1.5">
            <label class="block text-xs font-medium text-slate-600" for="c-email">Email</label>
            <input pInputText id="c-email" name="email" type="email" class="w-full" [(ngModel)]="form.email" />
          </div>
          <div class="space-y-1.5">
            <label class="block text-xs font-medium text-slate-600" for="c-company">Company</label>
            <input pInputText id="c-company" name="company" class="w-full" [(ngModel)]="form.company" />
          </div>
        </div>
        <div class="space-y-1.5">
          <label class="block text-xs font-medium text-slate-600" for="c-notes">Notes</label>
          <textarea pTextarea id="c-notes" name="notes" rows="3" class="w-full" [(ngModel)]="form.notes"></textarea>
        </div>
        <button type="submit" class="hidden"></button>
      </form>
      <ng-template #footer>
        <p-button label="Cancel" severity="secondary" [text]="true" (onClick)="visible.set(false)" />
        <p-button label="Save" [loading]="saving()" (onClick)="save()" />
      </ng-template>
    </p-dialog>
  `,
})
export class CustomerForm {
  private api = inject(ApiService);
  private toast = inject(MessageService);
  visible = model(false);
  customer = input<Customer | null>(null);
  saved = output<Customer>();
  protected saving = signal(false);
  protected form: Partial<Customer> = {};

  init() {
    const c = this.customer();
    this.form = c
      ? { id: c.id, name: c.name, phone: c.phone, email: c.email, company: c.company, notes: c.notes }
      : { name: '', phone: '', email: '', company: '', notes: '' };
  }

  save() {
    if (!this.form.name?.trim() || !this.form.phone?.trim()) {
      this.toast.add({ severity: 'warn', summary: 'Name and phone are required' });
      return;
    }
    this.saving.set(true);
    this.api.saveCustomer(this.form).subscribe({
      next: (c) => {
        this.saving.set(false);
        this.toast.add({ severity: 'success', summary: 'Customer saved' });
        this.visible.set(false);
        this.saved.emit(c);
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.add({ severity: 'error', summary: 'Could not save', detail: errorMessage(e) });
      },
    });
  }
}
