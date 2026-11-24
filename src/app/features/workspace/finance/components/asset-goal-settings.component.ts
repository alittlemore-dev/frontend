import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SiteSelectComponent, SiteSelectOption } from '@alittlemore.dev/design-system';
import { Subscription } from 'rxjs';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { UnsavedChangesService } from '../../../../core/unsaved-changes/unsaved-changes.service';
import { AssetGoal } from '../models/finance-assets.model';
import { FinanceMonth } from '../models/finance.model';
import { FinanceAssetsService } from '../services/finance-assets.service';
import { AssetGoalInlineComponent } from './asset-goal-inline.component';

@Component({
  selector: 'app-asset-goal-settings',
  imports: [AssetGoalInlineComponent, SiteSelectComponent, TranslatePipe],
  templateUrl: './asset-goal-settings.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssetGoalSettingsComponent {
  private readonly api = inject(FinanceAssetsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changes = inject(UnsavedChangesService);
  private readonly i18n = inject(I18nService);
  readonly month = input.required<FinanceMonth>();
  readonly saved = output<void>();
  readonly editor = viewChild(AssetGoalInlineComponent);
  readonly period = signal('');
  readonly goal = signal<AssetGoal | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly invalidYear = signal(false);
  readonly pendingEdit = computed(() => !!(this.editor()?.dirty() || this.editor()?.busy()));
  readonly monthOptions = computed<readonly SiteSelectOption[]>(() => {
    const format = new Intl.DateTimeFormat(this.i18n.dateLocale(), {
      month: 'long',
      timeZone: 'UTC',
    });
    return Array.from({ length: 12 }, (_, index) => ({
      value: String(index + 1).padStart(2, '0'),
      label: format.format(new Date(Date.UTC(2000, index, 1))),
    }));
  });
  private request?: Subscription;

  toggle(): void {
    if (this.period()) this.leave();
    else this.load(this.month().periodStart.slice(0, 7));
  }

  changeYear(field: HTMLInputElement): void {
    this.invalidYear.set(!/^\d{4}$/.test(field.value) || field.value === '0000');
    if (this.invalidYear()) return;
    if (!this.changePeriod(field.value + this.period().slice(4))) {
      field.value = this.period().slice(0, 4);
    }
  }

  changePeriod(period: string): boolean {
    if (period === this.period()) return true;
    if (!this.canLeave()) return false;
    this.load(period);
    return true;
  }

  leave(): boolean {
    if (!this.canLeave()) return false;
    this.request?.unsubscribe();
    this.period.set('');
    return true;
  }

  load(period: string): void {
    this.request?.unsubscribe();
    this.period.set(period);
    this.invalidYear.set(false);
    this.loading.set(true);
    this.error.set(false);
    this.request = this.api
      .goal(period)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (goal) => {
          this.goal.set(goal);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }

  private canLeave(): boolean {
    return !this.editor()?.busy() && (!this.editor()?.dirty() || this.changes.confirmDiscard());
  }
}
