import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../../../app/domain/model/shared/api-error.model';
import { TransferRequest } from '../../../../app/domain/model/transfer/transfer.model';
import { TransferHttpAdapter } from '../../../../app/infrastructure/adapters/transfer/transfer-http.adapter';

const REQUEST: TransferRequest = {
  cuentaOrigenId: 'REC-2231',
  bancoDestino: '0002',
  tipoCuenta: 'AHORROS',
  numeroCuenta: '0045987123',
  tipoDocumento: 'CC',
  numeroDocumento: '1020304050',
  monto: '150000.00',
};

describe('TransferHttpAdapter', () => {
  let adapter: TransferHttpAdapter;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TransferHttpAdapter, provideHttpClient(), provideHttpClientTesting()],
    });
    adapter = TestBed.inject(TransferHttpAdapter);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('posts the contract body with the Idempotency-Key header', () => {
    adapter.create(REQUEST, '3f1c1a2e-1111-4222-8333-944455556666').subscribe();

    const req = httpMock.expectOne('/api/v1/transferencias');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(REQUEST);
    expect(req.request.headers.get('Idempotency-Key')).toBe('3f1c1a2e-1111-4222-8333-944455556666');
    req.flush({});
  });

  it('maps field validation errors from the API', () => {
    let received: ApiError | undefined;
    adapter.create(REQUEST, 'k').subscribe({ error: (e: ApiError) => (received = e) });

    httpMock.expectOne('/api/v1/transferencias').flush(
      { codigo: 'VALIDACION', mensaje: 'Datos inválidos', errores: [{ campo: 'numeroCuenta', codigo: 'FORMATO' }] },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(received?.status).toBe(400);
    expect(received?.errores).toEqual([{ campo: 'numeroCuenta', codigo: 'FORMATO' }]);
  });
});
