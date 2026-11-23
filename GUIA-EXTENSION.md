# Guía: agregar la pantalla "Detalle del movimiento"

Esta guía es para un desarrollador que no conoce el proyecto. Al final tendrás la ruta `/movimientos/:id`, a la que se llega al hacer clic en una fila de Movimientos, con sus pruebas pasando.

## 0. Lo que debes saber antes de empezar

La app usa **arquitectura hexagonal**. Las dependencias siempre apuntan hacia adentro:

```
ui (pantallas)  ->  application (casos de uso)  ->  domain (modelos y puertos)  <-  infrastructure (HTTP, mock)
```

- `domain/model`: interfaces con los campos **exactos** del contrato de la API (en español).
- `domain/ports`: clases abstractas que dicen *qué* datos se necesitan.
- `application`: casos de uso; la pantalla nunca llama a `HttpClient`.
- `infrastructure/adapters`: implementan los puertos con `HttpClient`.
- `app.config.ts`: conecta cada puerto con su adaptador.
- `src/test`: pruebas con la **misma estructura** que `src/app`.

**Importante:** el contrato actual **no tiene** un endpoint para consultar un movimiento por id, y el enunciado pide no inventar endpoints. Por eso el detalle muestra el movimiento que el tesorero eligió en la lista, que ya está en memoria. Si en el futuro la API agrega `GET /cuentas/{cuentaId}/movimientos/{id}`, sigue la sección 7.

