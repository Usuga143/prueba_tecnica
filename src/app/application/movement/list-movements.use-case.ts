import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Movement,
  MovementDayGroup,
  MovementsQuery,
  MovementsResponse,
} from '../../domain/model/movement/movement.model';
import { MovementPort } from '../../domain/ports/movement/movement.port';

const COLOMBIA_OFFSET_MS = 5 * 60 * 60 * 1000;
const MIN_SEARCH_LENGTH = 3;

export function toColombiaDayAndTime(fechaHora: string): { day: string; time: string } {
  const colombia = new Date(Date.parse(fechaHora) - COLOMBIA_OFFSET_MS).toISOString();
  return { day: colombia.slice(0, 10), time: colombia.slice(11, 16) };
}

export function groupByAccountingDay(movements: Movement[]): MovementDayGroup[] {
  const groups: MovementDayGroup[] = [];
  for (const movement of movements) {
    const { day, time } = toColombiaDayAndTime(movement.fechaHora);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.day === day) {
      lastGroup.items.push({ movement, time });
    } else {
      groups.push({ day, items: [{ movement, time }] });
    }
  }
  return groups;
}

@Injectable({ providedIn: 'root' })
export class ListMovementsUseCase {
  private readonly movementPort = inject(MovementPort);

  execute(query: MovementsQuery): Observable<MovementsResponse> {
    const q = query.q?.trim();
    return this.movementPort.getMovements({
      ...query,
      q: q && q.length >= MIN_SEARCH_LENGTH ? q : undefined,
    });
  }
}
