import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiClient } from '../../../../core/http/api-client.service';
import {
  FinanceCurrency,
  FinanceKind,
  FinanceMonth,
  FinanceRevision,
  FinanceTransaction,
  FinanceTransactionDraft,
} from '../models/finance.model';

const PATH = '/api/personal-workspace/finance/current-month';

@Injectable({ providedIn: 'root' })
export class FinanceService {
  private readonly api = inject(ApiClient);

  ensure(language: 'ru' | 'en'): Observable<FinanceMonth> {
    return this.api.post<FinanceMonth>(`${PATH}/ensure`, { language });
  }

  month(): Observable<FinanceMonth> {
    return this.api.get<FinanceMonth>(PATH);
  }

  updateOpeningBalance(amount: string): Observable<FinanceMonth> {
    return this.api.put<FinanceMonth>(`${PATH}/opening-balance`, { amount });
  }

  changeCurrency(currency: FinanceCurrency): Observable<FinanceMonth> {
    return this.api.post<FinanceMonth>(`${PATH}/currency-changes`, { currency });
  }

  createCategory(
    kind: FinanceKind,
    name: string,
    plannedAmount: string | null,
  ): Observable<FinanceMonth> {
    return this.api.post<FinanceMonth>(`${PATH}/categories`, { kind, name, plannedAmount });
  }

  updateCategory(
    categoryId: string,
    name: string,
    plannedAmount: string | null,
    position: number,
  ): Observable<FinanceMonth> {
    return this.api.put<FinanceMonth>(`${PATH}/categories/${encodeURIComponent(categoryId)}`, {
      name,
      plannedAmount,
      position,
    });
  }

  archiveCategory(categoryId: string): Observable<FinanceMonth> {
    return this.api.delete<FinanceMonth>(`${PATH}/categories/${encodeURIComponent(categoryId)}`);
  }

  deleteCategoryPermanently(categoryId: string): Observable<FinanceMonth> {
    return this.api.delete<FinanceMonth>(
      `${PATH}/categories/${encodeURIComponent(categoryId)}/permanent`,
    );
  }

  restoreCategory(categoryId: string): Observable<FinanceMonth> {
    return this.api.post<FinanceMonth>(
      `${PATH}/categories/${encodeURIComponent(categoryId)}/restore`,
      {},
    );
  }

  transactions(includeDeleted: boolean): Observable<readonly FinanceTransaction[]> {
    return this.api
      .get<{ transactions: FinanceTransaction[] }>(`${PATH}/transactions`, {
        include_deleted: String(includeDeleted),
      })
      .pipe(map(({ transactions }) => transactions));
  }

  createTransaction(draft: FinanceTransactionDraft): Observable<FinanceTransaction> {
    return this.api.post<FinanceTransaction>(`${PATH}/transactions`, draft);
  }

  updateTransaction(
    id: string,
    version: number,
    draft: FinanceTransactionDraft,
  ): Observable<FinanceTransaction> {
    return this.api.put<FinanceTransaction>(`${PATH}/transactions/${encodeURIComponent(id)}`, {
      ...draft,
      version,
    });
  }

  deleteTransaction(id: string, version: number): Observable<FinanceTransaction> {
    return this.api.delete<FinanceTransaction>(`${PATH}/transactions/${encodeURIComponent(id)}`, {
      version: String(version),
    });
  }

  restoreTransaction(id: string, version: number): Observable<FinanceTransaction> {
    return this.api.post<FinanceTransaction>(
      `${PATH}/transactions/${encodeURIComponent(id)}/restore`,
      {
        version,
      },
    );
  }

  revisions(id: string): Observable<readonly FinanceRevision[]> {
    return this.api
      .get<{ revisions: FinanceRevision[] }>(
        `${PATH}/transactions/${encodeURIComponent(id)}/revisions`,
      )
      .pipe(map(({ revisions }) => revisions));
  }
}
