import {
  HttpErrorResponse,
  HttpEvent,
  HttpHeaders,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Observable, delay, mergeMap, of, throwError, timer } from 'rxjs';
import { toColombiaDayAndTime } from '../../application/movement/list-movements.use-case';
import { Movement, MovementOrder } from '../../domain/model/movement/movement.model';
import { SAMPLE_ACCOUNT, SAMPLE_MOVEMENTS } from './simulated-data';


export const SIMULATED_LATENCY_MS = 300;
const SLOW_LATENCY_MS = 3000;
const SESSION_DURATION_MS = 5 * 60 * 1000;
const MAX_REQUESTS_PER_SECOND = 10;
const MAX_PERIOD_DAYS = 31;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const PER_TRANSFER_LIMIT_CENTS = 50_000_000_00;
const DAILY_LIMIT_CENTS = 100_000_000_00;
const DYNAMIC_KEY_THRESHOLD_CENTS = 2_000_000_00;
const BANK_CODES = ['0001', '0002', '0003', '0004', '0005', '0006'];
const ORDERS: MovementOrder[] = ['fecha_desc', 'fecha_asc', 'monto_desc', 'monto_asc'];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Escenarios para ver los estados a mano: /movimientos?escenario=error|sesion|vacio|lento */
type Scenario = 'normal' | 'error' | 'sesion' | 'vacio' | 'lento';
const SCENARIOS: Scenario[] = ['normal', 'error', 'sesion', 'vacio', 'lento'];

interface SimulatedResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

type TransferField =
  | 'cuentaOrigenId'
  | 'bancoDestino'
  | 'tipoCuenta'
  | 'numeroCuenta'
  | 'tipoDocumento'
  | 'numeroDocumento'
  | 'monto'
  | 'descripcion'
  | 'claveDinamica';
type TransferBody = Partial<Record<TransferField, unknown>>;

@Injectable({ providedIn: 'root' })
export class SimulatedBackend {
  movements: Movement[] = SAMPLE_MOVEMENTS;
  private sessionExpiresAt = Date.now() + SESSION_DURATION_MS;
  private csrfToken: string | null = null;
  private recentRequests: number[] = [];
  private dailyTransferredCents = 0;
  private transferCount = 0;
  private readonly idempotency = new Map<string, { body: string; response: SimulatedResponse }>();

  handle(req: HttpRequest<unknown>, scenario: Scenario = 'normal'): SimulatedResponse {
    const now = Date.now();
    this.recentRequests = this.recentRequests.filter((t) => now - t < 1000);
    if (this.recentRequests.length >= MAX_REQUESTS_PER_SECOND) {
      return apiError(429, 'LIMITE_DE_PETICIONES', 'Demasiadas peticiones', { 'Retry-After': '1' });
    }
    this.recentRequests.push(now);

    if (req.method === 'POST' && req.url === '/api/v1/sesion/renovar') {
      return this.renewSession(now);
    }
    if (now >= this.sessionExpiresAt) {
      return apiError(401, 'SESION_EXPIRADA', 'La sesión expiró');
    }
    const movementsRoute = /^\/api\/v1\/cuentas\/([^/]+)\/movimientos$/.exec(req.url);
    if (req.method === 'GET' && movementsRoute) {
      return this.listMovements(decodeURIComponent(movementsRoute[1]), req, scenario);
    }
    if (req.method === 'POST' && req.url === '/api/v1/transferencias') {
      return this.createTransfer(req, now);
    }
    return apiError(404, 'NO_ENCONTRADO', 'Recurso no encontrado');
  }

  /** Solo para pruebas: fuerza el vencimiento de la sesión. */
  expireSession(): void {
    this.sessionExpiresAt = 0;
  }

  private renewSession(now: number): SimulatedResponse {
    if (now >= this.sessionExpiresAt) {
      return apiError(401, 'SESION_EXPIRADA', 'La sesión expiró');
    }
    this.sessionExpiresAt = now + SESSION_DURATION_MS;
    this.csrfToken = crypto.randomUUID();
    return {
      status: 200,
      body: { expiraEn: new Date(this.sessionExpiresAt).toISOString(), csrfToken: this.csrfToken },
    };
  }

