import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { MovementsResponse } from '../../../app/domain/model/movement/movement.model';
import {
  SIMULATED_LATENCY_MS,
  SimulatedBackend,
  simulatedApiInterceptor,
} from '../../../app/infrastructure/mock/simulated-api';
import {
  OCTOBER_2026_TOTAL,
  SAMPLE_MOVEMENTS,
  generateOctoberMovements,
} from '../../../app/infrastructure/mock/simulated-data';

const URL = '/api/v1/cuentas/REC-2231/movimientos';
const OCTOBER = { desde: '2026-10-01', hasta: '2026-10-31' };

describe('simulatedApiInterceptor', () => {
  let http: HttpClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([simulatedApiInterceptor]))],
    });
    http = TestBed.inject(HttpClient);
    TestBed.inject(SimulatedBackend).setMovements(SAMPLE_MOVEMENTS);
  });

  function get(params: Record<string, string | number>, url = URL) {
    let body: MovementsResponse | undefined;
    let error: HttpErrorResponse | undefined;
    http.get<MovementsResponse>(url, { params }).subscribe({
      next: (b) => (body = b),
      error: (e: HttpErrorResponse) => (error = e),
    });
    tick(SIMULATED_LATENCY_MS);
    return { body, error };
  }

  it('returns the sample movements of October by accounting day, newest first', fakeAsync(() => {
    const { body } = get({ ...OCTOBER, limite: 200 });

    expect(body?.totalRegistros).toBe(6);
    expect(body?.movimientos[0].id).toBe('MV-8849999');
    expect(body?.siguiente).toBeNull();
  }));

  it('uses the Colombia accounting day to filter the period', fakeAsync(() => {
    const { body } = get({ desde: '2026-11-01', hasta: '2026-11-30' });
    expect(body?.totalRegistros).toBe(0);
  }));

  it('searches description and reference ignoring case and accents', fakeAsync(() => {
    expect(get({ ...OCTOBER, q: 'NÓMINA' }).body?.movimientos.map((m) => m.id)).toEqual(['MV-8849987']);
    expect(get({ ...OCTOBER, q: 'prv-55' }).body?.movimientos.map((m) => m.id)).toEqual(['MV-8800002']);
  }));

  it('paginates with a cursor bound to the same parameters', fakeAsync(() => {
    const first = get({ ...OCTOBER, limite: 4 }).body;
    expect(first?.movimientos.length).toBe(4);
    expect(first?.siguiente).not.toBeNull();

    const second = get({ ...OCTOBER, limite: 4, cursor: first!.siguiente! }).body;
    expect(second?.movimientos.map((m) => m.id)).toEqual(['MV-8800002', 'MV-8800001']);
    expect(second?.siguiente).toBeNull();

    const mismatch = get({ ...OCTOBER, limite: 4, q: 'pago', cursor: first!.siguiente! }).error;
    expect(mismatch?.status).toBe(400);
  }));

  it('sorts by amount on the server', fakeAsync(() => {
    const ids = get({ ...OCTOBER, orden: 'monto_desc' }).body?.movimientos.map((m) => m.id);
    expect(ids?.[0]).toBe('MV-8849999');
    expect(ids?.[ids.length - 1]).toBe('MV-8849987');
  }));

  it('validates parameters from the contract', fakeAsync(() => {
    expect(get({ ...OCTOBER, q: 'no' }).error?.error.codigo).toBe('PARAMETRO_INVALIDO');
    expect(get({ desde: '2026-10-01', hasta: '2026-11-15' }).error?.status).toBe(400);
    expect(get({ ...OCTOBER, limite: 201 }).error?.status).toBe(400);
    expect(get(OCTOBER, '/api/v1/cuentas/OTRA/movimientos').error?.status).toBe(403);
  }));

  it('generates the 50.000 October movements of REC-2231 by default', fakeAsync(() => {
    TestBed.inject(SimulatedBackend).setMovements(generateOctoberMovements());
    const { body } = get({ ...OCTOBER, limite: 200 });

    expect(body?.totalRegistros).toBe(OCTOBER_2026_TOTAL);
    expect(body?.movimientos.length).toBe(200);
    expect(body?.movimientos[0].id).toBe('MV-8849999');
    expect(new Set(generateOctoberMovements().map((m) => m.id)).size).toBe(OCTOBER_2026_TOTAL);
  }));

  it('answers 429 with Retry-After above 10 requests per second', fakeAsync(() => {
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      http.get(URL, { params: OCTOBER }).subscribe({
        next: () => statuses.push(200),
        error: (e: HttpErrorResponse) => statuses.push(e.status),
      });
    }
    tick(SIMULATED_LATENCY_MS);
    expect(statuses.filter((s) => s === 429).length).toBe(1);
  }));

  it('answers 401 when the session expired', fakeAsync(() => {
    TestBed.inject(SimulatedBackend).expireSession();
    expect(get(OCTOBER).error?.error.codigo).toBe('SESION_EXPIRADA');
  }));

  it('renews the session and requires the CSRF token for transfers', fakeAsync(() => {
    let csrf = '';
    http.post<{ csrfToken: string }>('/api/v1/sesion/renovar', {}).subscribe((r) => (csrf = r.csrfToken));
    tick(SIMULATED_LATENCY_MS);
    expect(csrf).not.toBe('');

    const body = {
      cuentaOrigenId: 'REC-2231', bancoDestino: '0002', tipoCuenta: 'AHORROS',
      numeroCuenta: '0045987123', tipoDocumento: 'CC', numeroDocumento: '1020304050', monto: '150000.00',
    };
    const key = crypto.randomUUID();
    const send = (headers: Record<string, string>, payload: object = body) => {
      let status = 0;
      let response: { id?: string; numeroCuentaEnmascarado?: string } = {};
      http.post('/api/v1/transferencias', payload, { headers, observe: 'response' }).subscribe({
        next: (r) => ((status = r.status), (response = r.body as typeof response)),
        error: (e: HttpErrorResponse) => (status = e.status),
      });
      tick(SIMULATED_LATENCY_MS);
      return { status, response };
    };

    expect(send({ 'Idempotency-Key': key }).status).toBe(403);

    const created = send({ 'X-CSRF-Token': csrf, 'Idempotency-Key': key });
    expect(created.status).toBe(201);
    expect(created.response.numeroCuentaEnmascarado).toBe('XXXX7123');

    const repeated = send({ 'X-CSRF-Token': csrf, 'Idempotency-Key': key });
    expect(repeated.response.id).toBe(created.response.id);

    const otherBody = send({ 'X-CSRF-Token': csrf, 'Idempotency-Key': key }, { ...body, monto: '1.00' });
    expect(otherBody.status).toBe(409);
  }));
});
