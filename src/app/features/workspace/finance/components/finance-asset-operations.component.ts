import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ModalDialogDirective, SiteSelectComponent } from '@alittlemore.dev/design-system';
import { forkJoin, Subscription } from 'rxjs';
import { Temporal } from 'temporal-polyfill';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { UnsavedChangesService } from '../../../../core/unsaved-changes/unsaved-changes.service';
import {
  AssetLocation,
  AssetMovement,
  AssetMovementDraft,
  AssetRevision,
  AssetValuation,
  isAssetCounter,
  isManualFlow,
  isSecurity,
  MovementKind,
  AssetPosition,
} from '../models/finance-assets.model';
import { FinanceCurrency, FinanceMonth, FinanceTransactionEntry } from '../models/finance.model';
import { FinanceAssetsService } from '../services/finance-assets.service';
import { financeChartColors } from '../utils/finance-chart-colors';
import { adjustFinanceAmount, decimalForInput } from '../utils/finance-decimal';
import { formatFinanceDateTime, formatFinanceMoney } from '../utils/finance-format';
import { formatFinanceDate } from '../utils/finance-time';
import {
  AssetEditorComponent,
  AssetEditorSelection,
  movementAffectsBudget,
} from './asset-editor.component';
import {
  FinanceOperationListComponent,
  FinanceOperationRow,
} from './finance-operation-list.component';
import { FinanceTransactionEntryComponent } from './finance-transaction-entry.component';