  private listMovements(
    accountId: string,
    req: HttpRequest<unknown>,
    scenario: Scenario,
  ): SimulatedResponse {
    if (scenario === 'sesion') return apiError(401, 'SESION_EXPIRADA', 'La sesión expiró');
    if (scenario === 'error') return apiError(503, 'CORE_NO_DISPONIBLE', 'Core no disponible');
    if (accountId !== SAMPLE_ACCOUNT.id) return apiError(403, 'SIN_PERMISO', 'Sin permiso');

    const params = req.params;
    const desde = params.get('desde');
    const hasta = params.get('hasta');
    if (!isDate(desde) || !isDate(hasta)) return invalidParameter('Fechas inválidas');
    const days = (Date.parse(hasta) - Date.parse(desde)) / DAY_MS + 1;
    if (days < 1 || days > MAX_PERIOD_DAYS) return invalidParameter('Periodo inválido');

    const q = params.get('q');
    if (q !== null && q.trim().length < 3) return invalidParameter('Búsqueda muy corta');

    const orden = (params.get('orden') ?? 'fecha_desc') as MovementOrder;
    if (!ORDERS.includes(orden)) return invalidParameter('Orden inválido');

    const rawLimit = params.get('limite');
    const limite = rawLimit === null ? DEFAULT_LIMIT : Number(rawLimit);
    if (!Number.isInteger(limite) || limite < 1 || limite > MAX_LIMIT) {
      return invalidParameter('Límite inválido');
    }

    // El cursor solo vale con los mismos parámetros que lo generaron (contrato).
    const fingerprint = hash([accountId, desde, hasta, q ?? '', orden, limite].join('|'));
    let offset = 0;
    const cursor = params.get('cursor');
    if (cursor !== null) {
      const match = /^c-(\d+)-([a-z0-9]+)$/.exec(cursor);
      if (!match || match[2] !== fingerprint) return invalidParameter('Cursor inválido');
      offset = Number(match[1]);
    }

    const term = q ? normalizeText(q) : null;
    const filtered =
      scenario === 'vacio'
        ? []
        : this.movements.filter((movement) => {
            const { day } = toColombiaDayAndTime(movement.fechaHora);
            if (day < desde || day > hasta) return false;
            if (!term) return true;
            return (
              normalizeText(movement.descripcion).includes(term) ||
              (movement.referencia !== null && normalizeText(movement.referencia).includes(term))
            );
          });
    const sorted = [...filtered].sort(comparatorFor(orden));
    const nextOffset = offset + limite;

    return {
      status: 200,
      body: {
        cuenta: SAMPLE_ACCOUNT,
        totalRegistros: sorted.length,
        movimientos: sorted.slice(offset, nextOffset),
        siguiente: nextOffset < sorted.length ? `c-${nextOffset}-${fingerprint}` : null,
      },
    };
  }

  private createTransfer(req: HttpRequest<unknown>, now: number): SimulatedResponse {
    if (!this.csrfToken || req.headers.get('X-CSRF-Token') !== this.csrfToken) {
      return apiError(403, 'SIN_PERMISO', 'Token CSRF inválido');
    }
    const key = req.headers.get('Idempotency-Key');
    if (!key || !UUID_PATTERN.test(key)) {
      return validationError([{ campo: 'Idempotency-Key', codigo: 'INVALIDO' }]);
    }

    // Misma clave y mismo cuerpo: se repite el 201 original. Misma clave y otro cuerpo: 409.
    const bodyText = JSON.stringify(req.body);
    const previous = this.idempotency.get(key);
    if (previous) {
      return previous.body === bodyText
        ? previous.response
        : apiError(409, 'TRANSFERENCIA_DUPLICADA', 'Transferencia duplicada');
    }

    const body = (req.body ?? {}) as TransferBody;
    const fieldErrors = validateTransfer(body);
    if (fieldErrors.length > 0) return validationError(fieldErrors);

    const cents = toCents(body.monto as string);
    if (cents > PER_TRANSFER_LIMIT_CENTS) {
      return apiError(422, 'TOPE_TRANSACCION_EXCEDIDO', 'Supera el tope por transferencia');
    }
    if (this.dailyTransferredCents + cents > DAILY_LIMIT_CENTS) {
      return apiError(422, 'TOPE_DIARIO_EXCEDIDO', 'Supera el tope diario');
    }
    // Simulación: la clave 000000 representa una clave vencida o incorrecta.
    if (cents >= DYNAMIC_KEY_THRESHOLD_CENTS && body.claveDinamica === '000000') {
      return apiError(422, 'CLAVE_DINAMICA_INVALIDA', 'Clave dinámica inválida');
    }

    this.dailyTransferredCents += cents;
    this.transferCount += 1;
    const accountNumber = body.numeroCuenta as string;
    const response: SimulatedResponse = {
      status: 201,
      body: {
        id: `TR-${String(this.transferCount).padStart(6, '0')}`,
        estado: body.bancoDestino === '0001' ? 'APLICADA' : 'EN_PROCESO',
        fechaHora: new Date(now).toISOString(),
        numeroCuentaEnmascarado: `XXXX${accountNumber.slice(-4)}`,
        comprobante: `CMP-${now.toString(36).toUpperCase()}`,
      },
    };
    this.idempotency.set(key, { body: bodyText, response });
    return response;
  }
}

