import { Injectable, inject } from '@angular/core';
import { Observable, switchMap } from 'rxjs';
import { TransferReceipt, TransferRequest } from '../../domain/model/transfer/transfer.model';
import { TransferPort } from '../../domain/ports/transfer/transfer.port';
import { SessionKeeper } from '../session/session-keeper';

@Injectable({ providedIn: 'root' })
export class CreateTransferUseCase {
  private readonly transferPort = inject(TransferPort);
  private readonly session = inject(SessionKeeper);

  /** Renueva la sesión si está por vencer y luego envía. La misma clave evita duplicados al reintentar. */
  execute(request: TransferRequest, idempotencyKey: string): Observable<TransferReceipt> {
    return this.session
      .ensureFresh()
      .pipe(switchMap(() => this.transferPort.create(request, idempotencyKey)));
  }
}
