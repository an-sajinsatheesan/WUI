import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { environment } from '../../environments/environment';
import { ApiService } from '../core/api.service';
import { errorMessage } from '../core/auth';
import { AppSettings } from '../core/models';
import { SettingsStore } from '../core/settings.store';

type Section = 'general' | 'departments' | 'roles' | 'integrations';

@Component({
  selector: 'app-settings',
  imports: [FormsModule, RouterLink, ButtonModule, InputTextModule, ToggleSwitchModule],
  template: `
    <div class="px-4 py-5 lg:px-8 lg:py-6">
      <div class="flex flex-col gap-6 lg:flex-row">
        <!-- Section nav -->
        <nav class="flex gap-1 overflow-x-auto lg:w-52 lg:shrink-0 lg:flex-col">
          @for (s of sections; track s.id) {
            <button
              class="flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm"
              [class]="section() === s.id ? 'bg-white font-medium text-slate-900 shadow-xs ring-1 ring-slate-200' : 'text-slate-600 hover:bg-white/70'"
              (click)="section.set(s.id)"
            >
              <i [class]="'pi ' + s.icon + ' text-xs text-slate-400'"></i>{{ s.label }}
            </button>
          }
        </nav>

        <div class="min-w-0 flex-1">
          @if (s(); as st) {
            @switch (section()) {
              @case ('general') {
                <section class="max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xs">
                  <header class="border-b border-slate-100 px-5 py-4">
                    <h2 class="text-sm font-semibold text-slate-900">Company profile</h2>
                    <p class="text-xs text-slate-500">Shown in the top navigation for everyone.</p>
                  </header>
                  <div class="space-y-4 p-5">
                    <div class="space-y-1.5">
                      <label class="block text-xs font-medium text-slate-600" for="s-name">Company name</label>
                      <input pInputText id="s-name" class="w-full" [(ngModel)]="general.companyName" />
                    </div>
                    <div class="space-y-1.5">
                      <label class="block text-xs font-medium text-slate-600" for="s-logo">Logo URL (optional)</label>
                      <div class="flex items-center gap-3">
                        <input pInputText id="s-logo" class="min-w-0 flex-1" placeholder="https://…/logo.png" [(ngModel)]="general.logoUrl" />
                        @if (general.logoUrl) {
                          <img [src]="general.logoUrl" alt="Logo preview" class="size-9 rounded-md border border-slate-200 object-contain" />
                        }
                      </div>
                      <p class="text-[11px] text-slate-500">Square image, served over https.</p>
                    </div>
                  </div>
                  <footer class="flex justify-end border-t border-slate-100 px-5 py-3">
                    <p-button label="Save" [loading]="saving()" (onClick)="save({ companyName: general.companyName, logoUrl: general.logoUrl })" />
                  </footer>
                </section>
              }

              @case ('departments') {
                <section class="max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xs">
                  <header class="border-b border-slate-100 px-5 py-4">
                    <h2 class="text-sm font-semibold text-slate-900">Departments</h2>
                    <p class="text-xs text-slate-500">Used to group WhatsApp accounts and team members.</p>
                  </header>
                  <div class="p-5">
                    <ul class="divide-y divide-slate-100 rounded-lg border border-slate-200">
                      @for (d of depts; track $index) {
                        <li class="flex items-center gap-3 px-3 py-2">
                          <i class="pi pi-sitemap text-xs text-slate-400"></i>
                          <span class="flex-1 text-sm text-slate-800">{{ d }}</span>
                          <p-button icon="pi pi-times" [text]="true" size="small" severity="secondary" (onClick)="depts.splice($index, 1)" [ariaLabel]="'Remove ' + d" />
                        </li>
                      } @empty {
                        <li class="px-3 py-4 text-center text-sm text-slate-500">No departments.</li>
                      }
                    </ul>
                    <form class="mt-3 flex gap-2" (ngSubmit)="addDept()">
                      <input pInputText name="newDept" class="min-w-0 flex-1" placeholder="New department" [(ngModel)]="newDept" />
                      <p-button type="submit" label="Add" icon="pi pi-plus" severity="secondary" [outlined]="true" />
                    </form>
                  </div>
                  <footer class="flex justify-end border-t border-slate-100 px-5 py-3">
                    <p-button label="Save" [loading]="saving()" (onClick)="save({ departments: depts })" />
                  </footer>
                </section>
              }

              @case ('roles') {
                <section class="max-w-3xl rounded-xl border border-slate-200 bg-white shadow-xs">
                  <header class="border-b border-slate-100 px-5 py-4">
                    <h2 class="text-sm font-semibold text-slate-900">Roles & permissions</h2>
                    <p class="text-xs text-slate-500">Admins always have full access. Choose what Agents can do. Changes apply on the agent's next action.</p>
                  </header>
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="border-b border-slate-100 text-left text-xs text-slate-500">
                        <th class="px-5 py-2.5 font-medium">Permission</th>
                        <th class="w-24 px-3 py-2.5 text-center font-medium">Admin</th>
                        <th class="w-24 px-3 py-2.5 text-center font-medium">Agent</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (p of st.permissions; track p.key) {
                        <tr class="border-b border-slate-100">
                          <td class="px-5 py-3">
                            <div class="font-medium text-slate-800">{{ p.label }}</div>
                            <div class="text-xs text-slate-500">{{ p.description }}</div>
                          </td>
                          <td class="px-3 text-center"><i class="pi pi-check text-emerald-600"></i></td>
                          <td class="px-3 text-center"><p-toggleswitch [(ngModel)]="perms[p.key]" [ariaLabel]="p.label + ' for agents'" /></td>
                        </tr>
                      }
                      @for (fixed of adminOnly; track fixed) {
                        <tr class="border-b border-slate-100 last:border-0">
                          <td class="px-5 py-3">
                            <div class="font-medium text-slate-800">{{ fixed }}</div>
                            <div class="text-xs text-slate-500">Always admin-only</div>
                          </td>
                          <td class="px-3 text-center"><i class="pi pi-check text-emerald-600"></i></td>
                          <td class="px-3 text-center"><i class="pi pi-lock text-xs text-slate-300"></i></td>
                        </tr>
                      }
                    </tbody>
                  </table>
                  <footer class="flex justify-end border-t border-slate-100 px-5 py-3">
                    <p-button label="Save permissions" [loading]="saving()" (onClick)="save({ agentPermissions: perms })" />
                  </footer>
                </section>
              }

              @case ('integrations') {
                <div class="max-w-4xl space-y-6">
                  <section class="rounded-xl border border-slate-200 bg-white shadow-xs">
                    <header class="border-b border-slate-100 px-5 py-4">
                      <h2 class="text-sm font-semibold text-slate-900">WhatsApp providers</h2>
                      <p class="text-xs text-slate-500">
                        Each WhatsApp account picks its own provider. Enter API keys under
                        <a routerLink="/accounts" class="font-medium text-emerald-700 hover:underline">WhatsApp Accounts</a> → Edit → Provider connection.
                      </p>
                    </header>
                    <div class="overflow-x-auto">
                      <table class="w-full min-w-[40rem] text-sm">
                        <thead>
                          <tr class="border-b border-slate-100 text-left text-xs text-slate-500">
                            <th class="px-5 py-2.5 font-medium">Provider</th>
                            <th class="px-3 py-2.5 font-medium">Platform fee</th>
                            <th class="px-3 py-2.5 font-medium">You enter</th>
                            <th class="px-3 py-2.5 font-medium">Best for</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (p of providerGuide; track p.name) {
                            <tr class="border-b border-slate-100 align-top last:border-0">
                              <td class="px-5 py-3 font-medium text-slate-800">
                                {{ p.name }}
                                @if (p.pick) {
                                  <span class="ml-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">Lowest cost</span>
                                }
                              </td>
                              <td class="px-3 py-3 text-slate-600">{{ p.fee }}</td>
                              <td class="px-3 py-3 text-slate-600">{{ p.fields }}</td>
                              <td class="px-3 py-3 text-slate-600">{{ p.best }}</td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                    <p class="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-500">
                      All providers also pass on Meta's per-message fees. Prices change often; check each provider's pricing page before choosing.
                    </p>
                  </section>

                  <section class="rounded-xl border border-slate-200 bg-white shadow-xs">
                    <header class="border-b border-slate-100 px-5 py-4">
                      <h2 class="text-sm font-semibold text-slate-900">Webhook endpoints</h2>
                      <p class="text-xs text-slate-500">Where providers send incoming messages. Each account's exact URL is shown in its edit dialog.</p>
                    </header>
                    <ul class="divide-y divide-slate-100 text-sm">
                      @for (w of webhooks; track w.label) {
                        <li class="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:gap-4">
                          <span class="w-28 shrink-0 font-medium text-slate-700">{{ w.label }}</span>
                          <code class="break-all text-xs text-slate-600">{{ apiUrl }}{{ w.path }}</code>
                        </li>
                      }
                    </ul>
                    <p class="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-500">
                      Server-side secrets (WEBHOOK_TOKEN, META_VERIFY_TOKEN, ENCRYPTION_KEY) are set as backend environment variables, never in this screen.
                    </p>
                  </section>
                </div>
              }
            }
          } @else {
            <div class="p-10 text-center text-slate-500">Loading…</div>
          }
        </div>
      </div>
    </div>
  `,
})
export class SettingsPage {
  private api = inject(ApiService);
  private toast = inject(MessageService);
  private store = inject(SettingsStore);

