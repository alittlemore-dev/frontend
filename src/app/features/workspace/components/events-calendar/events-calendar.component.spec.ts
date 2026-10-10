import { provideRouter, Router } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import {
  CalendarComponent,
  type CalendarEntry,
  type CalendarLabels,
  type CalendarRange,
  type CalendarDateSelection,
  type CalendarView,
} from '@alittlemore.dev/design-system/calendar';
import { of, Subject, throwError } from 'rxjs';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { EventsService } from '../../services/events.service';
import { EventsCalendarComponent } from './events-calendar.component';
import { PeopleService } from '../../knowledge/people/services/people.service';
import { KnowledgeDatesService } from '../../knowledge/dates/services/dates.service';
import { AccountSettingsService } from '../../../../core/auth/account-settings.service';
import { CalendarOccurrence, CalendarOccurrences } from '../../models/events.model';

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'ds-calendar',
  template:
    '@for (entry of entries(); track entry.id) { <button type="button" [attr.aria-label]="entry.typeLabel + \' · \' + entry.title" (click)="entrySelected.emit(entry)">{{ entry.title }}</button> }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class CalendarStub {
  readonly id = input('');
  readonly date = input('');
  readonly today = input('');
  readonly labels = input<CalendarLabels>();
  readonly dateLocale = input('');
  readonly timeZone = input('');
  readonly loading = input(false);
  readonly view = input<CalendarView>('month');
  readonly entries = input<readonly CalendarEntry[]>([]);
  readonly dateChange = output<string>();
  readonly viewChange = output<CalendarView>();
  readonly rangeChange = output<CalendarRange>();
  readonly dateSelected = output<CalendarDateSelection>();
  readonly entrySelected = output<CalendarEntry>();
  readonly loadError = output<void>();
}
const birthday: CalendarOccurrence = {
  id: 'birthday-1',
  sourceId: 'person-1',
  kind: 'birthday',
  displayName: 'Иван Иванов',
  allDay: true,
  start: '2026-10-02',
  end: '2026-10-03',
  annualDate: { day: 2, month: 10, year: 1990 },
  relatedPeople: [],
};
const range: CalendarRange = {
  start: '2026-09-27',
  end: '2026-11-01',
  date: '2026-10-02',
  view: 'month',
};

