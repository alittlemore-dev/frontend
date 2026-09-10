import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  PLATFORM_ID,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
} from '@angular/forms';

export interface LocalizedDatePickerLabels {
  placeholder: string;
  openCalendar: string;
  changeCalendar: string;
  dialog: string;
  previousMonth: string;
  nextMonth: string;
  openMonthYearPicker: string;
  previousYear: string;
  nextYear: string;
  clear: string;
  close: string;
  formatHint: string;
  invalidDate: string;
  requiredDate: string;
  keyboardHelp: string;
}

interface CalendarCell {
  iso: string;
  label: string;
  ariaLabel: string;
  selected: boolean;
  today: boolean;
  disabled: boolean;
}

interface MonthOption {
  index: number;
  label: string;
  ariaLabel: string;
  selected: boolean;
}

interface WeekdayLabel {
  short: string;
  long: string;
}

type CalendarMode = 'days' | 'monthYear';
type DatePickerControlSize = 'default' | 'small';
type DatePart = 'day' | 'month' | 'year';

const DATE_SEPARATOR_PATTERN = /[./-]/;
const DAYS_IN_WEEK = 7;
const MONTHS_IN_YEAR = 12;
const MONTH_GRID_COLUMNS = 3;
let nextCalendarId = 0;

@Component({
  selector: 'app-localized-date-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './localized-date-picker.component.html',
  styleUrl: './localized-date-picker.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => LocalizedDatePickerComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => LocalizedDatePickerComponent),
      multi: true,
    },
  ],
})
export class LocalizedDatePickerComponent implements ControlValueAccessor, Validator {
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly textInputElement = viewChild<ElementRef<HTMLInputElement>>('textInput');
  private readonly calendarToggleElement =
    viewChild.required<ElementRef<HTMLButtonElement>>('calendarToggle');
  private readonly calendarDialogElement =
    viewChild.required<ElementRef<HTMLDialogElement>>('calendarDialog');
  private readonly closeButtonElement =
    viewChild.required<ElementRef<HTMLButtonElement>>('closeButton');
  private readonly dayButtonElements = viewChildren<ElementRef<HTMLButtonElement>>('dayButton');
  private readonly monthButtonElements = viewChildren<ElementRef<HTMLButtonElement>>('monthButton');

  readonly inputId = input.required<string>();
  readonly value = input<string>();
  readonly controlSize = input.required<DatePickerControlSize>();
  readonly dateLocale = input.required<string>();
  readonly labels = input.required<LocalizedDatePickerLabels>();
  readonly required = input.required<boolean>();
  readonly invalid = input.required<boolean>();
  readonly controlDisabled = input.required<boolean>();
  readonly readonly = input.required<boolean>();
  readonly min = input<string>();
  readonly max = input<string>();
  readonly disabledDates = input<readonly string[]>();

  readonly valueChange = output<string>();
  readonly validityChange = output<boolean>();

  readonly calendarOpen = signal(false);
  readonly calendarMode = signal<CalendarMode>('days');
  readonly displayValue = signal('');
  readonly manualInputInvalid = signal(false);
  readonly manualValueInvalid = signal(false);
  readonly visibleMonth = signal(startOfMonth(new Date()));
  readonly focusedIso = signal('');
  readonly focusedMonthIndex = signal(0);
  readonly formValue = signal('');
  readonly formDisabled = signal(false);

  readonly calendarId = `localizedDatePicker${nextCalendarId++}`;
  readonly monthYearPanelId = `${this.calendarId}MonthYear`;
  readonly monthHeadingId = `${this.calendarId}MonthHeading`;
  readonly keyboardHelpId = `${this.calendarId}KeyboardHelp`;
  readonly formatHintId = `${this.calendarId}FormatHint`;
  readonly errorId = `${this.calendarId}Error`;

