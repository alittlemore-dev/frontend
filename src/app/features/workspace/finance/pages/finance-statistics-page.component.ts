import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  untracked,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { SiteSelectComponent, SiteSelectOption } from '@alittlemore.dev/design-system';
import { Subscription, switchMap } from 'rxjs';
import { AccountSettingsService } from '../../../../core/auth/account-settings.service';
import { formatFinanceDate, financePeriodEnd } from '../utils/finance-time';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { ApiError } from '../../../../core/models/api-error.model';
import { FinanceStatisticsReportComponent } from './finance-statistics-report.component';
import {
  FinanceCurrency,
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
  selector: 'app-finance-statistics-page',
  standalone: true,
  imports: [TranslatePipe, SiteSelectComponent, FinanceStatisticsReportComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './finance-statistics-page.component.html',
  styleUrl: './finance-statistics-page.component.scss',
})
export class FinanceStatisticsPageComponent implements OnInit {
  private readonly service = inject(FinanceService);
  readonly i18n = inject(I18nService);
  readonly timeZone = inject(AccountSettingsService).timeZone;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  readonly statistics = signal<FinanceStatisticsResult | null>(null);
  readonly loading = signal(true);
  readonly errorKey = signal<string | null>(null);
  readonly notice = signal(false);
  readonly period = signal<FinanceStatisticsPeriod>('thisMonth');
  readonly currency = signal<FinanceStatisticsCurrency>('month');
  readonly tab = signal<'summary' | 'income' | 'expense'>('summary');
  readonly tabs = ['summary', 'income', 'expense'] as const;
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
  private loadedTimeZone = this.timeZone();

  constructor() {
    effect(() => {
      const zone = this.timeZone();
      if (zone === this.loadedTimeZone) return;
      this.loadedTimeZone = zone;
      untracked(() => this.load());
    });
  }

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
  }

  load(): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.errorKey.set(null);
    this.statistics.set(null);
    const language = this.i18n.language();
    if (language !== 'ru' && language !== 'en') {
      this.errorKey.set('finance.error.load');
      this.loading.set(false);
      return;
    }
    this.request = this.service
      .ensure(language)
      .pipe(
        switchMap(() => {
          const query = this.route.snapshot.queryParamMap;
          const period = query.get('period');
          const currency = query.get('currency');
          const selectedPeriod = PERIODS.find((value) => value === period) ?? 'thisMonth';
          const selectedCurrency =
            currency === 'month'
              ? 'month'
              : (CURRENCIES.find((value) => value === currency) ?? 'month');
          const invalid =
            (period !== null &&
              (!PERIODS.some((value) => value === period) ||
                query.getAll('period').length !== 1)) ||
            (currency !== null &&
              ((currency !== 'month' && !CURRENCIES.some((value) => value === currency)) ||
                query.getAll('currency').length !== 1));
          this.notice.set(invalid);
          this.period.set(selectedPeriod);
          this.currency.set(selectedCurrency);
          if (invalid)
            void this.router.navigate([], {
              relativeTo: this.route,
              replaceUrl: true,
              queryParamsHandling: 'merge',
              queryParams: { period: selectedPeriod, currency: selectedCurrency },
            });
          return this.service.statistics(selectedPeriod, selectedCurrency);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (data) => {
          this.statistics.set(data);
          this.loading.set(false);
        },
        error: (error: ApiError) => {
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
    return formatFinanceDate(value, this.i18n.dateLocale(), this.timeZone());
  }

  periodEnd(value: string): string {
    return financePeriodEnd(value, this.i18n.dateLocale(), this.timeZone());
  }
}
