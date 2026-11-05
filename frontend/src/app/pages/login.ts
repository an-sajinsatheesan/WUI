import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { AuthService, errorMessage } from '../core/auth';

@Component({
  selector: 'app-login',
  imports: [FormsModule, ButtonModule, InputTextModule, PasswordModule],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div class="w-full max-w-sm">
        <div class="mb-6 flex items-center justify-center gap-2">
          <span class="flex size-9 items-center justify-center rounded-md bg-emerald-600 text-white">
            <i class="pi pi-whatsapp"></i>
          </span>
          <span class="text-lg font-semibold text-slate-900">Unified Inbox</span>
        </div>
        <form class="space-y-4 rounded-lg border border-slate-200 bg-white p-6" (ngSubmit)="submit()">
          <div>
            <h2 class="text-base font-semibold text-slate-900">Sign in</h2>
            <p class="text-slate-500">Use one of the demo accounts below.</p>
          </div>
          <div class="space-y-1.5">
            <label for="email" class="block text-xs font-medium text-slate-600">Email</label>
            <input pInputText id="email" name="email" type="email" class="w-full" [(ngModel)]="email" autocomplete="username" required />
          </div>
          <div class="space-y-1.5">
            <label for="password" class="block text-xs font-medium text-slate-600">Password</label>
            <p-password inputId="password" name="password" [(ngModel)]="password" [feedback]="false" [toggleMask]="true" styleClass="w-full" inputStyleClass="w-full" autocomplete="current-password" />
          </div>
          @if (error()) {
            <p class="rounded-md bg-red-50 px-3 py-2 text-red-700">{{ error() }}</p>
          }
          <p-button type="submit" label="Sign in" styleClass="w-full" [loading]="loading()" />
        </form>
        <div class="mt-4 rounded-lg border border-dashed border-slate-300 p-4 text-xs text-slate-500">
          <div class="mb-2 font-medium text-slate-600">Demo logins</div>
          <button type="button" class="block w-full text-left hover:text-emerald-700" (click)="fill('admin@demo.com', 'Admin@123')">
            Admin: admin&#64;demo.com / Admin&#64;123
          </button>
          <button type="button" class="block w-full text-left hover:text-emerald-700" (click)="fill('agent1@demo.com', 'Agent@123')">
            Agent: agent1&#64;demo.com / Agent&#64;123
          </button>
        </div>
      </div>
    </div>
  `,
})
export class LoginPage {
  private auth = inject(AuthService);
  private router = inject(Router);
  protected email = '';
  protected password = '';
  protected loading = signal(false);
  protected error = signal('');

  constructor() {
    if (this.auth.token()) this.router.navigate(['/dashboard']);
  }

  fill(email: string, password: string) {
    this.email = email;
    this.password = password;
  }

  submit() {
    this.error.set('');
    this.loading.set(true);
    this.auth.login(this.email, this.password).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }
}
