import type { SiteSelectOption } from '@alittlemore.dev/design-system';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { ASSET_KINDS } from '../models/finance-assets.model';
import { FINANCE_CURRENCY_SYMBOLS } from '../models/finance.model';

export const FINANCE_CURRENCY_OPTIONS: readonly SiteSelectOption[] = Object.entries(
  FINANCE_CURRENCY_SYMBOLS,
).map(([value, label]) => ({ value, label }));

export function assetKindOptions(i18n: I18nService): readonly SiteSelectOption[] {
  return ASSET_KINDS.map((value) => ({
    value,
    label: i18n.translate('finance.assets.kind.' + value),
  }));
}
