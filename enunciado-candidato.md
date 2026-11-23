# Prueba técnica — Desarrollador de Software (front-end) — DS-FE-20261119-xpjf

## 1. Antes de empezar

- Tienes 120 minutos desde que abres este documento. Registra en DECISIONES.md la hora de inicio, la hora en que terminaste la Parte 1 y la hora de fin.
- Lee todo el enunciado antes de empezar. Las tres partes son obligatorias.
- Tiempo sugerido: Parte 1 30 min · Parte 2 25 min · Parte 3 20 min · DECISIONES.md 12 min.
- Si el tiempo no alcanza, trabaja en este orden: Parte 1, Parte 2, Parte 3. Entrega lo que tengas y explica en DECISIONES.md qué faltó y cómo lo resolverías.
- No se espera: back-end real; diseño visual propio de alta fidelidad; despliegue en la nube; integración con proveedores reales de autenticación; más endpoints, pantallas o entidades de los indicados.
- Si algo es ambiguo, no preguntes: decide, documenta el supuesto en DECISIONES.md y sigue.
- Se valora la solución más adecuada para el contexto descrito: rendimiento, seguridad, mantenibilidad y buenas prácticas. Que funcione no basta.

## 2. Contexto de negocio

Banco Cordillera (ficticio) atiende pymes con su Portal Empresas. Los tesoreros lo usan para revisar los movimientos de sus cuentas recaudadoras, conciliarlos contra el extracto mensual y pagar a proveedores y empleados. Casi todas las pymes operan el portal desde un computador compartido de tesorería, y varias tienen tesoreros en sus sedes de Ciudad de Panamá, Miami y Madrid.

El portal actual se congela con las cuentas de alto volumen, a veces muestra resultados que no corresponden a lo buscado y cierra la sesión en medio de las transferencias. El banco reconstruirá el cliente web sobre la API actual (sección 4.2).

## 3. Objetivo

Construir desde cero, en Angular, React o Vue, el cliente de las pantallas Movimientos de la cuenta y Nueva transferencia, contra una API que tú simulas a partir del contrato, listo para producción en un banco.

## 4. Datos iniciales y glosario

Estos son los únicos insumos de la prueba. No necesitas buscar información externa.

### 4.1 Datos de ejemplo

Usuario de la prueba: tesoreria.andina, tesorero de Distribuidora Andina S.A.S., titular de la cuenta corriente recaudadora REC-2231 (moneda COP). En octubre de 2026 la cuenta registró 50000 movimientos, en su mayoría recaudos PSE y de corresponsales bancarios.

Respuesta de ejemplo de GET /api/v1/cuentas/REC-2231/movimientos?desde=2026-10-01&hasta=2026-10-31&limite=200 (primeros registros, orden por defecto):

```json
{
  "cuenta": { "id": "REC-2231", "numeroEnmascarado": "XXXX2231", "titular": "Distribuidora Andina S.A.S.", "moneda": "COP" },
  "totalRegistros": 50000,
  "movimientos": [
    { "id": "MV-8849999", "fechaHora": "2026-11-01T04:30:00Z", "descripcion": "Recaudo PSE factura 10-9902", "referencia": "10-9902", "monto": "3999999.99", "estado": "EN_PROCESO" },
    { "id": "MV-8849990", "fechaHora": "2026-10-31T21:10:09Z", "descripcion": "Comision transferencia", "referencia": "COM-1031", "monto": "-7140.00", "estado": "APLICADO" },
    { "id": "MV-8849987", "fechaHora": "2026-10-31T15:02:44Z", "descripcion": "Pago nomina quincena 2", "referencia": "NOM-2026-20", "monto": "-48730500.50", "estado": "APLICADO" },
    { "id": "MV-8812044", "fechaHora": "2026-10-14T19:22:31Z", "descripcion": "Recaudo corresponsal Tienda La 80", "referencia": null, "monto": "86400.00", "estado": "APLICADO" },
    { "id": "MV-8800002", "fechaHora": "2026-10-01T15:40:00Z", "descripcion": "Pago proveedor Nomad Logistica", "referencia": "PRV-5531", "monto": "-12500000.00", "estado": "APLICADO" },
    { "id": "MV-8800001", "fechaHora": "2026-10-01T05:05:12Z", "descripcion": "Recaudo PSE factura 10-4471", "referencia": "10-4471", "monto": "1250000.00", "estado": "APLICADO" }
  ],
  "siguiente": "c-0200"
}
```

