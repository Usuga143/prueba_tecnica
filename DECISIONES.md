# Registro de decisiones — DS-FE-20261119-xpjf

Inicio: 12:52 · Fin de la Parte 1: 13:50 · Fin: <hora>

## Supuestos

| # | Supuesto | Por qué lo asumí | Qué cambiaría si es falso |
|---|---|---|---|
| S-01 | La fecha contable es la fecha calendario en Colombia (UTC−5 fijo) de `fechaHora`. | El glosario la define así y Colombia no tiene horario de verano. | Si el banco asigna la fecha contable con otra regla (p. ej. corte a las 20:00), la API debería enviar un campo `fechaContable` y se agruparía por él. |
| S-02 | El tesorero ya inició sesión: la cookie HttpOnly existe al abrir el portal. | El contrato no incluye login y el enunciado excluye integrar autenticación. | Habría que agregar una pantalla de inicio de sesión y redirigir al vencer la sesión. |
| S-03 | La sesión vence 5 minutos después de la última renovación; solo `POST /sesion/renovar` la extiende. | La sección 6 dice "solo POST /sesion/renovar la extiende". | Si cualquier petición la extendiera, el mock renovaría el vencimiento en cada petición. |
| S-04 | El periodo se elige por mes (mes y año) y no por rango libre. | Los tesoreros concilian contra el extracto mensual y la API admite máximo 31 días. | Se cambiarían los selectores por dos campos de fecha, validando 31 días como máximo. |
| S-05 | La cuenta es fija: REC-2231. | Es la única cuenta del enunciado. | Se agregaría un selector de cuenta y la cuenta iría en la ruta (`/cuentas/:id/movimientos`). |
| S-06 | La primera página trae 200 registros (máximo del contrato). | Menos viajes de red; el p95 por página es 400 ms. | Si 200 filas tardaran demasiado en pintar, se bajaría el límite (la Parte 3 virtualiza la lista). |
| S-07 | Un 403 o un 400 no se reintentan desde la pantalla. | Reintentar no cambia el resultado (falta de permiso o parámetro inválido). | Se mostraría también "Reintentar" en esos casos. |
| S-08 | El tesorero escribe el monto con coma decimal y sin puntos de miles ("1500000,50"). | Es el formato colombiano y evita la ambigüedad de "1.500" (¿mil quinientos o uno con cinco?). | Se aceptaría punto decimal y se mostraría una confirmación con el valor interpretado. |
| S-09 | El cliente no conoce lo transferido antes en el día; el tope diario lo valida la API (422). | No hay endpoint para consultar el acumulado diario. | Si existiera, se validaría también en el cliente antes de enviar. |
| S-10 | El primer token CSRF se obtiene con `POST /sesion/renovar` al abrir el portal. | El contrato no define otra forma de obtenerlo. | Si el servidor lo entregara al iniciar sesión, se leería de esa respuesta. |
| S-11 | "Inactividad" para el cliente es que el tesorero no use teclado ni puntero. | Renovar sin actividad real mantendría abierta una sesión desatendida en un computador compartido. | Si el banco pidiera mantener la sesión mientras la pestaña esté abierta, se renovaría por tiempo. |
| S-12 | El servidor no guarda las respuestas de error para la idempotencia (solo el 201). | El contrato solo describe repetir "el 201 original". | Si guardara también errores, un reintento tras un 422 necesitaría otra clave. |

## Decisiones

### D-01 Angular 20 con componentes standalone y zone.js
- **Tema:** stack
- **Contexto:** el enunciado permite Angular, React o Vue.
- **Alternativas consideradas:**
  - React o Vue: válidos, pero no son el framework que uso a diario; sería más difícil sustentar.
  - Angular sin zone.js (zoneless): menos JavaScript, pero todavía nuevo y con más riesgo en pruebas.
  - **Angular 20 standalone con zone.js:** es lo que uso en mi trabajo; CLI, pruebas y router incluidos.
