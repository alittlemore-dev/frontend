import { DOCUMENT } from '@angular/common';
import {
  EmptyStateComponent,
  ErrorMessageComponent,
  LoadingSpinnerComponent,
  LocalizedDatePickerComponent,
  type LocalizedDatePickerLabels,
  IconComponent,
} from '@alittlemore.dev/design-system';
import {
  CalendarComponent,
  MiniCalendarComponent,
  type CalendarEntry,
  type CalendarLabels,
  type CalendarRange,
  type CalendarDateSelection,
  type CalendarView,
  type MiniCalendarLabels,
} from '@alittlemore.dev/design-system/calendar';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  computed,
  effect,
  inject,
  signal,
  untracked,
  output,
  afterNextRender,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Temporal } from 'temporal-polyfill';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { AccountSettingsService } from '../../../../core/auth/account-settings.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { ApiError } from '../../../../core/models/api-error.model';
import { formatAnnualDate } from '../../knowledge/shared/annual-date';
import {
  CalendarOccurrence,
  CalendarOccurrences,
  UnplacedAnnualEntry,
  WorkspaceEvent,
} from '../../models/events.model';
import { EventsService } from '../../services/events.service';
import { EventEditorInitial, nextDate } from '../../utils/event-time';
import { EventEditorComponent } from '../event-editor/event-editor.component';
import { CalendarEntryCreateComponent } from '../calendar-entry-create/calendar-entry-create.component';

interface VisibleRange {
  startDate: string;
  endDate: string;
  viewType: string;
}