Reglas para transferir desde REC-2231:

| Regla | Valor |
|---|---|
| Tope por transferencia | 50.000.000 COP |
| Tope diario por usuario | 100.000.000 COP |
| Clave dinámica | Obligatoria para montos de 2.000.000 COP o más; 6 dígitos |
| Número de cuenta destino | 6 a 17 dígitos; puede empezar por cero (ej.: 0045987123) |
| Documento del titular | CC o CE: 6 a 10 dígitos · NIT: 9 dígitos · PA: 5 a 12 letras o dígitos |
| Monto | Mayor que cero, máximo 2 decimales |
| Descripción | Opcional, hasta 40 caracteres: letras, dígitos y espacios |

Bancos destino: 0001 Banco Cordillera · 0002 Banco del Valle Andino · 0003 Banco Caribe · 0004 Cooperativa Financiera Llanos · 0005 Banco Pacífico Digital · 0006 Banco Altiplano.

Registro del incidente INC-2026-1187 del portal actual (40 líneas, hora de Colombia, 12 de noviembre de 2026; «…» abrevia /api/v1/cuentas/REC-2231/movimientos?desde=2026-10-01&hasta=2026-10-31):

```text
01 14:03:10.112 [rum] inicio de vista Movimientos · cuenta REC-2231 · Edge 130 · portátil 8 GB
02 14:03:10.540 [red] r1 GET …&limite=200 -> 200 en 382 ms · 200 registros · siguiente=c1-0200
03 14:03:10.910 [rendimiento] render ListaMovimientos · filas=200 · nodosDOM=2412 · 48 ms
04 14:03:11.003 [consola] warn Refused to load the font https://fonts.cdn-externo.com/inter.woff2 (CSP font-src 'self')
05 14:03:11.020 [memoria] heap usado 38 MB
06 14:03:15.201 [rum] buscador valor="n"
07 14:03:15.388 [rum] buscador valor="no"
08 14:03:15.570 [rum] buscador valor="nom"
09 14:03:15.571 [red] r3 GET …&q=nom&limite=200 -> enviada
10 14:03:15.742 [rum] buscador valor="nomi"
11 14:03:15.743 [red] r4 GET …&q=nomi&limite=200 -> enviada
12 14:03:15.905 [rum] buscador valor="nomin"
13 14:03:15.906 [red] r5 GET …&q=nomin&limite=200 -> enviada
14 14:03:16.080 [rum] buscador valor="nomina"
15 14:03:16.081 [red] r6 GET …&q=nomina&limite=200 -> enviada
16 14:03:16.422 [red] r6 -> 200 en 341 ms · 200 registros · totalRegistros=1204 · siguiente=c6-0200
17 14:03:16.596 [red] r5 -> 200 en 690 ms · 200 registros · totalRegistros=1311 · siguiente=c5-0200
18 14:03:16.645 [red] r4 -> 200 en 902 ms · 200 registros · totalRegistros=2087 · siguiente=c4-0200
19 14:03:17.441 [red] r3 -> 200 en 1870 ms · 200 registros · totalRegistros=9876 · siguiente=c3-0200
20 14:03:17.702 [rendimiento] render ListaMovimientos · filas=1000 · nodosDOM=12060 · 310 ms (tarea larga)
21 14:03:17.705 [rum] pantalla: buscador="nomina" · contador="9876 resultados" · fila 1 "Pago proveedor Nomad Logistica"
22 14:03:20.130 [apm] API movimientos, últimos 15 min: p95=391 ms · errores 5xx=0,02 %
23 14:03:24.880 [rum] desplazamiento hasta el final de la lista
24 14:03:24.881 [red] r7 GET …&q=nom&cursor=c3-0200&limite=200 -> enviada
25 14:03:26.310 [red] r7 -> 200 en 1429 ms · 200 registros · siguiente=c3-0400
26 14:03:26.640 [rendimiento] render ListaMovimientos · filas=1200 · nodosDOM=14472 · 402 ms (tarea larga)
27 14:05:02.417 [consola] error TypeError: Cannot read properties of null (reading 'trim') at FilaMovimiento (MV-8812044)
28 14:05:40.000 [memoria] heap usado 212 MB
29 14:06:55.310 [rendimiento] render ListaMovimientos · filas=4200 · nodosDOM=50652 · 1380 ms (tarea larga)
30 14:07:10.100 [rum] orden cambiado a "monto_desc"
31 14:07:10.102 [red] r23 GET …&q=nom&orden=monto_desc&limite=200 -> enviada
32 14:07:10.560 [red] r23 -> 200 en 458 ms · 200 registros · siguiente=c23-0200
33 14:07:12.020 [rendimiento] ordenamiento en cliente · filas=4400 · 920 ms (tarea larga)
34 14:07:40.000 [memoria] heap usado 488 MB
35 14:08:15.900 [rum] INP 2340 ms en el buscador
36 14:08:52.330 [rendimiento] render ListaMovimientos · filas=9800 · nodosDOM=118188 · 4120 ms (tarea larga)
37 14:09:05.000 [memoria] heap usado 611 MB
38 14:09:20.440 [navegador] Edge: «La página no responde» · el usuario elige Esperar
39 14:09:58.120 [soporte] ticket: "busqué nómina y salen pagos a Nomad y totales de otra búsqueda; después se congeló"
40 14:10:30.000 [apm] API movimientos, últimos 15 min: p95=402 ms · sin respuestas 429
```

