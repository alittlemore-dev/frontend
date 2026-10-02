import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component, Input, signal } from '@angular/core';
import {
  CalendarOptions,
  DateClickInfo,
  DatesSetInfo,
  FullCalendarComponent,
  FullCalendarModule,
} from '@fullcalendar/angular';
import { of, Subject } from 'rxjs';
import { Temporal } from 'temporal-polyfill';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { EventsService } from '../../services/events.service';
import { EventsCalendarComponent } from './events-calendar.component';
import { AccountSettingsService } from '../../../../core/auth/account-settings.service';

// Match the third-party selector so the calendar can be replaced in this focus test.
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'full-calendar',
  standalone: true,
  template: '@for (title of titles; track $index) { <span>{{ title }}</span> }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StubFullCalendarComponent {
  @Input() options?: CalendarOptions;

  get titles(): readonly string[] {
    const events = this.options?.events;
    return Array.isArray(events)
      ? events.map((event: { title?: string }) => event.title ?? '')
      : [];
  }
}

describe('EventsCalendarComponent', () => {
  const service = { occurrences: jest.fn(() => of({ entries: [], unplacedAnnualEntries: [] })) };
  const timeZone = signal('UTC');
  beforeEach(() => {
    jest.clearAllMocks();
    service.occurrences.mockReturnValue(of({ entries: [], unplacedAnnualEntries: [] }));
    timeZone.set('UTC');
    jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideI18nTesting({ 'workspaceDashboard.dates.type.birthday': 'День рождения' }),
        { provide: EventsService, useValue: service },
        { provide: AccountSettingsService, useValue: { timeZone } },
      ],
    });
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    jest.restoreAllMocks();
  });

  it('identifies birthdays in calendar titles, day entries and event details', async () => {
    await TestBed.configureTestingModule({ imports: [EventsCalendarComponent] })
      .overrideComponent(EventsCalendarComponent, {
        remove: { imports: [FullCalendarModule] },
        add: { imports: [StubFullCalendarComponent] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(EventsCalendarComponent);
    const birthday = {
      id: 'birthday-1',
      sourceId: 'person-1',
      kind: 'birthday' as const,
      displayName: 'Иван Иванов',
      allDay: true,
      start: '2026-10-02',
      end: '2026-10-03',
      annualDate: { day: 2, month: 10, year: 1990 },
      relatedPeople: [],
    };
    service.occurrences.mockReturnValue(
      of({
        entries: [
          birthday,
          {
            ...birthday,
            id: 'date-1',
            sourceId: 'date-1',
            kind: 'memorableDate',
            displayName: 'Годовщина',
          },
        ],
        unplacedAnnualEntries: [],
      }),
    );
    fixture.componentInstance.range.set({
      startDate: '2026-10-01',
      endDate: '2026-11-01',
      viewType: 'dayGridMonth',
    });
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('full-calendar')?.textContent).toContain(
      'День рождения · Иван Иванов',
    );
    expect(root.querySelector('full-calendar')?.textContent).toContain('Годовщина');
    expect(root.querySelector('full-calendar')?.textContent).not.toContain(
      'День рождения · Годовщина',
    );
    fixture.componentInstance.openDay('2026-10-02');
    fixture.detectChanges();
    const button = Array.from(root.querySelectorAll<HTMLButtonElement>('.list-group button')).find(
      (item) => item.textContent?.includes('День рождения · Иван Иванов'),
    );
    expect(button).toBeDefined();
    button!.click();
    fixture.detectChanges();
    expect(root.querySelector('[aria-labelledby="calendar-event-title"] strong')?.textContent).toBe(
      'День рождения · Иван Иванов',
    );
  });

  it('requests the visible half-open range and uses 30-minute slots without inner scrolling', () => {
    const component = TestBed.runInInjectionContext(() => new EventsCalendarComponent());
    component.onDatesSet({
      startStr: '2026-09-27T00:00:00+04:00',
      endStr: '2026-11-01T00:00:00+04:00',
      view: { type: 'dayGridMonth', title: 'October 2026' },
    } as DatesSetInfo);
    expect(service.occurrences).toHaveBeenCalledWith('2026-09-27', '2026-11-01');
    expect(component.options().slotDuration).toBe('00:30:00');
    expect(component.options().height).toBe('auto');
    expect(component.options().headerToolbar).toBe(false);
    expect(component.options().slotHeaderFormat).toEqual({
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      omitZeroMinute: false,
    });
    expect(component.calendarTitle()).toBe('October 2026');
  });

  it('opens month dates for details and day slots for one-hour creation', () => {
    const component = TestBed.runInInjectionContext(() => new EventsCalendarComponent());
    component.onDateClick({
      dateStr: '2026-10-01',
      allDay: true,
      view: { type: 'dayGridMonth' },
    } as DateClickInfo);
    expect(component.selectedDay()).toBe('2026-10-01');
    const clickedInstant = '2026-10-01T05:30:00Z';
    component.onDateClick({
      dateStr: '2026-10-01T09:30:00+04:00',
      date: new Date(clickedInstant),
      allDay: false,
      view: { type: 'timeGridDay' },
    } as DateClickInfo);
    const start = Temporal.Instant.from(clickedInstant)
      .toZonedDateTimeISO(component.timeZone)
      .toPlainDateTime()
      .toString({ smallestUnit: 'minute' });
    const end = Temporal.Instant.from(clickedInstant)
      .add({ hours: 1 })
      .toZonedDateTimeISO(component.timeZone)
      .toPlainDateTime()
      .toString({ smallestUnit: 'minute' });
    expect(component.editorInitial()).toEqual({
      allDay: false,
      start,
      end,
      startInstant: clickedInstant,
      endInstant: '2026-10-01T06:30:00Z',
    });
  });

  it('preserves both fall-back folds as exact one-hour intervals', () => {
    const component = TestBed.runInInjectionContext(() => new EventsCalendarComponent());
    Object.defineProperty(component, 'timeZone', { value: 'America/New_York' });
    for (const [start, end] of [
      ['2026-11-01T05:30:00Z', '2026-11-01T06:30:00Z'],
      ['2026-11-01T06:30:00Z', '2026-11-01T07:30:00Z'],
    ]) {
      component.onDateClick({
        date: new Date(start),
        dateStr: '2026-11-01T01:30:00',
        allDay: false,
        view: { type: 'timeGridDay' },
      } as DateClickInfo);
      expect(component.editorInitial()).toEqual(
        expect.objectContaining({
          start: '2026-11-01T01:30',
          startInstant: start,
          endInstant: end,
        }),
      );
    }
  });

  it('uses the design-system date picker to jump dates without changing view', () => {
    const component = TestBed.runInInjectionContext(() => new EventsCalendarComponent());
    const gotoDate = jest.fn();
    const changeView = jest.fn();
    component.calendar = {
      getApi: () => ({ getDate: () => new Date('2026-10-16T00:00:00Z'), gotoDate, changeView }),
    } as unknown as FullCalendarComponent;
    component.goToDate('2026-11-07');
    expect(gotoDate).toHaveBeenCalledWith('2026-11-07');
    expect(changeView).not.toHaveBeenCalled();
    expect(component.selectedDay()).toBeNull();
    expect(component.pickerDate()).toBe('2026-11-07');
  });

  it('renders the design-system calendar trigger in the toolbar', async () => {
    await TestBed.configureTestingModule({ imports: [EventsCalendarComponent] })
      .overrideComponent(EventsCalendarComponent, {
        remove: { imports: [FullCalendarModule] },
        add: { imports: [StubFullCalendarComponent] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(EventsCalendarComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const icon = root.querySelector(
      'ds-localized-date-picker .temporal-picker-field-trigger',
    ) as HTMLButtonElement;
    expect(icon.getAttribute('aria-label')).toBeTruthy();
    expect(icon.querySelector('svg')).not.toBeNull();
    expect(root.querySelector('input[type="date"]')).toBeNull();
    icon.click();
    fixture.detectChanges();
    expect(root.querySelector('ds-calendar-dialog [role="dialog"]')).not.toBeNull();
    fixture.destroy();
  });

  it('keeps the visible events and calendar options stable while a new range loads', () => {
    const pending = new Subject<{ entries: []; unplacedAnnualEntries: [] }>();
    const component = TestBed.runInInjectionContext(() => new EventsCalendarComponent());
    component.hasLoaded.set(true);
    component.occurrences.set({ entries: [], unplacedAnnualEntries: [] });
    const previous = component.occurrences();
    const options = component.options();
    service.occurrences.mockReturnValueOnce(pending.asObservable());

    component.onDatesSet({
      startStr: '2026-11-01T00:00:00Z',
      endStr: '2026-12-01T00:00:00Z',
      view: { type: 'dayGridMonth', title: 'November 2026' },
    } as DatesSetInfo);

    expect(component.loading()).toBe(true);
    expect(component.occurrences()).toBe(previous);
    expect(component.options()).toBe(options);
    pending.next({ entries: [], unplacedAnnualEntries: [] });
    pending.complete();
    expect(component.loading()).toBe(false);
  });

  it('does not flash a loader over the calendar after its initial load', async () => {
    await TestBed.configureTestingModule({ imports: [EventsCalendarComponent] })
      .overrideComponent(EventsCalendarComponent, {
        remove: { imports: [FullCalendarModule] },
        add: { imports: [StubFullCalendarComponent] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(EventsCalendarComponent);
    fixture.componentInstance.hasLoaded.set(true);
    fixture.componentInstance.loading.set(true);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('full-calendar')).not.toBeNull();
    expect(root.querySelector('ds-loading-spinner')).toBeNull();
    fixture.destroy();
  });

  it('renders zero-minute hours as HH:mm in the live FullCalendar time grid', async () => {
    await TestBed.configureTestingModule({
      imports: [EventsCalendarComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(EventsCalendarComponent);
    // Jest wraps these ESM defaults; the browser build receives the plugin objects directly.
    const originalOptions = fixture.componentInstance.options;
    Object.defineProperty(fixture.componentInstance, 'options', {
      value: () => {
        const options = originalOptions();
        return {
          ...options,
          plugins: options.plugins?.map(
            (plugin) => (plugin as { default?: typeof plugin }).default ?? plugin,
          ),
        };
      },
    });
    fixture.detectChanges();
    fixture.componentInstance.changeView('timeGridDay');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const sixPm = root.querySelector('[data-time="18:00:00"]');
    expect(sixPm?.textContent).toContain('18:00');
    fixture.destroy();
  });

  it('uses the calendar zone for a more-link day near UTC midnight', () => {
    const component = TestBed.runInInjectionContext(() => new EventsCalendarComponent());
    Object.defineProperty(component, 'timeZone', { value: 'America/New_York' });
    const moreLinkClick = component.options().moreLinkClick as (arg: { date: Date }) => string;
    moreLinkClick({ date: new Date('2026-10-02T02:30:00Z') });
    expect(component.selectedDay()).toBe('2026-10-01');
  });

  it('shows a timed occurrence on its calendar-local day and keeps unplaced annual entries', () => {
    const component = TestBed.runInInjectionContext(() => new EventsCalendarComponent());
    const entry = {
      id: 'occ-1',
      sourceId: 'event-1',
      kind: 'event' as const,
      displayName: 'Late call',
      allDay: false,
      start: '2026-10-01T21:30:00Z',
      end: '2026-10-01T22:30:00Z',
      annualDate: null,
      relatedPeople: [],
    };
    component.occurrences.set({
      entries: [entry],
      unplacedAnnualEntries: [
        {
          sourceId: 'date-1',
          kind: 'memorableDate',
          displayName: 'Leap day',
          annualDate: { day: 29, month: 2, year: null },
          relatedPeople: [],
        },
      ],
    });
    const day = Temporal.Instant.from(entry.start)
      .toZonedDateTimeISO(component.timeZone)
      .toPlainDate()
      .toString();
    component.openDay(day);
    expect(component.dayEntries()).toEqual([entry]);
    expect(component.occurrences().unplacedAnnualEntries).toHaveLength(1);
    expect(component.occurrenceTimeLabel(entry)).not.toContain('2026-10-01T21:30:00Z');
  });

  it('requeries and moves a fixed UTC occurrence to the new account-local day', () => {
    const entry = {
      id: 'occ-1',
      sourceId: 'event-1',
      kind: 'event' as const,
      displayName: 'Late call',
      allDay: false,
      start: '2026-10-02T01:30:00Z',
      end: '2026-10-02T02:30:00Z',
      annualDate: null,
      relatedPeople: [],
    };
    timeZone.set('UTC');
    service.occurrences.mockReturnValue(of({ entries: [entry], unplacedAnnualEntries: [] }));
    const component = TestBed.runInInjectionContext(() => new EventsCalendarComponent());
    component.onDatesSet({
      startStr: '2026-10-01T00:00:00Z',
      endStr: '2026-11-01T00:00:00Z',
      view: { type: 'dayGridMonth' },
    } as DatesSetInfo);
    component.openDay('2026-10-01');
    expect(component.dayEntries()).toEqual([]);
    timeZone.set('Pacific/Honolulu');
    TestBed.tick();
    expect(service.occurrences).toHaveBeenLastCalledWith('2026-10-01', '2026-11-01');
    expect(service.occurrences).toHaveBeenCalledTimes(2);
    expect(component.options().timeZone).toBe('Pacific/Honolulu');
    expect(component.dayEntries()).toEqual([entry]);
    expect(entry.start).toBe('2026-10-02T01:30:00Z');
  });

  it('focuses and closes the day dialog with Escape, restoring the trigger', async () => {
    await TestBed.configureTestingModule({ imports: [EventsCalendarComponent] })
      .overrideComponent(EventsCalendarComponent, {
        remove: { imports: [FullCalendarModule] },
        add: { imports: [StubFullCalendarComponent] },
      })
      .compileComponents();
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const fixture = TestBed.createComponent(EventsCalendarComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    fixture.componentInstance.range.set({
      startDate: '2026-10-01',
      endDate: '2026-11-01',
      viewType: 'dayGridMonth',
    });
    fixture.componentInstance.openDay('2026-10-01');
    fixture.detectChanges();
    await fixture.whenStable();
    const dialog = (fixture.nativeElement as HTMLElement).querySelector(
      '.calendar-dialog[role="dialog"]',
    ) as HTMLElement;
    const close = dialog.querySelector('.btn-close') as HTMLButtonElement;
    expect(document.activeElement).toBe(close);
    close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.calendar-dialog[role="dialog"]'),
    ).toBeNull();
    expect(document.activeElement).toBe(trigger);
    fixture.destroy();
    (fixture.nativeElement as HTMLElement).remove();
    trigger.remove();
  });
});
