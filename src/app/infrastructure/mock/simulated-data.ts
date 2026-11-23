import { Account, Movement } from '../../domain/model/movement/movement.model';

/** Datos de ejemplo de la sección 4.1 del enunciado. */
export const SAMPLE_ACCOUNT: Account = {
  id: 'REC-2231',
  numeroEnmascarado: 'XXXX2231',
  titular: 'Distribuidora Andina S.A.S.',
  moneda: 'COP',
};

export const SAMPLE_MOVEMENTS: Movement[] = [
  { id: 'MV-8849999', fechaHora: '2026-11-01T04:30:00Z', descripcion: 'Recaudo PSE factura 10-9902', referencia: '10-9902', monto: '3999999.99', estado: 'EN_PROCESO' },
  { id: 'MV-8849990', fechaHora: '2026-10-31T21:10:09Z', descripcion: 'Comision transferencia', referencia: 'COM-1031', monto: '-7140.00', estado: 'APLICADO' },
  { id: 'MV-8849987', fechaHora: '2026-10-31T15:02:44Z', descripcion: 'Pago nomina quincena 2', referencia: 'NOM-2026-20', monto: '-48730500.50', estado: 'APLICADO' },
  { id: 'MV-8812044', fechaHora: '2026-10-14T19:22:31Z', descripcion: 'Recaudo corresponsal Tienda La 80', referencia: null, monto: '86400.00', estado: 'APLICADO' },
  { id: 'MV-8800002', fechaHora: '2026-10-01T15:40:00Z', descripcion: 'Pago proveedor Nomad Logistica', referencia: 'PRV-5531', monto: '-12500000.00', estado: 'APLICADO' },
  { id: 'MV-8800001', fechaHora: '2026-10-01T05:05:12Z', descripcion: 'Recaudo PSE factura 10-4471', referencia: '10-4471', monto: '1250000.00', estado: 'APLICADO' },
];
