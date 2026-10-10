import { AnalyticsDaily } from './analytics.model';
import {
  analyticsPoints,
  analyticsDateFormatter,
  analyticsPointRange,
  formatAnalyticsRange,
  analyticsTotals,
  periodRange,
  shiftPeriodRange,
  validRange,
} from './analytics-time';

function row(date: string, views: number): AnalyticsDaily {
  return {
    date,
    views,
    targetId: 'a',
    title: 'A',
    groupId: '',
    groupTitle: '',
    sectionId: '',
    sectionTitle: '',
    source: 'Direct',
    engaged: 1,
    reactions: 2,
    suggestions: 0,
    visitors: 0,
  };
}

describe('analytics periods and aggregation', () => {
  it('formats UTC dates and ranges in the selected language, including a year boundary', () => {
    const russian = analyticsDateFormatter('ru-RU');
    expect(formatAnalyticsRange('2026-10-08', '2026-10-08', russian)).toBe('8 октября 2026 г.');
    expect(formatAnalyticsRange('2026-10-01', '2026-10-11', russian)).toBe('1–11 октября 2026 г.');
    const english = analyticsDateFormatter('en-US');
    expect(formatAnalyticsRange('2026-10-08', '2026-10-08', english)).toBe('October 8, 2026');
    const acrossYears = formatAnalyticsRange('2025-12-31', '2026-01-01', english);
    expect(acrossYears).toContain('December 31, 2025');
    expect(acrossYears).toContain('January 1, 2026');
    expect(russian.resolvedOptions().timeZone).toBe('UTC');
  });
  it('shows only the covered days of incomplete weeks and months', () => {
    expect(analyticsPointRange('2024-02-01', 'month', '2024-02-10', '2024-02-29')).toEqual({
      from: '2024-02-10',
      to: '2024-02-29',
    });
    expect(analyticsPointRange('2025-12-29', 'week', '2025-12-31', '2026-01-08')).toEqual({
      from: '2025-12-31',
      to: '2026-01-04',
    });
  });
  it('handles leap years, the previous month and inclusive rolling windows', () => {
    expect(periodRange('previousMonth', '2024-03-10')).toEqual({
      from: '2024-02-01',
      to: '2024-02-29',
    });
    expect(periodRange('last7Days', '2026-01-02')).toEqual({
      from: '2025-12-27',
      to: '2026-01-02',
    });
    expect(periodRange('thisWeek', '2026-01-04')).toEqual({ from: '2025-12-29', to: '2026-01-04' });
  });
  it('fills empty days and aggregates calendar months and Monday-based weeks', () => {
    const rows = [row('2026-01-31', 3), row('2026-02-01', 4)];
    expect(analyticsPoints(rows, '2026-01-30', '2026-02-01', 'day', 'views')).toEqual([
      { date: '2026-01-30', value: 0 },
      { date: '2026-01-31', value: 3 },
      { date: '2026-02-01', value: 4 },
    ]);
    expect(analyticsPoints(rows, '2026-01-30', '2026-02-01', 'month', 'views')).toEqual([
      { date: '2026-01-01', value: 3 },
      { date: '2026-02-01', value: 4 },
    ]);
    expect(analyticsPoints(rows, '2026-01-30', '2026-02-01', 'week', 'views')).toEqual([
      { date: '2026-01-26', value: 7 },
    ]);
    expect(analyticsTotals(rows)).toMatchObject({ views: 7, engaged: 2, reactions: 4 });
  });
  it('rejects impossible, reversed, future and overly broad dates', () => {
    expect(validRange('2026-02-30', '2026-03-01', '2026-10-10')).toBe(false);
    expect(validRange('2026-03-01', '2026-02-01', '2026-10-10')).toBe(false);
    expect(validRange('2026-01-01', '2027-01-01', '2026-10-10')).toBe(false);
    expect(validRange('2020-01-01', '2026-01-01', '2026-10-10')).toBe(false);
    expect(validRange('2026-01-01', '2026-10-10', '2026-10-10')).toBe(true);
  });
  it('navigates calendar years, months, weeks and custom windows with future bounds', () => {
    expect(shiftPeriodRange('thisYear', '2026-01-01', '2026-10-10', -1, '2026-10-10')).toEqual({
      from: '2025-01-01',
      to: '2025-12-31',
    });
    expect(shiftPeriodRange('thisMonth', '2024-03-01', '2024-03-10', -1, '2024-03-10')).toEqual({
      from: '2024-02-01',
      to: '2024-02-29',
    });
    expect(shiftPeriodRange('thisMonth', '2024-02-01', '2024-02-29', 1, '2024-03-10')).toEqual({
      from: '2024-03-01',
      to: '2024-03-10',
    });
    expect(shiftPeriodRange('thisWeek', '2026-10-05', '2026-10-10', -1, '2026-10-10')).toEqual({
      from: '2026-09-28',
      to: '2026-10-04',
    });
    expect(shiftPeriodRange('custom', '2026-01-10', '2026-01-12', 1, '2026-10-10')).toEqual({
      from: '2026-01-13',
      to: '2026-01-15',
    });
    expect(shiftPeriodRange('thisYear', '2026-01-01', '2026-10-10', 1, '2026-10-10')).toBeNull();
  });
});
