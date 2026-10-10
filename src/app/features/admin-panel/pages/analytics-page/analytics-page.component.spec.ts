import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { AnalyticsPageComponent } from './analytics-page.component';
import { AnalyticsDaily, AnalyticsReport } from './analytics.model';
import { AnalyticsService } from './analytics.service';

const rows: AnalyticsDaily[] = [
  {
    date: '2026-01-10',
    targetId: 'a',
    title: 'Article A',
    groupId: 'folder',
    groupTitle: 'Folder',
    sectionId: '',
    sectionTitle: '',
    source: 'Search',
    views: 10,
    engaged: 3,
    reactions: 0,
    suggestions: 0,
    visitors: 0,
  },
  {
    date: '2026-01-11',
    targetId: 'b',
    title: 'Article B',
    groupId: 'folder',
    groupTitle: 'Folder',
    sectionId: '',
    sectionTitle: '',
    source: 'Direct',
    views: 4,
    engaged: 1,
    reactions: 0,
    suggestions: 0,
    visitors: 0,
  },
];

describe('AnalyticsPageComponent', () => {
  let query: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let report: jest.Mock;
  beforeEach(async () => {
    query = new BehaviorSubject(
      convertToParamMap({
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
        kind: 'Articles',
        bucket: 'month',
      }),
    );
    report = jest.fn((kind: string, from: string, to: string) =>
      of({
        kind,
        dateFrom: from,
        dateTo: to,
        currentReactions: {},
        daily: from === '2026-01-01' ? rows : [],
      }),
    );
    await TestBed.configureTestingModule({
      imports: [AnalyticsPageComponent],
      providers: [
        provideRouter([]),
        provideI18nTesting(),
        { provide: ActivatedRoute, useValue: { queryParamMap: query, snapshot: { data: {} } } },
        { provide: AnalyticsService, useValue: { report } },
      ],
    }).compileComponents();
  });
  it('restores the URL range, compares an equal previous period and renders zero-filled chart data', () => {
    const fixture = TestBed.createComponent(AnalyticsPageComponent);
    fixture.componentRef.setInput('scope', 'Articles');
    fixture.detectChanges();
    expect(report).toHaveBeenCalledWith('Articles', '2026-01-01', '2026-01-31', 'ru');
    expect(report).toHaveBeenCalledWith('Articles', '2025-12-01', '2025-12-31', 'ru');
    expect(fixture.nativeElement.textContent).toContain('Article A');
    expect(fixture.componentInstance.points()).toEqual([{ date: '2026-01-01', value: 14 }]);
    expect(fixture.componentInstance.totals().views).toBe(14);
    expect(fixture.nativeElement.textContent).toContain('1–31 января 2026 г.');
    expect(fixture.nativeElement.querySelector('.analytics-data-row').textContent).toContain(
      '1–31 января 2026 г.',
    );
  });
  it('applies the same source and content filters to chart data, totals and ranking', () => {
    query.next(
      convertToParamMap({
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
        source: 'Search',
        targetId: 'a',
      }),
    );
    const fixture = TestBed.createComponent(AnalyticsPageComponent);
    fixture.componentRef.setInput('scope', 'Articles');
    fixture.detectChanges();
    expect(fixture.componentInstance.totals().views).toBe(10);
    expect(fixture.componentInstance.points().reduce((sum, point) => sum + point.value, 0)).toBe(
      10,
    );
    expect(fixture.nativeElement.textContent).toContain('Article A');
    expect(fixture.nativeElement.querySelector('ul[aria-label]')?.textContent).not.toContain(
      'Article B',
    );
  });
  it('shows invalid ranges without issuing requests', () => {
    query.next(convertToParamMap({ dateFrom: '2026-02-01', dateTo: '2026-01-01' }));
    const fixture = TestBed.createComponent(AnalyticsPageComponent);
    fixture.componentRef.setInput('scope', 'Articles');
    fixture.detectChanges();
    expect(report).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
  });
  it('cancels stale reports when the range changes', () => {
    const old = new Subject<AnalyticsReport>();
    report.mockReturnValue(old);
    const fixture = TestBed.createComponent(AnalyticsPageComponent);
    fixture.componentRef.setInput('scope', 'Articles');
    fixture.detectChanges();
    report.mockImplementation((kind: string, from: string, to: string) =>
      of({ kind, dateFrom: from, dateTo: to, currentReactions: {}, daily: [] }),
    );
    query.next(convertToParamMap({ dateFrom: '2026-02-01', dateTo: '2026-02-28' }));
    old.next({
      kind: 'Articles',
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      currentReactions: {},
      daily: rows,
    });
    fixture.componentRef.setInput('scope', 'Articles');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Article A');
    expect(fixture.componentInstance.report()?.dateFrom).toBe('2026-02-01');
  });
  it('keeps the article domain fixed even when a URL asks for another report', () => {
    query.next(convertToParamMap({ kind: 'Site', dateFrom: '2026-01-01', dateTo: '2026-01-31' }));
    const fixture = TestBed.createComponent(AnalyticsPageComponent);
    fixture.componentRef.setInput('scope', 'Articles');
    fixture.detectChanges();
    expect(report).toHaveBeenCalledWith('Articles', '2026-01-01', '2026-01-31', 'ru');
    expect(fixture.nativeElement.querySelector('#analyticsKind')).toBeNull();
  });
  it('sorts and changes chart grouping without navigation, refetching or removing the report', () => {
    const fixture = TestBed.createComponent(AnalyticsPageComponent);
    fixture.componentRef.setInput('scope', 'Articles');
    fixture.detectChanges();
    const navigate = jest.spyOn(TestBed.inject(Router), 'navigate');
    const reportNode = fixture.nativeElement.querySelector('app-analytics-chart');
    report.mockClear();
    fixture.componentInstance.selectSort('engaged');
    fixture.componentInstance.selectBucket('day');
    fixture.componentInstance.selectMetric('reactions');
    fixture.detectChanges();
    expect(navigate).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('app-analytics-chart')).toBe(reportNode);
  });
  it('loads submissions with matrix questions and filters submissions only by sheet', () => {
    const suggestion = {
      ...rows[0],
      targetId: 'sheet-key',
      groupId: 'folder',
      suggestions: 5,
      views: 0,
      engaged: 0,
    };
    report.mockImplementation((kind: string, from: string, to: string) =>
      of({
        kind,
        dateFrom: from,
        dateTo: to,
        currentReactions: {},
        daily: from === '2026-01-01' ? (kind === 'Suggestions' ? [suggestion] : rows) : [],
      }),
    );
    const fixture = TestBed.createComponent(AnalyticsPageComponent);
    fixture.componentRef.setInput('scope', 'Matrix');
    fixture.detectChanges();
    expect(report).toHaveBeenCalledWith('Suggestions', '2026-01-01', '2026-01-31', 'ru');
    fixture.componentInstance.selectSource('Direct');
    fixture.componentInstance.selectTarget('b');
    fixture.detectChanges();
    expect(fixture.componentInstance.totals().views).toBe(4);
    expect(fixture.componentInstance.suggestionTotal()).toBe(5);
    expect(fixture.nativeElement.querySelector('#analyticsSuggestionsHeading')).not.toBeNull();
    fixture.componentInstance.selectGroup('other');
    expect(fixture.componentInstance.suggestionTotal()).toBe(0);
  });
  it('preserves current filters and chart choices when changing the interface language', () => {
    const fixture = TestBed.createComponent(AnalyticsPageComponent);
    fixture.componentRef.setInput('scope', 'Articles');
    fixture.detectChanges();
    fixture.componentInstance.selectSource('Direct');
    fixture.componentInstance.selectSort('engaged');
    fixture.componentInstance.selectBucket('week');
    TestBed.inject(I18nService).language.set('en');
    fixture.detectChanges();
    expect(report).toHaveBeenCalledWith('Articles', '2026-01-01', '2026-01-31', 'en');
    expect(fixture.componentInstance.source()).toBe('Direct');
    expect(fixture.componentInstance.sort()).toBe('engaged');
    expect(fixture.componentInstance.bucket()).toBe('week');
    expect(fixture.nativeElement.textContent).toMatch(/January 1\s*–\s*31, 2026/);
    expect(fixture.nativeElement.querySelector('.analytics-data-row').textContent).toMatch(
      /January 1\s*–\s*4, 2026/,
    );
  });
  it('ignores hidden content filters in the generic site report', () => {
    query.next(
      convertToParamMap({
        stats_dateFrom: '2026-01-01',
        stats_dateTo: '2026-01-31',
        stats_targetId: 'a',
        stats_groupId: 'other',
        stats_sectionId: 'section',
        stats_search: 'missing',
      }),
    );
    const fixture = TestBed.createComponent(AnalyticsPageComponent);
    fixture.componentRef.setInput('scope', 'Site');
    fixture.detectChanges();
    expect(fixture.componentInstance.totals().views).toBe(14);
    expect(fixture.nativeElement.querySelector('#analyticsGroupid')).toBeNull();
    expect(fixture.nativeElement.querySelector('#analyticsTargetid')).toBeNull();
  });
});