  readonly currentValue = computed(() => this.value() ?? this.formValue());
  readonly effectiveDisabled = computed(() => this.controlDisabled() || this.formDisabled());
  readonly currentValueUnavailable = computed(() => {
    const value = this.currentValue();
    return value !== '' && parseIsoDate(value) !== null && this.isDateUnavailable(value);
  });
  readonly effectiveInvalid = computed(
    () => this.invalid() || this.manualInputInvalid() || this.currentValueUnavailable(),
  );
  readonly inputDescribedBy = computed(() =>
    this.effectiveInvalid() ? `${this.formatHintId} ${this.errorId}` : this.formatHintId,
  );
  readonly validationMessage = computed(() => {
    if (!this.effectiveInvalid()) return '';
    if (this.required() && this.displayValue().trim() === '') return this.labels().requiredDate;
    return this.labels().invalidDate;
  });
  readonly toggleAriaLabel = computed(() => {
    const parsed = parseIsoDate(this.currentValue());
    if (parsed === null) return this.labels().openCalendar;
    return `${this.labels().changeCalendar}, ${formatLongDate(parsed, this.dateLocale())}`;
  });
  readonly monthLabel = computed(() =>
    new Intl.DateTimeFormat(this.dateLocale(), { month: 'long', year: 'numeric' }).format(
      this.visibleMonth(),
    ),
  );
  readonly visibleYearLabel = computed(() => String(this.visibleMonth().getFullYear()));
  readonly monthOptions = computed(() =>
    buildMonthOptions({
      month: this.visibleMonth(),
      dateLocale: this.dateLocale(),
    }),
  );
  readonly monthRows = computed(() => chunkRows(this.monthOptions(), MONTH_GRID_COLUMNS));
  readonly weekdayLabels = computed(() => buildWeekdayLabels(this.dateLocale()));
  readonly calendarRows = computed(() =>
    chunkRows(
      buildCalendarCells({
        month: this.visibleMonth(),
        selectedIso: this.currentValue(),
        dateLocale: this.dateLocale(),
        isDisabled: (iso) => this.isDateUnavailable(iso),
      }),
      DAYS_IN_WEEK,
    ),
  );
  readonly canClear = computed(
    () =>
      !this.required() &&
      !this.effectiveDisabled() &&
      !this.readonly() &&
      this.displayValue().trim() !== '',
  );

  private onFormChange: ((value: string) => void) | null = null;
  private onFormTouched: (() => void) | null = null;
  private onValidatorChange: (() => void) | null = null;

  private readonly valueSyncEffect = effect(() => {
    const value = this.currentValue();
    const dateLocale = this.dateLocale();
    this.displayValue.set(formatDateForLocale(value, dateLocale));
    this.manualInputInvalid.set(false);
    untracked(() => this.setManualValueInvalid(false));
    this.onValidatorChange?.();
    const parsed = parseIsoDate(value);
    if (parsed !== null) {
      this.visibleMonth.set(startOfMonth(parsed));
      this.focusedIso.set(value);
      this.focusedMonthIndex.set(parsed.getMonth());
    }
  });

  private readonly nativeValiditySyncEffect = effect(() => {
    if (!this.isBrowser) return;
    const input = this.textInputElement()?.nativeElement;
    if (input === undefined) return;
    const invalid = this.manualValueInvalid() || this.currentValueUnavailable();
    input.setCustomValidity(invalid ? this.labels().invalidDate : '');
    this.onValidatorChange?.();
  });

  writeValue(value: unknown): void {
    this.formValue.set(typeof value === 'string' ? value : '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onFormChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onFormTouched = fn;
  }

  validate(control: AbstractControl<unknown>): ValidationErrors | null {
    const value = typeof control.value === 'string' ? control.value : '';
    if (this.manualValueInvalid()) return { dateInvalid: true };
    if (value !== '' && parseIsoDate(value) !== null && this.isDateUnavailable(value)) {
      return { dateUnavailable: true };
    }
    if (this.required() && value.trim() === '') return { required: true };
    return null;
  }

  registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.formDisabled.set(disabled);
    if (disabled && this.calendarOpen()) this.closeCalendar();
  }

  toggleCalendar(): void {
    if (this.calendarOpen()) {
      this.closeCalendar();
      return;
    }
    this.openCalendar();
  }

  openCalendar(): void {
    if (this.effectiveDisabled() || this.readonly()) return;
    const focusIso = this.initialFocusableIso();
    if (focusIso !== '') {
      const focusDate = parseIsoDate(focusIso);
      if (focusDate !== null) {
        this.visibleMonth.set(startOfMonth(focusDate));
        this.focusedMonthIndex.set(focusDate.getMonth());
      }
    }
    this.focusedIso.set(focusIso);
    this.calendarMode.set('days');
    this.calendarOpen.set(true);
    const dialog = this.calendarDialogElement().nativeElement;
    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
    this.changeDetectorRef.detectChanges();
    this.focusCurrentDayOrClose();
  }

