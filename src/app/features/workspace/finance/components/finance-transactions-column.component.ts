import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import {
  FinanceCurrency,
  FinanceKind,
  FinanceMonth,
  FinanceTransaction,
} from '../models/finance.model';
import { formatFinanceDateTime, formatFinanceMoney } from '../utils/finance-format';

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
  readonly transactions = input.required<readonly FinanceTransaction[]>();
  readonly historyTransactionId = input.required<string | null>();
  readonly saving = input.required<boolean>();
  readonly creationRequested = output<void>();
  readonly editRequested = output<FinanceTransaction>();
  readonly deletionRequested = output<FinanceTransaction>();
  readonly historyRequested = output<FinanceTransaction>();

  money(amount: string | number, currency: FinanceCurrency): string {
    return formatFinanceMoney(amount, currency, this.i18n.dateLocale());
  }

  dateTime(value: string): string {
    return formatFinanceDateTime(value, this.i18n.dateLocale(), this.month().timezoneName);
  }
}
