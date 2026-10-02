import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { FinanceService } from '../services/finance.service';
import {
  FINANCE_TEST_MONTH as MONTH,
  FINANCE_TEST_TRANSACTION as TRANSACTION,
} from '../testing/finance-fixtures';
import { FinanceOverviewPageComponent } from './finance-overview-page.component';

describe('Finance month navigation', () => {
  const january = { ...MONTH, periodStart: '2026-01-01' };
  const december = { ...MONTH, periodStart: '2025-12-01' };
  const service = {
    ensure: jest.fn(() => of(january)),
    historicalMonth: jest.fn(() => of(december)),
    historicalTransactions: jest.fn(() => of([TRANSACTION])),
    historicalRevisions: jest.fn(() => of([])),
    transactions: jest.fn(() => of([])),
    createTransaction: jest.fn(() => of(TRANSACTION)),
    updateTransaction: jest.fn(() => of(TRANSACTION)),
    deleteTransaction: jest.fn(() => of(TRANSACTION)),
    restoreTransaction: jest.fn(() => of(TRANSACTION)),
  };
  beforeEach(() => {
    jest.clearAllMocks();
    service.historicalMonth.mockReturnValue(of(december));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'finance', component: FinanceOverviewPageComponent }]),
        provideI18nTesting(),
        { provide: FinanceService, useValue: service },
      ],
    });
  });

  it('crosses the year boundary and returns to the current month without query parameters', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/finance', FinanceOverviewPageComponent);
    page.navigateMonth(-1);
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(TestBed.inject(Router).url).toContain('year=2025');
    expect(TestBed.inject(Router).url).toContain('month=12');
    expect(service.historicalMonth).toHaveBeenCalledWith('2025-12-01');
    expect(harness.routeNativeElement!.querySelector('input#finance-opening')).toBeNull();
    expect(harness.routeNativeElement!.querySelectorAll('.finance-transaction-edit')).toHaveLength(
      0,
    );
    page.returnToCurrent();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/finance');
  });

  it('loads a historical bookmark and reads historical operation revisions', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl(
      '/finance?year=2025&month=12',
      FinanceOverviewPageComponent,
    );
    expect(page.month()?.periodStart).toBe('2025-12-01');
    expect(service.historicalTransactions).toHaveBeenCalledWith('2025-12-01', false);
    page.showRevisions(TRANSACTION);
    expect(service.historicalRevisions).toHaveBeenCalledWith('2025-12-01', TRANSACTION.id);
  });

  it('shows a missing historical month without retaining data from another month', async () => {
    service.historicalMonth.mockReturnValue(throwError(() => ({ status: 404 })));
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/finance?year=2025&month=11');
    expect(harness.routeNativeElement!.textContent).toContain('finance.month.empty');
    expect(harness.routeNativeElement!.querySelector('.finance-category-table')).toBeNull();
  });

  it('normalizes incomplete and future query dates to the current month', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/finance?month=12');
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/finance');
    await harness.navigateByUrl('/finance?year=2027&month=1');
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/finance');
    expect(service.historicalMonth).not.toHaveBeenCalled();
  });

  it('closes an operation dialog when a bookmarked month navigation discards its draft', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/finance', FinanceOverviewPageComponent);
    const dialog = harness.routeNativeElement!.querySelector<HTMLDialogElement>(
      '.finance-transaction-dialog',
    )!;
    dialog.showModal = () => dialog.setAttribute('open', '');
    dialog.close = () => dialog.removeAttribute('open');
    page.openTransactionCreation('income');
    harness.detectChanges();
    const description = dialog.querySelector<HTMLTextAreaElement>('textarea')!;
    description.value = 'Draft';
    description.dispatchEvent(new Event('input', { bubbles: true }));
    harness.detectChanges();
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    page.navigateMonth(-1);
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/finance');
    expect(dialog.open).toBe(true);
    confirm.mockReturnValue(true);
    await harness.navigateByUrl('/finance?year=2025&month=12');
    harness.detectChanges();
    expect(dialog.open).toBe(false);
    expect(page.month()?.periodStart).toBe('2025-12-01');
    expect(harness.routeNativeElement!.querySelector('app-finance-transaction-entry')).toBeNull();
    confirm.mockRestore();
  });

  it('allows late previous-month operations but keeps original and older-month records locked', async () => {
    const late = {
      ...TRANSACTION,
      id: 'late',
      createdAt: '2026-01-01T00:00:00Z',
      occurredAt: '2025-12-31T12:00:00Z',
    };
    service.historicalTransactions.mockReturnValueOnce(of([TRANSACTION, late]));
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl(
      '/finance?year=2025&month=12',
      FinanceOverviewPageComponent,
    );
    const dialog = harness.routeNativeElement!.querySelector<HTMLDialogElement>(
      '.finance-transaction-dialog',
    )!;
    dialog.showModal = () => dialog.setAttribute('open', '');
    dialog.close = () => dialog.removeAttribute('open');
    harness
      .routeNativeElement!.querySelector<HTMLButtonElement>('#finance-tab-transactions')!
      .click();
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelectorAll('.finance-add-transaction')).toHaveLength(
      2,
    );
    expect(harness.routeNativeElement!.querySelectorAll('.finance-transaction-edit')).toHaveLength(
      1,
    );
    page.openTransactionEdit(TRANSACTION);
    expect(dialog.open).toBe(false);
    page.setTransactionDeleted(TRANSACTION, true);
    expect(service.deleteTransaction).not.toHaveBeenCalled();
    page.openTransactionCreation('expense');
    harness.detectChanges();
    expect(dialog.open).toBe(true);
    page.saveTransaction({
      categoryId: 'food',
      amount: '12',
      currency: 'USD',
      dateTime: '2025-12-31T12:00',
      description: 'Late',
    });
    expect(service.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ amount: '12', occurredAt: expect.stringContaining('2025-12-31') }),
      '2025-12-01',
    );
    await harness.navigateByUrl('/finance?year=2025&month=11');
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('.finance-add-transaction')).toBeNull();
    page.openTransactionCreation('income');
    expect(dialog.open).toBe(false);
  });

  it('preserves draft changes when discarding is rejected', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/finance', FinanceOverviewPageComponent);
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    page.openingDraft.set('99');
    page.navigateMonth(-1);
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/finance');
    expect(page.openingDraft()).toBe('99');
    expect(confirm).toHaveBeenCalledTimes(1);
    confirm.mockRestore();
  });
});