interface Operations {
  locations: AssetLocation[];
  valuation: AssetValuation;
  movements: AssetMovement[];
}
@Component({
  selector: 'app-finance-asset-operations',
  imports: [
    AssetEditorComponent,
    FinanceOperationListComponent,
    FinanceTransactionEntryComponent,
    ModalDialogDirective,
    SiteSelectComponent,
    TranslatePipe,
  ],
  templateUrl: './finance-asset-operations.component.html',
  styleUrl: './finance-asset-operations.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinanceAssetOperationsComponent {
  private readonly api = inject(FinanceAssetsService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly changes = inject(UnsavedChangesService);
  private readonly scope = this.changes.createScope(this.destroyRef);
  private readonly i18n = inject(I18nService);
  readonly month = input<FinanceMonth | null>(null);
  readonly selectedMonth = input<string>();
  readonly fallbackCurrency = input<FinanceCurrency>('RUB');
  private readonly currency = computed(() => this.month()?.currency ?? this.fallbackCurrency());
  readonly budgetAvailable = computed(() => this.month() !== null && this.canWriteBudget());
  readonly timeZone = input.required<string>();
  readonly includeDeleted = input(false);
  readonly canWriteBudget = input(true);
  readonly budgetChanged = output<void>();
  readonly today = computed(() =>
    Temporal.Now.zonedDateTimeISO(this.timeZone()).toPlainDate().toString(),
  );
  readonly currentMonth = computed(() =>
    Temporal.Now.zonedDateTimeISO(this.month()?.timezoneName ?? this.timeZone())
      .toPlainDate()
      .toPlainYearMonth()
      .toString(),
  );
  readonly start = computed(
    () => this.selectedMonth() ?? this.month()?.periodStart ?? this.today().slice(0, 7) + '-01',
  );
  readonly end = computed(() => {
    const first = Temporal.PlainDate.from(this.start());
    const last = first.with({ day: first.daysInMonth }).toString();
    return last < this.today() ? last : this.today();
  });
  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly positionFilter = computed(() => this.query().get('assetPosition'));
  readonly fromReport = computed(
    () => !!this.query().get('assetJournal') || !!this.positionFilter(),
  );
  readonly data = signal<Operations | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly editorError = signal('');
  readonly saving = signal(false);
  readonly refresh = signal(0);
  readonly historyId = signal<string | null>(null);
  private historyRequest?: Subscription;
  private readonly revisions = signal<AssetRevision[]>([]);
  readonly historyLoading = signal(false);
  readonly historyError = signal<string | null>(null);
  readonly editing = signal(false);
  readonly movement = signal<AssetMovement | null>(null);
  readonly positionId = signal('');
  readonly kind = signal<MovementKind>('depositExternal');
  readonly manual = signal<FinanceTransactionEntry | null>(null);
  readonly advanced = signal<AssetEditorSelection | null>(null);
  readonly advancedForm = viewChild(AssetEditorComponent);
  private readonly entry = viewChild(FinanceTransactionEntryComponent);
  private readonly dialog = viewChild(ModalDialogDirective);
  readonly draft = signal<FinanceTransactionEntry | null>(null);
  private currencyChosen = false;
  private readonly formState = this.scope.registerSource(
    computed(() => [this.positionId(), this.kind(), this.draft()]),
    this.editing,
  );
  readonly dirty = computed(() => this.formState.hasChanges() || !!this.advancedForm()?.dirty());
  readonly busy = computed(() => this.saving() || !!this.advancedForm()?.busy());
  private retry?: { key: string; id: string };
  readonly assets = computed(() => new Map(this.data()?.valuation.positions.map((p) => [p.id, p])));
  readonly position = computed(() => this.assets().get(this.positionId()));
  readonly choices = computed(() =>
    [...this.assets().values()].filter((p) => !p.archived || p.id === this.movement()?.positionId),
  );
  readonly positionOptions = computed(() => [
    ...(this.position()
      ? []
      : [{ value: '', label: this.i18n.translate('finance.assets.chooseAsset') }]),
    ...this.choices().map((p) => ({
      value: p.id,
      label: this.positionName(p.id) + ' · ' + this.i18n.translate('finance.assets.kind.' + p.kind),
    })),
  ]);
  private actions(position: AssetPosition): MovementKind[] {
    const kinds: MovementKind[] = isSecurity(position.kind)
      ? ['buy', 'sell', 'valuation', 'reconcile', 'buyFromBudget', 'payoutToBudget']
      : position.kind === 'other'
        ? ['valuation', 'reconcile', 'payoutToBudget']
        : [
            'depositExternal',
            'withdrawExternal',
            'reconcile',
            'transfer',
            'exchange',
            'contribution',
            'withdrawal',
            'payout',
            'payoutToBudget',
            'fee',
            'valuation',
          ];
    kinds.push('openingExternal', 'statement');
    return kinds.filter((kind) => {
      if (!this.budgetAvailable() && movementAffectsBudget(kind)) return false;
      if (kind === 'transfer' || kind === 'exchange') {
        return [...this.assets().values()].some((candidate) =>
          isAssetCounter(candidate, position, kind, this.movement()?.counterPositionId),
        );
      }
      return true;
    });
  }
  readonly kindOptions = computed(() =>
    (this.position() ? this.actions(this.position()!) : []).map((value) => ({
      value,
      label: this.i18n.translate('finance.assets.action.' + value),
    })),
  );
  readonly canAdd = computed(() => {
    const filter = this.positionFilter();
    return [...this.assets().values()].some((p) => !p.archived && (!filter || p.id === filter));
  });
  readonly rows = computed<FinanceOperationRow<AssetMovement>[]>(() => {
    const ids = [...this.assets().keys()];
    const palette = financeChartColors(ids.length);
    const colors = new Map(ids.map((id, index) => [id, palette[index]]));
    const filter = this.positionFilter();
    return [...(this.data()?.movements ?? [])]
      .reverse()
      .filter(
        (row) =>
          (this.includeDeleted() || !row.deleted) &&
          (!filter || row.positionId === filter || row.counterPositionId === filter),
      )
      .map((row) => ({
        item: row,
        id: row.id,
        date: row.onDate,
        displayDate: this.date(row.onDate),
        label: this.positionName(row.positionId),
        color: colors.get(row.positionId),
        description: [
          this.i18n.translate('finance.assets.action.' + row.kind),
          row.externalFunds
            ? this.i18n.translate('finance.assets.outsideTracker')
            : row.counterPositionId
              ? this.positionName(row.counterPositionId)
              : '',
        ]
          .filter(Boolean)
          .join(' · '),
        caption: row.note,
        ...this.amounts(row),
        deleted: row.deleted,
        editable: this.canChange(row),
        repeatable: isManualFlow(row.kind) && !this.assets().get(row.positionId)?.archived,
      }));
  });
  readonly historyRows = computed(() =>
    this.revisions().map((row) => {
      const { amount, secondaryAmount } = this.amounts(row);
      return {
        number: row.version,
        heading: [
          this.i18n.translate('finance.assets.revision') + ' ' + row.version,
          this.i18n.translate('finance.assets.action.' + row.kind),
          row.deleted ? this.i18n.translate('finance.assets.cancelled') : '',
          formatFinanceDateTime(row.changedAt, this.i18n.dateLocale(), this.timeZone()),
        ]
          .filter(Boolean)
          .join(' · '),
        detail: [
          this.date(row.onDate),
          this.positionName(row.positionId),
          row.externalFunds
            ? this.i18n.translate('finance.assets.outsideTracker')
            : row.counterPositionId
              ? this.positionName(row.counterPositionId)
              : '',
          amount,
          secondaryAmount,
          row.source === 'pat' ? 'API' : this.i18n.translate('finance.transaction.source.web'),
          row.note,
        ]
          .filter(Boolean)
          .join(' · '),
      };
    }),
  );
  readonly total = computed(() => {
    const value = this.data()?.valuation;
    return value
      ? formatFinanceMoney(value.knownValue, value.currency, this.i18n.dateLocale())
      : this.i18n.translate('finance.notSet');
  });

  constructor() {
    let lastKey = '';
    effect((cleanup) => {
      this.refresh();
      const start = this.start(),
        end = this.end(),
        currency = this.currency();
      const key = [start, end, currency].join('/');
      if (key !== lastKey) {
        lastKey = key;
        this.data.set(null);
        untracked(() => this.closeHistory());
      }
      this.loading.set(true);
      this.error.set('');
      const request = forkJoin({
        locations: this.api.locations(),
        valuation: this.api.positions(end, currency),
        movements: this.api.movements(start, end),
      }).subscribe({
        next: (data) => {
          this.data.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('finance.error.load');
        },
      });
      cleanup(() => request.unsubscribe());
    });
  }

  positionName(id: string): string {
    const position = this.assets().get(id);
    if (!position) return this.i18n.translate('finance.notSet');
    const sameName = [...this.assets().values()].some(
      (p) => p.id !== id && p.name === position.name,
    );
    const location =
      sameName && this.data()?.locations.find((loc) => loc.id === position.locationId);
    return location ? location.name + ' · ' + position.name : position.name;
  }
  private canChange(row: AssetMovement): boolean {
    if (!movementAffectsBudget(row.kind)) return true;
    if (!this.budgetAvailable()) return false;
    return (
      row.onDate.slice(0, 7) === this.currentMonth() ||
      !row.createdAt ||
      Temporal.Instant.from(row.createdAt)
        .toZonedDateTimeISO(this.month()?.timezoneName ?? this.timeZone())
        .toPlainDate()
        .toPlainYearMonth()
        .toString() === this.currentMonth()
    );
  }
  private date(day: string): string {
    return formatFinanceDate(day, this.i18n.dateLocale(), this.timeZone());
  }
  private amounts(row: AssetRevision): { amount: string; secondaryAmount?: string } {
    const position = this.assets().get(row.positionId);
    const counter = row.counterPositionId && this.assets().get(row.counterPositionId);
    const value = row.amount ?? row.totalValue;
    const prefix =
      row.kind === 'withdrawExternal' ? '−' : row.kind === 'depositExternal' ? '+' : '';
    const money = (amount: string, currency: FinanceCurrency) =>
      prefix + formatFinanceMoney(amount, currency, this.i18n.dateLocale());
    if (row.enteredCurrency && row.enteredAmount != null) {
      return {
        amount: money(row.enteredAmount, row.enteredCurrency),
        secondaryAmount:
          position && position.currency !== row.enteredCurrency && value !== null
            ? money(value, position.currency)
            : undefined,
      };
    }
    const amounts = [];
    if (position && value !== null) {
      amounts.push(money(value, position.currency));
    }
    if (counter && row.counterAmount !== null)
      amounts.push(formatFinanceMoney(row.counterAmount, counter.currency, this.i18n.dateLocale()));
    if (row.quantity !== null)
      amounts.push(
        this.i18n.translate('finance.assets.quantity') +
          ' ' +
          new Intl.NumberFormat(this.i18n.dateLocale(), { maximumFractionDigits: 12 }).format(
            Number(row.quantity),
          ),
      );
    return { amount: amounts.join(' / ') || this.i18n.translate('finance.notSet') };
  }
  returnReport(): void {
    if (!this.leave()) return;
    const month = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(this.query().get('assetReportMonth') ?? '');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParamsHandling: 'merge',
      queryParams: {
        tab: 'assets',
        assetJournal: null,
        assetPosition: null,
        assetReportMonth: null,
        ...(month ? { year: Number(month[1]), month: Number(month[2]) } : {}),
      },
    });
  }
  overview(): void {
    // Position management lives in the editable current overview, even when viewing older history.
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParamsHandling: 'merge',
      queryParams: {
        tab: 'overview',
        assetReportMonth: null,
        assetJournal: null,
        assetPosition: null,
        year: null,
        month: null,
      },
      fragment: 'finance-new-asset',
    });
  }
  showHistory(movement: AssetMovement): void {
    const opened = this.historyId() === movement.id;
    this.closeHistory();
    if (opened) return;
    this.historyId.set(movement.id);
    this.historyLoading.set(true);
    this.historyRequest = this.api
      .revisions(movement.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.revisions.set(rows);
          this.historyLoading.set(false);
        },
        error: () => {
          this.historyError.set('finance.error.load');
          this.historyLoading.set(false);
        },
      });
  }
  closeHistory(): void {
    this.historyRequest?.unsubscribe();
    this.historyId.set(null);
    this.historyLoading.set(false);
    this.revisions.set([]);
    this.historyError.set(null);
  }
  edit(row: AssetMovement | null = null, repeat = false): void {
    if (this.busy() || this.loading() || (!row && !this.canAdd())) return;
    this.retry = undefined;
    this.editorError.set('');
    this.editing.set(true);
    this.movement.set(repeat ? null : row);
    this.currencyChosen =
      !!row?.enteredCurrency && row.enteredCurrency !== this.assets().get(row.positionId)?.currency;
    const choices = this.choices();
    const position = row
      ? this.assets().get(row.positionId)
      : (choices.find((p) => p.id === this.positionFilter()) ??
        (choices.length === 1 ? choices[0] : undefined));
    if (position) {
      const kind = row?.kind ?? this.actions(position)[0];
      this.positionId.set(position.id);
      this.kind.set(kind);
      if (isManualFlow(kind)) {
        this.setManual({
          categoryId: position.id,
          amount: decimalForInput(row?.enteredAmount ?? row?.amount ?? ''),
          dateTime: row && !repeat ? row.onDate : this.end(),
          currency: row?.enteredCurrency ?? position.currency,
          description: row?.note ?? '',
        });
      } else {
        this.advanced.set({ mode: 'movement', position, kind, movement: row ?? undefined });
      }
    }
    this.formState.commit();
    this.changeDetector.detectChanges();
    this.dialog()?.open();
  }

  choosePosition(id: string): void {
    const position = this.choices().find((p) => p.id === id);
    if (!position || id === this.positionId() || this.busy()) return;
    const allowed = this.actions(position);
    const kind = this.positionId() && allowed.includes(this.kind()) ? this.kind() : allowed[0];
    this.selectContext(position, kind);
  }

  chooseKind(value: string): void {
    const position = this.position();
    const kind = position && this.actions(position).find((k) => k === value);
    if (this.busy() || !position || !kind || kind === this.kind()) return;
    this.selectContext(position, kind);
  }

  private selectContext(position: AssetPosition, kind: MovementKind): void {
    const previous = this.position();
    const advanced = this.advancedForm()?.draft();
    const manual = this.draft();
    const date = manual?.dateTime ?? advanced?.onDate ?? this.end();
    const description = manual?.description ?? advanced?.note ?? '';
    const amount =
      manual?.amount ??
      (advanced?.kind === 'valuation' ? advanced.totalValue : advanced?.amount) ??
      '';
    this.currencyChosen ||= !!this.entry()?.form.controls.currency.dirty;
    this.positionId.set(position.id);
    this.kind.set(kind);
    this.editorError.set('');
    if (isManualFlow(kind)) {
      const currency =
        manual && this.currencyChosen
          ? manual.currency
          : previous && advanced && amount
            ? previous.currency
            : position.currency;
      this.setManual({ categoryId: position.id, dateTime: date, currency, description, amount });
      return;
    }
    if (advanced) {
      this.advancedForm()?.selectMovement(position, kind);
    } else {
      this.advanced.set({
        mode: 'movement',
        position,
        kind,
        movement: this.movement() ?? undefined,
        initial: {
          onDate: date,
          note: description,
          amount: manual?.currency === position.currency ? amount : '',
        },
      });
    }
    this.manual.set(null);
    this.draft.set(null);
    this.currencyChosen = false;
  }

  private setManual(entry: FinanceTransactionEntry): void {
    this.advanced.set(null);
    this.manual.set(entry);
    this.draft.set(entry);
  }
  leave(): boolean {
    if (this.busy() || (this.dirty() && !this.changes.confirmDiscard())) return false;
    this.close();
    return true;
  }
  close(): void {
    this.editing.set(false);
    this.positionId.set('');
    this.movement.set(null);
    this.manual.set(null);
    this.advanced.set(null);
    this.draft.set(null);
    this.editorError.set('');
    this.dialog()?.close();
  }
  save(entry: FinanceTransactionEntry): void {
    const movement = this.movement();
    const kind = this.kind();
    if (this.busy() || !this.manual() || !isManualFlow(kind)) return;
    const position = this.position();
    if (
      !position ||
      position.id !== entry.categoryId ||
      entry.dateTime < this.start() ||
      entry.dateTime > this.end()
    ) {
      this.editorError.set('finance.assets.invalid');
      return;
    }
    const enteredAmount = entry.amount.trim().replace(',', '.');
    const draft: AssetMovementDraft = {
      kind,
      onDate: entry.dateTime,
      positionId: position.id,
      amount: null,
      enteredAmount,
      enteredCurrency: entry.currency,
      note: entry.description.trim(),
      counterPositionId: null,
      counterAmount: null,
      categoryId: null,
      totalValue: null,
      quantity: null,
    };
    let operation;
    if (movement) operation = this.api.updateMovement(movement, draft);
    else {
      const key = JSON.stringify(draft);
      if (this.retry?.key !== key) {
        const id = this.document.defaultView?.crypto?.randomUUID?.();
        if (!id) {
          this.editorError.set('finance.error.save');
          return;
        }
        this.retry = { key, id };
      }
      operation = this.api.createMovement(this.retry.id, draft);
    }
    this.saving.set(true);
    this.editorError.set('');
    operation.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved(!!movement && movementAffectsBudget(movement.kind));
      },
      error: (e) => {
        this.saving.set(false);
        const balance = this.data()?.valuation.positions.find(
          (p) => p.id === position.id,
        )?.originalValue;
        const insufficient =
          e.status === 409 &&
          !movement &&
          draft.kind === 'withdrawExternal' &&
          draft.onDate === this.end() &&
          balance != null &&
          entry.currency === position.currency &&
          adjustFinanceAmount(balance, enteredAmount, true).startsWith('-');
        this.editorError.set(
          insufficient
            ? 'finance.assets.insufficientBalance'
            : e.status === 503
              ? 'finance.error.rate'
              : e.status === 409
                ? 'finance.error.conflict'
                : 'finance.error.save',
        );
      },
    });
  }
  saved(budget: boolean): void {
    this.close();
    this.closeHistory();
    this.refresh.update((n) => n + 1);
    if (budget) this.budgetChanged.emit();
  }
  toggle(row: AssetMovement): void {
    if (this.busy()) return;
    this.saving.set(true);
    this.api
      .toggleDeleted(row)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.saved(movementAffectsBudget(row.kind));
        },
        error: (e) => {
          this.saving.set(false);
          this.error.set(e.status === 409 ? 'finance.error.conflict' : 'finance.error.save');
        },
      });
  }
}
