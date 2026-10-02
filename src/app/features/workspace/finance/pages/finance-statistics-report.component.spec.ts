import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { FINANCE_TEST_STATISTICS as STATISTICS } from '../testing/finance-fixtures';
import { FinanceStatisticsReportComponent } from './finance-statistics-report.component';

describe('FinanceStatisticsReportComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [FinanceStatisticsReportComponent],
      providers: [provideI18nTesting({ 'finance.category.none': 'Без категории' })],
    }),
  );

  it('shows all budget charts and tables with the projected currency and saved-rate date', () => {
    const fixture = TestBed.createComponent(FinanceStatisticsReportComponent);
    fixture.componentRef.setInput('statistics', {
      ...STATISTICS,
      currency: 'AMD',
      monthly: { ...STATISTICS.monthly, currency: 'AMD' },
    });
    fixture.componentRef.setInput('tab', 'summary');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('app-finance-budget-column')).toHaveLength(2);
    expect(root.querySelectorAll('app-finance-chart')).toHaveLength(10);
    expect(root.querySelector('input')).toBeNull();
    expect(root.textContent).toContain('֏');
    expect(root.textContent).not.toContain('USD');
    expect(root.textContent).toContain('finance.statistics.budgetRate');
    expect(root.textContent).toContain('2026');
  });

  it('uses the exact uncategorized amount supplied by the API in the budget', () => {
    const fixture = TestBed.createComponent(FinanceStatisticsReportComponent);
    fixture.componentRef.setInput('statistics', { ...STATISTICS, uncategorizedIncome: '5.25' });
    fixture.componentRef.setInput('tab', 'summary');
    fixture.detectChanges();
    const rows = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('app-finance-budget-column tr'),
    );
    const uncategorized = rows.find((row) => row.textContent?.includes('Без категории'));
    expect(uncategorized?.textContent).toContain('5,25');
    expect(uncategorized?.querySelector('button')).toBeNull();
  });
});
