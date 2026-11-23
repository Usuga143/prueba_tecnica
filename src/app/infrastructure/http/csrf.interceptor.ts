import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { CsrfTokenStore } from '../../application/session/csrf-token.store';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Agrega X-CSRF-Token a las peticiones que cambian datos. Solo a rutas propias (/api/...),
 * para no enviar el token a otros dominios.
 */
export const csrfInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(CsrfTokenStore).token();
  if (token === null || !MUTATING_METHODS.has(req.method) || !req.url.startsWith('/api/')) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { 'X-CSRF-Token': token } }));
};