### 4.2 Contrato de API o sistema bajo prueba

Base: /api/v1. La sesión viaja en una cookie HttpOnly que crea y valida el servidor; el cliente nunca ve ese valor. Todos los errores tienen la forma { "codigo": string, "mensaje": string, "errores"?: [{ "campo": string, "codigo": string }] }.

```yaml
GET /cuentas/{cuentaId}/movimientos:
  parametros:
    desde: string (AAAA-MM-DD, fecha contable, obligatorio)
    hasta: string (AAAA-MM-DD, fecha contable, obligatorio; periodo máximo 31 días)
    q: string (mínimo 3 caracteres; busca en descripcion y referencia, sin distinguir mayúsculas ni tildes)
    orden: fecha_desc | fecha_asc | monto_desc | monto_asc (por defecto fecha_desc)
    limite: entero 1..200 (por defecto 50)
    cursor: string (valor de "siguiente" de la respuesta anterior con los mismos parámetros)
  200: { cuenta: { id, numeroEnmascarado, titular, moneda },
         totalRegistros: entero,
         movimientos: [ { id: string, fechaHora: string (ISO 8601 en UTC),
                          descripcion: string, referencia: string | null,
                          monto: string (decimal con punto; negativo = débito),
                          estado: APLICADO | EN_PROCESO } ],
         siguiente: string | null }
  400: PARAMETRO_INVALIDO   401: SESION_EXPIRADA   403: SIN_PERMISO
  429: LIMITE_DE_PETICIONES (encabezado Retry-After en segundos)   503: CORE_NO_DISPONIBLE

POST /transferencias:
  encabezados: X-CSRF-Token (obligatorio), Idempotency-Key (UUID, obligatorio)
  cuerpo: { cuentaOrigenId, bancoDestino (código), tipoCuenta: AHORROS | CORRIENTE,
            numeroCuenta: string, tipoDocumento: CC | CE | NIT | PA, numeroDocumento: string,
            monto: string (decimal con punto), descripcion?: string, claveDinamica?: string }
  201: { id, estado: APLICADA | EN_PROCESO, fechaHora, numeroCuentaEnmascarado, comprobante: string }
  400: VALIDACION (con "errores" por campo)   401: SESION_EXPIRADA   403: SIN_PERMISO
  409: TRANSFERENCIA_DUPLICADA (misma Idempotency-Key con otro cuerpo)
  422: TOPE_DIARIO_EXCEDIDO | TOPE_TRANSACCION_EXCEDIDO | CLAVE_DINAMICA_INVALIDA
  Con la misma Idempotency-Key y el mismo cuerpo, responde de nuevo el 201 original sin crear otra transferencia.

POST /sesion/renovar:
  200: { expiraEn: string (ISO 8601 en UTC), csrfToken: string }
  401: SESION_EXPIRADA
```

### 4.3 Glosario del dominio

