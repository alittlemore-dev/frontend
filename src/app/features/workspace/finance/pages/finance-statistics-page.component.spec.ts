import { AccountSettingsService } from '../../../../core/auth/account-settings.service';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, Subject } from 'rxjs';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { FinanceStatisticsResult } from '../models/finance.model';
import { FinanceService } from '../services/finance.service';
import {
  FINANCE_TEST_MONTH as MONTH,
  FINANCE_TEST_STATISTICS as STATISTICS,
} from '../testing/finance-fixtures';
import { FinanceStatisticsPageComponent } from './finance-statistics-page.component';

describe('FinanceStatisticsPageComponent', () => {
  const timeZone = signal('UTC');
  const service = {
    ensure: jest.fn(() => of(MONTH)),
    statistics: jest.fn(() => of({ currency: 'USD' as const, reports: [STATISTICS] })),
  };
  beforeEach(() => {
    timeZone.set('UTC');
    service.statistics.mockReturnValue(of({ currency: 'USD' as const, reports: [STATISTICS] }));
    jest.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'finance/statistics', component: FinanceStatisticsPageComponent }]),
        provideI18nTesting(),
        { provide: FinanceService, useValue: service },
        { provide: AccountSettingsService, useValue: { timeZone } },
      ],
    });
  });

  it('restores filters from a direct URL and shows the month budget in the selected currency', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/finance/statistics?period=thisMonth&currency=USD');
    expect(service.statistics).toHaveBeenCalledWith('thisMonth', 'USD');
    const root = harness.routeNativeElement!;
    expect(root.querySelectorAll('[role="tab"]')).toHaveLength(3);
    expect(root.querySelectorAll('app-finance-budget-column')).toHaveLength(2);
    expect(root.querySelector('input')).toBeNull();
    expect(root.querySelectorAll('app-finance-chart')).toHaveLength(10);
    expect(root.querySelector('app-finance-budget-column')?.textContent).toContain('$');
  });

  it('reloads analytics boundaries when the account zone changes', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/finance/statistics?period=last7Days&currency=EUR');
    timeZone.set('Asia/Yerevan');
    harness.detectChanges();
    expect(service.ensure).toHaveBeenCalledTimes(2);
    expect(service.statistics).toHaveBeenCalledTimes(2);
    expect(service.statistics).toHaveBeenLastCalledWith('last7Days', 'EUR');
    expect(harness.routeNativeElement!.textContent).toContain('Asia/Yerevan');
  });

  it('does not show plans or balances for a rolling period', async () => {
    service.statistics.mockReturnValue(
      of({ currency: 'USD', reports: [{ ...STATISTICS, period: 'last7Days', monthly: null }] }),
    );
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/finance/statistics?period=last7Days&currency=EUR');
    expect(service.statistics).toHaveBeenCalledWith('last7Days', 'EUR');
    expect(harness.routeNativeElement!.querySelector('app-finance-budget-column')).toBeNull();
  });

  it('keeps native month currencies separate and uses symbols in the selector', async () => {
    service.statistics.mockReturnValue(
      of({
        currency: 'month',
        reports: [
          { ...STATISTICS, currency: 'USD', monthly: null },
          { ...STATISTICS, currency: 'AMD', monthly: null, net: '500' },
        ],
      }),
    );
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/finance/statistics?currency=month');
    expect(service.statistics).toHaveBeenCalledWith('thisMonth', 'month');
    expect(
      harness.routeNativeElement!.querySelectorAll('app-finance-statistics-report'),
    ).toHaveLength(2);
    const page = harness.routeDebugElement!.componentInstance as FinanceStatisticsPageComponent;
    expect(page.currencyOptions().map((row) => row.label)).toEqual([
      'finance.statistics.currency.month',
      '֏',
      '₽',
      '$',
      '€',
    ]);
    expect(harness.routeNativeElement!.textContent).toContain('֏');
    expect(harness.routeNativeElement!.textContent).toContain('$');
  });

  it('shows loading, failure and retry feedback', async () => {
    const pending = new Subject<FinanceStatisticsResult>();
    service.statistics.mockReturnValue(pending);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/finance/statistics');
    expect(harness.routeNativeElement!.querySelector('[role="status"]')).not.toBeNull();
    pending.error({ status: 503 });
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('[role="alert"]')?.textContent).toContain(
      'finance.error.rate',
    );
    service.statistics.mockReturnValue(of({ currency: 'USD' as const, reports: [STATISTICS] }));
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('[role="alert"]')).toBeNull();
  });

  it('cancels obsolete requests when URL filters change', async () => {
    const old = new Subject<FinanceStatisticsResult>();
    service.statistics.mockReturnValueOnce(old);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/finance/statistics?currency=USD');
    await harness.navigateByUrl('/finance/statistics?currency=EUR');
    old.next({ currency: 'USD', reports: [{ ...STATISTICS, net: '999' }] });
    harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).not.toContain('999');
  });
});
