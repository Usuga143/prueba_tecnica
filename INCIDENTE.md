# INC-2026-1187 — Movimientos muestra resultados de otra búsqueda y se congela

**Fecha:** 12 de noviembre de 2026, 14:03–14:10 (hora de Colombia) · **Cuenta:** REC-2231 · **Equipo:** Edge 130, portátil de 8 GB (línea 01)

**Síntoma reportado (línea 39):** "busqué nómina y salen pagos a Nomad y totales de otra búsqueda; después se congeló".

Hay dos síntomas con dos causas distintas: **resultados equivocados** y **congelamiento**.

## Línea de tiempo resumida

| Líneas | Qué pasó |
|---|---|
| 01–05 | Carga inicial sana: 200 registros en 382 ms, render de 48 ms, 2.412 nodos, 38 MB. |
| 06–15 | El tesorero escribe "nomina" a ~170 ms por tecla. Desde "nom" sale **una petición por tecla** (r3, r4, r5, r6), sin esperar ni cancelar las anteriores. |
| 16–19 | Las respuestas llegan **en orden inverso**: r6 "nomina" (341 ms) primero y r3 "nom" (1.870 ms) al final. |
| 20–21 | La lista queda con **1.000 filas** (las 4 respuestas acumuladas más la inicial). La pantalla dice buscador="nomina" pero contador "9876 resultados" (el total de r3 "nom") y la fila 1 es "Pago proveedor Nomad Logistica", que coincide con "nom" pero no con "nomina". |
| 23–26 | Al llegar al final, la página siguiente se pide con `q=nom&cursor=c3-0200`: el cursor de la búsqueda vieja. Se agregan 200 filas más de "nom". |
| 27 | `TypeError: Cannot read properties of null (reading 'trim')` en MV-8812044, el movimiento con `referencia: null`. |
| 28–37 | Las filas, los nodos y la memoria crecen juntos: 4.200 filas / 50.652 nodos → 9.800 filas / 118.188 nodos; heap 212 → 488 → 611 MB; tareas largas de 1.380 ms y 4.120 ms. |
| 30–33 | Al ordenar por monto se pide `orden=monto_desc` (todavía con `q=nom`) **y además** se ordenan en el cliente 4.400 filas (920 ms). |
| 35, 38 | INP de 2.340 ms en el buscador; Edge muestra "La página no responde". |

## Hipótesis descartadas

| # | Hipótesis | Por qué se descarta | Línea |
|---|---|---|---|
| H1 | La API es lenta o falla. | El p95 está en 391 ms y 402 ms (meta: 400 ms) con 0,02 % de errores 5xx. La carga inicial tomó 382 ms. La respuesta lenta (r3, 1.870 ms) llegó bien; el problema es que el cliente la aplicó tarde. | 22, 40, 02 |
| H2 | La API devolvió resultados equivocados para "nomina". | r6 "nomina" respondió `totalRegistros=1204`, un valor coherente. El 9876 que muestra la pantalla es el total de r3 "nom". | 16, 19, 21 |
| H3 | El banco limitó las peticiones (429). | El APM indica "sin respuestas 429". | 40 |
| H4 | El equipo o la red no alcanzan. | Edge 130 con 8 GB es el equipo de referencia de la sección 6. Con 200 filas el render tomó 48 ms. La degradación crece con el número de filas, no con el equipo. | 01, 02, 03 |
| H5 | El error de fuente por la CSP congela la página. | Es una advertencia: el navegador usa otra fuente y sigue. Ocurre en el segundo 1, con la pantalla aún fluida (líneas 03 y 05). | 04 |
| H6 | El `TypeError` de `trim` causa el congelamiento. | Ocurre a las 14:05:02. Las tareas largas empezaron antes (14:03:17, 310 ms, y 14:03:26, 402 ms) y siguieron creciendo después. Es un defecto real (una fila no se pinta), pero no explica ni el síntoma de resultados ni el de congelamiento. | 20, 26, 27 |
| H7 | Fuga de memoria del navegador. | La memoria crece en proporción a las filas: unos 12 nodos por fila en todo el registro (2.412/200 ≈ 50.652/4.200 ≈ 118.188/9.800 ≈ 12). Es la aplicación la que acumula, no Edge. | 03, 29, 36, 28, 34, 37 |

