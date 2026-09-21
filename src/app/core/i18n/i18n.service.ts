import { DOCUMENT } from '@angular/common';
import {
  Injectable,
  Injector,
  StateKey,
  TransferState,
  inject,
  makeStateKey,
  signal,
} from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap, tap, throwError } from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import {
  I18nBundle,
  I18nBundleDto,
  I18nLanguage,
  I18nLanguagesDto,
  I18nParams,
  LanguageCode,
  isLanguageCode,
} from './i18n.model';

const STORAGE_KEY = 'chosenLanguage';
const I18N_LANGUAGES_STATE_KEY = makeStateKey<I18nLanguagesDto | null>('i18n.languages');
const STARTUP_ERROR_MESSAGES: Record<string, string> = {
  'i18n.startupError.title': 'Failed to load localization',
  'i18n.startupError.message': 'Check the API connection and try again.',
  'i18n.startupError.retry': 'Retry',
};

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);
  private readonly transferState = inject(TransferState);
  private readonly bundleCache = new Map<string, Record<string, string>>();
  private readonly messages = signal<Record<string, string> | null>(null);
  private readonly activeBundle = signal<I18nBundle | null>(null);

  readonly language = signal<LanguageCode | null>(null);
  readonly languages = signal<I18nLanguage[]>([]);
  readonly startupError = signal(false);

  initialize(): Observable<void> {
    this.startupError.set(false);
    const transferredLanguages = this.consumeTransferredLanguages();
    const languages$ = transferredLanguages
      ? of(transferredLanguages)
      : this.api()
          .get<I18nLanguagesDto>('/api/i18n/languages')
          .pipe(tap((response) => this.transferState.set(I18N_LANGUAGES_STATE_KEY, response)));

    return languages$.pipe(
      switchMap((response) => {
        this.languages.set(response.languages);
        return this.loadLanguage(this.resolveInitialLanguage(response), true, false);
      }),
      catchError(() => {
        this.startupError.set(true);
        return of(void 0);
      }),
    );
  }

  retryStartup(): Observable<void> {
    const language = this.language();
    if (language !== null) return this.activateBundle(this.activeBundle());

    return this.initialize().pipe(
      switchMap(() => {
        if (this.startupError() || this.language() === null || this.activeBundle() === null) {
          return of(void 0);
        }
        return this.activateBundle(this.activeBundle());
      }),
    );
  }

  activateBundle(bundle: I18nBundle | null): Observable<void> {
    this.activeBundle.set(bundle);
    const language = this.language();
    if (language === null) return of(void 0);

    if (bundle === null) {
      this.applyCachedBundles(language, false);
      this.startupError.set(false);
      return of(void 0);
    }

    return this.fetchBundle(bundle, language).pipe(
      tap(() => {
        this.applyCachedBundles(language, false);
        this.startupError.set(false);
      }),
      map(() => void 0),
      catchError(() => {
        this.applyCachedBundles(language, false, true);
        this.startupError.set(true);
        return of(void 0);
      }),
    );
  }

  switchLanguage(language: LanguageCode, persist = true): Observable<void> {
    if (!this.isAvailableLanguage(language)) {
      return throwError(() => new Error(`Unsupported language: ${language}`));
    }
    return this.loadLanguage(language, persist, true);
  }

  ensureLanguageBundle(language: LanguageCode): Observable<void> {
    if (!this.isAvailableLanguage(language)) {
      return throwError(() => new Error(`Unsupported language: ${language}`));
    }
    return this.fetchRequiredBundles(language).pipe(map(() => void 0));
  }

  translate(key: string, params?: I18nParams): string {
    const template = this.messages()?.[key] ?? STARTUP_ERROR_MESSAGES[key] ?? key;
    return interpolate(template, params);
  }

  translateForLanguage(language: LanguageCode, key: string, params?: I18nParams): string {
    const template =
      this.combinedMessages(language, this.activeBundle())?.[key] ??
      (language === this.language() ? this.messages()?.[key] : undefined) ??
      STARTUP_ERROR_MESSAGES[key] ??
      key;
    return interpolate(template, params);
  }

  enumGradeKey(grade: string): string {
    const normalized = grade.replace('+', 'Plus');
    return `enum.grade.${normalized}`;
  }

  enumInterviewFrequencyKey(frequency: string): string {
    return `enum.interviewFrequency.${frequency}`;
  }

  dateLocale(): string {
    return this.language() === 'en' ? 'en-US' : 'ru-RU';
  }

  persistLanguage(language: LanguageCode): void {
    if (!this.isAvailableLanguage(language)) return;
    try {
      this.storage()?.setItem(STORAGE_KEY, language);
    } catch {
      // Browser storage can be unavailable even when the page is usable.
    }
  }

  private loadLanguage(
    language: LanguageCode,
    persist: boolean,
    includeActiveBundle: boolean,
  ): Observable<void> {
    const bundles$ = includeActiveBundle
      ? this.fetchRequiredBundles(language)
      : this.fetchBundle(I18nBundle.Shared, language).pipe(map(() => void 0));
    return bundles$.pipe(
      tap(() => this.applyCachedBundles(language, persist, !includeActiveBundle)),
    );
  }

  private fetchRequiredBundles(language: LanguageCode): Observable<void> {
    const activeBundle = this.activeBundle();
    const requests: Observable<I18nBundleDto>[] = [this.fetchBundle(I18nBundle.Shared, language)];
    if (activeBundle !== null) requests.push(this.fetchBundle(activeBundle, language));
    return forkJoin(requests).pipe(map(() => void 0));
  }

  private fetchBundle(bundle: I18nBundle, language: LanguageCode): Observable<I18nBundleDto> {
    const cached = this.bundleCache.get(bundleCacheKey(bundle, language));
    if (cached) return of({ bundle, language, messages: cached });

    const transferredBundle = this.consumeTransferredBundle(bundle, language);
    if (transferredBundle) {
      this.validateBundle(transferredBundle, bundle, language);
      this.bundleCache.set(bundleCacheKey(bundle, language), transferredBundle.messages);
      return of(transferredBundle);
    }

    return this.api()
      .get<I18nBundleDto>(`/api/i18n/bundles/${bundle}/${language}`)
      .pipe(
        tap((response) => {
          this.validateBundle(response, bundle, language);
          this.transferState.set(i18nBundleStateKey(bundle, language), response);
          this.bundleCache.set(bundleCacheKey(bundle, language), response.messages);
        }),
      );
  }

  private validateBundle(
    response: I18nBundleDto,
    bundle: I18nBundle,
    language: LanguageCode,
  ): void {
    if (response.bundle !== bundle || response.language !== language) {
      throw new Error(`Localization bundle identity mismatch: expected ${bundle}/${language}`);
    }
  }

  private applyCachedBundles(language: LanguageCode, persist: boolean, sharedOnly = false): void {
    const messages = this.combinedMessages(language, sharedOnly ? null : this.activeBundle());
    if (messages === null) throw new Error(`Missing language bundle: ${language}`);
    if (persist) this.persistLanguage(language);
    this.messages.set(messages);
    this.language.set(language);
    this.startupError.set(false);
    this.document.documentElement.lang = language;
  }

  private combinedMessages(
    language: LanguageCode,
    featureBundle: I18nBundle | null,
  ): Record<string, string> | null {
    const shared = this.bundleCache.get(bundleCacheKey(I18nBundle.Shared, language));
    if (!shared) return null;
    if (featureBundle === null) return shared;
    const feature = this.bundleCache.get(bundleCacheKey(featureBundle, language));
    return feature ? { ...shared, ...feature } : null;
  }

  private consumeTransferredLanguages(): I18nLanguagesDto | null {
    if (!this.transferState.hasKey(I18N_LANGUAGES_STATE_KEY)) return null;
    const languages = this.transferState.get(I18N_LANGUAGES_STATE_KEY, null);
    this.transferState.remove(I18N_LANGUAGES_STATE_KEY);
    return languages;
  }

  private consumeTransferredBundle(
    bundle: I18nBundle,
    language: LanguageCode,
  ): I18nBundleDto | null {
    const stateKey = i18nBundleStateKey(bundle, language);
    if (!this.transferState.hasKey(stateKey)) return null;
    const response = this.transferState.get(stateKey, null);
    this.transferState.remove(stateKey);
    return response;
  }

  private resolveInitialLanguage(response: I18nLanguagesDto): LanguageCode {
    const urlLanguage = this.resolveUrlLanguage();
    if (urlLanguage && this.includesLanguage(response.languages, urlLanguage)) return urlLanguage;

    const stored = this.storage()?.getItem(STORAGE_KEY) ?? null;
    if (isLanguageCode(stored) && this.includesLanguage(response.languages, stored)) return stored;
    if (this.includesLanguage(response.languages, response.defaultLanguage)) {
      return response.defaultLanguage;
    }
    throw new Error(`Unsupported default language: ${response.defaultLanguage}`);
  }

  private resolveUrlLanguage(): LanguageCode | null {
    const pathname = this.document.location?.pathname ?? '';
    const firstSegment = pathname.split('/').find((segment) => segment.length > 0) ?? null;
    return isLanguageCode(firstSegment) ? firstSegment : null;
  }

  private storage(): Storage | null {
    return this.document.defaultView?.localStorage ?? null;
  }

  private isAvailableLanguage(language: LanguageCode): boolean {
    return this.includesLanguage(this.languages(), language);
  }

  private includesLanguage(languages: readonly I18nLanguage[], language: LanguageCode): boolean {
    return languages.some((item) => item.code === language);
  }

  private api(): ApiClient {
    return this.injector.get(ApiClient);
  }
}

function bundleCacheKey(bundle: I18nBundle, language: LanguageCode): string {
  return `${bundle}.${language}`;
}

function i18nBundleStateKey(
  bundle: I18nBundle,
  language: LanguageCode,
): StateKey<I18nBundleDto | null> {
  return makeStateKey<I18nBundleDto | null>(`i18n.bundle.${bundle}.${language}`);
}

function interpolate(template: string, params?: I18nParams): string {
  if (!params) return template;
  return Object.entries(params).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    template,
  );
}