- **Decisión:** Angular 20, standalone, zone.js, SCSS, sin SSR.
- **Por qué:** dominio del framework para sustentar; el enunciado pide un cliente web (sin SSR).
- **Consecuencias y trade-offs:** zone.js suma unos KB al bundle; el inicial queda en 89,86 KB comprimido, lejos del límite de 250 KB.
- **Dónde se ve:** `package.json`, `angular.json`, `app.config.ts`.

### D-02 Arquitectura hexagonal: `domain/model`, `domain/ports`, `application`, `infrastructure`, `ui`
- **Tema:** arquitectura
- **Contexto:** hoy la API es simulada y mañana será la real; el cambio no debe tocar pantallas ni reglas.
- **Alternativas consideradas:**
  - Componentes que llaman a HttpClient directamente: más rápido de escribir, pero mezcla reglas, HTTP y UI, y obliga a probar todo con HTTP.
  - Arquitectura limpia con los puertos en `application`: válida, pero no es la estructura que uso en mi trabajo.
  - **Hexagonal con puertos en `domain/ports`:** es el patrón que conozco.
- **Decisión:** hexagonal. La UI usa casos de uso; los casos de uso usan puertos; los adaptadores implementan los puertos.
- **Por qué:** permite cambiar la API simulada por la real quitando una línea de `app.config.ts`, y probar la pantalla con un puerto falso.
- **Consecuencias y trade-offs:** más archivos que una solución directa.
- **Dónde se ve:** `src/app/domain`, `src/app/application`, `src/app/infrastructure`, `app.config.ts`.

### D-03 Puertos como `abstract class` en vez de `interface`
- **Tema:** patrón
- **Contexto:** Angular necesita un token que exista en ejecución para inyectar dependencias; las interfaces desaparecen al compilar.
- **Alternativas consideradas:** `interface` + `InjectionToken` (dos piezas por puerto; es lo que se usa en mi trabajo); **`abstract class`** (una pieza que sirve de contrato y de token).
- **Decisión:** `abstract class MovementPort`, registrada con `{ provide: MovementPort, useClass: MovementHttpAdapter }`.
- **Por qué:** menos código y nada que mantener sincronizado.
- **Consecuencias y trade-offs:** la clase abstracta deja unas pocas líneas en el bundle.
- **Dónde se ve:** `domain/ports/movement/movement.port.ts`, `app.config.ts`.

### D-04 Modelos como interfaces con los nombres de campo del contrato (en español)
- **Tema:** datos
- **Contexto:** el JSON de la API usa `monto`, `fechaHora`, `referencia`...
- **Alternativas consideradas:** traducir los campos al inglés con un mapeo (más código y un punto más de error); **usar los nombres del contrato tal cual**.
- **Decisión:** interfaces con los campos del contrato. Archivos, clases y funciones en inglés; textos de pantalla en español.
- **Por qué:** el contrato es externo; mantener los nombres evita un mapeo y deja claro qué viene de la API.
- **Consecuencias y trade-offs:** conviven dos idiomas en el código (`movement.monto`).
- **Dónde se ve:** `domain/model/movement/movement.model.ts`.

### D-05 `referencia: string | null` y TypeScript estricto
- **Tema:** datos
- **Contexto:** la línea 27 del incidente muestra `Cannot read properties of null (reading 'trim')` en MV-8812044, que tiene `referencia: null`.
- **Alternativas consideradas:** tipar `referencia: string` y confiar en la API (repite el error); **tipar el `null` y mostrar "Sin referencia"**.
- **Decisión:** `string | null` con `strict` y `strictTemplates`; la pantalla usa `referencia ?? 'Sin referencia'`.
- **Por qué:** el compilador obliga a manejar el caso nulo.
- **Consecuencias y trade-offs:** ninguno relevante.
- **Dónde se ve:** `movement.model.ts`, `movements-page.html`, prueba "shows time, description, reference...".

### D-06 Agrupación por día contable de Colombia con desplazamiento fijo UTC−5
- **Tema:** datos
- **Contexto:** `fechaHora` llega en UTC; el extracto usa la fecha de Colombia. `2026-11-01T04:30:00Z` es el 31 de octubre a las 23:30 en Colombia.
- **Alternativas consideradas:**
  - Agrupar por la fecha UTC: pone movimientos en el día o mes equivocado; no cuadra con el extracto.
  - Usar la zona horaria del navegador: falla con los tesoreros de Miami y Madrid.
  - `Intl.DateTimeFormat` con `America/Bogota`: correcto, pero más costoso por fila.
  - **Restar 5 horas fijas:** el glosario dice "UTC−5, sin horario de verano".
