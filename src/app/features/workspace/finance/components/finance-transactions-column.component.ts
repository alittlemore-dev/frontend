import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { I18nService } from '../../../../core/i18n/i18n.service';
import {
  FinanceOperationListComponent,
  FinanceOperationRow,
} from './finance-operation-list.component';
import {
  FinanceCurrency,
  FinanceKind,
  FinanceMonth,
  FinanceRevision,
  FinanceTransaction,
} from '../models/finance.model';
import { formatFinanceDateTime, formatFinanceMoney } from '../utils/finance-format';
import { financeChartColors } from '../utils/finance-chart-colors';

@Component({
  selector: 'app-finance-transactions-column',
  standalone: true,
  imports: [FinanceOperationListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './finance-transactions-column.component.html',
  styleUrl: './finance-transactions-column.component.scss',
})
export class FinanceTransactionsColumnComponent {
  readonly i18n = inject(I18nService);
  readonly kind = input.required<FinanceKind>();
  readonly month = input.required<FinanceMonth>();
  readonly timeZone = input.required<string>();
  readonly transactions = input.required<readonly FinanceTransaction[]>();
  readonly historyTransactionId = input.required<string | null>();
  readonly revisions = input<readonly FinanceRevision[]>([]);
  readonly revisionsLoading = input(false);
  readonly revisionsErrorKey = input<string | null>(null);
  readonly repeatDisabled = input(false);
  readonly saving = input.required<boolean>();
  readonly readOnly = input(false);
  readonly lateOnly = input(false);
  readonly editableIds = input<readonly string[]>([]);
  readonly categoryColors = computed(() => {
    const ids = this.month()
      .categories.filter((category) => category.kind === this.kind())
      .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
      .map((category) => category.id);
    const extraIds = this.transactions()
      .map((transaction) => transaction.categoryId)
      .filter((id): id is string => id !== null && !ids.includes(id));
    const categories = [...ids, ...new Set(extraIds.sort())];
    const colors = financeChartColors(categories.length);
    return new Map(categories.map((id, index) => [id, colors[index]]));
  });

  readonly rows = computed<FinanceOperationRow<FinanceTransaction>[]>(() => {
    this.i18n.language();
    return this.transactions().map((transaction) => ({
      item: transaction,
      id: transaction.id,
      date: transaction.occurredAt,
      displayDate: this.dateTime(transaction.occurredAt),
      label: transaction.categoryName || this.i18n.translate('finance.category.none'),
      color: this.categoryColor(transaction),
      description: transaction.description,
      caption:
        this.i18n.translate('finance.transaction.author') +
        ': ' +
        transaction.authorLabel +
        ' · ' +
        this.i18n.translate('finance.transaction.source.' + transaction.source),
      linked: transaction.allowsDirectChanges === false,
      editable: this.editable(transaction),
      repeatable: true,
      deleted: transaction.deleted,
      amount: this.money(transaction.amount, transaction.currency),
      secondaryAmount:
        transaction.currency !== this.month().currency
          ? this.money(transaction.convertedAmount, this.month().currency)
          : '',
    }));
  });
  readonly historyRows = computed(() =>
    this.revisions().map((revision) => ({
      number: revision.number,
      heading:
        this.i18n.translate('finance.history.' + revision.action) +
        ' · ' +
        this.dateTime(revision.changedAt),
      detail: [this.previousAmount(revision), this.previousDescription(revision)]
        .filter(Boolean)
        .join(' · '),
    })),
  );

  categoryColor(transaction: FinanceTransaction): string | null {
    return transaction.categoryId === null
      ? null
      : (this.categoryColors().get(transaction.categoryId) ?? null);
  }

  editable(transaction: FinanceTransaction): boolean {
    return (
      transaction.allowsDirectChanges !== false &&
      !this.readOnly() &&
      (!this.lateOnly() || this.editableIds().includes(transaction.id))
    );
  }

  readonly creationRequested = output<void>();
  readonly editRequested = output<FinanceTransaction>();
  readonly deletionRequested = output<FinanceTransaction>();
  readonly historyRequested = output<FinanceTransaction>();
  readonly historyClosed = output<void>();
  readonly repetitionRequested = output<FinanceTransaction>();

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

  money(amount: string | number, currency: FinanceCurrency): string {
    return formatFinanceMoney(amount, currency, this.i18n.dateLocale());
  }

  dateTime(value: string): string {
    return formatFinanceDateTime(value, this.i18n.dateLocale(), this.timeZone());
  }
}
