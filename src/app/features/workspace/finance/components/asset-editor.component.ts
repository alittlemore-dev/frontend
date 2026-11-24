import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  Injector,
  viewChild,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { SiteSelectComponent, SiteSelectOption } from '@alittlemore.dev/design-system';
import { Observable } from 'rxjs';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { TextareaAutosizeDirective } from '../../../../shared/directives/textarea-autosize.directive';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { UnsavedChangesService } from '../../../../core/unsaved-changes/unsaved-changes.service';
import { AssetDateComponent } from './asset-date.component';
import {
  AssetKind,
  AssetLocation,
  AssetMovement,
  AssetMovementDraft,
  AssetOpeningPreviewRequest,
  AssetOpeningPreview,
  AssetPosition,
  AssetValuation,
  isAssetCounter,
  isSecurity,
  MovementKind,
} from '../models/finance-assets.model';
import { FinanceCurrency, FinanceMonth } from '../models/finance.model';
import { FinanceService } from '../services/finance.service';
import { FinanceAssetsService } from '../services/finance-assets.service';
import { formatFinanceMoney } from '../utils/finance-format';
import { adjustFinanceAmount, decimalForInput } from '../utils/finance-decimal';
import { assetKindOptions, FINANCE_CURRENCY_OPTIONS } from '../utils/finance-select-options';

export function movementAffectsBudget(kind: MovementKind): boolean {
  return [
    'openingBudget',
    'contribution',
    'withdrawal',
    'buyFromBudget',
    'payoutToBudget',
  ].includes(kind);
}

