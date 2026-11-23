import { ScrollingModule } from '@angular/cdk/scrolling';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject,
  EMPTY,
  Observable,
  Subject,
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  exhaustMap,
  map,
  of,
  startWith,
  switchMap,
} from 'rxjs';
import {
  ListMovementsUseCase,
  MIN_SEARCH_LENGTH,
  toRows,
} from '../../../application/movement/list-movements.use-case';
import {
  Account,
  MovementOrder,
  MovementRow,
  MovementsQuery,
  MovementsResponse,
} from '../../../domain/model/movement/movement.model';
import { ApiError } from '../../../domain/model/shared/api-error.model';
import { CURRENT_ACCOUNT_ID } from '../../../domain/model/shared/current-account';

/** Máximo del contrato: menos viajes de red para recorrer 50.000 movimientos. */
export const PAGE_SIZE = 200;
/** Espera tras la última tecla antes de buscar: "n", "no", "nom"... no generan peticiones. */
export const SEARCH_DEBOUNCE_MS = 300;
/** Alto fijo de fila: la lista virtual calcula qué filas dibujar sin medir el DOM. */
export const ROW_HEIGHT_PX = 56;
/** Se pide la página siguiente cuando faltan menos de estas filas por ver. */
const LOAD_MORE_THRESHOLD_ROWS = 60;

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

interface Period {
  year: number;
  month: number;
}

interface LoadedState {
  kind: 'loaded';
  account: Account;
  rows: MovementRow[];
  lastDay: string | null;
  next: string | null;
  loaded: number;
  total: number;
  grouped: boolean;
  search: string;
  loadingMore: boolean;
  loadMoreError: string | null;
}

type ViewState =
  | { kind: 'loading' }
  | { kind: 'empty'; search: string }
  | LoadedState
  | { kind: 'error'; message: string; canRetry: boolean }
  | { kind: 'session-expired' };

