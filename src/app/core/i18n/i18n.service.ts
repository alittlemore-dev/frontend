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
import { Observable, catchError, map, of, switchMap, tap, throwError } from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import {
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
  private readonly bundleCache = new Map<LanguageCode, Record<string, string>>();
  private readonly messages = signal<Record<string, string> | null>(null);
  private readonly workspaceBundles = signal<Partial<Record<LanguageCode, Record<string, string>>>>(
    {},
  );

  readonly language = signal<LanguageCode | null>(null);
  readonly languages = signal<I18nLanguage[]>([]);
  readonly startupError = signal(false);

  initialize(): Observable<void> {
    this.startupError.set(false);
    const transferredLanguages = this.consumeTransferredLanguages();
    if (transferredLanguages) {
      this.languages.set(transferredLanguages.languages);
      return this.loadLanguage(this.resolveInitialLanguage(transferredLanguages), true);
    }

    return this.api()
      .get<I18nLanguagesDto>('/api/i18n/languages')
      .pipe(
        switchMap((response) => {
          this.transferState.set(I18N_LANGUAGES_STATE_KEY, response);
          this.languages.set(response.languages);
          return this.loadLanguage(this.resolveInitialLanguage(response), true);
        }),
        catchError(() => {
          this.startupError.set(true);
          return of(void 0);
        }),
      );
  }

  retryStartup(): Observable<void> {
    return this.initialize().pipe(
      switchMap(() =>
        !this.startupError() && this.document.location.pathname.startsWith('/personal-workspace')
          ? this.ensureWorkspaceBundle()
          : of(void 0),
      ),
    );
  }

  switchLanguage(language: LanguageCode, persist = true): Observable<void> {
    if (!this.isAvailableLanguage(language)) {
      return throwError(() => new Error(`Unsupported language: ${language}`));
    }
    return this.document.location.pathname.startsWith('/personal-workspace')
      ? this.fetchWorkspaceBundle(language).pipe(
          switchMap(() => this.loadLanguage(language, persist)),
        )
      : this.loadLanguage(language, persist);
  }

  ensureWorkspaceBundle(): Observable<void> {
    const language = this.language();
    if (language === null) return throwError(() => new Error('I18n language is not initialized'));
    return this.fetchWorkspaceBundle(language).pipe(
      catchError(() => {
        this.startupError.set(true);
        return of(void 0);
      }),
    );
  }

  private fetchWorkspaceBundle(language: LanguageCode): Observable<void> {
    if (this.workspaceBundles()[language]) return of(void 0);
    return this.api()
      .get<I18nBundleDto>(`/api/i18n/personal-workspace/bundles/${language}`)
      .pipe(
        tap((bundle) => {
          if (bundle.language !== language)
            throw new Error('Workspace localization language mismatch');
          const messages = Object.fromEntries(
            Object.entries(bundle.messages).map(([key, value]) => [
              key.startsWith('dashboard.')
                ? key.replace(/^dashboard\./u, 'workspaceDashboard.')
                : key,
              value,
            ]),
          );
          this.workspaceBundles.update((bundles) => ({ ...bundles, [language]: messages }));
        }),
        map(() => void 0),
      );
  }

  ensureLanguageBundle(language: LanguageCode): Observable<void> {
    if (!this.isAvailableLanguage(language)) {
      return throwError(() => new Error(`Unsupported language: ${language}`));
    }
    if (this.bundleCache.has(language)) {
      return of(void 0);
    }
    return this.fetchLanguageBundle(language);
  }

  translate(key: string, params?: I18nParams): string {
    const language = this.language();
    const template =
      this.messages()?.[key] ??
      (language === null ? undefined : this.workspaceBundles()[language]?.[key]) ??
      STARTUP_ERROR_MESSAGES[key] ??
      key;
    return interpolate(template, params);
  }

  translateForLanguage(language: LanguageCode, key: string, params?: I18nParams): string {
    const template =
      this.bundleCache.get(language)?.[key] ??
      (language === this.language() ? this.messages()?.[key] : undefined) ??
      this.workspaceBundles()[language]?.[key] ??
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

  private fetchLanguageBundle(language: LanguageCode): Observable<void> {
    const transferredBundle = this.consumeTransferredBundle(language);
    if (transferredBundle) {
      this.bundleCache.set(transferredBundle.language, transferredBundle.messages);
      return of(void 0);
    }

    return this.api()
      .get<I18nBundleDto>(`/api/i18n/bundles/${language}`)
      .pipe(
        tap((bundle) => {
          this.transferState.set(i18nBundleStateKey(bundle.language), bundle);
          this.bundleCache.set(bundle.language, bundle.messages);
        }),
        map(() => void 0),
      );
  }

  private consumeTransferredLanguages(): I18nLanguagesDto | null {
    if (!this.transferState.hasKey(I18N_LANGUAGES_STATE_KEY)) return null;
    const languages = this.transferState.get(I18N_LANGUAGES_STATE_KEY, null);
    this.transferState.remove(I18N_LANGUAGES_STATE_KEY);
    return languages;
  }

  private consumeTransferredBundle(language: LanguageCode): I18nBundleDto | null {
    const stateKey = i18nBundleStateKey(language);
    if (!this.transferState.hasKey(stateKey)) return null;
    const bundle = this.transferState.get(stateKey, null);
    this.transferState.remove(stateKey);
    return bundle;
  }

  private resolveInitialLanguage(response: I18nLanguagesDto): LanguageCode {
    const urlLanguage = this.resolveUrlLanguage();
    if (urlLanguage && this.includesLanguage(response.languages, urlLanguage)) {
      return urlLanguage;
    }

    const stored = this.storage()?.getItem(STORAGE_KEY) ?? null;
    if (isLanguageCode(stored) && this.includesLanguage(response.languages, stored)) {
      return stored;
    }
    if (this.includesLanguage(response.languages, response.defaultLanguage)) {
      return response.defaultLanguage;
    }
    throw new Error(`Unsupported default language: ${response.defaultLanguage}`);
  }

  private loadLanguage(language: LanguageCode, persist: boolean): Observable<void> {
    const cached = this.bundleCache.get(language);
    if (cached) {
      this.applyBundle(language, cached, persist);
      return of(void 0);
    }
    return this.fetchLanguageBundle(language).pipe(
      tap(() => {
        const messages = this.bundleCache.get(language);
        if (!messages) {
          throw new Error(`Missing language bundle: ${language}`);
        }
        this.applyBundle(language, messages, persist);
      }),
    );
  }

  persistLanguage(language: LanguageCode): void {
    if (!this.isAvailableLanguage(language)) return;
    try {
      this.storage()?.setItem(STORAGE_KEY, language);
    } catch {
      // Browser storage can be unavailable even when the page is usable.
    }
  }

  private applyBundle(
    language: LanguageCode,
    messages: Record<string, string>,
    persist: boolean,
  ): void {
    if (persist) {
      this.persistLanguage(language);
    }
    this.messages.set(messages);
    this.language.set(language);
    this.startupError.set(false);
    this.document.documentElement.lang = language;
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

function interpolate(template: string, params?: I18nParams): string {
  if (!params) return template;
  return Object.entries(params).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    template,
  );
}

function i18nBundleStateKey(language: LanguageCode): StateKey<I18nBundleDto | null> {
  return makeStateKey<I18nBundleDto | null>(`i18n.bundle.${language}`);
}
