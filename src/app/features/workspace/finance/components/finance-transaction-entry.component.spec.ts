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
