export type AccountType = 'AHORROS' | 'CORRIENTE';

export type DocumentType = 'CC' | 'CE' | 'NIT' | 'PA';

export type TransferStatus = 'APLICADA' | 'EN_PROCESO';

export interface Bank {
  code: string;
  name: string;
}

/** Cuerpo de POST /transferencias (contrato, sección 4.2). */
export interface TransferRequest {
  cuentaOrigenId: string;
  bancoDestino: string;
  tipoCuenta: AccountType;
  numeroCuenta: string;
  tipoDocumento: DocumentType;
  numeroDocumento: string;
  monto: string;
  descripcion?: string;
  claveDinamica?: string;
}

/** Respuesta 201 de POST /transferencias. */
export interface TransferReceipt {
  id: string;
  estado: TransferStatus;
  fechaHora: string;
  numeroCuentaEnmascarado: string;
  comprobante: string;
}