  closeCalendar(): void {
    const dialog = this.calendarDialogElement().nativeElement;
    this.calendarOpen.set(false);
    this.calendarMode.set('days');
    if (dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
    this.markTouched();
    this.changeDetectorRef.detectChanges();
    this.calendarToggleElement().nativeElement.focus();
  }

  onDialogClosed(): void {
    if (!this.calendarOpen()) return;
    this.calendarOpen.set(false);
    this.calendarMode.set('days');
    this.markTouched();
    this.calendarToggleElement().nativeElement.focus();
  }

  onDialogCancel(event: Event): void {
    event.preventDefault();
    this.closeCalendar();
  }

  onDialogClick(event: MouseEvent): void {
    if (event.target === this.calendarDialogElement().nativeElement) this.closeCalendar();
  }

  onDialogKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeCalendar();
      return;
    }
    if (event.key === 'Tab') this.keepTabFocusInsideDialog(event);
  }

  showPreviousMonth(): void {
    this.changeVisibleMonth(-1);
  }

  showNextMonth(): void {
    this.changeVisibleMonth(1);
  }

  toggleMonthYearPicker(): void {
    if (this.calendarMode() === 'days') {
      this.calendarMode.set('monthYear');
      this.focusedMonthIndex.set(this.visibleMonth().getMonth());
      this.changeDetectorRef.detectChanges();
      this.focusMonth(this.focusedMonthIndex());
      return;
    }
    this.calendarMode.set('days');
    this.changeDetectorRef.detectChanges();
    this.focusCurrentDayOrClose();
  }

  showPreviousYear(): void {
    this.changeVisibleYear(-1);
  }

  showNextYear(): void {
    this.changeVisibleYear(1);
  }

  selectMonth(monthIndex: number): void {
    const currentFocus = parseIsoDate(this.focusedIso()) ?? this.visibleMonth();
    const target = dateInMonth(
      this.visibleMonth().getFullYear(),
      monthIndex,
      currentFocus.getDate(),
    );
    const resolved = this.resolveAvailableIso(dateToIso(target), 1) ?? dateToIso(target);
    const resolvedDate = parseIsoDate(resolved);
    if (resolvedDate !== null) this.visibleMonth.set(startOfMonth(resolvedDate));
    this.focusedIso.set(resolved);
    this.focusedMonthIndex.set(monthIndex);
    this.calendarMode.set('days');
    this.changeDetectorRef.detectChanges();
    this.focusCurrentDayOrClose();
  }

  onMonthKeydown(event: KeyboardEvent, monthIndex: number): void {
    let targetIndex: number | null = null;
    if (event.key === 'ArrowLeft') targetIndex = monthIndex - 1;
    else if (event.key === 'ArrowRight') targetIndex = monthIndex + 1;
    else if (event.key === 'ArrowUp') targetIndex = monthIndex - MONTH_GRID_COLUMNS;
    else if (event.key === 'ArrowDown') targetIndex = monthIndex + MONTH_GRID_COLUMNS;
    else if (event.key === 'Home') targetIndex = 0;
    else if (event.key === 'End') targetIndex = MONTHS_IN_YEAR - 1;
    else if (event.key === 'PageUp') {
      event.preventDefault();
      this.showPreviousYear();
      return;
    } else if (event.key === 'PageDown') {
      event.preventDefault();
      this.showNextYear();
      return;
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.selectMonth(monthIndex);
      return;
    }
    if (targetIndex === null) return;
    event.preventDefault();
    const normalizedIndex = Math.min(Math.max(targetIndex, 0), MONTHS_IN_YEAR - 1);
    this.focusedMonthIndex.set(normalizedIndex);
    this.changeDetectorRef.detectChanges();
    this.focusMonth(normalizedIndex);
  }

  selectDate(iso: string): void {
    if (this.isDateUnavailable(iso)) return;
    this.commitValue(iso);
    this.displayValue.set(formatDateForLocale(iso, this.dateLocale()));
    this.manualInputInvalid.set(false);
    this.setManualValueInvalid(false);
    this.closeCalendar();
  }

  clearDate(): void {
    if (!this.canClear()) return;
    this.displayValue.set('');
    this.manualInputInvalid.set(false);
    this.setManualValueInvalid(false);
    this.commitValue('');
    this.closeCalendar();
  }

  onDayKeydown(event: KeyboardEvent, iso: string): void {
    const date = parseIsoDate(iso);
    if (date === null) return;
    let target: Date | null = null;
    let direction: 1 | -1 = 1;
    if (event.key === 'ArrowLeft') {
      target = addDays(date, -1);
      direction = -1;
    } else if (event.key === 'ArrowRight') target = addDays(date, 1);
    else if (event.key === 'ArrowUp') {
      target = addDays(date, -DAYS_IN_WEEK);
      direction = -1;
    } else if (event.key === 'ArrowDown') target = addDays(date, DAYS_IN_WEEK);
    else if (event.key === 'Home') {
      target = addDays(date, -dayOffsetFromWeekStart(date, this.dateLocale()));
      direction = -1;
    } else if (event.key === 'End') {
      target = addDays(date, DAYS_IN_WEEK - 1 - dayOffsetFromWeekStart(date, this.dateLocale()));
    } else if (event.key === 'PageUp') {
      target = event.shiftKey ? changeYear(date, -1) : changeMonth(date, -1);
      direction = -1;
    } else if (event.key === 'PageDown') {
      target = event.shiftKey ? changeYear(date, 1) : changeMonth(date, 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.selectDate(iso);
      return;
    }
    if (target === null) return;
    event.preventDefault();
    const resolved = this.resolveAvailableIso(dateToIso(target), direction);
    if (resolved === null) return;
    const resolvedDate = parseIsoDate(resolved);
    if (resolvedDate === null) return;
    this.focusedIso.set(resolved);
    this.visibleMonth.set(startOfMonth(resolvedDate));
    this.focusedMonthIndex.set(resolvedDate.getMonth());
    this.changeDetectorRef.detectChanges();
    this.focusDay(resolved);
  }

  onTextInput(event: Event): void {
    if (this.effectiveDisabled() || this.readonly()) return;
    const value = readInputValue(event);
    this.displayValue.set(value);
    this.manualInputInvalid.set(false);
    const parsed = parseDateForLocale(value, this.dateLocale());
    const invalid = parsed === null || (parsed !== '' && this.isDateUnavailable(parsed));
    this.setManualValueInvalid(invalid);
    if (invalid) return;
    this.commitValue(parsed);
  }

  onTextBlur(): void {
    const parsed = parseDateForLocale(this.displayValue(), this.dateLocale());
    const invalid = parsed === null || (parsed !== '' && this.isDateUnavailable(parsed));
    this.manualInputInvalid.set(invalid);
    this.setManualValueInvalid(invalid);
    if (!invalid && parsed !== null) {
      if (parsed !== this.currentValue()) this.commitValue(parsed);
      this.displayValue.set(formatDateForLocale(parsed, this.dateLocale()));
    }
    this.markTouched();
  }

  isDateUnavailable(iso: string): boolean {
    const min = validIsoOrNull(this.min());
    const max = validIsoOrNull(this.max());
    if (min !== null && iso < min) return true;
    if (max !== null && iso > max) return true;
    return this.disabledDates()?.includes(iso) ?? false;
  }

  private commitValue(value: string): void {
    this.formValue.set(value);
    this.valueChange.emit(value);
    this.onFormChange?.(value);
  }

  private markTouched(): void {
    this.onFormTouched?.();
  }

  private setManualValueInvalid(invalid: boolean): void {
    if (invalid === this.manualValueInvalid()) return;
    this.manualValueInvalid.set(invalid);
    this.validityChange.emit(!invalid);
    this.onValidatorChange?.();
  }

  private initialFocusableIso(): string {
    const current = this.currentValue();
    if (parseIsoDate(current) !== null && !this.isDateUnavailable(current)) return current;
    const today = dateToIso(new Date());
    return this.resolveAvailableIso(today, 1) ?? this.resolveAvailableIso(today, -1) ?? '';
  }

  private resolveAvailableIso(candidate: string, direction: 1 | -1): string | null {
    let date = parseIsoDate(candidate);
    if (date === null) return null;
    const min = validIsoOrNull(this.min());
    const max = validIsoOrNull(this.max());
    let iso = dateToIso(date);
    if (min !== null && iso < min) {
      date = parseIsoDate(min);
      if (date === null) return null;
      iso = min;
    }
    if (max !== null && iso > max) {
      date = parseIsoDate(max);
      if (date === null) return null;
      iso = max;
    }
    while (this.isDateUnavailable(iso)) {
      date = addDays(date, direction);
      iso = dateToIso(date);
      if ((min !== null && iso < min) || (max !== null && iso > max)) return null;
    }
    return iso;
  }

  private changeVisibleMonth(offset: number): void {
    const focusDate = parseIsoDate(this.focusedIso()) ?? this.visibleMonth();
    const target = changeMonth(focusDate, offset);
    const resolved = this.resolveAvailableIso(dateToIso(target), offset < 0 ? -1 : 1);
    if (resolved === null) return;
    const resolvedDate = parseIsoDate(resolved);
    if (resolvedDate === null) return;
    this.focusedIso.set(resolved);
    this.visibleMonth.set(startOfMonth(resolvedDate));
    this.focusedMonthIndex.set(resolvedDate.getMonth());
  }

  private changeVisibleYear(offset: number): void {
    const focusDate = parseIsoDate(this.focusedIso()) ?? this.visibleMonth();
    const target = changeYear(focusDate, offset);
    const resolved = this.resolveAvailableIso(dateToIso(target), offset < 0 ? -1 : 1);
    if (resolved === null) return;
    const resolvedDate = parseIsoDate(resolved);
    if (resolvedDate === null) return;
    this.focusedIso.set(resolved);
    this.visibleMonth.set(startOfMonth(resolvedDate));
    this.focusedMonthIndex.set(resolvedDate.getMonth());
  }

  private focusCurrentDayOrClose(): void {
    if (this.focusedIso() !== '' && this.focusDay(this.focusedIso())) return;
    this.closeButtonElement().nativeElement.focus();
  }

  private focusDay(iso: string): boolean {
    const target = this.dayButtonElements().find(
      (button) => button.nativeElement.dataset['date'] === iso,
    );
    target?.nativeElement.focus();
    return target !== undefined;
  }

  private focusMonth(monthIndex: number): void {
    const target = this.monthButtonElements().find(
      (button) => Number(button.nativeElement.dataset['monthIndex']) === monthIndex,
    );
    target?.nativeElement.focus();
  }

  private keepTabFocusInsideDialog(event: KeyboardEvent): void {
    const dialog = this.calendarDialogElement().nativeElement;
    const focusable = [...dialog.querySelectorAll<HTMLElement>('button, input, [tabindex]')].filter(
      (element) => !element.hasAttribute('disabled') && element.tabIndex >= 0,
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    }
  }
}

