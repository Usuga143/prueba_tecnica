import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import {
  ListMovementsUseCase,
  toColombiaDayAndTime,
  toRows,
} from '../../../app/application/movement/list-movements.use-case';
import { MovementsResponse } from '../../../app/domain/model/movement/movement.model';
import { MovementPort } from '../../../app/domain/ports/movement/movement.port';
import { SAMPLE_MOVEMENTS } from '../../../app/infrastructure/mock/simulated-data';

describe('toColombiaDayAndTime', () => {
  it('converts UTC to Colombia time (UTC-5)', () => {
    expect(toColombiaDayAndTime('2026-11-01T04:30:00Z')).toEqual({ day: '2026-10-31', time: '23:30' });
    expect(toColombiaDayAndTime('2026-10-01T05:05:12Z')).toEqual({ day: '2026-10-01', time: '00:05' });
  });
});

describe('toRows', () => {
  it('inserts a header per Colombia accounting day, not per UTC day', () => {
    const { rows, lastDay } = toRows(SAMPLE_MOVEMENTS, null, true);

    expect(rows.filter((r) => r.kind === 'day').map((r) => r.day)).toEqual([
      '2026-10-31',
      '2026-10-14',
      '2026-10-01',
    ]);
    expect(rows.map((r) => r.kind)).toEqual([
      'day', 'movement', 'movement', 'movement', 'day', 'movement', 'day', 'movement', 'movement',
    ]);
    expect(rows[1]).toEqual(jasmine.objectContaining({ id: 'MV-8849999', time: '23:30' }));
    expect(lastDay).toBe('2026-10-01');
  });

  it('does not repeat the header when the next page continues the same day', () => {
    const first = toRows(SAMPLE_MOVEMENTS.slice(0, 2), null, true);
    const second = toRows(SAMPLE_MOVEMENTS.slice(2, 3), first.lastDay, true);

    expect(second.rows.map((r) => r.kind)).toEqual(['movement']);
  });

  it('does not group when sorting by amount', () => {
    const { rows } = toRows(SAMPLE_MOVEMENTS, null, false);
    expect(rows.every((r) => r.kind === 'movement')).toBeTrue();
  });
});

describe('ListMovementsUseCase', () => {
  let getMovements: jasmine.Spy;
  let useCase: ListMovementsUseCase;
  const baseQuery = { accountId: 'REC-2231', desde: '2026-10-01', hasta: '2026-10-31' };

  beforeEach(() => {
    getMovements = jasmine.createSpy('getMovements').and.returnValue(of({} as MovementsResponse));
    TestBed.configureTestingModule({
      providers: [{ provide: MovementPort, useValue: { getMovements } }],
    });
    useCase = TestBed.inject(ListMovementsUseCase);
  });

  it('does not send searches shorter than 3 characters', () => {
    useCase.execute({ ...baseQuery, q: ' no ' }).subscribe();
    expect(getMovements).toHaveBeenCalledWith(jasmine.objectContaining({ q: undefined }));
  });

  it('sends trimmed searches of 3 or more characters', () => {
    useCase.execute({ ...baseQuery, q: ' nomina ' }).subscribe();
    expect(getMovements).toHaveBeenCalledWith(jasmine.objectContaining({ q: 'nomina' }));
  });
});
