/** Textos de error en español, por campo y por código (cliente y API). */

export type TransferField =
  | 'bancoDestino'
  | 'tipoCuenta'
  | 'numeroCuenta'
  | 'tipoDocumento'
  | 'numeroDocumento'
  | 'monto'
  | 'descripcion'
  | 'claveDinamica';

export const FIELD_LABELS: Record<TransferField, string> = {
  bancoDestino: 'Banco destino',
  tipoCuenta: 'Tipo de cuenta',
  numeroCuenta: 'Número de cuenta',
  tipoDocumento: 'Tipo de documento',
  numeroDocumento: 'Número de documento',
  monto: 'Monto',
  descripcion: 'Descripción',
  claveDinamica: 'Clave dinámica',
};

const REQUIRED: Record<TransferField, string> = {
  bancoDestino: 'Selecciona el banco destino.',
  tipoCuenta: 'Selecciona el tipo de cuenta.',
  numeroCuenta: 'Escribe el número de cuenta destino.',
  tipoDocumento: 'Selecciona el tipo de documento del titular.',
  numeroDocumento: 'Escribe el número de documento del titular.',
  monto: 'Escribe el monto a transferir.',
  descripcion: 'Escribe una descripción.',
  claveDinamica: 'Escribe la clave dinámica de 6 dígitos que ves en la app del banco.',
};

const DOCUMENT_FORMAT: Record<string, string> = {
  CC: 'La cédula de ciudadanía tiene entre 6 y 10 dígitos.',
  CE: 'La cédula de extranjería tiene entre 6 y 10 dígitos.',
  NIT: 'El NIT tiene 9 dígitos, sin dígito de verificación ni guiones.',
  PA: 'El pasaporte tiene entre 5 y 12 letras o dígitos.',
};

const FORMAT: Record<TransferField, string> = {
  bancoDestino: 'Selecciona un banco de la lista.',
  tipoCuenta: 'Selecciona un tipo de cuenta de la lista.',
  numeroCuenta: 'El número de cuenta tiene entre 6 y 17 dígitos, sin espacios ni guiones.',
  tipoDocumento: 'Selecciona un tipo de documento de la lista.',
  numeroDocumento: 'Revisa el número de documento.',
  monto: 'Escribe el monto solo con números, sin puntos de miles y con coma para los decimales (máximo 2). Ejemplo: 1500000,50',
  descripcion: 'Usa solo letras, números y espacios, hasta 40 caracteres.',
  claveDinamica: 'La clave dinámica tiene 6 dígitos.',
};

const API_CODES: Record<string, string> = {
  TOPE_TRANSACCION_EXCEDIDO: 'El monto supera el tope por transferencia de $ 50.000.000,00.',
  TOPE_DIARIO_EXCEDIDO: 'Con este monto superas tu tope diario de $ 100.000.000,00.',
  CLAVE_DINAMICA_INVALIDA: 'La clave dinámica no es válida o ya venció. Escribe la clave nueva que ves en la app.',
};

export function fieldErrorMessage(
  field: TransferField,
  errors: Record<string, unknown>,
  documentType: string,
): string {
  const api = errors['api'];
  if (typeof api === 'string') {
    if (API_CODES[api]) return API_CODES[api];
    if (api === 'REQUERIDO') return REQUIRED[field];
    return field === 'numeroDocumento' && DOCUMENT_FORMAT[documentType]
      ? DOCUMENT_FORMAT[documentType]
      : FORMAT[field];
  }
  if (errors['required']) return REQUIRED[field];
  if (errors['tooLow']) return 'El monto debe ser mayor que cero.';
  if (errors['overLimit']) return API_CODES['TOPE_TRANSACCION_EXCEDIDO'];
  if (field === 'numeroDocumento' && DOCUMENT_FORMAT[documentType]) return DOCUMENT_FORMAT[documentType];
  return FORMAT[field];
}
