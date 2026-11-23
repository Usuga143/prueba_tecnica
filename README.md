# Portal Empresas · Banco Cordillera (cliente web)

Cliente Angular de las pantallas **Movimientos de la cuenta** y **Nueva transferencia** del Portal Empresas, construido contra una API simulada a partir del contrato del enunciado (`/api/v1`).

## Requisitos

- Node.js 20.19+, 22.12+ o 24 (soportados por Angular 20). Se desarrolló con Node 26.13.1, que Angular marca como "no soportado"; compila y pasa las pruebas, pero se recomienda una versión LTS.
- Google Chrome instalado (las pruebas corren en Chrome headless).

## Comandos

| Acción | Comando |
|---|---|
| Instalar dependencias | `npm install` |
| Ejecutar en desarrollo | `npm start` y abrir http://localhost:4200 |
| **Ejecutar todas las pruebas (un solo comando)** | `npm test` |
| Pruebas en modo observación | `npm run test:watch` |
| Build de producción | `npm run build` (salida en `dist/portal-empresas`) |

## API simulada

No hay back-end real. El interceptor `src/app/infrastructure/mock/simulated-api.ts` responde en el navegador los 3 endpoints del contrato:

- `GET /api/v1/cuentas/{cuentaId}/movimientos`: periodo por fecha contable de Colombia (máx. 31 días), búsqueda `q` (mín. 3 caracteres, sin distinguir mayúsculas ni tildes), `orden`, `limite` (1..200) y `cursor` atado a los mismos parámetros.
- `POST /api/v1/sesion/renovar`: extiende la sesión 5 minutos y entrega un `csrfToken` nuevo.
- `POST /api/v1/transferencias`: exige `X-CSRF-Token` e `Idempotency-Key`, valida las reglas de la sección 4.1 y aplica idempotencia (misma clave y mismo cuerpo devuelve el 201 original; otro cuerpo, 409).

También simula una latencia de 300 ms, la sesión que vence a los 5 minutos y el límite de 10 peticiones por segundo (429 con `Retry-After`). Los datos son los de la sección 4.1 (`simulated-data.ts`).

Para ver los estados de la pantalla a mano, agrega `?escenario=` a la URL:

| URL | Estado que se ve |
|---|---|
| `/movimientos?escenario=vacio` | Vacío |
| `/movimientos?escenario=error` | Error 503 con "Reintentar" |
| `/movimientos?escenario=sesion` | Sesión vencida (mensaje propio, no error genérico) |
| `/movimientos?escenario=lento` | Carga (respuesta en 3 s) |

La sesión simulada vence a los 5 minutos de abrir la página; recargar la página equivale a iniciar sesión de nuevo.

**Para conectar la API real:** quitar `simulatedApiInterceptor` de `provideHttpClient(...)` en `src/app/app.config.ts`. No hay que cambiar nada más.

## Arquitectura (hexagonal)

```
src/app/
  domain/
    model/          interfaces del contrato (movement, shared/api-error)
    ports/          clases abstractas que la app necesita (MovementPort)
  application/      casos de uso (ListMovementsUseCase + agrupación por día contable)
  infrastructure/
    adapters/       implementaciones de los puertos con HttpClient
    http/           traducción de errores HTTP al formato del contrato
    mock/           API simulada y datos de ejemplo
  ui/pages/         pantallas Angular
  app.config.ts     conexión puerto -> adaptador, locale es-CO, HttpClient
src/test/           pruebas, con la misma estructura que src/app
```

Regla de dependencias: `ui` → `application` → `domain` ← `infrastructure`. La pantalla nunca usa `HttpClient`; pide datos al caso de uso, que habla con el puerto.

## Pruebas

`npm test` ejecuta 24 pruebas (Karma + Jasmine, Chrome headless):

- **Pantalla Movimientos**: estados de carga, vacío, error con reintento y sesión vencida; agrupación por día contable con los datos de la sección 4.1; contenido de cada fila; cambio de periodo.
- **Caso de uso**: conversión UTC → Colombia, agrupación por día y mínimo de 3 caracteres en la búsqueda.
- **Adaptador HTTP**: URL y parámetros del contrato; traducción de errores.
- **API simulada**: filtros, búsqueda sin tildes, orden, paginación por cursor, validaciones, sesión, CSRF e idempotencia.
