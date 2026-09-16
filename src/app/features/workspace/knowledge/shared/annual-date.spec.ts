import { FormControl, FormGroup } from '@angular/forms';
import { annualDateValidator, formatAnnualDate } from './annual-date';

describe('annual date helpers', () => {
  it('formats dates with and without a first year using locale rules', () => {
    expect(formatAnnualDate({ day: 29, month: 2, year: null }, 'en-US')).toBe('February 29');
    expect(formatAnnualDate({ day: 29, month: 2, year: 2024 }, 'en-US')).toBe('February 29, 2024');
  });

  it('validates leap days and future first dates', () => {
    const group = new FormGroup({
      day: new FormControl('29'),
      month: new FormControl('2'),
      year: new FormControl('2025'),
    });
    expect(annualDateValidator(group)).toEqual({ annualDate: true });

    group.controls.year.setValue('');
    expect(annualDateValidator(group)).toBeNull();

    group.controls.day.setValue('1');
    group.controls.month.setValue('1');
    group.controls.year.setValue('9999');
    expect(annualDateValidator(group)).toEqual({ annualDateFuture: true });
  });
});
