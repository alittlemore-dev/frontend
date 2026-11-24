import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
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
import { Observable, of, switchMap } from 'rxjs';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { UnsavedChangesService } from '../../../../core/unsaved-changes/unsaved-changes.service';
import {
  AssetMovement,
  AssetMovementDraft,
  AssetPosition,
  isSecurity,
} from '../models/finance-assets.model';
import { FINANCE_CURRENCY_SYMBOLS } from '../models/finance.model';
import { FinanceAssetsService } from '../services/finance-assets.service';
import { decimalForInput } from '../utils/finance-decimal';

type BalanceField = 'value' | 'quantity';
interface Balance {
  value: string;
  quantity: string;
}

function normalized(text: string): string {
  return decimalForInput(text.trim().replace(',', '.'));
}

@Component({
  selector: 'app-asset-balance-inline',
  imports: [ReactiveFormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './asset-balance-inline.component.html',
  styleUrl: './asset-balance-inline.component.scss',
})
export class AssetBalanceInlineComponent implements OnChanges {
  private readonly api = inject(FinanceAssetsService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly scope = inject(UnsavedChangesService).createScope(this.destroyRef);
  readonly position = input.required<AssetPosition>();
  readonly compact = input(false);
  readonly symbols = FINANCE_CURRENCY_SYMBOLS;
  readonly field = input<BalanceField>();
  readonly disabled = input(false);
  readonly asOf = input.required<string>();
  readonly trackingStart = input.required<string | null>();
  readonly today = input.required<string>();
  readonly movements = input.required<AssetMovement[]>();
  readonly saved = output<void>();

  readonly form = new FormGroup({
    value: new FormControl('', { nonNullable: true }),
    quantity: new FormControl('', { nonNullable: true }),
  });
  private readonly draft = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });
  private readonly baseline = signal<Balance>({ value: '', quantity: '' });
  readonly dirty = computed(
    () =>
      normalized(this.draft().value ?? '') !== this.baseline().value ||
      normalized(this.draft().quantity ?? '') !== this.baseline().quantity,
  );
  readonly busy = signal(false);
  readonly error = signal('');
  readonly errorId = computed(() =>
    ['asset-error', this.position().id, this.field()].filter(Boolean).join('-'),
  );
  readonly fields = computed<BalanceField[]>(() => {
    const field = this.field();
    return field ? [field] : isSecurity(this.position().kind) ? ['quantity', 'value'] : ['value'];
  });
  private latest: AssetMovement[] = [];
  private retry?: { payload: string; requestId: string };

  constructor() {
    this.scope.registerSource(this.dirty, signal(true));
  }

  ngOnChanges(changes: SimpleChanges): void {
    const changedContext =
      !!changes['asOf'] ||
      (changes['position'] && changes['position'].previousValue?.id !== this.position().id);
    if (changes['movements'] || changedContext) this.latest = [];
    if (changedContext) {
      this.retry = undefined;
      this.error.set('');
    }
    if (!changes['position'] && !changedContext) return;
    const position = this.position();
    const incoming = {
      quantity: isSecurity(position.kind) ? decimalForInput(position.quantity ?? '') : '',
      value: decimalForInput(position.originalValue ?? ''),
    };
    for (const field of ['value', 'quantity'] as const) {
      const control = this.form.controls[field];
      if (changedContext || normalized(control.value) === this.baseline()[field])
        control.setValue(incoming[field]);
    }
    this.baseline.set(incoming);
  }

  label(field: BalanceField): string {
    if (field === 'quantity') return 'finance.assets.quantity';
    return isSecurity(this.position().kind)
      ? 'finance.assets.totalValue'
      : 'finance.assets.observedBalance';
  }

  discard(): void {
    if (this.busy()) return;
    this.form.setValue(this.baseline());
    this.error.set('');
    this.retry = undefined;
  }

  save(field: BalanceField): void {
    if (this.busy() || this.disabled()) return;
    const raw = this.form.controls[field].value.trim().replace(',', '.');
    const value = normalized(raw);
    if (value === this.baseline()[field]) {
      this.form.controls[field].setValue(value);
      return;
    }
    const places = field === 'quantity' ? 12 : this.position().currency === 'AMD' ? 0 : 2;
    const [whole, fraction = ''] = value.split('.');
    if (!/^\d+(?:\.\d+)?$/.test(raw) || whole.length > 18 || fraction.length > places) {
      this.error.set(
        field === 'quantity' ? 'finance.assets.invalidQuantity' : 'finance.assets.invalidBalance',
      );
      return;
    }
    this.error.set('');
    this.busy.set(true);
    // Historical reports contain only facts through asOf. Look ahead before choosing a statement
    // or starting regular accounting when this could be an isolated, pre-tracking observation.
    const history =
      !this.trackingStart() && this.asOf() < this.today()
        ? this.api.movements(this.asOf(), this.today())
        : of(this.movements());
    history
      .pipe(
        switchMap((rows) => this.write(field, value, rows)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (movement) => {
          this.busy.set(false);
          if (!movement) return;
          this.latest = [...this.latest.filter((m) => m.id !== movement.id), movement];
          this.retry = undefined;
          this.baseline.update((b) => ({ ...b, [field]: value }));
          this.form.controls[field].setValue(value);
          this.saved.emit();
        },
        error: (e) => {
          this.busy.set(false);
          this.error.set(e.status === 409 ? 'finance.error.conflict' : 'finance.error.save');
        },
      });
  }

  private write(
    field: BalanceField,
    value: string,
    rows: AssetMovement[],
  ): Observable<AssetMovement | null> {
    const position = this.position();
    const day = this.asOf();
    const live = rows.filter((m) => !m.deleted);
    const tracking = this.trackingStart();
    const historical =
      tracking !== null
        ? day < tracking
        : live.some((m) => m.onDate > day || (m.onDate === day && m.kind === 'statement'));
    const observations = [...live, ...this.latest].filter(
      (m) => m.onDate === day && m.positionId === position.id,
    );
    let kind: AssetMovementDraft['kind'] = 'reconcile';
    if (historical) kind = 'statement';
    else if (
      field === 'value' &&
      (observations.some((m) => m.kind === 'valuation') ||
        (isSecurity(position.kind) && !observations.some((m) => m.kind === 'reconcile')))
    )
      kind = 'valuation';
    const current = observations
      .filter((m) => m.kind === kind)
      .sort((a, b) => b.version - a.version)[0];
    const draft: AssetMovementDraft = {
      kind,
      onDate: day,
      positionId: position.id,
      counterPositionId: null,
      categoryId: null,
      amount: null,
      counterAmount: null,
      quantity: null,
      totalValue: null,
      note: current?.note ?? '',
    };
    if (kind === 'valuation') {
      draft.totalValue = value;
    } else if (isSecurity(position.kind)) {
      draft.quantity =
        field === 'quantity' ? value : (current?.quantity ?? this.baseline().quantity);
      draft.totalValue = field === 'value' ? value : (current?.totalValue ?? null);
      if (!draft.quantity) {
        this.error.set('finance.assets.invalidQuantity');
        return of(null);
      }
    } else {
      draft.amount = value;
    }
    if (current) return this.api.updateMovement(current, draft);
    const payload = JSON.stringify(draft);
    if (this.retry?.payload !== payload) {
      const requestId = this.document.defaultView?.crypto?.randomUUID?.();
      if (!requestId) {
        this.error.set('finance.error.save');
        return of(null);
      }
      this.retry = { payload, requestId };
    }
    return this.api.createMovement(this.retry.requestId, draft);
  }
}