- **Decisión:** `toColombiaDayAndTime` resta 5 horas y extrae día y hora; `groupByAccountingDay` agrupa movimientos consecutivos del mismo día.
- **Por qué:** es exacto según la definición del enunciado e independiente de la zona horaria del equipo.
- **Consecuencias y trade-offs:** si Colombia adoptara horario de verano habría que cambiar a `America/Bogota`. Agrupar consecutivos respeta el orden pedido y permite agregar páginas al final (Parte 3).
- **Dónde se ve:** `application/movement/list-movements.use-case.ts`, pruebas del caso de uso y de la pantalla.

### D-07 Encabezado del día con `DatePipe` en zona `'UTC'`
- **Tema:** diseño
- **Contexto:** el día agrupado es un texto `'2026-10-31'`. Si `DatePipe` lo interpreta en la zona del navegador, en Colombia mostraría el 30 de octubre.
- **Alternativas consideradas:** formatear a mano (más código); **`date: 'fullDate' : 'UTC'`**.
- **Decisión:** `DatePipe` con zona `'UTC'` y locale `es-CO`: "sábado, 31 de octubre de 2026".
- **Por qué:** el texto ya es la fecha de Colombia; formatearlo en UTC evita volver a desplazarlo.
- **Dónde se ve:** `movements-page.html`.

### D-08 Monto: texto del contrato y `CurrencyPipe` solo para mostrar
- **Tema:** datos
- **Contexto:** `monto` llega como texto decimal; hay que mostrarlo "con signo en pesos".
- **Alternativas consideradas:** convertir a centavos enteros en un modelo de dominio (más código, solo útil si hay cálculos); **dejar el texto y formatear con `CurrencyPipe` en `es-CO`**.
- **Decisión:** el monto se guarda como texto; la pantalla lo formatea con `currency: 'COP' : 'symbol-narrow' : '1.2-2'` y antepone `+` a los créditos.
- **Por qué:** en esta pantalla no se hacen cálculos; formatear un decimal de 2 cifras es exacto. La API simulada sí compara montos en centavos enteros (orden y topes).
- **Consecuencias y trade-offs:** si el cliente tuviera que sumar montos (totales del día), habría que agregar una conversión a centavos.
- **Dónde se ve:** `movements-page.html`, `simulated-api.ts` (`toCents`).

### D-09 Estado de la pantalla como unión discriminada y `switchMap`
- **Tema:** patrón
- **Contexto:** la pantalla tiene cinco estados excluyentes: carga, vacío, datos, error y sesión vencida.
- **Alternativas consideradas:** varias banderas (`isLoading`, `hasError`...), que permiten combinaciones imposibles; NgRx o una librería de estado (pesada para dos pantallas); **un `ViewState` con `kind` y un flujo RxJS convertido a signal**.
- **Decisión:** `BehaviorSubject<Period>` → `switchMap` al caso de uso → `map`/`startWith`/`catchError` → `toSignal`. Plantilla con `@if` sobre `view.kind`.
- **Por qué:** cada estado es un único valor y el compilador valida qué datos tiene. `switchMap` cancela la petición anterior al cambiar el periodo o reintentar, evitando que una respuesta vieja pise a la nueva (causa del incidente).
- **Consecuencias y trade-offs:** hay que entender RxJS. Se usó `OnPush` para pintar solo cuando cambia el estado.
- **Dónde se ve:** `ui/pages/movements/movements-page.ts`.