function readInputValue(event: Event): string {
  return (event.target as HTMLInputElement).value;
}

function buildWeekdayLabels(dateLocale: string): WeekdayLabel[] {
  const firstDay = firstDayOfWeek(dateLocale);
  const sunday = new Date(2026, 1, 1);
  const shortFormatter = new Intl.DateTimeFormat(dateLocale, { weekday: 'short' });
  const longFormatter = new Intl.DateTimeFormat(dateLocale, { weekday: 'long' });
  return Array.from({ length: DAYS_IN_WEEK }, (_, index) => {
    const dayIndex = (firstDay + index) % DAYS_IN_WEEK;
    const date = addDays(sunday, dayIndex);
    return {
      short: shortFormatter.format(date),
      long: longFormatter.format(date),
    };
  });
}

function buildCalendarCells(params: {
  month: Date;
  selectedIso: string;
  dateLocale: string;
  isDisabled: (iso: string) => boolean;
}): (CalendarCell | null)[] {
  const year = params.month.getFullYear();
  const month = params.month.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = dayOffsetFromWeekStart(firstDay, params.dateLocale);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (CalendarCell | null)[] = Array.from({ length: startOffset }, () => null);
  const todayIso = dateToIso(new Date());

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const iso = dateToIso(date);
    cells.push({
      iso,
      label: String(day),
      ariaLabel: formatLongDate(date, params.dateLocale),
      selected: iso === params.selectedIso,
      today: iso === todayIso,
      disabled: params.isDisabled(iso),
    });
  }
  while (cells.length % DAYS_IN_WEEK !== 0) cells.push(null);
  return cells;
}

