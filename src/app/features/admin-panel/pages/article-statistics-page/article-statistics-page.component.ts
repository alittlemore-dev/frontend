import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { ApiError } from '../../../../core/models/api-error.model';
import { LocalizedDatePickerLabels } from '../../../../shared/ui/localized-date-picker/localized-date-picker.component';
import { AdminArticleStats } from '../../models/article-workspace.model';
import { ArticleWorkspaceService } from '../../services/article-workspace.service';
import { AdminArticleStatisticsPanelComponent } from './components/article-statistics-panel/article-statistics-panel.component';
import {
  canonicalQueryMatches,
  readIsoDateQuery,
  replaceAdminQueryParams,
} from '../../utils/admin-query-state';

const ARTICLE_STATISTICS_QUERY_KEYS = ['dateFrom', 'dateTo'] as const;

@Component({
  selector: 'app-admin-article-statistics-page',
  standalone: true,
  imports: [TranslatePipe, AdminArticleStatisticsPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './article-statistics-page.component.html',
})
export class AdminArticleStatisticsPageComponent implements OnInit {
  private readonly articleWorkspace = inject(ArticleWorkspaceService);
  private readonly i18n = inject(I18nService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private currentQueryParams: ParamMap | null = null;
  private skipNextCanonicalLoad: Record<string, string | null> | null = null;
  private appliedDateFrom = '';
  private appliedDateTo = '';

  readonly stats = signal<AdminArticleStats | null>(null);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly dateFrom = signal(formatDateInput(daysBefore(new Date(), 30)));
  readonly dateTo = signal(formatDateInput(new Date()));

  readonly dateLocale = computed(() => this.i18n.dateLocale());
  readonly datePickerLabels = computed<LocalizedDatePickerLabels>(() => {
    this.language();
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
      close: this.i18n.translate('shared.datePicker.close'),
      formatHint: this.i18n.translate('shared.datePicker.formatHint'),
      invalidDate: this.i18n.translate('shared.datePicker.invalidDate'),
      requiredDate: this.i18n.translate('shared.datePicker.requiredDate'),
      keyboardHelp: this.i18n.translate('shared.datePicker.keyboardHelp'),
    };
  });
  readonly language = computed(() => {
    const language = this.i18n.language();
    if (language === null) {
      throw new Error('I18n language is not initialized');
    }
    return language;
  });

  ngOnInit(): void {
    this.setupQueryState();
  }

  setDateFrom(value: string): void {
    this.dateFrom.set(value);
  }

  setDateTo(value: string): void {
    this.dateTo.set(value);
  }

  loadStats(): void {
    if (this.dateFrom().trim() === '' || this.dateTo().trim() === '') return;
    const canonical = { dateFrom: this.dateFrom(), dateTo: this.dateTo() };
    if (
      this.currentQueryParams !== null &&
      canonicalQueryMatches(this.currentQueryParams, ARTICLE_STATISTICS_QUERY_KEYS, canonical)
    ) {
      this.loadAppliedStats();
      return;
    }
    this.appliedDateFrom = canonical.dateFrom;
    this.appliedDateTo = canonical.dateTo;
    this.replaceQueryAndLoad(canonical);
  }

  private setupQueryState(): void {
    const defaultDateFrom = this.dateFrom();
    const defaultDateTo = this.dateTo();
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.currentQueryParams = params;
      const dateFrom = readIsoDateQuery(params, 'dateFrom').value ?? defaultDateFrom;
      const dateTo = readIsoDateQuery(params, 'dateTo').value ?? defaultDateTo;
      const canonical = { dateFrom, dateTo };
      if (
        this.skipNextCanonicalLoad !== null &&
        canonicalQueryMatches(params, ARTICLE_STATISTICS_QUERY_KEYS, this.skipNextCanonicalLoad)
      ) {
        this.skipNextCanonicalLoad = null;
        return;
      }
      this.dateFrom.set(dateFrom);
      this.dateTo.set(dateTo);
      this.appliedDateFrom = dateFrom;
      this.appliedDateTo = dateTo;
      if (!canonicalQueryMatches(params, ARTICLE_STATISTICS_QUERY_KEYS, canonical)) {
        this.replaceQueryAndLoad(canonical);
        return;
      }
      this.loadAppliedStats();
    });
  }

  private loadAppliedStats(): void {
    this.loading.set(true);
    this.error.set(null);
    this.articleWorkspace
      .getAdminStats({
        dateFrom: this.appliedDateFrom,
        dateTo: this.appliedDateTo,
        language: this.language(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (stats) => {
          this.stats.set(stats);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err);
          this.loading.set(false);
        },
      });
  }

  private replaceQueryAndLoad(canonical: Record<string, string>): void {
    this.skipNextCanonicalLoad = canonical;
    void replaceAdminQueryParams(this.router, this.route, canonical);
    this.loadAppliedStats();
  }

  exportStatsCsv(): void {
    const stats = this.stats();
    const urlApi = this.document.defaultView?.URL;
    if (stats === null || urlApi === undefined) return;
    const csv = buildStatsCsv(stats);
    const url = urlApi.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = this.document.createElement('a');
    link.href = url;
    link.download = `articles-stats-${stats.dateFrom}-${stats.dateTo}.csv`;
    link.click();
    urlApi.revokeObjectURL(url);
  }
}

function daysBefore(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

function formatDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildStatsCsv(stats: AdminArticleStats): string {
  const rows = [
    ['title', 'slug', 'views', 'engaged_views', 'heart', 'fire', 'thinking', 'neutral', 'poop'],
    ...stats.articles.map((article) => [
      article.title,
      article.slug,
      String(article.viewCount),
      String(article.engagedViewCount),
      String(article.reactionCounts.heart),
      String(article.reactionCounts.fire),
      String(article.reactionCounts.thinking),
      String(article.reactionCounts.neutral),
      String(article.reactionCounts.poop),
    ]),
  ];
  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n');
}

function escapeCsvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}