### D-10 Sesión vencida como estado propio, no como error genérico
- **Tema:** diseño
- **Contexto:** el enunciado exige que una sesión vencida no se muestre como error genérico.
- **Alternativas consideradas:** mensaje de error común con "Reintentar" (confunde: reintentar no sirve con la sesión vencida); redirigir a un login (no existe en el alcance); **estado `session-expired` con su propio mensaje y sin "Reintentar"**.
- **Decisión:** el 401 se traduce a `session-expired`; el resto de errores muestra un mensaje según el código (403, 429 con segundos de espera, 503, sin conexión) y "Reintentar" cuando tiene sentido.
- **Por qué:** el tesorero entiende qué pasó y qué hacer.
- **Consecuencias y trade-offs:** la renovación automática para no llegar a este estado se resuelve en la Parte 2.
- **Dónde se ve:** `movements-page.ts` (`toErrorState`), `movements-page.html`, pruebas de la pantalla.

### D-11 Errores HTTP traducidos al formato del contrato en la infraestructura
- **Tema:** arquitectura
- **Contexto:** la UI necesita el código del error y, en un 429, los segundos de `Retry-After`.
- **Alternativas consideradas:** que la UI lea `HttpErrorResponse` (acopla la pantalla a Angular HTTP); **un traductor `toApiError` en el adaptador**.
- **Decisión:** el adaptador convierte cualquier error en `ApiError { status, codigo, mensaje, errores?, retryAfterSeconds? }`.
- **Por qué:** mantiene la UI independiente de HttpClient y reutiliza la forma de error del contrato.
- **Dónde se ve:** `infrastructure/http/api-error.mapper.ts`, `domain/model/shared/api-error.model.ts`.

### D-12 API simulada con un interceptor de HttpClient
- **Tema:** arquitectura
- **Contexto:** hay que simular los 3 endpoints sin back-end real.
- **Alternativas consideradas:**
  - MSW (Mock Service Worker): muy realista, pero agrega una dependencia y un service worker que puede cachear respuestas (prohibido guardar datos en caché del navegador).
  - json-server u otro servidor local: es un back-end aparte, fuera del alcance, y no simula reglas como el cursor o la idempotencia.
  - **Interceptor funcional de Angular:** sin dependencias, mismo código en desarrollo y pruebas.
- **Decisión:** `simulatedApiInterceptor` + `SimulatedBackend` con el estado (sesión, CSRF, idempotencia, topes, límite de peticiones).
- **Por qué:** se quita con una línea para usar la API real y permite probar el contrato completo.
- **Consecuencias y trade-offs:** el mock vive dentro del bundle; en un despliegue real se quitaría del `app.config.ts`. El estado se pierde al recargar la página.
- **Dónde se ve:** `infrastructure/mock/simulated-api.ts`, `app.config.ts`.

### D-13 Cursor atado a los parámetros de la consulta
- **Tema:** datos
- **Contexto:** el contrato dice que el cursor vale solo "con los mismos parámetros". En el incidente (línea 24) se pidió la página 2 de "nom" cuando la pantalla mostraba "nomina".
- **Alternativas consideradas:** cursor como número de página simple (acepta mezclar búsquedas); **cursor con una huella de los parámetros**.
- **Decisión:** el mock genera `c-<offset>-<huella>` y responde 400 si la huella no coincide.
- **Por qué:** reproduce la regla del contrato y permite probar que el cliente no mezcla páginas.
- **Dónde se ve:** `simulated-api.ts`, prueba "paginates with a cursor bound to the same parameters".

### D-14 Escenarios de la API simulada por parámetro de URL
- **Tema:** operación
- **Contexto:** hay que poder ver los estados vacío, error, sesión vencida y carga sin cambiar código.
- **Alternativas consideradas:** guardar el escenario en `localStorage` (prohibido por la política del banco); cambiar datos en el código; **`?escenario=` en la URL**.
- **Decisión:** el mock lee `escenario=vacio|error|sesion|lento` de la URL.
- **Por qué:** no guarda nada en el navegador y no afecta la API real.
- **Dónde se ve:** `simulated-api.ts` (`readScenario`), `README.md`.

