import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { App } from '../app/app';
import { SessionKeeper } from '../app/application/session/session-keeper';
import { SessionPort } from '../app/domain/ports/session/session.port';

describe('App', () => {
  beforeEach(() => {
    const renew = () => of({ expiraEn: new Date(Date.now() + 5 * 60 * 1000).toISOString(), csrfToken: 't' });
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), { provide: SessionPort, useValue: { renew } }],
    });
  });

  afterEach(() => TestBed.inject(SessionKeeper).stop());

  it('renders the main navigation and the content landmark', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const links = Array.from(el.querySelectorAll('nav[aria-label="Principal"] a')).map((a) => a.textContent);

    expect(links).toEqual(['Movimientos', 'Nueva transferencia']);
    expect(el.querySelector('main#contenido')).not.toBeNull();
  });

  it('warns before the session expires and lets the treasurer stay connected', () => {
    const fixture = TestBed.createComponent(App);
    const keeper = TestBed.inject(SessionKeeper);
    keeper.status.set('warning');
    keeper.secondsLeft.set(45);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('45 segundos');
    el.querySelector<HTMLButtonElement>('.session-banner button')!.click();
    fixture.detectChanges();
    expect(keeper.status()).toBe('active');
  });
});
