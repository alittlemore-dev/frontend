import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  LocalizedDateRange,
  LocalizedDateRangePickerComponent,
  LocalizedDateRangePickerLabels,
  LocalizedRangeRequirements,
} from '@alittlemore.dev/design-system';
import { forkJoin, Subscription } from 'rxjs';
import { Temporal } from 'temporal-polyfill';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { ApiError } from '../../../../core/models/api-error.model';
import { AssetGoalSettingsComponent } from '../components/asset-goal-settings.component';
import { AssetReportComponent } from '../components/asset-report.component';
import {
  FinanceStatisticsFiltersComponent,
  STATISTICS_CURRENCIES,
  STATISTICS_PERIODS,
} from '../components/finance-statistics-filters.component';
import { AssetLocation, AssetReport } from '../models/finance-assets.model';
import { FinanceCurrency, FinanceMonth, FinanceStatisticsPeriod } from '../models/finance.model';
import { FinanceAssetsService } from '../services/finance-assets.service';

type AssetPeriod = FinanceStatisticsPeriod | 'range';
function calendarDate(value: string | null): Temporal.PlainDate | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  try {
    return Temporal.PlainDate.from(value);
  } catch {
    return null;
  }
}

@Component({
  selector: 'app-finance-assets-panel',
  imports: [
    TranslatePipe,
    AssetGoalSettingsComponent,
    NgTemplateOutlet,
    FinanceStatisticsFiltersComponent,
    LocalizedDateRangePickerComponent,
    AssetReportComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './finance-assets-panel.component.html',
})
export class FinanceAssetsPanelComponent {
  private readonly api = inject(FinanceAssetsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly i18n = inject(I18nService);
  readonly month = input<FinanceMonth | null>(null);
  readonly readOnly = input(false);
  private readonly goalSettings = viewChild(AssetGoalSettingsComponent);
  readonly fallbackCurrency = input<FinanceCurrency>('RUB');
  readonly selectedMonth = input.required<string>();
  readonly timeZone = input.required<string>();
  readonly today = computed(() => Temporal.Now.plainDateISO(this.timeZone()));
  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly period = computed<AssetPeriod>(() => {
    const query = this.query();
    if (query.get('assetPeriod') === 'range') return 'range';
    if (query.get('assetPeriod') === 'year' && !query.has('period')) return 'thisYear';
    return STATISTICS_PERIODS.find((p) => p === query.get('period')) ?? 'thisMonth';
  });
  readonly currency = computed(
    () => STATISTICS_CURRENCIES.find((c) => c === this.query().get('currency')) ?? 'month',
  );
  private readonly reportCurrency = computed(() => {
    const currency = this.currency();
    return currency === 'month' ? (this.month()?.currency ?? this.fallbackCurrency()) : currency;
  });
  readonly range = computed(() => {
    const today = this.today();
    const month = Temporal.PlainDate.from(this.selectedMonth());
    let start = today,
      end = today;
    switch (this.period()) {
      case 'thisMonth':
        start = month.with({ day: 1 });
        end = month.with({ day: month.daysInMonth });
        break;
      case 'thisYear': {
        const year = this.query().get('assetPeriod') === 'year' ? month : today;
        start = year.with({ month: 1, day: 1 });
        end = year.with({ month: 12, day: 31 });
        break;
      }
      case 'range':
        start = calendarDate(this.query().get('start')) ?? month.with({ day: 1 });
        end = calendarDate(this.query().get('end')) ?? month.with({ day: month.daysInMonth });
        break;
      case 'thisWeek':
        start = today.subtract({ days: today.dayOfWeek - 1 });
        break;
      case 'last7Days':
        start = today.subtract({ days: 6 });
        break;
      case 'last30Days':
        start = today.subtract({ days: 29 });
        break;
      case 'last365Days':
        start = today.subtract({ days: 364 });
        break;
    }
    return {
      start: start.toString(),
      end: Temporal.PlainDate.compare(end, today) > 0 ? today.toString() : end.toString(),
    };
  });
  private readonly requestKey = computed(() =>
    [this.range().start, this.range().end, this.reportCurrency()].join('/'),
  );
  readonly data = signal<{ report: AssetReport; locations: AssetLocation[] } | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  private request?: Subscription;

  constructor() {
    effect(() => {
      this.requestKey();
      untracked(() => {
        // The tracker can revert a history navigation while the user keeps a goal draft.
        if (!this.goalSettings()?.pendingEdit()) this.load();
      });
    });
  }
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
      groupLabel: this.i18n.translate('finance.assets.range'),
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

  load(): void {
    this.request?.unsubscribe();
    this.error.set('');
    this.data.set(null);
    const { start, end } = this.range();
    if (start > end) {
      this.loading.set(false);
      this.error.set('finance.statistics.invalid');
      return;
    }
    this.loading.set(true);
    this.request = forkJoin({
      locations: this.api.locations(),
      report: this.api.report(start, end, this.reportCurrency()),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.data.set(data);
          this.loading.set(false);
        },
        error: (error: ApiError) => {
          this.loading.set(false);
          this.error.set(error.status === 503 ? 'finance.error.rate' : 'finance.error.load');
        },
      });
  }

  leave(): boolean {
    return this.goalSettings()?.leave() !== false;
  }

  selectPeriod(value: string): void {
    if (value === 'range') {
      this.navigate({ assetPeriod: 'range', period: null, ...this.range() });
    } else if (STATISTICS_PERIODS.some((period) => period === value)) {
      this.navigate({ period: value, assetPeriod: null, start: null, end: null });
    }
  }
  selectCurrency(value: string): void {
    if (value === 'month' || STATISTICS_CURRENCIES.some((c) => c === value))
      this.navigate({ currency: value });
  }
  setRange(value: LocalizedDateRange): void {
    if (
      value.start &&
      value.end &&
      value.start <= value.end &&
      value.end <= this.today().toString()
    ) {
      this.navigate({ assetPeriod: 'range', period: null, start: value.start, end: value.end });
    }
  }
  openJournal(value: string): void {
    const date = Temporal.PlainDate.from(value);
    this.navigate({
      tab: 'transactions',
      year: String(date.year),
      month: String(date.month),
      assetJournal: value.slice(0, 7),
      assetReportMonth: this.selectedMonth().slice(0, 7),
      assetPosition: null,
    });
  }
  dateRange(report: AssetReport): string {
    const format = new Intl.DateTimeFormat(this.i18n.dateLocale(), {
      dateStyle: 'medium',
      timeZone: 'UTC',
    });
    return format.formatRange(
      new Date(report.start + 'T00:00:00Z'),
      new Date(report.end + 'T00:00:00Z'),
    );
  }
  private navigate(queryParams: Record<string, string | null>): void {
    if (!this.leave()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParamsHandling: 'merge',
      queryParams,
    });
  }
}