### D-15 Selector de periodo con dos `<select>` (mes y año)
- **Tema:** diseño
- **Contexto:** se debe elegir un periodo y funcionar en Chrome, Edge y Firefox.
- **Alternativas consideradas:** `<input type="month">` (Firefox de escritorio no lo soporta y muestra un campo de texto); dos `<input type="date">` (permite rangos de más de 31 días y no corresponde al extracto mensual); **dos `<select>` con etiquetas**.
- **Decisión:** mes y año en `<select>` dentro de un `<fieldset>` con `<legend>`; octubre de 2026 por defecto.
- **Por qué:** funciona igual en los tres navegadores, es accesible con teclado y lector de pantalla, y siempre genera un periodo válido de 1 mes.
- **Dónde se ve:** `movements-page.html`, `monthRange` en `movements-page.ts`.

### D-16 Accesibilidad básica desde la Parte 1
- **Tema:** diseño
- **Contexto:** se exige WCAG 2.2 AA.
- **Decisión:** `lang="es"`, enlace "Saltar al contenido", `nav` con `aria-label`, `aria-current` en el menú, encabezados por día (`h2`), `role="status"` para carga, vacío y resumen, `role="alert"` para errores, foco visible, tamaño mínimo de 44 px en controles, colores con contraste suficiente y signo `+`/`-` en texto (no solo color).
- **Alternativas consideradas:** dejar la accesibilidad para la Parte 2 (más retrabajo).
- **Dónde se ve:** `index.html`, `app.html`, `movements-page.html`, `styles.scss`.
- **Pendiente:** revisión automática con axe en la Parte 2.

### D-17 Fuentes del sistema
- **Tema:** seguridad
- **Contexto:** la línea 04 del incidente muestra que la CSP `default-src 'self'` bloquea fuentes externas.
- **Alternativas consideradas:** alojar una fuente propia en el mismo dominio (más peso); **fuentes del sistema**.
- **Decisión:** `font-family: system-ui, ...`.
- **Por qué:** cumple la CSP sin peso extra.
- **Dónde se ve:** `src/styles.scss`.

### D-18 Ruta con carga diferida
- **Tema:** rendimiento
- **Contexto:** límite de 250 KB de JavaScript inicial comprimido.
- **Alternativas consideradas:** importar la pantalla directamente (todo en el bundle inicial); **`loadComponent`**.
- **Decisión:** `/movimientos` se carga con `loadComponent`.
- **Por qué:** cada pantalla nueva (transferencia, detalle) no aumenta el JavaScript inicial. Medido: inicial 89,86 KB comprimido; la pantalla, 3,11 KB aparte.
- **Dónde se ve:** `app.routes.ts`, salida de `npm run build`.

### D-19 Pruebas en `src/test` con la misma estructura que `src/app`
- **Tema:** pruebas
- **Contexto:** dónde ubicar los `.spec.ts`.
- **Alternativas consideradas:** junto al código (convención de Angular, imports cortos); **carpeta separada espejo**.
- **Decisión:** `src/test/...`, con imports relativos y sin alias de rutas.
- **Por qué:** separa claramente código y pruebas; Angular las encuentra sin configuración porque están dentro de `src`.
- **Consecuencias y trade-offs:** imports relativos largos; al mover un archivo hay que mover su prueba.
- **Dónde se ve:** `src/test/`.

### D-20 Pruebas de componente con un puerto falso
- **Tema:** pruebas
- **Contexto:** la Parte 1 pide probar los tres estados y la agrupación por día con los datos del enunciado.
- **Alternativas consideradas:** probar la pantalla contra la API simulada (lento, depende de la latencia); Testing Library (otra dependencia); **TestBed con `MovementPort` falso y el caso de uso real**.
- **Decisión:** el puerto falso devuelve `of(...)`, `throwError(...)` o un `Subject` sin emitir (carga). Se usan los datos de `simulated-data.ts`, que son los de la sección 4.1.
- **Por qué:** pruebas rápidas y deterministas que ejercitan la pantalla y el caso de uso juntos.
- **Dónde se ve:** `src/test/ui/pages/movements/movements-page.spec.ts`.

### D-21 `npm test` corre todo una vez en Chrome headless
- **Tema:** pruebas
- **Contexto:** el enunciado pide ejecutar las pruebas con un solo comando.
- **Decisión:** `"test": "ng test --watch=false --browsers=ChromeHeadless"`; `npm run test:watch` para desarrollo.
- **Alternativas consideradas:** dejar `ng test` (queda en modo observación y abre una ventana).
- **Dónde se ve:** `package.json`.

