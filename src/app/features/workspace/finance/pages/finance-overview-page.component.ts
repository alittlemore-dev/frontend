import {
  ModalDialogDirective,
  SiteSelectComponent,
  SiteSelectOption,
} from '@alittlemore.dev/design-system';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  untracked,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription, of, switchMap } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { UnsavedChangesService } from '../../../../core/unsaved-changes/unsaved-changes.service';
import { Temporal } from 'temporal-polyfill';

import { I18nService } from '../../../../core/i18n/i18n.service';
import { AccountSettingsService } from '../../../../core/auth/account-settings.service';
import { financeMonthTimeRange } from '../utils/finance-time';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { ApiError } from '../../../../core/models/api-error.model';
import {
  FINANCE_CURRENCY_SYMBOLS,
  FinanceCategory,
  FinanceCurrency,
  FinanceKind,
  FinanceMonth,
  FinanceRevision,
  FinanceTransaction,
  FinanceTransactionDraft,
  FinanceTransactionEntry,
  FinanceTransactionEditor,
} from '../models/finance.model';
import { FinanceService } from '../services/finance.service';
import {
  formatFinanceAmount,
  formatFinanceDateTime,
  formatFinanceMoney,
} from '../utils/finance-format';
import { FinanceBudgetColumnComponent } from '../components/finance-budget-column.component';
import { FinanceTransactionsColumnComponent } from '../components/finance-transactions-column.component';
import { FinanceTransactionEntryComponent } from '../components/finance-transaction-entry.component';

