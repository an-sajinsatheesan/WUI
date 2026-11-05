import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { filter, forkJoin, interval, startWith, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MenuItem } from 'primeng/api';
import { MenuModule } from 'primeng/menu';
import { PopoverModule } from 'primeng/popover';
import { AuthService } from '../core/auth';
import { ApiService } from '../core/api.service';
import { Conversation, Ticket, statusLabel } from '../core/models';
import { SettingsStore } from '../core/settings.store';
import { GlobalSearch } from './global-search';

interface NavItem {
  label: string;
  icon: string;
  path: string;
}

@Component({
  selector: 'app-shell',
  imports: [NgTemplateOutlet, RouterOutlet, RouterLink, RouterLinkActive, MenuModule, PopoverModule, GlobalSearch],
  template: `
    <div class="flex h-screen flex-col overflow-hidden">
      <!-- Top navigation -->
      <header class="z-30 flex h-14 shrink-0 items-center border-b border-slate-200 bg-white">
        <div class="flex h-full items-center gap-2.5 px-4 lg:w-60 lg:border-r lg:border-slate-200 lg:px-5">
          <button class="mr-1 text-slate-500 lg:hidden" (click)="menuOpen.set(true)" aria-label="Open menu"><i class="pi pi-bars"></i></button>
          @if (store.settings()?.logoUrl) {
            <img [src]="store.settings()!.logoUrl" alt="" class="size-7 rounded-md object-contain" />
          } @else {
            <span class="flex size-7 items-center justify-center rounded-md bg-emerald-600 text-white"><i class="pi pi-whatsapp text-sm"></i></span>
          }
          <span class="hidden truncate text-[15px] font-semibold tracking-tight text-slate-900 sm:block">{{ companyName() }}</span>
        </div>

        <div class="flex min-w-0 flex-1 items-center gap-3 px-3 lg:px-6">
          <div class="hidden min-w-0 flex-1 md:block md:max-w-md"><app-global-search /></div>
          <div class="flex-1 md:hidden"></div>

          <!-- Notifications -->
          <button
            class="relative ml-auto flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            (click)="notif.toggle($event)"
            aria-label="Notifications"
          >
            <i class="pi pi-bell"></i>
            @if (notifCount() > 0) {
              <span class="absolute right-1 top-1 min-w-4 rounded-full bg-red-500 px-1 text-center text-[10px] font-semibold leading-4 text-white">{{ notifCount() > 9 ? '9+' : notifCount() }}</span>
            }
          </button>
          <p-popover #notif styleClass="!p-0">
            <div class="w-80 max-w-[90vw]">
              <div class="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <span class="text-sm font-semibold text-slate-900">Notifications</span>
                <span class="text-xs text-slate-400">auto-refresh</span>
              </div>
              <div class="max-h-96 overflow-y-auto">
                @if (unreadConvs().length) {
                  <div class="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Unread conversations</div>
                  @for (c of unreadConvs().slice(0, 6); track c.id) {
                    <a [routerLink]="['/inbox', c.id]" (click)="notif.hide()" class="flex gap-3 px-4 py-2 hover:bg-slate-50">
                      <span class="mt-1.5 size-2 shrink-0 rounded-full bg-emerald-500"></span>
                      <span class="min-w-0 flex-1">
                        <span class="block truncate text-sm text-slate-800"><b class="font-medium">{{ c.customer.name }}</b> · {{ c.account.name }}</span>
                        <span class="block truncate text-xs text-slate-500">{{ c.lastMessage }}</span>
                      </span>
                      <span class="text-xs font-semibold text-emerald-700">{{ c.unreadCount }}</span>
                    </a>
                  }
                }
                @if (myTickets().length) {
                  <div class="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Your active tickets</div>
                  @for (t of myTickets().slice(0, 5); track t.id) {
                    <a routerLink="/tickets" [queryParams]="{ q: t.number }" (click)="notif.hide()" class="flex gap-3 px-4 py-2 hover:bg-slate-50">
                      <i class="pi pi-ticket mt-0.5 text-xs text-slate-400"></i>
                      <span class="min-w-0 flex-1 truncate text-sm text-slate-800">#{{ t.number }} {{ t.subject }}</span>
                      <span class="text-xs text-slate-400">{{ statusLabel(t.status) }}</span>
                    </a>
                  }
                }
                @if (!unreadConvs().length && !myTickets().length) {
                  <div class="px-4 py-8 text-center text-sm text-slate-500">You're all caught up.</div>
                }
              </div>
            </div>
          </p-popover>

          <!-- Profile -->
          <button class="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-2 hover:bg-slate-100" (click)="profile.toggle($event)" aria-label="Account menu">
            <span class="flex size-8 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white">{{ initials() }}</span>
            <span class="hidden text-left sm:block">
              <span class="block text-sm font-medium leading-tight text-slate-800">{{ auth.user()?.name }}</span>
              <span class="block text-xs capitalize leading-tight text-slate-500">{{ auth.user()?.role }}</span>
            </span>
            <i class="pi pi-chevron-down hidden text-[10px] text-slate-400 sm:block"></i>
          </button>
          <p-menu #profile [model]="profileItems()" [popup]="true" appendTo="body" />
        </div>
      </header>

      <div class="flex min-h-0 flex-1">
        <!-- Sidebar -->
        <aside
          class="fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0"
          [class.-translate-x-full]="!menuOpen()"
        >
          <div class="flex h-14 items-center justify-between border-b border-slate-200 px-5 lg:hidden">
            <span class="font-semibold text-slate-900">{{ companyName() }}</span>
            <button class="text-slate-500" (click)="menuOpen.set(false)" aria-label="Close menu"><i class="pi pi-times"></i></button>
          </div>
          <div class="p-3 md:hidden"><app-global-search /></div>
          <nav class="flex-1 overflow-y-auto p-3">
            <div class="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Workspace</div>
            @for (item of workspace; track item.path) {
              <ng-container *ngTemplateOutlet="link; context: { $implicit: item }" />
            }
            @if (auth.isAdmin()) {
              <div class="px-3 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Administration</div>
              @for (item of admin; track item.path) {
                <ng-container *ngTemplateOutlet="link; context: { $implicit: item }" />
              }
            }
            <ng-template #link let-item>
              <a
                [routerLink]="item.path"
                routerLinkActive="!bg-emerald-50 !text-emerald-700 font-medium"
                (click)="menuOpen.set(false)"
                class="mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                <i [class]="'pi ' + item.icon + ' text-[15px]'"></i>
                <span class="flex-1">{{ item.label }}</span>
                @if (item.path === '/inbox' && unreadConvs().length > 0) {
                  <span class="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[11px] font-medium leading-none text-white">{{ unreadConvs().length }}</span>
                }
              </a>
            </ng-template>
          </nav>
          <div class="border-t border-slate-200 px-5 py-3 text-xs text-slate-400">WhatsApp Unified Inbox · MVP</div>
        </aside>
        @if (menuOpen()) {
          <div class="fixed inset-0 z-30 bg-slate-900/30 lg:hidden" (click)="menuOpen.set(false)"></div>
        }

        <!-- Page -->
        <div class="flex min-w-0 flex-1 flex-col bg-slate-50">
          @if (pageTitle() && !fullBleed()) {
            <div class="shrink-0 px-4 pt-5 lg:px-8 lg:pt-7">
              <h1 class="text-xl font-semibold tracking-tight text-slate-900">{{ pageTitle() }}</h1>
              @if (pageHint()) {
                <p class="mt-0.5 text-sm text-slate-500">{{ pageHint() }}</p>
              }
            </div>
          }
          <main class="min-h-0 flex-1 overflow-auto">
            <router-outlet />
          </main>
        </div>
      </div>
    </div>
  `,
})
export class Shell {
  protected auth = inject(AuthService);
  protected store = inject(SettingsStore);
  private api = inject(ApiService);
  private router = inject(Router);
  private title = inject(Title);

