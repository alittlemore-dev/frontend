import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { ApiError } from '../../../../core/models/api-error.model';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { Calendar } from '../../models/calendar.model';
import { CalendarService } from '../../services/calendar.service';
import { MonthCalendarWidgetComponent } from './month-calendar-widget.component';

describe('MonthCalendarWidgetComponent', () => {
  let fixture: ComponentFixture<MonthCalendarWidgetComponent>;
  let response: Observable<Calendar>;
  let getCalendar: jest.Mock;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 7, 2, 12, 0, 0));
    response = of(monthCalendar('2026-08-01'));
    getCalendar = jest.fn(() => response);

    await TestBed.configureTestingModule({
      imports: [MonthCalendarWidgetComponent],
      providers: [
        provideRouter([]),
        provideI18nTesting(),
        { provide: CalendarService, useValue: { getCalendar } },
      ],
    }).compileComponents();
  });

  afterEach(() => jest.useRealTimers());

  function render(): void {
    fixture = TestBed.createComponent(MonthCalendarWidgetComponent);
    fixture.detectChanges();
  }

  it('renders a semantic month grid with multiple linked entries and today highlighted', () => {
    render();

    expect(getCalendar).toHaveBeenCalledWith('2026-08-01', 'month');
    const table = fixture.nativeElement.querySelector(
      '[data-testid="dashboard-month-grid"]',
    ) as HTMLTableElement;
    expect(table.querySelectorAll('thead th')).toHaveLength(7);
    expect(table.textContent).toContain('Годовщина');
    expect(table.textContent).toContain('Анна');
    expect(
      table.querySelector('a[href="/personal-workspace/knowledge/dates/date-1"]'),
    ).not.toBeNull();
    expect(
      table.querySelector('a[href="/personal-workspace/knowledge/people/person-1"]'),
    ).not.toBeNull();
    expect(table.querySelector('[data-testid="dashboard-calendar-today"]')?.textContent).toContain(
      '2',
    );
  });

  it('uses Monday-first Russian and Sunday-first English weekday ordering', () => {
    render();
    const weekdayText = (): string[] =>
      Array.from(
        fixture.nativeElement.querySelectorAll('[data-testid="dashboard-month-grid"] thead th'),
      ).map((cell) => (cell as HTMLElement).textContent?.trim() ?? '');

    expect(weekdayText()[0].toLowerCase()).toContain('пн');

    TestBed.inject(I18nService).switchLanguage('en').subscribe();
    fixture.detectChanges();

    expect(weekdayText()[0].toLowerCase()).toContain('sun');
  });

  it('moves across year boundaries and chooses any month from a year chooser', () => {
    jest.setSystemTime(new Date(2026, 11, 20, 12, 0, 0));
    response = of(monthCalendar('2026-12-01'));
    render();

    click('[data-testid="dashboard-calendar-next-month"]');
    expect(getCalendar).toHaveBeenLastCalledWith('2027-01-01', 'month');

    click('[data-testid="dashboard-calendar-month-heading"]');
    expect(
      fixture.nativeElement.querySelector('[data-testid="dashboard-calendar-month-chooser"]'),
    ).not.toBeNull();
    click('[data-testid="dashboard-calendar-chooser-previous-year"]');
    click('[data-testid="dashboard-calendar-chooser-next-year"]');
    click('[data-testid="dashboard-calendar-chooser-next-year"]');
    click('[data-testid="dashboard-calendar-chooser-month-1"]');
    expect(getCalendar).toHaveBeenLastCalledWith('2028-02-01', 'month');

    click('[data-testid="dashboard-calendar-previous-month"]');
    expect(getCalendar).toHaveBeenLastCalledWith('2028-01-01', 'month');
  });

  it('ignores stale responses after rapid month navigation', () => {
    const august = new Subject<Calendar>();
    const september = new Subject<Calendar>();
    const october = new Subject<Calendar>();
    getCalendar
      .mockReturnValueOnce(august)
      .mockReturnValueOnce(september)
      .mockReturnValueOnce(october);
    render();

    click('[data-testid="dashboard-calendar-next-month"]');
    click('[data-testid="dashboard-calendar-next-month"]');
    october.next(monthCalendar('2026-10-01', 'Октябрьское событие'));
    fixture.detectChanges();
    september.next(monthCalendar('2026-09-01', 'Устаревшее событие'));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Октябрьское событие');
    expect(fixture.nativeElement.textContent).not.toContain('Устаревшее событие');
  });

  it('lists February 29 separately when the selected year is not leap', () => {
    jest.setSystemTime(new Date(2027, 1, 1, 12, 0, 0));
    response = of(nonLeapFebruaryCalendar());
    render();

    const omitted = fixture.nativeElement.querySelector(
      '[data-testid="dashboard-calendar-no-day"]',
    ) as HTMLElement;
    expect(omitted.textContent).toContain('Нет дня в этом году');
    expect(omitted.textContent).toContain('Родился 29 февраля');
    expect(
      omitted.querySelector('a[href="/personal-workspace/knowledge/people/leap-person"]'),
    ).not.toBeNull();
  });

  it('renders February 29 in the grid when the selected year is leap', () => {
    jest.setSystemTime(new Date(2028, 1, 1, 12, 0, 0));
    response = of({ ...nonLeapFebruaryCalendar(), referenceDate: '2028-02-01' });
    render();

    expect(
      fixture.nativeElement.querySelector('[data-testid="dashboard-calendar-no-day"]'),
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="dashboard-month-grid"]').textContent,
    ).toContain('Родился 29 февраля');
  });

  it('shows a retryable error without affecting the parent dashboard state', () => {
    const error: ApiError = {
      code: 'calendar_unavailable',
      type: 'server_error',
      message: 'calendar unavailable',
      location: null,
      attr: null,
    };
    response = throwError(() => error);
    render();
    expect(fixture.nativeElement.querySelector('ds-error-message')).not.toBeNull();

    response = of(monthCalendar('2026-08-01'));
    click('ds-error-message button');

    expect(getCalendar).toHaveBeenCalledTimes(2);
    expect(
      fixture.nativeElement.querySelector('[data-testid="dashboard-month-grid"]'),
    ).not.toBeNull();
  });

  function click(selector: string): void {
    const button = fixture.nativeElement.querySelector(selector) as HTMLButtonElement;
    expect(button).not.toBeNull();
    button.click();
    fixture.detectChanges();
  }
});

