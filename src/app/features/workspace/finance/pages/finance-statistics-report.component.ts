import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { formatFinanceDate, financePeriodEnd } from '../utils/finance-time';
import { FinanceBudgetColumnComponent } from '../components/finance-budget-column.component';
import { FinanceChartComponent, FinanceChartDatum } from '../components/finance-chart.component';
import {
  FinanceCategory,
  FinanceCurrency,
  FinanceKind,
  FinanceStatistics,
  FinanceStatisticsBreakdown,
  FINANCE_CURRENCY_SYMBOLS,
} from '../models/finance.model';
import { formatFinanceMoney } from '../utils/finance-format';

@Component({
  selector: 'app-finance-statistics-report',
  standalone: true,
  imports: [TranslatePipe, FinanceBudgetColumnComponent, FinanceChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './finance-statistics-report.component.html',
  styleUrl: './finance-statistics-page.component.scss',
})
export class FinanceStatisticsReportComponent {
  readonly i18n = inject(I18nService);
  readonly statistics = input.required<FinanceStatistics>();
  readonly timeZone = input.required<string>();
  readonly tab = input.required<'summary' | FinanceKind>();
  readonly kinds: readonly FinanceKind[] = ['income', 'expense'];
  readonly blankDraft = { name: '', plan: '' };
  readonly monthlyCategories = computed(() => {
    this.i18n.language();
    const data = this.statistics();
    const categories = data?.monthly?.categories ?? [];
    const result: Record<FinanceKind, FinanceCategory[]> = { income: [], expense: [] };
    for (const kind of this.kinds) {
      const rows = categories.filter((category) => category.kind === kind);
      const amount = kind === 'income' ? data?.uncategorizedIncome : data?.uncategorizedExpense;
      result[kind] =
        amount && Number(amount) !== 0
          ? [
              ...rows,
              {
                id: `uncategorized-${kind}`,
                stableId: '',
                kind,
                name: this.i18n.translate('finance.category.none'),
                plannedAmount: null,
                actualAmount: amount,
                difference: null,
                position: rows.length,
                archived: true,
              },
            ]
          : rows;
    }
    return result;
  });
  readonly balanceSeries = computed(() => {
    this.i18n.language();
    const month = this.statistics()?.monthly;
    return month === null || month === undefined
      ? []
      : [
          {
            id: 'opening',
            label: this.i18n.translate('finance.openingBalance'),
            amount: month.openingBalance,
          },
          {
            id: 'closing',
            label: this.i18n.translate('finance.closingBalance'),
            amount: month.closingBalance,
          },
        ];
  });
  readonly balanceScale = computed(() => this.balanceSeries().map((row) => Number(row.amount)));
  readonly budgetSeries = computed(() => {
    const rows = this.monthlyCategories();
    const build = (
      kind: FinanceKind,
    ): { planned: FinanceChartDatum[]; actual: FinanceChartDatum[] } => ({
      planned: rows[kind]
        .filter((row) => !row.archived)
        .map((row) => ({ id: row.id, label: row.name, amount: row.plannedAmount })),
      actual: rows[kind].map((row) => ({ id: row.id, label: row.name, amount: row.actualAmount })),
    });
    return { income: build('income'), expense: build('expense') };
  });
  readonly partial = computed(() => {
    const data = this.statistics();
    if (data === null) return false;
    return data.availableSince > data.previousWindow.start.slice(0, 10);
  });

  timeline(data: FinanceStatisticsBreakdown): FinanceChartDatum[] {
    const statistics = this.statistics()!;
    const formatter = new Intl.DateTimeFormat(this.i18n.dateLocale(), {
      timeZone: this.timeZone(),
      ...(statistics.window.granularity === 'hour'
        ? { hour: '2-digit', minute: '2-digit', timeZoneName: 'shortOffset' }
        : statistics.window.granularity === 'month'
          ? { month: 'short', year: 'numeric' }
          : { day: 'numeric', month: 'short' }),
    });
    return data.timeline.map((point) => ({
      id: point.start,
      label: formatter.format(new Date(point.start)),
      amount: point.amount,
    }));
  }

  categories(data: FinanceStatisticsBreakdown): FinanceChartDatum[] {
    return data.categories.map((category) => ({
      id: category.id,
      label: category.name || this.i18n.translate('finance.category.none'),
      amount: category.amount,
    }));
  }

  timelineTable(data: FinanceStatisticsBreakdown): FinanceChartDatum[] {
    const now = Date.now();
    return this.timeline(data).filter((point) => new Date(point.id).getTime() <= now);
  }

  money(value: string, currency: FinanceCurrency): string {
    return formatFinanceMoney(value, currency, this.i18n.dateLocale());
  }

  percent(value: string | null): string {
    return value === null
      ? '—'
      : new Intl.NumberFormat(this.i18n.dateLocale(), {
          maximumFractionDigits: 1,
          signDisplay: 'exceptZero',
        }).format(Number(value)) + '%';
  }

  date(value: string): string {
    return formatFinanceDate(value, this.i18n.dateLocale(), this.timeZone());
  }

  periodEnd(value: string): string {
    return financePeriodEnd(value, this.i18n.dateLocale(), this.timeZone());
  }
  symbol(currency: FinanceCurrency): string {
    return FINANCE_CURRENCY_SYMBOLS[currency];
  }
}
