import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { FinanceCurrency, FINANCE_CURRENCY_SYMBOLS } from '../models/finance.model';
import { formatFinanceMoney } from '../utils/finance-format';

export interface FinanceChartDatum {
  id: string;
  label: string;
  amount: string | null;
}

@Component({
  selector: 'app-finance-chart',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './finance-chart.component.html',
  styleUrl: './finance-chart.component.scss',
})
export class FinanceChartComponent {
  private readonly i18n = inject(I18nService);
  readonly title = input.required<string>();
  readonly symbol = computed(() => FINANCE_CURRENCY_SYMBOLS[this.currency()]);
  readonly currency = input.required<FinanceCurrency>();
  readonly data = input.required<readonly FinanceChartDatum[]>();
  readonly kind = input<'vertical' | 'horizontal' | 'pie'>('vertical');
  readonly scale = input<readonly number[]>([]);
  readonly height = computed(() =>
    this.kind() === 'horizontal' ? Math.max(100, this.data().length * 36 + 28) : 260,
  );
  readonly range = computed(() => {
    const values = this.scale().length
      ? this.scale()
      : this.data().map((row) => Number(row.amount ?? 0));
    const min = Math.min(0, ...values);
    const max = Math.max(0, ...values);
    return { min, max: max === min ? min + 1 : max };
  });
  readonly zeroY = computed(() => this.y(0));
  readonly bars = computed(() =>
    this.data().map((row, index, rows) => {
      const value = Number(row.amount ?? 0);
      const y = this.y(value);
      const slot = 660 / Math.max(1, rows.length);
      return {
        ...row,
        shortLabel: row.label.length > 26 ? row.label.slice(0, 25) + '…' : row.label,
        x: 40 + slot * index + slot * 0.15,
        y: Math.min(y, this.zeroY()),
        width: slot * 0.7,
        height: Math.abs(y - this.zeroY()),
        labelX: 40 + slot * (index + 0.5),
        showLabel: rows.length <= 12 || index % Math.ceil(rows.length / 10) === 0,
        rowY: index * 36 + 10,
        horizontalWidth: (value / Math.max(Number.MIN_VALUE, this.range().max)) * 390,
      };
    }),
  );
  readonly slices = computed(() => {
    const positive = this.data().filter((row) => row.amount !== null && Number(row.amount) > 0);
    const total = positive.reduce((sum, row) => sum + Number(row.amount), 0);
    let angle = -Math.PI / 2;
    return positive.map((row, index) => {
      const next = angle + (Number(row.amount) / total) * Math.PI * 2;
      const middle = angle + (next - angle) / 2;
      const startX = 180 + Math.cos(angle) * 110;
      const startY = 130 + Math.sin(angle) * 110;
      const midX = 180 + Math.cos(middle) * 110;
      const midY = 130 + Math.sin(middle) * 110;
      const endX = 180 + Math.cos(next) * 110;
      const endY = 130 + Math.sin(next) * 110;
      const path = `M180,130 L${startX},${startY} A110,110 0 0,1 ${midX},${midY} A110,110 0 0,1 ${endX},${endY} Z`;
      angle = next;
      return {
        ...row,
        path,
        colorClass: `finance-color-${index % 8}`,
        percentage: (Number(row.amount) / total) * 100,
      };
    });
  });
  readonly nonzero = computed(() =>
    this.data().some((row) => row.amount !== null && Number(row.amount) !== 0),
  );

  private y(value: number): number {
    const { min, max } = this.range();
    return 225 - ((value - min) / (max - min)) * 205;
  }

  money(amount: string | null): string {
    return amount === null
      ? this.i18n.translate('finance.notSet')
      : formatFinanceMoney(amount, this.currency(), this.i18n.dateLocale());
  }

  percentage(value: number): string {
    return new Intl.NumberFormat(this.i18n.dateLocale(), {
      maximumFractionDigits: 1,
      style: 'percent',
    }).format(value / 100);
  }
}
