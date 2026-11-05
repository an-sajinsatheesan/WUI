import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { AppSettings } from './models';

/** App-wide settings (company name, logo, departments) shared by the layout and pages. */
@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private api = inject(ApiService);
  readonly settings = signal<AppSettings | null>(null);

  load() {
    this.api.settings().subscribe((s) => this.settings.set(s));
  }

  set(s: AppSettings) {
    this.settings.set(s);
  }
}