Comandos: `npm start` (app en http://localhost:4200) y `npm test` (todas las pruebas).

## 1. Guardar el movimiento elegido (application)

Crea `src/app/application/movement/selected-movement.store.ts`:

```ts
import { Injectable, signal } from '@angular/core';
import { Movement } from '../../domain/model/movement/movement.model';

/** Movimiento elegido en la lista. Solo en memoria: la política prohíbe guardarlo en el navegador. */
@Injectable({ providedIn: 'root' })
export class SelectedMovementStore {
  private readonly value = signal<Movement | null>(null);
  readonly movement = this.value.asReadonly();

  select(movement: Movement): void {
    this.value.set(movement);
  }

  clear(): void {
    this.value.set(null);
  }
}
```

Sigue el mismo patrón que `application/session/csrf-token.store.ts`. **Nunca** uses `localStorage`, `sessionStorage` ni `IndexedDB`: el portal se usa en computadores compartidos.

## 2. Crear la pantalla (ui)

Crea la carpeta `src/app/ui/pages/movement-detail/` con tres archivos.

`movement-detail-page.ts`:

```ts
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SelectedMovementStore } from '../../../application/movement/selected-movement.store';
import { toColombiaDayAndTime } from '../../../application/movement/list-movements.use-case';

@Component({
  selector: 'app-movement-detail-page',
  imports: [CurrencyPipe, DatePipe, RouterLink],
  templateUrl: './movement-detail-page.html',
  styleUrl: './movement-detail-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovementDetailPage {
  /** Viene de la ruta /movimientos/:id (requiere withComponentInputBinding, paso 3). */
  readonly id = input.required<string>();

  private readonly store = inject(SelectedMovementStore);

  /** Solo se muestra si el movimiento elegido coincide con el id de la URL. */
  protected readonly movement = computed(() => {
    const movement = this.store.movement();
    return movement?.id === this.id() ? movement : null;
  });

  protected readonly dayAndTime = computed(() => {
    const movement = this.movement();
    return movement ? toColombiaDayAndTime(movement.fechaHora) : null;
  });
}
```

`movement-detail-page.html`:

```html
<section class="detail" aria-labelledby="detail-title">
  <h1 id="detail-title">Detalle del movimiento</h1>

  @if (movement(); as m) {
    <dl>
      <div><dt>Descripción</dt><dd>{{ m.descripcion }}</dd></div>
      <div><dt>Referencia</dt><dd>{{ m.referencia ?? 'Sin referencia' }}</dd></div>
      <div><dt>Fecha contable</dt><dd>{{ dayAndTime()!.day | date: 'fullDate' : 'UTC' }}</dd></div>
      <div><dt>Hora (Colombia)</dt><dd>{{ dayAndTime()!.time }}</dd></div>
      <div><dt>Monto</dt><dd>{{ m.monto | currency: 'COP' : 'symbol-narrow' : '1.2-2' }}</dd></div>
      <div><dt>Estado</dt><dd>{{ m.estado === 'EN_PROCESO' ? 'En proceso (aún no afecta el saldo disponible)' : 'Aplicado' }}</dd></div>
      <div><dt>Identificador</dt><dd>{{ m.id }}</dd></div>
    </dl>
  } @else {
    <p role="status">No encontramos este movimiento. Ábrelo desde la lista de movimientos.</p>
  }

  <a routerLink="/movimientos">Volver a movimientos</a>
</section>
```

Reglas que **debes** respetar (son las mismas de las otras pantallas):

- **Fecha:** usa `toColombiaDayAndTime`, nunca `new Date(...).getDate()`. La fecha contable es la de Colombia (UTC−5) aunque el tesorero esté en Madrid.
- **`DatePipe` con `'UTC'`** sobre el día ya convertido; si no, en Colombia mostraría el día anterior.
- **`referencia` puede ser `null`:** usa `??`. Nunca llames `.trim()` sin comprobar (causa del error de la línea 27 del incidente).
- **Monto:** es texto; formatéalo con `currency`. No sumes ni restes con `Number(...)`.
- **Accesibilidad:** un solo `h1`, lista de definiciones (`dl`), textos en `role="status"`.

`movement-detail-page.scss`: copia el estilo `.receipt dl` de `ui/pages/transfer/transfer-page.scss` y cambia la clase por `.detail`.

## 3. Registrar la ruta

En `src/app/app.routes.ts`, **antes** de la ruta `'**'`:

```ts
{
  path: 'movimientos/:id',
  title: 'Detalle del movimiento · Portal Empresas',
  loadComponent: () =>
    import('./ui/pages/movement-detail/movement-detail-page').then((m) => m.MovementDetailPage),
},
```

`loadComponent` mantiene la pantalla fuera del JavaScript inicial (límite de 250 KB).

En `src/app/app.config.ts` cambia `provideRouter(routes)` por `provideRouter(routes, withComponentInputBinding())` (importa `withComponentInputBinding` de `@angular/router`). Así `:id` llega al `input` `id`.

## 4. Enlazar desde la lista

En `ui/pages/movements/movements-page.ts`:

1. Agrega `RouterLink` a `imports` del componente.
2. Inyecta el store y agrega un método:

```ts
private readonly selected = inject(SelectedMovementStore);

protected select(movement: Movement): void {
  this.selected.select(movement);
}
```

En `movements-page.html`, convierte la descripción de cada fila en enlace:

```html
<a class="row__description" [routerLink]="['/movimientos', row.movement.id]" (click)="select(row.movement)">
  {{ row.movement.descripcion }}
</a>
```

Usa un enlace (`<a>`), no un `div` con `(click)`: funciona con teclado y lector de pantalla sin código extra.

## 5. Pruebas

Crea `src/test/ui/pages/movement-detail/movement-detail-page.spec.ts` (misma ruta que el componente, dentro de `src/test`):

```ts
import { registerLocaleData } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SelectedMovementStore } from '../../../../app/application/movement/selected-movement.store';
import { SAMPLE_MOVEMENTS } from '../../../../app/infrastructure/mock/simulated-data';
import { MovementDetailPage } from '../../../../app/ui/pages/movement-detail/movement-detail-page';
import { expectNoAccessibilityViolations } from '../../../support/axe';

registerLocaleData(localeEsCo);

describe('MovementDetailPage', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MovementDetailPage],
      providers: [provideRouter([]), { provide: LOCALE_ID, useValue: 'es-CO' }],
    });
  });

  function render(id: string) {
    const fixture = TestBed.createComponent(MovementDetailPage);
    fixture.componentRef.setInput('id', id);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the selected movement with its Colombia accounting date', () => {
    TestBed.inject(SelectedMovementStore).select(SAMPLE_MOVEMENTS[0]); // 2026-11-01T04:30Z
    const el = render('MV-8849999');
    const text = (el.textContent ?? '').replace(/\s+/g, ' ');

    expect(text).toContain('31 de octubre de 2026');
    expect(text).toContain('23:30');
    expect(text).toContain('En proceso');
  });

  it('shows "Sin referencia" when the reference is null', () => {
    TestBed.inject(SelectedMovementStore).select(SAMPLE_MOVEMENTS[3]);
    expect(render('MV-8812044').textContent).toContain('Sin referencia');
  });

  it('shows a message when the movement was not selected from the list', () => {
    expect(render('MV-0000000').textContent).toContain('No encontramos este movimiento');
  });

  it('has no WCAG 2.2 AA violations', async () => {
    TestBed.inject(SelectedMovementStore).select(SAMPLE_MOVEMENTS[0]);
    await expectNoAccessibilityViolations(render('MV-8849999'));
  });
});
```

Nota: `configureTestingModule` va en `beforeEach` porque debe ejecutarse antes del primer `TestBed.inject`; después de inyectar algo, el módulo de pruebas ya no se puede configurar.

Usa siempre los datos de `infrastructure/mock/simulated-data.ts` (los de la sección 4.1); así las pruebas reflejan el contrato.

## 6. Verificar y entregar

1. `npm test`: todas las pruebas deben pasar, incluida la de accesibilidad.
2. `npm start`: abre Movimientos, haz clic en una descripción y revisa el detalle. Prueba también con teclado (Tab y Enter).
3. `npm run build`: el `Initial total` (columna *Estimated transfer size*) debe seguir por debajo de 250 KB.
4. Commits pequeños, con el formato de la historia: `feat(application): ...`, `feat(ui): ...`, `test: ...`.
5. Agrega tu decisión a `DECISIONES.md` (por qué el detalle usa el store y no un endpoint nuevo).

## 7. Si la API agrega un endpoint de detalle

Sigue el mismo camino que Movimientos, de adentro hacia afuera:

1. **Puerto:** agrega a `domain/ports/movement/movement.port.ts`
   `abstract getMovement(accountId: string, id: string): Observable<Movement>;`
2. **Adaptador:** impleméntalo en `infrastructure/adapters/movement/movement-http.adapter.ts` con `encodeURIComponent` en los ids y `catchError(... toApiError ...)`, como `getMovements`.
3. **Mock:** agrega la ruta en `SimulatedBackend.handle` (`infrastructure/mock/simulated-api.ts`), con 401 si la sesión venció y 403 si la cuenta no es REC-2231.
4. **Caso de uso:** `application/movement/get-movement.use-case.ts` con `@Injectable({ providedIn: 'root' })` que inyecta `MovementPort`.
5. **Pantalla:** usa el store si el movimiento ya está en memoria; si no, llama al caso de uso y maneja los estados carga, error con "Reintentar" y sesión vencida igual que `movements-page.ts` (`toErrorState`).
6. **Pruebas:** adaptador con `HttpTestingController` (ver `movement-http.adapter.spec.ts`) y pantalla con un `MovementPort` falso (ver `movements-page.spec.ts`).
