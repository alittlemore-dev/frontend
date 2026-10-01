import { FormControl, FormGroup } from '@angular/forms';
import { annualDateValidator, formatAnnualDate } from './annual-date';

describe('annual date helpers', () => {
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