  protected sections: { id: Section; label: string; icon: string }[] = [
    { id: 'general', label: 'General', icon: 'pi-building' },
    { id: 'departments', label: 'Departments', icon: 'pi-sitemap' },
    { id: 'roles', label: 'Roles & permissions', icon: 'pi-shield' },
    { id: 'integrations', label: 'Integrations', icon: 'pi-link' },
  ];
  protected section = signal<Section>('general');
  protected s = signal<AppSettings | null>(null);
  protected saving = signal(false);
  protected general = { companyName: '', logoUrl: '' };
  protected depts: string[] = [];
  protected newDept = '';
  protected perms: Record<string, boolean> = {};
  protected apiUrl = environment.apiUrl;

  protected adminOnly = ['Manage team members and roles', 'Manage WhatsApp accounts and API keys', 'Change settings'];

  protected providerGuide = [
    { name: 'Meta WhatsApp Cloud API', fee: 'None', fields: 'Phone number ID, access token', best: 'Lowest running cost if you can do the Meta Business setup yourself', pick: true },
    { name: '360dialog', fee: '≈ €49 / month per number', fields: 'API key', best: 'Simple onboarding, no per-message markup', pick: false },
    { name: 'Twilio', fee: '≈ $0.005 per message (in & out)', fields: 'Account SID, auth token', best: 'Low volume, pay-as-you-go, already on Twilio', pick: false },
    { name: 'WATI', fee: 'From ≈ $59 / month', fields: 'API endpoint, access token', best: 'Teams that also want WATI\'s own inbox and chatbots', pick: false },
  ];

  protected webhooks = [
    { label: 'Meta', path: '/webhooks/meta?account=<id>' },
    { label: '360dialog', path: '/webhooks/360dialog?account=<id>' },
    { label: 'Twilio', path: '/webhooks/twilio?account=<id>' },
    { label: 'WATI', path: '/webhooks/wati?account=<id>' },
  ];

  constructor() {
    this.api.settings().subscribe((s) => this.apply(s));
  }

  private apply(s: AppSettings) {
    this.general = { companyName: s.companyName, logoUrl: s.logoUrl };
    this.depts = [...s.departments];
    this.perms = { ...s.agentPermissions };
    this.s.set(s);
  }

  addDept() {
    const d = this.newDept.trim();
    if (d && !this.depts.includes(d)) this.depts.push(d);
    this.newDept = '';
  }

  save(body: Partial<AppSettings>) {
    this.saving.set(true);
    this.api.saveSettings(body).subscribe({
      next: (s) => {
        this.saving.set(false);
        this.apply(s);
        this.store.set(s);
        this.toast.add({ severity: 'success', summary: 'Settings saved' });
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.add({ severity: 'error', summary: 'Could not save', detail: errorMessage(e) });
      },
    });
  }
}
