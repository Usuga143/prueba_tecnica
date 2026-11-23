import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import {
  ListMovementsUseCase,
  groupByAccountingDay,
  toColombiaDayAndTime,
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

describe('groupByAccountingDay', () => {
  it('groups the sample movements by Colombia accounting day, not by UTC day', () => {
    const groups = groupByAccountingDay(SAMPLE_MOVEMENTS);

    expect(groups.map((g) => g.day)).toEqual(['2026-10-31', '2026-10-14', '2026-10-01']);
    expect(groups.map((g) => g.items.length)).toEqual([3, 1, 2]);
    expect(groups[0].items[0].movement.id).toBe('MV-8849999');
    expect(groups[0].items[0].time).toBe('23:30');
  });

  it('returns no groups for no movements', () => {
    expect(groupByAccountingDay([])).toEqual([]);
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
