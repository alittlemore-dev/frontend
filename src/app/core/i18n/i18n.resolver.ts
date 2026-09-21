import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { I18nBundle } from './i18n.model';
import { I18nService } from './i18n.service';

export function i18nBundleResolver(bundle: I18nBundle | null): ResolveFn<void> {
  return () => inject(I18nService).activateBundle(bundle);
}
