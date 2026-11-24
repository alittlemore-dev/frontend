import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { SiteSelectComponent, SiteSelectOption } from '@alittlemore.dev/design-system';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { AssetLocation, AssetReport } from '../models/finance-assets.model';
import { formatFinanceMoney } from '../utils/finance-format';
import { formatFinanceDate, formatFinanceMonth } from '../utils/finance-time';
import { FinanceChartComponent, FinanceChartDatum } from './finance-chart.component';

const groups = ['byKind', 'byLocation', 'byCurrency'] as const;
type Group = (typeof groups)[number];

@Component({
  selector: 'app-asset-report',
  imports: [TranslatePipe, FinanceChartComponent, SiteSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './asset-report.component.html',
  styleUrl: '../pages/finance-statistics-panel.component.scss',
})
export class AssetReportComponent {
  private readonly i18n = inject(I18nService);
  readonly report = input.required<AssetReport>();
  readonly locations = input.required<AssetLocation[]>();
  readonly timeZone = input.required<string>();
  readonly journal = output<string>();
  readonly group = signal<Group>('byKind');
  readonly groupingOptions = computed<SiteSelectOption[]>(() => {
    this.i18n.language();
    return groups.map((value) => ({
      value,
      label: this.i18n.translate('finance.assets.' + value),
    }));
  });
  readonly reasons = [
    'initialAssets',
    'deposits',
    'withdrawals',
    'payouts',
    'fees',
    'revaluation',
    'reconciliation',
  ] as const;
  readonly composition = computed<FinanceChartDatum[]>(() => {
    this.i18n.language();
    const group = this.group();
    return Object.entries(this.report()[group]).map(([id, amount]) => ({
      id,
      amount,
      label:
        group === 'byKind'
          ? this.i18n.translate('finance.assets.kind.' + id)
          : group === 'byLocation'
            ? (this.locations().find((location) => location.id === id)?.name ??
              this.i18n.translate('finance.assets.location'))
            : id,
    }));
  });
  readonly history = computed<FinanceChartDatum[]>(() => {
    this.i18n.language();
    const report = this.report();
    const monthCount = report.months.length;
    // Across many months use the last observed valuation of each month, as in the budget timeline.
    const points =
      monthCount > 3
        ? [...new Map(report.history.map((point) => [point.onDate.slice(0, 7), point])).values()]
        : report.history;
    const axis = this.axisFormatter(monthCount > 3);
    return points.map((p) => ({
      id: p.onDate,
      label: p.complete
        ? this.date(p.onDate)
        : this.date(p.onDate) + ' (' + this.i18n.translate('finance.assets.partial') + ')',
      axisLabel: axis.format(new Date(p.onDate + 'T00:00:00Z')),
      amount: p.knownValue,
    }));
  });
  readonly goalSeries = computed(() => {
    this.i18n.language();
    const rows = this.report().months;
    return this.monthSeries(
      rows.map((m) => ({ month: m.month, actual: m.netSavings, target: m.targetAmount })),
    );
  });
  readonly forecastSeries = computed(() => {
    this.i18n.language();
    return this.monthSeries(this.report().forecast.points);
  });
  readonly observationMonths = computed(() => {
    this.i18n.language();
    return this.report()
      .forecast.observationMonths.map((m) => this.month(m))
      .join(', ');
  });

  selectGroup(value: string): void {
    const group = groups.find((g) => g === value);
    if (group) this.group.set(group);
  }
  private monthSeries(rows: { month: string; actual: string | null; target: string | null }[]) {
    const axis = this.axisFormatter(true);
    const series = (key: 'actual' | 'target') =>
      rows.map((row) => ({
        id: row.month,
        label: this.month(row.month),
        axisLabel: axis.format(new Date(row.month.slice(0, 7) + '-01T00:00:00Z')),
        amount: row[key],
      }));
    const actual = series('actual');
    const target = series('target');
    const scale = [...actual, ...target].flatMap((row) =>
      row.amount === null ? [] : [Number(row.amount)],
    );
    return { actual, target, scale, hasTarget: target.some((row) => row.amount !== null) };
  }
  private axisFormatter(monthOnly: boolean): Intl.DateTimeFormat {
    return new Intl.DateTimeFormat(this.i18n.dateLocale(), {
      timeZone: 'UTC',
      month: 'short',
      ...(monthOnly ? {} : { day: 'numeric' }),
    });
  }
  date(value: string): string {
    return formatFinanceDate(value, this.i18n.dateLocale(), this.timeZone());
  }
  month(value: string): string {
    return formatFinanceMonth(value, this.i18n.dateLocale());
  }
  money(value: string | null): string {
    return value === null
      ? this.i18n.translate('finance.notSet')
      : formatFinanceMoney(value, this.report().currency, this.i18n.dateLocale());
  }
  percent(value: string | null): string {
    return value === null
      ? this.i18n.translate('finance.assets.noIncome')
      : new Intl.NumberFormat(this.i18n.dateLocale(), {
          style: 'percent',
          maximumFractionDigits: 2,
        }).format(Number(value) / 100);
  }
}