- Fecha contable: día calendario, en hora de Colombia (UTC−5, sin horario de verano), en que el banco registra un movimiento. Es la fecha que aparece en el extracto mensual y la que usan los parámetros desde y hasta.
- Extracto mensual: documento oficial con los movimientos de la cuenta en un mes de fechas contables; los tesoreros concilian contra él.
- Movimiento en proceso (EN_PROCESO): movimiento registrado que aún no afecta el saldo disponible; puede tardar hasta un día hábil en aplicarse.
- Cuenta recaudadora: cuenta empresarial que recibe pagos de muchos clientes (PSE, corresponsales) y por eso tiene alto volumen de movimientos.
- PSE: botón de pagos en línea entre bancos colombianos.
- Corresponsal bancario: comercio autorizado para recibir pagos en nombre del banco.
- Clave dinámica: código de 6 dígitos que el tesorero lee en la aplicación del banco en su celular y que vence a los 60 segundos.
- Número enmascarado: número de cuenta del que solo se muestran los últimos 4 dígitos (XXXX2231).
- Tesorero: usuario de la pyme autorizado para consultar y transferir.
- Inactividad: tiempo transcurrido sin ninguna petición del portal al servidor.


## 5. Lo que debes resolver

### 5.1 Parte 1: Aplicación y flujo de datos (30 min)

Construir desde cero la aplicación cliente, simular la API a partir del contrato de 3 endpoints y la pantalla de consulta con sus estados de carga, vacío y error, con pruebas de componentes.

Pantalla Movimientos de REC-2231. El tesorero elige un periodo (por defecto, octubre de 2026) y ve los movimientos agrupados por fecha contable, con encabezado por día y, en cada fila, hora, descripción, referencia, monto con signo en pesos y una marca si está en proceso. Desde el error se puede reintentar; una sesión vencida no se muestra como error genérico. La API simulada usa los datos de la sección 4.1. Las pruebas cubren al menos los tres estados y la agrupación por día con esos datos.

Entregables de esta parte: código de la aplicación, API simulada, pruebas de componentes, README.md.

### 5.2 Parte 2: Formulario seguro y accesible (25 min)

Construir el formulario descrito, con datos sensibles, validación, manejo de la sesión, accesibilidad WCAG 2.2 AA y funcionamiento en Google Chrome, Microsoft Edge y Mozilla Firefox.

Pantalla Nueva transferencia: un formulario para transferir desde REC-2231 a otro titular, con banco destino, tipo y número de cuenta, tipo y número de documento, monto, descripción y, cuando aplique, clave dinámica. Aplica las reglas de la sección 4.1 y muestra junto a cada campo los errores de la API. Un doble clic o un reintento no pueden crear dos transferencias. Los tesoreros se quejan de que el portal actual los saca de la sesión a mitad de una transferencia y pierden lo diligenciado; el formulario nuevo debe resolverlo. El comprobante muestra la cuenta destino enmascarada.

Entregables de esta parte: código del formulario, pruebas del formulario.

### 5.3 Parte 3: Rendimiento, incidente y extensión (20 min)

Mostrar los 50000 registros descritos sin degradar la experiencia, controlar las búsquedas concurrentes, analizar el incidente descrito, registrar los riesgos técnicos y dejar una guía para que un desarrollador junior agregue una pantalla.

Movimientos debe servir para octubre completo de REC-2231: el tesorero recorre todos los movimientos, ordena por fecha o monto y busca por descripción o referencia mientras escribe. Tu API simulada genera ese volumen.

- INCIDENTE.md: incidente INC-2026-1187 (sección 4.1): hipótesis descartadas con la línea que lo demuestra, causa raíz y cómo lo evita tu solución.
- RIESGOS.md: riesgos técnicos con probabilidad, impacto y mitigación.
- GUIA-EXTENSION.md: cómo un desarrollador junior agregaría, sin ayuda, la pantalla Detalle del movimiento con tu capa de datos, patrones y pruebas.

Entregables de esta parte: INCIDENTE.md, RIESGOS.md, GUIA-EXTENSION.md.


## 6. Requisitos no funcionales y restricciones