## Causa raíz

**1. Resultados de otra búsqueda: condición de carrera en la búsqueda.**
El buscador enviaba una petición por cada tecla desde 3 caracteres (líneas 09–15), sin esperar a que el usuario terminara, y **aplicaba cada respuesta en el orden en que llegaba, acumulándola** en la lista. La búsqueda más amplia ("nom", 9.876 resultados) fue la más lenta (1.870 ms) y llegó de última, así que su total y sus filas quedaron en pantalla con el texto "nomina" en el buscador (líneas 19–21). Después, la paginación usó el cursor de esa respuesta vieja (`cursor=c3-0200`, línea 24), que el contrato solo admite "con los mismos parámetros", y agregó más resultados de "nom".

**2. Congelamiento: lista sin virtualizar y orden en el cliente.**
La lista pintaba **todas** las filas acumuladas, unos 12 nodos por fila, hasta 118.188 nodos (línea 36). Cada página nueva repintaba todo: 310 → 402 → 1.380 → 4.120 ms (líneas 20, 26, 29, 36). Al ordenar, además del orden en el servidor, se ordenaban en el hilo principal los datos acumulados y mezclados (920 ms, línea 33). El resultado: INP de 2.340 ms, 611 MB de memoria y "La página no responde" (líneas 35, 37, 38).

**Defecto adicional:** el componente de fila asumía que `referencia` siempre es texto, pero el contrato admite `null` (línea 27).

## Cómo lo evita la solución nueva

| Causa | Medida | Dónde | Evidencia |
|---|---|---|---|
| Una petición por tecla | Espera de 300 ms sin escribir (`debounceTime`), mínimo 3 caracteres y `distinctUntilChanged`. Escribiendo "nomina" a ~150–170 ms por tecla sale **una** petición. | `movements-page.ts` (`search$`) y `ListMovementsUseCase` | Prueba "searches once after the treasurer stops typing..." |
| Respuestas aplicadas en orden de llegada | `switchMap`: cada consulta nueva **cancela** la anterior y su paginación; una respuesta vieja nunca llega a la pantalla. | `movements-page.ts` (`state`) | Prueba "ignores a slow response of an older search (root cause of INC-2026-1187)": "nom" llega después de "nomina" y la pantalla muestra "1.204 resultados para «nomina»". |
| Resultados acumulados entre búsquedas | Cada consulta empieza de cero. El contador, las filas y el cursor salen de la misma respuesta. | `firstPage` / `appendPage` | Mismo test. |
| Cursor de otra búsqueda | El cursor vive dentro de la consulta que lo generó (closure de `switchMap`). La API simulada rechaza con 400 un cursor de otros parámetros. | `loadQuery`, `simulated-api.ts` | Pruebas "loads the next page with the cursor of the same query" y "paginates with a cursor bound to the same parameters". |
| Todas las filas en el DOM | Lista virtual (`@angular/cdk/scrolling`) con alto fijo de fila: solo se dibujan las filas visibles más un margen. Una página a la vez (`exhaustMap`). | `movements-page.html` | Medición: con 5.000 movimientos cargados, **319 nodos** y 39 filas dibujadas; agregar 200 filas toma **≤ 40 ms**; saltar a la mitad de la lista, 35 ms. |
| Orden en el cliente | El orden se pide solo al servidor (`orden`), desde la primera página. El cliente nunca ordena. | `movements-page.ts`, `simulated-api.ts` | Prueba "sorts on the server...". |
| `referencia: null` | Tipo `string \| null` con TypeScript estricto; la fila muestra "Sin referencia". | `movement.model.ts`, plantilla | Prueba "shows time, description, reference...". |
| Fuente bloqueada por CSP | Fuentes del sistema. | `styles.scss` | — |

## Recomendaciones de observabilidad

- Registrar en RUM el identificador de la consulta (parámetros) junto con cada respuesta aplicada, para detectar respuestas fuera de orden.
- Alertar por tareas largas mayores de 200 ms y por más de 5.000 nodos en la vista de movimientos.