### D-22 No usar alias de rutas (`@app/...`)
- **Tema:** proceso
- **Contexto:** los imports relativos desde `src/test` son largos.
- **Alternativas consideradas:** `paths` en `tsconfig.json`.
- **Decisión:** no usarlos.
- **Por qué:** el enunciado no los pide y el proyecto es pequeño; priorizo el tiempo.
- **Consecuencias y trade-offs:** imports largos.

### D-23 Mantener la sesión viva solo mientras hay actividad, con aviso antes de vencer
- **Tema:** seguridad
- **Contexto:** los tesoreros pierden lo diligenciado porque la sesión vence a mitad de la transferencia. La sesión vence a los 5 minutos y solo `POST /sesion/renovar` la extiende. El portal se usa en computadores compartidos.
- **Alternativas consideradas:**
  - Renovar cada 4 minutos siempre: nunca vence, pero deja abierta una sesión desatendida en un computador compartido (rompe el propósito del vencimiento).
  - Guardar el borrador del formulario para recuperarlo tras volver a entrar: prohibido por la política (no se guardan datos en el navegador).
  - Renovar solo al enviar: si el tesorero tarda más de 5 minutos, la sesión ya venció.
  - **`SessionKeeper`:** registra la actividad real (teclado, puntero, escritura); si hubo actividad desde la última renovación, renueva cuando faltan 2 minutos; si no, avisa cuando falta 1 minuto con un botón "Seguir conectado"; antes de cada transferencia exige al menos 1 minuto de sesión.
- **Decisión:** `SessionKeeper` en `application/session`, iniciado por el componente raíz; aviso en una franja `role="alert"`.
- **Por qué:** resuelve la queja sin extender sesiones desatendidas, y cumple WCAG 2.2.1 (ajustar tiempo: avisar y permitir extenderlo con una acción simple).
- **Consecuencias y trade-offs:** una petición de renovación cada ~3 minutos por usuario activo. Si el tesorero ignora el aviso, la sesión vence y el formulario conserva los datos en memoria, pero no puede enviarse.
- **Dónde se ve:** `application/session/session-keeper.ts`, `app.ts`, `app.html`, `session-keeper.spec.ts`.

### D-24 Token CSRF solo en memoria y agregado por un interceptor
- **Tema:** seguridad
- **Contexto:** las peticiones que cambian datos llevan `X-CSRF-Token`; el token cambia en cada renovación; nada puede quedar en el navegador.
- **Alternativas consideradas:** guardarlo en `sessionStorage` (prohibido); pasarlo a mano en cada adaptador (fácil de olvidar); **un `signal` en memoria y un interceptor**.
- **Decisión:** `CsrfTokenStore` guarda el token en memoria; `csrfInterceptor` lo agrega a POST/PUT/PATCH/DELETE hacia `/api/...` y nunca a otros dominios. Al vencer la sesión se borra.
- **Por qué:** un solo lugar, siempre el token más reciente, sin persistencia.
- **Consecuencias y trade-offs:** al recargar la página se pierde el token y se pide otro con la renovación inicial.
- **Dónde se ve:** `application/session/csrf-token.store.ts`, `infrastructure/http/csrf.interceptor.ts`, `csrf.interceptor.spec.ts`.

### D-25 Idempotencia: una clave por intento, reutilizada al reintentar con los mismos datos
- **Tema:** seguridad
- **Contexto:** un doble clic o un reintento no pueden crear dos transferencias. El servidor repite el 201 original con la misma `Idempotency-Key` y el mismo cuerpo, y responde 409 con otro cuerpo.
- **Alternativas consideradas:**
  - Clave nueva en cada clic: un reintento tras una falla de red podría duplicar la transferencia.
  - Clave fija para toda la vida del formulario: dos transferencias distintas e intencionales chocarían (409).
  - **Clave atada a una huella de los datos de la transferencia, sin la clave dinámica.**
