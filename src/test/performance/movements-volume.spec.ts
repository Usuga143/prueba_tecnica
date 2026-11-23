import { registerLocaleData } from '@angular/common';
import { HttpParams, HttpRequest } from '@angular/common/http';
import localeEsCo from '@angular/common/locales/es-CO';
import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { MovementsQuery, MovementsResponse } from '../../app/domain/model/movement/movement.model';
import { MovementPort } from '../../app/domain/ports/movement/movement.port';
import { SimulatedBackend } from '../../app/infrastructure/mock/simulated-api';
import { MovementsPage } from '../../app/ui/pages/movements/movements-page';

registerLocaleData(localeEsCo);

/**
 * Medición de rendimiento de la vista con más registros: los 50.000 movimientos de octubre.
 * La API simulada responde sin latencia para medir solo el trabajo del cliente.
 * Umbrales del enunciado: INP < 200 ms; el portal anterior llegó a 118.188 nodos y 4.120 ms.
 */
describe('Performance: Movements with 50.000 movements', () => {
  const PAGES_TO_LOAD = 25; // 5.000 movimientos cargados
  let fixture: ComponentFixture<MovementsPage>;
  let el: HTMLElement;
  let backend: SimulatedBackend;
  const longTasks: number[] = [];
  let observer: PerformanceObserver | undefined;

  beforeEach(() => {
    backend = new SimulatedBackend();
    backend.disableRateLimit();
    const getMovements = (query: MovementsQuery) => {
      const params: Record<string, string> = { desde: query.desde, hasta: query.hasta, limite: String(query.limite) };
      if (query.q) params['q'] = query.q;
      if (query.orden) params['orden'] = query.orden;
      if (query.cursor) params['cursor'] = query.cursor;
      const result = backend.handle(
        new HttpRequest('GET', `/api/v1/cuentas/${query.accountId}/movimientos`, { params: new HttpParams({ fromObject: params }) }),
      );
      return result.status === 200 ? of(result.body as MovementsResponse) : throwError(() => result);
    };
    TestBed.configureTestingModule({
      imports: [MovementsPage],
      providers: [{ provide: MovementPort, useValue: { getMovements } }, { provide: LOCALE_ID, useValue: 'es-CO' }],
    });
    if (PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
      observer = new PerformanceObserver((list) => list.getEntries().forEach((e) => longTasks.push(e.duration)));
      observer.observe({ type: 'longtask' });
    }
  });

  afterEach(() => observer?.disconnect());

  async function settle(): Promise<void> {
    for (let i = 0; i < 2; i++) {
      await fixture.whenStable();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      fixture.detectChanges();
    }
  }

  it('renders the first rows fast and keeps the DOM bounded while loading 5.000 movements', async () => {
    const generationStart = performance.now();
    backend.handle(
      new HttpRequest('GET', '/api/v1/cuentas/REC-2231/movimientos', {
        params: new HttpParams({ fromObject: { desde: '2026-10-01', hasta: '2026-10-31', limite: '1' } }),
      }),
    );
    const generationMs = performance.now() - generationStart;

    const firstStart = performance.now();
    fixture = TestBed.createComponent(MovementsPage);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await settle();
    const firstRowsMs = performance.now() - firstStart;
    expect(el.querySelectorAll('[role="listitem"]').length).toBeGreaterThan(0);

    const appendTimes: number[] = [];
    for (let page = 1; page < PAGES_TO_LOAD; page++) {
      const start = performance.now();
      el.querySelector<HTMLButtonElement>('.more__button')!.click();
      fixture.detectChanges();
      await settle();
      appendTimes.push(performance.now() - start);
    }

    const viewport = el.querySelector<HTMLElement>('cdk-virtual-scroll-viewport')!;
    const scrollStart = performance.now();
    viewport.scrollTop = viewport.scrollHeight / 2;
    viewport.dispatchEvent(new Event('scroll'));
    await settle();
    const scrollMs = performance.now() - scrollStart;

    const domNodes = el.querySelectorAll('*').length;
    const renderedItems = el.querySelectorAll('[role="listitem"]').length;
    const maxAppendMs = Math.max(...appendTimes);
    const summary = el.querySelector('.summary__detail')?.textContent?.replace(/\s+/g, ' ').trim();

    console.log(
      `[rendimiento] generación 50.000 en mock: ${generationMs.toFixed(0)} ms · ` +
        `primeras filas (sin latencia de red): ${firstRowsMs.toFixed(0)} ms · ` +
        `agregar página de 200: máx ${maxAppendMs.toFixed(0)} ms · salto de scroll: ${scrollMs.toFixed(0)} ms · ` +
        `nodos DOM: ${domNodes} · filas dibujadas: ${renderedItems} · ${summary} · ` +
        `tareas largas: ${longTasks.length} (máx ${longTasks.length ? Math.max(...longTasks).toFixed(0) : 0} ms)`,
    );

    expect(summary).toContain('Cargados 5.000 de 50.000');
    expect(domNodes).withContext('nodos DOM con 5.000 movimientos cargados').toBeLessThan(1500);
    expect(maxAppendMs).withContext('agregar una página (proxy de INP)').toBeLessThan(200);
    expect(scrollMs).withContext('salto de scroll (proxy de INP)').toBeLessThan(200);
    expect(firstRowsMs).withContext('primeras filas sin red (meta total 1,5 s con red)').toBeLessThan(1000);
  });
});
