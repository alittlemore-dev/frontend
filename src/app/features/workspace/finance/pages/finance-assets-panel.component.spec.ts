import { By } from '@angular/platform-browser';
import { chooseSiteSelectOption } from '@alittlemore.dev/design-system/testing';
import { Component, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { filter, firstValueFrom } from 'rxjs';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { AssetReport, AssetValuation } from '../models/finance-assets.model';
import { FinanceMonth } from '../models/finance.model';
import { FINANCE_TEST_MONTH } from '../testing/finance-fixtures';
import { FinanceAssetsPanelComponent } from './finance-assets-panel.component';

@Component({
  imports: [FinanceAssetsPanelComponent],
  template:
    '<app-finance-assets-panel selectedMonth="2026-03-01" timeZone="America/Los_Angeles" [month]="month()" fallbackCurrency="AMD" />',
})
class StatisticsHost {
  readonly month = signal<FinanceMonth | null>({
    ...FINANCE_TEST_MONTH,
    periodStart: '2026-03-01',
    currency: 'EUR',
  });
}
const positions: AssetValuation = {
  asOf: '2026-03-31',
  currency: 'RUB',
  knownValue: '6500',
  complete: true,
  positions: [],
};
const report: AssetReport = {
  start: '2026-03-01',
  end: '2026-03-31',
  trackingStart: '2026-03-01',
  coverageStart: '2026-03-01',
  coverageEnd: '2026-03-31',
  currency: 'RUB',
  opening: { ...positions, knownValue: '0' },
  closing: positions,
  deposits: '10000',
  withdrawals: '4000',
  netSavings: '6000',
  income: '100000',
  targetAmount: '10000',
  actualPercent: '6',
  remaining: '4000',
  achievedMonths: 0,
  eligibleMonths: 1,
  payouts: '0',
  fees: '0',
  initialAssets: '0',
  reconciliation: '0',
  revaluation: '500',
  byKind: { stock: '6500' },
  byLocation: { home: '6500' },
  byCurrency: { RUB: '6500' },
  nonInterestValue: '0',
  nonInterestPercent: '0',
  months: [
    {
      month: '2026-03-01',
      income: '100000',
      netSavings: '6000',
      targetPercent: '10',
      targetAmount: '10000',
      actualPercent: '6',
      remaining: '4000',
      full: true,
      achieved: false,
    },
  ],
  history: [{ onDate: '2026-03-31', knownValue: '6500', complete: true }],
  forecast: {
    startValue: '6500',
    observationMonths: [],
    availableOn: '2026-04-01',
    monthlyActual: null,
    monthlyTarget: null,
    points: [],
  },
};

describe('Asset statistics', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  const base = '/api/personal-workspace/finance/assets';
  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'finance', component: StatisticsHost }]),
        provideI18nTesting(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });
  afterEach(() => http.verify());
  async function reportRequest(query: string) {
    await harness.navigateByUrl('/finance?tab=assets' + query);
    const locations = http.expectOne((r) => r.url.endsWith(base + '/locations'));
    locations.flush({ items: [{ id: 'home', name: 'Home' }] });
    return http.expectOne((r) => r.url.endsWith(base + '/report'));
  }
  it('uses the monthly currency and displays valuations in the selected language without shifting plain dates', async () => {
    const request = await reportRequest('');
    expect(request.request.params.get('currency')).toBe('EUR');
    expect(request.request.params.get('start')).toBe('2026-03-01');
    expect(request.request.params.get('end')).toBe('2026-03-31');
    request.flush({
      ...report,
      currency: 'EUR',
      forecast: {
        ...report.forecast,
        observationMonths: ['2026-02-01'],
        monthlyActual: '6000',
        monthlyTarget: '10000',
        points: [{ month: '2026-04-01', actual: '12500', target: '16500' }],
      },
    });
    harness.detectChanges();
    const view = harness.routeNativeElement!;
    expect(view.textContent).toContain('31 мар.');
    expect(view.textContent).toContain('февраль');
    expect(view.textContent).toContain('апрель');
    expect(view.textContent).not.toMatch(/2026-\d{2}/);
    TestBed.inject(I18nService).switchLanguage('en').subscribe();
    harness.detectChanges();
    expect(view.textContent).toContain('Mar 31, 2026');
    expect(view.textContent).toContain('February 2026');
    expect(view.textContent).toContain('April 2026');
    expect(view.querySelector('app-finance-statistics-filters')).not.toBeNull();
    expect(view.querySelectorAll('app-finance-chart')).toHaveLength(4);
  });
  it('opens the effective rule for the chosen month and protects a scheduled change until saved', async () => {
    (await reportRequest('')).flush(report);
    harness.detectChanges();
    const view = harness.routeNativeElement!;
    const goalControl = () => view.querySelector<HTMLInputElement>('#asset-goal-percent')!;
    const panel = harness.routeDebugElement!.query(By.directive(FinanceAssetsPanelComponent))
      .componentInstance as FinanceAssetsPanelComponent;
    view.querySelector<HTMLButtonElement>('app-asset-goal-settings button')!.click();
    harness.detectChanges();
    const goals = (month: string) =>
      http.expectOne((r) => r.url.endsWith(base + '/goals') && r.params.get('month') === month);
    goals('2026-03').flush({ goal: null });
    harness.detectChanges();
    chooseSiteSelectOption(harness.fixture, '#asset-goal-month', '09');
    goals('2026-09').flush({
      goal: { month: '2026-09-01', percent: '16', allIncome: true, categoryIds: [] },
    });
    harness.detectChanges();
    expect(goalControl().value).toBe('16');
    goalControl().value = '18';
    goalControl().dispatchEvent(new Event('input'));
    harness.detectChanges();
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    try {
      expect(panel.leave()).toBe(false);
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(goalControl().value).toBe('18');
      view.querySelector<HTMLButtonElement>('app-asset-goal-settings button[type=submit]')!.click();
      const write = http.expectOne(
        (r) => r.method === 'PUT' && r.url.endsWith(base + '/goals/2026-09'),
      );
      expect(write.request.body).toEqual({ percent: '18', allIncome: true, categoryIds: [] });
      expect(panel.leave()).toBe(false);
      write.flush({});
      http.expectOne((r) => r.url.endsWith(base + '/locations')).flush({ items: [] });
      http.expectOne((r) => r.url.endsWith(base + '/report')).flush(report);
      harness.detectChanges();
      expect(panel.leave()).toBe(true);
    } finally {
      confirm.mockRestore();
    }
  });

  it('uses the tracker currency to report assets from a month with no budget', async () => {
    const first = await reportRequest('');
    first.flush(report);
    const host = harness.routeDebugElement!.componentInstance as StatisticsHost;
    host.month.set(null);
    harness.detectChanges();
    http.expectOne((r) => r.url.endsWith(base + '/locations')).flush({ items: [] });
    const reloaded = http.expectOne((r) => r.url.endsWith(base + '/report'));
    expect(reloaded.request.params.get('currency')).toBe('AMD');
    expect(reloaded.request.params.get('start')).toBe('2026-03-01');
    reloaded.flush({ ...report, currency: 'AMD' });
  });

  it('opens transactions for a historical month using the keyboard and keeps the report filters', async () => {
    const request = await reportRequest(
      '&assetPeriod=range&start=2026-01-15&end=2026-03-31&currency=USD',
    );
    expect(request.request.params.get('start')).toBe('2026-01-15');
    expect(request.request.params.get('currency')).toBe('USD');
    request.flush({
      ...report,
      start: '2026-01-15',
      months: [{ ...report.months[0], month: '2026-02-01' }, ...report.months],
    });
    harness.detectChanges();
    const router = TestBed.inject(Router);
    const finished = firstValueFrom(router.events.pipe(filter((e) => e instanceof NavigationEnd)));
    const monthMark = harness.routeNativeElement!.querySelector(
      'app-finance-chart [role=button][aria-label*="февраль"]',
    )!;
    monthMark.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await finished;
    const query = router.parseUrl(router.url).queryParams;
    expect(query).toMatchObject({
      tab: 'transactions',
      year: '2026',
      month: '2',
      assetJournal: '2026-02',
      assetReportMonth: '2026-03',
      assetPeriod: 'range',
      start: '2026-01-15',
      end: '2026-03-31',
      currency: 'USD',
    });
  });
  it('distinguishes a portfolio with no history and a partial valuation without a forecast', async () => {
    const empty = await reportRequest('');
    empty.flush({
      ...report,
      history: [],
      months: [],
      closing: { ...positions, knownValue: '0', positions: [] },
    });
    harness.detectChanges();
    const view = harness.routeNativeElement!;
    expect(view.textContent).toContain('finance.assets.noStatistics');
    expect(view.querySelector('app-finance-chart')).toBeNull();
    const partial = await reportRequest('&currency=USD');
    partial.flush({
      ...report,
      closing: { ...positions, complete: false },
      history: [{ onDate: '2026-03-15', complete: false, knownValue: '0' }],
    });
    harness.detectChanges();
    expect(view.textContent).toContain('finance.assets.partialExplanation');
    expect(view.textContent).toContain('finance.assets.emptyForecast');
    expect(view.textContent).toContain('1 апр.');
    expect(view.textContent).not.toContain('2026-04-01');
  });
});
