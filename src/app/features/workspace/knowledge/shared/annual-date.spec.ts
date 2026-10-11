import { FormControl, FormGroup } from '@angular/forms';
import {
  annualDateMilestone,
  annualDateValidator,
  formatAnnualDate,
  nextAnnualOccurrenceYear,
} from './annual-date';

describe('annual date helpers', () => {
  it.each([
    [2021, 2026, 'ru-RU', 'many', 5],
    [2005, 2026, 'ru-RU', 'one', 21],
    [2004, 2026, 'ru-RU', 'few', 22],
    [2025, 2026, 'en-US', 'one', 1],
    [2024, 2026, 'en-US', 'other', 2],
  ])(
    'describes an anniversary from %s in %s using %s plurals',
    (year, occurrenceYear, locale, suffix, count) => {
      expect(
        annualDateMilestone({ day: 1, month: 1, year }, 'memorableDate', occurrenceYear, locale),
      ).toEqual({
        key: `workspaceDashboard.dates.anniversary.${suffix}`,
        count,
      });
    },
  );

  it('uses age for birthdays and omits milestones without elapsed years or a known first year', () => {
    expect(
      annualDateMilestone({ day: 2, month: 10, year: 1990 }, 'birthday', 2026, 'ru-RU'),
    ).toEqual({ key: 'workspaceDashboard.dates.age.many', count: 36 });
    for (const year of [null, 2026, 2027]) {
      expect(
        annualDateMilestone({ day: 2, month: 10, year }, 'memorableDate', 2026, 'ru-RU'),
      ).toBeNull();
    }
    expect(annualDateMilestone(null, 'event', 2026, 'ru-RU')).toBeNull();
  });

  it('selects the next real occurrence, including today, New Year and leap days', () => {
    expect(nextAnnualOccurrenceYear({ day: 11, month: 10, year: 2020 }, '2026-10-11')).toBe(2026);
    expect(nextAnnualOccurrenceYear({ day: 10, month: 10, year: 2020 }, '2026-10-11')).toBe(2027);
    expect(nextAnnualOccurrenceYear({ day: 1, month: 1, year: null }, '2026-12-31')).toBe(2027);
    expect(nextAnnualOccurrenceYear({ day: 29, month: 2, year: 2024 }, '2026-10-11')).toBe(2028);
    expect(nextAnnualOccurrenceYear({ day: 29, month: 2, year: 2096 }, '2097-03-01')).toBe(2104);
  });
  it('formats dates with and without a first year using locale rules', () => {
    expect(formatAnnualDate({ day: 29, month: 2, year: null }, 'en-US')).toBe('February 29');
    expect(formatAnnualDate({ day: 29, month: 2, year: 2024 }, 'en-US')).toBe('February 29, 2024');
    expect(formatAnnualDate({ day: 12, month: 9, year: null }, 'ru-RU')).toBe('12 сентября');
    expect(formatAnnualDate({ day: 10, month: 4, year: 1967 }, 'ru-RU')).toBe('10 апреля 1967');
  });

  it.each([
    ['31', '4', 2024, 'annualDate'],
    ['29', '2', 2025, 'annualDate'],
    ['29', '2', 2024, null],
    ['29', '2', null, null],
    ['1', '10', 2026, null],
    ['2', '10', 2026, 'annualDateFuture'],
    ['1', '1', 0, 'annualDate'],
    ['1', '1', 2024.5, 'annualDate'],
  ] as const)('validates %s/%s/%s against today', (day, month, year, error) => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-01T12:00:00Z'));
    try {
      const group = new FormGroup({
        day: new FormControl(day),
        month: new FormControl(month),
        year: new FormControl<number | null>(year),
      });
      expect(annualDateValidator(group)).toEqual(error === null ? null : { [error]: true });
    } finally {
      jest.useRealTimers();
    }
  });

  it('validates leap days and future first dates', () => {
    const group = new FormGroup({
      day: new FormControl('29'),
      month: new FormControl('2'),
      year: new FormControl<number | null>(2025),
    });
    expect(annualDateValidator(group)).toEqual({ annualDate: true });

    group.controls.year.setValue(null);
    expect(annualDateValidator(group)).toBeNull();

    group.controls.day.setValue('1');
    group.controls.month.setValue('1');
    group.controls.year.setValue(9999);
    expect(annualDateValidator(group)).toEqual({ annualDateFuture: true });
  });
});
