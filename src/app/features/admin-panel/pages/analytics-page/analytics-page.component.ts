import { DOCUMENT, Location } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
  input,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  LocalizedDatePickerComponent,
  LocalizedDatePickerLabels,
  ErrorMessageComponent,
  LoadingSpinnerComponent,
  EmptyStateComponent,
  SiteSelectComponent,
  SiteSelectOption,
} from '@alittlemore.dev/design-system';
import { filter, forkJoin, of, Subscription } from 'rxjs';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { AnalyticsSource } from '../../../../core/analytics/anonymous-analytics.service';
import { ApiError } from '../../../../core/models/api-error.model';
import { AnalyticsChartComponent } from './analytics-chart.component';
import {
  AnalyticsBucket,
  AnalyticsDaily,
  AnalyticsKind,
  AnalyticsMetric,
  AnalyticsReport,
} from './analytics.model';
import { AnalyticsService } from './analytics.service';
import {
  analyticsPoints,
  analyticsDateFormatter,
  analyticsPointRange,
  formatAnalyticsRange,
  analyticsTotals,
  isoDay,
  periodRange,
  shiftedDay,
  utcDay,
  validRange,
  shiftPeriodRange,
} from './analytics-time';

const SOURCES: readonly AnalyticsSource[] = [
  'Direct',
  'Internal',
  'Search',
  'Social',
  'External',
  'Unknown',
];
const PERIODS = [
  'today',
  'thisWeek',
  'last7Days',
  'last30Days',
  'thisMonth',
  'thisYear',
  'custom',
] as const;
const BUCKETS: readonly AnalyticsBucket[] = ['day', 'week', 'month'];

