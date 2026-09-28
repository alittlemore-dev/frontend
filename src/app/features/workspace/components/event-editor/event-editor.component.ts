import {
  LocalizedDatePickerComponent,
  LocalizedDatePickerLabels,
  LocalizedDateRange,
  LocalizedDateRangePickerComponent,
  LocalizedDateRangePickerLabels,
  LocalizedDateTimeRange,
  LocalizedDateTimeRangePickerComponent,
  LocalizedDateTimeRangePickerLabels,
  LocalizedRangeRequirements,
  NotificationService,
} from '@alittlemore.dev/design-system';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { AccountSettingsService } from '../../../../core/auth/account-settings.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import {
  UnsavedChangesService,
  UnsavedChangesSource,
} from '../../../../core/unsaved-changes/unsaved-changes.service';
import { EventFrequency, WorkspaceEvent } from '../../models/events.model';
import {
  draftToPayload,
  EventDraft,
  EventEditorInitial,
  ExactEventInstants,
  eventToDraft,
} from '../../utils/event-time';
import { EventsService } from '../../services/events.service';

interface EventFormValue extends Omit<EventDraft, 'start' | 'end' | 'untilDate'> {
  dateRange: LocalizedDateRange;
  dateTimeRange: LocalizedDateTimeRange;
  untilDate: string | null;
}

