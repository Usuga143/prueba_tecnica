import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { MovementsQuery, MovementsResponse } from '../../../domain/model/movement/movement.model';
import { MovementPort } from '../../../domain/ports/movement/movement.port';
import { toApiError } from '../../http/api-error.mapper';

@Injectable()
export class MovementHttpAdapter implements MovementPort {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1';

  getMovements(query: MovementsQuery): Observable<MovementsResponse> {
    let params = new HttpParams().set('desde', query.desde).set('hasta', query.hasta);
    if (query.q) params = params.set('q', query.q);
    if (query.orden) params = params.set('orden', query.orden);
    if (query.limite) params = params.set('limite', query.limite);
    if (query.cursor) params = params.set('cursor', query.cursor);

    const accountId = encodeURIComponent(query.accountId);
    return this.http
      .get<MovementsResponse>(`${this.baseUrl}/cuentas/${accountId}/movimientos`, { params })
      .pipe(catchError((error: unknown) => throwError(() => toApiError(error))));
  }
}
