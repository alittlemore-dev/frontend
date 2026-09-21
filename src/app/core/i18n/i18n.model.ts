export type LanguageCode = 'ru' | 'en';

export interface I18nLanguage {
  code: LanguageCode;
  label: string;
}

export interface I18nLanguagesDto {
  defaultLanguage: LanguageCode;
  languages: I18nLanguage[];
}

export enum I18nBundle {
  Shared = 'shared',
  HowThisSiteIsBuilt = 'how-this-site-is-built',
  Articles = 'articles',
  CompetencyMatrix = 'competency-matrix',
  Updates = 'updates',
  Sitemap = 'sitemap',
  Account = 'account',
  AdminPanel = 'admin-panel',
  PersonalWorkspace = 'personal-workspace',
}

export interface I18nBundleDto {
  bundle: I18nBundle;
  language: LanguageCode;
  messages: Record<string, string>;
}

export type I18nParams = Record<string, string | number>;

export const SUPPORTED_LANGUAGE_CODES: readonly LanguageCode[] = ['ru', 'en'];

export function isLanguageCode(value: string | null): value is LanguageCode {
  return value === 'ru' || value === 'en';
}