@Component({
  selector: 'app-analytics-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    LocalizedDatePickerComponent,
    SiteSelectComponent,
    AnalyticsChartComponent,
    ErrorMessageComponent,
    LoadingSpinnerComponent,
    EmptyStateComponent,
  ],
  templateUrl: './analytics-page.component.html',
  styleUrl: './analytics-page.component.scss',
})
export class AnalyticsPageComponent implements OnInit {
  private readonly service = inject(AnalyticsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private requestKey: string | null = null;
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  readonly i18n = inject(I18nService);
  private readonly language$ = toObservable(this.i18n.language);
  private request: Subscription | null = null;
  readonly reactionKinds = ['heart', 'fire', 'thinking', 'neutral', 'poop'] as const;
  readonly reactionEmoji = { heart: '❤️', fire: '🔥', thinking: '🤔', neutral: '😐', poop: '💩' };
  readonly scope = input.required<Exclude<AnalyticsKind, 'Suggestions'>>();
  readonly kind = computed(() => this.scope());
  readonly nextAvailable = computed(
    () =>
      shiftPeriodRange(this.period(), this.dateFrom(), this.dateTo(), 1, isoDay(new Date())) !==
      null,
  );
  readonly period = signal<string>('thisMonth');
  readonly dateFrom = signal(periodRange('thisMonth', isoDay(new Date())).from);
  readonly dateTo = signal(isoDay(new Date()));
  readonly bucket = signal<AnalyticsBucket>('day');
  readonly source = signal('');
  readonly targetId = signal('');
  readonly groupId = signal('');
  readonly sectionId = signal('');
  readonly search = signal('');
  readonly sort = signal<AnalyticsMetric>('views');
  readonly metric = signal<AnalyticsMetric>('views');
  readonly report = signal<AnalyticsReport | null>(null);
  readonly previous = signal<AnalyticsReport | null>(null);
  readonly suggestions = signal<AnalyticsReport | null>(null);
  readonly previousSuggestions = signal<AnalyticsReport | null>(null);
  readonly suggestionRows = computed(() =>
    (this.suggestions()?.daily ?? []).filter(
      (row) => !this.groupId() || row.groupId === this.groupId(),
    ),
  );
  readonly suggestionTotal = computed(() => analyticsTotals(this.suggestionRows()).suggestions);
  readonly suggestionDelta = computed(() => {
    const previous = analyticsTotals(
      (this.previousSuggestions()?.daily ?? []).filter(
        (row) => !this.groupId() || row.groupId === this.groupId(),
      ),
    ).suggestions;
    const delta = this.suggestionTotal() - previous;
    return `${delta > 0 ? '+' : ''}${delta}`;
  });
  readonly suggestionPoints = computed(() => {
    const report = this.suggestions();
    return report
      ? analyticsPoints(
          this.suggestionRows(),
          report.dateFrom,
          report.dateTo,
          this.bucket(),
          'suggestions',
        )
      : [];
  });
  readonly suggestionSheets = computed(() => {
    const sheets = new Map<string, { id: string; label: string; value: number }>();
    for (const row of this.suggestionRows()) {
      const sheet = sheets.get(row.groupId) ?? {
        id: row.groupId,
        label: row.groupTitle || this.i18n.translate('analytics.unassignedSheet'),
        value: 0,
      };
      sheet.value += row.suggestions;
      sheets.set(sheet.id, sheet);
    }
    return [...sheets.values()].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  });
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly invalid = signal(false);
  readonly exportDone = signal(false);
  readonly pickerValidFrom = signal(true);
  readonly pickerValidTo = signal(true);
  readonly rows = computed(() => this.filterRows(this.report()?.daily ?? []));
  readonly totals = computed(() => analyticsTotals(this.rows()));
  readonly previousTotals = computed(() =>
    analyticsTotals(this.filterRows(this.previous()?.daily ?? [])),
  );
  readonly points = computed(() => {
    const report = this.report();
    return report === null
      ? []
      : analyticsPoints(this.rows(), report.dateFrom, report.dateTo, this.bucket(), this.metric());
  });
  readonly reportPeriod = computed(() => {
    const report = this.report();
    return report
      ? formatAnalyticsRange(
          report.dateFrom,
          report.dateTo,
          analyticsDateFormatter(this.i18n.dateLocale()),
        )
      : '';
  });
  readonly chartData = computed(() => {
    const report = this.report();
    if (!report) return [];
    const formatter = analyticsDateFormatter(this.i18n.dateLocale());
    return this.points().map((point) => {
      const { from, to } = analyticsPointRange(
        point.date,
        this.bucket(),
        report.dateFrom,
        report.dateTo,
      );
      return { ...point, period: formatAnalyticsRange(from, to, formatter) };
    });
  });
  readonly tableMetrics = computed(() => this.metrics().filter((metric) => metric !== 'visitors'));
  readonly metrics = computed<readonly AnalyticsMetric[]>(() =>
    this.kind() === 'Site'
      ? ['views', 'engaged', 'visitors']
      : this.kind() === 'Matrix'
        ? ['views', 'engaged']
        : ['views', 'engaged', 'reactions'],
  );
  readonly periodOptions = computed(() => this.options(PERIODS, 'analytics.period'));
  readonly bucketOptions = computed(() => this.options(BUCKETS, 'analytics.bucket'));
  readonly metricOptions = computed(() => this.options(this.metrics(), 'analytics.metric'));
  readonly sourceOptions = computed(() => [
    { value: '', label: this.i18n.translate('analytics.allSources') },
    ...this.options(SOURCES, 'analytics.source'),
  ]);
  readonly targetOptions = computed(() =>
    this.dimensionOptions('targetId', 'title', `analytics.allContent.${this.kind()}`),
  );
  readonly groupOptions = computed(() =>
    this.dimensionOptions('groupId', 'groupTitle', `analytics.allGroups.${this.kind()}`),
  );
  readonly sectionOptions = computed(() =>
    this.dimensionOptions('sectionId', 'sectionTitle', 'analytics.allSections'),
  );
  readonly pageSearch = signal('');
  readonly content = computed(() =>
    this.ranking('targetId', 'title').filter(
      (row) =>
        row.id !== '_audience' &&
        (!this.pageSearch() ||
          row.label.toLocaleLowerCase().includes(this.pageSearch().trim().toLocaleLowerCase())),
    ),
  );
  readonly rankingMetricOptions = computed(() =>
    this.options(this.tableMetrics(), 'analytics.metric'),
  );
  readonly sourceMaximum = computed(() =>
    Math.max(1, ...this.sources().map((row) => row.total[this.metric()])),
  );
  readonly sectionMaximum = computed(() =>
    Math.max(1, ...this.groups().map((row) => row.total[this.metric()])),
  );
  readonly sources = computed(() => this.ranking('source', 'source'));
  readonly groups = computed(() =>
    this.ranking('sectionId', 'sectionTitle').filter((row) => row.id !== ''),
  );
  readonly engagementRate = computed(() =>
    this.totals().views === 0 ? 0 : Math.round((this.totals().engaged / this.totals().views) * 100),
  );
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
      cancel: this.i18n.translate('shared.datePicker.cancel'),
      done: this.i18n.translate('shared.datePicker.done'),
      today: this.i18n.translate('shared.datePicker.today'),
      selectDate: this.i18n.translate('shared.datePicker.selectDate'),
      unavailableDate: this.i18n.translate('shared.datePicker.unavailableDate'),
      formatHint: this.i18n.translate('shared.datePicker.formatHint'),
      invalidDate: this.i18n.translate('shared.datePicker.invalidDate'),
      requiredDate: this.i18n.translate('shared.datePicker.requiredDate'),
      keyboardHelp: this.i18n.translate('shared.datePicker.keyboardHelp'),
    };
  });

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const get = (key: string): string | null => params.get(this.queryKey(key));
      const period = PERIODS.find((value) => value === get('period')) ?? 'thisMonth';
      this.period.set(period);
      const range = periodRange(period, isoDay(new Date()));
      this.dateFrom.set(get('dateFrom') ?? range.from);
      this.dateTo.set(get('dateTo') ?? range.to);
      if (!get('period') && (this.dateFrom() !== range.from || this.dateTo() !== range.to))
        this.period.set('custom');
      this.bucket.set(BUCKETS.find((value) => value === get('bucket')) ?? 'day');
      this.source.set(SOURCES.find((value) => value === get('source')) ?? '');
      this.targetId.set(this.kind() === 'Site' ? '' : (get('targetId') ?? ''));
      this.groupId.set(this.kind() === 'Site' ? '' : (get('groupId') ?? ''));
      this.sectionId.set(this.kind() === 'Matrix' ? (get('sectionId') ?? '') : '');
      this.search.set(this.kind() === 'Site' ? '' : (get('search') ?? ''));
      this.sort.set(
        this.tableMetrics().find((value) => value === get('sort')) ?? this.metrics()[0],
      );
      this.metric.set(this.metrics().find((value) => value === get('metric')) ?? this.metrics()[0]);
      const language = this.i18n.language();
      if (language !== null) this.load(language);
    });
    this.language$
      .pipe(
        filter((language) => language !== null),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((language) => this.load(language));
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
  }

  apply(): void {
    this.invalid.set(
      !this.pickerValidFrom() ||
        !this.pickerValidTo() ||
        !validRange(this.dateFrom(), this.dateTo(), isoDay(new Date())),
    );
    if (this.invalid()) return;
    const queryParams = {
      period: this.period(),
      dateFrom: this.dateFrom(),
      dateTo: this.dateTo(),
      bucket: this.bucket(),
      source: this.source() || null,
      targetId: this.targetId() || null,
      groupId: this.groupId() || null,
      sectionId: this.sectionId() || null,
      search: this.search() || null,
      sort: this.sort(),
      metric: this.metric(),
    };
    const tree = this.router.parseUrl(this.location.path() || this.router.url);
    for (const [key, value] of Object.entries(queryParams)) {
      if (value === null) delete tree.queryParams[this.queryKey(key)];
      else tree.queryParams[this.queryKey(key)] = value;
    }
    delete tree.queryParams['kind'];
    this.location.replaceState(this.router.serializeUrl(tree));
    const language = this.i18n.language();
    if (language !== null) this.load(language);
  }

  refresh(): void {
    const language = this.i18n.language();
    if (language !== null) this.load(language, true);
  }

  selectPeriod(value: string): void {
    if (!PERIODS.some((period) => period === value)) return;
    this.period.set(value);
    if (value === 'thisYear') this.bucket.set('month');
    if (value === 'custom') return;
    const range = periodRange(value, isoDay(new Date()));
    this.dateFrom.set(range.from);
    this.dateTo.set(range.to);
    this.apply();
  }

  shiftPeriod(offset: number): void {
    const range = shiftPeriodRange(
      this.period(),
      this.dateFrom(),
      this.dateTo(),
      offset,
      isoDay(new Date()),
    );
    if (range === null) {
      this.invalid.set(!validRange(this.dateFrom(), this.dateTo(), isoDay(new Date())));
      return;
    }
    this.dateFrom.set(range.from);
    this.dateTo.set(range.to);
    this.apply();
  }

  currentPeriod(): void {
    if (this.period() !== 'custom') {
      this.selectPeriod(this.period());
      return;
    }
    const days = Math.round(
      (utcDay(this.dateTo()).getTime() - utcDay(this.dateFrom()).getTime()) / 86400000,
    );
    if (!Number.isFinite(days) || days < 0) {
      this.invalid.set(true);
      return;
    }
    this.dateTo.set(isoDay(new Date()));
    this.dateFrom.set(shiftedDay(this.dateTo(), -days));
    this.apply();
  }

  changeDate(field: 'from' | 'to', value: string | null): void {
    this.period.set('custom');
    (field === 'from' ? this.dateFrom : this.dateTo).set(value ?? '');
  }

  selectBucket(value: string): void {
    const bucket = BUCKETS.find((bucket) => bucket === value);
    if (bucket !== undefined) {
      this.bucket.set(bucket);
      this.apply();
    }
  }

  selectMetric(value: string): void {
    const metric = this.metrics().find((metric) => metric === value);
    if (metric !== undefined) {
      this.metric.set(metric);
      this.apply();
    }
  }

  selectSort(value: string): void {
    const sort = this.tableMetrics().find((metric) => metric === value);
    if (sort !== undefined) {
      this.sort.set(sort);
      this.apply();
    }
  }

  selectTarget(value: string): void {
    this.targetId.set(value);
    this.apply();
  }
  selectGroup(value: string): void {
    this.groupId.set(value);
    this.sectionId.set('');
    this.targetId.set('');
    this.apply();
  }
  selectSection(value: string): void {
    this.sectionId.set(value);
    this.targetId.set('');
    this.apply();
  }
  selectSource(value: string): void {
    this.source.set(value);
    this.apply();
  }
  resetFilters(): void {
    this.pageSearch.set('');
    this.source.set('');
    this.targetId.set('');
    this.groupId.set('');
    this.sectionId.set('');
    this.search.set('');
    this.apply();
  }
  pageSearchInput(event: Event): void {
    if (event.target instanceof HTMLInputElement) this.pageSearch.set(event.target.value);
  }

  searchInput(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.search.set(event.target.value);
      this.apply();
    }
  }

  delta(metric: AnalyticsMetric): string {
    const diff = this.totals()[metric] - this.previousTotals()[metric];
    return `${diff > 0 ? '+' : ''}${diff}`;
  }

  targetLabel(id: string, title: string): string {
    return this.kind() === 'Site' ? this.i18n.translate(`analytics.page.${id}`) : title;
  }

  exportCsv(): void {
    const report = this.report();
    const urlApi = this.document.defaultView?.URL;
    if (report === null || urlApi === undefined) return;
    const header = [
      'domain',
      'date',
      'target',
      'title',
      'group',
      'section',
      'source',
      'views',
      'engaged',
      'reaction_changes',
      'suggestions',
      'daily_anonymous_browsers',
    ];
    const exportRows = [
      ...this.rows().map((row) => ({ row, kind: this.kind() })),
      ...this.suggestionRows().map((row) => ({ row, kind: 'Suggestions' })),
    ];
    const rows = exportRows.map(({ row, kind }) => [
      kind,
      row.date,
      row.targetId,
      this.targetLabel(row.targetId, row.title),
      row.groupTitle,
      row.sectionTitle,
      row.source,
      row.views,
      row.engaged,
      row.reactions,
      row.suggestions,
      row.visitors,
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => csvCell(String(cell))).join(','))
      .join('\r\n');
    const url = urlApi.createObjectURL(
      new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }),
    );
    const link = this.document.createElement('a');
    link.href = url;
    link.download = `analytics-${this.kind()}-${report.dateFrom}-${report.dateTo}.csv`;
    link.click();
    urlApi.revokeObjectURL(url);
    this.exportDone.set(true);
  }

  private load(language: 'ru' | 'en', force = false): void {
    this.invalid.set(!validRange(this.dateFrom(), this.dateTo(), isoDay(new Date())));
    this.error.set(null);
    this.exportDone.set(false);
    if (this.invalid()) {
      this.request?.unsubscribe();
      this.requestKey = null;
      this.loading.set(false);
      return;
    }
    const key = `${this.kind()}|${this.dateFrom()}|${this.dateTo()}|${language}`;
    if (!force && this.requestKey === key) return;
    this.request?.unsubscribe();
    this.requestKey = key;
    this.loading.set(true);
    const days =
      Math.round((utcDay(this.dateTo()).getTime() - utcDay(this.dateFrom()).getTime()) / 86400000) +
      1;
    this.request = forkJoin({
      suggestions:
        this.kind() === 'Matrix'
          ? this.service.report('Suggestions', this.dateFrom(), this.dateTo(), language)
          : of(null),
      previousSuggestions:
        this.kind() === 'Matrix'
          ? this.service.report(
              'Suggestions',
              shiftedDay(this.dateFrom(), -days),
              shiftedDay(this.dateFrom(), -1),
              language,
            )
          : of(null),
      report: this.service.report(this.kind(), this.dateFrom(), this.dateTo(), language),
      previous: this.service.report(
        this.kind(),
        shiftedDay(this.dateFrom(), -days),
        shiftedDay(this.dateFrom(), -1),
        language,
      ),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ report, previous, suggestions, previousSuggestions }) => {
          this.suggestions.set(suggestions);
          this.previousSuggestions.set(previousSuggestions);
          this.report.set(report);
          this.previous.set(previous);
          this.loading.set(false);
        },
        error: (error: ApiError) => {
          this.requestKey = null;
          this.error.set(error);
          this.loading.set(false);
        },
      });
  }

  private queryKey(key: string): string {
    return this.kind() === 'Site' ? `stats_${key}` : key;
  }

  private options(values: readonly string[], prefix: string): readonly SiteSelectOption[] {
    this.i18n.language();
    return values.map((value) => ({ value, label: this.i18n.translate(`${prefix}.${value}`) }));
  }

  private filterRows(rows: readonly AnalyticsDaily[]): AnalyticsDaily[] {
    const search = this.search().trim().toLocaleLowerCase();
    return rows.filter(
      (row) =>
        (!this.source() || row.source === this.source()) &&
        (!this.targetId() || row.targetId === this.targetId()) &&
        (!this.groupId() || row.groupId === this.groupId()) &&
        (!this.sectionId() || row.sectionId === this.sectionId()) &&
        (!search || this.targetLabel(row.targetId, row.title).toLocaleLowerCase().includes(search)),
    );
  }

  private dimensionOptions(
    id: 'targetId' | 'groupId' | 'sectionId',
    label: 'title' | 'groupTitle' | 'sectionTitle',
    allKey: string,
  ): readonly SiteSelectOption[] {
    this.i18n.language();
    const values = new Map<string, string>();
    for (const row of this.report()?.daily ?? []) {
      if (
        row[id] &&
        row.targetId !== '_audience' &&
        (!this.groupId() || id === 'groupId' || row.groupId === this.groupId()) &&
        (!this.sectionId() || id !== 'targetId' || row.sectionId === this.sectionId())
      )
        values.set(
          row[id],
          id === 'targetId' ? this.targetLabel(row.targetId, row[label]) : row[label],
        );
    }
    return [
      { value: '', label: this.i18n.translate(allKey) },
      ...[...values]
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([value, label]) => ({ value, label })),
    ];
  }

  private ranking(
    id: 'targetId' | 'source' | 'sectionId',
    label: 'title' | 'source' | 'sectionTitle',
  ): {
    id: string;
    label: string;
    context: string;
    total: ReturnType<typeof analyticsTotals>;
    value: number;
    maximum: number;
  }[] {
    const values = new Map<string, { id: string; label: string; rows: AnalyticsDaily[] }>();
    for (const row of this.rows()) {
      let item = values.get(row[id]);
      if (item === undefined) {
        item = {
          id: row[id],
          label: id === 'targetId' ? this.targetLabel(row.targetId, row[label]) : row[label],
          rows: [],
        };
        values.set(row[id], item);
      }
      item.rows.push(row);
    }
    const ranked = [...values.values()].map((item) => ({
      id: item.id,
      label:
        id === 'sectionId'
          ? [item.label, ...new Set(item.rows.map((row) => row.groupTitle).filter(Boolean))].join(
              ' · ',
            )
          : item.label,
      context: [
        ...new Set(item.rows.flatMap((row) => [row.groupTitle, row.sectionTitle]).filter(Boolean)),
      ].join(' · '),
      total: analyticsTotals(item.rows),
      value: analyticsTotals(item.rows)[id === 'targetId' ? this.sort() : this.metric()],
      maximum: 1,
    }));
    const maximum = Math.max(1, ...ranked.map((item) => item.value));
    return ranked
      .map((item) => ({ ...item, maximum }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  }
}

function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
