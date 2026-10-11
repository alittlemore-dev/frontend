import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { _IdGenerator } from '@angular/cdk/a11y';
import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { FinanceCurrency, FINANCE_CURRENCY_SYMBOLS } from '../models/finance.model';
import { financeChartColors } from '../utils/finance-chart-colors';
import { formatFinanceMoney } from '../utils/finance-format';

export interface FinanceChartDatum {
  id: string;
  label: string;
  amount: string | null;
}

interface FinanceChartTooltip {
  origin: CdkOverlayOrigin;
  datum: FinanceChartDatum;
  percentage?: number;
}

@Component({
  selector: 'app-finance-chart',
  standalone: true,
  imports: [TranslatePipe, CdkOverlayOrigin, CdkConnectedOverlay],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './finance-chart.component.html',
  styleUrl: './finance-chart.component.scss',
  host: { '[class.finance-chart-aligned]': 'aligned()' },
})
export class FinanceChartComponent {
  private readonly i18n = inject(I18nService);
  private readonly browserWindow = isPlatformBrowser(inject(PLATFORM_ID))
    ? inject(DOCUMENT).defaultView
    : null;
  private hideTimer: number | null = null;
  private readonly hovered = signal<FinanceChartTooltip | null>(null);
  private readonly focused = signal<FinanceChartTooltip | null>(null);
  readonly tooltip = computed(() => this.hovered() ?? this.focused());
  readonly tooltipId = inject(_IdGenerator).getId('finance-chart-tooltip-');
  readonly tooltipPositions: ConnectedPosition[] = [
    { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -8 },
    { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 8 },
  ];
  readonly title = input.required<string>();
  readonly symbol = computed(() => FINANCE_CURRENCY_SYMBOLS[this.currency()]);
  readonly currency = input.required<FinanceCurrency>();
  readonly data = input.required<readonly FinanceChartDatum[]>();
  readonly tableData = input<readonly FinanceChartDatum[] | null>(null);
  readonly aligned = input(false);
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
  readonly pieRows = computed(() => {
    const positive = this.data().filter((row) => row.amount !== null && Number(row.amount) > 0);
    const total = positive.reduce((sum, row) => sum + Number(row.amount), 0);
    const colors = financeChartColors(positive.length);
    let colorIndex = 0;
    return this.data().map((row) => {
      const value = Number(row.amount ?? 0);
      return {
        ...row,
        fill: value > 0 ? colors[colorIndex++] : null,
        percentage: value > 0 ? (value / total) * 100 : 0,
      };
    });
  });
  readonly legendRows = computed(() =>
    this.kind() === 'pie'
      ? this.pieRows()
      : (this.tableData() ?? this.data()).map((row) => ({ ...row, fill: null, percentage: 0 })),
  );
  readonly slices = computed(() => {
    let angle = -Math.PI / 2;
    return this.pieRows()
      .filter((row) => row.fill !== null)
      .map((row) => {
        const next = angle + (row.percentage / 100) * Math.PI * 2;
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
        };
      });
  });
  readonly nonzero = computed(() =>
    this.data().some((row) => row.amount !== null && Number(row.amount) !== 0),
  );
  private readonly tooltipDataKey = computed(() =>
    JSON.stringify([this.data(), this.currency(), this.kind()]),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancelHide());
    effect(() => {
      // Parents may rebuild equivalent series when a chart interaction triggers rendering.
      this.tooltipDataKey();
      untracked(() => this.hideTooltip());
    });
  }

  showTooltip(
    datum: FinanceChartDatum,
    origin: CdkOverlayOrigin,
    source: 'pointer' | 'focus',
    percentage?: number,
  ): void {
    this.cancelHide();
    const tooltip = { origin, datum, percentage };
    if (source === 'pointer') this.hovered.set(tooltip);
    else this.focused.set(tooltip);
  }

  blurTooltip(): void {
    this.focused.set(null);
  }

  retainTooltip(): void {
    this.cancelHide();
  }

  scheduleHide(): void {
    this.cancelHide();
    if (this.browserWindow === null) {
      this.hovered.set(null);
      return;
    }
    // Allow crossing the small gap from a chart mark into its tooltip.
    this.hideTimer = this.browserWindow.setTimeout(() => {
      this.hovered.set(null);
      this.hideTimer = null;
    }, 150);
  }

  hideTooltip(): void {
    this.cancelHide();
    this.hovered.set(null);
    this.focused.set(null);
  }

  private cancelHide(): void {
    if (this.hideTimer !== null) this.browserWindow?.clearTimeout(this.hideTimer);
    this.hideTimer = null;
  }

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
