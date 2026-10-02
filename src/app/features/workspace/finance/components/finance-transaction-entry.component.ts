import {
  LocalizedDateTimePickerComponent,
  LocalizedDateTimePickerLabels,
  SiteSelectComponent,
  SiteSelectOption,
} from '@alittlemore.dev/design-system';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import {
  FINANCE_CURRENCY_SYMBOLS,
  FinanceCategory,
  FinanceCurrency,
  FinanceTransactionEntry,
} from '../models/finance.model';

@Component({
  selector: 'app-finance-transaction-entry',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    LocalizedDateTimePickerComponent,
    SiteSelectComponent,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './finance-transaction-entry.component.html',
  styleUrl: './finance-transaction-entry.component.scss',
})
export class FinanceTransactionEntryComponent {
  readonly i18n = inject(I18nService);
  readonly inputId = input.required<string>();
  readonly initialValue = input.required<FinanceTransactionEntry>();
  readonly categories = input.required<readonly FinanceCategory[]>();
  readonly min = input.required<string>();
  readonly max = input.required<string>();
  readonly timeZone = input.required<string>();
  readonly saving = input.required<boolean>();
  readonly editing = input(false);
  readonly saveAttempted = signal(false);
  readonly submitted = output<FinanceTransactionEntry>();
  readonly draftChanged = output<FinanceTransactionEntry>();
  readonly cancelled = output<void>();

  readonly form = new FormGroup({
    categoryId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    amount: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^(?=.*[1-9])\d+(?:[.,]\d+)?$/)],
    }),
    currency: new FormControl<FinanceCurrency>('USD', { nonNullable: true }),
    dateTime: new FormControl<string | null>(null, Validators.required),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(2000)],
    }),
  });

  readonly currencyOptions: readonly SiteSelectOption[] = (
    ['AMD', 'RUB', 'USD', 'EUR'] as const
  ).map((currency) => ({ value: currency, label: FINANCE_CURRENCY_SYMBOLS[currency] }));
  readonly categoryOptions = computed<readonly SiteSelectOption[]>(() => [
    { value: '', label: this.i18n.translate('finance.category.choose') },
    ...this.categories().map((category) => ({ value: category.id, label: category.name })),
  ]);
  readonly dateTimeLabels = computed<LocalizedDateTimePickerLabels>(() => {
    this.i18n.language();
    // Picker shortcuts use browser wall time; transaction drafts use the account zone.
    const browserTime = this.timeZone() === Intl.DateTimeFormat().resolvedOptions().timeZone;
    return {
      placeholder: this.i18n.translate('finance.dateTime.placeholder'),
      openPicker: this.i18n.translate('finance.dateTime.open'),
      changeValue: this.i18n.translate('finance.dateTime.change'),
      dialog: this.i18n.translate('finance.dateTime.dialog'),
      dateTimeInput: this.i18n.translate('finance.dateTime.label'),
      previousMonth: this.i18n.translate('shared.datePicker.previousMonth'),
      nextMonth: this.i18n.translate('shared.datePicker.nextMonth'),
      openMonthYearPicker: this.i18n.translate('shared.datePicker.openMonthYearPicker'),
      previousYear: this.i18n.translate('shared.datePicker.previousYear'),
      nextYear: this.i18n.translate('shared.datePicker.nextYear'),
      hour: this.i18n.translate('finance.dateTime.hour'),
      minute: this.i18n.translate('finance.dateTime.minute'),
      dateFormatHint: this.i18n.translate('shared.datePicker.formatHint'),
      timeFormatHint: this.i18n.translate('finance.dateTime.timeFormat'),
      selectDate: this.i18n.translate('shared.datePicker.selectDate'),
      clear: this.i18n.translate('shared.datePicker.clear'),
      cancel: this.i18n.translate('shared.cancel'),
      done: this.i18n.translate('shared.datePicker.done'),
      today: browserTime ? this.i18n.translate('shared.datePicker.today') : '',
      now: browserTime ? this.i18n.translate('finance.dateTime.now') : '',
      keyboardHelp: this.i18n.translate('shared.datePicker.keyboardHelp'),
      invalidDateTime: this.i18n.translate('finance.error.date'),
      unavailableDateTime: this.i18n.translate('finance.error.date'),
      requiredDateTime: this.i18n.translate('finance.dateTime.required'),
    };
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(() => {
      const value = this.form.getRawValue();
      this.draftChanged.emit({ ...value, dateTime: value.dateTime ?? '' });
    });
    effect(() => {
      const value = this.initialValue();
      untracked(() => {
        this.form.reset(value, { emitEvent: false });
        this.saveAttempted.set(false);
      });
    });
    effect(() => {
      const saving = this.saving();
      untracked(() => {
        if (saving) this.form.disable({ emitEvent: false });
        else this.form.enable({ emitEvent: false });
      });
    });
  }

  submit(): void {
    if (this.saving()) return;
    this.saveAttempted.set(true);
    this.form.markAllAsTouched();
    if (
      !this.categories().some((category) => category.id === this.form.controls.categoryId.value)
    ) {
      this.form.controls.categoryId.setErrors({ unavailable: true });
    }
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    this.submitted.emit({ ...value, dateTime: value.dateTime ?? '' });
  }
}
