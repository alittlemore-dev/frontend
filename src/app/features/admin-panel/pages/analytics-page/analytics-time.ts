import {
  AnalyticsBucket,
  AnalyticsDaily,
  AnalyticsMetric,
  AnalyticsPoint,
  AnalyticsTotal,
} from './analytics.model';

export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}
export function utcDay(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}
export function shiftedDay(value: string, days: number): string {
  const date = utcDay(value);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDay(date);
}
export function analyticsDateFormatter(locale: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
export function formatAnalyticsRange(
  from: string,
  to: string,
  formatter: Intl.DateTimeFormat,
): string {
  return from === to
    ? formatter.format(utcDay(from))
    : formatter.formatRange(utcDay(from), utcDay(to));
}
export function analyticsPointRange(
  date: string,
  bucket: AnalyticsBucket,
  dateFrom: string,
  dateTo: string,
): { from: string; to: string } {
  const end =
    bucket === 'week'
      ? shiftedDay(date, 6)
      : bucket === 'month'
        ? shiftedDay(shiftedDay(`${date.slice(0, 7)}-01`, 32).slice(0, 7) + '-01', -1)
        : date;
  return {
    from: dateFrom && dateFrom > date ? dateFrom : date,
    to: dateTo && dateTo < end ? dateTo : end,
  };
}
export function periodRange(period: string, today: string): { from: string; to: string } {
  const date = utcDay(today);
  if (period === 'today') return { from: today, to: today };
  if (period === 'thisWeek')
    return { from: shiftedDay(today, -((date.getUTCDay() + 6) % 7)), to: today };
  if (period === 'thisMonth') return { from: `${today.slice(0, 7)}-01`, to: today };
  if (period === 'previousMonth') {
    date.setUTCDate(0);
    return { from: `${isoDay(date).slice(0, 7)}-01`, to: isoDay(date) };
  }
  if (period === 'thisYear') return { from: `${today.slice(0, 4)}-01-01`, to: today };
  return { from: shiftedDay(today, period === 'last7Days' ? -6 : -29), to: today };
}
export function bucketKey(day: string, bucket: AnalyticsBucket): string {
  if (bucket === 'month') return `${day.slice(0, 7)}-01`;
  if (bucket === 'week') return shiftedDay(day, -((utcDay(day).getUTCDay() + 6) % 7));
  return day;
}
export function analyticsPoints(
  rows: readonly AnalyticsDaily[],
  from: string,
  to: string,
  bucket: AnalyticsBucket,
  metric: AnalyticsMetric,
): AnalyticsPoint[] {
  const values = new Map<string, number>();
  for (let day = from; day <= to; day = shiftedDay(day, 1)) values.set(bucketKey(day, bucket), 0);
  for (const row of rows) {
    const key = bucketKey(row.date, bucket);
    values.set(key, (values.get(key) ?? 0) + row[metric]);
  }
  return [...values].map(([date, value]) => ({ date, value }));
}
export function analyticsTotals(rows: readonly AnalyticsDaily[]): AnalyticsTotal {
  return rows.reduce(
    (sum, row) => ({
      views: sum.views + row.views,
      engaged: sum.engaged + row.engaged,
      reactions: sum.reactions + row.reactions,
      suggestions: sum.suggestions + row.suggestions,
      visitors: sum.visitors + row.visitors,
    }),
    { views: 0, engaged: 0, reactions: 0, suggestions: 0, visitors: 0 },
  );
}
export function validRange(from: string, to: string, today: string): boolean {
  return (
    [from, to].every(
      (value) =>
        /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(utcDay(value).getTime()) &&
        isoDay(utcDay(value)) === value,
    ) &&
    from <= to &&
    to <= today &&
    (utcDay(to).getTime() - utcDay(from).getTime()) / 86400000 <= 1095
  );
}

export function shiftPeriodRange(
  period: string,
  from: string,
  to: string,
  offset: number,
  today: string,
): { from: string; to: string } | null {
  if (!validRange(from, to, today)) return null;
  const start = utcDay(from);
  let nextFrom: string;
  let nextTo: string;
  if (period === 'thisMonth' || period === 'previousMonth') {
    start.setUTCDate(1);
    start.setUTCMonth(start.getUTCMonth() + offset);
    nextFrom = isoDay(start);
    start.setUTCMonth(start.getUTCMonth() + 1);
    start.setUTCDate(0);
    nextTo = isoDay(start);
  } else if (period === 'thisYear') {
    const year = start.getUTCFullYear() + offset;
    nextFrom = `${year}-01-01`;
    nextTo = `${year}-12-31`;
  } else {
    const size =
      period === 'today'
        ? 1
        : period === 'thisWeek' || period === 'last7Days'
          ? 7
          : period === 'last30Days'
            ? 30
            : Math.round((utcDay(to).getTime() - start.getTime()) / 86400000) + 1;
    nextFrom = shiftedDay(from, offset * size);
    nextTo = period === 'thisWeek' ? shiftedDay(nextFrom, 6) : shiftedDay(to, offset * size);
  }
  if (nextFrom > today) return null;
  return { from: nextFrom, to: nextTo > today ? today : nextTo };
}
