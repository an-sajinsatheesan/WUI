import { Routes } from '@angular/router';
import { adminGuard, authGuard } from './core/auth';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login').then((m) => m.LoginPage), title: 'Sign in' },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard').then((m) => m.DashboardPage),
        title: 'Dashboard',
        data: { hint: 'Conversations and tickets across all WhatsApp numbers' },
      },
      { path: 'inbox', loadComponent: () => import('./pages/inbox').then((m) => m.InboxPage), title: 'WhatsApp Inbox', data: { fullBleed: true } },
      { path: 'inbox/:id', loadComponent: () => import('./pages/inbox').then((m) => m.InboxPage), title: 'WhatsApp Inbox', data: { fullBleed: true } },
      { path: 'tickets', loadComponent: () => import('./pages/tickets').then((m) => m.TicketsPage), title: 'Tickets', data: { hint: 'Create, assign and track customer issues' } },
      { path: 'customers', loadComponent: () => import('./pages/customers').then((m) => m.CustomersPage), title: 'Customers', data: { hint: 'Everyone who has messaged any of your numbers' } },
      { path: 'customers/:id', loadComponent: () => import('./pages/customer-detail').then((m) => m.CustomerDetailPage), title: 'Customer' },
      {
        path: 'team',
        canActivate: [adminGuard],
        loadComponent: () => import('./pages/users').then((m) => m.UsersPage),
        title: 'Team',
        data: { hint: 'Users, roles and departments' },
      },
      {
        path: 'accounts',
        canActivate: [adminGuard],
        loadComponent: () => import('./pages/accounts').then((m) => m.AccountsPage),
        title: 'WhatsApp Accounts',
        data: { hint: 'Business numbers, departments and provider connections' },
      },
      {
        path: 'settings',
        canActivate: [adminGuard],
        loadComponent: () => import('./pages/settings').then((m) => m.SettingsPage),
        title: 'Settings',
        data: { hint: 'Company profile, departments, roles and integrations' },
      },
      { path: 'users', redirectTo: 'team' },
    ],
  },
  { path: '**', redirectTo: '' },
];
