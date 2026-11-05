import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../core/api.service';
import { Dashboard, prioritySeverity, statusLabel, statusSeverity } from '../core/models';

@Component({
  selector: 'app-dashboard',
  imports: [TableModule, TagModule, DatePipe, RouterLink],
  template: `
    <div class="mx-auto max-w-7xl space-y-6 p-4 lg:p-6">
      @if (data(); as d) {
        <!-- KPI strip: one bordered panel, divided cells -->
        <section class="grid grid-cols-2 divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white md:grid-cols-4 md:divide-x">
          @for (k of kpis(d); track k.label) {
            <a [routerLink]="k.link" class="block border-slate-200 p-5 hover:bg-slate-50 max-md:odd:border-r max-md:[&:nth-child(-n+2)]:border-b">
              <div class="text-xs font-medium uppercase tracking-wide text-slate-500">{{ k.label }}</div>
              <div class="mt-1 text-2xl font-semibold text-slate-900">{{ k.value }}</div>
              <div class="mt-0.5 text-xs text-slate-500">{{ k.hint }}</div>
            </a>
          }
        </section>

        <div class="grid gap-6 xl:grid-cols-5">
          <section class="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white xl:col-span-2">
            <header class="border-b border-slate-200 px-4 py-3 font-medium text-slate-900">WhatsApp accounts</header>
            <table class="w-full">
              <thead class="text-left text-xs text-slate-500">
                <tr class="border-b border-slate-100">
                  <th class="px-4 py-2 font-medium">Number</th>
                  <th class="px-4 py-2 text-right font-medium">Conversations</th>
                  <th class="px-4 py-2 text-right font-medium">Unread</th>
                </tr>
              </thead>
              <tbody>
                @for (a of d.accounts; track a.id) {
                  <tr class="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td class="px-4 py-2.5">
                      <a [routerLink]="['/inbox']" [queryParams]="{ account: a.id }" class="flex items-center gap-2">
                        <span class="size-2.5 rounded-full" [style.background]="a.color"></span>
                        <span class="font-medium text-slate-800">{{ a.name }}</span>
                        <span class="hidden text-xs text-slate-500 sm:inline">{{ a.phoneNumber }}</span>
                      </a>
                    </td>
                    <td class="px-4 py-2.5 text-right tabular-nums">{{ a.conversations }}</td>
                    <td class="px-4 py-2.5 text-right tabular-nums" [class.font-semibold]="a.unread" [class.text-emerald-700]="a.unread">{{ a.unread }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </section>

          <section class="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white xl:col-span-3">
            <header class="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <span class="font-medium text-slate-900">Recently updated tickets</span>
              <a routerLink="/tickets" class="text-xs font-medium text-emerald-700 hover:underline">View all</a>
            </header>
            <p-table [value]="d.recentTickets" styleClass="text-sm" [tableStyle]="{ 'min-width': '36rem' }">
              <ng-template #header>
                <tr>
                  <th class="w-16">#</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Assignee</th>
                  <th>Updated</th>
                </tr>
              </ng-template>
              <ng-template #body let-t>
                <tr>
                  <td class="text-slate-500">{{ t.number }}</td>
                  <td>
                    <div class="font-medium text-slate-800">{{ t.subject }}</div>
                    <div class="text-xs text-slate-500">{{ t.customer?.name }}</div>
                  </td>
                  <td><p-tag [value]="statusLabel(t.status)" [severity]="statusSeverity(t.status)" /></td>
                  <td class="text-slate-600">{{ t.assignedTo?.name || 'Unassigned' }}</td>
                  <td class="text-slate-500">{{ t.updatedAt | date: 'MMM d, HH:mm' }}</td>
                </tr>
              </ng-template>
            </p-table>
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
  protected statusLabel = statusLabel;
  protected statusSeverity = statusSeverity;
  protected prioritySeverity = prioritySeverity;

  constructor() {
    this.api.dashboard().subscribe((d) => this.data.set(d));
  }

  protected kpis(d: Dashboard) {
    const t = d.totals;
    return [
      { label: 'Conversations', value: t.conversations, hint: `across ${d.accounts.length} numbers`, link: '/inbox' },
      { label: 'Unread messages', value: t.unreadMessages, hint: `in ${t.unreadConversations} conversations`, link: '/inbox' },
      { label: 'Open tickets', value: t.openTickets + t.inProgressTickets, hint: `${t.inProgressTickets} in progress / pending`, link: '/tickets' },
      { label: 'Resolved tickets', value: t.resolvedTickets + t.closedTickets, hint: `${t.closedTickets} closed`, link: '/tickets' },
    ];
  }
}