function buildMonthOptions(params: { month: Date; dateLocale: string }): MonthOption[] {
  const year = params.month.getFullYear();
  const selectedMonth = params.month.getMonth();
  const shortMonthFormatter = new Intl.DateTimeFormat(params.dateLocale, { month: 'short' });
  const longMonthFormatter = new Intl.DateTimeFormat(params.dateLocale, { month: 'long' });

  return Array.from({ length: MONTHS_IN_YEAR }, (_, monthIndex) => {
    const date = new Date(year, monthIndex, 1);
    return {
      index: monthIndex,
      label: shortMonthFormatter.format(date),
      ariaLabel: longMonthFormatter.format(date),
      selected: monthIndex === selectedMonth,
    };
  });
}

function firstDayOfWeek(dateLocale: string): number {
  const locale = new Intl.Locale(dateLocale) as Intl.Locale & {
    getWeekInfo?: () => { firstDay: number };
  };
  const firstDay = locale.getWeekInfo?.().firstDay;
  if (firstDay !== undefined) return firstDay % DAYS_IN_WEEK;
  return (locale.region ?? locale.maximize().region) === 'US' ? 0 : 1;
}

function dayOffsetFromWeekStart(date: Date, dateLocale: string): number {
  return (date.getDay() - firstDayOfWeek(dateLocale) + DAYS_IN_WEEK) % DAYS_IN_WEEK;
}

