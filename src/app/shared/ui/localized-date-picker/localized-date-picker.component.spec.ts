import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import {
  LocalizedDatePickerComponent,
  LocalizedDatePickerLabels,
} from './localized-date-picker.component';

const LABELS: LocalizedDatePickerLabels = {
  placeholder: 'дд.мм.гггг',
  openCalendar: 'Открыть календарь',
  changeCalendar: 'Изменить дату',
  dialog: 'Выбор даты',
  previousMonth: 'Предыдущий месяц',
  nextMonth: 'Следующий месяц',
  openMonthYearPicker: 'Выбрать месяц и год',
  previousYear: 'Предыдущий год',
  nextYear: 'Следующий год',
  clear: 'Очистить',
  close: 'Закрыть',
  formatHint: 'Формат даты: ДД.ММ.ГГГГ',
  invalidDate: 'Введите корректную дату в формате ДД.ММ.ГГГГ.',
  requiredDate: 'Укажите дату.',
  keyboardHelp: 'Используйте стрелки для выбора даты.',
};

describe('LocalizedDatePickerComponent', () => {
  let fixture: ComponentFixture<LocalizedDatePickerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LocalizedDatePickerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LocalizedDatePickerComponent);
    fixture.componentRef.setInput('inputId', 'publishedFrom');
    fixture.componentRef.setInput('value', '2026-02-05');
    fixture.componentRef.setInput('controlSize', 'default');
    fixture.componentRef.setInput('dateLocale', 'ru-RU');
    fixture.componentRef.setInput('labels', LABELS);
    fixture.componentRef.setInput('required', false);
    fixture.componentRef.setInput('invalid', false);
    fixture.componentRef.setInput('controlDisabled', false);
    fixture.componentRef.setInput('readonly', false);
    fixture.detectChanges();
    installDialogMethods(calendarDialog());
  });

  afterEach(() => fixture.destroy());

  it('renders a localized field with persistent format guidance', () => {
    const input = dateInput();
    const toggle = calendarToggle();

    expect(input.type).toBe('text');
    expect(input.value).toBe('05.02.2026');
    expect(input.placeholder).toBe('дд.мм.гггг');
    expect(input.getAttribute('aria-describedby')).toContain('FormatHint');
    expect(document.getElementById(input.getAttribute('aria-describedby')!)).not.toBeNull();
    expect(toggle.getAttribute('aria-haspopup')).toBe('dialog');
    expect(toggle.getAttribute('aria-controls')).toBe(calendarDialog().id);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-label')).toContain('Изменить дату');
    expect(toggle.getAttribute('aria-label')).toContain('5 февраля 2026');
  });

  it('opens a named modal dialog and exposes calendar grid semantics', () => {
    openCalendar();

    const dialog = calendarDialog();
    const grid = dialog.querySelector('[role="grid"]') as HTMLElement;
    const selectedDay = dayButton('2026-02-05');
    const weekdayHeaders = dialog.querySelectorAll('[role="columnheader"]');

    expect(dialog.open).toBe(true);
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('Выбор даты');
    expect(grid.getAttribute('aria-labelledby')).toContain('MonthHeading');
    expect(grid.getAttribute('aria-describedby')).toContain('KeyboardHelp');
    expect(weekdayHeaders).toHaveLength(7);
    expect(weekdayHeaders[0].querySelector('abbr')?.getAttribute('title')).toBe('понедельник');
    expect(selectedDay.getAttribute('role')).toBe('gridcell');
    expect(selectedDay.getAttribute('aria-selected')).toBe('true');
    expect(monthHeading().getAttribute('aria-live')).toBe('polite');
    expect(calendarToggle().getAttribute('aria-expanded')).toBe('true');
  });

  it('uses stylesheet-owned dialog positioning for strict style-src-attr CSP', () => {
    openCalendar();

    expect(calendarDialog().getAttribute('style')).toBeNull();
  });

  it('moves focus to the selected day and keeps one day in the Tab sequence', () => {
    openCalendar();

    const dayButtons = calendarDialog().querySelectorAll<HTMLButtonElement>('[data-date]');
    const tabStops = [...dayButtons].filter((button) => button.tabIndex === 0);

    expect(document.activeElement).toBe(dayButton('2026-02-05'));
    expect(tabStops).toHaveLength(1);
    expect(tabStops[0].dataset['date']).toBe('2026-02-05');
  });

  it('uses arrow, Home, and End keys to navigate by day and localized week', () => {
    openCalendar();

    dispatchKey(dayButton('2026-02-05'), 'ArrowRight');
    expect(document.activeElement).toBe(dayButton('2026-02-06'));

    dispatchKey(dayButton('2026-02-06'), 'ArrowUp');
    expect(document.activeElement).toBe(dayButton('2026-01-30'));

    dispatchKey(dayButton('2026-01-30'), 'Home');
    expect(document.activeElement).toBe(dayButton('2026-01-26'));

    dispatchKey(dayButton('2026-01-26'), 'End');
    expect(document.activeElement).toBe(dayButton('2026-02-01'));
  });

  it('uses PageUp and PageDown to preserve the day across month and year boundaries', () => {
    fixture.componentRef.setInput('value', '2026-01-31');
    fixture.detectChanges();
    openCalendar();

    dispatchKey(dayButton('2026-01-31'), 'PageDown');
    expect(document.activeElement).toBe(dayButton('2026-02-28'));

    dispatchKey(dayButton('2026-02-28'), 'PageUp', { shiftKey: true });
    expect(document.activeElement).toBe(dayButton('2025-02-28'));
  });

  it('selects the focused day with Enter and emits an ISO value', () => {
    const valueChange = jest.fn();
    fixture.componentInstance.valueChange.subscribe(valueChange);
    openCalendar();

    dispatchKey(dayButton('2026-02-05'), 'ArrowRight');
    dispatchKey(dayButton('2026-02-06'), 'Enter');

    expect(valueChange).toHaveBeenCalledWith('2026-02-06');
    expect(calendarDialog().open).toBe(false);
    expect(document.activeElement).toBe(calendarToggle());
  });

  it('closes without changing the value on Escape or backdrop click and restores focus', () => {
    const valueChange = jest.fn();
    fixture.componentInstance.valueChange.subscribe(valueChange);
    openCalendar();

    dispatchKey(dayButton('2026-02-05'), 'Escape');

    expect(valueChange).not.toHaveBeenCalled();
    expect(calendarDialog().open).toBe(false);
    expect(document.activeElement).toBe(calendarToggle());

    openCalendar();
    calendarDialog().dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(calendarDialog().open).toBe(false);
    expect(document.activeElement).toBe(calendarToggle());
  });

  it('wraps Tab focus inside the modal dialog', () => {
    openCalendar();
    const close = calendarDialog().querySelector(
      '[data-testid="date-picker-close"]',
    ) as HTMLButtonElement;
    const previousMonth = calendarDialog().querySelector(
      '[data-testid="date-picker-previous-month"]',
    ) as HTMLButtonElement;
    close.focus();

    dispatchKey(close, 'Tab');

    expect(document.activeElement).toBe(previousMonth);
  });

  it('retains invalid manual input and exposes an announced error', () => {
    const valueChange = jest.fn();
    fixture.componentInstance.valueChange.subscribe(valueChange);
    const input = dateInput();
    input.value = '31.02.2026';

    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(valueChange).not.toHaveBeenCalled();
    expect(input.value).toBe('31.02.2026');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-errormessage')).toContain('Error');
    expect(validationMessage().textContent).toContain(LABELS.invalidDate);
  });

  it('parses localized manual input and emits ISO values', () => {
    fixture.componentRef.setInput('value', '2026-03-04');
    fixture.componentRef.setInput('dateLocale', 'en-US');
    fixture.componentRef.setInput('labels', {
      ...LABELS,
      placeholder: 'mm/dd/yyyy',
      formatHint: 'Date format: MM/DD/YYYY',
    });
    const valueChange = jest.fn();
    fixture.componentInstance.valueChange.subscribe(valueChange);
    fixture.detectChanges();
    const input = dateInput();

    expect(input.value).toBe('03/04/2026');
    input.value = '03/31/2026';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(valueChange).toHaveBeenCalledWith('2026-03-31');
    expect(input.value).toBe('03/31/2026');
  });

  it('disables dates outside min/max and explicitly unavailable dates', () => {
    fixture.componentRef.setInput('min', '2026-02-05');
    fixture.componentRef.setInput('max', '2026-02-20');
    fixture.componentRef.setInput('disabledDates', ['2026-02-06', '2026-02-10']);
    const valueChange = jest.fn();
    fixture.componentInstance.valueChange.subscribe(valueChange);
    fixture.detectChanges();
    openCalendar();

    expect(dayButton('2026-02-04').disabled).toBe(true);
    expect(dayButton('2026-02-04').getAttribute('aria-disabled')).toBe('true');
    expect(dayButton('2026-02-10').disabled).toBe(true);
    expect(dayButton('2026-02-21').disabled).toBe(true);
    dayButton('2026-02-10').click();
    dispatchKey(dayButton('2026-02-05'), 'ArrowRight');

    expect(valueChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(dayButton('2026-02-07'));
  });

  it('clears optional values and hides the clear action for required fields', () => {
    const valueChange = jest.fn();
    fixture.componentInstance.valueChange.subscribe(valueChange);
    openCalendar();
    const clear = calendarDialog().querySelector(
      '[data-testid="date-picker-clear"]',
    ) as HTMLButtonElement;

    clear.click();

    expect(valueChange).toHaveBeenCalledWith('');
    expect(dateInput().value).toBe('');
    expect(calendarDialog().open).toBe(false);

    fixture.componentRef.setInput('required', true);
    fixture.detectChanges();
    openCalendar();
    expect(calendarDialog().querySelector('[data-testid="date-picker-clear"]')).toBeNull();
  });

  it('announces required errors and honors readonly and disabled states', () => {
    fixture.componentRef.setInput('value', '');
    fixture.componentRef.setInput('required', true);
    fixture.componentRef.setInput('invalid', true);
    fixture.detectChanges();

    expect(validationMessage().textContent).toContain(LABELS.requiredDate);

    fixture.componentRef.setInput('readonly', true);
    fixture.detectChanges();
    expect(dateInput().readOnly).toBe(true);
    expect(calendarToggle().disabled).toBe(true);

    fixture.componentRef.setInput('readonly', false);
    fixture.componentRef.setInput('controlDisabled', true);
    fixture.detectChanges();
    expect(dateInput().disabled).toBe(true);
    expect(calendarToggle().disabled).toBe(true);
  });

  it('integrates change, touched, writeValue, and disabled state with Angular forms', () => {
    fixture.componentRef.setInput('value', undefined);
    const onChange = jest.fn();
    const onTouched = jest.fn();
    fixture.componentInstance.registerOnChange(onChange);
    fixture.componentInstance.registerOnTouched(onTouched);

    fixture.componentInstance.writeValue('2027-12-15');
    fixture.detectChanges();
    expect(dateInput().value).toBe('15.12.2027');

    dateInput().value = '16.12.2027';
    dateInput().dispatchEvent(new Event('input'));
    dateInput().dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(onChange).toHaveBeenCalledWith('2027-12-16');
    expect(onTouched).toHaveBeenCalled();

    fixture.componentInstance.setDisabledState(true);
    fixture.detectChanges();
    expect(dateInput().disabled).toBe(true);
  });

  it('makes Angular forms invalid while the text field contains an invalid date', () => {
    fixture.componentRef.setInput('value', undefined);
    fixture.componentInstance.writeValue('2027-12-15');
    const validatorChange = jest.fn();
    const validityChange = jest.fn();
    fixture.componentInstance.registerOnValidatorChange(validatorChange);
    fixture.componentInstance.validityChange.subscribe(validityChange);
    fixture.detectChanges();
    const input = dateInput();
    input.value = '31.02.2027';

    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(validatorChange).toHaveBeenCalled();
    expect(fixture.componentInstance.validate(new FormControl('2027-12-15'))).toEqual({
      dateInvalid: true,
    });
    expect(validityChange).toHaveBeenCalledWith(false);

    input.value = '16.12.2027';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.componentInstance.validate(new FormControl('2027-12-16'))).toBeNull();
    expect(validityChange).toHaveBeenCalledWith(true);
  });

  it('supports keyboard navigation in the month picker with one month tab stop', () => {
    openCalendar();
    const toggle = calendarDialog().querySelector(
      '[data-testid="date-picker-month-year-toggle"]',
    ) as HTMLButtonElement;
    toggle.click();
    fixture.detectChanges();

    const monthButtons = calendarDialog().querySelectorAll<HTMLButtonElement>('[data-month-index]');
    const selectedMonth = calendarDialog().querySelector(
      '[data-month-index="1"]',
    ) as HTMLButtonElement;
    expect([...monthButtons].filter((button) => button.tabIndex === 0)).toHaveLength(1);
    expect(document.activeElement).toBe(selectedMonth);

    dispatchKey(selectedMonth, 'ArrowRight');
    const march = calendarDialog().querySelector('[data-month-index="2"]') as HTMLButtonElement;
    expect(document.activeElement).toBe(march);

    dispatchKey(march, 'Enter');
    expect(
      calendarDialog().querySelector('[data-testid="date-picker-month-year-panel"]'),
    ).toBeNull();
    expect(document.activeElement).toBe(dayButton('2026-03-05'));
  });

  function openCalendar(): void {
    calendarToggle().click();
    fixture.detectChanges();
  }

  function dateInput(): HTMLInputElement {
    return fixture.nativeElement.querySelector('#publishedFrom') as HTMLInputElement;
  }

  function calendarToggle(): HTMLButtonElement {
    return fixture.nativeElement.querySelector(
      '[data-testid="date-picker-toggle"]',
    ) as HTMLButtonElement;
  }

  function calendarDialog(): HTMLDialogElement {
    return fixture.nativeElement.querySelector(
      '[data-testid="date-picker-calendar"]',
    ) as HTMLDialogElement;
  }

  function dayButton(iso: string): HTMLButtonElement {
    const button = calendarDialog().querySelector(`[data-date="${iso}"]`) as HTMLButtonElement;
    expect(button).not.toBeNull();
    return button;
  }

  function monthHeading(): HTMLElement {
    return calendarDialog().querySelector(
      '[data-testid="date-picker-month-heading"]',
    ) as HTMLElement;
  }

  function validationMessage(): HTMLElement {
    return fixture.nativeElement.querySelector(
      '[data-testid="date-picker-validation-message"]',
    ) as HTMLElement;
  }

  function dispatchKey(
    element: HTMLElement,
    key: string,
    init: Pick<KeyboardEventInit, 'shiftKey'> = {},
  ): void {
    element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
    fixture.detectChanges();
  }

  function installDialogMethods(dialog: HTMLDialogElement): void {
    Object.defineProperty(dialog, 'showModal', {
      configurable: true,
      value: (): void => dialog.setAttribute('open', ''),
    });
    Object.defineProperty(dialog, 'close', {
      configurable: true,
      value: (): void => {
        dialog.removeAttribute('open');
        dialog.dispatchEvent(new Event('close'));
      },
    });
  }
});

describe('LocalizedDatePickerComponent on the server', () => {
  it('does not call browser constraint-validation APIs during SSR', async () => {
    await TestBed.configureTestingModule({
      imports: [LocalizedDatePickerComponent],
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    }).compileComponents();
    const fixture = TestBed.createComponent(LocalizedDatePickerComponent);
    fixture.componentRef.setInput('inputId', 'serverDate');
    fixture.componentRef.setInput('value', '2026-02-05');
    fixture.componentRef.setInput('controlSize', 'default');
    fixture.componentRef.setInput('dateLocale', 'ru-RU');
    fixture.componentRef.setInput('labels', LABELS);
    fixture.componentRef.setInput('required', false);
    fixture.componentRef.setInput('invalid', false);
    fixture.componentRef.setInput('controlDisabled', false);
    fixture.componentRef.setInput('readonly', false);
    const setCustomValidity = jest.spyOn(HTMLInputElement.prototype, 'setCustomValidity');

    fixture.detectChanges();

    expect(setCustomValidity).not.toHaveBeenCalled();
    setCustomValidity.mockRestore();
    fixture.destroy();
  });
});
