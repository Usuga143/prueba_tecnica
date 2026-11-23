import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BehaviorSubject, catchError, map, of, startWith, switchMap } from 'rxjs';
import {
  ListMovementsUseCase,
  groupByAccountingDay,
} from '../../../application/movement/list-movements.use-case';
import {
  Account,
  MovementDayGroup,
  MovementsResponse,
} from '../../../domain/model/movement/movement.model';
import { ApiError } from '../../../domain/model/shared/api-error.model';
import { CURRENT_ACCOUNT_ID } from '../../../domain/model/shared/current-account';

export const PAGE_SIZE = 200;

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

interface Period {
  year: number;
  month: number;
}

type ViewState =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'loaded'; account: Account; groups: MovementDayGroup[]; shown: number; total: number }
  | { kind: 'error'; message: string; canRetry: boolean }
  | { kind: 'session-expired' };

@Component({
  selector: 'app-movements-page',
  imports: [CurrencyPipe, DatePipe],
  templateUrl: './movements-page.html',
  styleUrl: './movements-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovementsPage {
  private readonly listMovements = inject(ListMovementsUseCase);

  protected readonly months = MONTHS;
  protected readonly years = [2025, 2026];
  protected readonly period = signal<Period>({ year: 2026, month: 10 });

  // Cada valor emitido es una carga. switchMap cancela la anterior si llega una nueva.
  private readonly load$ = new BehaviorSubject<Period>(this.period());

  protected readonly state = toSignal(
    this.load$.pipe(
      switchMap((period) =>
        this.listMovements
          .execute({ accountId: CURRENT_ACCOUNT_ID, ...monthRange(period), limite: PAGE_SIZE })
          .pipe(
            map(toLoadedState),
            startWith<ViewState>({ kind: 'loading' }),
            catchError((error: unknown) => of(toErrorState(error))),
          ),
      ),
    ),
    { initialValue: { kind: 'loading' } as ViewState },
  );

  protected onMonthChange(event: Event): void {
    this.changePeriod({ ...this.period(), month: Number((event.target as HTMLSelectElement).value) });
  }

  protected onYearChange(event: Event): void {
    this.changePeriod({ ...this.period(), year: Number((event.target as HTMLSelectElement).value) });
  }

  protected retry(): void {
    this.load$.next(this.period());
  }

  protected isCredit(monto: string): boolean {
    return !monto.startsWith('-');
  }

  private changePeriod(period: Period): void {
    this.period.set(period);
    this.load$.next(period);
  }
}

/** Primer y último día del mes, en fecha contable (AAAA-MM-DD). */
export function monthRange({ year, month }: Period): { desde: string; hasta: string } {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, '0');
  return { desde: `${year}-${mm}-01`, hasta: `${year}-${mm}-${String(lastDay).padStart(2, '0')}` };
}

function toLoadedState(response: MovementsResponse): ViewState {
  if (response.movimientos.length === 0) return { kind: 'empty' };
  return {
    kind: 'loaded',
    account: response.cuenta,
    groups: groupByAccountingDay(response.movimientos),
    shown: response.movimientos.length,
    total: response.totalRegistros,
  };
}

function toErrorState(error: unknown): ViewState {
  const apiError = error as Partial<ApiError>;
  switch (apiError.status) {
    case 401:
      return { kind: 'session-expired' };
    case 403:
      return { kind: 'error', message: 'No tienes permiso para consultar esta cuenta.', canRetry: false };
    case 429:
      return {
        kind: 'error',
        message: `Hiciste muchas consultas seguidas. Espera ${apiError.retryAfterSeconds ?? 1} segundos e intenta de nuevo.`,
        canRetry: true,
      };
    case 503:
      return {
        kind: 'error',
        message: 'El sistema del banco no está disponible en este momento. Intenta de nuevo en unos minutos.',
        canRetry: true,
      };
    case 0:
      return { kind: 'error', message: 'No hay conexión con el banco. Revisa tu red e intenta de nuevo.', canRetry: true };
    default:
      return { kind: 'error', message: 'No pudimos cargar los movimientos. Intenta de nuevo.', canRetry: true };
  }
}
