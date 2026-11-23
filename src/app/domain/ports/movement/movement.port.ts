import { Observable } from 'rxjs';
import { MovementsQuery, MovementsResponse } from '../../model/movement/movement.model';

export abstract class MovementPort {
  abstract getMovements(query: MovementsQuery): Observable<MovementsResponse>;
}