export const simulatedApiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/v1/')) return next(req);
  const backend = inject(SimulatedBackend);
  const scenario = readScenario(inject(DOCUMENT));
  const result = backend.handle(req, scenario);
  const latency = scenario === 'lento' ? SLOW_LATENCY_MS : SIMULATED_LATENCY_MS;
  return toHttpEvent(result, req.urlWithParams, latency);
};

function toHttpEvent(
  result: SimulatedResponse,
  url: string,
  latency: number,
): Observable<HttpEvent<unknown>> {
  const headers = new HttpHeaders(result.headers ?? {});
  if (result.status < 400) {
    return of(new HttpResponse({ status: result.status, body: result.body, headers, url })).pipe(
      delay(latency),
    );
  }
  return timer(latency).pipe(
    mergeMap(() =>
      throwError(
        () => new HttpErrorResponse({ status: result.status, error: result.body, headers, url }),
      ),
    ),
  );
}

function readScenario(doc: Document): Scenario {
  const value = new URLSearchParams(doc.location?.search ?? '').get('escenario');
  return SCENARIOS.includes(value as Scenario) ? (value as Scenario) : 'normal';
}

function apiError(
  status: number,
  codigo: string,
  mensaje: string,
  headers?: Record<string, string>,
): SimulatedResponse {
  return { status, body: { codigo, mensaje }, headers };
}

function invalidParameter(mensaje: string): SimulatedResponse {
  return apiError(400, 'PARAMETRO_INVALIDO', mensaje);
}

function validationError(errores: { campo: string; codigo: string }[]): SimulatedResponse {
  return { status: 400, body: { codigo: 'VALIDACION', mensaje: 'Datos inválidos', errores } };
}

function validateTransfer(body: TransferBody): { campo: string; codigo: string }[] {
  const errors: { campo: string; codigo: string }[] = [];
  const check = (campo: TransferField, valid: boolean) => {
    if (!valid) errors.push({ campo, codigo: body[campo] == null ? 'REQUERIDO' : 'FORMATO' });
  };
  const text = (campo: TransferField): string => {
    const value = body[campo];
    return typeof value === 'string' ? value : '';
  };

  check('cuentaOrigenId', text('cuentaOrigenId') === SAMPLE_ACCOUNT.id);
  check('bancoDestino', BANK_CODES.includes(text('bancoDestino')));
  check('tipoCuenta', ['AHORROS', 'CORRIENTE'].includes(text('tipoCuenta')));
  check('numeroCuenta', /^\d{6,17}$/.test(text('numeroCuenta')));
  const documentPatterns: Record<string, RegExp> = {
    CC: /^\d{6,10}$/,
    CE: /^\d{6,10}$/,
    NIT: /^\d{9}$/,
    PA: /^[A-Za-z0-9]{5,12}$/,
  };
  const documentPattern = documentPatterns[text('tipoDocumento')];
  check('tipoDocumento', documentPattern !== undefined);
  check('numeroDocumento', documentPattern?.test(text('numeroDocumento')) ?? false);

  const monto = text('monto');
  const validAmount = /^\d+(\.\d{1,2})?$/.test(monto) && toCents(monto) > 0;
  check('monto', validAmount);
  if (body.descripcion !== undefined) {
    check('descripcion', /^[\p{L}\p{N} ]{0,40}$/u.test(text('descripcion')));
  }
  if (validAmount && toCents(monto) >= DYNAMIC_KEY_THRESHOLD_CENTS) {
    check('claveDinamica', /^\d{6}$/.test(text('claveDinamica')));
  }
  return errors;
}

function isDate(value: string | null): value is string {
  return value !== null && DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(value));
}

/** Minúsculas y sin tildes: el contrato busca "sin distinguir mayúsculas ni tildes". */
function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** Centavos enteros para comparar montos sin errores de punto flotante. */
function toCents(amount: string): number {
  const negative = amount.startsWith('-');
  const [integerPart, decimalPart = ''] = (negative ? amount.slice(1) : amount).split('.');
  const value = Number(integerPart) * 100 + Number(decimalPart.padEnd(2, '0'));
  return negative ? -value : value;
}

function compare(a: string | number, b: string | number): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function comparatorFor(orden: MovementOrder): (a: Movement, b: Movement) => number {
  switch (orden) {
    case 'fecha_asc':
      return (a, b) => compare(a.fechaHora, b.fechaHora) || compare(a.id, b.id);
    case 'monto_desc':
      return (a, b) => compare(toCents(b.monto), toCents(a.monto)) || compare(b.id, a.id);
    case 'monto_asc':
      return (a, b) => compare(toCents(a.monto), toCents(b.monto)) || compare(a.id, b.id);
    default:
      return (a, b) => compare(b.fechaHora, a.fechaHora) || compare(b.id, a.id);
  }
}

function hash(value: string): string {
  let result = 0;
  for (let i = 0; i < value.length; i++) {
    result = (result * 31 + value.charCodeAt(i)) | 0;
  }
  return (result >>> 0).toString(36);
}
