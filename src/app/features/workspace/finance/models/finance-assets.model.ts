import { FinanceCurrency } from './finance.model';

export const ASSET_KINDS = [
  'cash',
  'bank',
  'brokerCash',
  'savings',
  'deposit',
  'stock',
  'bond',
  'fund',
  'other',
] as const;
export const MOVEMENT_KINDS = [
  'openingExternal',
  'openingBudget',
  'statement',
  'contribution',
  'withdrawal',
  'depositExternal',
  'withdrawExternal',
  'transfer',
  'exchange',
  'buy',
  'buyFromBudget',
  'sell',
  'payout',
  'payoutToBudget',
  'fee',
  'valuation',
  'reconcile',
] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];
export type MovementKind = (typeof MOVEMENT_KINDS)[number];
export type ManualFlow = 'depositExternal' | 'withdrawExternal';
export function isManualFlow(kind: MovementKind): kind is ManualFlow {
  return kind === 'depositExternal' || kind === 'withdrawExternal';
}
export interface AssetLocation {
  id: string;
  name: string;
}
export interface AssetPositionDraft {
  name: string;
  kind: AssetKind;
  locationId: string;
  currency: FinanceCurrency;
  instrument: string;
  venue: string;
  annualRate: string | null;
  maturesOn: string | null;
}
export interface AssetPosition extends AssetPositionDraft {
  id: string;
  archived?: boolean;
  quantity: string | null;
  originalValue: string | null;
  value: string | null;
  priceDate: string | null;
  priceSource: string | null;
  rateDate: string | null;
  rateSource: string | null;
  missingPrice: boolean;
  missingRate: boolean;
  stale: boolean;
}
export interface AssetValuation {
  asOf: string;
  currency: FinanceCurrency;
  knownValue: string;
  complete: boolean;
  positions: AssetPosition[];
}
export interface AssetOpeningPreviewRequest {
  positionId: string;
  onDate: string;
  amount: string;
  movementId?: string;
}
export interface AssetOpeningPreview {
  availableAfter: string;
  currency: FinanceCurrency;
}
export interface AssetMovementDraft {
  kind: MovementKind;
  onDate: string;
  positionId: string;
  counterPositionId: string | null;
  amount: string | null;
  externalFunds?: boolean;
  enteredAmount?: string | null;
  enteredCurrency?: FinanceCurrency | null;
  counterAmount: string | null;
  quantity: string | null;
  totalValue: string | null;
  categoryId: string | null;
  note: string;
}
export interface AssetRevision extends AssetMovementDraft {
  changedAt: string;
  version: number;
  deleted: boolean;
  source: 'web' | 'pat';
}
export interface AssetMovement extends AssetRevision {
  createdAt?: string;
  id: string;
  requestId: string;
}
export interface AssetGoalDraft {
  percent: string;
  allIncome: boolean;
  categoryIds: string[];
}
export interface AssetGoal extends AssetGoalDraft {
  month: string;
}
export interface AssetMonth {
  month: string;
  income: string | null;
  netSavings: string | null;
  targetPercent: string | null;
  targetAmount: string | null;
  actualPercent: string | null;
  remaining: string | null;
  full: boolean;
  achieved: boolean | null;
}
export interface AssetReport {
  start: string;
  end: string;
  trackingStart: string | null;
  coverageStart: string | null;
  coverageEnd: string | null;
  currency: FinanceCurrency;
  opening: AssetValuation;
  closing: AssetValuation;
  deposits: string | null;
  withdrawals: string | null;
  netSavings: string | null;
  income: string | null;
  targetAmount: string | null;
  actualPercent: string | null;
  remaining: string | null;
  achievedMonths: number;
  eligibleMonths: number;
  payouts: string | null;
  fees: string | null;
  initialAssets: string | null;
  reconciliation: string | null;
  revaluation: string | null;
  byKind: Record<string, string>;
  byLocation: Record<string, string>;
  byCurrency: Record<string, string>;
  nonInterestValue: string | null;
  nonInterestPercent: string | null;
  months: AssetMonth[];
  history: { onDate: string; knownValue: string; complete: boolean }[];
  forecast: {
    startValue: string | null;
    observationMonths: string[];
    availableOn: string | null;
    monthlyActual: string | null;
    monthlyTarget: string | null;
    points: { month: string; actual: string | null; target: string | null }[];
  };
}
export function isSecurity(kind: AssetKind): boolean {
  return kind === 'stock' || kind === 'bond' || kind === 'fund';
}

export function isAssetCounter(
  candidate: AssetPosition,
  primary: AssetPosition,
  kind: MovementKind,
  existingCounter?: string | null,
): boolean {
  return (
    (!candidate.archived || candidate.id === existingCounter) &&
    candidate.id !== primary.id &&
    candidate.kind !== 'other' &&
    !isSecurity(candidate.kind) &&
    (kind === 'exchange'
      ? candidate.currency !== primary.currency
      : candidate.currency === primary.currency)
  );
}
