import { registerLocaleData } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';
import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { ApiError } from '../../../../app/domain/model/shared/api-error.model';
import { TransferReceipt, TransferRequest } from '../../../../app/domain/model/transfer/transfer.model';
import { SessionPort } from '../../../../app/domain/ports/session/session.port';
import { TransferPort } from '../../../../app/domain/ports/transfer/transfer.port';
import { TransferPage } from '../../../../app/ui/pages/transfer/transfer-page';
import { expectNoAccessibilityViolations } from '../../../support/axe';

registerLocaleData(localeEsCo);

const RECEIPT: TransferReceipt = {
  id: 'TR-000001',
  estado: 'EN_PROCESO',
  fechaHora: '2026-11-12T19:30:00Z',
  numeroCuentaEnmascarado: 'XXXX7123',
  comprobante: 'CMP-001',
};

const apiError = (status: number, codigo: string, extra: Partial<ApiError> = {}): ApiError => ({
  status,
  codigo,
  mensaje: '',
  ...extra,
});

const normalize = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();

describe('TransferPage', () => {
  let create: jasmine.Spy;
  let fixture: ComponentFixture<TransferPage>;
  let el: HTMLElement;

  beforeEach(() => {
    create = jasmine.createSpy('create');
    const renew = () => of({ expiraEn: new Date(Date.now() + 5 * 60 * 1000).toISOString(), csrfToken: 't' });
    TestBed.configureTestingModule({
      imports: [TransferPage],
      providers: [
        { provide: TransferPort, useValue: { create } },
        { provide: SessionPort, useValue: { renew } },
        { provide: LOCALE_ID, useValue: 'es-CO' },
      ],
    });
    fixture = TestBed.createComponent(TransferPage);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  function type(id: string, value: string): void {
    const input = el.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!;
    input.value = value;
    input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input'));
    fixture.detectChanges();
  }

  function fillValidForm(amount = '150000'): void {
    type('bancoDestino', '0002');
    el.querySelector<HTMLInputElement>('#tipoCuenta-AHORROS')!.click();
    type('numeroCuenta', '0045987123');
    type('tipoDocumento', 'CC');
    type('numeroDocumento', '1020304050');
    type('monto', amount);
    fixture.detectChanges();
  }

  function submit(): void {
    el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    fixture.detectChanges();
  }

  const errorOf = (field: string) => normalize(el.querySelector(`#${field}-error`)?.textContent);
  const sentRequest = (call = 0) => create.calls.argsFor(call)[0] as TransferRequest;
  const sentKey = (call = 0) => create.calls.argsFor(call)[1] as string;

  it('shows each error next to its field and does not send an invalid form', () => {
    submit();

    expect(create).not.toHaveBeenCalled();
    for (const field of ['bancoDestino', 'tipoCuenta', 'numeroCuenta', 'tipoDocumento', 'numeroDocumento', 'monto']) {
      expect(errorOf(field)).withContext(field).not.toBe('');
    }
    const account = el.querySelector('#numeroCuenta')!;
    expect(account.getAttribute('aria-invalid')).toBe('true');
    expect(account.getAttribute('aria-describedby')).toContain('numeroCuenta-error');
    expect(normalize(el.querySelector('.error-summary')?.textContent)).toContain('Revisa estos campos');
  });

  it('validates the document number by document type', () => {
    type('tipoDocumento', 'NIT');
    type('numeroDocumento', '90012345');
    submit();
    expect(errorOf('numeroDocumento')).toContain('9 dígitos');

    type('numeroDocumento', '900123456');
    expect(errorOf('numeroDocumento')).toBe('');
  });

  it('rejects thousand separators in the amount to avoid ambiguous values', () => {
    fillValidForm('1.500.000');
    submit();
    expect(errorOf('monto')).toContain('sin puntos de miles');
    expect(create).not.toHaveBeenCalled();
  });

  it('asks for the dynamic key only from 2.000.000 COP', () => {
    fillValidForm('1999999,99');
    expect(el.querySelector('#claveDinamica')).toBeNull();

    type('monto', '2000000');
    expect(el.querySelector('#claveDinamica')).not.toBeNull();
    submit();
    expect(errorOf('claveDinamica')).toContain('6 dígitos');
    expect(create).not.toHaveBeenCalled();

    type('claveDinamica', '123456');
    create.and.returnValue(of(RECEIPT));
    submit();
    expect(sentRequest().claveDinamica).toBe('123456');
    expect(sentRequest().monto).toBe('2000000.00');
  });

  it('sends the contract body keeping leading zeros in the account number', () => {
    create.and.returnValue(of(RECEIPT));
    fillValidForm('150000,5');
    submit();

    expect(sentRequest()).toEqual({
      cuentaOrigenId: 'REC-2231',
      bancoDestino: '0002',
      tipoCuenta: 'AHORROS',
      numeroCuenta: '0045987123',
      tipoDocumento: 'CC',
      numeroDocumento: '1020304050',
      monto: '150000.50',
    });
  });

  it('sends a single transfer on double click', () => {
    create.and.returnValue(new Subject<TransferReceipt>());
    fillValidForm();
    submit();
    submit();

    expect(create).toHaveBeenCalledTimes(1);
    expect(el.querySelector('button[type="submit"]')?.getAttribute('aria-disabled')).toBe('true');
  });

  it('reuses the same Idempotency-Key when retrying after an unknown result', () => {
    create.and.returnValues(throwError(() => apiError(503, 'CORE_NO_DISPONIBLE')), of(RECEIPT));
    fillValidForm();
    submit();
    expect(normalize(el.querySelector('[role="alert"]')?.textContent)).toContain('no se duplicará');

    submit();
    expect(create).toHaveBeenCalledTimes(2);
    expect(sentKey(1)).toBe(sentKey(0));
    expect(sentKey(0)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('uses a new Idempotency-Key when the transfer data changes', () => {
    create.and.returnValues(throwError(() => apiError(503, 'CORE_NO_DISPONIBLE')), of(RECEIPT));
    fillValidForm();
    submit();
    type('monto', '160000');
    submit();

    expect(sentKey(1)).not.toBe(sentKey(0));
  });

  it('shows API field errors next to the field', () => {
    create.and.returnValue(
      throwError(() => apiError(400, 'VALIDACION', { errores: [{ campo: 'numeroCuenta', codigo: 'FORMATO' }] })),
    );
    fillValidForm();
    submit();

    expect(errorOf('numeroCuenta')).toContain('entre 6 y 17 dígitos');
    expect(el.querySelector('#numeroCuenta')!.getAttribute('aria-invalid')).toBe('true');
  });

  it('shows limit errors on the amount and clears a rejected dynamic key', () => {
    create.and.returnValues(
      throwError(() => apiError(422, 'TOPE_DIARIO_EXCEDIDO')),
      throwError(() => apiError(422, 'CLAVE_DINAMICA_INVALIDA')),
    );
    fillValidForm('3000000');
    type('claveDinamica', '000000');
    submit();
    expect(errorOf('monto')).toContain('tope diario');

    type('monto', '2500000');
    type('claveDinamica', '000000');
    submit();
    expect(errorOf('claveDinamica')).toContain('no es válida');
    expect(el.querySelector<HTMLInputElement>('#claveDinamica')!.value).toBe('');
  });

  it('keeps the entered data when the session expired', () => {
    create.and.returnValue(throwError(() => apiError(401, 'SESION_EXPIRADA')));
    fillValidForm();
    submit();

    expect(normalize(el.querySelector('[role="alert"]')?.textContent)).toContain('Los datos siguen en el formulario');
    expect(el.querySelector<HTMLInputElement>('#numeroCuenta')!.value).toBe('0045987123');
  });

  it('shows the receipt with the masked destination account and clears the form', () => {
    create.and.returnValue(of(RECEIPT));
    fillValidForm();
    submit();
    const receipt = normalize(el.querySelector('.receipt')?.textContent);

    expect(receipt).toContain('XXXX7123');
    expect(receipt).not.toContain('0045987123');
    expect(receipt).toContain('CMP-001');
    expect(receipt).toContain('$ 150.000,00');
    expect(receipt).toContain('2026-11-12 14:30');

    el.querySelector<HTMLButtonElement>('.receipt button')!.click();
    fixture.detectChanges();
    expect(el.querySelector<HTMLInputElement>('#numeroCuenta')!.value).toBe('');
  });

  it('has no WCAG 2.2 AA violations, empty and with errors', async () => {
    await expectNoAccessibilityViolations(el);
    fillValidForm('2000000');
    type('numeroCuenta', '12');
    submit();
    await expectNoAccessibilityViolations(el);
  });
});
