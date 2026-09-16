import { ErrorMessageComponent, LoadingSpinnerComponent } from '@alittlemore.dev/design-system';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { ApiError } from '../../../../core/models/api-error.model';

import { Calendar, CalendarEntry } from '../../models/calendar.model';
import { CalendarService } from '../../services/calendar.service';

interface CalendarGridCell {
  day: number | null;
  entries: readonly CalendarEntry[];
}

interface MonthOption {
  monthIndex: number;
  label: string;
}

@Component({
  selector: 'app-month-calendar-widget',
  standalone: true,
  imports: [RouterLink, TranslatePipe, ErrorMessageComponent, LoadingSpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './month-calendar-widget.component.html',
  styleUrl: './month-calendar-widget.component.scss',
})
export class MonthCalendarWidgetComponent implements OnInit {
  private readonly service = inject(CalendarService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly initialDate = new Date();
  private loadGeneration = 0;

  readonly summaryChange = output<string>();
  readonly selectedYear = signal(this.initialDate.getFullYear());
  readonly selectedMonthIndex = signal(this.initialDate.getMonth());
  readonly chooserOpen = signal(false);
  readonly chooserYear = signal(this.initialDate.getFullYear());
  readonly calendar = signal<Calendar | null>(null);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);

  readonly monthLabel = computed(() => {
    this.i18n.language();
    return new Intl.DateTimeFormat(this.i18n.dateLocale(), {
      month: 'long',
      year: 'numeric',
    }).format(new Date(this.selectedYear(), this.selectedMonthIndex(), 1));
  });
  readonly summary = computed(() => {
    this.i18n.language();
    const counts = this.calendar()?.summary;
    return `${this.monthLabel()} · ${this.i18n.translate('workspaceDashboard.dates.type.memorableDate')}: ${counts?.memorableDateCount ?? 0} · ${this.i18n.translate('workspaceDashboard.dates.type.birthday')}: ${counts?.birthdayCount ?? 0}`;
  });
  readonly weekdayLabels = computed(() => {
    this.i18n.language();
    const weekStart = this.i18n.language() === 'en' ? 0 : 1;
    return Array.from({ length: 7 }, (_, offset) => {
      const weekday = (weekStart + offset) % 7;
      const date = new Date(2026, 7, 2 + weekday);
      return {
        short: new Intl.DateTimeFormat(this.i18n.dateLocale(), { weekday: 'short' }).format(date),
        long: new Intl.DateTimeFormat(this.i18n.dateLocale(), { weekday: 'long' }).format(date),
      };
    });
  });
  readonly monthOptions = computed<readonly MonthOption[]>(() => {
    this.i18n.language();
    return Array.from({ length: 12 }, (_, monthIndex) => ({
      monthIndex,
      label: new Intl.DateTimeFormat(this.i18n.dateLocale(), { month: 'long' }).format(
        new Date(this.chooserYear(), monthIndex, 1),
      ),
    }));
  });
  readonly gridRows = computed<readonly (readonly CalendarGridCell[])[]>(() => {
    const year = this.selectedYear();
    const monthIndex = this.selectedMonthIndex();
    const entriesByDay = new Map<number, CalendarEntry[]>();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    for (const entry of this.calendar()?.entries ?? []) {
      if (entry.annualDate.day > daysInMonth) continue;
      const entries = entriesByDay.get(entry.annualDate.day) ?? [];
      entries.push(entry);
      entriesByDay.set(entry.annualDate.day, entries);
    }
    const weekStart = this.i18n.language() === 'en' ? 0 : 1;
    const leadingCells = (new Date(year, monthIndex, 1).getDay() - weekStart + 7) % 7;
    const cells: CalendarGridCell[] = Array.from({ length: leadingCells }, () => ({
      day: null,
      entries: [],
    }));
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({ day, entries: entriesByDay.get(day) ?? [] });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ day: null, entries: [] });
    }
    const rows: CalendarGridCell[][] = [];
    for (let index = 0; index < cells.length; index += 7) {
      rows.push(cells.slice(index, index + 7));
    }
    return rows;
  });
  readonly noDayEntries = computed<readonly CalendarEntry[]>(() => {
    const daysInMonth = new Date(this.selectedYear(), this.selectedMonthIndex() + 1, 0).getDate();
    return (this.calendar()?.entries ?? []).filter((entry) => entry.annualDate.day > daysInMonth);
  });

  constructor() {
    effect(() => this.summaryChange.emit(this.summary()));
  }

  ngOnInit(): void {
    this.loadSelectedMonth();
  }

  loadSelectedMonth(): void {
    const generation = ++this.loadGeneration;
    this.calendar.set(null);
    this.loading.set(true);
    this.error.set(null);
    this.service
      .getCalendar(referenceDate(this.selectedYear(), this.selectedMonthIndex()), 'month')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (calendar) => {
          if (generation !== this.loadGeneration) return;
          this.calendar.set(calendar);
          this.loading.set(false);
        },
        error: (error: ApiError) => {
          if (generation !== this.loadGeneration) return;
          this.error.set(error);
          this.loading.set(false);
        },
      });
  }

  showPreviousMonth(): void {
    this.selectAdjacentMonth(-1);
  }

  showNextMonth(): void {
    this.selectAdjacentMonth(1);
  }

  toggleMonthChooser(): void {
    if (!this.chooserOpen()) {
      this.chooserYear.set(this.selectedYear());
    }
    this.chooserOpen.update((open) => !open);
  }

  showPreviousChooserYear(): void {
    this.chooserYear.update((year) => year - 1);
  }

  showNextChooserYear(): void {
    this.chooserYear.update((year) => year + 1);
  }

  chooseMonth(monthIndex: number): void {
    this.selectedYear.set(this.chooserYear());
    this.selectedMonthIndex.set(monthIndex);
    this.chooserOpen.set(false);
    this.loadSelectedMonth();
  }

  isToday(day: number | null): boolean {
    if (day === null) return false;
    const today = new Date();
    return (
      today.getFullYear() === this.selectedYear() &&
      today.getMonth() === this.selectedMonthIndex() &&
      today.getDate() === day
    );
  }

  entryRoute(entry: CalendarEntry): readonly string[] {
    if (entry.kind === 'memorableDate') {
      return ['/personal-workspace/knowledge/dates', entry.id];
    }
    return ['/personal-workspace/knowledge/people', entry.id];
  }

  private selectAdjacentMonth(offset: -1 | 1): void {
    const adjacent = new Date(this.selectedYear(), this.selectedMonthIndex() + offset, 1);
    this.selectedYear.set(adjacent.getFullYear());
    this.selectedMonthIndex.set(adjacent.getMonth());
    this.chooserOpen.set(false);
    this.loadSelectedMonth();
  }
}

function referenceDate(year: number, monthIndex: number): string {
  return `${String(year).padStart(4, '0')}-${String(monthIndex + 1).padStart(2, '0')}-01`;
}
