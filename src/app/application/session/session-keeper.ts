import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';
import { SessionStatus } from '../../domain/model/session/session.model';
import { ApiError } from '../../domain/model/shared/api-error.model';
import { SessionPort } from '../../domain/ports/session/session.port';
import { CsrfTokenStore } from './csrf-token.store';

export const CHECK_INTERVAL_MS = 1000;
/** Si el tesorero estuvo activo, se renueva cuando faltan 2 minutos. */
export const RENEW_MARGIN_MS = 2 * 60 * 1000;
/** Si no hubo actividad, se avisa cuando falta 1 minuto (WCAG 2.2.1: ajuste de tiempo). */
export const WARNING_MARGIN_MS = 60 * 1000;
/** Antes de enviar una transferencia la sesión debe tener al menos 1 minuto de vida. */
export const SUBMIT_MARGIN_MS = 60 * 1000;

/**
 * Mantiene viva la sesión mientras el tesorero trabaja, sin extenderla en un equipo desatendido.
 * La sesión vence tras 5 min sin peticiones y solo POST /sesion/renovar la extiende.
 */
@Injectable({ providedIn: 'root' })
export class SessionKeeper implements OnDestroy {
  private readonly sessionPort = inject(SessionPort);
  private readonly csrf = inject(CsrfTokenStore);

  readonly status = signal<SessionStatus>('starting');
  readonly secondsLeft = signal(0);

  private expiresAt = 0;
  private lastActivityAt = 0;
  private lastRenewAt = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private inFlight: Observable<void> | null = null;

  start(): void {
    if (this.timer !== null) return;
    this.renew().subscribe({ error: () => undefined });
    this.timer = setInterval(() => this.check(), CHECK_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  ngOnDestroy(): void {
    this.stop();
  }

  /** Teclado, puntero o escritura del tesorero. */
  recordActivity(): void {
    this.lastActivityAt = Date.now();
    if (this.status() === 'warning') this.renew().subscribe({ error: () => undefined });
  }

  /** Una sola renovación a la vez: llamadas simultáneas comparten la misma petición. */
  renew(): Observable<void> {
    if (this.inFlight === null) {
      this.inFlight = this.sessionPort.renew().pipe(
        tap((renewal) => {
          this.expiresAt = Date.parse(renewal.expiraEn);
          this.lastRenewAt = Date.now();
          this.csrf.set(renewal.csrfToken);
          this.status.set('active');
        }),
        map(() => undefined),
        catchError((error: Partial<ApiError>) => {
          if (error.status === 401) this.expire();
          return throwError(() => error);
        }),
        finalize(() => (this.inFlight = null)),
        shareReplay(1),
      );
    }
    return this.inFlight;
  }

  /** Garantiza sesión y token CSRF vigentes antes de una operación que cambia datos. */
  ensureFresh(): Observable<void> {
    const remaining = this.expiresAt - Date.now();
    return remaining > SUBMIT_MARGIN_MS && this.csrf.token() !== null ? of(undefined) : this.renew();
  }

  private check(): void {
    const status = this.status();
    if (status === 'starting' || status === 'expired') return;
    const remaining = this.expiresAt - Date.now();
    if (remaining <= 0) {
      this.expire();
      return;
    }
    const activeSinceRenew = this.lastActivityAt > this.lastRenewAt;
    if (activeSinceRenew && remaining <= RENEW_MARGIN_MS) {
      this.renew().subscribe({ error: () => undefined });
      return;
    }
    if (remaining <= WARNING_MARGIN_MS) {
      this.status.set('warning');
      this.secondsLeft.set(Math.ceil(remaining / 1000));
    }
  }

  private expire(): void {
    this.status.set('expired');
    this.secondsLeft.set(0);
    this.csrf.clear();
  }
}
