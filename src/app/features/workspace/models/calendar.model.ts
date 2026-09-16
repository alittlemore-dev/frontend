import { AnnualDateValue } from '../knowledge/shared/annual-date';

export type CalendarWindow = 'month' | 'currentAndNextMonths';
export type CalendarEntryKind = 'memorableDate' | 'birthday';
export type CalendarEntryPeriod = 'currentMonth' | 'nextMonth';

export interface CalendarRelatedPerson {
  id: string;
  displayName: string;
}

export interface CalendarEntry {
  id: string;
  kind: CalendarEntryKind;
  displayName: string;
  annualDate: AnnualDateValue;
  period: CalendarEntryPeriod;
  occurrenceYear: number;
  relatedPeople: readonly CalendarRelatedPerson[];
}

export interface CalendarSummary {
  memorableDateCount: number;
  birthdayCount: number;
}

export interface Calendar {
  referenceDate: string;
  window: CalendarWindow;
  summary: CalendarSummary;
  entries: readonly CalendarEntry[];
}
