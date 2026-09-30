import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import {
  FinanceCategory,
  FinanceCurrency,
  FinanceKind,
  FinanceMonth,
} from '../models/finance.model';
import { formatFinanceMoney } from '../utils/finance-format';

export interface FinanceCategoryFields {
  name: string;
  plan: string;
}

export interface FinanceCategoryFieldChange {
  field: 'name' | 'plan';
  value: string;
}

export interface FinanceCategoryDraftChange extends FinanceCategoryFieldChange {
  category: FinanceCategory;
}

@Component({
  selector: 'app-finance-budget-column',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './finance-budget-column.component.html',
  styleUrl: './finance-budget-column.component.scss',
})
export class FinanceBudgetColumnComponent {
  readonly i18n = inject(I18nService);
  readonly kind = input.required<FinanceKind>();
  readonly month = input.required<FinanceMonth>();
  readonly categories = input.required<readonly FinanceCategory[]>();
  readonly drafts = input.required<Record<string, FinanceCategoryFields>>();
  readonly newCategoryDraft = input.required<FinanceCategoryFields>();
  readonly saving = input.required<boolean>();
  readonly draftChanged = output<FinanceCategoryDraftChange>();
  readonly newDraftChanged = output<FinanceCategoryFieldChange>();
  readonly saved = output<FinanceCategory>();
  readonly created = output<void>();
  readonly removalRequested = output<FinanceCategory>();
  readonly restorationRequested = output<FinanceCategory>();

  categoryDraft(category: FinanceCategory): FinanceCategoryFields {
    return this.drafts()[category.id];
  }

  overrun(category: FinanceCategory): boolean {
    return (
      category.kind === 'expense' && category.difference !== null && Number(category.difference) < 0
    );
  }

  inputText(value: unknown): string {
    return value === null || value === undefined ? '' : String(value);
  }

  money(amount: string | number, currency: FinanceCurrency): string {
    return formatFinanceMoney(amount, currency, this.i18n.dateLocale());
  }
}
