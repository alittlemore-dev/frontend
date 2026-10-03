import {
  EmptyStateComponent,
  ErrorMessageComponent,
  LoadingSpinnerComponent,
  LocalizedDatePickerComponent,
  type LocalizedDatePickerLabels,
} from '@alittlemore.dev/design-system';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  ViewChild,
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
import { RouterLink } from '@angular/router';
import {
  CalendarOptions,
  DateClickInfo,
  DatesSetInfo,
  EventClickInfo,
  FullCalendarComponent,
  FullCalendarModule,
} from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/angular/daygrid';
import interactionPlugin from '@fullcalendar/angular/interaction';
import multiMonthPlugin from '@fullcalendar/angular/multimonth';
import timeGridPlugin from '@fullcalendar/angular/timegrid';
import classicThemePlugin from '@fullcalendar/angular/themes/classic';
import ruLocale from 'fullcalendar/locales/ru';
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
    EmptyStateComponent,
    ErrorMessageComponent,
    LoadingSpinnerComponent,
    LocalizedDatePickerComponent,
    CdkTrapFocus,
    RouterLink,
    TranslatePipe,
    FullCalendarModule,
    EventEditorComponent,
    CalendarEntryCreateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './events-calendar.component.html',
  styleUrl: './events-calendar.component.scss',
})
export class EventsCalendarComponent {
  private readonly service = inject(EventsService);
  private readonly i18n = inject(I18nService);
  private readonly preferences = inject(AccountSettingsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly createButton = viewChild<ElementRef<HTMLButtonElement>>('createButton');
  private loadGeneration = 0;
  private lastLoadedTimeZone: string | null = null;
  @ViewChild(FullCalendarComponent) calendar?: FullCalendarComponent;

  get timeZone(): string {
    return this.preferences.timeZone();
  }
  readonly calendarTitle = signal('');
  readonly activeView = signal('dayGridMonth');
  readonly dateLocale = computed(() => this.i18n.dateLocale());
  readonly pickerDate = signal<string | null>(null);
  readonly datePickerLabels = computed<LocalizedDatePickerLabels>(() => {
    this.i18n.language();
    return {
      placeholder: this.i18n.translate('shared.datePicker.placeholder'),
      openCalendar: this.i18n.translate('workspaceDashboard.calendar.chooseDay'),
      changeCalendar: this.i18n.translate('workspaceDashboard.calendar.chooseDay'),
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
  readonly options = computed<CalendarOptions>(() => {
    const language = this.i18n.language();
    return {
      plugins: [
        classicThemePlugin,
        dayGridPlugin,
        timeGridPlugin,
        multiMonthPlugin,
        interactionPlugin,
      ],
      locales: [ruLocale],
      locale: language ?? 'en',
      firstDay: language === 'en' ? 0 : 1,
      timeZone: this.timeZone,
      initialView: 'dayGridMonth',
      headerToolbar: false,
      height: 'auto',
      slotHeaderFormat: {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        omitZeroMinute: false,
      },
      eventTimeFormat: {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        omitZeroMinute: false,
      },
      buttons: {
        today: { text: this.i18n.translate('workspaceDashboard.calendar.today') },
        dayGridMonth: { text: this.i18n.translate('workspaceDashboard.calendar.view.month') },
        timeGridWeek: { text: this.i18n.translate('workspaceDashboard.calendar.view.week') },
        timeGridDay: { text: this.i18n.translate('workspaceDashboard.calendar.view.day') },
        multiMonthYear: { text: this.i18n.translate('workspaceDashboard.calendar.view.year') },
      },
      slotDuration: '00:30:00',
      slotHeaderInterval: '00:30:00',
      dayMaxEvents: true,
      moreLinkClick: (arg) => {
        const day = Temporal.Instant.from(arg.date.toISOString())
          .toZonedDateTimeISO(this.timeZone)
          .toPlainDate()
          .toString();
        this.openDay(day);
        return 'none';
      },
      datesSet: (arg) => this.onDatesSet(arg),
      dateClick: (arg) => this.onDateClick(arg),
      eventClick: (arg) => this.onEventClick(arg),
      events: this.occurrences().entries.map((entry) => ({
        id: entry.id,
        title: this.entryTitle(entry),
        start: entry.start,
        end: entry.end,
        allDay: entry.allDay,
        classNames: [`workspace-calendar-${entry.kind}`],
      })),
    };
  });

  constructor() {
    effect(() => {
      const timeZone = this.preferences.timeZone();
      if (this.range() && timeZone !== this.lastLoadedTimeZone) {
        untracked(() => this.load());
      }
    });
  }

  onDatesSet(info: DatesSetInfo): void {
    this.calendarTitle.set(info.view.title);
    this.activeView.set(info.view.type);
    const currentDate = info.view.calendar?.getDate();
    this.pickerDate.set(
      currentDate
        ? Temporal.Instant.from(currentDate.toISOString())
            .toZonedDateTimeISO(this.timeZone)
            .toPlainDate()
            .toString()
        : info.startStr.slice(0, 10),
    );
    const range = {
      startDate: info.startStr.slice(0, 10),
      endDate: info.endStr.slice(0, 10),
      viewType: info.view.type,
    };
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

  onDateClick(info: DateClickInfo): void {
    const date = info.dateStr.slice(0, 10);
    if (info.view.type === 'dayGridMonth' || info.view.type === 'multiMonthYear') {
      this.openDay(date);
      return;
    }
    if (info.allDay) {
      this.openCreate({ allDay: true, start: date, end: date });
      return;
    }
    const startInstant = Temporal.Instant.from(info.date.toISOString()).toString();
    const endInstant = Temporal.Instant.from(startInstant).add({ hours: 1 }).toString();
    const start = Temporal.Instant.from(startInstant)
      .toZonedDateTimeISO(this.timeZone)
      .toPlainDateTime()
      .toString({ smallestUnit: 'minute' });
    const end = Temporal.Instant.from(endInstant)
      .toZonedDateTimeISO(this.timeZone)
      .toPlainDateTime()
      .toString({ smallestUnit: 'minute' });
    this.openCreate({
      allDay: false,
      start,
      end,
      startInstant,
      endInstant,
    });
  }

  onEventClick(info: EventClickInfo): void {
    info.jsEvent.preventDefault();
    const entry = this.occurrences().entries.find((item) => item.id === info.event.id);
    if (!entry) return;
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
    if (!date) return;
    this.pickerDate.set(date);
    this.calendar?.getApi().gotoDate(date);
  }

  previous(): void {
    this.calendar?.getApi().prev();
  }

  next(): void {
    this.calendar?.getApi().next();
  }

  today(): void {
    this.calendar?.getApi().today();
  }

  changeView(view: string): void {
    this.calendar?.getApi().changeView(view);
  }

  openDay(date: string): void {
    this.selectedOccurrence.set(null);
    this.selectedDay.set(date);
  }
  closeDay(): void {
    this.selectedDay.set(null);
  }
  closeDetails(): void {
    this.selectedOccurrence.set(null);
    this.selectedEvent.set(null);
    this.eventLoading.set(false);
  }
  showDayEntry(entry: CalendarOccurrence): void {
    this.closeDay();
    this.selectOccurrence(entry);
  }
  openCreate(initial: EventEditorInitial | null = null): void {
    this.closeDay();
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
    this.closeDetails();
    this.editorOpen.set(true);
  }
  closeEditor(): void {
    this.editorOpen.set(false);
    afterNextRender(() => this.createButton()?.nativeElement.focus(), { injector: this.injector });
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
    return entry.kind === 'birthday'
      ? `${this.i18n.translate('workspaceDashboard.dates.type.birthday')} · ${entry.displayName}`
      : entry.displayName;
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
