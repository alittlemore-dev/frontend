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
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { SiteSelectComponent, SiteSelectOption } from '@alittlemore.dev/design-system';
import { Subscription } from 'rxjs';
import { formatFinanceDate, financePeriodEnd } from '../utils/finance-time';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { ApiError } from '../../../../core/models/api-error.model';
import { FinanceStatisticsReportComponent } from './finance-statistics-report.component';
import {
  FinanceCurrency,
  FinanceKind,
  FinanceStatisticsResult,
  FinanceStatisticsCurrency,
  FINANCE_CURRENCY_SYMBOLS,
  FinanceStatisticsPeriod,
} from '../models/finance.model';
import { FinanceService } from '../services/finance.service';

const PERIODS: readonly FinanceStatisticsPeriod[] = [
  'thisMonth',
  'thisYear',
  'thisWeek',
  'today',
  'last7Days',
  'last30Days',
  'last365Days',
];
const CURRENCIES: readonly FinanceCurrency[] = ['AMD', 'RUB', 'USD', 'EUR'];

@Component({
  selector: 'app-finance-statistics-panel',
  standalone: true,
  imports: [TranslatePipe, SiteSelectComponent, FinanceStatisticsReportComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './finance-statistics-panel.component.html',
  styleUrl: './finance-statistics-panel.component.scss',
})
export class FinanceStatisticsPanelComponent {
  private readonly service = inject(FinanceService);
  readonly i18n = inject(I18nService);
  readonly selectedMonth = input.required<string>();
  readonly timeZone = input.required<string>();
  readonly tab = input<'summary' | FinanceKind>('summary');
  readonly revision = input(0);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  private readonly filterKey = computed(() =>
    JSON.stringify([this.query().getAll('period'), this.query().getAll('currency')]),
  );
  private request?: Subscription;
  readonly statistics = signal<FinanceStatisticsResult | null>(null);
  readonly reportTimeZone = computed(
    () => this.statistics()?.reports[0]?.monthly?.timezoneName ?? this.timeZone(),
  );
  readonly loading = signal(true);
  readonly errorKey = signal<string | null>(null);
  readonly empty = signal(false);
  readonly notice = signal(false);
  readonly period = computed(
    () => PERIODS.find((value) => value === this.query().get('period')) ?? 'thisMonth',
  );
  readonly currency = computed<FinanceStatisticsCurrency>(
    () => CURRENCIES.find((value) => value === this.query().get('currency')) ?? 'month',
  );
  readonly currencyOptions = computed<readonly SiteSelectOption[]>(() => {
    this.i18n.language();
    return [
      { value: 'month', label: this.i18n.translate('finance.statistics.currency.month') },
      ...CURRENCIES.map((value) => ({ value, label: FINANCE_CURRENCY_SYMBOLS[value] })),
    ];
  });
  readonly periodOptions = computed<readonly SiteSelectOption[]>(() => {
    this.i18n.language();
    return PERIODS.map((value) => ({
      value,
      label: this.i18n.translate(`finance.statistics.period.${value}`),
    }));
  });

  constructor() {
    effect(() => {
      this.filterKey();
      this.selectedMonth();
      this.timeZone();
      this.revision();
      untracked(() => this.load());
    });
  }

  load(): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.errorKey.set(null);
    this.empty.set(false);
    this.statistics.set(null);
    const query = this.query();
    const invalid =
      (query.has('period') &&
        (query.get('period') !== this.period() || query.getAll('period').length !== 1)) ||
      (query.has('currency') &&
        (query.get('currency') !== this.currency() || query.getAll('currency').length !== 1));
    this.notice.set(invalid);
    if (invalid) {
      void this.router.navigate([], {
        relativeTo: this.route,
        replaceUrl: true,
        queryParamsHandling: 'merge',
        queryParams: { period: this.period(), currency: this.currency() },
      });
      return;
    }
    this.request = this.service
      .statistics(
        this.period(),
        this.currency(),
        this.period() === 'thisMonth' ? this.selectedMonth() : undefined,
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.statistics.set(data);
          this.loading.set(false);
        },
        error: (error: ApiError) => {
          if (error.status === 404) this.empty.set(true);
          else
            this.errorKey.set(error.status === 503 ? 'finance.error.rate' : 'finance.error.load');
          this.loading.set(false);
        },
      });
  }

  selectPeriod(value: string): void {
    if (!PERIODS.some((period) => period === value)) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParamsHandling: 'merge',
      queryParams: { period: value },
    });
  }

  selectCurrency(value: string): void {
    if (value !== 'month' && !CURRENCIES.some((currency) => currency === value)) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParamsHandling: 'merge',
      queryParams: { currency: value },
    });
  }

  panelIds(tab: string): string {
    return (this.statistics()?.reports ?? [])
      .map((report) => `finance-statistics-panel-${tab}-${report.currency}`)
      .join(' ');
  }

  date(value: string): string {
    return formatFinanceDate(value, this.i18n.dateLocale(), this.reportTimeZone());
  }
  periodEnd(value: string): string {
    return financePeriodEnd(value, this.i18n.dateLocale(), this.reportTimeZone());
  }
}