  protected workspace: NavItem[] = [
    { label: 'Dashboard', icon: 'pi-th-large', path: '/dashboard' },
    { label: 'WhatsApp Inbox', icon: 'pi-inbox', path: '/inbox' },
    { label: 'Tickets', icon: 'pi-ticket', path: '/tickets' },
    { label: 'Customers', icon: 'pi-users', path: '/customers' },
  ];
  protected admin: NavItem[] = [
    { label: 'Team', icon: 'pi-id-card', path: '/team' },
    { label: 'WhatsApp Accounts', icon: 'pi-whatsapp', path: '/accounts' },
    { label: 'Settings', icon: 'pi-cog', path: '/settings' },
  ];

  protected menuOpen = signal(false);
  protected pageTitle = signal('');
  protected pageHint = signal('');
  protected fullBleed = signal(false);
  protected unreadConvs = signal<Conversation[]>([]);
  protected myTickets = signal<Ticket[]>([]);
  protected notifCount = computed(() => this.unreadConvs().length + this.myTickets().filter((t) => t.status === 'open').length);
  protected companyName = computed(() => this.store.settings()?.companyName || 'Unified Inbox');
  protected statusLabel = statusLabel;

  protected profileItems = computed<MenuItem[]>(() => {
    const u = this.auth.user();
    const items: MenuItem[] = [
      { label: u?.email || '', disabled: true, styleClass: 'text-xs' },
      { separator: true },
    ];
    if (this.auth.isAdmin()) items.push({ label: 'Settings', icon: 'pi pi-cog', routerLink: '/settings' });
    items.push({ label: 'Sign out', icon: 'pi pi-sign-out', command: () => this.auth.logout() });
    return items;
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.auth.refreshMe();
    this.store.load();

    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        startWith(null),
        takeUntilDestroyed(destroyRef)
      )
      .subscribe(() => {
        let r = this.router.routerState.snapshot.root;
        while (r.firstChild) r = r.firstChild;
        this.pageTitle.set(r.title ?? '');
        this.pageHint.set(r.data['hint'] ?? '');
        this.fullBleed.set(!!r.data['fullBleed']);
        this.title.setTitle(r.title ? `${r.title} · ${this.companyName()}` : this.companyName());
      });

    // Notifications + inbox badge (polling keeps it serverless-friendly).
    interval(20000)
      .pipe(
        startWith(0),
        switchMap(() =>
          forkJoin({
            convs: this.api.conversations({ unread: true }),
            tickets: this.api.tickets({ assignedTo: 'me', status: 'open,in_progress,pending' }),
          })
        ),
        takeUntilDestroyed(destroyRef)
      )
      .subscribe(({ convs, tickets }) => {
        this.unreadConvs.set(convs);
        this.myTickets.set(tickets);
      });
  }

  protected initials() {
    return (this.auth.user()?.name || '')
      .split(' ')
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
}
