import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Movement,
  MovementRow,
  MovementsQuery,
  MovementsResponse,
} from '../../domain/model/movement/movement.model';
import { MovementPort } from '../../domain/ports/movement/movement.port';

const COLOMBIA_OFFSET_MS = 5 * 60 * 60 * 1000;
export const MIN_SEARCH_LENGTH = 3;

/** Fecha contable (día) y hora en Colombia, UTC−5 sin horario de verano (glosario). */
export function toColombiaDayAndTime(fechaHora: string): { day: string; time: string } {
  const colombia = new Date(Date.parse(fechaHora) - COLOMBIA_OFFSET_MS).toISOString();
  return { day: colombia.slice(0, 10), time: colombia.slice(11, 16) };
}

/**
 * Convierte una página de movimientos en filas para la lista virtual. Con agrupación, inserta un
 * encabezado cada vez que cambia el día contable. Recibe el último día de la página anterior para
 * no repetir el encabezado al agregar páginas.
 */
export function toRows(
  movements: Movement[],
  previousDay: string | null,
  groupByDay: boolean,
): { rows: MovementRow[]; lastDay: string | null } {
  const rows: MovementRow[] = [];
  let lastDay = previousDay;
  for (const movement of movements) {
    const { day, time } = toColombiaDayAndTime(movement.fechaHora);
    if (groupByDay && day !== lastDay) {
      rows.push({ kind: 'day', id: `day-${day}`, day });
    }
    rows.push({ kind: 'movement', id: movement.id, movement, day, time });
    lastDay = day;
  }
  return { rows, lastDay };
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
