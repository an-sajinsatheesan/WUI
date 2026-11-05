import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
import { environment } from '../../environments/environment';
import { ApiService } from '../core/api.service';
import { errorMessage } from '../core/auth';
import { Account, CONNECTION_LABELS, ConnectionStatus, ProviderInfo, ProviderName } from '../core/models';
import { SettingsStore } from '../core/settings.store';

interface AccountForm {
  id: string | null;
  name: string;
  phoneNumber: string;
  color: string;
  department: string;
  active: boolean;
  provider: ProviderName;
  config: Record<string, string>;
  secrets: Record<string, string>;
  secretsSet: Record<string, boolean>;
  originalProvider: ProviderName | null;
}

const COLORS = ['#16a34a', '#2563eb', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#dc2626', '#475569'];

@Component({
  selector: 'app-accounts',
  imports: [DatePipe, FormsModule, RouterLink, ButtonModule, DialogModule, InputTextModule, SelectModule, TableModule, ToggleSwitchModule, TooltipModule],
  template: `
    <div class="px-4 py-5 lg:px-8 lg:py-6">
      <div class="rounded-xl border border-slate-200 bg-white shadow-xs">
        <div class="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
          <span class="text-sm text-slate-500">{{ accounts().length }} numbers · {{ activeCount() }} active</span>
          <div class="ml-auto"><p-button label="Add WhatsApp account" icon="pi pi-plus" (onClick)="open(null)" /></div>
        </div>

        <p-table [value]="accounts()" [loading]="loading()" styleClass="text-sm" [tableStyle]="{ 'min-width': '58rem' }">
          <ng-template #header>
            <tr>
              <th>Account</th>
              <th>Department</th>
              <th>Provider</th>
              <th>Connection</th>
              <th class="text-right">Conversations</th>
              <th>Active</th>
              <th class="w-28"></th>
            </tr>
          </ng-template>
          <ng-template #body let-a>
            <tr [class.opacity-60]="!a.active">
              <td>
                <div class="flex items-center gap-3">
                  <span class="flex size-8 items-center justify-center rounded-lg text-white" [style.background]="a.color"><i class="pi pi-whatsapp text-sm"></i></span>
                  <div>
                    <div class="font-medium text-slate-900">{{ a.name }}</div>
                    <div class="text-xs tabular-nums text-slate-500">{{ a.phoneNumber }}</div>
                  </div>
                </div>
              </td>
              <td class="text-slate-600">{{ a.department || '—' }}</td>
              <td class="text-slate-700">{{ providerLabel(a.provider) }}</td>
              <td>
                <div class="flex items-center gap-1.5 text-xs font-medium" [class]="status(a.connectionStatus).text">
                  <span class="size-2 rounded-full" [class]="status(a.connectionStatus).dot"></span>{{ status(a.connectionStatus).label }}
                </div>
                @if (a.statusMessage) {
                  <div class="mt-0.5 max-w-64 truncate text-xs text-slate-500" [pTooltip]="a.statusMessage" tooltipPosition="bottom">{{ a.statusMessage }}</div>
                }
                @if (a.lastCheckedAt) {
                  <div class="text-[11px] text-slate-400">checked {{ a.lastCheckedAt | date: 'MMM d, HH:mm' }}</div>
                }
              </td>
              <td class="text-right tabular-nums">
                <a [routerLink]="['/inbox']" [queryParams]="{ account: a.id }" class="hover:text-emerald-700">{{ a.conversations }}</a>
              </td>
              <td><p-toggleswitch [ngModel]="a.active" (ngModelChange)="toggleActive(a, $event)" /></td>
              <td class="text-right">
                <p-button icon="pi pi-sync" [text]="true" severity="secondary" size="small" pTooltip="Test connection" [loading]="testing() === a.id" (onClick)="test(a)" />
                <p-button icon="pi pi-pencil" [text]="true" severity="secondary" size="small" pTooltip="Edit" (onClick)="open(a)" />
              </td>
            </tr>
          </ng-template>
          <ng-template #emptymessage>
            <tr><td colspan="7" class="p-8 text-center text-slate-500">No WhatsApp accounts yet.</td></tr>
          </ng-template>
        </p-table>
      </div>

      <p class="mt-3 text-xs text-slate-500">
        API keys and tokens are encrypted on the server and never sent back to the browser. Only admins can view this page.
      </p>
    </div>

    <p-dialog [header]="form.id ? 'Edit WhatsApp account' : 'Add WhatsApp account'" [(visible)]="dialog" [modal]="true" [draggable]="false" [style]="{ width: '40rem' }" [breakpoints]="{ '700px': '95vw' }">
      <form class="space-y-6" (ngSubmit)="save()">
        <!-- Details -->
        <section class="space-y-4">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Account details</h3>
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-1.5">
              <label class="block text-xs font-medium text-slate-600" for="a-name">Display name *</label>
              <input pInputText id="a-name" name="name" class="w-full" placeholder="e.g. Support" [(ngModel)]="form.name" />
            </div>
            <div class="space-y-1.5">
              <label class="block text-xs font-medium text-slate-600" for="a-phone">WhatsApp number *</label>
              <input pInputText id="a-phone" name="phone" class="w-full" placeholder="+9714…" [(ngModel)]="form.phoneNumber" />
            </div>
            <div class="space-y-1.5">
              <label class="block text-xs font-medium text-slate-600" for="a-dept">Department</label>
              <p-select inputId="a-dept" name="department" [options]="departments()" [(ngModel)]="form.department" [showClear]="true" placeholder="None" appendTo="body" styleClass="w-full" [editable]="true" />
            </div>
            <div class="space-y-1.5">
              <span class="block text-xs font-medium text-slate-600">Colour</span>
              <div class="flex h-[38px] items-center gap-1.5">
                @for (c of colors; track c) {
                  <button type="button" class="size-6 rounded-full ring-offset-2" [style.background]="c" [class.ring-2]="form.color === c" [class.ring-slate-400]="form.color === c" (click)="form.color = c" [attr.aria-label]="'Colour ' + c"></button>
                }
              </div>
            </div>
          </div>
          <label class="flex items-center gap-2 text-sm text-slate-700">
            <p-toggleswitch name="active" [(ngModel)]="form.active" /> Active (agents can reply from this number)
          </label>
        </section>

        <!-- Provider -->
        <section class="space-y-4 border-t border-slate-100 pt-5">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Provider connection</h3>
          <div class="space-y-1.5">
            <label class="block text-xs font-medium text-slate-600" for="a-provider">Provider type</label>
            <p-select inputId="a-provider" name="provider" [options]="providers()" optionLabel="label" optionValue="name" [(ngModel)]="form.provider" (onChange)="onProviderChange()" appendTo="body" styleClass="w-full" />
            @if (currentProvider(); as p) {
              <p class="text-xs text-slate-500">
                {{ p.description }}
                @if (p.docsUrl) {
                  <a [href]="p.docsUrl" target="_blank" rel="noopener" class="font-medium text-emerald-700 hover:underline">Setup guide ↗</a>
                }
              </p>
            }
          </div>

          @if (currentProvider(); as p) {
            @if (p.fields.length) {
              <div class="grid gap-4 sm:grid-cols-2">
                @for (f of p.fields; track f.key) {
                  <div class="space-y-1.5" [class.sm:col-span-2]="f.type === 'url' || f.type === 'secret'">
                    <label class="block text-xs font-medium text-slate-600" [for]="'f-' + f.key">{{ f.label }}{{ f.required ? ' *' : '' }}</label>
                    @if (f.type === 'secret') {
                      <input
                        pInputText
                        type="password"
                        autocomplete="new-password"
                        class="w-full font-mono"
                        [id]="'f-' + f.key"
                        [name]="'s-' + f.key"
                        [placeholder]="secretSaved(f.key) ? 'Saved (hidden). Type to replace.' : ''"
                        [(ngModel)]="form.secrets[f.key]"
                      />
                    } @else {
                      <input pInputText class="w-full" [id]="'f-' + f.key" [name]="'c-' + f.key" [placeholder]="f.placeholder || f.default || ''" [(ngModel)]="form.config[f.key]" />
                    }
                    @if (f.help) {
                      <p class="text-[11px] text-slate-500">{{ f.help }}</p>
                    }
                  </div>
                }
              </div>
            }
            @if (form.id && form.provider !== 'mock') {
              <div class="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                <div class="mb-1 font-medium text-slate-700">Webhook URL for incoming messages</div>
                <div class="flex items-center gap-2">
                  <code class="min-w-0 flex-1 break-all text-slate-600">{{ webhookUrl() }}</code>
                  <p-button icon="pi pi-copy" [text]="true" size="small" severity="secondary" (onClick)="copy(webhookUrl())" ariaLabel="Copy webhook URL" />
                </div>
                <p class="mt-1 text-slate-500">Paste this into the provider's webhook settings. Add <code>&token=…</code> if the server has WEBHOOK_TOKEN set.</p>
              </div>
            }
          }
        </section>
        <button type="submit" class="hidden"></button>
      </form>
      <ng-template #footer>
        <p-button label="Cancel" severity="secondary" [text]="true" (onClick)="dialog.set(false)" />
        <p-button [label]="form.id ? 'Save changes' : 'Add account'" [loading]="saving()" (onClick)="save()" />
      </ng-template>
    </p-dialog>
  `,
})
export class AccountsPage {
  private api = inject(ApiService);
  private toast = inject(MessageService);
  private store = inject(SettingsStore);

  protected accounts = signal<Account[]>([]);
  protected providers = signal<ProviderInfo[]>([]);
  protected loading = signal(true);
  protected dialog = signal(false);
  protected saving = signal(false);
  protected testing = signal<string | null>(null);
  protected providerName = signal<ProviderName>('mock');
  protected colors = COLORS;
  protected form: AccountForm = this.blank();

  protected activeCount = computed(() => this.accounts().filter((a) => a.active).length);
  protected departments = computed(() => this.store.settings()?.departments ?? []);
  protected currentProvider = computed(() => this.providers().find((p) => p.name === this.providerName()) ?? null);

  constructor() {
    this.load();
    this.api.providers().subscribe((p) => this.providers.set(p));
  }

  load() {
    this.api.accounts().subscribe({
      next: (a) => {
        this.accounts.set(a);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private blank(): AccountForm {
    return { id: null, name: '', phoneNumber: '', color: COLORS[0], department: '', active: true, provider: 'mock', config: {}, secrets: {}, secretsSet: {}, originalProvider: null };
  }

  protected status(s?: ConnectionStatus) {
    return CONNECTION_LABELS[s || 'not_configured'];
  }

  protected providerLabel(name?: string) {
    return this.providers().find((p) => p.name === name)?.label ?? name ?? '—';
  }

  protected secretSaved(key: string) {
    return this.form.provider === this.form.originalProvider && !!this.form.secretsSet[key];
  }

  protected webhookUrl() {
    return `${environment.apiUrl}/webhooks/${this.form.provider}?account=${this.form.id}`;
  }

  open(a: Account | null) {
    this.form = a
      ? {
          id: a.id,
          name: a.name,
          phoneNumber: a.phoneNumber,
          color: a.color,
          department: a.department || '',
          active: a.active !== false,
          provider: a.provider || 'mock',
          config: { ...(a.providerConfig || {}) },
          secrets: {},
          secretsSet: { ...(a.secretsSet || {}) },
          originalProvider: a.provider || 'mock',
        }
      : this.blank();
    this.providerName.set(this.form.provider);
    this.dialog.set(true);
  }

  onProviderChange() {
    this.providerName.set(this.form.provider);
    const p = this.currentProvider();
    // Fresh defaults when switching provider; the original values come back if switched back.
    this.form.config = this.form.provider === this.form.originalProvider ? { ...this.form.config } : Object.fromEntries((p?.fields ?? []).filter((f) => f.default).map((f) => [f.key, f.default!]));
    this.form.secrets = {};
  }

  save() {
    const f = this.form;
    if (!f.name.trim() || !f.phoneNumber.trim()) {
      this.toast.add({ severity: 'warn', summary: 'Name and number are required' });
      return;
    }
    const secrets = Object.fromEntries(Object.entries(f.secrets).filter(([, v]) => v && v.trim()));
    const body = {
      name: f.name,
      phoneNumber: f.phoneNumber,
      color: f.color,
      department: f.department || '',
      active: f.active,
      provider: f.provider,
      providerConfig: f.config,
      providerSecrets: secrets,
    };
    this.saving.set(true);
    this.api.saveAccount(f.id, body).subscribe({
      next: (a) => {
        this.saving.set(false);
        this.dialog.set(false);
        this.toast.add({ severity: 'success', summary: f.id ? 'Account updated' : 'Account added', detail: a.statusMessage || undefined });
        this.load();
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.add({ severity: 'error', summary: 'Could not save account', detail: errorMessage(e) });
      },
    });
  }

  toggleActive(a: Account, active: boolean) {
    this.api.saveAccount(a.id, { active }).subscribe({
      next: () => {
        this.toast.add({ severity: 'success', summary: `${a.name} ${active ? 'activated' : 'deactivated'}`, life: 2000 });
        this.load();
      },
      error: (e) => this.toast.add({ severity: 'error', summary: 'Update failed', detail: errorMessage(e) }),
    });
  }

  test(a: Account) {
    this.testing.set(a.id);
    this.api.testAccount(a.id).subscribe({
      next: (res) => {
        this.testing.set(null);
        const ok = res.connectionStatus === 'connected' || res.connectionStatus === 'simulated';
        this.toast.add({ severity: ok ? 'success' : 'warn', summary: `${a.name}: ${this.status(res.connectionStatus).label}`, detail: res.statusMessage });
        this.load();
      },
      error: (e) => {
        this.testing.set(null);
        this.toast.add({ severity: 'error', summary: 'Test failed', detail: errorMessage(e) });
      },
    });
  }

  copy(text: string) {
    navigator.clipboard?.writeText(text).then(
      () => this.toast.add({ severity: 'info', summary: 'Copied', life: 1500 }),
      () => {}
    );
  }
}
