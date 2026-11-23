import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { CsrfTokenStore } from '../../../app/application/session/csrf-token.store';
import { SessionKeeper } from '../../../app/application/session/session-keeper';
import { SessionPort } from '../../../app/domain/ports/session/session.port';

const FIVE_MINUTES = 5 * 60 * 1000;

describe('SessionKeeper', () => {
  let renew: jasmine.Spy;
  let keeper: SessionKeeper;
  let csrf: CsrfTokenStore;
  let tokenCount: number;

  beforeEach(() => {
    tokenCount = 0;
    renew = jasmine.createSpy('renew').and.callFake(() =>
      of({ expiraEn: new Date(Date.now() + FIVE_MINUTES).toISOString(), csrfToken: `token-${++tokenCount}` }),
    );
    TestBed.configureTestingModule({ providers: [{ provide: SessionPort, useValue: { renew } }] });
    keeper = TestBed.inject(SessionKeeper);
    csrf = TestBed.inject(CsrfTokenStore);
  });

  afterEach(() => keeper.stop());

  it('renews on start and keeps the CSRF token only in memory', fakeAsync(() => {
    keeper.start();

    expect(renew).toHaveBeenCalledTimes(1);
    expect(keeper.status()).toBe('active');
    expect(csrf.token()).toBe('token-1');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    keeper.stop();
  }));

  it('renews silently before expiry while the treasurer is active', fakeAsync(() => {
    keeper.start();
    tick(60_000);
    keeper.recordActivity(); // El tesorero escribe en el formulario.
    tick(FIVE_MINUTES - 60_000 - 2 * 60_000 + 1000);

    expect(renew).toHaveBeenCalledTimes(2);
    expect(csrf.token()).toBe('token-2');
    expect(keeper.status()).toBe('active');
    keeper.stop();
  }));

  it('warns when idle, and lets the treasurer stay connected', fakeAsync(() => {
    keeper.start();
    tick(FIVE_MINUTES - 60_000 + 1000);

    expect(keeper.status()).toBe('warning');
    expect(keeper.secondsLeft()).toBeLessThanOrEqual(60);
    expect(renew).toHaveBeenCalledTimes(1);

    keeper.recordActivity();
    expect(renew).toHaveBeenCalledTimes(2);
    expect(keeper.status()).toBe('active');
    keeper.stop();
  }));

  it('expires on an unattended computer and clears the CSRF token', fakeAsync(() => {
    keeper.start();
    tick(FIVE_MINUTES + 1000);

    expect(keeper.status()).toBe('expired');
    expect(csrf.token()).toBeNull();
    keeper.stop();
  }));

  it('renews before a data-changing operation when the session is about to expire', fakeAsync(() => {
    keeper.start();
    keeper.ensureFresh().subscribe();
    expect(renew).toHaveBeenCalledTimes(1);

    tick(FIVE_MINUTES - 30_000);
    keeper.ensureFresh().subscribe();
    expect(renew).toHaveBeenCalledTimes(2);
    keeper.stop();
  }));

  it('marks the session as expired when the server answers 401', fakeAsync(() => {
    renew.and.returnValue(throwError(() => ({ status: 401, codigo: 'SESION_EXPIRADA', mensaje: '' })));
    keeper.start();

    expect(keeper.status()).toBe('expired');
    keeper.stop();
  }));
});
