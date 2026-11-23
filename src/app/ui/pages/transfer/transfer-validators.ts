import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import {
  RuleError,
  validateAccountNumber,
  validateAmount,
  validateDescription,
  validateDocumentNumber,
  validateDynamicKey,
} from '../../../application/transfer/transfer-rules';

/** Adaptan las reglas puras de application/transfer a validadores de Angular. */

const toErrors = (error: RuleError | null): ValidationErrors | null =>
  error === null ? null : { [error]: true };

const siblingValue = (control: AbstractControl, name: string): string =>
  (control.parent?.get(name)?.value as string | undefined) ?? '';

export const accountNumberValidator: ValidatorFn = (c) => toErrors(validateAccountNumber(c.value ?? ''));

export const amountValidator: ValidatorFn = (c) => toErrors(validateAmount(c.value ?? ''));

export const descriptionValidator: ValidatorFn = (c) => toErrors(validateDescription(c.value ?? ''));

export const documentNumberValidator: ValidatorFn = (c) =>
  toErrors(validateDocumentNumber(siblingValue(c, 'tipoDocumento'), c.value ?? ''));

export const dynamicKeyValidator: ValidatorFn = (c) =>
  toErrors(validateDynamicKey(c.value ?? '', siblingValue(c, 'monto')));
