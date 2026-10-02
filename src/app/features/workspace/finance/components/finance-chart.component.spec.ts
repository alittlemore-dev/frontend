import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { FinanceChartComponent } from './finance-chart.component';

describe('FinanceChartComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [FinanceChartComponent],
      providers: [provideI18nTesting({ 'finance.notSet': 'Не задано' })],
    }),
  );

  it('renders negative balances below a shared zero baseline and exposes their values', () => {
    const fixture = TestBed.createComponent(FinanceChartComponent);
    fixture.componentRef.setInput('title', 'Balance');
    fixture.componentRef.setInput('currency', 'USD');
    fixture.componentRef.setInput('scale', [-50, 100]);
    fixture.componentRef.setInput('data', [{ id: 'closing', label: 'Closing', amount: '-50' }]);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const rect = root.querySelector('rect')!;
    const line = root.querySelector('line')!;
    expect(Number(rect.getAttribute('height'))).toBeGreaterThan(0);
    expect(rect.getAttribute('y')).toBe(line.getAttribute('y1'));
    expect(root.querySelector('table')?.textContent).toContain('50');
  });

  it('draws a complete single-category pie with an accessible legend', () => {
    const fixture = TestBed.createComponent(FinanceChartComponent);
    fixture.componentRef.setInput('title', 'Categories');
    fixture.componentRef.setInput('currency', 'RUB');
    fixture.componentRef.setInput('kind', 'pie');
    fixture.componentRef.setInput('data', [{ id: 'salary', label: 'Salary', amount: '100' }]);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('path')).toHaveLength(1);
    expect(root.querySelector('table')?.textContent).toContain('100');
    expect(root.querySelector('svg')?.getAttribute('aria-label')).toContain('Categories');
  });

  it('keeps an unset plan distinct from a zero plan', () => {
    const fixture = TestBed.createComponent(FinanceChartComponent);
    fixture.componentRef.setInput('title', 'Plans');
    fixture.componentRef.setInput('currency', 'USD');
    fixture.componentRef.setInput('data', [
      { id: 'none', label: 'Unset', amount: null },
      { id: 'zero', label: 'Zero', amount: '0' },
    ]);
    fixture.detectChanges();
    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('tr');
    expect(rows[0].textContent).toContain('Не задано');
    expect(rows[1].textContent).toContain('0');
  });
});
