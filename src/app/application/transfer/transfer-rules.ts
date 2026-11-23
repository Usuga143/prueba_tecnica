import { Bank, DocumentType } from '../../domain/model/transfer/transfer.model';

/** Reglas para transferir desde REC-2231 (sección 4.1). Funciones puras, sin Angular. */

export const PER_TRANSFER_LIMIT_CENTS = 50_000_000_00;
export const DAILY_LIMIT_CENTS = 100_000_000_00;
export const DYNAMIC_KEY_THRESHOLD_CENTS = 2_000_000_00;
export const DESCRIPTION_MAX_LENGTH = 40;

export const BANKS: Bank[] = [
  { code: '0001', name: 'Banco Cordillera' },
  { code: '0002', name: 'Banco del Valle Andino' },
  { code: '0003', name: 'Banco Caribe' },
  { code: '0004', name: 'Cooperativa Financiera Llanos' },
  { code: '0005', name: 'Banco Pacífico Digital' },
  { code: '0006', name: 'Banco Altiplano' },
];

export type RuleError = 'required' | 'format' | 'tooLow' | 'overLimit';

const ACCOUNT_NUMBER = /^\d{6,17}$/;
const DOCUMENT_PATTERNS: Record<DocumentType, RegExp> = {
  CC: /^\d{6,10}$/,
  CE: /^\d{6,10}$/,
  NIT: /^\d{9}$/,
  PA: /^[A-Za-z0-9]{5,12}$/,
};
/** Coma como separador decimal (formato colombiano). El punto se rechaza: "1.500" es ambiguo. */
const AMOUNT_INPUT = /^\d+(,\d{1,2})?$/;
const DESCRIPTION = /^[\p{L}\p{N} ]*$/u;
const DYNAMIC_KEY = /^\d{6}$/;

/** Convierte lo que escribe el tesorero ("1500000,5") al formato del contrato ("1500000.50"). */
export function parseAmountInput(input: string): { apiAmount: string; cents: number } | null {
  const value = input.trim();
  if (!AMOUNT_INPUT.test(value)) return null;
  const [integerPart, decimalPart = ''] = value.split(',');
  const cents = Number(integerPart) * 100 + Number(decimalPart.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) return null;
  const pesos = Math.trunc(cents / 100);
  return { apiAmount: `${pesos}.${String(cents % 100).padStart(2, '0')}`, cents };
}

export function requiresDynamicKey(amountInput: string): boolean {
  const amount = parseAmountInput(amountInput);
  return amount !== null && amount.cents >= DYNAMIC_KEY_THRESHOLD_CENTS;
}

export function validateAmount(input: string): RuleError | null {
  if (input.trim() === '') return 'required';
  const amount = parseAmountInput(input);
  if (amount === null) return 'format';
  if (amount.cents <= 0) return 'tooLow';
  if (amount.cents > PER_TRANSFER_LIMIT_CENTS) return 'overLimit';
  return null;
}

export function validateAccountNumber(input: string): RuleError | null {
  const value = input.trim();
  if (value === '') return 'required';
  return ACCOUNT_NUMBER.test(value) ? null : 'format';
}

export function validateDocumentNumber(type: string, input: string): RuleError | null {
  const value = input.trim();
  if (value === '') return 'required';
  const pattern = DOCUMENT_PATTERNS[type as DocumentType];
  if (pattern === undefined) return null; // El tipo muestra su propio error.
  return pattern.test(value) ? null : 'format';
}

export function validateDescription(input: string): RuleError | null {
  const value = input.trim();
  if (value === '') return null;
  return value.length <= DESCRIPTION_MAX_LENGTH && DESCRIPTION.test(value) ? null : 'format';
}

export function validateDynamicKey(input: string, amountInput: string): RuleError | null {
  if (!requiresDynamicKey(amountInput)) return null;
  const value = input.trim();
  if (value === '') return 'required';
  return DYNAMIC_KEY.test(value) ? null : 'format';
}
