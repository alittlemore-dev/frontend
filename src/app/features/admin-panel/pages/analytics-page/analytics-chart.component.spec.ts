import { TestBed } from '@angular/core/testing';
import { AnalyticsChartComponent } from './analytics-chart.component';

describe('AnalyticsChartComponent', () => {
  it('exposes metric, dates and exact values in an accessible chart', () => {
    const fixture = TestBed.createComponent(AnalyticsChartComponent);
    fixture.componentRef.setInput('label', 'Views');
    fixture.componentRef.setInput('points', [
      { date: '2026-01-01', value: 0 },
      { date: '2026-01-02', value: 7 },
    ]);
    fixture.detectChanges();
    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg.getAttribute('aria-label')).toBe('Views');
    expect(
      [...fixture.nativeElement.querySelectorAll('circle title')].map(
        (node) => (node as Element).textContent,
      ),
    ).toEqual([
      expect.stringMatching(/^1 января 2026\s+г\.: 0$/),
      expect.stringMatching(/^2 января 2026\s+г\.: 7$/),
    ]);
    expect(fixture.nativeElement.textContent).toContain('1 янв.');
    fixture.componentRef.setInput('dateLocale', 'en-US');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('circle title').textContent).toBe(
      'January 1, 2026: 0',
    );
    expect(fixture.nativeElement.textContent).toContain('Jan 1');
  });
  it('renders a finite chart for an empty or zero-valued period', () => {
    const fixture = TestBed.createComponent(AnalyticsChartComponent);
    fixture.componentRef.setInput('label', 'Views');
    fixture.componentRef.setInput('points', [{ date: '2026-01-01', value: 0 }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('polyline').getAttribute('points')).not.toContain(
      'NaN',
    );
    fixture.componentRef.setInput('points', []);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('circle')).toHaveLength(0);
  });
  it('shows an exact point tooltip on hover and keyboard focus, including grouped date bounds', () => {
    const fixture = TestBed.createComponent(AnalyticsChartComponent);
    fixture.componentRef.setInput('label', 'Views');
    fixture.componentRef.setInput('points', [{ date: '2024-02-01', value: 17 }]);
    fixture.componentRef.setInput('bucket', 'month');
    fixture.componentRef.setInput('dateFrom', '2024-02-10');
    fixture.componentRef.setInput('dateTo', '2024-02-29');
    fixture.detectChanges();
    const point = fixture.nativeElement.querySelector('g[tabindex]');
    point.dispatchEvent(new Event('pointerenter'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="tooltip"]').textContent).toMatch(
      /10\s*–\s*29 февраля 2024\s+г\./,
    );
    expect(fixture.nativeElement.querySelector('[role="tooltip"]').textContent).toContain('17');
    fixture.nativeElement.querySelector('svg').dispatchEvent(new Event('pointerleave'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="tooltip"]')).toBeNull();
    point.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="tooltip"]')).not.toBeNull();
  });
  it('labels grouped axes with the actual period bounds and distinguishes years', () => {
    const fixture = TestBed.createComponent(AnalyticsChartComponent);
    fixture.componentRef.setInput('label', 'Views');
    fixture.componentRef.setInput('points', [
      { date: '2025-12-29', value: 4 },
      { date: '2026-01-05', value: 9 },
    ]);
    fixture.componentRef.setInput('bucket', 'week');
    fixture.componentRef.setInput('dateFrom', '2025-12-31');
    fixture.componentRef.setInput('dateTo', '2026-01-08');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toMatch(/31 дек\. 2025\s+г\./);
    expect(fixture.nativeElement.textContent).toMatch(/8 янв\. 2026\s+г\./);
    fixture.componentRef.setInput('points', [{ date: '2025-12-29', value: 4 }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toMatch(/4 янв\. 2026\s+г\./);
  });
});
