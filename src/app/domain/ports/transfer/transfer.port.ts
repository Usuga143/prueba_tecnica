import { Observable } from 'rxjs';
import { TransferReceipt, TransferRequest } from '../../model/transfer/transfer.model';

export abstract class TransferPort {
  abstract create(request: TransferRequest, idempotencyKey: string): Observable<TransferReceipt>;
}
