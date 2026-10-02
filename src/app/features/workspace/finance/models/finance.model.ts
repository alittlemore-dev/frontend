export type FinanceCurrency = 'AMD' | 'RUB' | 'USD' | 'EUR';
export type FinanceKind = 'income' | 'expense';

export const FINANCE_CURRENCY_SYMBOLS: Record<FinanceCurrency, string> = {
  AMD: '֏',
  RUB: '₽',
  USD: '$',
  EUR: '€',
};

export interface FinanceTransactionEntry {
  categoryId: string;
  amount: string;
  currency: FinanceCurrency;
  dateTime: string;
  description: string;
}

export interface FinanceTransactionEditor {
  kind: FinanceKind;
  transaction: FinanceTransaction | null;
  entry: FinanceTransactionEntry;
}

export interface FinanceCategory {
  id: string;
  stableId: string;
  kind: FinanceKind;
  name: string;
  plannedAmount: string | null;
  actualAmount: string;
  difference: string | null;
  position: number;
  archived: boolean;
}

export interface FinanceMonth {
  id: string;
  periodStart: string;
  timezoneName: string;
  currency: FinanceCurrency;
  openingBalance: string;
  actualIncome: string;
  actualExpense: string;
  plannedIncome: string | null;
  plannedExpense: string | null;
  closingBalance: string;
  categories: FinanceCategory[];
}

export interface FinanceTransaction {
  createdAt: string;
  source: 'web' | 'telegram';
  authorId: string;
  authorLabel: string;
  id: string;
  categoryId: string | null;
  categoryName: string;
  kind: FinanceKind;
  amount: string;
  currency: FinanceCurrency;
  convertedAmount: string;
  occurredAt: string;
  description: string;
  rateEffectiveOn: string;
  version: number;
  deleted: boolean;
}

export interface FinanceTransactionDraft {
  categoryId: string;
  amount: string;
  currency: FinanceCurrency;
  occurredAt: string;
  description: string;
}

export interface FinanceRevision {
  number: number;
  action: 'update' | 'delete' | 'restore';
  previousState: Record<string, string | number | boolean | null>;
  actorUsername: string;
  changedAt: string;
}

export type FinanceStatisticsPeriod =
  'today' | 'thisWeek' | 'thisMonth' | 'thisYear' | 'last7Days' | 'last30Days' | 'last365Days';

export interface FinanceStatisticsWindow {
  start: string;
  end: string;
  granularity: 'hour' | 'day' | 'month';
}

export interface FinanceStatisticsPoint {
  start: string;
  end: string;
  amount: string;
}

export interface FinanceStatisticsCategory {
  id: string;
  name: string;
  amount: string;
  percentage: string;
}

export interface FinanceStatisticsBreakdown {
  actual: string;
  previous: string;
  change: string;
  changePercent: string | null;
  timeline: FinanceStatisticsPoint[];
  categories: FinanceStatisticsCategory[];
}

export type FinanceStatisticsCurrency = FinanceCurrency | 'month';

export interface FinanceStatisticsResult {
  currency: FinanceStatisticsCurrency;
  reports: FinanceStatistics[];
}

export interface FinanceStatistics {
  budgetRateEffectiveOn: string | null;
  period: FinanceStatisticsPeriod;
  currency: FinanceCurrency;
  timezoneName: string;
  window: FinanceStatisticsWindow;
  previousWindow: FinanceStatisticsWindow;
  availableSince: string;
  income: FinanceStatisticsBreakdown;
  expense: FinanceStatisticsBreakdown;
  net: string;
  previousNet: string;
  uncategorizedIncome: string;
  uncategorizedExpense: string;
  monthly: FinanceMonth | null;
}
