import { FINANCE_CURRENCY_SYMBOLS, FinanceCurrency } from '../models/finance.model';

export function formatFinanceAmount(
  amount: string | number,
  currency: FinanceCurrency,
  locale: string,
): string {
  const precision = currency === 'AMD' ? 0 : 2;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(Number(amount));
}

export function formatFinanceMoney(
  amount: string | number,
  currency: FinanceCurrency,
  locale: string,
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'AMD' ? 0 : 2,
  })
    .formatToParts(Number(amount))
    .map((part) => (part.type === 'currency' ? FINANCE_CURRENCY_SYMBOLS[currency] : part.value))
    .join('');
}

export function formatFinanceDateTime(value: string, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(value));
}
