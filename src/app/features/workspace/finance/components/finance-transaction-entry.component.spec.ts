import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { FinanceTransactionEntryComponent } from './finance-transaction-entry.component';

describe('FinanceTransactionEntryComponent', () => {
  let fixture: ComponentFixture<FinanceTransactionEntryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FinanceTransactionEntryComponent],
      providers: [provideI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(FinanceTransactionEntryComponent);
    fixture.componentRef.setInput('inputId', 'entry');
    fixture.componentRef.setInput('initialValue', {
      categoryId: '',
      amount: '',
      currency: 'RUB',
      dateTime: '2026-09-15T12:00',
      description: '',
    });
    fixture.componentRef.setInput('categories', [{ id: 'food', name: 'Food' }]);
    fixture.componentRef.setInput('min', '2026-09-01T00:00');
    fixture.componentRef.setInput('max', '2026-09-30T23:59');
    fixture.componentRef.setInput('timeZone', 'Asia/Yerevan');
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('waits for a save attempt before showing errors while editing', () => {
    const amount = fixture.nativeElement.querySelector('#entry-amount') as HTMLInputElement;
    const category = fixture.nativeElement.querySelector('#entry-category') as HTMLButtonElement;
    amount.value = '0';
    amount.dispatchEvent(new Event('input', { bubbles: true }));
    amount.dispatchEvent(new Event('blur'));
    category.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    expect(amount.classList).not.toContain('is-invalid');
    expect(amount.getAttribute('aria-invalid')).not.toBe('true');
    expect(category.getAttribute('aria-invalid')).not.toBe('true');

    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(amount.classList).toContain('is-invalid');
    expect(amount.getAttribute('aria-invalid')).toBe('true');
    expect(category.getAttribute('aria-invalid')).toBe('true');

    fixture.componentInstance.form.controls.categoryId.setValue('food');
    amount.value = '25';
    amount.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    expect(amount.classList).not.toContain('is-invalid');
    expect(category.getAttribute('aria-invalid')).not.toBe('true');
  });

  it('hides previous validation errors when opening another transaction draft', () => {
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();

    fixture.componentRef.setInput('initialValue', {
      categoryId: '',
      amount: '',
      currency: 'USD',
      dateTime: '',
      description: '',
    });
    fixture.detectChanges();
    const amount = fixture.nativeElement.querySelector('#entry-amount') as HTMLInputElement;
    amount.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    expect(amount.classList).not.toContain('is-invalid');
  });

  it.each(['', 'unfinished', '01.10.2026 12:00'])(
    'shows date errors only after a save attempt for %p',
    (value) => {
      const submitted = jest.fn();
      fixture.componentInstance.submitted.subscribe(submitted);
      fixture.componentInstance.form.controls.categoryId.setValue('food');
      fixture.componentInstance.form.controls.amount.setValue('25');
      fixture.detectChanges();
      const date = fixture.nativeElement.querySelector('#entry-date') as HTMLInputElement;
      date.value = value;
      date.dispatchEvent(new Event('input', { bubbles: true }));
      date.dispatchEvent(new Event('blur'));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
      expect(date.getAttribute('aria-invalid')).not.toBe('true');

      const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      fixture.detectChanges();

      expect(submitted).not.toHaveBeenCalled();
      expect(fixture.nativeElement.querySelector('.finance-entry-error')).not.toBeNull();
      expect(
        fixture.nativeElement.querySelector('[data-testid="datetime-picker-validation-message"]'),
      ).not.toBeNull();
      expect(date.getAttribute('aria-invalid')).toBe('true');

      date.value = '16.09.2026 12:00';
      date.dispatchEvent(new Event('input', { bubbles: true }));
      date.dispatchEvent(new Event('blur'));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      fixture.detectChanges();
      expect(submitted).toHaveBeenCalledWith(
        expect.objectContaining({ dateTime: '2026-09-16T12:00', amount: '25' }),
      );
    },
  );

  it('blocks incomplete and nonpositive amounts with visible feedback', () => {
    const submitted = jest.fn();
    fixture.componentInstance.submitted.subscribe(submitted);
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(submitted).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    fixture.componentInstance.form.controls.categoryId.setValue('food');
    fixture.componentInstance.form.controls.amount.setValue('0');
    fixture.componentInstance.submit();
    expect(submitted).not.toHaveBeenCalled();
  });

  it('rejects a category that disappeared while a draft was open', () => {
    const submitted = jest.fn();
    fixture.componentInstance.submitted.subscribe(submitted);
    fixture.componentInstance.form.controls.categoryId.setValue('food');
    fixture.componentInstance.form.controls.amount.setValue('10');
    fixture.componentRef.setInput('categories', []);
    fixture.detectChanges();
    fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(submitted).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('disables editing during save without resetting the authored values', () => {
    const amount = fixture.nativeElement.querySelector('#entry-amount') as HTMLInputElement;
    amount.value = '25';
    amount.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();
    expect(amount.disabled).toBe(true);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();
    expect(amount.disabled).toBe(false);
    expect(amount.value).toBe('25');
  });

  it('accepts the decimal comma for localized amount input', () => {
    const submitted = jest.fn();
    fixture.componentInstance.submitted.subscribe(submitted);
    fixture.componentInstance.form.controls.categoryId.setValue('food');
    fixture.componentInstance.form.controls.amount.setValue('12,5');
    fixture.componentInstance.submit();
    expect(submitted).toHaveBeenCalledWith(expect.objectContaining({ amount: '12,5' }));
  });

  it('hides browser-local shortcuts when the tracker uses another zone', () => {
    const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fixture.componentRef.setInput(
      'timeZone',
      browserZone === 'Asia/Yerevan' ? 'Pacific/Honolulu' : 'Asia/Yerevan',
    );
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    dialog.showModal = () => dialog.setAttribute('open', '');
    dialog.close = () => dialog.removeAttribute('open');
    const trigger = fixture.nativeElement.querySelector(
      '[data-testid="temporal-picker-field-trigger"]',
    ) as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    expect(dialog.open).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-testid="date-picker-now"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="date-picker-today"]')).toBeNull();
    fixture.componentRef.setInput('timeZone', browserZone);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="date-picker-now"]')).not.toBeNull();
  });
});
