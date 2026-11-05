import { Component, DestroyRef, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { filter, interval, startWith, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { AuthService } from '../core/auth';
import { ApiService } from '../core/api.service';

interface NavItem {
  label: string;
  icon: string;
  path: string;
  adminOnly?: boolean;
}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ButtonModule, TagModule],
  template: `
    <div class="flex h-screen overflow-hidden">
      <!-- Sidebar -->
      <aside
        class="fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0"
        [class.-translate-x-full]="!menuOpen()"
      >
        <div class="flex h-14 items-center gap-2 border-b border-slate-200 px-5">
          <span class="flex size-7 items-center justify-center rounded-md bg-emerald-600 text-white">
            <i class="pi pi-whatsapp text-sm"></i>
          </span>
          <span class="font-semibold text-slate-900">Unified Inbox</span>
        </div>
        <nav class="flex-1 space-y-0.5 p-3">
          @for (item of nav; track item.path) {
            @if (!item.adminOnly || auth.isAdmin()) {
              <a
                [routerLink]="item.path"
                routerLinkActive="!bg-emerald-50 !text-emerald-700 font-medium"
                (click)="menuOpen.set(false)"
                class="flex items-center gap-3 rounded-md px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                <i [class]="'pi ' + item.icon + ' text-[15px]'"></i>
                <span class="flex-1">{{ item.label }}</span>
                @if (item.path === '/inbox' && unread() > 0) {
                  <span class="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[11px] font-medium leading-none text-white">{{ unread() }}</span>
                }
              </a>
            }
          }
        </nav>
        <div class="border-t border-slate-200 p-3 text-xs text-slate-400">Simulated WhatsApp provider</div>
      </aside>
      @if (menuOpen()) {
        <div class="fixed inset-0 z-30 bg-slate-900/30 lg:hidden" (click)="menuOpen.set(false)"></div>
      }

      <!-- Main -->
      <div class="flex min-w-0 flex-1 flex-col">
        <header class="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:px-6">
          <button class="text-slate-500 lg:hidden" (click)="menuOpen.set(true)" aria-label="Open menu">
            <i class="pi pi-bars"></i>
          </button>
          <h1 class="flex-1 truncate text-base font-semibold text-slate-900">{{ pageTitle() }}</h1>
          @if (auth.user(); as u) {
            <div class="hidden text-right sm:block">
              <div class="text-sm font-medium leading-tight text-slate-800">{{ u.name }}</div>
              <div class="text-xs capitalize leading-tight text-slate-500">{{ u.role }}</div>
            </div>
            <span class="flex size-8 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
              {{ initials(u.name) }}
            </span>
          }
          <p-button icon="pi pi-sign-out" [text]="true" severity="secondary" (onClick)="auth.logout()" ariaLabel="Sign out" />
        </header>
        <main class="min-h-0 flex-1 overflow-auto">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class Shell {
  protected auth = inject(AuthService);
  private api = inject(ApiService);
  private router = inject(Router);
  private title = inject(Title);

  protected nav: NavItem[] = [
    { label: 'Dashboard', icon: 'pi-th-large', path: '/dashboard' },
    { label: 'Inbox', icon: 'pi-inbox', path: '/inbox' },
    { label: 'Tickets', icon: 'pi-ticket', path: '/tickets' },
    { label: 'Customers', icon: 'pi-users', path: '/customers' },
    { label: 'Users', icon: 'pi-id-card', path: '/users', adminOnly: true },
  ];
  protected menuOpen = signal(false);
  protected pageTitle = signal('');
  protected unread = signal(0);

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.auth.refreshMe();
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
        this.title.setTitle(r.title ? `${r.title} · Unified Inbox` : 'Unified Inbox');
      });

    interval(20000)
      .pipe(
        startWith(0),
        switchMap(() => this.api.accounts()),
        takeUntilDestroyed(destroyRef)
      )
      .subscribe((accs) => this.unread.set(accs.reduce((s, a) => s + (a.unread || 0), 0)));
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