function formatDateForLocale(value: string, dateLocale: string): string {
  if (value === '') return '';
  const date = parseIsoDate(value);
  if (date === null) return value;
  return new Intl.DateTimeFormat(dateLocale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatLongDate(date: Date, dateLocale: string): string {
  return new Intl.DateTimeFormat(dateLocale, { dateStyle: 'long' }).format(date);
}

function parseDateForLocale(value: string, dateLocale: string): string | null {
  const normalized = value.trim();
  if (normalized === '') return '';
  const rawParts = normalized.split(DATE_SEPARATOR_PATTERN);
  if (rawParts.length !== 3) return null;
  const numericParts = rawParts.map(Number);
  if (numericParts.some((part) => !Number.isInteger(part))) return null;
  const order = datePartOrder(dateLocale);
  const day = numericParts[order.indexOf('day')];
  const month = numericParts[order.indexOf('month')];
  const year = numericParts[order.indexOf('year')];
  if (!isValidDateParts(year, month, day)) return null;
  return datePartsToIso(year, month - 1, day);
}

function datePartOrder(dateLocale: string): DatePart[] {
  return new Intl.DateTimeFormat(dateLocale, {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  })
    .formatToParts(new Date(2006, 10, 22))
    .filter((part): part is Intl.DateTimeFormatPart & { type: DatePart } =>
      ['day', 'month', 'year'].includes(part.type),
    )
    .map((part) => part.type);
}

function validIsoOrNull(value: string | undefined): string | null {
  if (value === undefined || parseIsoDate(value) === null) return null;
  return value;
}

function parseIsoDate(value: string): Date | null {
  const parts = value.split('-');
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!isValidDateParts(year, month, day)) return null;
  return new Date(year, month - 1, day);
}

function isValidDateParts(year: number, month: number, day: number): boolean {
  const date = new Date(year, month - 1, day);
  return (
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    Number.isInteger(day) &&
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function dateInMonth(year: number, monthIndex: number, day: number): Date {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(day, lastDay));
}

function changeMonth(date: Date, offset: number): Date {
  const targetMonthStart = new Date(date.getFullYear(), date.getMonth() + offset, 1);
  return dateInMonth(targetMonthStart.getFullYear(), targetMonthStart.getMonth(), date.getDate());
}

function changeYear(date: Date, offset: number): Date {
  return dateInMonth(date.getFullYear() + offset, date.getMonth(), date.getDate());
}

function addDays(date: Date, offset: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
}

function dateToIso(date: Date): string {
  return datePartsToIso(date.getFullYear(), date.getMonth(), date.getDate());
}

function datePartsToIso(year: number, monthIndex: number, day: number): string {
  return `${year}-${padDatePart(monthIndex + 1)}-${padDatePart(day)}`;
}

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

function chunkRows<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
}
