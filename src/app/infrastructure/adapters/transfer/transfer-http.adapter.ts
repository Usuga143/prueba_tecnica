import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { TransferReceipt, TransferRequest } from '../../../domain/model/transfer/transfer.model';
import { TransferPort } from '../../../domain/ports/transfer/transfer.port';
import { toApiError } from '../../http/api-error.mapper';

@Injectable()
export class TransferHttpAdapter implements TransferPort {
  private readonly http = inject(HttpClient);

  // X-CSRF-Token lo agrega csrfInterceptor a todas las peticiones que cambian datos.
  create(request: TransferRequest, idempotencyKey: string): Observable<TransferReceipt> {
    const headers = new HttpHeaders({ 'Idempotency-Key': idempotencyKey });
    return this.http
      .post<TransferReceipt>('/api/v1/transferencias', request, { headers })
      .pipe(catchError((error: unknown) => throwError(() => toApiError(error))));
  }
}
