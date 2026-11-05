import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../core/api.service';
import { Conversation, Dashboard, Ticket, prioritySeverity, statusLabel, statusSeverity } from '../core/models';

interface Kpi {
  label: string;
  value: number;
  hint: string;
  icon: string;
  tone: string;
  link: string;
  query?: Record<string, string>;
}

@Component({
  selector: 'app-dashboard',
  imports: [TagModule, DatePipe, RouterLink],
  template: `
    <div class="space-y-6 px-4 py-5 lg:px-8 lg:py-6">
      @if (data(); as d) {
        <!-- KPIs -->
        <section class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          @for (k of kpis(); track k.label) {
            <a [routerLink]="k.link" [queryParams]="k.query" class="rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition-colors hover:border-slate-300">
              <div class="flex items-center justify-between">
                <span class="text-[13px] font-medium text-slate-500">{{ k.label }}</span>
                <span class="flex size-7 items-center justify-center rounded-lg" [class]="k.tone"><i [class]="'pi ' + k.icon + ' text-xs'"></i></span>
              </div>
              <div class="mt-2 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{{ k.value }}</div>
              <div class="mt-0.5 text-xs text-slate-500">{{ k.hint }}</div>
            </a>
          }
        </section>

        <div class="grid gap-6 xl:grid-cols-3">
          <!-- Conversations by account -->
          <section class="min-w-0 rounded-xl border border-slate-200 bg-white shadow-xs">
            <header class="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <h2 class="text-sm font-semibold text-slate-900">Conversations by WhatsApp account</h2>
            </header>
            <ul class="space-y-4 p-5">
              @for (a of d.accounts; track a.id) {
                <li>
                  <a [routerLink]="['/inbox']" [queryParams]="{ account: a.id }" class="group block">
                    <div class="mb-1.5 flex items-center gap-2 text-sm">
                      <span class="size-2 rounded-full" [style.background]="a.color"></span>
                      <span class="font-medium text-slate-800 group-hover:text-emerald-700">{{ a.name }}</span>
                      <span class="hidden truncate text-xs text-slate-400 sm:inline">{{ a.phoneNumber }}</span>
                      <span class="ml-auto tabular-nums text-slate-700">{{ a.conversations }}</span>
                      @if (a.unread) {
                        <span class="rounded-full bg-emerald-50 px-1.5 text-[11px] font-medium text-emerald-700">{{ a.unread }} unread</span>
                      }
                    </div>
                    <div class="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div class="h-full rounded-full" [style.width.%]="(a.conversations / maxConv()) * 100" [style.background]="a.color"></div>
                    </div>
                  </a>
                </li>
              }
            </ul>
          </section>

          <!-- Recent conversations -->
          <section class="min-w-0 rounded-xl border border-slate-200 bg-white shadow-xs">
            <header class="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <h2 class="text-sm font-semibold text-slate-900">Recent conversations</h2>
              <a routerLink="/inbox" class="text-xs font-medium text-emerald-700 hover:underline">Open inbox</a>
            </header>
            <ul>
              @for (c of recentConvs(); track c.id) {
                <li class="border-b border-slate-100 last:border-0">
                  <a [routerLink]="['/inbox', c.id]" class="flex gap-3 px-5 py-3 hover:bg-slate-50">
                    <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">{{ initials(c.customer.name) }}</span>
                    <span class="min-w-0 flex-1">
                      <span class="flex items-baseline gap-2">
                        <span class="flex-1 truncate text-sm text-slate-900" [class.font-semibold]="c.unreadCount">{{ c.customer.name }}</span>
                        <span class="shrink-0 text-[11px] text-slate-400">{{ c.lastMessageAt | date: 'MMM d, HH:mm' }}</span>
                      </span>
                      <span class="block truncate text-xs text-slate-500">{{ c.lastMessage }}</span>
                      <span class="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                        <span class="size-1.5 rounded-full" [style.background]="c.account.color"></span>{{ c.account.name }}
                      </span>
                    </span>
                    @if (c.unreadCount) {
                      <span class="self-center rounded-full bg-emerald-600 px-1.5 text-[11px] font-medium leading-4 text-white">{{ c.unreadCount }}</span>
                    }
                  </a>
                </li>
              } @empty {
                <li class="px-5 py-8 text-center text-sm text-slate-500">No conversations yet.</li>
              }
            </ul>
          </section>

          <!-- Recent tickets -->
          <section class="min-w-0 rounded-xl border border-slate-200 bg-white shadow-xs">
            <header class="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <h2 class="text-sm font-semibold text-slate-900">Recent tickets</h2>
              <a routerLink="/tickets" class="text-xs font-medium text-emerald-700 hover:underline">View all</a>
            </header>
            <ul>
              @for (t of d.recentTickets; track t.id) {
                <li class="border-b border-slate-100 last:border-0">
                  <a routerLink="/tickets" [queryParams]="{ q: t.number }" class="block px-5 py-3 hover:bg-slate-50">
                    <div class="flex items-baseline gap-2">
                      <span class="flex-1 truncate text-sm font-medium text-slate-800">{{ t.subject }}</span>
                      <span class="text-[11px] text-slate-400">#{{ t.number }}</span>
                    </div>
                    <div class="mt-1.5 flex items-center gap-2 text-xs text-slate-500">
                      <p-tag [value]="statusLabel(t.status)" [severity]="statusSeverity(t.status)" />
                      <span class="truncate">{{ t.customer?.name }}</span>
                      <span class="ml-auto shrink-0">{{ t.assignedTo?.name || 'Unassigned' }}</span>
                    </div>
                  </a>
                </li>
              } @empty {
                <li class="px-5 py-8 text-center text-sm text-slate-500">No tickets yet.</li>
              }
            </ul>
          </section>
        </div>
      } @else {
        <div class="p-10 text-center text-slate-500">Loading…</div>
      }
    </div>
  `,
})
export class DashboardPage {
  private api = inject(ApiService);
  protected data = signal<Dashboard | null>(null);
  protected recentConvs = signal<Conversation[]>([]);
  private inProgress = signal<Ticket[]>([]);
  protected statusLabel = statusLabel;
  protected statusSeverity = statusSeverity;
  protected prioritySeverity = prioritySeverity;