@Component({
  selector: 'app-event-editor',
  standalone: true,
  imports: [
    CdkTrapFocus,
    LocalizedDatePickerComponent,
    LocalizedDateRangePickerComponent,
    LocalizedDateTimeRangePickerComponent,
    ReactiveFormsModule,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './event-editor.component.html',
  styleUrl: './event-editor.component.scss',
})
export class EventEditorComponent {
  private readonly service = inject(EventsService);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18nService);
  private readonly preferences = inject(AccountSettingsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly unsavedScope = inject(UnsavedChangesService).createScope(this.destroyRef);
  private readonly unsavedSource: UnsavedChangesSource;
  private exactBaseline: { value: EventFormValue; instants: ExactEventInstants } | null = null;

  readonly event = input<WorkspaceEvent | null>(null);
  readonly initial = input<EventEditorInitial | null>(null);
  readonly saved = output<WorkspaceEvent>();
  readonly closed = output<void>();
  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly validationError = signal<string | null>(null);
  readonly snapshot = signal<EventFormValue>(this.emptyForm());
  readonly active = signal(true);
  readonly dateLocale = computed(() => this.i18n.dateLocale());
  readonly datePickerLabels = computed<LocalizedDatePickerLabels>(() => {
    this.i18n.language();
    return {
      placeholder: this.i18n.translate('shared.datePicker.placeholder'),
      openCalendar: this.i18n.translate('shared.datePicker.open'),
      changeCalendar: this.i18n.translate('shared.datePicker.change'),
      dialog: this.i18n.translate('shared.datePicker.dialog'),
      previousMonth: this.i18n.translate('shared.datePicker.previousMonth'),
      nextMonth: this.i18n.translate('shared.datePicker.nextMonth'),
      openMonthYearPicker: this.i18n.translate('shared.datePicker.openMonthYearPicker'),
      previousYear: this.i18n.translate('shared.datePicker.previousYear'),
      nextYear: this.i18n.translate('shared.datePicker.nextYear'),
      clear: this.i18n.translate('shared.datePicker.clear'),
      done: this.i18n.translate('shared.datePicker.done'),
      today: this.i18n.translate('shared.datePicker.today'),
      selectDate: this.i18n.translate('shared.datePicker.selectDate'),
      unavailableDate: this.i18n.translate('shared.datePicker.unavailableDate'),
      cancel: this.i18n.translate('shared.datePicker.cancel'),
      formatHint: this.i18n.translate('shared.datePicker.formatHint'),
      invalidDate: this.i18n.translate('shared.datePicker.invalidDate'),
      requiredDate: this.i18n.translate('shared.datePicker.requiredDate'),
      keyboardHelp: this.i18n.translate('shared.datePicker.keyboardHelp'),
    };
  });
  readonly rangeRequirements: LocalizedRangeRequirements = {
    start: true,
    end: true,
    paired: true,
  };
  readonly dateRangeLabels = computed<LocalizedDateRangePickerLabels>(() => {
    this.i18n.language();
    return {
      placeholder: this.i18n.translate('shared.datePicker.placeholder'),
      openPicker: this.i18n.translate('shared.datePicker.open'),
      changeValue: this.i18n.translate('shared.datePicker.change'),
      dialog: this.i18n.translate('shared.datePicker.dialog'),
      groupLabel: this.rangeGroupLabel(),
      startDate: this.i18n.translate('workspaceEvents.start'),
      endDate: this.i18n.translate('workspaceEvents.end'),
      selectStartDate: this.i18n.translate('workspaceEvents.range.selectStart'),
      selectEndDate: this.i18n.translate('workspaceEvents.range.selectEnd'),
      accessibleRangeSeparator: this.i18n.translate('workspaceEvents.range.separator'),
      announceRangePreview: (start, end) =>
        this.i18n.translate('workspaceEvents.range.preview', { start, end }),
      previousMonth: this.i18n.translate('shared.datePicker.previousMonth'),
      nextMonth: this.i18n.translate('shared.datePicker.nextMonth'),
      openMonthYearPicker: this.i18n.translate('shared.datePicker.openMonthYearPicker'),
      previousYear: this.i18n.translate('shared.datePicker.previousYear'),
      nextYear: this.i18n.translate('shared.datePicker.nextYear'),
      clear: this.i18n.translate('shared.datePicker.clear'),
      cancel: this.i18n.translate('shared.datePicker.cancel'),
      done: this.i18n.translate('shared.datePicker.done'),
      today: this.i18n.translate('shared.datePicker.today'),
      dateFormatHint: this.i18n.translate('shared.datePicker.formatHint'),
      keyboardHelp: this.i18n.translate('shared.datePicker.keyboardHelp'),
      invalidRange: this.i18n.translate('workspaceEvents.invalidRange'),
      unavailableRange: this.i18n.translate('shared.datePicker.unavailableDate'),
      requiredRange: this.i18n.translate('workspaceEvents.required'),
    };
  });
  readonly dateTimeRangeLabels = computed<LocalizedDateTimeRangePickerLabels>(() => {
    const dates = this.dateRangeLabels();
    return {
      ...dates,
      startDateTime: this.i18n.translate('workspaceEvents.start'),
      endDateTime: this.i18n.translate('workspaceEvents.end'),
      selectStartDateTime: this.i18n.translate('workspaceEvents.range.selectStart'),
      selectEndDateTime: this.i18n.translate('workspaceEvents.range.selectEnd'),
      hour: this.i18n.translate('workspaceEvents.range.hour'),
      minute: this.i18n.translate('workspaceEvents.range.minute'),
      timeFormatHint: this.i18n.translate('workspaceEvents.range.timeFormatHint'),
      now: this.i18n.translate('workspaceEvents.range.now'),
    };
  });
  readonly frequencies: readonly EventFrequency[] = [
    'none',
    'daily',
    'weekly',
    'monthly',
    'yearly',
  ];
  readonly form = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(255)],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(2000)],
    }),
    allDay: new FormControl(false, { nonNullable: true }),
    dateRange: new FormControl<LocalizedDateRange>(
      { start: null, end: null },
      { nonNullable: true },
    ),
    dateTimeRange: new FormControl<LocalizedDateTimeRange>(
      { start: null, end: null },
      { nonNullable: true },
    ),
    frequency: new FormControl<EventFrequency>('none', { nonNullable: true }),
    untilDate: new FormControl<string | null>(null),
  });

  constructor() {
    this.setActiveRange(false);
    this.unsavedSource = this.unsavedScope.registerSource(this.snapshot, this.active);
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.snapshot.set(this.form.getRawValue()));
    this.form.controls.allDay.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((allDay) => this.convertRangeForMode(allDay));
    effect(() => {
      const event = this.event();
      const initial = this.initial();
      const timeZone = untracked(() => this.preferences.timeZone());
      const value = event
        ? eventToDraft(event, timeZone)
        : {
            ...this.emptyDraft(),
            ...(initial
              ? {
                  allDay: initial.allDay,
                  start: initial.start,
                  end: initial.end,
                }
              : {}),
          };
      const formValue = this.toFormValue(value);
      const instants =
        event && !event.allDay
          ? { start: event.start, end: event.end }
          : initial && !initial.allDay && initial.startInstant && initial.endInstant
            ? { start: initial.startInstant, end: initial.endInstant }
            : null;
      this.exactBaseline = instants ? { value: formValue, instants } : null;
      this.form.setValue(formValue, { emitEvent: false });
      this.setActiveRange(formValue.allDay);
      this.snapshot.set(formValue);
      untracked(() => this.unsavedSource.commit());
    });
  }

  close(): void {
    if (this.submitting()) return;
    if (!this.unsavedScope.confirmDiscard()) return;
    this.active.set(false);
    this.closed.emit();
  }

  submit(): void {
    this.submitted.set(true);
    this.validationError.set(null);
    if (this.form.controls.title.hasError('maxlength')) {
      this.validationError.set('workspaceEvents.titleTooLong');
      return;
    }
    if (this.form.controls.description.hasError('maxlength')) {
      this.validationError.set('workspaceEvents.descriptionTooLong');
      return;
    }
    if (this.form.invalid || !this.form.controls.title.value.trim()) {
      this.validationError.set('workspaceEvents.required');
      return;
    }
    let payload;
    try {
      const value = this.form.getRawValue();
      const baseline = this.exactBaseline;
      const exact =
        baseline && !value.allDay
          ? {
              start:
                value.dateTimeRange.start === baseline.value.dateTimeRange.start
                  ? baseline.instants.start
                  : undefined,
              end:
                value.dateTimeRange.end === baseline.value.dateTimeRange.end
                  ? baseline.instants.end
                  : undefined,
            }
          : undefined;
      payload = draftToPayload(this.toDraft(value), this.preferences.timeZone(), exact);
    } catch {
      this.validationError.set('workspaceEvents.invalidRange');
      return;
    }
    this.submitting.set(true);
    const request = this.event()
      ? this.service.update(this.event()!.id, payload)
      : this.service.create(payload);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (saved) => {
        this.submitting.set(false);
        this.unsavedSource.commit();
        this.active.set(false);
        this.notifications.success(this.i18n.translate('workspaceEvents.saved'));
        this.saved.emit(saved);
      },
      error: () => {
        this.submitting.set(false);
        this.notifications.error(this.i18n.translate('workspaceEvents.saveError'));
      },
    });
  }

  private emptyDraft(): EventDraft {
    return {
      title: '',
      description: '',
      allDay: false,
      start: '',
      end: '',
      frequency: 'none',
      untilDate: '',
    };
  }

  private emptyForm(): EventFormValue {
    return this.toFormValue(this.emptyDraft());
  }

  private toFormValue(value: EventDraft): EventFormValue {
    const { start, end, untilDate, ...other } = value;
    return {
      ...other,
      dateRange: { start: start.slice(0, 10) || null, end: end.slice(0, 10) || null },
      dateTimeRange: {
        start: start.includes('T') ? start : start ? `${start}T09:00` : null,
        end: end.includes('T') ? end : end ? `${end}T10:00` : null,
      },
      untilDate: untilDate || null,
    };
  }

  private toDraft(value: EventFormValue): EventDraft {
    const { dateRange, dateTimeRange, untilDate, ...other } = value;
    return {
      ...other,
      start: (value.allDay ? dateRange.start : dateTimeRange.start) ?? '',
      end: (value.allDay ? dateRange.end : dateTimeRange.end) ?? '',
      untilDate: untilDate ?? '',
    };
  }

  private rangeGroupLabel(): string {
    return `${this.i18n.translate('workspaceEvents.start')} – ${this.i18n.translate('workspaceEvents.end')}`;
  }

  private convertRangeForMode(allDay: boolean): void {
    if (allDay) {
      const timed = this.form.controls.dateTimeRange.value;
      this.form.controls.dateRange.setValue(
        { start: timed.start?.slice(0, 10) ?? null, end: timed.end?.slice(0, 10) ?? null },
        { emitEvent: false },
      );
    } else {
      const dates = this.form.controls.dateRange.value;
      this.form.controls.dateTimeRange.setValue(
        {
          start: dates.start ? `${dates.start}T09:00` : null,
          end: dates.end ? `${dates.end}T10:00` : null,
        },
        { emitEvent: false },
      );
    }
    this.setActiveRange(allDay);
    this.snapshot.set(this.form.getRawValue());
  }

  private setActiveRange(allDay: boolean): void {
    if (allDay) {
      this.form.controls.dateTimeRange.disable({ emitEvent: false });
      this.form.controls.dateRange.enable({ emitEvent: false });
    } else {
      this.form.controls.dateRange.disable({ emitEvent: false });
      this.form.controls.dateTimeRange.enable({ emitEvent: false });
    }
  }
}