@Component({
  selector: 'app-movements-page',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, ScrollingModule],
  templateUrl: './movements-page.html',
  styleUrl: './movements-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovementsPage {
  private readonly listMovements = inject(ListMovementsUseCase);

  protected readonly months = MONTHS;
  protected readonly years = [2025, 2026];
  protected readonly rowHeight = ROW_HEIGHT_PX;
  protected readonly minSearchLength = MIN_SEARCH_LENGTH;
  protected readonly orders: { value: MovementOrder; label: string }[] = [
    { value: 'fecha_desc', label: 'Fecha: más reciente primero' },
    { value: 'fecha_asc', label: 'Fecha: más antigua primero' },
    { value: 'monto_desc', label: 'Monto: mayor primero' },
    { value: 'monto_asc', label: 'Monto: menor primero' },
  ];

  protected readonly period = signal<Period>({ year: 2026, month: 10 });
  protected readonly order = signal<MovementOrder>('fecha_desc');
  protected readonly searchText = signal('');

  private readonly period$ = new BehaviorSubject<Period>(this.period());
  private readonly order$ = new BehaviorSubject<MovementOrder>(this.order());
  private readonly searchInput$ = new Subject<string>();
  private readonly retry$ = new BehaviorSubject<void>(undefined);
  private readonly loadMore$ = new Subject<void>();

  /** Búsqueda efectiva: mínimo 3 caracteres, tras 300 ms sin escribir y solo si cambió. */
  private readonly search$ = this.searchInput$.pipe(
    map((value) => value.trim()),
    map((value) => (value.length >= MIN_SEARCH_LENGTH ? value : '')),
    debounceTime(SEARCH_DEBOUNCE_MS),
    startWith(''),
    distinctUntilChanged(),
  );

  /**
   * Cualquier cambio de periodo, búsqueda u orden inicia una consulta nueva. switchMap cancela la
   * anterior y sus páginas: una respuesta vieja nunca pisa a la nueva (causa del INC-2026-1187).
   */
  protected readonly state = toSignal(
    combineLatest([this.period$, this.search$, this.order$, this.retry$]).pipe(
      switchMap(([period, search, orden]) =>
        this.loadQuery({
          accountId: CURRENT_ACCOUNT_ID,
          ...monthRange(period),
          q: search || undefined,
          orden,
          limite: PAGE_SIZE,
        }),
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

  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchText.set(value);
    this.searchInput$.next(value);
  }

  protected onOrderChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as MovementOrder;
    this.order.set(value);
    this.order$.next(value);
  }

  protected retry(): void {
    this.retry$.next();
  }

  protected loadMore(): void {
    this.loadMore$.next();
  }

  /** Solo cuando el tesorero se desplaza (índice > 0), no al dibujar la lista por primera vez. */
  protected onScrolledIndex(firstVisibleIndex: number, totalRows: number): void {
    if (firstVisibleIndex > 0 && firstVisibleIndex + LOAD_MORE_THRESHOLD_ROWS >= totalRows) {
      this.loadMore();
    }
  }

  protected showSearchHint(): boolean {
    const length = this.searchText().trim().length;
    return length > 0 && length < MIN_SEARCH_LENGTH;
  }

  protected isCredit(monto: string): boolean {
    return !monto.startsWith('-');
  }

  protected trackRow(_index: number, row: MovementRow): string {
    return row.id;
  }

  private changePeriod(period: Period): void {
    this.period.set(period);
    this.period$.next(period);
  }

  /** Primera página y, a pedido, las siguientes. exhaustMap: una página a la vez. */
  private loadQuery(query: MovementsQuery): Observable<ViewState> {
    const grouped = query.orden === 'fecha_desc' || query.orden === 'fecha_asc';
    const search = query.q ?? '';

    return this.listMovements.execute(query).pipe(
      switchMap((first) => {
        if (first.movimientos.length === 0) return of<ViewState>({ kind: 'empty', search });
        let page = firstPage(first, grouped, search);
        return this.loadMore$.pipe(
          exhaustMap(() => {
            if (page.next === null) return EMPTY;
            return this.listMovements.execute({ ...query, cursor: page.next }).pipe(
              map((response): ViewState => (page = appendPage(page, response))),
              startWith<ViewState>({ ...page, loadingMore: true, loadMoreError: null }),
              catchError((error: unknown) =>
                of<ViewState>(
                  (error as Partial<ApiError>).status === 401
                    ? { kind: 'session-expired' }
                    : { ...page, loadMoreError: 'No pudimos cargar más movimientos.' },
                ),
              ),
            );
          }),
          startWith<ViewState>(page),
        );
      }),
      startWith<ViewState>({ kind: 'loading' }),
      catchError((error: unknown) => of(toErrorState(error))),
    );
  }
}

/** Primer y último día del mes, en fecha contable (AAAA-MM-DD). */
export function monthRange({ year, month }: Period): { desde: string; hasta: string } {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, '0');
  return { desde: `${year}-${mm}-01`, hasta: `${year}-${mm}-${String(lastDay).padStart(2, '0')}` };
}

function firstPage(response: MovementsResponse, grouped: boolean, search: string): LoadedState {
  const { rows, lastDay } = toRows(response.movimientos, null, grouped);
  return {
    kind: 'loaded',
    account: response.cuenta,
    rows,
    lastDay,
    next: response.siguiente,
    loaded: response.movimientos.length,
    total: response.totalRegistros,
    grouped,
    search,
    loadingMore: false,
    loadMoreError: null,
  };
}

function appendPage(page: LoadedState, response: MovementsResponse): LoadedState {
  const { rows, lastDay } = toRows(response.movimientos, page.lastDay, page.grouped);
  return {
    ...page,
    rows: page.rows.concat(rows),
    lastDay,
    next: response.siguiente,
    loaded: page.loaded + response.movimientos.length,
    total: response.totalRegistros,
    loadingMore: false,
    loadMoreError: null,
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
