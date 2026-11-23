import { CurrencyPipe } from '@angular/common';
import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, map } from 'rxjs';
import { toColombiaDayAndTime } from '../../../application/movement/list-movements.use-case';
import { CreateTransferUseCase } from '../../../application/transfer/create-transfer.use-case';
import {
  BANKS,
  DESCRIPTION_MAX_LENGTH,
  parseAmountInput,
  requiresDynamicKey,
} from '../../../application/transfer/transfer-rules';
import { ApiError } from '../../../domain/model/shared/api-error.model';
import { CURRENT_ACCOUNT_ID } from '../../../domain/model/shared/current-account';
import {
  AccountType,
  DocumentType,
  TransferReceipt,
  TransferRequest,
} from '../../../domain/model/transfer/transfer.model';
import { FIELD_LABELS, TransferField, fieldErrorMessage } from './transfer-messages';
import {
  accountNumberValidator,
  amountValidator,
  descriptionValidator,
  documentNumberValidator,
  dynamicKeyValidator,
} from './transfer-validators';

interface ReceiptView extends TransferReceipt {
  bankName: string;
  amount: string;
  dateTime: string;
}

interface SummaryItem {
  field: TransferField;
  label: string;
  message: string;
}

const FIELD_ORDER: TransferField[] = [
  'bancoDestino',
  'tipoCuenta',
  'numeroCuenta',
  'tipoDocumento',
  'numeroDocumento',
  'monto',
  'descripcion',
  'claveDinamica',
];

@Component({
  selector: 'app-transfer-page',
  imports: [ReactiveFormsModule, CurrencyPipe],
  templateUrl: './transfer-page.html',
  styleUrl: './transfer-page.scss',
})
export class TransferPage {
  private readonly createTransfer = inject(CreateTransferUseCase);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly banks = BANKS;
  protected readonly descriptionMaxLength = DESCRIPTION_MAX_LENGTH;
  protected readonly accountTypes: { value: AccountType; label: string }[] = [
    { value: 'AHORROS', label: 'Ahorros' },
    { value: 'CORRIENTE', label: 'Corriente' },
  ];
  protected readonly documentTypes: { value: DocumentType; label: string }[] = [
    { value: 'CC', label: 'Cédula de ciudadanía (CC)' },
    { value: 'CE', label: 'Cédula de extranjería (CE)' },
    { value: 'NIT', label: 'NIT' },
    { value: 'PA', label: 'Pasaporte (PA)' },
  ];

  /** Los datos viven solo en memoria del componente: nada se guarda en el navegador. */
  protected readonly form = new FormGroup({
    bancoDestino: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    tipoCuenta: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    numeroCuenta: new FormControl('', { nonNullable: true, validators: [accountNumberValidator] }),
    tipoDocumento: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    numeroDocumento: new FormControl('', { nonNullable: true, validators: [documentNumberValidator] }),
    monto: new FormControl('', { nonNullable: true, validators: [amountValidator] }),
    descripcion: new FormControl('', { nonNullable: true, validators: [descriptionValidator] }),
    claveDinamica: new FormControl('', { nonNullable: true, validators: [dynamicKeyValidator] }),
  });

  protected readonly needsDynamicKey = toSignal(
    this.form.controls.monto.valueChanges.pipe(map(requiresDynamicKey)),
    { initialValue: false },
  );
  protected readonly amountPreview = toSignal(
    this.form.controls.monto.valueChanges.pipe(map((v) => parseAmountInput(v)?.apiAmount ?? null)),
    { initialValue: null },
  );

  protected readonly submitted = signal(false);
  protected readonly pending = signal(false);
  protected readonly summary = signal<SummaryItem[]>([]);
  protected readonly generalError = signal<string | null>(null);
  protected readonly receipt = signal<ReceiptView | null>(null);

  private readonly summaryRef = viewChild<ElementRef<HTMLElement>>('summaryBox');
  private readonly receiptRef = viewChild<ElementRef<HTMLElement>>('receiptTitle');
  private readonly generalErrorRef = viewChild<ElementRef<HTMLElement>>('generalErrorBox');

  /** Clave de idempotencia del intento actual; se reutiliza al reintentar con los mismos datos. */
  private attempt: { key: string; fingerprint: string } | null = null;

