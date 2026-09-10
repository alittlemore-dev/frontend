import { inject } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { I18nService } from '../i18n/i18n.service';
import { LanguageCode } from '../i18n/i18n.model';

export function localizedPublicHomePath(language: LanguageCode): string {
  return `/${language}/how-this-site-is-built`;
}

export function injectedPublicHomePath(): string {
  return localizedPublicHomePath(readCurrentLanguage(inject(I18nService)));
}

export function currentPublicHomeUrlTree(router: Router, i18n: I18nService): UrlTree {
  return router.parseUrl(localizedPublicHomePath(readCurrentLanguage(i18n)));
}

function readCurrentLanguage(i18n: I18nService): LanguageCode {
  const language = i18n.language();
  if (language === null) {
    throw new Error('I18n language is not initialized');
  }
  return language;
}
