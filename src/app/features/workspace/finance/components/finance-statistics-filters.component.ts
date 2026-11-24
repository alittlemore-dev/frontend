import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { SiteSelectComponent, SiteSelectOption } from '@alittlemore.dev/design-system';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import {
  FinanceCurrency,
  FinanceStatisticsPeriod,
  FINANCE_CURRENCY_SYMBOLS,
} from '../models/finance.model';

export const STATISTICS_PERIODS: readonly FinanceStatisticsPeriod[] = [
  'thisMonth',
  'thisYear',
  'thisWeek',
  'today',
  'last7Days',
  'last30Days',
  'last365Days',
];
export const STATISTICS_CURRENCIES: readonly FinanceCurrency[] = ['AMD', 'RUB', 'USD', 'EUR'];

@Component({
  selector: 'app-finance-statistics-filters',
  imports: [SiteSelectComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './finance-statistics-filters.component.html',
  styleUrl: './finance-statistics-filters.component.scss',
})
export class FinanceStatisticsFiltersComponent {
  private readonly i18n = inject(I18nService);
  readonly period = input.required<string>();
  readonly currency = input.required<string>();
  readonly allowRange = input(false);
  readonly periodChange = output<string>();
  readonly currencyChange = output<string>();
  readonly currencyOptions = computed<readonly SiteSelectOption[]>(() => {
    this.i18n.language();
    return [
      { value: 'month', label: this.i18n.translate('finance.statistics.currency.month') },
      ...STATISTICS_CURRENCIES.map((value) => ({ value, label: FINANCE_CURRENCY_SYMBOLS[value] })),
    ];
  });
  readonly periodOptions = computed<readonly SiteSelectOption[]>(() => {
    this.i18n.language();
    const standard = STATISTICS_PERIODS.map((value) => ({
      value,
      label: this.i18n.translate(`finance.statistics.period.${value}`),
    }));
    return this.allowRange()
      ? [...standard, { value: 'range', label: this.i18n.translate('finance.assets.range') }]
      : standard;
  });
}
