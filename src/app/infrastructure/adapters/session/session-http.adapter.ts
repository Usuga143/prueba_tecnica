import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { SessionRenewal } from '../../../domain/model/session/session.model';
import { SessionPort } from '../../../domain/ports/session/session.port';
import { toApiError } from '../../http/api-error.mapper';

@Injectable()
export class SessionHttpAdapter implements SessionPort {
  private readonly http = inject(HttpClient);

  renew(): Observable<SessionRenewal> {
    return this.http
      .post<SessionRenewal>('/api/v1/sesion/renovar', null)
      .pipe(catchError((error: unknown) => throwError(() => toApiError(error))));
  }
}
