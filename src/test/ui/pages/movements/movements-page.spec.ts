import { registerLocaleData } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';
import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { Movement, MovementsResponse } from '../../../../app/domain/model/movement/movement.model';
import { ApiError } from '../../../../app/domain/model/shared/api-error.model';
import { MovementPort } from '../../../../app/domain/ports/movement/movement.port';
import { SAMPLE_ACCOUNT, SAMPLE_MOVEMENTS } from '../../../../app/infrastructure/mock/simulated-data';
import { MovementsPage } from '../../../../app/ui/pages/movements/movements-page';
import { expectNoAccessibilityViolations } from '../../../support/axe';

registerLocaleData(localeEsCo);

const response = (movimientos: Movement[]): MovementsResponse => ({
  cuenta: SAMPLE_ACCOUNT,
  totalRegistros: movimientos.length,
  movimientos,
  siguiente: null,
});

const apiError = (status: number, codigo: string): ApiError => ({ status, codigo, mensaje: '' });

/** Intl usa espacios especiales (U+00A0); se normalizan para comparar textos. */
const normalize = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();

describe('MovementsPage', () => {
  let getMovements: jasmine.Spy;

  beforeEach(() => {
    getMovements = jasmine.createSpy('getMovements');
    TestBed.configureTestingModule({
      imports: [MovementsPage],
      providers: [
        { provide: MovementPort, useValue: { getMovements } },
        { provide: LOCALE_ID, useValue: 'es-CO' },
      ],
    });
  });

  function render(): { fixture: ComponentFixture<MovementsPage>; el: HTMLElement } {
    const fixture = TestBed.createComponent(MovementsPage);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('requests October 2026 by default', () => {
    getMovements.and.returnValue(new Subject<MovementsResponse>());
    render();

    expect(getMovements).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({ accountId: 'REC-2231', desde: '2026-10-01', hasta: '2026-10-31', limite: 200 }),
    );
  });

  it('shows the loading state while the request is pending', () => {
    getMovements.and.returnValue(new Subject<MovementsResponse>());
    const { el } = render();

    expect(normalize(el.querySelector('[role="status"]')?.textContent)).toBe('Cargando movimientos…');
  });

  it('shows the empty state when the period has no movements', () => {
    getMovements.and.returnValue(of(response([])));
    const { el } = render();

    expect(normalize(el.querySelector('[role="status"]')?.textContent)).toBe('No hay movimientos en este periodo.');
    expect(el.querySelectorAll('li').length).toBe(0);
  });

  it('groups the sample movements by Colombia accounting day with a header per day', () => {
    getMovements.and.returnValue(of(response(SAMPLE_MOVEMENTS)));
    const { el } = render();

    const headers = Array.from(el.querySelectorAll('h2')).map((h) => normalize(h.textContent));
    expect(headers.length).toBe(3);
    expect(headers[0]).toContain('31 de octubre de 2026');
    expect(headers[1]).toContain('14 de octubre de 2026');
    expect(headers[2]).toContain('1 de octubre de 2026');

    const days = el.querySelectorAll('section.day');
    expect(Array.from(days).map((d) => d.querySelectorAll('li').length)).toEqual([3, 1, 2]);
  });

  it('shows time, description, reference, signed amount and in-process mark on each row', () => {
    getMovements.and.returnValue(of(response(SAMPLE_MOVEMENTS)));
    const { el } = render();
    const rows = Array.from(el.querySelectorAll('li')).map((li) => normalize(li.textContent));

    expect(rows[0]).toContain('23:30');
    expect(rows[0]).toContain('Recaudo PSE factura 10-9902');
    expect(rows[0]).toContain('10-9902');
    expect(rows[0]).toContain('En proceso');
    expect(rows[0]).toContain('+$ 3.999.999,99');
    expect(rows[2]).toContain('-$ 48.730.500,50');
    expect(rows[2]).not.toContain('En proceso');
    expect(rows[3]).toContain('Sin referencia');
  });

  it('shows an error with retry and recovers on retry', () => {
    getMovements.and.returnValues(
      throwError(() => apiError(503, 'CORE_NO_DISPONIBLE')),
      of(response(SAMPLE_MOVEMENTS)),
    );
    const { fixture, el } = render();

    expect(normalize(el.querySelector('[role="alert"]')?.textContent)).toContain('no está disponible');
    const retry = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Reintentar'));
    expect(retry).toBeDefined();

    retry!.click();
    fixture.detectChanges();

    expect(getMovements).toHaveBeenCalledTimes(2);
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(el.querySelectorAll('section.day').length).toBe(3);
  });

  it('shows an expired session distinctly, not as a generic error', () => {
    getMovements.and.returnValue(throwError(() => apiError(401, 'SESION_EXPIRADA')));
    const { el } = render();
    const alert = normalize(el.querySelector('[role="alert"]')?.textContent);

    expect(alert).toContain('Tu sesión venció');
    expect(alert).not.toContain('No pudimos cargar');
    expect(el.querySelector('button')).toBeNull();
  });

  it('reloads the movements when the period changes', () => {
    getMovements.and.returnValue(of(response([])));
    const { fixture, el } = render();

    const month = el.querySelector<HTMLSelectElement>('#period-month')!;
    month.value = '9';
    month.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(getMovements).toHaveBeenCalledWith(
      jasmine.objectContaining({ desde: '2026-09-01', hasta: '2026-09-30' }),
    );
  });
  it('has no WCAG 2.2 AA violations with the sample movements', async () => {
    getMovements.and.returnValue(of(response(SAMPLE_MOVEMENTS)));
    const { el } = render();
    await expectNoAccessibilityViolations(el);
  });
});