- Navegadores: Google Chrome, Microsoft Edge y Mozilla Firefox, dos últimas versiones. Accesibilidad: WCAG 2.2 AA.
- Equipo de referencia: portátil de 8 GB, red 4G (100 ms).
- Movimientos: primeros registros visibles en 1,5 s o menos tras elegir el periodo; INP menor de 200 ms al buscar y al desplazarse; JavaScript inicial de 250 KB o menos comprimido.
- API: p95 de 400 ms por página; máximo 200 registros por página; más de 10 peticiones por segundo en una sesión reciben 429.
- Sesión: vence tras 5 minutos de inactividad; solo POST /sesion/renovar la extiende. Las peticiones que cambian datos llevan X-CSRF-Token.
- Política del banco: ningún dato personal o financiero puede quedar en el navegador (localStorage, sessionStorage, IndexedDB, caché o cookies legibles por scripts) ni en la consola: el portal se usa en computadores compartidos.
- CSP del portal: default-src 'self'.

## 7. Verificación y calidad

Tu entrega debe incluir pruebas automatizadas que se ejecuten con un solo comando documentado en el README, y al menos una verificación no funcional: una revisión automática de accesibilidad y una medición de rendimiento de la vista con más registros. Indica en DECISIONES.md qué probaste, qué no y por qué.

## 8. Registro de decisiones

DECISIONES.md es obligatorio y se evalúa tanto como la solución. Registra cada decisión que tomes, no solo las grandes: tecnología, arquitectura, patrones, diseño, datos, seguridad, rendimiento, pruebas y lo que decidiste no hacer. Para cada una explica qué alternativas consideraste y por qué elegiste la tuya en este contexto. En la sustentación tendrás que defender cada decisión registrada.

```markdown
# Registro de decisiones — DS-FE-20261119-xpjf
Inicio: <hora> · Fin de la Parte 1: <hora> · Fin: <hora>

## Supuestos
| # | Supuesto | Por qué lo asumí | Qué cambiaría si es falso |
|---|---|---|---|

## Decisiones
### D-01 <Título corto>
- **Tema:** stack | arquitectura | patrón | diseño | datos | seguridad | rendimiento | pruebas | operación | proceso | otro
- **Contexto:** qué problema o restricción obliga a decidir.
- **Alternativas consideradas:** al menos dos, con pros y contras en este contexto.
- **Decisión:** qué elegí.
- **Por qué:** la razón determinante, con datos del enunciado si aplica.
- **Consecuencias y trade-offs:** qué gano, qué sacrifico, qué deuda acepto.
- **Dónde se ve:** archivo, componente, commit o artefacto.

(Una entrada por cada decisión: no solo las grandes. Incluye lo que decidiste no hacer.)

## Lo que dejé fuera y por qué

## Si tuviera más tiempo
```

## 9. Uso de IA

Puedes usar asistentes de IA durante la prueba. No necesitas entregar tus conversaciones con la IA.
Ten presente que la evaluación no termina con la entrega. En una sustentación de 30 minutos, sin asistencia de IA, tendrás que:
- explicar tu solución de memoria y recorrerla sin ayuda;
- defender cada decisión de DECISIONES.md y las alternativas que descartaste;
- adaptar tu solución en vivo a un cambio que se te planteará;
- responder por cualquier parte de lo que entregaste.

Lo que no puedas explicar o defender en la sustentación no cuenta como evidencia, aunque esté en la entrega. Usa la IA como apoyo, pero toma tú cada decisión y asegúrate de entender todo lo que entregas.

## 10. Criterio de completitud

Tu prueba está completa cuando se cumple todo lo siguiente:
- Parte 1: La pantalla de consulta funciona contra la API simulada en sus tres estados y las pruebas de componentes pasan con un solo comando.
- Parte 2: El formulario valida, protege los datos sensibles y la sesión, y pasa la revisión automática de accesibilidad.
- Parte 3: La vista maneja el volumen sin bloquear la interfaz, INCIDENTE.md tiene causa raíz con evidencia y GUIA-EXTENSION.md permite agregar una pantalla sin ayuda.
- DECISIONES.md registra cada decisión con sus alternativas y las tres horas.

Una parte incompleta se evalúa por lo que muestra; lo que no alcanzaste a hacer se explorará en la sustentación.

## 11. Entrega

Entrega un repositorio Git con commits pequeños y descriptivos (la historia de commits se revisa) y un README con los comandos para instalar, ejecutar y probar.

Archivos obligatorios:
- `README.md`
- `DECISIONES.md`
- `INCIDENTE.md`
- `RIESGOS.md`
- `GUIA-EXTENSION.md`