describe('EventsCalendarComponent', () => {
  const service = { occurrences: jest.fn(), get: jest.fn() };
  const timeZone = signal('UTC');
  let fixture: ComponentFixture<EventsCalendarComponent>;
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1);
    timeZone.set('UTC');
    service.occurrences.mockReturnValue(of({ entries: [], unplacedAnnualEntries: [] }));
    await TestBed.configureTestingModule({
      imports: [EventsCalendarComponent],
      providers: [
        provideRouter([]),
        provideI18nTesting(),
        { provide: EventsService, useValue: service },
        { provide: PeopleService, useValue: { createPerson: jest.fn() } },
        { provide: KnowledgeDatesService, useValue: { createDate: jest.fn() } },
        { provide: AccountSettingsService, useValue: { timeZone } },
      ],
    })
      .overrideComponent(EventsCalendarComponent, {
        remove: { imports: [CalendarComponent] },
        add: { imports: [CalendarStub] },
      })
      .compileComponents();
    fixture = TestBed.createComponent(EventsCalendarComponent);
    fixture.detectChanges();
  });
  afterEach(() => {
    fixture.destroy();
    jest.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('shows a recoverable error when the calendar runtime cannot load', () => {
    const calendar = fixture.debugElement.query(By.directive(CalendarStub))
      .componentInstance as CalendarStub;
    calendar.loadError.emit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('ds-error-message')?.textContent).toContain(
      'Не удалось загрузить календарь',
    );
    expect(fixture.nativeElement.querySelector('ds-error-message button')).not.toBeNull();
  });

  it('requests each visible half-open range once and retains the legacy URL contract', () => {
    const navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.componentInstance.onRangeChange(range);
    fixture.componentInstance.onRangeChange(range);
    expect(service.occurrences).toHaveBeenCalledTimes(1);
    expect(service.occurrences).toHaveBeenCalledWith('2026-09-27', '2026-11-01');
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({
        queryParams: { date: '2026-10-02', view: 'dayGridMonth', tab: 'month-calendar' },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      }),
    );
  });
  it('keeps previous entries while loading and ignores a stale response', () => {
    const first = new Subject<CalendarOccurrences>();
    const second = new Subject<CalendarOccurrences>();
    service.occurrences.mockReturnValueOnce(first).mockReturnValueOnce(second);
    fixture.componentInstance.occurrences.set({ entries: [birthday], unplacedAnnualEntries: [] });
    fixture.componentInstance.onRangeChange(range);
    fixture.componentInstance.onRangeChange({
      ...range,
      start: '2026-11-01',
      end: '2026-12-01',
      date: '2026-11-02',
    });
    expect(fixture.componentInstance.entries()[0].id).toBe(birthday.id);
    second.next({ entries: [], unplacedAnnualEntries: [] });
    first.next({ entries: [birthday], unplacedAnnualEntries: [] });
    expect(fixture.componentInstance.entries()).toEqual([]);
    expect(fixture.componentInstance.loading()).toBe(false);
  });
  it('identifies entry types and opens the birthday modal from the calendar', async () => {
    service.occurrences.mockReturnValue(of({ entries: [birthday], unplacedAnnualEntries: [] }));
    fixture.componentInstance.onRangeChange(range);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('ds-calendar button') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toContain('День рождения');
    button.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.calendar-dialog[role="dialog"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#calendar-event-title').textContent).toContain(
      birthday.displayName,
    );
    expect(
      fixture.nativeElement.querySelector('.calendar-dialog[role="dialog"] a').getAttribute('href'),
    ).toBe('/personal-workspace/knowledge/people/person-1');
  });
  it('opens dates and all-day overflow as day details in every view', () => {
    for (const view of ['month', 'year', 'week', 'day'] as const) {
      fixture.componentInstance.activeView.set(view);
      fixture.componentInstance.onDateSelected({
        date: '2026-10-02',
        start: '2026-10-02',
        allDay: true,
      });
      expect(fixture.componentInstance.selectedDay()).toBe('2026-10-02');
      expect(fixture.componentInstance.editorOpen()).toBe(false);
    }
  });
  it('uses exact one-hour instants for both daylight-saving folds', () => {
    timeZone.set('America/New_York');
    fixture.componentInstance.activeView.set('day');
    for (const [start, end] of [
      ['2026-11-01T05:30:00Z', '2026-11-01T06:30:00Z'],
      ['2026-11-01T06:30:00Z', '2026-11-01T07:30:00Z'],
    ]) {
      fixture.componentInstance.onDateSelected({ date: '2026-11-01', start, allDay: false });
      expect(fixture.componentInstance.editorInitial()).toEqual(
        expect.objectContaining({
          start: '2026-11-01T01:30',
          startInstant: start,
          endInstant: end,
        }),
      );
    }
  });
  it('selects a date without changing the active view or opening a detail modal', () => {
    fixture.componentInstance.activeView.set('week');
    fixture.componentInstance.goToDate('2026-11-07');
    expect(fixture.componentInstance.date()).toBe('2026-11-07');
    expect(fixture.componentInstance.activeView()).toBe('week');
    expect(fixture.componentInstance.selectedDay()).toBeNull();
  });
  it('requeries when the account time zone changes and moves a timed occurrence to its local day', () => {
    const timed: CalendarOccurrence = {
      ...birthday,
      id: 'call',
      kind: 'event',
      allDay: false,
      start: '2026-10-02T01:30:00Z',
      end: '2026-10-02T02:30:00Z',
      annualDate: null,
    };
    service.occurrences.mockReturnValue(of({ entries: [timed], unplacedAnnualEntries: [] }));
    fixture.componentInstance.onRangeChange(range);
    fixture.componentInstance.openDay('2026-10-01');
    expect(fixture.componentInstance.dayEntries()).toEqual([]);
    timeZone.set('Pacific/Honolulu');
    fixture.detectChanges();
    expect(service.occurrences).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.dayEntries()).toEqual([timed]);
    expect(fixture.componentInstance.markedDates()).toContain('2026-10-01');
    expect(timed.start).toBe('2026-10-02T01:30:00Z');
  });
  it('respects exclusive all-day ends in day details and mini-calendar marks', () => {
    const trip = { ...birthday, id: 'trip', start: '2026-10-14', end: '2026-10-17' };
    service.occurrences.mockReturnValue(of({ entries: [trip], unplacedAnnualEntries: [] }));
    fixture.componentInstance.onRangeChange(range);
    fixture.componentInstance.openDay('2026-10-16');
    expect(fixture.componentInstance.dayEntries()).toEqual([trip]);
    fixture.componentInstance.openDay('2026-10-17');
    expect(fixture.componentInstance.dayEntries()).toEqual([]);
    expect(fixture.componentInstance.markedDates()).toEqual([
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
    ]);
  });
  it('shows a failed range request inline and retries the same range', () => {
    service.occurrences.mockReturnValueOnce(throwError(() => ({ message: 'Unavailable' })));
    fixture.componentInstance.onRangeChange(range);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('ds-error-message').textContent).toContain(
      'Unavailable',
    );
    (fixture.nativeElement.querySelector('ds-error-message button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(service.occurrences).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.error()).toBeNull();
  });
  it('focuses and closes the day modal with Escape, restoring the trigger', async () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    fixture.componentInstance.onRangeChange(range);
    fixture.componentInstance.openDay('2026-10-02');
    fixture.detectChanges();
    await fixture.whenStable();
    const close = fixture.nativeElement.querySelector(
      '.calendar-dialog[role="dialog"] .btn-close',
    ) as HTMLButtonElement;
    expect(document.activeElement).toBe(close);
    close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.calendar-dialog[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
  it('returns from entry details to the selected day', () => {
    fixture.componentInstance.occurrences.set({ entries: [birthday], unplacedAnnualEntries: [] });
    fixture.componentInstance.openDay('2026-10-02');
    fixture.componentInstance.showDayEntry(birthday);
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector(
        '.calendar-dialog[role="dialog"] .modal-footer button',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.selectedDay()).toBe('2026-10-02');
    expect(fixture.nativeElement.querySelectorAll('.calendar-dialog[role="dialog"]')).toHaveLength(
      1,
    );
  });
  it('returns to the selected day after creation and refreshes related summaries after knowledge save', () => {
    fixture.componentInstance.onRangeChange(range);
    fixture.componentInstance.openDay('2026-10-03');
    fixture.componentInstance.createOnSelectedDay();
    expect(fixture.componentInstance.editorInitial()?.start).toBe('2026-10-03');
    const created = jest.fn();
    fixture.componentInstance.knowledgeCreated.subscribe(created);
    fixture.componentInstance.onKnowledgeSaved();
    fixture.detectChanges();
    expect(fixture.componentInstance.selectedDay()).toBe('2026-10-03');
    expect(fixture.componentInstance.editorOpen()).toBe(false);
    expect(service.occurrences).toHaveBeenCalledTimes(2);
    expect(created).toHaveBeenCalledTimes(1);
  });
});
