import { Observable } from 'rxjs';
import { SessionRenewal } from '../../model/session/session.model';

export abstract class SessionPort {
  abstract renew(): Observable<SessionRenewal>;
}
