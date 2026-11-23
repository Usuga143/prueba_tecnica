import {
  parseAmountInput,
  requiresDynamicKey,
  validateAccountNumber,
  validateAmount,
  validateDescription,
  validateDocumentNumber,
  validateDynamicKey,
} from '../../../app/application/transfer/transfer-rules';

describe('transfer rules (section 4.1)', () => {
  it('converts the typed amount to the contract format in integer cents', () => {
    expect(parseAmountInput('1500000,5')).toEqual({ apiAmount: '1500000.50', cents: 150000050 });
    expect(parseAmountInput('86400')).toEqual({ apiAmount: '86400.00', cents: 8640000 });
    expect(parseAmountInput('0,07')).toEqual({ apiAmount: '0.07', cents: 7 });
  });

  it('rejects thousand separators and more than 2 decimals', () => {
    expect(parseAmountInput('1.500.000')).toBeNull();
    expect(parseAmountInput('1.500')).toBeNull();
    expect(parseAmountInput('10,123')).toBeNull();
    expect(validateAmount('1.500')).toBe('format');
  });

  it('requires an amount greater than zero and within the per-transfer limit', () => {
    expect(validateAmount('')).toBe('required');
    expect(validateAmount('0')).toBe('tooLow');
    expect(validateAmount('0,00')).toBe('tooLow');
    expect(validateAmount('50000000')).toBeNull();
    expect(validateAmount('50000000,01')).toBe('overLimit');
  });

  it('requires the dynamic key from 2.000.000 COP', () => {
    expect(requiresDynamicKey('1999999,99')).toBeFalse();
    expect(requiresDynamicKey('2000000')).toBeTrue();
    expect(validateDynamicKey('', '1999999,99')).toBeNull();
    expect(validateDynamicKey('', '2000000')).toBe('required');
    expect(validateDynamicKey('12345', '2000000')).toBe('format');
    expect(validateDynamicKey('123456', '2000000')).toBeNull();
  });

  it('accepts account numbers of 6 to 17 digits, including leading zeros', () => {
    expect(validateAccountNumber('0045987123')).toBeNull();
    expect(validateAccountNumber('12345')).toBe('format');
    expect(validateAccountNumber('123456789012345678')).toBe('format');
    expect(validateAccountNumber('0045-987')).toBe('format');
  });

  it('validates the document number according to its type', () => {
    expect(validateDocumentNumber('CC', '123456')).toBeNull();
    expect(validateDocumentNumber('CC', '12345678901')).toBe('format');
    expect(validateDocumentNumber('CE', '1234567890')).toBeNull();
    expect(validateDocumentNumber('NIT', '900123456')).toBeNull();
    expect(validateDocumentNumber('NIT', '90012345')).toBe('format');
    expect(validateDocumentNumber('PA', 'AB12C')).toBeNull();
    expect(validateDocumentNumber('PA', 'AB-12C')).toBe('format');
  });

  it('accepts an optional description of up to 40 letters, digits and spaces', () => {
    expect(validateDescription('')).toBeNull();
    expect(validateDescription('Pago factura 123 de octubre')).toBeNull();
    expect(validateDescription('Pago nómina')).toBeNull();
    expect(validateDescription('Pago #123')).toBe('format');
    expect(validateDescription('a'.repeat(41))).toBe('format');
  });
});
