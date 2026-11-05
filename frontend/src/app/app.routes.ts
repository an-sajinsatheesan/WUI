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
      { path: 'dashboard', loadComponent: () => import('./pages/dashboard').then((m) => m.DashboardPage), title: 'Dashboard' },
      { path: 'inbox', loadComponent: () => import('./pages/inbox').then((m) => m.InboxPage), title: 'Inbox' },
      { path: 'inbox/:id', loadComponent: () => import('./pages/inbox').then((m) => m.InboxPage), title: 'Inbox' },
      { path: 'tickets', loadComponent: () => import('./pages/tickets').then((m) => m.TicketsPage), title: 'Tickets' },
      { path: 'customers', loadComponent: () => import('./pages/customers').then((m) => m.CustomersPage), title: 'Customers' },
      { path: 'customers/:id', loadComponent: () => import('./pages/customer-detail').then((m) => m.CustomerDetailPage), title: 'Customer' },
      { path: 'users', canActivate: [adminGuard], loadComponent: () => import('./pages/users').then((m) => m.UsersPage), title: 'Users' },
    ],
  },
  { path: '**', redirectTo: '' },
];
