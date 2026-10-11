import { AbstractControl, ValidationErrors } from '@angular/forms';
import { Temporal } from 'temporal-polyfill';

export interface AnnualDateValue {
  day: number;
  month: number;
  year: number | null;
}

export interface AnnualDateMilestone {
  key: string;
  count: number;
}

export function annualDateMilestone(
  value: AnnualDateValue | null,
  kind: 'event' | 'birthday' | 'memorableDate',
  occurrenceYear: number | null,
  locale: string,
): AnnualDateMilestone | null {
  if (kind === 'event' || value === null || value.year === null || occurrenceYear === null)
    return null;
  const count = occurrenceYear - value.year;
  if (count <= 0) return null;
  const category = new Intl.PluralRules(locale).select(count);
  const suffix =
    category === 'one' || category === 'few' || category === 'many' ? category : 'other';
  const milestone = kind === 'birthday' ? 'age' : 'anniversary';
  return { key: `workspaceDashboard.dates.${milestone}.${suffix}`, count };
}

export function nextAnnualOccurrenceYear(value: AnnualDateValue, today: string): number | null {
  const reference = Temporal.PlainDate.from(today);
  let year = reference.year;
  while (year <= 9999) {
    const daysInMonth = Temporal.PlainYearMonth.from({ year, month: value.month }).daysInMonth;
    if (value.day <= daysInMonth) {
      const occurrence = Temporal.PlainDate.from({ year, month: value.month, day: value.day });
      if (Temporal.PlainDate.compare(occurrence, reference) >= 0) return year;
    }
    year += 1;
  }
  return null;
}

export function formatAnnualDate(value: AnnualDateValue, locale: string): string {
  const displayYear = value.year ?? 2000;
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(displayYear, value.month - 1, value.day);
  const parts = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    ...(value.year === null ? {} : { year: 'numeric' as const }),
    timeZone: 'UTC',
  }).formatToParts(date);
  if (value.year !== null && parts.at(-1)?.type === 'literal') parts.pop();
  return parts
    .map((part) => part.value)
    .join('')
    .trim();
}

export interface AnnualDateFormValue {
  day: string;
  month: string;
  year: number | null;
}

export function annualDateValidator(control: AbstractControl): ValidationErrors | null {
  const day = control.get('day')?.value;
  const month = control.get('month')?.value;
  const year = control.get('year')?.value;
  if (
    typeof day !== 'string' ||
    typeof month !== 'string' ||
    (year !== null && typeof year !== 'number') ||
    day === '' ||
    month === ''
  ) {
    return { annualDate: true };
  }
  const numericDay = Number(day);
  const numericMonth = Number(month);
  const validationYear = year ?? 2000;
  if (
    !Number.isInteger(numericDay) ||
    !Number.isInteger(numericMonth) ||
    !Number.isInteger(validationYear) ||
    validationYear < 1 ||
    validationYear > 9999
  ) {
    return { annualDate: true };
  }
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(validationYear, numericMonth - 1, numericDay);
  if (
    date.getUTCFullYear() !== validationYear ||
    date.getUTCMonth() !== numericMonth - 1 ||
    date.getUTCDate() !== numericDay
  ) {
    return { annualDate: true };
  }
  if (year !== null) {
    const today = new Date();
    const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    if (date.getTime() > todayUtc) {
      return { annualDateFuture: true };
    }
  }
  return null;
}