function decimalForInput(value: string): string {
  const match = /^([+-]?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(value);
  if (!match) return value;
  const [, sign, integer, fraction = '', exponent = '0'] = match;
  const digits = integer + fraction;
  if (/^0+$/.test(digits)) return '0';
  const shift = Number(exponent);
  if (!Number.isInteger(shift) || Math.abs(shift) > 30) return value;
  const point = integer.length + shift;
  let whole: string;
  let decimal: string;
  if (point <= 0) {
    whole = '0';
    decimal = '0'.repeat(-point) + digits;
  } else if (point >= digits.length) {
    whole = digits + '0'.repeat(point - digits.length);
    decimal = '';
  } else {
    whole = digits.slice(0, point);
    decimal = digits.slice(point);
  }
  whole = whole.replace(/^0+(?=\d)/, '');
  decimal = decimal.replace(/0+$/, '');
  return `${sign === '-' ? '-' : ''}${whole}${decimal ? `.${decimal}` : ''}`;
}

@Component({
  selector: 'app-finance-overview-page',
  standalone: true,
  imports: [
    FormsModule,
    ModalDialogDirective,
    FinanceTransactionsColumnComponent,
    FinanceTransactionEntryComponent,
    FinanceBudgetColumnComponent,
    SiteSelectComponent,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './finance-overview-page.component.html',
  styleUrl: './finance-overview-page.component.scss',
})
export class FinanceOverviewPageComponent implements OnInit {
  private readonly service = inject(FinanceService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly changes = inject(UnsavedChangesService);
  private readonly scope = this.changes.createScope(inject(DestroyRef));
  readonly i18n = inject(I18nService);
  private readonly preferences = inject(AccountSettingsService);
  readonly timeZone = signal(this.preferences.timeZone());
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private initializationSubscription?: Subscription;
  private transactionsSubscription?: Subscription;
  private revisionsSubscription?: Subscription;

  readonly currencies: readonly FinanceCurrency[] = ['AMD', 'RUB', 'USD', 'EUR'];
  readonly currencySymbols = FINANCE_CURRENCY_SYMBOLS;
  readonly kinds: readonly FinanceKind[] = ['expense', 'income'];
  readonly month = signal<FinanceMonth | null>(null);
  readonly currentPeriod = signal<string | null>(null);
  readonly selectedPeriod = signal<string | null>(null);
  readonly readOnly = computed(() => this.selectedPeriod() !== this.currentPeriod());
  readonly canWriteTransactions = computed(() => {
    const current = this.currentPeriod();
    const selected = this.selectedPeriod();
    return (
      current !== null &&
      selected !== null &&
      (selected === current ||
        Temporal.PlainDate.from(selected).add({ months: 1 }).toString() === current)
    );
  });
  readonly editableIds = computed(() =>
    this.transactions()
      .filter((row) => this.canEditTransaction(row))
      .map((row) => row.id),
  );
  readonly empty = signal(false);
  readonly navigationNotice = signal(false);
  private readonly editorBaseline = signal('');
  readonly transactionDraft = signal<FinanceTransactionEntry | null>(null);
  readonly transactionDirty = computed(
    () =>
      this.transactionEditor() !== null &&
      JSON.stringify(this.transactionDraft()) !== this.editorBaseline(),
  );
  private discardApproved = false;
  readonly transactions = signal<readonly FinanceTransaction[]>([]);
  readonly revisions = signal<readonly FinanceRevision[]>([]);
  readonly revisionsLoading = signal(false);
  readonly revisionsErrorKey = signal<string | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly errorKey = signal<string | null>(null);
  readonly tab = signal<'summary' | 'transactions'>('summary');
  readonly includeDeleted = signal(false);
  readonly openingDraft = signal('');
  readonly currencyDraft = signal<FinanceCurrency>('USD');
  readonly categoryDrafts = signal<Record<string, { name: string; plan: string }>>({});
  readonly newCategoryDrafts = signal<Record<FinanceKind, { name: string; plan: string }>>({
    expense: { name: '', plan: '' },
    income: { name: '', plan: '' },
  });
  readonly transactionEditor = signal<FinanceTransactionEditor | null>(null);
  readonly categoryToRemove = signal<FinanceCategory | null>(null);
  private readonly removalDialog = viewChild('removalDialog', { read: ModalDialogDirective });
  private readonly transactionDialog = viewChild('transactionDialog', {
    read: ModalDialogDirective,
  });
  readonly revisionsFor = signal<FinanceTransaction | null>(null);

  readonly incomeCategories = computed(() => this.sortedCategories('income'));
  readonly expenseCategories = computed(() => this.sortedCategories('expense'));
  readonly transactionEditorCategories = computed(() => {
    const editor = this.transactionEditor();
    if (editor === null) return [];
    return (this.month()?.categories ?? []).filter(
      (category) =>
        category.kind === editor.kind &&
        (!category.archived || category.id === editor.transaction?.categoryId),
    );
  });
  readonly incomeTransactions = computed(() =>
    this.transactions().filter((row) => row.kind === 'income'),
  );
  readonly expenseTransactions = computed(() =>
    this.transactions().filter((row) => row.kind === 'expense'),
  );
  readonly currencyOptions: readonly SiteSelectOption[] = this.currencies.map((currency) => ({
    value: currency,
    label: FINANCE_CURRENCY_SYMBOLS[currency],
  }));
  readonly monthLabel = computed(() => {
    this.i18n.language();
    const period = this.selectedPeriod();
    return period === null
      ? ''
      : new Intl.DateTimeFormat(this.i18n.dateLocale(), {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        }).format(new Date(`${period}T00:00:00Z`));
  });
  readonly transactionTimeRange = computed(() => {
    const month = this.month();
    return month === null ? null : financeMonthTimeRange(month.periodStart, this.timeZone());
  });
  readonly earliestTime = computed(() => {
    const min = this.transactionTimeRange()?.min ?? '';
    const editor = this.transactionEditor();
    return editor?.transaction && editor.entry.dateTime < min ? editor.entry.dateTime : min;
  });
  readonly latestTime = computed(() => {
    const max = this.transactionTimeRange()?.max ?? '';
    const editor = this.transactionEditor();
    return editor?.transaction && editor.entry.dateTime > max ? editor.entry.dateTime : max;
  });

  constructor() {
    effect(() => {
      const zone = this.preferences.timeZone();
      if (zone === this.timeZone() || this.saving() || this.transactionEditor() || this.dirty())
        return;
      // Finish an in-progress draft in its original zone before refreshing month boundaries.
      untracked(() => {
        this.timeZone.set(zone);
        this.initialize();
      });
    });
  }

  ngOnInit(): void {
    this.scope.registerSource(
      computed(() => this.dirty()),
      computed(() => !this.readOnly() || this.canWriteTransactions()),
    );
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      const requested = this.routePeriod();
      if (this.currentPeriod() !== null && requested !== this.selectedPeriod()) {
        if (this.saving() || (!this.discardApproved && !this.scope.confirmDiscard())) {
          this.writePeriod(this.selectedPeriod(), true);
          return;
        }
      }
      this.discardApproved = false;
      this.initialize();
    });
  }

  private routePeriod(): string | null {
    const params = this.route.snapshot.queryParamMap;
    const year = params.get('year');
    const month = params.get('month');
    if (year === null && month === null) return this.currentPeriod();
    if (
      params.getAll('year').length !== 1 ||
      params.getAll('month').length !== 1 ||
      !/^\d{1,4}$/.test(year ?? '') ||
      !/^\d{1,2}$/.test(month ?? '')
    )
      return null;
    try {
      const period = Temporal.PlainDate.from(
        { year: Number(year), month: Number(month), day: 1 },
        { overflow: 'reject' },
      ).toString();
      if (Number(year) < 1 || (this.currentPeriod() !== null && period > this.currentPeriod()!))
        return null;
      return period;
    } catch {
      return null;
    }
  }

  private writePeriod(period: string | null, replaceUrl: boolean): void {
    const date = period === null ? null : Temporal.PlainDate.from(period);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParamsHandling: 'merge',
      replaceUrl,
      queryParams: { year: date?.year ?? null, month: date?.month ?? null },
    });
  }

  navigateMonth(offset: number): void {
    const selected = this.selectedPeriod();
    if (!selected || this.saving() || this.loading() || !this.scope.confirmDiscard()) return;
    const next = Temporal.PlainDate.from(selected).add({ months: offset });
    if (next.year < 1 || next.toString() > this.currentPeriod()!) return;
    this.discardApproved = true;
    this.writePeriod(next.toString(), false);
  }

  returnToCurrent(): void {
    if (this.saving() || this.loading() || !this.readOnly() || !this.scope.confirmDiscard()) return;
    this.discardApproved = true;
    this.writePeriod(null, false);
  }

  private dirty(): boolean {
    const month = this.month();
    if (month === null) return false;
    return (
      this.openingDraft() !== decimalForInput(month.openingBalance) ||
      month.categories.some((category) => {
        const draft = this.categoryDrafts()[category.id];
        return (
          draft &&
          (draft.name !== category.name ||
            draft.plan !==
              (category.plannedAmount === null ? '' : decimalForInput(category.plannedAmount)))
        );
      }) ||
      Object.values(this.newCategoryDrafts()).some((draft) => !!draft.name || !!draft.plan) ||
      this.transactionDirty()
    );
  }

  initialize(): void {
    if (this.saving()) return;
    const language = this.i18n.language();
    if (language !== 'ru' && language !== 'en') {
      this.loading.set(false);
      this.errorKey.set('finance.error.load');
      return;
    }
    this.loading.set(true);
    this.empty.set(false);
    this.errorKey.set(null);
    this.transactionsSubscription?.unsubscribe();
    this.closeRevisions();
    this.initializationSubscription?.unsubscribe();
    this.initializationSubscription = this.service
      .ensure(language)
      .pipe(
        switchMap((current) => {
          this.currentPeriod.set(current.periodStart);
          const selected = this.routePeriod();
          if (selected === null) {
            this.navigationNotice.set(true);
            this.writePeriod(null, true);
          }
          const period = selected ?? current.periodStart;
          if (period !== this.selectedPeriod()) {
            this.transactionDialog()?.close();
            this.removalDialog()?.close();
            this.categoryToRemove.set(null);
            this.transactionDraft.set(null);
            this.month.set(null);
            this.transactions.set([]);
            this.newCategoryDrafts.set({
              income: { name: '', plan: '' },
              expense: { name: '', plan: '' },
            });
            this.transactionEditor.set(null);
          }
          this.selectedPeriod.set(period);
          return period === current.periodStart
            ? of(current)
            : this.service.historicalMonth(period);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (month) => {
          this.receiveMonth(month);
          this.loading.set(false);
          this.loadTransactions();
        },
        error: (error: ApiError) => {
          if (error.status === 404 && this.readOnly()) {
            this.month.set(null);
            this.empty.set(true);
          } else this.errorKey.set(this.errorFor(error, 'finance.error.load'));
          this.loading.set(false);
        },
      });
  }

  private receiveMonth(month: FinanceMonth): void {
    const previous = this.month();
    const samePeriod = previous !== null && previous.periodStart === month.periodStart;
    const openingDraft = this.openingDraft();
    const drafts = this.categoryDrafts();
    this.month.set(month);
    this.openingDraft.set(
      samePeriod && openingDraft !== decimalForInput(previous.openingBalance)
        ? openingDraft
        : decimalForInput(month.openingBalance),
    );
    this.currencyDraft.set(month.currency);
    this.categoryDrafts.set(
      Object.fromEntries(
        month.categories.map((category) => {
          const before = samePeriod
            ? previous.categories.find((row) => row.id === category.id)
            : undefined;
          const draft = drafts[category.id];
          return [
            category.id,
            {
              name: before && draft && draft.name !== before.name ? draft.name : category.name,
              plan:
                before &&
                draft &&
                draft.plan !==
                  (before.plannedAmount === null ? '' : decimalForInput(before.plannedAmount))
                  ? draft.plan
                  : category.plannedAmount === null
                    ? ''
                    : decimalForInput(category.plannedAmount),
            },
          ];
        }),
      ),
    );
  }

  private loadTransactions(): void {
    this.transactionsSubscription?.unsubscribe();
    const operation = this.readOnly()
      ? this.service.historicalTransactions(this.selectedPeriod()!, this.includeDeleted())
      : this.service.transactions(this.includeDeleted());
    this.transactionsSubscription = operation.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows) => this.transactions.set(rows),
      error: (error: ApiError) => this.errorKey.set(this.errorFor(error, 'finance.error.load')),
    });
  }

  setTab(tab: 'summary' | 'transactions'): void {
    this.tab.set(tab);
  }

  setIncludeDeleted(value: boolean): void {
    this.includeDeleted.set(value);
    this.loadTransactions();
  }

  saveOpeningBalance(): void {
    if (this.readOnly()) return;
    const amount = this.openingDraft().trim().replace(',', '.');
    if (amount === decimalForInput(this.month()?.openingBalance ?? '')) return;
    if (!/^[+-]?\d+(?:\.\d+)?$/.test(amount)) {
      this.errorKey.set('finance.error.save');
      return;
    }
    this.mutateMonth(this.service.updateOpeningBalance(amount), () =>
      this.openingDraft.set(decimalForInput(this.month()?.openingBalance ?? '')),
    );
  }

  selectCurrency(value: string): void {
    if (this.readOnly()) return;
    if (this.saving() || !this.isCurrency(value) || value === this.month()?.currency) return;
    this.currencyDraft.set(value);
    this.mutateMonth(this.service.changeCurrency(value));
  }

  categoryDraft(category: FinanceCategory): { name: string; plan: string } {
    return (
      this.categoryDrafts()[category.id] ?? {
        name: category.name,
        plan: category.plannedAmount === null ? '' : decimalForInput(category.plannedAmount),
      }
    );
  }

  updateCategoryDraft(category: FinanceCategory, field: 'name' | 'plan', value: string): void {
    this.categoryDrafts.update((drafts) => ({
      ...drafts,
      [category.id]: { ...this.categoryDraft(category), [field]: value },
    }));
  }

  saveCategoryInline(category: FinanceCategory): void {
    if (this.readOnly()) return;
    const draft = this.categoryDraft(category);
    const name = draft.name.trim();
    const plan = draft.plan.trim() || null;
    if (!name) {
      this.updateCategoryDraft(category, 'name', category.name);
      return;
    }
    if (
      name === category.name &&
      plan === (category.plannedAmount === null ? null : decimalForInput(category.plannedAmount))
    )
      return;
    this.mutateMonth(
      this.service.updateCategory(category.id, name, plan, category.position),
      () => {
        const saved = this.month()?.categories.find((row) => row.id === category.id);
        if (saved) {
          this.categoryDrafts.update((drafts) => ({
            ...drafts,
            [category.id]: {
              name: saved.name,
              plan: saved.plannedAmount === null ? '' : decimalForInput(saved.plannedAmount),
            },
          }));
        }
      },
    );
  }

  updateNewCategoryDraft(kind: FinanceKind, field: 'name' | 'plan', value: string): void {
    this.newCategoryDrafts.update((drafts) => ({
      ...drafts,
      [kind]: { ...drafts[kind], [field]: value },
    }));
  }

  createCategoryInline(kind: FinanceKind): void {
    if (this.readOnly()) return;
    const draft = this.newCategoryDrafts()[kind];
    const name = draft.name.trim();
    if (!name) return;
    this.mutateMonth(this.service.createCategory(kind, name, draft.plan.trim() || null), () => {
      this.newCategoryDrafts.update((drafts) => ({
        ...drafts,
        [kind]: { name: '', plan: '' },
      }));
    });
  }

  setCategoryArchived(category: FinanceCategory, archived: boolean): void {
    if (this.readOnly()) return;
    this.mutateMonth(
      archived
        ? this.service.archiveCategory(category.id)
        : this.service.restoreCategory(category.id),
    );
  }

  openCategoryRemoval(category: FinanceCategory): void {
    if (this.readOnly()) return;
    this.categoryToRemove.set(category);
    this.errorKey.set(null);
    this.removalDialog()?.open();
  }

  closeCategoryRemoval(): void {
    if (this.saving() || this.readOnly()) return;
    this.removalDialog()?.close();
    this.categoryToRemove.set(null);
  }

  removeCategory(permanent: boolean): void {
    const category = this.categoryToRemove();
    if (category === null || this.saving()) return;
    this.mutateMonth(
      permanent
        ? this.service.deleteCategoryPermanently(category.id)
        : this.service.archiveCategory(category.id),
      () => {
        this.closeCategoryRemoval();
      },
    );
  }

  private blankTransactionEntry(): FinanceTransactionEntry {
    const month = this.month();
    if (month === null) throw new Error('Finance month is not loaded');
    const range = this.transactionTimeRange()!;
    const now = Temporal.Now.instant();
    const instant =
      Temporal.Instant.compare(now, range.start) < 0
        ? range.start
        : Temporal.Instant.compare(now, range.end) >= 0
          ? range.end.subtract({ minutes: 1 })
          : now;
    return {
      categoryId: '',
      amount: '',
      currency: month.currency,
      dateTime: instant
        .toZonedDateTimeISO(this.timeZone())
        .toPlainDateTime()
        .toString({ smallestUnit: 'minute' }),
      description: '',
    };
  }

  openTransactionCreation(kind: FinanceKind): void {
    if (this.month() === null || this.saving() || !this.canWriteTransactions()) return;
    this.transactionEditor.set({ kind, transaction: null, entry: this.blankTransactionEntry() });
    this.errorKey.set(null);
    this.transactionDraft.set(this.transactionEditor()?.entry ?? null);
    this.editorBaseline.set(JSON.stringify(this.transactionDraft()));
    this.changeDetector.detectChanges();
    this.transactionDialog()?.open();
  }

  openTransactionEdit(transaction: FinanceTransaction): void {
    const month = this.month();
    if (
      month === null ||
      transaction.deleted ||
      this.saving() ||
      !this.canEditTransaction(transaction)
    )
      return;
    const local = Temporal.Instant.from(transaction.occurredAt).toZonedDateTimeISO(this.timeZone());
    this.transactionEditor.set({
      kind: transaction.kind,
      transaction,
      entry: {
        categoryId: transaction.categoryId ?? '',
        amount: decimalForInput(transaction.amount),
        currency: transaction.currency,
        dateTime: local.toPlainDateTime().toString({ smallestUnit: 'minute' }),
        description: transaction.description,
      },
    });
    this.errorKey.set(null);
    this.transactionDraft.set(this.transactionEditor()?.entry ?? null);
    this.editorBaseline.set(JSON.stringify(this.transactionDraft()));
    this.changeDetector.detectChanges();
    this.transactionDialog()?.open();
  }

  closeTransactionEditor(): void {
    if (this.saving() || (this.transactionDirty() && !this.scope.confirmDiscard())) return;
    this.transactionDialog()?.close();
    this.transactionEditor.set(null);
  }

  cancelTransactionDialog(event: Event): void {
    event.preventDefault();
    this.closeTransactionEditor();
  }

  dismissTransactionBackdrop(event: PointerEvent): void {
    if (event.target !== event.currentTarget || event.button !== 0) return;
    const bounds = (event.currentTarget as HTMLDialogElement).getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      this.closeTransactionEditor();
  }

  private isCurrency(value: string): value is FinanceCurrency {
    return this.currencies.some((currency) => currency === value);
  }

  saveTransaction(entry: FinanceTransactionEntry): void {
    if (!this.canWriteTransactions()) return;
    const month = this.month();
    const editor = this.transactionEditor();
    if (month === null || editor === null || this.saving()) return;
    if (!entry.categoryId || !entry.amount.trim()) {
      this.errorKey.set('finance.error.entry');
      return;
    }
    try {
      const occurredAt =
        editor.transaction && entry.dateTime === editor.entry.dateTime
          ? editor.transaction.occurredAt
          : Temporal.PlainDateTime.from(entry.dateTime)
              .toZonedDateTime(this.timeZone(), { disambiguation: 'reject' })
              .toInstant()
              .toString();
      const instant = Temporal.Instant.from(occurredAt);
      const range = this.transactionTimeRange()!;
      if (
        occurredAt !== editor.transaction?.occurredAt &&
        (Temporal.Instant.compare(instant, range.start) < 0 ||
          Temporal.Instant.compare(instant, range.end) >= 0)
      ) {
        this.errorKey.set('finance.error.date');
        return;
      }
      const draft: FinanceTransactionDraft = {
        categoryId: entry.categoryId,
        amount: entry.amount.trim().replace(',', '.'),
        currency: entry.currency,
        occurredAt,
        description: entry.description.trim(),
      };
      const editing = editor.transaction;
      const operation = this.readOnly()
        ? editing === null
          ? this.service.createTransaction(draft, month.periodStart)
          : this.service.updateTransaction(editing.id, editing.version, draft, month.periodStart)
        : editing === null
          ? this.service.createTransaction(draft)
          : this.service.updateTransaction(editing.id, editing.version, draft);
      this.mutateTransaction(operation, () => {
        this.transactionDialog()?.close();
        this.transactionEditor.set(null);
      });
    } catch {
      this.errorKey.set('finance.error.date');
    }
  }

  canEditTransaction(transaction: FinanceTransaction): boolean {
    const month = this.month();
    if (!month || !this.canWriteTransactions()) return false;
    return (
      !this.readOnly() ||
      Temporal.Instant.from(transaction.createdAt)
        .toZonedDateTimeISO(this.timeZone())
        .toPlainDate()
        .with({ day: 1 })
        .toString() === this.currentPeriod()
    );
  }

  setTransactionDeleted(transaction: FinanceTransaction, deleted: boolean): void {
    if (!this.canEditTransaction(transaction)) return;
    const operation = this.readOnly()
      ? deleted
        ? this.service.deleteTransaction(
            transaction.id,
            transaction.version,
            this.selectedPeriod()!,
          )
        : this.service.restoreTransaction(
            transaction.id,
            transaction.version,
            this.selectedPeriod()!,
          )
      : deleted
        ? this.service.deleteTransaction(transaction.id, transaction.version)
        : this.service.restoreTransaction(transaction.id, transaction.version);
    this.mutateTransaction(operation);
  }

  showRevisions(transaction: FinanceTransaction): void {
    if (this.revisionsFor()?.id === transaction.id) {
      this.closeRevisions();
      return;
    }
    this.revisionsFor.set(transaction);
    this.revisions.set([]);
    this.revisionsSubscription?.unsubscribe();
    this.revisionsLoading.set(true);
    this.revisionsErrorKey.set(null);
    const operation = this.readOnly()
      ? this.service.historicalRevisions(this.selectedPeriod()!, transaction.id)
      : this.service.revisions(transaction.id);
    this.revisionsSubscription = operation.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows) => {
        this.revisions.set(rows);
        this.revisionsLoading.set(false);
      },
      error: (error: ApiError) => {
        this.revisionsErrorKey.set(this.errorFor(error, 'finance.error.load'));
        this.revisionsLoading.set(false);
      },
    });
  }

  closeRevisions(): void {
    this.revisionsSubscription?.unsubscribe();
    this.revisionsFor.set(null);
    this.revisions.set([]);
    this.revisionsLoading.set(false);
    this.revisionsErrorKey.set(null);
  }

  private mutateMonth(operation: Observable<FinanceMonth>, after?: () => void): void {
    if (this.saving() || this.readOnly()) return;
    this.initializationSubscription?.unsubscribe();
    this.transactionsSubscription?.unsubscribe();
    this.loading.set(false);
    this.saving.set(true);
    this.errorKey.set(null);
    operation.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (month) => {
        this.receiveMonth(month);
        this.saving.set(false);
        after?.();
        this.loadTransactions();
      },
      error: (error: ApiError) => {
        this.errorKey.set(this.errorFor(error, 'finance.error.save'));
        this.currencyDraft.set(this.month()?.currency ?? 'USD');
        this.saving.set(false);
        this.loadTransactions();
      },
    });
  }

  private mutateTransaction(operation: Observable<FinanceTransaction>, after?: () => void): void {
    if (this.saving() || !this.canWriteTransactions()) return;
    this.initializationSubscription?.unsubscribe();
    this.transactionsSubscription?.unsubscribe();
    this.loading.set(false);
    this.saving.set(true);
    this.errorKey.set(null);
    operation.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        after?.();
        this.initializationSubscription = (
          this.readOnly()
            ? this.service.historicalMonth(this.selectedPeriod()!)
            : this.service.month()
        )
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (month) => {
              this.receiveMonth(month);
              this.saving.set(false);
            },
            error: (error: ApiError) => {
              this.errorKey.set(this.errorFor(error, 'finance.error.load'));
              this.saving.set(false);
            },
          });
        this.loadTransactions();
      },
      error: (error: ApiError) => {
        this.errorKey.set(this.errorFor(error, 'finance.error.save'));
        this.saving.set(false);
        this.loadTransactions();
      },
    });
  }

  private errorFor(error: ApiError, fallback: string): string {
    if (error.status === 409) return 'finance.error.conflict';
    if (error.status === 503) return 'finance.error.rate';
    return fallback;
  }

  private sortedCategories(kind: FinanceKind): FinanceCategory[] {
    return (this.month()?.categories ?? [])
      .filter((category) => category.kind === kind)
      .sort((left, right) => left.position - right.position);
  }

  overrun(category: FinanceCategory): boolean {
    return (
      category.kind === 'expense' && category.difference !== null && Number(category.difference) < 0
    );
  }

  previousAmount(revision: FinanceRevision): string {
    const amount = revision.previousState['amount'];
    const currency = revision.previousState['currency'];
    if (typeof amount !== 'string' || typeof currency !== 'string') return '';
    return this.money(amount, currency as FinanceCurrency);
  }

  previousDescription(revision: FinanceRevision): string {
    const description = revision.previousState['description'];
    return typeof description === 'string' ? description : '';
  }

  inputText(value: unknown): string {
    return value === null || value === undefined ? '' : String(value);
  }

  money(amount: string | number, currency: FinanceCurrency): string {
    return formatFinanceMoney(amount, currency, this.i18n.dateLocale());
  }

  balanceAmount(amount: string, currency: FinanceCurrency): string {
    return formatFinanceAmount(amount, currency, this.i18n.dateLocale());
  }

  dateTime(value: string): string {
    return formatFinanceDateTime(value, this.i18n.dateLocale(), this.timeZone());
  }
}
