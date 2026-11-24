import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnChanges,
  SimpleChanges,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { UnsavedChangesService } from '../../../../core/unsaved-changes/unsaved-changes.service';
import { AssetGoal, AssetGoalDraft } from '../models/finance-assets.model';
import { FinanceMonth } from '../models/finance.model';
import { FinanceAssetsService } from '../services/finance-assets.service';
import { decimalForInput } from '../utils/finance-decimal';

@Component({
  selector: 'app-asset-goal-inline',
  imports: [ReactiveFormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './asset-goal-inline.component.html',
  styleUrl: './asset-goal-inline.component.scss',
})
export class AssetGoalInlineComponent implements OnChanges {
  private readonly api = inject(FinanceAssetsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly configureIncome = input(false);
  private readonly scope = inject(UnsavedChangesService).createScope(this.destroyRef);
  readonly goal = input<AssetGoal | null>(null);
  readonly month = input<FinanceMonth | null>(null);
  readonly selectedMonth = input.required<string>();
  readonly saved = output<void>();
  readonly busy = signal(false);
  readonly error = signal('');
  readonly form = new FormGroup({
    percent: new FormControl('', { nonNullable: true }),
    allIncome: new FormControl(true, { nonNullable: true }),
    categoryIds: new FormControl<string[]>([], { nonNullable: true }),
  });
  readonly draft = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });
  private readonly source = this.scope.registerSource(this.draft, signal(true));
  readonly dirty = this.source.hasChanges;
  private baseline = this.form.getRawValue();
  readonly categories = computed(() =>
    (this.month()?.categories ?? []).filter((c) => c.kind === 'income' && !c.archived),
  );
  readonly unavailableIds = computed(() =>
    (this.goal()?.categoryIds ?? []).filter(
      (id) => !this.categories().some((c) => c.stableId === id),
    ),
  );
  readonly keepingUnavailable = computed(() =>
    this.unavailableIds().some((id) => this.draft().categoryIds.includes(id)),
  );

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedMonth'] || (!this.dirty() && !this.busy())) {
      const goal = this.goal();
      this.setBaseline({
        percent: decimalForInput(goal?.percent ?? ''),
        allIncome: goal?.allIncome ?? true,
        categoryIds: [...(goal?.categoryIds ?? [])].sort(),
      });
    }
  }

  keepUnavailable(checked: boolean): void {
    const retained = this.draft().categoryIds.filter((id) => !this.unavailableIds().includes(id));
    this.form.controls.categoryIds.setValue(
      checked ? [...retained, ...this.unavailableIds()].sort() : retained,
    );
  }

  selectCategory(id: string, selected: boolean): void {
    const ids = this.form.controls.categoryIds;
    ids.setValue(selected ? [...ids.value, id].sort() : ids.value.filter((value) => value !== id));
  }

  onPercentBlur(event: FocusEvent): void {
    if (
      !this.configureIncome() &&
      !this.element.nativeElement.contains(event.relatedTarget as Node | null)
    )
      this.save();
  }

  discard(): void {
    if (!this.busy()) this.setBaseline(this.baseline);
  }

  save(): void {
    if (!this.dirty() || this.busy()) return;
    const value = this.form.getRawValue();
    const text = value.percent.trim().replace(',', '.');
    const percent = decimalForInput(text);
    if (
      !/^\d+(\.\d+)?$/.test(text) ||
      !/^\d{1,3}(\.\d{1,2})?$/.test(percent) ||
      Number(percent) > 100
    ) {
      this.error.set('finance.assets.goalPercentError');
      return;
    }
    if (!value.allIncome && !value.categoryIds.length) {
      this.error.set('finance.assets.goalIncomeError');
      return;
    }
    const requested = { ...value, percent, categoryIds: value.allIncome ? [] : value.categoryIds };
    if (
      requested.percent === this.baseline.percent &&
      requested.allIncome === this.baseline.allIncome &&
      requested.categoryIds.length === this.baseline.categoryIds.length &&
      requested.categoryIds.every((id, index) => id === this.baseline.categoryIds[index])
    ) {
      this.discard();
      return;
    }
    const month = this.selectedMonth();
    this.error.set('');
    this.busy.set(true);
    this.api
      .saveGoal(month.slice(0, 7), {
        percent,
        allIncome: requested.allIncome,
        categoryIds: requested.categoryIds,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          if (month === this.selectedMonth()) this.setBaseline(requested);
          this.saved.emit();
        },
        error: () => {
          this.busy.set(false);
          if (month === this.selectedMonth()) this.error.set('finance.error.save');
        },
      });
  }

  private setBaseline(value: AssetGoalDraft): void {
    this.baseline = value;
    this.form.reset(value);
    this.source.commit();
    this.error.set('');
  }
}
