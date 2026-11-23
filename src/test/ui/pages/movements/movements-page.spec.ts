import { registerLocaleData } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';
import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, flush, tick } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { Movement, MovementsResponse } from '../../../../app/domain/model/movement/movement.model';
import { ApiError } from '../../../../app/domain/model/shared/api-error.model';
import { MovementPort } from '../../../../app/domain/ports/movement/movement.port';
import { SAMPLE_ACCOUNT, SAMPLE_MOVEMENTS } from '../../../../app/infrastructure/mock/simulated-data';
import { MovementsPage, SEARCH_DEBOUNCE_MS } from '../../../../app/ui/pages/movements/movements-page';
import { expectNoAccessibilityViolations } from '../../../support/axe';

registerLocaleData(localeEsCo);

const response = (movimientos: Movement[], extra: Partial<MovementsResponse> = {}): MovementsResponse => ({
  cuenta: SAMPLE_ACCOUNT,
  totalRegistros: movimientos.length,
  movimientos,
  siguiente: null,
  ...extra,
});

const apiError = (status: number, codigo: string): ApiError => ({ status, codigo, mensaje: '' });

/** Intl usa espacios especiales (U+00A0); se normalizan para comparar textos. */
const normalize = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();

describe('MovementsPage', () => {
  let getMovements: jasmine.Spy;
  let fixture: ComponentFixture<MovementsPage>;
  let el: HTMLElement;

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

  function create(): void {
    fixture = TestBed.createComponent(MovementsPage);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

  /** La lista virtual mide el viewport y dibuja las filas en los cuadros siguientes. */
  async function render(): Promise<void> {
    create();
    await settle();
  }

  async function settle(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      await fixture.whenStable();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      fixture.detectChanges();
    }
  }

  const status = () => normalize(el.querySelector('[role="status"]')?.textContent);
  const items = () => Array.from(el.querySelectorAll('[role="listitem"]')).map((i) => normalize(i.textContent));
  const lastQuery = () => getMovements.calls.mostRecent().args[0];

  function typeSearch(value: string): void {
    const input = el.querySelector<HTMLInputElement>('#search')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function select(id: string, value: string): void {
    const element = el.querySelector<HTMLSelectElement>(`#${id}`)!;
    element.value = value;
    element.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  it('requests the first page of October 2026, newest first, by default', () => {
    getMovements.and.returnValue(new Subject<MovementsResponse>());
    create();

    expect(getMovements).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({
        accountId: 'REC-2231', desde: '2026-10-01', hasta: '2026-10-31', orden: 'fecha_desc', limite: 200,
      }),
    );
  });

  it('shows the loading state while the request is pending', () => {
    getMovements.and.returnValue(new Subject<MovementsResponse>());
    create();
    expect(status()).toBe('Cargando movimientos…');
  });

  it('shows the empty state when the period has no movements', () => {
    getMovements.and.returnValue(of(response([])));
    create();
    expect(status()).toBe('No hay movimientos en este periodo.');
    expect(el.querySelector('cdk-virtual-scroll-viewport')).toBeNull();
  });

  it('groups the sample movements by Colombia accounting day with a header per day', async () => {
    getMovements.and.returnValue(of(response(SAMPLE_MOVEMENTS)));
    await render();

    const headers = Array.from(el.querySelectorAll('h2')).map((h) => normalize(h.textContent));
    expect(headers.length).toBe(3);
    expect(headers[0]).toContain('31 de octubre de 2026');
    expect(headers[1]).toContain('14 de octubre de 2026');
    expect(headers[2]).toContain('1 de octubre de 2026');
    expect(items().length).toBe(9); // 3 encabezados + 6 movimientos
  });

  it('shows time, description, reference, signed amount and in-process mark on each row', async () => {
    getMovements.and.returnValue(of(response(SAMPLE_MOVEMENTS)));
    await render();
    const rows = items().filter((text) => !text.includes('de 2026'));

    expect(rows[0]).toContain('23:30');
    expect(rows[0]).toContain('Recaudo PSE factura 10-9902');
    expect(rows[0]).toContain('En proceso');
    expect(rows[0]).toContain('+$ 3.999.999,99');
    expect(rows[2]).toContain('-$ 48.730.500,50');
    expect(rows[2]).not.toContain('En proceso');
    expect(rows[3]).toContain('Sin referencia');
  });

  it('shows an error with retry and recovers on retry', async () => {
    getMovements.and.returnValues(throwError(() => apiError(503, 'CORE_NO_DISPONIBLE')), of(response(SAMPLE_MOVEMENTS)));
    create();

    expect(normalize(el.querySelector('[role="alert"]')?.textContent)).toContain('no está disponible');
    el.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await settle();

    expect(getMovements).toHaveBeenCalledTimes(2);
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(el.querySelectorAll('h2').length).toBe(3);
  });

  it('shows an expired session distinctly, not as a generic error', () => {
    getMovements.and.returnValue(throwError(() => apiError(401, 'SESION_EXPIRADA')));
    create();
    const alert = normalize(el.querySelector('[role="alert"]')?.textContent);

    expect(alert).toContain('Tu sesión venció');
    expect(alert).not.toContain('No pudimos cargar');
    expect(el.querySelector('[role="alert"] button')).toBeNull();
  });

  it('reloads the movements when the period changes', () => {
    getMovements.and.returnValue(of(response([])));
    create();
    select('period-month', '9');

    expect(lastQuery()).toEqual(jasmine.objectContaining({ desde: '2026-09-01', hasta: '2026-09-30' }));
  });

  it('searches once after the treasurer stops typing, never with less than 3 characters', fakeAsync(() => {
    getMovements.and.returnValue(of(response([])));
    create();
    for (const value of ['n', 'no', 'nom', 'nomi', 'nomin', 'nomina']) {
      typeSearch(value);
      tick(150); // Ritmo del incidente: ~170 ms entre teclas (líneas 06 a 14).
    }
    tick(SEARCH_DEBOUNCE_MS);

    expect(getMovements).toHaveBeenCalledTimes(2); // carga inicial + "nomina"
    expect(lastQuery().q).toBe('nomina');

    typeSearch('no');
    tick(SEARCH_DEBOUNCE_MS);
    expect(lastQuery().q).toBeUndefined();
    flush();
    discardPeriodicTasks();
  }));

  it('ignores a slow response of an older search (root cause of INC-2026-1187)', fakeAsync(() => {
    const initial = new Subject<MovementsResponse>();
    const nom = new Subject<MovementsResponse>();
    const nomina = new Subject<MovementsResponse>();
    getMovements.and.returnValues(initial, nom, nomina);
    create();

    typeSearch('nom');
    tick(SEARCH_DEBOUNCE_MS);
    typeSearch('nomina');
    tick(SEARCH_DEBOUNCE_MS);
    expect(nom.observed).withContext('la búsqueda vieja se canceló').toBeFalse();

    nomina.next(response([SAMPLE_MOVEMENTS[2]], { totalRegistros: 1204 }));
    nom.next(response([SAMPLE_MOVEMENTS[4]], { totalRegistros: 9876 }));
    fixture.detectChanges();

    expect(status()).toBe('1.204 resultados para «nomina»');
    flush();
    discardPeriodicTasks();
  }));

  it('sorts on the server and shows the date on each row when sorting by amount', async () => {
    getMovements.and.returnValue(of(response(SAMPLE_MOVEMENTS)));
    await render();
    select('order', 'monto_desc');
    await settle();

    expect(lastQuery().orden).toBe('monto_desc');
    expect(el.querySelectorAll('h2').length).toBe(0);
    expect(items()[0]).toContain('31 oct · 23:30');
  });

  it('loads the next page with the cursor of the same query', async () => {
    getMovements.and.returnValues(
      of(response(SAMPLE_MOVEMENTS.slice(0, 3), { totalRegistros: 6, siguiente: 'c-3' })),
      of(response(SAMPLE_MOVEMENTS.slice(3), { totalRegistros: 6, siguiente: null })),
    );
    await render();
    expect(normalize(el.querySelector('.summary__detail')?.textContent)).toContain('Cargados 3 de 6');

    el.querySelector<HTMLButtonElement>('.more__button')!.click();
    await settle();

    expect(lastQuery()).toEqual(jasmine.objectContaining({ cursor: 'c-3', desde: '2026-10-01', orden: 'fecha_desc' }));
    expect(normalize(el.querySelector('.summary__detail')?.textContent)).toContain('Cargados 6 de 6');
    expect(normalize(el.querySelector('.more')?.textContent)).toBe('Fin de la lista.');
  });

  it('has no WCAG 2.2 AA violations with the sample movements', async () => {
    getMovements.and.returnValue(of(response(SAMPLE_MOVEMENTS)));
    await render();
    await expectNoAccessibilityViolations(el);
  });
});