  constructor() {
    const { tipoDocumento, numeroDocumento, monto, claveDinamica } = this.form.controls;
    tipoDocumento.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => numeroDocumento.updateValueAndValidity());
    monto.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      // Si ya no se necesita la clave, no se conserva en memoria.
      if (!requiresDynamicKey(value) && claveDinamica.value !== '') {
        claveDinamica.setValue('', { emitEvent: false });
      }
      claveDinamica.updateValueAndValidity();
    });
  }

  protected errorFor(field: TransferField): string | null {
    const control = this.form.controls[field];
    if (control.errors === null || !(control.touched || this.submitted())) return null;
    return fieldErrorMessage(field, control.errors, this.form.controls.tipoDocumento.value);
  }

  protected describedBy(field: TransferField, hintId?: string): string | null {
    const ids = [hintId, this.errorFor(field) ? `${field}-error` : undefined].filter(Boolean);
    return ids.length > 0 ? ids.join(' ') : null;
  }

  protected fieldId(field: TransferField): string {
    return field === 'tipoCuenta' ? 'tipoCuenta-AHORROS' : field;
  }

  protected focusField(event: Event, field: TransferField): void {
    event.preventDefault();
    this.host.nativeElement.querySelector<HTMLElement>(`#${this.fieldId(field)}`)?.focus();
  }

  protected submit(): void {
    if (this.pending()) return; // Doble clic: se ignora mientras hay un envío en curso.
    this.submitted.set(true);
    this.generalError.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.showSummary();
      return;
    }
    this.summary.set([]);

    const request = this.buildRequest();
    const fingerprint = this.fingerprint(request);
    if (this.attempt === null || this.attempt.fingerprint !== fingerprint) {
      this.attempt = { key: crypto.randomUUID(), fingerprint };
    }

    this.pending.set(true);
    this.createTransfer
      .execute(request, this.attempt.key)
      .pipe(finalize(() => this.pending.set(false)))
      .subscribe({
        next: (receipt) => this.showReceipt(receipt, request),
        error: (error: Partial<ApiError>) => this.handleError(error),
      });
  }

  protected startNew(): void {
    this.receipt.set(null);
    this.submitted.set(false);
    this.attempt = null;
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('#bancoDestino')?.focus(), {
      injector: this.injector,
    });
  }

  private buildRequest(): TransferRequest {
    const value = this.form.getRawValue();
    const request: TransferRequest = {
      cuentaOrigenId: CURRENT_ACCOUNT_ID,
      bancoDestino: value.bancoDestino,
      tipoCuenta: value.tipoCuenta as AccountType,
      numeroCuenta: value.numeroCuenta.trim(),
      tipoDocumento: value.tipoDocumento as DocumentType,
      numeroDocumento: value.numeroDocumento.trim(),
      monto: parseAmountInput(value.monto)!.apiAmount,
    };
    const descripcion = value.descripcion.trim();
    if (descripcion !== '') request.descripcion = descripcion;
    if (requiresDynamicKey(value.monto)) request.claveDinamica = value.claveDinamica.trim();
    return request;
  }

  /**
   * Huella de los datos de la transferencia sin la clave dinámica: si el tesorero reintenta con una
   * clave nueva tras un fallo de red, se conserva la misma Idempotency-Key y el servidor no duplica.
   */
  private fingerprint(request: TransferRequest): string {
    const { claveDinamica: _ignored, ...data } = request;
    return JSON.stringify(data);
  }

  private showReceipt(receipt: TransferReceipt, request: TransferRequest): void {
    const { day, time } = toColombiaDayAndTime(receipt.fechaHora);
    this.receipt.set({
      ...receipt,
      bankName: BANKS.find((b) => b.code === request.bancoDestino)?.name ?? request.bancoDestino,
      amount: request.monto,
      dateTime: `${day} ${time}`,
    });
    // Se borran los datos sensibles del formulario apenas termina la operación.
    this.form.reset();
    this.submitted.set(false);
    this.attempt = null;
    afterNextRender(() => this.receiptRef()?.nativeElement.focus(), { injector: this.injector });
  }

  private handleError(error: Partial<ApiError>): void {
    switch (error.status) {
      case 400:
        if (error.errores && error.errores.length > 0) {
          for (const fieldError of error.errores) {
            this.setApiError(fieldError.campo, fieldError.codigo);
          }
          this.showSummary();
          return;
        }
        this.showGeneralError('El banco rechazó los datos. Revisa el formulario e inténtalo de nuevo.');
        return;
      case 422:
        if (error.codigo === 'CLAVE_DINAMICA_INVALIDA') {
          this.form.controls.claveDinamica.setValue('');
          this.setApiError('claveDinamica', error.codigo);
        } else {
          this.setApiError('monto', error.codigo ?? 'FORMATO');
        }
        this.showSummary();
        return;
      case 401:
        this.showGeneralError(
          'Tu sesión venció y la transferencia no se envió. Los datos siguen en el formulario.',
        );
        return;
      case 409:
        this.attempt = null;
        this.showGeneralError(
          'Ya enviaste una transferencia con estos datos hace un momento. Revisa tus movimientos antes de enviarla otra vez.',
        );
        return;
      case 429:
        this.showGeneralError(
          `Hiciste muchas solicitudes seguidas. Espera ${error.retryAfterSeconds ?? 1} segundos y vuelve a enviar.`,
        );
        return;
      default:
        this.showGeneralError(
          'No pudimos confirmar la transferencia. Vuelve a enviarla: si ya se había realizado, no se duplicará.',
        );
    }
  }

  private setApiError(field: string, code: string): void {
    const control = this.form.get(field);
    if (control === null) {
      this.showGeneralError('El banco rechazó los datos. Revisa el formulario e inténtalo de nuevo.');
      return;
    }
    control.setErrors({ api: code });
    control.markAsTouched();
  }

  private showSummary(): void {
    const items = FIELD_ORDER.map((field) => ({ field, message: this.errorFor(field) }))
      .filter((item): item is { field: TransferField; message: string } => item.message !== null)
      .map((item) => ({ ...item, label: FIELD_LABELS[item.field] }));
    this.summary.set(items);
    afterNextRender(() => this.summaryRef()?.nativeElement.focus(), { injector: this.injector });
  }

  private showGeneralError(message: string): void {
    this.generalError.set(message);
    afterNextRender(() => this.generalErrorRef()?.nativeElement.focus(), { injector: this.injector });
  }
}
