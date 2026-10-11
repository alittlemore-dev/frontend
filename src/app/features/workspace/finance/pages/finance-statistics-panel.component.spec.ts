import { AccountSettingsService } from '../../../../core/auth/account-settings.service';
import { Component, signal } from '@angular/core';
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
import { FinanceStatisticsPanelComponent } from './finance-statistics-panel.component';

@Component({
  standalone: true,
  imports: [FinanceStatisticsPanelComponent],
  template: '<app-finance-statistics-panel selectedMonth="2026-09-01" [timeZone]="timeZone()" />',
})
class StatisticsHostComponent {
  readonly timeZone = TestBed.inject(AccountSettingsService).timeZone;
}

describe('FinanceStatisticsPanelComponent', () => {
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
        provideRouter([{ path: 'finance/statistics', component: StatisticsHostComponent }]),
        provideI18nTesting(),
        { provide: FinanceService, useValue: service },
        { provide: AccountSettingsService, useValue: { timeZone } },
      ],
    });
  });

  it('restores filters from a direct URL and shows the month budget in the selected currency', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/finance/statistics?period=thisMonth&currency=USD');
    expect(service.statistics).toHaveBeenCalledWith('thisMonth', 'USD', '2026-09-01');
    const root = harness.routeNativeElement!;
    expect(root.querySelectorAll('[role="tab"]')).toHaveLength(0);
    expect(root.querySelectorAll('app-finance-budget-column')).toHaveLength(2);
    expect(root.querySelector('input')).toBeNull();
    expect(root.querySelectorAll('app-finance-chart')).toHaveLength(10);
    expect(root.querySelector('app-finance-budget-column')?.textContent).toContain('$');
  });

  it('reloads analytics boundaries when the account zone changes', async () => {
    service.statistics.mockReturnValue(
      of({ currency: 'USD', reports: [{ ...STATISTICS, period: 'last7Days', monthly: null }] }),
    );
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/finance/statistics?period=last7Days&currency=EUR');
    timeZone.set('Asia/Yerevan');
    harness.detectChanges();
    expect(service.ensure).not.toHaveBeenCalled();
    expect(service.statistics).toHaveBeenCalledTimes(2);
    expect(service.statistics).toHaveBeenLastCalledWith('last7Days', 'EUR', undefined);
    expect(harness.routeNativeElement!.textContent).toContain('Asia/Yerevan');
  });

  it('labels historical monthly dates in the snapshot time zone', async () => {
    timeZone.set('Europe/Berlin');
    service.statistics.mockReturnValue(
      of({
        currency: 'USD',
        reports: [{ ...STATISTICS, monthly: { ...MONTH, timezoneName: 'Asia/Yerevan' } }],
      }),
    );
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/finance/statistics');
    expect(harness.routeNativeElement!.textContent).toContain('Asia/Yerevan');
    expect(harness.routeNativeElement!.textContent).not.toContain('Europe/Berlin');
  });

  it('does not show plans or balances for a rolling period', async () => {
    service.statistics.mockReturnValue(
      of({ currency: 'USD', reports: [{ ...STATISTICS, period: 'last7Days', monthly: null }] }),
    );
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/finance/statistics?period=last7Days&currency=EUR');
    expect(service.statistics).toHaveBeenCalledWith('last7Days', 'EUR', undefined);
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
    await harness.navigateByUrl('/finance/statistics?period=thisYear&currency=month');
    expect(service.statistics).toHaveBeenCalledWith('thisYear', 'month', undefined);
    expect(
      harness.routeNativeElement!.querySelectorAll('app-finance-statistics-report'),
    ).toHaveLength(2);
    const page = harness.routeDebugElement!.children[0]
      .componentInstance as FinanceStatisticsPanelComponent;
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
