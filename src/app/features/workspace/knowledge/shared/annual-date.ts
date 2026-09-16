import { AbstractControl, ValidationErrors } from '@angular/forms';

export interface AnnualDateValue {
  day: number;
  month: number;
  year: number | null;
}

export function formatAnnualDate(value: AnnualDateValue, locale: string): string {
  const displayYear = value.year ?? 2000;
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(displayYear, value.month - 1, value.day);
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    ...(value.year === null ? {} : { year: 'numeric' as const }),
    timeZone: 'UTC',
  }).format(date);
}

export function annualDateValidator(control: AbstractControl): ValidationErrors | null {
  const day = control.get('day')?.value;
  const month = control.get('month')?.value;
  const year = control.get('year')?.value;
  if (
    typeof day !== 'string' ||
    typeof month !== 'string' ||
    typeof year !== 'string' ||
    day === '' ||
    month === ''
  ) {
    return { annualDate: true };
  }
  const numericDay = Number(day);
  const numericMonth = Number(month);
  const validationYear = year === '' ? 2000 : Number(year);
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
  if (year !== '') {
    const today = new Date();
    const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    if (date.getTime() > todayUtc) {
      return { annualDateFuture: true };
    }
  }
  return null;
}