  protected maxConv = computed(() => Math.max(1, ...(this.data()?.accounts.map((a) => a.conversations) ?? [1])));

  protected kpis = computed<Kpi[]>(() => {
    const d = this.data();
    if (!d) return [];
    const t = d.totals;
    const inProgress = this.inProgress().length;
    return [
      { label: 'Total conversations', value: t.conversations, hint: `across ${d.accounts.length} numbers`, icon: 'pi-comments', tone: 'bg-slate-100 text-slate-600', link: '/inbox' },
      { label: 'Unread conversations', value: t.unreadConversations, hint: `${t.unreadMessages} unread messages`, icon: 'pi-envelope', tone: 'bg-emerald-50 text-emerald-700', link: '/inbox' },
      { label: 'Open tickets', value: t.openTickets, hint: 'waiting for an agent', icon: 'pi-inbox', tone: 'bg-sky-50 text-sky-700', link: '/tickets' },
      { label: 'In progress', value: inProgress, hint: `${Math.max(0, t.inProgressTickets - inProgress)} pending on customer`, icon: 'pi-spinner', tone: 'bg-amber-50 text-amber-700', link: '/tickets' },
      { label: 'Resolved tickets', value: t.resolvedTickets + t.closedTickets, hint: `${t.closedTickets} closed`, icon: 'pi-check-circle', tone: 'bg-violet-50 text-violet-700', link: '/tickets' },
    ];
  });

  constructor() {
    forkJoin({
      dashboard: this.api.dashboard(),
      conversations: this.api.conversations(),
      inProgress: this.api.tickets({ status: 'in_progress' }),
    }).subscribe(({ dashboard, conversations, inProgress }) => {
      this.recentConvs.set(conversations.slice(0, 6));
      this.inProgress.set(inProgress);
      this.data.set(dashboard);
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
}
