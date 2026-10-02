import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiClient } from '../../../../core/http/api-client.service';
import {
  FinanceStatisticsResult,
  FinanceStatisticsCurrency,
  FinanceStatisticsPeriod,
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

  historicalMonth(period: string): Observable<FinanceMonth> {
    return this.api.get<FinanceMonth>(this.historicalPath(period));
  }

  historicalTransactions(
    period: string,
    includeDeleted: boolean,
  ): Observable<readonly FinanceTransaction[]> {
    return this.api
      .get<{ transactions: FinanceTransaction[] }>(`${this.historicalPath(period)}/transactions`, {
        include_deleted: String(includeDeleted),
      })
      .pipe(map(({ transactions }) => transactions));
  }

  historicalRevisions(period: string, id: string): Observable<readonly FinanceRevision[]> {
    return this.api
      .get<{ revisions: FinanceRevision[] }>(
        `${this.historicalPath(period)}/transactions/${encodeURIComponent(id)}/revisions`,
      )
      .pipe(map(({ revisions }) => revisions));
  }

  statistics(
    period: FinanceStatisticsPeriod,
    currency: FinanceStatisticsCurrency,
  ): Observable<FinanceStatisticsResult> {
    return this.api.get<FinanceStatisticsResult>('/api/personal-workspace/finance/statistics', {
      period,
      currency,
    });
  }

  private historicalPath(period: string): string {
    const [year, month] = period.split('-');
    return `/api/personal-workspace/finance/months/${year}/${Number(month)}`;
  }

  private transactionPath(period?: string): string {
    return period === undefined ? PATH : this.historicalPath(period);
  }

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

  createTransaction(
    draft: FinanceTransactionDraft,
    period?: string,
  ): Observable<FinanceTransaction> {
    return this.api.post<FinanceTransaction>(`${this.transactionPath(period)}/transactions`, draft);
  }

  updateTransaction(
    id: string,
    version: number,
    draft: FinanceTransactionDraft,
    period?: string,
  ): Observable<FinanceTransaction> {
    return this.api.put<FinanceTransaction>(
      `${this.transactionPath(period)}/transactions/${encodeURIComponent(id)}`,
      {
        ...draft,
        version,
      },
    );
  }

  deleteTransaction(id: string, version: number, period?: string): Observable<FinanceTransaction> {
    return this.api.delete<FinanceTransaction>(
      `${this.transactionPath(period)}/transactions/${encodeURIComponent(id)}`,
      {
        version: String(version),
      },
    );
  }

  restoreTransaction(id: string, version: number, period?: string): Observable<FinanceTransaction> {
    return this.api.post<FinanceTransaction>(
      `${this.transactionPath(period)}/transactions/${encodeURIComponent(id)}/restore`,
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
