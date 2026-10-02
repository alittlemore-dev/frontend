import { Temporal } from 'temporal-polyfill';

export interface FinanceMonthTimeRange {
  start: Temporal.Instant;
  end: Temporal.Instant;
  min: string;
  max: string;
}

export function financeMonthTimeRange(period: string, timeZone: string): FinanceMonthTimeRange {
  const date = Temporal.PlainDate.from(period);
  const start = date.toZonedDateTime(timeZone).toInstant();
  const end = date.add({ months: 1 }).toZonedDateTime(timeZone).toInstant();
  return {
    start,
    end,
    min: start.toZonedDateTimeISO(timeZone).toPlainDateTime().toString({ smallestUnit: 'minute' }),
    max: end
      .subtract({ minutes: 1 })
      .toZonedDateTimeISO(timeZone)
      .toPlainDateTime()
      .toString({ smallestUnit: 'minute' }),
  };
}

export function formatFinanceDate(value: string, locale: string, timeZone: string): string {
  // Plain calendar dates (e.g. exchange-rate dates) are not instants and must not shift.
  const dateOnly = value.length === 10;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeZone: dateOnly ? 'UTC' : timeZone,
  }).format(new Date(dateOnly ? `${value}T00:00:00Z` : value));
}

export function financePeriodEnd(value: string, locale: string, timeZone: string): string {
  return formatFinanceDate(
    Temporal.Instant.from(value).subtract({ nanoseconds: 1 }).toString(),
    locale,
    timeZone,
  );
}
