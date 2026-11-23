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
import { MovementHttpAdapter } from './infrastructure/adapters/movement/movement-http.adapter';
import { simulatedApiInterceptor } from './infrastructure/mock/simulated-api';

registerLocaleData(localeEsCo);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    // API simulada: para conectar la API real, quitar simulatedApiInterceptor de esta lista.
    provideHttpClient(withInterceptors([simulatedApiInterceptor])),
    { provide: LOCALE_ID, useValue: 'es-CO' },
    // Puerto -> adaptador: único lugar donde se decide la implementación.
    { provide: MovementPort, useClass: MovementHttpAdapter },
  ],
};
