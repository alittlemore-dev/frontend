import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

export interface FinanceOperationRow<T> {
  item: T;
  id: string;
  date: string;
  displayDate: string;
  label: string;
  description: string;
  caption?: string;
  color?: string | null;
  amount: string;
  secondaryAmount?: string;
  deleted: boolean;
  editable: boolean;
  linked?: boolean;
  repeatable?: boolean;
}

@Component({
  selector: 'app-finance-operation-list',
  imports: [TranslatePipe],
  templateUrl: './finance-operation-list.component.html',
  styleUrl: './finance-operation-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinanceOperationListComponent<T> {
  readonly headingKey = input.required<string>();
  readonly total = input.required<string>();
  readonly totalLabel = input('finance.total');
  readonly secondaryAmountLabel = input('finance.transaction.converted');
  readonly dateLabel = input('finance.dateTime.label');
  readonly categoryLabel = input('finance.category.name');
  readonly rows = input.required<readonly FinanceOperationRow<T>[]>();
  readonly canAdd = input.required<boolean>();
  readonly saving = input.required<boolean>();
  readonly repeatDisabled = input(false);
  readonly historyId = input('finance-history');
  readonly historyTransactionId = input.required<string | null>();
  readonly revisions =
    input.required<readonly { number: number; heading: string; detail: string }[]>();
  readonly revisionsLoading = input(false);
  readonly revisionsErrorKey = input<string | null>(null);
  readonly creationRequested = output<void>();
  readonly editRequested = output<T>();
  readonly deletionRequested = output<T>();
  readonly historyRequested = output<T>();
  readonly historyClosed = output<void>();
  readonly repetitionRequested = output<T>();
}
