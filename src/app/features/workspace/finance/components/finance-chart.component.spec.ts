import { OverlayContainer } from '@angular/cdk/overlay';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { FinanceChartComponent } from './finance-chart.component';

describe('FinanceChartComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [FinanceChartComponent],
      providers: [provideI18nTesting({ 'finance.notSet': 'Не задано' })],
    }),
  );

  function tooltipFixture(
    kind: 'vertical' | 'horizontal' | 'pie' = 'vertical',
  ): ComponentFixture<FinanceChartComponent> {
    const fixture = TestBed.createComponent(FinanceChartComponent);
    fixture.componentRef.setInput('title', 'Расходы');
    fixture.componentRef.setInput('currency', 'USD');
    fixture.componentRef.setInput('kind', kind);
    fixture.componentRef.setInput('data', [
      { id: 'first', label: 'Подписки на рабочие сервисы и облачное хранилище', amount: '75' },
      { id: 'second', label: 'Транспорт', amount: '25' },
    ]);
    fixture.detectChanges();
    return fixture;
  }

  function tooltip(): HTMLElement | null {
    return TestBed.inject(OverlayContainer).getContainerElement().querySelector('[role="tooltip"]');
  }

  it('shows the complete label and localized amount immediately on pointer entry', () => {
    const fixture = tooltipFixture();
    const marks = (fixture.nativeElement as HTMLElement).querySelectorAll('.finance-chart-mark');
    marks[0].dispatchEvent(new Event('pointerenter'));
    fixture.detectChanges();
    expect(tooltip()?.textContent).toContain('Подписки на рабочие сервисы и облачное хранилище');
    expect(tooltip()?.textContent).toContain('75,00');
    expect(tooltip()?.textContent).toContain('$');
    expect(marks[0].getAttribute('aria-describedby')).toBe(tooltip()?.id);
    marks[1].dispatchEvent(new Event('pointerenter'));
    fixture.detectChanges();
    expect(tooltip()?.textContent).toContain('Транспорт');
    expect(tooltip()?.textContent).toContain('25,00');
    expect(marks[0].getAttribute('aria-describedby')).toBeNull();
    fixture.componentRef.setInput('data', [
      { id: 'first', label: 'Подписки на рабочие сервисы и облачное хранилище', amount: '75' },
      { id: 'second', label: 'Транспорт', amount: '25' },
    ]);
    fixture.detectChanges();
    expect(tooltip()?.textContent).toContain('Транспорт');
    fixture.componentRef.setInput('data', [{ id: 'new', label: 'Новый месяц', amount: '20' }]);
    fixture.detectChanges();
    expect(tooltip()).toBeNull();
  });

  it('shows pie category percentages on keyboard focus and dismisses with Escape', () => {
    const fixture = tooltipFixture('pie');
    const mark = (fixture.nativeElement as HTMLElement).querySelector('.finance-chart-mark')!;
    expect(mark.getAttribute('tabindex')).toBe('0');
    mark.dispatchEvent(new FocusEvent('focus'));
    fixture.detectChanges();
    expect(tooltip()?.textContent).toMatch(/75\s*%/);
    expect(mark.getAttribute('aria-label')).toMatch(/75\s*%/);
    mark.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(tooltip()).toBeNull();
    expect(mark.getAttribute('aria-describedby')).toBeNull();
    mark.dispatchEvent(new FocusEvent('focus'));
    fixture.detectChanges();
    mark.dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();
    expect(tooltip()).toBeNull();
  });

  it('keeps a tooltip open while the pointer moves into it and hides after leaving', fakeAsync(() => {
    const fixture = tooltipFixture();
    const mark = (fixture.nativeElement as HTMLElement).querySelector('.finance-chart-mark')!;
    mark.dispatchEvent(new Event('pointerenter'));
    fixture.detectChanges();
    mark.dispatchEvent(new Event('pointerleave'));
    tick(100);
    tooltip()!.dispatchEvent(new Event('pointerenter'));
    tick(200);
    fixture.detectChanges();
    expect(tooltip()).not.toBeNull();
    tooltip()!.dispatchEvent(new Event('pointerleave'));
    tick(150);
    fixture.detectChanges();
    expect(tooltip()).toBeNull();
  }));

  it('shows horizontal bar labels and keeps unset and zero values distinct on focus', () => {
    const fixture = tooltipFixture('horizontal');
    fixture.componentRef.setInput('data', [
      { id: 'unset', label: 'Без плана', amount: null },
      { id: 'zero', label: 'Нулевой план', amount: '0' },
    ]);
    fixture.detectChanges();
    const marks = (fixture.nativeElement as HTMLElement).querySelectorAll('.finance-chart-mark');
    marks[0].dispatchEvent(new FocusEvent('focus'));
    fixture.detectChanges();
    expect(tooltip()?.textContent).toContain('Не задано');
    marks[0].dispatchEvent(new FocusEvent('blur'));
    marks[1].dispatchEvent(new FocusEvent('focus'));
    fixture.detectChanges();
    expect(tooltip()?.textContent).toContain('0,00');
    expect(tooltip()?.textContent).not.toContain('Не задано');
  });

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

  it('gives more than eight categories distinct fills shared by their sectors and legend', () => {
    const fixture = TestBed.createComponent(FinanceChartComponent);
    fixture.componentRef.setInput('title', 'Categories');
    fixture.componentRef.setInput('currency', 'AMD');
    fixture.componentRef.setInput('kind', 'pie');
    fixture.componentRef.setInput(
      'data',
      Array.from({ length: 12 }, (_, index) => ({
        id: String(index),
        label: `Category ${index}`,
        amount: '100',
      })),
    );
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const fills = Array.from(root.querySelectorAll('path'), (path) => path.getAttribute('fill'));
    expect(new Set(fills).size).toBe(12);
    expect(
      Array.from(root.querySelectorAll('.finance-swatch rect'), (rect) =>
        rect.getAttribute('fill'),
      ),
    ).toEqual(fills);
  });

  it('keeps sector colours and percentages aligned when zero and unset rows are interspersed', () => {
    const fixture = TestBed.createComponent(FinanceChartComponent);
    fixture.componentRef.setInput('title', 'Categories');
    fixture.componentRef.setInput('currency', 'AMD');
    fixture.componentRef.setInput('kind', 'pie');
    fixture.componentRef.setInput('data', [
      { id: 'none', label: 'Unset', amount: null },
      { id: 'salary', label: 'Salary', amount: '75' },
      { id: 'zero', label: 'Zero', amount: '0' },
      { id: 'subscriptions', label: 'Subscriptions', amount: '25' },
    ]);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const paths = root.querySelectorAll('path');
    const rows = root.querySelectorAll('tr');
    expect(paths).toHaveLength(2);
    expect(rows[0].querySelector('.finance-swatch')).toBeNull();
    expect(rows[2].querySelector('.finance-swatch')).toBeNull();
    for (const [sectorIndex, rowIndex] of [1, 3].entries()) {
      expect(rows[rowIndex].querySelector('rect')?.getAttribute('fill')).toBe(
        paths[sectorIndex].getAttribute('fill'),
      );
    }
    expect(rows[0].lastElementChild?.textContent?.trim()).toMatch(/^0\s*%$/);
    expect(rows[1].lastElementChild?.textContent?.trim()).toMatch(/^75\s*%$/);
    expect(rows[2].lastElementChild?.textContent?.trim()).toMatch(/^0\s*%$/);
    expect(rows[3].lastElementChild?.textContent?.trim()).toMatch(/^25\s*%$/);
  });
});
