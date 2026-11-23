import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CsrfTokenStore } from '../../../app/application/session/csrf-token.store';
import { csrfInterceptor } from '../../../app/infrastructure/http/csrf.interceptor';

describe('csrfInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([csrfInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    TestBed.inject(CsrfTokenStore).set('abc');
  });

  afterEach(() => httpMock.verify());

  it('adds the token to data-changing requests to the own API', () => {
    http.post('/api/v1/transferencias', {}).subscribe();
    expect(httpMock.expectOne('/api/v1/transferencias').request.headers.get('X-CSRF-Token')).toBe('abc');
  });

  it('does not add the token to reads or to other domains', () => {
    http.get('/api/v1/cuentas/REC-2231/movimientos').subscribe();
    http.post('https://otro-dominio.example/api', {}).subscribe();

    expect(httpMock.expectOne('/api/v1/cuentas/REC-2231/movimientos').request.headers.has('X-CSRF-Token')).toBeFalse();
    expect(httpMock.expectOne('https://otro-dominio.example/api').request.headers.has('X-CSRF-Token')).toBeFalse();
  });
});
