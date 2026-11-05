import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ApiService } from '../core/api.service';
import { AuthService, errorMessage } from '../core/auth';
import { User } from '../core/models';
import { SettingsStore } from '../core/settings.store';

@Component({
  selector: 'app-users',
  imports: [DatePipe, FormsModule, ButtonModule, DialogModule, InputTextModule, SelectModule, TableModule, TagModule, ToggleSwitchModule],
  template: `
    <div class="px-4 py-5 lg:px-8 lg:py-6">
      <div class="rounded-xl border border-slate-200 bg-white shadow-xs">
        <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
          <span class="text-sm text-slate-500">{{ users().length }} members · Admins have full access; agent permissions are set in Settings → Roles & permissions.</span>
          <div class="ml-auto"><p-button label="Add team member" icon="pi pi-plus" (onClick)="open(null)" /></div>
        </div>
        <p-table [value]="users()" [loading]="loading()" styleClass="text-sm" [tableStyle]="{ 'min-width': '40rem' }">
          <ng-template #header>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Department</th>
              <th>Status</th>
              <th>Last login</th>
              <th class="w-24"></th>
            </tr>
          </ng-template>
          <ng-template #body let-u>
            <tr>
              <td class="font-medium text-slate-800">
                {{ u.name }}
                @if (u.id === auth.user()?.id) {
                  <span class="ml-1 text-xs font-normal text-slate-400">(you)</span>
                }
              </td>
              <td class="text-slate-600">{{ u.email }}</td>
              <td><p-tag [value]="u.role" [severity]="u.role === 'admin' ? 'contrast' : 'secondary'" styleClass="capitalize" /></td>
              <td class="text-slate-600">{{ u.department || '—' }}</td>
              <td>
                <span class="inline-flex items-center gap-1.5 text-xs" [class]="u.active ? 'text-emerald-700' : 'text-slate-400'">
                  <span class="size-1.5 rounded-full" [class]="u.active ? 'bg-emerald-600' : 'bg-slate-300'"></span>
                  {{ u.active ? 'Active' : 'Disabled' }}
                </span>
              </td>
              <td class="text-slate-500">{{ u.lastLoginAt ? (u.lastLoginAt | date: 'MMM d, HH:mm') : 'Never' }}</td>
              <td class="text-right">
                <p-button icon="pi pi-pencil" [text]="true" severity="secondary" size="small" (onClick)="open(u)" ariaLabel="Edit" />
                @if (u.id !== auth.user()?.id) {
                  <p-button icon="pi pi-trash" [text]="true" severity="danger" size="small" (onClick)="remove(u)" ariaLabel="Delete" />
                }
              </td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    </div>

    <p-dialog [header]="form.id ? 'Edit team member' : 'Add team member'" [(visible)]="dialog" [modal]="true" [draggable]="false" [style]="{ width: '26rem' }" [breakpoints]="{ '640px': '95vw' }">
      <form class="space-y-4" (ngSubmit)="save()">
        <div class="space-y-1.5">
          <label class="block text-xs font-medium text-slate-600" for="u-name">Name *</label>
          <input pInputText id="u-name" name="name" class="w-full" [(ngModel)]="form.name" />
        </div>
        <div class="space-y-1.5">
          <label class="block text-xs font-medium text-slate-600" for="u-email">Email *</label>
          <input pInputText id="u-email" name="email" type="email" class="w-full" [(ngModel)]="form.email" />
        </div>
        <div class="space-y-1.5">
          <label class="block text-xs font-medium text-slate-600" for="u-pass">{{ form.id ? 'New password (leave blank to keep)' : 'Password *' }}</label>
          <input pInputText id="u-pass" name="password" type="password" class="w-full" autocomplete="new-password" [(ngModel)]="form.password" />
        </div>
        <div class="space-y-1.5">
          <label class="block text-xs font-medium text-slate-600" for="u-dept">Department</label>
          <p-select inputId="u-dept" name="department" [options]="departments()" [(ngModel)]="form.department" [showClear]="true" placeholder="None" appendTo="body" styleClass="w-full" />
        </div>
        <div class="grid grid-cols-2 items-end gap-3">
          <div class="space-y-1.5">
            <label class="block text-xs font-medium text-slate-600" for="u-role">Role</label>
            <p-select inputId="u-role" name="role" [options]="roles" optionLabel="label" optionValue="value" [(ngModel)]="form.role" appendTo="body" styleClass="w-full" />
          </div>
          <label class="flex items-center gap-2 pb-2 text-sm text-slate-700">
            <p-toggleswitch name="active" [(ngModel)]="form.active" /> Active
          </label>
        </div>
        <button type="submit" class="hidden"></button>
      </form>
      <ng-template #footer>
        <p-button label="Cancel" severity="secondary" [text]="true" (onClick)="dialog.set(false)" />
        <p-button label="Save" [loading]="saving()" (onClick)="save()" />
      </ng-template>
    </p-dialog>
  `,
})
export class UsersPage {
  private api = inject(ApiService);
  private toast = inject(MessageService);
  private confirm = inject(ConfirmationService);
  protected auth = inject(AuthService);
  private store = inject(SettingsStore);
  protected departments = computed(() => this.store.settings()?.departments ?? []);

  protected users = signal<User[]>([]);
  protected loading = signal(true);
  protected dialog = signal(false);
  protected saving = signal(false);
  protected roles = [
    { label: 'Agent', value: 'agent' },
    { label: 'Admin', value: 'admin' },
  ];
  protected form: Partial<User> & { password?: string } = {};

  constructor() {
    this.load();
  }

  load() {
    this.api.users().subscribe({
      next: (u) => {
        this.users.set(u);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  open(u: User | null) {
    this.form = u ? { id: u.id, name: u.name, email: u.email, role: u.role, department: u.department || '', active: u.active, password: '' } : { name: '', email: '', role: 'agent', department: '', active: true, password: '' };
    this.dialog.set(true);
  }

  save() {
    const body = { ...this.form };
    if (!body.password) delete body.password;
    this.saving.set(true);
    this.api.saveUser(body).subscribe({
      next: () => {
        this.saving.set(false);
        this.dialog.set(false);
        this.toast.add({ severity: 'success', summary: 'User saved' });
        this.load();
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.add({ severity: 'error', summary: 'Could not save user', detail: errorMessage(e) });
      },
    });
  }

  remove(u: User) {
    this.confirm.confirm({
      header: 'Delete user',
      message: `Delete ${u.name}? Their tickets and conversations become unassigned.`,
      acceptButtonProps: { label: 'Delete', severity: 'danger' },
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', text: true },
      accept: () =>
        this.api.deleteUser(u.id).subscribe({
          next: () => {
            this.toast.add({ severity: 'success', summary: 'User deleted' });
            this.load();
          },
          error: (e) => this.toast.add({ severity: 'error', summary: 'Delete failed', detail: errorMessage(e) }),
        }),
    });
  }
}