- **Decisión:** se genera con `crypto.randomUUID()` y se reutiliza mientras los datos no cambien. La clave dinámica no entra en la huella: si el tesorero reintenta con una clave nueva tras un fallo, se conserva la misma `Idempotency-Key` y el servidor responde 409 si la primera sí se creó, en vez de crear otra. Tras un 201 la clave se descarta.
- **Por qué:** el caso peligroso es "no sé si se hizo"; ahí el mensaje dice que puede reenviar sin duplicar.
- **Consecuencias y trade-offs:** tras un 409 se pide revisar Movimientos antes de reenviar.
- **Dónde se ve:** `transfer-page.ts` (`attempt`, `fingerprint`), pruebas "reuses the same Idempotency-Key..." y "uses a new Idempotency-Key...".

### D-26 Doble clic: envío ignorado mientras hay uno en curso, con `aria-disabled`
- **Tema:** diseño
- **Contexto:** evitar envíos duplicados sin perder accesibilidad.
- **Alternativas consideradas:** `disabled` en el botón (el botón pierde el foco y el lector de pantalla deja de anunciarlo); `exhaustMap` sobre un flujo de clics (más difícil de explicar); **una señal `pending` que ignora el clic y `aria-disabled="true"`**.
- **Decisión:** `pending` + texto "Enviando…" + región `role="status"`. La idempotencia del servidor queda como segunda defensa.
- **Dónde se ve:** `transfer-page.ts` (`submit`), prueba "sends a single transfer on double click".

### D-27 Reglas de transferencia como funciones puras, adaptadas a validadores de Angular
- **Tema:** arquitectura
- **Contexto:** las reglas de la sección 4.1 son del negocio, no de Angular.
- **Alternativas consideradas:** validadores de Angular con las reglas adentro (atadas al framework); **funciones puras en `application/transfer/transfer-rules.ts`** y validadores delgados en la UI.
- **Decisión:** `validateAmount`, `validateAccountNumber`, `validateDocumentNumber`, `validateDescription`, `validateDynamicKey`, `parseAmountInput`; `transfer-validators.ts` solo las adapta.
- **Por qué:** se prueban sin TestBed y se reutilizarían en otra pantalla.
- **Dónde se ve:** `transfer-rules.ts`, `transfer-validators.ts`, `transfer-rules.spec.ts`.

### D-28 Monto con coma decimal; el punto se rechaza
- **Tema:** seguridad
- **Contexto:** "1.500" en Colombia es mil quinientos; leído como decimal sería 1,50. Un error así transfiere mil veces menos o más.
- **Alternativas consideradas:** aceptar punto y coma (ambiguo); campo numérico `type="number"` (depende del idioma del navegador, acepta "e" y cambia el valor con la rueda del mouse); **texto con `inputmode="decimal"`, solo dígitos y coma**.
- **Decisión:** regex `^\d+(,\d{1,2})?$`, conversión a centavos enteros y al formato del contrato ("1500000.50"), y una vista previa "Vas a transferir $ 1.500.000,50".
- **Por qué:** elimina la ambigüedad y el tesorero ve el valor interpretado antes de enviar.
- **Dónde se ve:** `transfer-rules.ts` (`parseAmountInput`), `transfer-page.html`.

### D-29 Datos sensibles: sin persistencia, sin autocompletar, sin corrector y borrado tras el envío
- **Tema:** seguridad
- **Contexto:** computadores compartidos; ningún dato personal o financiero puede quedar en el navegador ni en la consola.
- **Decisión:** el formulario vive solo en memoria; `autocomplete="off"` en cuenta, documento y monto (el navegador no los sugiere al siguiente usuario); `autocomplete="one-time-code"` en la clave dinámica; `spellcheck="false"` (algunos correctores envían el texto a servicios externos); la clave se borra si el monto baja del umbral o si la API la rechaza; el formulario se limpia tras un 201; el comprobante muestra solo la cuenta enmascarada que entrega la API; ningún `console.log`.
- **Alternativas consideradas:** guardar un borrador cifrado en `sessionStorage` (sigue siendo almacenamiento en el navegador).
- **Dónde se ve:** `transfer-page.html`, `transfer-page.ts`, prueba "shows the receipt with the masked destination account...".

