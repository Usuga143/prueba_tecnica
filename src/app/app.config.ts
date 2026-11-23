import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localeEsCo from '@angular/common/locales/es-CO';
import {
  ApplicationConfig,
  LOCALE_ID,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { MovementPort } from './domain/ports/movement/movement.port';
import { SessionPort } from './domain/ports/session/session.port';
import { TransferPort } from './domain/ports/transfer/transfer.port';
import { MovementHttpAdapter } from './infrastructure/adapters/movement/movement-http.adapter';
import { SessionHttpAdapter } from './infrastructure/adapters/session/session-http.adapter';
import { TransferHttpAdapter } from './infrastructure/adapters/transfer/transfer-http.adapter';
import { csrfInterceptor } from './infrastructure/http/csrf.interceptor';
import { simulatedApiInterceptor } from './infrastructure/mock/simulated-api';

registerLocaleData(localeEsCo);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    // El orden importa: csrfInterceptor agrega el token antes de que la petición salga.
    // API simulada: para conectar la API real, quitar simulatedApiInterceptor de esta lista.
    provideHttpClient(withInterceptors([csrfInterceptor, simulatedApiInterceptor])),
    { provide: LOCALE_ID, useValue: 'es-CO' },
    // Puerto -> adaptador: único lugar donde se decide la implementación.
    { provide: MovementPort, useClass: MovementHttpAdapter },
    { provide: TransferPort, useClass: TransferHttpAdapter },
    { provide: SessionPort, useClass: SessionHttpAdapter },
  ],
};
