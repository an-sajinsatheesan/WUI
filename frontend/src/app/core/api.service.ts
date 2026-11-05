import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Account, Conversation, Customer, CustomerDetail, Dashboard, Message, Ticket, User } from './models';

type Params = Record<string, string | number | boolean | null | undefined>;

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  private params(p: Params = {}): HttpParams {
    let hp = new HttpParams();
    for (const [k, v] of Object.entries(p)) if (v !== null && v !== undefined && v !== '') hp = hp.set(k, String(v));
    return hp;
  }

  // Dashboard & accounts
  dashboard(): Observable<Dashboard> {
    return this.http.get<Dashboard>(`${this.base}/dashboard`);
  }
  accounts(): Observable<Account[]> {
    return this.http.get<Account[]>(`${this.base}/accounts`);
  }

  // Conversations
  conversations(p: Params = {}): Observable<Conversation[]> {
    return this.http.get<Conversation[]>(`${this.base}/conversations`, { params: this.params(p) });
  }
  conversation(id: string): Observable<Conversation> {
    return this.http.get<Conversation>(`${this.base}/conversations/${id}`);
  }
  markRead(id: string) {
    return this.http.post(`${this.base}/conversations/${id}/read`, {});
  }
  updateConversation(id: string, body: { status?: string; assignedTo?: string | null }): Observable<Conversation> {
    return this.http.patch<Conversation>(`${this.base}/conversations/${id}`, body);
  }
  sendMessage(id: string, text: string): Observable<Message> {
    return this.http.post<Message>(`${this.base}/conversations/${id}/messages`, { text });
  }
  simulateIncoming(body: { conversationId?: string; accountId?: string; text?: string }) {
    return this.http.post(`${this.base}/simulate/incoming`, body);
  }

  // Tickets
  tickets(p: Params = {}): Observable<Ticket[]> {
    return this.http.get<Ticket[]>(`${this.base}/tickets`, { params: this.params(p) });
  }
  createTicket(body: Partial<Record<string, unknown>>): Observable<Ticket> {
    return this.http.post<Ticket>(`${this.base}/tickets`, body);
  }
  updateTicket(id: string, body: Partial<Record<string, unknown>>): Observable<Ticket> {
    return this.http.put<Ticket>(`${this.base}/tickets/${id}`, body);
  }
  deleteTicket(id: string) {
    return this.http.delete(`${this.base}/tickets/${id}`);
  }

  // Customers
  customers(search = ''): Observable<Customer[]> {
    return this.http.get<Customer[]>(`${this.base}/customers`, { params: this.params({ search }) });
  }
  customer(id: string): Observable<CustomerDetail> {
    return this.http.get<CustomerDetail>(`${this.base}/customers/${id}`);
  }
  saveCustomer(c: Partial<Customer>): Observable<Customer> {
    return c.id
      ? this.http.put<Customer>(`${this.base}/customers/${c.id}`, c)
      : this.http.post<Customer>(`${this.base}/customers`, c);
  }
  deleteCustomer(id: string) {
    return this.http.delete(`${this.base}/customers/${id}`);
  }

  // Users
  users(): Observable<User[]> {
    return this.http.get<User[]>(`${this.base}/users`);
  }
  saveUser(u: Partial<User> & { password?: string }): Observable<User> {
    return u.id ? this.http.put<User>(`${this.base}/users/${u.id}`, u) : this.http.post<User>(`${this.base}/users`, u);
  }
  deleteUser(id: string) {
    return this.http.delete(`${this.base}/users/${id}`);
  }
}
