export type MovementStatus = 'APLICADO' | 'EN_PROCESO';

export type MovementOrder = 'fecha_desc' | 'fecha_asc' | 'monto_desc' | 'monto_asc';

export interface Account {
  id: string;
  numeroEnmascarado: string;
  titular: string;
  moneda: string;
}

export interface Movement {
  id: string;
  fechaHora: string;
  descripcion: string;
  referencia: string | null;
  monto: string;
  estado: MovementStatus;
}

export interface MovementsResponse {
  cuenta: Account;
  totalRegistros: number;
  movimientos: Movement[];
  siguiente: string | null;
}

export interface MovementsQuery {
  accountId: string;
  desde: string;
  hasta: string;
  q?: string;
  orden?: MovementOrder;
  limite?: number;
  cursor?: string;
}

export interface MovementDayGroup {
  day: string;
  items: { movement: Movement; time: string }[];
}
