import { Injectable, signal } from '@angular/core';

/**
 * Token CSRF solo en memoria. La política del banco prohíbe guardarlo en
 * localStorage, sessionStorage, IndexedDB o cookies legibles por scripts.
 */
@Injectable({ providedIn: 'root' })
export class CsrfTokenStore {
  private readonly value = signal<string | null>(null);
  readonly token = this.value.asReadonly();

  set(token: string): void {
    this.value.set(token);
  }

  clear(): void {
    this.value.set(null);
  }
}
