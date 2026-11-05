import { Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../core/api.service';
import { Conversation, Customer, Ticket, statusLabel } from '../core/models';

interface Results {
  customers: Customer[];
  conversations: Conversation[];
  tickets: Ticket[];
}

/** Top-bar search across customers, conversations and tickets (uses the existing list APIs). */
@Component({
  selector: 'app-global-search',
  imports: [FormsModule],
  template: `
    <div class="relative w-full">
      <i class="pi pi-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400"></i>
      <input
        #box
        type="search"
        class="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-14 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/15"
        placeholder="Search customers, conversations, tickets"
        aria-label="Global search"
        [ngModel]="q()"
        (ngModelChange)="onInput($event)"
        (focus)="open.set(q().length >= 2)"
        (keydown.escape)="close()"
      />
      <kbd class="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 text-[10px] font-medium text-slate-400 md:block">Ctrl K</kbd>

      @if (open()) {
        <div class="absolute left-0 right-0 top-11 z-50 max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-white py-2 shadow-lg">
          @if (loading()) {
            <div class="px-4 py-3 text-sm text-slate-500">Searching…</div>
          } @else if (empty()) {
            <div class="px-4 py-3 text-sm text-slate-500">No results for “{{ q() }}”</div>
          } @else if (results(); as r) {
            @if (r.customers.length) {
              <div class="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Customers</div>
              @for (c of r.customers; track c.id) {
                <button class="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-slate-50" (click)="go(['/customers', c.id])">
                  <i class="pi pi-user text-xs text-slate-400"></i>
                  <span class="flex-1 truncate text-sm text-slate-800">{{ c.name }}</span>
                  <span class="text-xs text-slate-400">{{ c.phone }}</span>
                </button>
              }
            }
            @if (r.conversations.length) {
              <div class="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Conversations</div>
              @for (c of r.conversations; track c.id) {
                <button class="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-slate-50" (click)="go(['/inbox', c.id])">
                  <i class="pi pi-comments text-xs text-slate-400"></i>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm text-slate-800">{{ c.customer.name }}</span>
                    <span class="block truncate text-xs text-slate-500">{{ c.lastMessage }}</span>
                  </span>
                  <span class="flex items-center gap-1 text-xs text-slate-400"><span class="size-1.5 rounded-full" [style.background]="c.account.color"></span>{{ c.account.name }}</span>
                </button>
              }
            }
            @if (r.tickets.length) {
              <div class="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Tickets</div>
              @for (t of r.tickets; track t.id) {
                <button class="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-slate-50" (click)="go(['/tickets'], t.number)">
                  <i class="pi pi-ticket text-xs text-slate-400"></i>
                  <span class="flex-1 truncate text-sm text-slate-800">#{{ t.number }} {{ t.subject }}</span>
                  <span class="text-xs text-slate-400">{{ statusLabel(t.status) }}</span>
                </button>
              }
            }
          }
        </div>
      }
    </div>
  `,
})
export class GlobalSearch {
  private api = inject(ApiService);
  private router = inject(Router);
  private host = inject(ElementRef<HTMLElement>);

  protected q = signal('');
  protected open = signal(false);
  protected loading = signal(false);
  protected results = signal<Results | null>(null);
  protected statusLabel = statusLabel;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private seq = 0;

  protected empty() {
    const r = this.results();
    return !!r && !r.customers.length && !r.conversations.length && !r.tickets.length;
  }

  onInput(value: string) {
    this.q.set(value);
    clearTimeout(this.timer);
    if (value.trim().length < 2) {
      this.open.set(false);
      return;
    }
    this.open.set(true);
    this.loading.set(true);
    this.timer = setTimeout(() => this.search(value.trim()), 250);
  }

  private search(q: string) {
    const id = ++this.seq;
    forkJoin({
      customers: this.api.customers(q),
      conversations: this.api.conversations({ search: q }),
      tickets: this.api.tickets({ search: q }),
    }).subscribe({
      next: (r) => {
        if (id !== this.seq) return; // a newer search started
        this.results.set({ customers: r.customers.slice(0, 5), conversations: r.conversations.slice(0, 5), tickets: r.tickets.slice(0, 5) });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  go(commands: unknown[], ticketNumber?: number) {
    this.close();
    this.router.navigate(commands, ticketNumber ? { queryParams: { q: ticketNumber } } : {});
  }

  close() {
    this.open.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent) {
    if (!this.host.nativeElement.contains(e.target as Node)) this.close();
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.host.nativeElement.querySelector('input')?.focus();
    }
  }
}