function monthCalendar(referenceDate: string, memorableName = 'Годовщина'): Calendar {
  const year = Number(referenceDate.slice(0, 4));
  const month = Number(referenceDate.slice(5, 7));
  return {
    referenceDate,
    window: 'month',
    summary: { memorableDateCount: 1, birthdayCount: 1 },
    entries: [
      {
        id: 'date-1',
        kind: 'memorableDate',
        displayName: memorableName,
        annualDate: { day: 2, month, year: 2020 },
        period: 'currentMonth',
        occurrenceYear: year,
        relatedPeople: [],
      },
      {
        id: 'person-1',
        kind: 'birthday',
        displayName: 'Анна',
        annualDate: { day: 2, month, year: 1990 },
        period: 'currentMonth',
        occurrenceYear: year,
        relatedPeople: [],
      },
    ],
  };
}

function nonLeapFebruaryCalendar(): Calendar {
  return {
    referenceDate: '2027-02-01',
    window: 'month',
    summary: { memorableDateCount: 0, birthdayCount: 1 },
    entries: [
      {
        id: 'leap-person',
        kind: 'birthday',
        displayName: 'Родился 29 февраля',
        annualDate: { day: 29, month: 2, year: 2000 },
        period: 'currentMonth',
        occurrenceYear: 2027,
        relatedPeople: [],
      },
    ],
  };
}
