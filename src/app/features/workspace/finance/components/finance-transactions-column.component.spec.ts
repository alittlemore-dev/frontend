import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { FINANCE_TEST_MONTH, FINANCE_TEST_TRANSACTION } from '../testing/finance-fixtures';
import { FinanceTransactionsColumnComponent } from './finance-transactions-column.component';

describe('FinanceTransactionsColumnComponent', () => {
  let fixture: ComponentFixture<FinanceTransactionsColumnComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FinanceTransactionsColumnComponent],
      providers: [provideI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(FinanceTransactionsColumnComponent);
    fixture.componentRef.setInput('kind', 'expense');
    fixture.componentRef.setInput('timeZone', 'UTC');
    fixture.componentRef.setInput('month', FINANCE_TEST_MONTH);
    fixture.componentRef.setInput('transactions', [FINANCE_TEST_TRANSACTION]);
    fixture.componentRef.setInput('historyTransactionId', null);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();
  });

  it('keeps edit, deletion, and history actions separate and accessible', () => {
    const editing = jest.fn();
    const deleting = jest.fn();
    const history = jest.fn();
    fixture.componentInstance.editRequested.subscribe(editing);
    fixture.componentInstance.deletionRequested.subscribe(deleting);
    fixture.componentInstance.historyRequested.subscribe(history);
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.finance-history-button')?.click();
    root.querySelector<HTMLButtonElement>('.finance-icon-button-danger')?.click();
    expect(history).toHaveBeenCalledWith(FINANCE_TEST_TRANSACTION);
    expect(deleting).toHaveBeenCalledWith(FINANCE_TEST_TRANSACTION);
    expect(editing).not.toHaveBeenCalled();
    root.querySelector<HTMLButtonElement>('.finance-transaction-edit')?.click();
    expect(editing).toHaveBeenCalledWith(FINANCE_TEST_TRANSACTION);
  });

  it('shows the saved Telegram creator and source on active and deleted operations', () => {
    fixture.componentRef.setInput('transactions', [
      {
        ...FINANCE_TEST_TRANSACTION,
        source: 'telegram',
        authorId: '42',
        authorLabel: 'Family',
        deleted: true,
      },
    ]);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Family');
    expect(root.textContent).toContain('finance.transaction.source.telegram');
    expect(root.querySelector('.finance-archived')).not.toBeNull();
  });

  it('requests creation from the header and exposes the expanded history state', () => {
    const creating = jest.fn();
    fixture.componentInstance.creationRequested.subscribe(creating);
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.finance-add-transaction')?.click();
    expect(creating).toHaveBeenCalledTimes(1);
    const history = root.querySelector<HTMLButtonElement>('.finance-history-button');
    expect(history?.getAttribute('aria-expanded')).toBe('false');
    fixture.componentRef.setInput('historyTransactionId', FINANCE_TEST_TRANSACTION.id);
    fixture.detectChanges();
    expect(history?.getAttribute('aria-expanded')).toBe('true');
    expect(history?.getAttribute('aria-controls')).toBe('finance-history');
    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();
    expect(root.querySelector<HTMLButtonElement>('.finance-add-transaction')?.disabled).toBe(true);
  });
});
