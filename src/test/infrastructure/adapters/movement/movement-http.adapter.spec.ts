import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiError } from '../../../../app/domain/model/shared/api-error.model';
import { MovementHttpAdapter } from '../../../../app/infrastructure/adapters/movement/movement-http.adapter';

describe('MovementHttpAdapter', () => {
  let adapter: MovementHttpAdapter;
  let httpMock: HttpTestingController;
  const query = { accountId: 'REC-2231', desde: '2026-10-01', hasta: '2026-10-31', limite: 200 };
  const url = '/api/v1/cuentas/REC-2231/movimientos';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MovementHttpAdapter, provideHttpClient(), provideHttpClientTesting()],
    });
    adapter = TestBed.inject(MovementHttpAdapter);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('calls the contract URL sending only the provided params', () => {
    adapter.getMovements(query).subscribe();

    const req = httpMock.expectOne((r) => r.url === url);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('desde')).toBe('2026-10-01');
    expect(req.request.params.get('hasta')).toBe('2026-10-31');
    expect(req.request.params.get('limite')).toBe('200');
    expect(req.request.params.has('q')).toBeFalse();
    expect(req.request.params.has('cursor')).toBeFalse();

    req.flush({ cuenta: null, totalRegistros: 0, movimientos: [], siguiente: null });
  });

  it('maps HTTP errors to the contract error shape', () => {
    let received: ApiError | undefined;
    adapter.getMovements(query).subscribe({ error: (e: ApiError) => (received = e) });

    httpMock
      .expectOne((r) => r.url === url)
      .flush(
        { codigo: 'LIMITE_DE_PETICIONES', mensaje: 'Demasiadas peticiones' },
        { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '3' } },
      );

    expect(received).toEqual({
      status: 429,
      codigo: 'LIMITE_DE_PETICIONES',
      mensaje: 'Demasiadas peticiones',
      errores: undefined,
      retryAfterSeconds: 3,
    });
  });
});