export type AssetEditorMode = 'location' | 'position' | 'movement';
export interface AssetEditorSelection {
  mode: AssetEditorMode;
  location?: AssetLocation;
  position?: AssetPosition;
  movement?: AssetMovement;
  kind?: MovementKind;
  initial?: { onDate: string; note: string; amount: string };
}
const blank = {
  name: '',
  locationId: '',
  positionKind: 'cash' as AssetKind,
  currency: 'RUB' as FinanceCurrency,
  instrument: '',
  venue: '',
  annualRate: '',
  maturesOn: '',
  kind: 'contribution' as MovementKind,
  onDate: '',
  positionId: '',
  counterPositionId: '',
  amount: '',
  counterAmount: '',
  quantity: '',
  totalValue: '',
  categoryId: '',
  note: '',
  openingSource: '' as '' | 'openingExternal' | 'openingBudget',
};
const decimal = /^\d+(?:\.\d+)?$/;
type NumericField = 'amount' | 'counterAmount' | 'quantity' | 'totalValue';
@Component({
  selector: 'app-asset-editor',
  imports: [
    FormsModule,
    TranslatePipe,
    AssetDateComponent,
    SiteSelectComponent,
    TextareaAutosizeDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './asset-editor.component.html',
  styleUrl: './finance-transaction-entry.component.scss',
})
export class AssetEditorComponent {
  private readonly budgets = inject(FinanceService);
  private readonly api = inject(FinanceAssetsService);
  private readonly i18n = inject(I18nService);
  private readonly injector = inject(Injector);
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly scope = inject(UnsavedChangesService).createScope(this.destroyRef);
  readonly month = input<FinanceMonth | null>(null);
  readonly selectedMonth = input.required<string>();
  readonly today = input.required<string>();
  readonly valuation = input.required<AssetValuation>();
  readonly locations = input.required<AssetLocation[]>();
  readonly allowBudget = input(true);
  readonly intent = input.required<AssetEditorSelection>();
  readonly closed = output<void>();
  readonly saved = output<boolean>();
  readonly reconcileRequested = output<void>();
  readonly selection = signal<AssetEditorSelection | null>(null);
  readonly draft = signal({ ...blank });
  readonly busy = signal(false);
  readonly message = signal('');
  private requestId = '';
  private sentPayload = '';
  readonly dirty = this.scope.registerSource(
    this.draft,
    computed(() => !!this.selection()),
  ).hasChanges;
  readonly kindOptions = computed(() => assetKindOptions(this.i18n));
  readonly currencyOptions = FINANCE_CURRENCY_OPTIONS;
  readonly locationOptions = computed<readonly SiteSelectOption[]>(() =>
    this.locations().map((l) => ({ value: l.id, label: l.name })),
  );
  readonly security = isSecurity;
  readonly positions = computed(() => this.valuation().positions);
  readonly primary = computed(() => this.positions().find((p) => p.id === this.draft().positionId));
  readonly counterOptions = computed(() => {
    const p = this.primary();
    const kind = this.draft().kind;
    return p
      ? this.positions().filter((other) =>
          isAssetCounter(other, p, kind, this.selection()?.movement?.counterPositionId),
        )
      : [];
  });
  readonly counter = computed(() =>
    this.counterOptions().find((p) => p.id === this.draft().counterPositionId),
  );
  readonly trade = computed(() => ['buy', 'sell', 'buyFromBudget'].includes(this.draft().kind));
  readonly externalAllowed = computed(() => ['buy', 'sell'].includes(this.draft().kind));
  readonly external = computed(
    () => this.externalAllowed() && this.draft().counterPositionId === 'external',
  );
  readonly counterChoices = computed<readonly SiteSelectOption[]>(() => [
    { value: '', label: this.i18n.translate('shared.notSet') },
    ...(this.externalAllowed()
      ? [{ value: 'external', label: this.i18n.translate('finance.assets.outsideTracker') }]
      : []),
    ...this.counterOptions().map((p) => ({ value: p.id, label: p.name + ' (' + p.currency + ')' })),
  ]);
  readonly counterLabel = computed(() => {
    const kind = this.draft().kind;
    if (kind === 'buy') return 'finance.assets.tradeSource';
    if (kind === 'sell') return 'finance.assets.tradeDestination';
    return 'finance.assets.destination';
  });
  readonly needsHolding = computed(() => {
    const p = this.balances()?.positions.find(
      (position) => position.id === this.draft().positionId,
    );
    return (
      !!p &&
      this.trade() &&
      !this.selection()?.movement &&
      !Number(p.quantity) &&
      Number(p.originalValue) > 0
    );
  });
  readonly sourceOptions = computed<readonly SiteSelectOption[]>(() => {
    const external = {
      value: 'openingExternal',
      label: this.i18n.translate('finance.assets.external'),
    };
    return this.allowBudget()
      ? [
          external,
          { value: 'openingBudget', label: this.i18n.translate('finance.assets.included') },
        ]
      : [external];
  });
  readonly needsCounter = computed(() =>
    ['buy', 'sell', 'exchange', 'transfer'].includes(this.draft().kind),
  );
  readonly opening = computed(() =>
    ['openingBudget', 'openingExternal'].includes(this.draft().kind),
  );
  readonly numericFields = computed<NumericField[]>(() => {
    const d = this.draft(),
      security = this.primary() && isSecurity(this.primary()!.kind);
    if (d.kind === 'valuation') return ['totalValue'];
    if (this.opening() || d.kind === 'statement' || d.kind === 'reconcile')
      return security ? ['quantity', 'totalValue'] : ['amount'];
    if (['buy', 'sell', 'buyFromBudget'].includes(d.kind)) return ['quantity', 'amount'];
    return d.kind === 'exchange' ? ['amount', 'counterAmount'] : ['amount'];
  });
  numericRequired(field: NumericField): boolean {
    return (
      field !== 'totalValue' ||
      !['openingExternal', 'statement', 'reconcile'].includes(this.draft().kind)
    );
  }
  private readonly dateMonth = computed(() => {
    if (this.selection()?.mode !== 'movement') return null;
    const kind = this.draft().kind;
    if (kind !== 'payoutToBudget') return null;
    const date = this.draft().onDate;
    return date ? date.slice(0, 7) + '-01' : null;
  });
  private readonly otherBudget = signal<FinanceMonth | null>(null);
  private readonly movementBudget = computed(() =>
    this.dateMonth() === this.selectedMonth() ? this.month() : this.otherBudget(),
  );
  readonly categoryOptions = computed<readonly SiteSelectOption[]>(() => [
    { value: '', label: this.i18n.translate('finance.assets.uncategorized') },
    ...(this.movementBudget()?.categories ?? [])
      .filter((c) => c.kind === 'income' && (!c.archived || c.id === this.draft().categoryId))
      .map((c) => ({ value: c.id, label: c.name })),
  ]);
  readonly needsBudgetPreview = computed(() => {
    const selection = this.selection();
    if (selection?.mode !== 'movement' || !this.draft().openingSource) return false;
    return (
      this.draft().kind === 'openingBudget' ||
      (this.draft().kind === 'openingExternal' &&
        !!selection.movement &&
        ['openingBudget', 'contribution', 'withdrawal', 'buyFromBudget', 'payoutToBudget'].includes(
          selection.movement.kind,
        ))
    );
  });
  private readonly openingRequest = computed<AssetOpeningPreviewRequest | null>(
    () => {
      const draft = this.draft();
      const position = this.primary();
      if (!this.needsBudgetPreview() || !position || !draft.onDate || draft.onDate > this.today())
        return null;
      const amount =
        draft.kind === 'openingExternal'
          ? '0'
          : (isSecurity(position.kind) ? draft.totalValue : draft.amount).trim().replace(',', '.');
      if (!decimal.test(amount)) return null;
      const movementId = this.selection()?.movement?.id;
      return {
        onDate: draft.onDate,
        positionId: position.id,
        amount,
        ...(movementId ? { movementId } : {}),
      };
    },
    {
      equal: (a, b) =>
        a?.onDate === b?.onDate &&
        a?.positionId === b?.positionId &&
        a?.amount === b?.amount &&
        a?.movementId === b?.movementId,
    },
  );
  private readonly previewAttempt = signal(0);
  private readonly openingPreview = signal<{
    request: AssetOpeningPreviewRequest;
    result: AssetOpeningPreview;
  } | null>(null);
  readonly openingPreviewError = signal('');
  readonly budgetPreview = computed(() => {
    const preview = this.openingPreview();
    return preview && preview.request === this.openingRequest() ? preview.result : null;
  });
  readonly previewLoading = computed(
    () => !!this.openingRequest() && !this.budgetPreview() && !this.openingPreviewError(),
  );
  retryPreview(): void {
    this.previewAttempt.update((n) => n + 1);
  }
  private readonly datedValuation = signal<AssetValuation | null>(null);
  private readonly balances = computed(() => {
    const date = this.draft().onDate;
    if (date === this.valuation().asOf) return this.valuation();
    const dated = this.datedValuation();
    return dated?.asOf === date ? dated : null;
  });
  private readonly previewDate = computed(() => {
    const date = this.draft().onDate;
    return this.selection()?.mode === 'movement' &&
      (['transfer', 'exchange'].includes(this.draft().kind) ||
        (this.trade() && !this.selection()?.movement)) &&
      date !== this.valuation().asOf &&
      date &&
      date <= this.today()
      ? date
      : null;
  });
  constructor() {
    effect(() => {
      const intent = this.intent();
      untracked(() => this.open(intent));
    });
    effect((cleanup) => {
      const date = this.dateMonth();
      this.otherBudget.set(null);
      if (!date || date === this.selectedMonth() || date > this.today()) return;
      const sub = this.budgets.historicalMonth(date).subscribe({
        next: (month) => this.otherBudget.set(month),
        error: () => this.otherBudget.set(null),
      });
      cleanup(() => sub.unsubscribe());
    });
    effect((cleanup) => {
      this.previewAttempt();
      const request = this.openingRequest();
      this.openingPreview.set(null);
      this.openingPreviewError.set('');
      if (!request) return;
      const subscription = this.api.openingPreview(request).subscribe({
        next: (result) => this.openingPreview.set({ request, result }),
        error: (e) =>
          this.openingPreviewError.set(
            e.status === 503 ? 'finance.error.rate' : 'finance.error.load',
          ),
      });
      cleanup(() => subscription.unsubscribe());
    });
    effect((cleanup) => {
      const date = this.previewDate();
      this.datedValuation.set(null);
      if (!date) return;
      const sub = this.api.positions(date, this.valuation().currency).subscribe({
        next: (v) => this.datedValuation.set(v),
        error: () => this.datedValuation.set(null),
      });
      cleanup(() => sub.unsubscribe());
    });
  }
  readonly previews = computed(() => {
    const d = this.draft(),
      p = this.primary(),
      counter = this.counter();
    const result: { label: string; value: string }[] = [];
    if (!p || this.selection()?.mode !== 'movement') return result;
    if (this.trade()) {
      const quantity = Number(d.quantity.replace(',', '.'));
      const amount = Number(d.amount.replace(',', '.'));
      if (quantity > 0 && amount > 0 && Number.isFinite(amount / quantity)) {
        const price = new Intl.NumberFormat(this.i18n.dateLocale(), {
          maximumFractionDigits: 12,
        }).format(amount / quantity);
        result.push({ label: 'unitPrice', value: price + ' ' + p.currency });
      }
    }
    const preview = this.budgetPreview();
    if (preview) {
      result.push({
        label: 'availableAfter',
        value: this.money(preview.availableAfter, preview.currency),
      });
    }
    const balances = this.balances();
    const debit = balances?.positions.find((pos) => pos.id === p.id)?.originalValue,
      creditBalance = balances?.positions.find((pos) => pos.id === counter?.id)?.originalValue;
    if (
      ['transfer', 'exchange'].includes(d.kind) &&
      !this.selection()?.movement &&
      counter &&
      debit != null &&
      creditBalance != null &&
      decimal.test(d.amount)
    ) {
      const credit = d.kind === 'exchange' ? d.counterAmount : d.amount;
      if (decimal.test(credit)) {
        result.push({
          label: 'sourceAfter',
          value: this.money(adjustFinanceAmount(debit, d.amount, true), p.currency),
        });
        result.push({
          label: 'destinationAfter',
          value: this.money(adjustFinanceAmount(creditBalance, credit), counter.currency),
        });
      }
    }
    return result;
  });
  private money(v: string | number, c: FinanceCurrency) {
    return formatFinanceMoney(v, c, this.i18n.dateLocale());
  }
  private open(selection: AssetEditorSelection): void {
    const p = selection.position,
      row = selection.movement;
    this.draft.set({
      ...blank,
      openingSource:
        row?.kind === 'openingExternal' || row?.kind === 'openingBudget' ? row.kind : '',
      onDate: this.valuation().asOf,
      positionKind: p?.kind ?? 'cash',
      currency: p?.currency ?? this.month()?.currency ?? 'RUB',
      name: selection.mode === 'location' ? (selection.location?.name ?? '') : (p?.name ?? ''),
      locationId: p?.locationId ?? selection.location?.id ?? this.locations()[0]?.id ?? '',
      instrument: p?.instrument ?? '',
      venue: p?.venue ?? '',
      annualRate: decimalForInput(p?.annualRate ?? ''),
      maturesOn: p?.maturesOn ?? '',
      kind: selection.kind ?? row?.kind ?? 'reconcile',
      positionId: p?.id ?? row?.positionId ?? '',
      ...(row
        ? {
            onDate: row.onDate,
            counterPositionId: row.externalFunds ? 'external' : (row.counterPositionId ?? ''),
            amount: decimalForInput(row.amount ?? ''),
            counterAmount: decimalForInput(row.counterAmount ?? ''),
            quantity: decimalForInput(row.quantity ?? ''),
            totalValue: decimalForInput(row.totalValue ?? ''),
            categoryId: row.categoryId ?? '',
            note: row.note,
          }
        : {}),
      ...selection.initial,
    });
    this.selection.set(selection);
    this.scope.commit();
    this.message.set('');
    this.sentPayload = '';
    if (selection.mode !== 'movement')
      afterNextRender(() => this.heading()?.nativeElement.focus(), { injector: this.injector });
  }
  update<K extends keyof typeof blank>(key: K, value: (typeof blank)[K]) {
    this.draft.update((d) => ({ ...d, [key]: value }));
  }
  changeOpeningSource(value: 'openingExternal' | 'openingBudget') {
    this.update('openingSource', value);
    this.update('kind', value);
  }
  selectMovement(position: AssetPosition, kind: MovementKind): void {
    const previous = this.primary();
    const held = this.balances()?.positions.find((p) => p.id === position.id);
    this.draft.update((d) => ({
      ...d,
      positionId: position.id,
      kind,
      amount: previous?.currency === position.currency ? d.amount : '',
      quantity: previous?.id === position.id ? d.quantity : '',
      totalValue: previous?.id === position.id ? d.totalValue : '',
      openingSource: '',
    }));
    if (!this.counter() && !this.external()) this.update('counterPositionId', '');
    if (
      kind === 'reconcile' &&
      held?.originalValue &&
      !Number(held.quantity) &&
      Number(held.originalValue) > 0 &&
      isSecurity(held.kind)
    )
      this.update('totalValue', decimalForInput(held.originalValue));
    this.message.set('');
  }
  close() {
    if (this.busy()) return;
    if (this.selection()?.mode === 'movement') {
      this.closed.emit();
    } else if (this.scope.confirmDiscard()) {
      this.discard();
      this.closed.emit();
    }
  }
  discard() {
    this.selection.set(null);
    this.message.set('');
    this.scope.commit();
  }
  save() {
    const s = this.selection(),
      d = this.draft();
    if (!s || this.busy()) return;
    let operation: Observable<unknown>;
    if (s.mode === 'location') {
      if (!d.name.trim()) return this.invalid();
      operation = this.api.saveLocation(s.location?.id ?? null, d.name.trim());
    } else if (s.mode === 'position') {
      if (
        !d.name.trim() ||
        !d.locationId ||
        (isSecurity(d.positionKind) && (!d.instrument.trim() || !d.venue.trim())) ||
        ((d.positionKind === 'savings' || d.positionKind === 'deposit') &&
          d.annualRate &&
          !decimal.test(d.annualRate.replace(',', '.')))
      )
        return this.invalid();
      operation = this.api.savePosition(s.position?.id ?? null, {
        name: d.name.trim(),
        kind: d.positionKind,
        locationId: d.locationId,
        currency: d.currency,
        instrument: isSecurity(d.positionKind)
          ? d.instrument.trim()
          : (s.position?.instrument ?? ''),
        venue: isSecurity(d.positionKind) ? d.venue.trim() : (s.position?.venue ?? ''),
        annualRate: ['savings', 'deposit'].includes(d.positionKind)
          ? d.annualRate.replace(',', '.') || null
          : null,
        maturesOn: ['savings', 'deposit'].includes(d.positionKind) ? d.maturesOn || null : null,
      });
    } else {
      if (
        (this.opening() && !d.openingSource) ||
        (this.needsBudgetPreview() && !this.budgetPreview()) ||
        !d.onDate ||
        d.onDate > this.today() ||
        !this.primary() ||
        (this.needsCounter() && !this.counter() && !this.external()) ||
        this.needsHolding()
      )
        return this.invalid();
      const row: AssetMovementDraft = {
        kind: d.kind,
        onDate: d.onDate,
        positionId: d.positionId,
        counterPositionId: this.needsCounter() && !this.external() ? d.counterPositionId : null,
        ...(this.external() && { externalFunds: true }),
        amount: null,
        counterAmount: null,
        quantity: null,
        totalValue: null,
        categoryId: d.kind === 'payoutToBudget' ? d.categoryId || null : null,
        note: d.note.trim(),
      };
      for (const field of this.numericFields()) {
        const value = d[field].trim().replace(',', '.');
        if (!this.numericRequired(field) && !value) continue;
        if (!decimal.test(value) || (this.trade() && Number(value) <= 0)) return this.invalid();
        row[field] = value;
      }
      const serialized = JSON.stringify(row);
      if (!s.movement && this.sentPayload !== serialized) {
        const requestId = this.document.defaultView?.crypto?.randomUUID?.();
        if (!requestId) {
          this.message.set('finance.error.save');
          return;
        }
        this.requestId = requestId;
        this.sentPayload = serialized;
      }
      operation = s.movement
        ? this.api.updateMovement(s.movement, row)
        : this.api.createMovement(this.requestId, row);
    }
    this.busy.set(true);
    this.message.set('');
    operation.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busy.set(false);
        this.discard();
        this.saved.emit(
          s.mode === 'movement' &&
            (movementAffectsBudget(d.kind) ||
              (!!s.movement && movementAffectsBudget(s.movement.kind))),
        );
      },
      error: (error) => {
        this.busy.set(false);
        this.message.set(
          error.status === 409
            ? 'finance.error.conflict'
            : error.status === 503
              ? 'finance.error.rate'
              : 'finance.error.save',
        );
      },
    });
  }
  private invalid() {
    this.message.set('finance.assets.invalid');
  }
}
