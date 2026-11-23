import { HttpErrorResponse } from '@angular/common/http';
import { ApiError } from '../../domain/model/shared/api-error.model';

/** Traduce cualquier error HTTP a la forma de error del contrato, para que la UI no dependa de HttpClient. */
export function toApiError(error: unknown): ApiError {
  if (!(error instanceof HttpErrorResponse)) {
    return { status: 0, codigo: 'ERROR_DESCONOCIDO', mensaje: '' };
  }
  const body = (
    typeof error.error === 'object' && error.error !== null ? error.error : {}
  ) as Partial<ApiError>;
  const retryAfter = Number(error.headers.get('Retry-After'));

  return {
    status: error.status,
    codigo:
      typeof body.codigo === 'string'
        ? body.codigo
        : error.status === 0
          ? 'SIN_CONEXION'
          : 'ERROR_DESCONOCIDO',
    mensaje: typeof body.mensaje === 'string' ? body.mensaje : '',
    errores: Array.isArray(body.errores) ? body.errores : undefined,
    retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
  };
}
