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
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription } from 'rxjs';
import { Temporal } from 'temporal-polyfill';

import { I18nService } from '../../../../core/i18n/i18n.service';
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
  readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private initializationSubscription?: Subscription;
  private transactionsSubscription?: Subscription;
  private revisionsSubscription?: Subscription;

  readonly currencies: readonly FinanceCurrency[] = ['AMD', 'RUB', 'USD', 'EUR'];
  readonly currencySymbols = FINANCE_CURRENCY_SYMBOLS;
  readonly kinds: readonly FinanceKind[] = ['expense', 'income'];
  readonly month = signal<FinanceMonth | null>(null);
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
    const month = this.month();
    return month === null
      ? ''
      : new Intl.DateTimeFormat(this.i18n.dateLocale(), {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        }).format(new Date(`${month.periodStart}T00:00:00Z`));
  });
  readonly earliestTime = computed(() => `${this.month()?.periodStart ?? ''}T00:00`);
  readonly latestTime = computed(() => {
    const month = this.month();
    return month === null
      ? ''
      : `${Temporal.PlainDate.from(month.periodStart).add({ months: 1 }).subtract({ days: 1 })}T23:59`;
  });

  ngOnInit(): void {
    this.initialize();
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
    this.errorKey.set(null);
    this.initializationSubscription?.unsubscribe();
    this.initializationSubscription = this.service
      .ensure(language)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (month) => {
          this.receiveMonth(month);
          this.loading.set(false);
          this.loadTransactions();
        },
        error: (error: ApiError) => {
          this.errorKey.set(this.errorFor(error, 'finance.error.load'));
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
    this.transactionsSubscription = this.service
      .transactions(this.includeDeleted())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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
    this.mutateMonth(
      archived
        ? this.service.archiveCategory(category.id)
        : this.service.restoreCategory(category.id),
    );
  }

  openCategoryRemoval(category: FinanceCategory): void {
    this.categoryToRemove.set(category);
    this.errorKey.set(null);
    this.removalDialog()?.open();
  }

  closeCategoryRemoval(): void {
    if (this.saving()) return;
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
    const local = Temporal.Now.instant().toZonedDateTimeISO(month.timezoneName);
    const date = local.toPlainDate().toString();
    return {
      categoryId: '',
      amount: '',
      currency: month.currency,
      dateTime: `${date.slice(0, 7) === month.periodStart.slice(0, 7) ? date : month.periodStart}T${local.toPlainTime().toString({ smallestUnit: 'minute' })}`,
      description: '',
    };
  }

  openTransactionCreation(kind: FinanceKind): void {
    if (this.month() === null || this.saving()) return;
    this.transactionEditor.set({ kind, transaction: null, entry: this.blankTransactionEntry() });
    this.errorKey.set(null);
    this.changeDetector.detectChanges();
    this.transactionDialog()?.open();
  }

  openTransactionEdit(transaction: FinanceTransaction): void {
    const month = this.month();
    if (month === null || transaction.deleted || this.saving()) return;
    const local = Temporal.Instant.from(transaction.occurredAt).toZonedDateTimeISO(
      month.timezoneName,
    );
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
    this.changeDetector.detectChanges();
    this.transactionDialog()?.open();
  }

  closeTransactionEditor(): void {
    if (this.saving()) return;
    this.transactionDialog()?.close();
    this.transactionEditor.set(null);
  }

  private isCurrency(value: string): value is FinanceCurrency {
    return this.currencies.some((currency) => currency === value);
  }

  saveTransaction(entry: FinanceTransactionEntry): void {
    const month = this.month();
    const editor = this.transactionEditor();
    if (month === null || editor === null || this.saving()) return;
    if (!entry.categoryId || !entry.amount.trim()) {
      this.errorKey.set('finance.error.entry');
      return;
    }
    if (entry.dateTime.slice(0, 7) !== month.periodStart.slice(0, 7)) {
      this.errorKey.set('finance.error.date');
      return;
    }
    try {
      const occurredAt = Temporal.PlainDateTime.from(entry.dateTime)
        .toZonedDateTime(month.timezoneName)
        .toInstant()
        .toString();
      const draft: FinanceTransactionDraft = {
        categoryId: entry.categoryId,
        amount: entry.amount.trim().replace(',', '.'),
        currency: entry.currency,
        occurredAt,
        description: entry.description.trim(),
      };
      const editing = editor.transaction;
      const operation =
        editing === null
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

  setTransactionDeleted(transaction: FinanceTransaction, deleted: boolean): void {
    this.mutateTransaction(
      deleted
        ? this.service.deleteTransaction(transaction.id, transaction.version)
        : this.service.restoreTransaction(transaction.id, transaction.version),
    );
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
    this.revisionsSubscription = this.service
      .revisions(transaction.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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
    if (this.saving()) return;
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
    if (this.saving()) return;
    this.initializationSubscription?.unsubscribe();
    this.transactionsSubscription?.unsubscribe();
    this.loading.set(false);
    this.saving.set(true);
    this.errorKey.set(null);
    operation.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        after?.();
        this.initializationSubscription = this.service
          .month()
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
    return formatFinanceDateTime(
      value,
      this.i18n.dateLocale(),
      this.month()?.timezoneName ?? 'UTC',
    );
  }
}
