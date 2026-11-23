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

/** Volumen de octubre de 2026 de REC-2231 (sección 4.1). */
export const OCTOBER_2026_TOTAL = 50_000;

const OCTOBER_START_UTC = Date.parse('2026-10-01T05:00:00Z'); // 1 oct 00:00 en Colombia
const OCTOBER_END_UTC = Date.parse('2026-11-01T04:29:59Z'); // antes de MV-8849999
const LAST_DAY_START_UTC = Date.parse('2026-10-31T17:00:00Z');

const STORES = ['La 80', 'El Poblado', 'San Javier', 'Laureles', 'Belén', 'Envigado', 'Bello', 'Itagüí'];
const SUPPLIERS = ['Nomad Logistica', 'Andes Empaques', 'Café del Valle', 'TransCaribe Carga', 'Papelería Central'];

/**
 * Genera los 50.000 movimientos de octubre: los 6 de la sección 4.1 más movimientos sintéticos,
 * en su mayoría recaudos PSE y de corresponsales. Determinista (misma semilla, mismos datos).
 */
export function generateOctoberMovements(total = OCTOBER_2026_TOTAL): Movement[] {
  const random = seededRandom(2231);
  const movements: Movement[] = [...SAMPLE_MOVEMENTS];

  for (let i = 0; movements.length < total; i++) {
    const timestamp = OCTOBER_START_UTC + Math.floor(random() * (OCTOBER_END_UTC - OCTOBER_START_UTC));
    const kind = random();
    const id = `MV-${7000000 + i}`;
    const fechaHora = new Date(timestamp).toISOString().replace('.000Z', 'Z');
    const inProcess = timestamp >= LAST_DAY_START_UTC && random() < 0.5;
    const estado = inProcess ? 'EN_PROCESO' : 'APLICADO';

    if (kind < 0.7) {
      const invoice = `10-${String(1000 + (i % 9000)).padStart(4, '0')}`;
      const amount = cents(random, 20_000_00, 4_000_000_00);
      movements.push({ id, fechaHora, descripcion: `Recaudo PSE factura ${invoice}`, referencia: invoice, monto: amount, estado });
    } else if (kind < 0.9) {
      const store = STORES[i % STORES.length];
      const amount = cents(random, 5_000_00, 800_000_00);
      const referencia = random() < 0.5 ? null : `COR-${String(i % 10000).padStart(4, '0')}`;
      movements.push({ id, fechaHora, descripcion: `Recaudo corresponsal Tienda ${store}`, referencia, monto: amount, estado });
    } else if (kind < 0.96) {
      const supplier = SUPPLIERS[i % SUPPLIERS.length];
      const amount = `-${cents(random, 500_000_00, 25_000_000_00)}`;
      movements.push({ id, fechaHora, descripcion: `Pago proveedor ${supplier}`, referencia: `PRV-${String(i % 10000).padStart(4, '0')}`, monto: amount, estado });
    } else if (kind < 0.98) {
      const descripcion = i % 2 === 0 ? 'Pago nomina quincena 1' : 'Pago nómina quincena 2';
      const amount = `-${cents(random, 1_000_000_00, 30_000_000_00)}`;
      movements.push({ id, fechaHora, descripcion, referencia: `NOM-2026-${String(i % 100).padStart(2, '0')}`, monto: amount, estado });
    } else {
      movements.push({ id, fechaHora, descripcion: 'Comision transferencia', referencia: `COM-${String(i % 10000).padStart(4, '0')}`, monto: '-7140.00', estado });
    }
  }
  return movements;
}

/** Monto aleatorio entre min y max (en centavos), como texto decimal del contrato. */
function cents(random: () => number, min: number, max: number): string {
  const value = min + Math.floor(random() * (max - min));
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, '0')}`;
}

/** Generador pseudoaleatorio con semilla (mulberry32). */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