@Component({
  selector: 'app-events-calendar',
  standalone: true,
  imports: [
    CalendarComponent,
    MiniCalendarComponent,
    EmptyStateComponent,
    ErrorMessageComponent,
    LoadingSpinnerComponent,
    LocalizedDatePickerComponent,
    IconComponent,
    CdkTrapFocus,
    RouterLink,
    TranslatePipe,
    EventEditorComponent,
    CalendarEntryCreateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './events-calendar.component.html',
  styleUrl: './events-calendar.component.scss',
})
export class EventsCalendarComponent {
  private readonly service = inject(EventsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly document = inject(DOCUMENT);
  private returnDay: string | null = null;
  private readonly initialDate = validDate(this.route.snapshot.queryParamMap.get('date'));
  private readonly initialView = calendarView(
    this.route.snapshot.queryParamMap.get('view'),
    (this.document.defaultView?.innerWidth ?? 1440) < 768,
  );
  private readonly i18n = inject(I18nService);
  private readonly preferences = inject(AccountSettingsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly createButton = viewChild<ElementRef<HTMLButtonElement>>('createButton');
  private loadGeneration = 0;
  private lastLoadedTimeZone: string | null = null;

  get timeZone(): string {
    return this.preferences.timeZone();
  }
  readonly activeView = signal<CalendarView>(this.initialView);
  readonly date = signal(this.initialDate ?? Temporal.Now.plainDateISO(this.timeZone).toString());
  readonly today = computed(() => Temporal.Now.plainDateISO(this.timeZone).toString());
  readonly dateLocale = computed(() => this.i18n.dateLocale());
  readonly calendarLabels = computed<CalendarLabels>(() => {
    this.i18n.language();
    const translate = (key: string): string =>
      this.i18n.translate('workspaceDashboard.calendar.' + key);
    return {
      calendar: translate('title'),
      previous: translate('previous'),
      next: translate('next'),
      today: translate('today'),
      view: translate('view.label'),
      views: {
        month: translate('view.month'),
        week: translate('view.week'),
        day: translate('view.day'),
        agenda: translate('view.list'),
        year: translate('view.year'),
      },
      allDay: translate('allDay'),
      noEvents: this.i18n.translate('workspaceEvents.empty'),
      loading: this.i18n.translate('shared.loading'),
      more: (count) => this.i18n.translate('workspaceDashboard.calendar.more', { count }),
    };
  });
  readonly miniLabels = computed<MiniCalendarLabels>(() => {
    this.i18n.language();
    return {
      calendar: this.i18n.translate('workspaceDashboard.calendar.chooseDay'),
      previousMonth: this.i18n.translate('shared.datePicker.previousMonth'),
      nextMonth: this.i18n.translate('shared.datePicker.nextMonth'),
      keyboardHelp: this.i18n.translate('shared.miniCalendar.keyboardHelp'),
    };
  });
  readonly datePickerLabels = computed<LocalizedDatePickerLabels>(() => {
    this.i18n.language();
    return {
      openCalendar: this.i18n.translate('workspaceDashboard.calendar.chooseDay'),
      changeCalendar: this.i18n.translate('workspaceDashboard.calendar.chooseDay'),
      placeholder: this.i18n.translate('shared.datePicker.placeholder'),
      dialog: this.i18n.translate('shared.datePicker.dialog'),
      previousMonth: this.i18n.translate('shared.datePicker.previousMonth'),
      nextMonth: this.i18n.translate('shared.datePicker.nextMonth'),
      openMonthYearPicker: this.i18n.translate('shared.datePicker.openMonthYearPicker'),
      previousYear: this.i18n.translate('shared.datePicker.previousYear'),
      nextYear: this.i18n.translate('shared.datePicker.nextYear'),
      clear: this.i18n.translate('shared.datePicker.clear'),
      cancel: this.i18n.translate('shared.datePicker.cancel'),
      done: this.i18n.translate('shared.datePicker.done'),
      today: this.i18n.translate('shared.datePicker.today'),
      formatHint: this.i18n.translate('shared.datePicker.formatHint'),
      selectDate: this.i18n.translate('shared.datePicker.selectDate'),
      invalidDate: this.i18n.translate('shared.datePicker.invalidDate'),
      unavailableDate: this.i18n.translate('shared.datePicker.unavailableDate'),
      requiredDate: this.i18n.translate('shared.datePicker.requiredDate'),
      keyboardHelp: this.i18n.translate('shared.datePicker.keyboardHelp'),
    };
  });
  readonly range = signal<VisibleRange | null>(null);
  readonly occurrences = signal<CalendarOccurrences>({ entries: [], unplacedAnnualEntries: [] });
  readonly loading = signal(false);
  readonly hasLoaded = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly calendarFailed = signal(false);
  readonly selectedDay = signal<string | null>(null);
  readonly selectedOccurrence = signal<CalendarOccurrence | null>(null);
  readonly selectedEvent = signal<WorkspaceEvent | null>(null);
  readonly eventLoading = signal(false);
  readonly eventError = signal<ApiError | null>(null);
  readonly editorOpen = signal(false);
  readonly knowledgeCreated = output<void>();
  readonly editorEvent = signal<WorkspaceEvent | null>(null);
  readonly editorInitial = signal<EventEditorInitial | null>(null);
  readonly dayEntries = computed(() => {
    const day = this.selectedDay();
    if (!day) return [];
    const start = Temporal.PlainDate.from(day).toZonedDateTime(this.timeZone).toInstant();
    const end = Temporal.PlainDate.from(nextDate(day)).toZonedDateTime(this.timeZone).toInstant();
    return this.occurrences().entries.filter((entry) =>
      entry.allDay
        ? entry.start <= day && entry.end > day
        : Temporal.Instant.compare(Temporal.Instant.from(entry.start), end) < 0 &&
          Temporal.Instant.compare(Temporal.Instant.from(entry.end), start) > 0,
    );
  });
  readonly dayDetailsReady = computed(() => {
    const day = this.selectedDay();
    return day !== null && !this.loading() && this.rangeContains(day);
  });
  readonly entries = computed<readonly CalendarEntry[]>(() => {
    this.i18n.language();
    return this.occurrences().entries.map((entry) => ({
      id: entry.id,
      title: entry.displayName,
      start: entry.start,
      end: entry.end,
      allDay: entry.allDay,
      typeLabel: this.i18n.translate('workspaceDashboard.calendar.type.' + entry.kind),
      tone:
        entry.kind === 'birthday' ? 'info' : entry.kind === 'memorableDate' ? 'neutral' : 'accent',
      icon:
        entry.kind === 'birthday'
          ? 'people'
          : entry.kind === 'memorableDate'
            ? 'document'
            : 'calendar',
    }));
  });
  readonly markedDates = computed<readonly string[]>(() => {
    const range = this.range();
    if (!range) return [];
    const result = new Set<string>();
    for (const entry of this.occurrences().entries) {
      const start = entry.allDay
        ? entry.start
        : Temporal.Instant.from(entry.start)
            .toZonedDateTimeISO(this.timeZone)
            .toPlainDate()
            .toString();
      const end = entry.allDay
        ? entry.end
        : Temporal.Instant.from(entry.end)
            .subtract({ nanoseconds: 1 })
            .toZonedDateTimeISO(this.timeZone)
            .toPlainDate()
            .add({ days: 1 })
            .toString();
      for (
        let day = start < range.startDate ? range.startDate : start;
        day < end && day < range.endDate;
        day = nextDate(day)
      )
        result.add(day);
    }
    return [...result];
  });

  constructor() {
    effect(() => {
      const timeZone = this.preferences.timeZone();
      if (this.range() && timeZone !== this.lastLoadedTimeZone) {
        untracked(() => this.load());
      }
    });
  }

  onRangeChange(info: CalendarRange): void {
    this.date.set(info.date);
    this.activeView.set(info.view);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { date: info.date, view: CALENDAR_VIEWS[info.view], tab: 'month-calendar' },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    const range = { startDate: info.start, endDate: info.end, viewType: CALENDAR_VIEWS[info.view] };
    const previous = this.range();
    if (
      previous?.startDate === range.startDate &&
      previous.endDate === range.endDate &&
      previous.viewType === range.viewType &&
      this.lastLoadedTimeZone === this.timeZone
    )
      return;
    this.range.set(range);
    this.load();
  }

  retryCalendar(): void {
    this.document.defaultView?.location.reload();
  }

  load(): void {
    const range = this.range();
    if (!range) return;
    this.lastLoadedTimeZone = this.timeZone;
    const generation = ++this.loadGeneration;
    this.loading.set(true);
    this.error.set(null);
    this.service
      .occurrences(range.startDate, range.endDate)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (occurrences) => {
          if (generation !== this.loadGeneration) return;
          this.occurrences.set(occurrences);
          this.hasLoaded.set(true);
          this.loading.set(false);
        },
        error: (error: ApiError) => {
          if (generation !== this.loadGeneration) return;
          this.error.set(error);
          this.loading.set(false);
        },
      });
  }

  onDateSelected(info: CalendarDateSelection): void {
    if (this.activeView() === 'month' || this.activeView() === 'year' || info.allDay) {
      this.openDay(info.date);
      return;
    }
    const startInstant = Temporal.Instant.from(info.start).toString();
    const endInstant = Temporal.Instant.from(startInstant).add({ hours: 1 }).toString();
    const start = Temporal.Instant.from(startInstant)
      .toZonedDateTimeISO(this.timeZone)
      .toPlainDateTime()
      .toString({ smallestUnit: 'minute' });
    const end = Temporal.Instant.from(endInstant)
      .toZonedDateTimeISO(this.timeZone)
      .toPlainDateTime()
      .toString({ smallestUnit: 'minute' });
    this.openCreate({ allDay: false, start, end, startInstant, endInstant });
  }
  onEntrySelected(info: CalendarEntry): void {
    const entry = this.occurrences().entries.find((item) => item.id === info.id);
    if (!entry) return;
    this.returnDay = null;
    this.selectOccurrence(entry);
  }

  private selectOccurrence(entry: CalendarOccurrence): void {
    this.selectedDay.set(null);
    this.selectedOccurrence.set(entry);
    this.selectedEvent.set(null);
    this.eventError.set(null);
    if (entry.kind !== 'event') return;
    this.eventLoading.set(true);
    this.service
      .get(entry.sourceId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (event) => {
          if (this.selectedOccurrence()?.id !== entry.id) return;
          this.selectedEvent.set(event);
          this.eventLoading.set(false);
        },
        error: (error: ApiError) => {
          if (this.selectedOccurrence()?.id !== entry.id) return;
          this.eventError.set(error);
          this.eventLoading.set(false);
        },
      });
  }

  goToDate(date: string | null): void {
    if (date) this.date.set(date);
  }

  openDay(date: string): void {
    this.returnDay = null;
    this.selectedOccurrence.set(null);
    this.selectedDay.set(date);
  }
  closeDay(): void {
    this.selectedDay.set(null);
    this.returnDay = null;
  }
  closeDetails(): void {
    this.clearDetails();
    if (this.returnDay) this.selectedDay.set(this.returnDay);
  }
  hasReturnDay(): boolean {
    return this.returnDay !== null;
  }
  private clearDetails(): void {
    this.selectedOccurrence.set(null);
    this.selectedEvent.set(null);
    this.eventLoading.set(false);
  }
  showDayEntry(entry: CalendarOccurrence): void {
    if (this.selectedDay()) this.returnDay = this.selectedDay();
    this.selectedDay.set(null);
    this.selectOccurrence(entry);
  }
  openCreate(initial: EventEditorInitial | null = null): void {
    this.returnDay = this.selectedDay();
    this.selectedDay.set(null);
    this.clearDetails();
    this.editorEvent.set(null);
    this.editorInitial.set(initial);
    this.editorOpen.set(true);
  }
  createOnSelectedDay(): void {
    const day = this.selectedDay();
    if (day) this.openCreate({ allDay: true, start: day, end: day });
  }
  onKnowledgeSaved(): void {
    this.closeEditor();
    this.load();
    this.knowledgeCreated.emit();
  }
  openEdit(): void {
    const event = this.selectedEvent();
    if (!event) return;
    this.editorEvent.set(event);
    this.editorInitial.set(null);
    this.clearDetails();
    this.editorOpen.set(true);
  }
  closeEditor(): void {
    this.editorOpen.set(false);
    if (this.returnDay) this.selectedDay.set(this.returnDay);
    else
      afterNextRender(() => this.createButton()?.nativeElement.focus(), {
        injector: this.injector,
      });
  }
  onSaved(): void {
    this.closeEditor();
    this.load();
  }
  entryRoute(entry: CalendarOccurrence | UnplacedAnnualEntry): readonly string[] {
    return entry.kind === 'memorableDate'
      ? ['/personal-workspace/knowledge/dates', entry.sourceId]
      : ['/personal-workspace/knowledge/people', entry.sourceId];
  }
  entryTitle(entry: CalendarOccurrence | UnplacedAnnualEntry): string {
    return `${this.i18n.translate('workspaceDashboard.calendar.type.' + entry.kind)} · ${entry.displayName}`;
  }
  annualLabel(entry: CalendarOccurrence | UnplacedAnnualEntry): string {
    if (!entry.annualDate) return '';
    return formatAnnualDate(entry.annualDate, this.i18n.dateLocale());
  }

  private rangeContains(date: string): boolean {
    const range = this.range();
    return range !== null && date >= range.startDate && date < range.endDate;
  }

  occurrenceTimeLabel(entry: CalendarOccurrence): string {
    if (entry.allDay) {
      const formatter = new Intl.DateTimeFormat(this.i18n.dateLocale(), {
        dateStyle: 'medium',
        timeZone: 'UTC',
      });
      const endIncluded = Temporal.PlainDate.from(entry.end).subtract({ days: 1 }).toString();
      const startLabel = formatter.format(new Date(`${entry.start}T00:00:00Z`));
      return entry.start === endIncluded
        ? startLabel
        : `${startLabel} – ${formatter.format(new Date(`${endIncluded}T00:00:00Z`))}`;
    }
    const formatter = new Intl.DateTimeFormat(this.i18n.dateLocale(), {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: this.timeZone,
    });
    return `${formatter.format(new Date(entry.start))} – ${formatter.format(new Date(entry.end))}`;
  }
}

const CALENDAR_VIEWS: Readonly<Record<CalendarView, string>> = {
  month: 'dayGridMonth',
  week: 'timeGridWeek',
  day: 'timeGridDay',
  year: 'multiMonthYear',
  agenda: 'listWeek',
};
function calendarView(value: string | null, mobile: boolean): CalendarView {
  return (
    (Object.entries(CALENDAR_VIEWS).find(
      ([view, legacy]) => value === view || value === legacy,
    )?.[0] as CalendarView | undefined) ?? (mobile ? 'agenda' : 'month')
  );
}
function validDate(value: string | null): string | null {
  try {
    return value && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? Temporal.PlainDate.from(value, { overflow: 'reject' }).toString()
      : null;
  } catch {
    return null;
  }
}
