import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'app-resume-list-limit',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'd-inline-flex align-items-center',
    role: 'status',
    '[attr.title]': 'description()',
    '[attr.aria-label]': 'description()',
  },
  template: `
    <span
      class="small text-nowrap"
      [class.text-danger]="reached()"
      [class.text-body-secondary]="!reached()"
    >
      {{ count() }}/{{ max() }}
      @if (totalCount() !== null && totalMax() !== null) {
        · {{ 'resumeWorkspace.limit.total' | t }} {{ totalCount() }}/{{ totalMax() }}
      }
      @if (reached()) {
        <span class="fw-semibold">· {{ 'resumeWorkspace.limit.reached' | t }}</span>
      }
    </span>
  `,
})
export class ResumeListLimitComponent {
  readonly count = input.required<number>();
  readonly max = input.required<number>();
  readonly totalCount = input<number | null>(null);
  readonly totalMax = input<number | null>(null);

  private readonly i18n = inject(I18nService);

  readonly reached = computed(() => {
    const total = this.totalCount();
    const totalMax = this.totalMax();
    return this.count() >= this.max() || (total !== null && totalMax !== null && total >= totalMax);
  });
  readonly description = computed(() => {
    this.i18n.language();
    const local = this.i18n.translate('resumeWorkspace.limit.list', {
      actual: this.count(),
      max: this.max(),
    });
    const total = this.totalCount();
    const totalMax = this.totalMax();
    const totalDescription =
      total === null || totalMax === null
        ? ''
        : ` ${this.i18n.translate('resumeWorkspace.limit.listTotal', {
            actual: total,
            max: totalMax,
          })}`;
    const disabledDescription = this.reached()
      ? ` ${this.i18n.translate('resumeWorkspace.limit.addDisabled')}`
      : '';
    return `${local}${totalDescription}${disabledDescription}`;
  });
}
