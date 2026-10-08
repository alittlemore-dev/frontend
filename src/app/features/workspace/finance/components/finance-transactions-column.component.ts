import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import {
  FinanceCurrency,
  FinanceKind,
  FinanceMonth,
  FinanceTransaction,
} from '../models/finance.model';
import { formatFinanceDateTime, formatFinanceMoney } from '../utils/finance-format';
import { financeChartColors } from '../utils/finance-chart-colors';

@Component({
  selector: 'app-finance-transactions-column',
  standalone: true,
  imports: [TranslatePipe],
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

  categoryColor(transaction: FinanceTransaction): string | null {
    return transaction.categoryId === null
      ? null
      : (this.categoryColors().get(transaction.categoryId) ?? null);
  }

  editable(transaction: FinanceTransaction): boolean {
    return !this.readOnly() && (!this.lateOnly() || this.editableIds().includes(transaction.id));
  }

  readonly creationRequested = output<void>();
  readonly editRequested = output<FinanceTransaction>();
  readonly deletionRequested = output<FinanceTransaction>();
  readonly historyRequested = output<FinanceTransaction>();

  money(amount: string | number, currency: FinanceCurrency): string {
    return formatFinanceMoney(amount, currency, this.i18n.dateLocale());
  }

  dateTime(value: string): string {
    return formatFinanceDateTime(value, this.i18n.dateLocale(), this.timeZone());
  }
}