### D-30 Errores de la API junto a cada campo y resumen de errores enfocable
- **Tema:** diseño
- **Contexto:** se deben mostrar junto a cada campo los errores de la API; WCAG 2.2 AA (3.3.1, 3.3.3, 4.1.2).
- **Alternativas consideradas:** solo un mensaje general (no dice qué corregir); **error por campo + resumen**.
- **Decisión:** `errores[].campo` del 400 coincide con el nombre del control (por eso se conservaron los nombres del contrato) y se marca con `setErrors({ api: codigo })`. Los 422 de tope van al monto y el de clave dinámica a su campo. Cada campo tiene `aria-invalid` y `aria-describedby` hacia su pista y su error. Al enviar con errores se enfoca un resumen con enlaces a cada campo. Los errores generales (401, 409, 429, 503) van en `role="alert"`.
- **Por qué:** el tesorero sabe qué corregir y el lector de pantalla lo anuncia.
- **Dónde se ve:** `transfer-page.ts` (`handleError`, `showSummary`), `transfer-messages.ts`.

### D-31 Revisión automática de accesibilidad con axe-core en las pruebas
- **Tema:** pruebas
- **Contexto:** el enunciado pide una revisión automática de accesibilidad.
- **Alternativas consideradas:** Lighthouse o pa11y (requieren levantar la app y otro proceso); `jest-axe` (es para Jest, no Karma); **axe-core dentro de las pruebas de Karma**.
- **Decisión:** `expectNoAccessibilityViolations` corre axe con las reglas `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` sobre el formulario (vacío y con errores) y sobre Movimientos con datos.
- **Por qué:** corre con `npm test`, sin pasos extra. Se comprobó que detecta violaciones reales con un HTML defectuoso.
- **Consecuencias y trade-offs:** axe encuentra cerca de un tercio de los problemas; no reemplaza una revisión manual con teclado y lector de pantalla.
- **Dónde se ve:** `src/test/support/axe.ts`, pruebas de ambas pantallas.

### D-32 Sin paso de confirmación antes de transferir
- **Tema:** diseño
- **Contexto:** muchos bancos muestran "Confirma los datos" antes de enviar.
- **Alternativas consideradas:** pantalla de confirmación (más segura ante errores de digitación, pero es una pantalla más y el enunciado pide no agregar pantallas).
- **Decisión:** no agregarla; en su lugar, vista previa del monto interpretado.
- **Consecuencias y trade-offs:** si el banco la exige, se agregaría como un estado del mismo componente.

## Qué probé y qué no

- **Probado automáticamente (56 pruebas con `npm test`):**
  - Movimientos: estados, agrupación por día contable con los datos de la sección 4.1, filas, cambio de periodo, accesibilidad.
  - Transferencia: errores junto a cada campo, documento según tipo, monto sin puntos de miles, clave dinámica desde 2.000.000, cuerpo del contrato con ceros iniciales, doble clic, misma `Idempotency-Key` al reintentar y nueva si cambian los datos, errores de la API por campo, topes, clave rechazada, sesión vencida conservando datos, comprobante enmascarado, accesibilidad.
  - Sesión: renovación al iniciar, renovación silenciosa con actividad, aviso sin actividad, vencimiento, renovación antes de transferir, 401.
  - CSRF, adaptadores HTTP y reglas de la API simulada.
- **Medido:** JavaScript inicial de 94,20 KB comprimido (límite: 250 KB); el formulario se carga aparte (14,19 KB).
- **No probado:** Edge y Firefox de forma automática (las pruebas corren en Chrome; se evitaron APIs no soportadas, como `input type="month"`); revisión manual con lector de pantalla; rendimiento con 50.000 registros (Parte 3).

## Lo que dejé fuera y por qué

- Paginación, búsqueda y orden en Movimientos: corresponden a la Parte 3 (la API simulada ya los soporta).
- Inicio de sesión: fuera del alcance (el enunciado excluye integrar autenticación). Al vencer, la app pide volver a iniciar sesión.

## Si tuviera más tiempo
