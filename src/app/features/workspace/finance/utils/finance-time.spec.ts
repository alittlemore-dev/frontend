import { financeMonthTimeRange, financePeriodEnd, formatFinanceDate } from './finance-time';

describe('finance time presentation', () => {
  it('uses local calendar month boundaries and represents them as UTC instants', () => {
    const range = financeMonthTimeRange('2026-10-01', 'Asia/Yerevan');
    expect(range.start.toString()).toBe('2026-09-30T20:00:00Z');
    expect(range.end.toString()).toBe('2026-10-31T20:00:00Z');
    expect(range.min).toBe('2026-10-01T00:00');
    expect(range.max).toBe('2026-10-31T23:59');
  });

  it('uses the correct UTC offsets at both boundaries when a month includes a DST change', () => {
    const range = financeMonthTimeRange('2026-11-01', 'America/New_York');
    expect(range.start.toString()).toBe('2026-11-01T04:00:00Z');
    expect(range.end.toString()).toBe('2026-12-01T05:00:00Z');
    expect(range.min).toBe('2026-11-01T00:00');
    expect(range.max).toBe('2026-11-30T23:59');
  });

  it('localizes instants and the inclusive period end without shifting plain calendar dates', () => {
    expect(formatFinanceDate('2026-10-01T00:00:00Z', 'en-US', 'Pacific/Honolulu')).toBe(
      'Sep 30, 2026',
    );
    expect(formatFinanceDate('2026-10-01', 'en-US', 'Pacific/Honolulu')).toBe('Oct 1, 2026');
    expect(financePeriodEnd('2026-10-31T20:00:00Z', 'en-US', 'Asia/Yerevan')).toBe('Oct 31, 2026');
  });
});
