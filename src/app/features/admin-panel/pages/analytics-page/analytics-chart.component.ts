import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { AnalyticsBucket, AnalyticsPoint } from './analytics.model';
import {
  analyticsDateFormatter,
  analyticsPointRange,
  formatAnalyticsRange,
  utcDay,
} from './analytics-time';

@Component({
  selector: 'app-analytics-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="m-0">
      <figcaption class="fw-semibold mb-2">{{ label() }}</figcaption>
      <svg
        viewBox="0 0 900 260"
        role="group"
        [attr.aria-label]="label()"
        class="w-100"
        (pointerleave)="hovered.set(null)"
      >
        <title>{{ label() }}</title>
        @for (tick of ticks(); track tick.y) {
          <line x1="120" x2="880" [attr.y1]="tick.y" [attr.y2]="tick.y" class="grid" />
          <text x="110" [attr.y]="tick.y + 4" text-anchor="end">{{ tick.value }}</text>
        }
        <polyline [attr.points]="line()" />
        @for (point of coordinates(); track point.date) {
          <g
            tabindex="0"
            role="img"
            [attr.aria-label]="point.period + ': ' + point.value"
            (pointerenter)="hovered.set(point.date)"
            (focus)="focused.set(point.date)"
            (blur)="focused.set(null)"
            (click)="focused.set(point.date)"
            (keydown.escape)="focused.set(null); hovered.set(null)"
          >
            <rect
              class="hit-area"
              [attr.x]="point.hitX"
              y="20"
              [attr.width]="point.hitWidth"
              height="190"
            />
            <circle [attr.cx]="point.x" [attr.cy]="point.y" r="4">
              <title>{{ point.period }}: {{ point.value }}</title>
            </circle>
          </g>
        }
        <text x="120" y="245">{{ axisLabels().first }}</text>
        <text x="880" y="245" text-anchor="end">{{ axisLabels().last }}</text>
        @if (selected(); as point) {
          <g class="point-tooltip" pointer-events="none">
            <line [attr.x1]="point.x" [attr.x2]="point.x" y1="20" y2="210" class="cursor" />
            <circle [attr.cx]="point.x" [attr.cy]="point.y" r="6" />
          </g>
        }
      </svg>
      @if (selected(); as point) {
        <div class="chart-tooltip" role="tooltip">
          <span>{{ point.period }}</span>
          <strong>{{ label() }}: {{ point.value }}</strong>
        </div>
      }
    </figure>
  `,
  styles: `
    svg {
      display: block;
      min-height: 180px;
      max-height: 320px;
      overflow: visible;
    }
    text {
      fill: var(--bs-secondary-color);
      font-size: 14px;
    }
    .grid {
      stroke: var(--bs-border-color);
      stroke-width: 1;
    }
    polyline {
      fill: none;
      stroke: var(--bs-primary);
      stroke-width: 3;
    }
    circle {
      fill: var(--bs-primary);
    }
    .hit-area {
      fill: transparent;
    }
    g:focus {
      outline: none;
    }
    g:focus circle {
      stroke: var(--bs-body-color);
      stroke-width: 3;
    }
    .cursor {
      stroke: var(--bs-secondary-color);
      stroke-dasharray: 4 4;
    }
    figure {
      position: relative;
    }
    .chart-tooltip {
      position: absolute;
      top: 2.5rem;
      right: 1rem;
      max-width: calc(100% - 2rem);
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 0.5rem 0.75rem;
      background: var(--bs-body-bg);
      border: 1px solid var(--bs-border-color);
      border-radius: 0.5rem;
      box-shadow: var(--bs-box-shadow-sm);
      font-size: 0.875rem;
      pointer-events: none;
    }
    @media (max-width: 575px) {
      svg {
        min-height: 130px;
      }
      text {
        font-size: 23px;
      }
      .chart-tooltip {
        font-size: 0.8125rem;
        right: 0.25rem;
        top: 2rem;
      }
    }
  `,
})
export class AnalyticsChartComponent {
  readonly points = input.required<readonly AnalyticsPoint[]>();
  readonly label = input.required<string>();
  readonly bucket = input<AnalyticsBucket>('day');
  readonly dateFrom = input('');
  readonly dateTo = input('');
  readonly dateLocale = input('ru-RU');
  readonly hovered = signal<string | null>(null);
  readonly focused = signal<string | null>(null);
  readonly maximum = computed(() => Math.max(1, ...this.points().map((point) => point.value)));
  readonly axisLabels = computed(() => {
    const points = this.points();
    const first = points[0];
    const last = points[points.length - 1];
    if (!first || !last) return { first: '', last: '' };
    const monthly = this.bucket() === 'month';
    const from = analyticsPointRange(
      first.date,
      this.bucket(),
      this.dateFrom(),
      this.dateTo(),
    ).from;
    const to = analyticsPointRange(last.date, this.bucket(), this.dateFrom(), this.dateTo()).to;
    const formatter = new Intl.DateTimeFormat(this.dateLocale(), {
      day: monthly ? undefined : 'numeric',
      month: 'short',
      year: monthly || from.slice(0, 4) !== to.slice(0, 4) ? 'numeric' : undefined,
      timeZone: 'UTC',
    });
    return { first: formatter.format(utcDay(from)), last: formatter.format(utcDay(to)) };
  });
  readonly coordinates = computed(() => {
    const formatter = analyticsDateFormatter(this.dateLocale());
    return this.points().map((point, index, points) => {
      const step = points.length === 1 ? 760 : 760 / (points.length - 1);
      const x = points.length === 1 ? 500 : 120 + index * step;
      const { from, to } = analyticsPointRange(
        point.date,
        this.bucket(),
        this.dateFrom(),
        this.dateTo(),
      );
      return {
        ...point,
        x,
        y: 210 - (point.value * 190) / this.maximum(),
        period: formatAnalyticsRange(from, to, formatter),
        hitX: Math.max(120, x - step / 2),
        hitWidth:
          points.length === 1 ? 760 : index === 0 || index === points.length - 1 ? step / 2 : step,
      };
    });
  });
  readonly selected = computed(() =>
    this.coordinates().find((point) => point.date === (this.hovered() ?? this.focused())),
  );
  readonly line = computed(() =>
    this.coordinates()
      .map((point) => `${point.x},${point.y}`)
      .join(' '),
  );
  readonly ticks = computed(() =>
    [...new Set([0, Math.round(this.maximum() / 2), this.maximum()])].map((value) => ({
      y: 210 - (value * 190) / this.maximum(),
      value,
    })),
  );
}
