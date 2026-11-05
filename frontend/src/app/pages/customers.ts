import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth';
import { Customer } from '../core/models';
import { CustomerForm } from './customer-form';

@Component({
  selector: 'app-customers',
  imports: [DatePipe, FormsModule, ButtonModule, InputTextModule, TableModule, CustomerForm],
  template: `
    <div class="px-4 py-5 lg:px-8 lg:py-6">
      <div class="rounded-xl border border-slate-200 bg-white shadow-xs">
        <div class="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3">
          <span class="relative">
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400"></i>
            <input pInputText class="w-64 !pl-8" placeholder="Search name, phone, email" [(ngModel)]="search" (ngModelChange)="debounced()" />
          </span>
          <span class="text-xs text-slate-500">{{ customers().length }} customers</span>
          @if (auth.can('customers.edit')) {
            <div class="ml-auto"><p-button label="New customer" icon="pi pi-plus" (onClick)="dialog.set(true)" /></div>
          }
        </div>
        <p-table [value]="customers()" [loading]="loading()" [paginator]="customers().length > 20" [rows]="20" styleClass="text-sm" [tableStyle]="{ 'min-width': '48rem' }">
          <ng-template #header>
            <tr>
              <th pSortableColumn="name">Name <p-sortIcon field="name" /></th>
              <th>Phone</th>
              <th>Email</th>
              <th>Company</th>
              <th class="text-right">Conversations</th>
              <th class="text-right">Open tickets</th>
              <th pSortableColumn="lastMessageAt">Last message <p-sortIcon field="lastMessageAt" /></th>
            </tr>
          </ng-template>
          <ng-template #body let-c>
            <tr class="cursor-pointer" (click)="go(c)">
              <td class="font-medium text-slate-800">{{ c.name }}</td>
              <td class="tabular-nums text-slate-600">{{ c.phone }}</td>
              <td class="text-slate-600">{{ c.email || '—' }}</td>
              <td class="text-slate-600">{{ c.company || '—' }}</td>
              <td class="text-right tabular-nums">{{ c.conversations }}</td>
              <td class="text-right tabular-nums" [class.font-semibold]="c.openTickets">{{ c.openTickets }}</td>
              <td class="text-slate-500">{{ c.lastMessageAt ? (c.lastMessageAt | date: 'MMM d, HH:mm') : '—' }}</td>
            </tr>
          </ng-template>
          <ng-template #emptymessage>
            <tr><td colspan="7" class="p-8 text-center text-slate-500">No customers found.</td></tr>
          </ng-template>
        </p-table>
      </div>
    </div>
    <app-customer-form [(visible)]="dialog" (saved)="load()" />
  `,
})
export class CustomersPage {
  private api = inject(ApiService);
  private router = inject(Router);
  protected auth = inject(AuthService);
  protected customers = signal<Customer[]>([]);
  protected loading = signal(true);
  protected dialog = signal(false);
  protected search = '';
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api.customers(this.search).subscribe({
      next: (c) => {
        this.customers.set(c);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  debounced() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.load(), 300);
  }

  go(c: Customer) {
    this.router.navigate(['/customers', c.id]);
  }
}
