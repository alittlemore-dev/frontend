import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthModalService } from '../../../../core/auth/auth-modal.service';
import { AccountInfo, AuthService } from '../../../../core/auth/auth.service';
import { I18nLanguage, LanguageCode } from '../../../../core/i18n/i18n.model';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { ThemeName, ThemeService } from '../../../../core/layout/theme.service';
import { AdminPanelHeaderComponent } from './admin-panel-header.component';
import { AdminUnsavedChangesService } from '../../services/admin-unsaved-changes.service';

describe('AdminPanelHeaderComponent', () => {
  let fixture: ComponentFixture<AdminPanelHeaderComponent>;
  let el: HTMLElement;
  let themeSignal: ReturnType<typeof signal<ThemeName>>;
  let currentUserSignal: ReturnType<typeof signal<AccountInfo | null>>;
  let languageSignal: ReturnType<typeof signal<LanguageCode | null>>;
  let languagesSignal: ReturnType<typeof signal<I18nLanguage[]>>;
  let mockThemeService: { theme: ReturnType<typeof signal<ThemeName>>; toggleTheme: jest.Mock };
  let mockAuthService: {
    currentUser: ReturnType<typeof signal<AccountInfo | null>>;
    isLoggedIn: () => boolean;
    logout: jest.Mock;
    clearLocalSession: jest.Mock;
  };
  let mockAuthModalService: { openLogin: jest.Mock };
  let mockI18nService: {
    language: ReturnType<typeof signal<LanguageCode | null>>;
    languages: ReturnType<typeof signal<I18nLanguage[]>>;
    switchLanguage: jest.Mock;
    translate: jest.Mock;
  };
  let mockUnsavedChanges: { confirmDiscard: jest.Mock; discardChanges: jest.Mock };

  beforeEach(async () => {
    themeSignal = signal<ThemeName>('light');
    currentUserSignal = signal<AccountInfo | null>({ username: 'admin', role: 'admin' });
    languageSignal = signal<LanguageCode | null>('ru');
    languagesSignal = signal<I18nLanguage[]>([
      { code: 'ru', label: 'Русский' },
      { code: 'en', label: 'English' },
    ]);
    mockThemeService = {
      theme: themeSignal,
      toggleTheme: jest.fn(),
    };
    mockAuthService = {
      currentUser: currentUserSignal,
      isLoggedIn: () => currentUserSignal() !== null,
      logout: jest.fn().mockReturnValue(of(void 0)),
      clearLocalSession: jest.fn(),
    };
    mockAuthModalService = {
      openLogin: jest.fn(),
    };
    mockUnsavedChanges = {
      confirmDiscard: jest.fn().mockReturnValue(true),
      discardChanges: jest.fn(),
    };
    mockI18nService = {
      language: languageSignal,
      languages: languagesSignal,
      switchLanguage: jest.fn().mockReturnValue(of(void 0)),
      translate: jest.fn((key: string, params?: Record<string, string | number>) => {
        const messages: Record<string, string> = {
          'adminPanel.title': 'Админ-панель',
          'adminPanel.header.backToHome': 'На главную',
          'shell.theme.dark': 'Dark',
          'shell.theme.light': 'Light',
          'shell.theme.toggle': 'Переключить тему',
          'shell.auth.login': 'Войти',
          'shell.auth.logout': 'Выйти',
          'shell.auth.loggedInAs': 'Вы вошли как {username}',
          'shell.language.label': 'Язык',
        };
        const template = messages[key] ?? key;
        if (!params) return template;
        return Object.entries(params).reduce(
          (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
          template,
        );
      }),
    };

    await TestBed.configureTestingModule({
      imports: [AdminPanelHeaderComponent],
      providers: [
        provideRouter([]),
        { provide: ThemeService, useValue: mockThemeService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: AuthModalService, useValue: mockAuthModalService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: AdminUnsavedChangesService, useValue: mockUnsavedChanges },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminPanelHeaderComponent);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  it('renders localized title next to an icon-only home link on the left', () => {
    const primary = el.querySelector('[data-testid="admin-panel-header-primary"]');
    const homeLink = el.querySelector('[data-testid="admin-panel-home-link"]') as HTMLAnchorElement;
    const title = el.querySelector('[data-testid="admin-panel-header-title"]');

    expect(primary).not.toBeNull();
    expect(primary?.contains(homeLink)).toBe(true);
    expect(primary?.contains(title)).toBe(true);
    expect(homeLink.getAttribute('href')).toBe('/ru/how-this-site-is-built');
    expect(homeLink.getAttribute('aria-label')).toBe('На главную');
    expect(homeLink.textContent?.trim()).toBe('');
    expect(title?.textContent?.trim()).toBe('Админ-панель');
  });

  it('renders theme, language, and authenticated user controls', () => {
    const themeButton = el.querySelector(
      'button[aria-label="Переключить тему"]',
    ) as HTMLButtonElement;
    const languageSwitcher = el.querySelector('[aria-label="Язык"]');
    const logoutButton = el.querySelector('button[aria-label="Выйти"]') as HTMLButtonElement;
    const usernameEl = el.querySelector('[aria-label="Вы вошли как admin"]');

    expect(themeButton).not.toBeNull();
    expect(themeButton.textContent?.trim()).toBe('Dark');
    expect(languageSwitcher).not.toBeNull();
    expect(
      Array.from(languageSwitcher?.querySelectorAll('button') ?? []).map((button) =>
        button.textContent?.trim(),
      ),
    ).toEqual(['RU', 'EN']);
    expect(usernameEl?.textContent?.trim()).toBe('admin');
    expect(logoutButton).not.toBeNull();
  });

  it('toggles theme, switches language, and logs out from admin header controls', () => {
    const router = TestBed.inject(Router);
    const navigateByUrl = jest.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    (el.querySelector('button[aria-label="Переключить тему"]') as HTMLButtonElement).click();

    const englishButton = Array.from(el.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'EN',
    ) as HTMLButtonElement;
    englishButton.click();

    (el.querySelector('button[aria-label="Выйти"]') as HTMLButtonElement).click();

    expect(mockThemeService.toggleTheme).toHaveBeenCalled();
    expect(mockI18nService.switchLanguage).toHaveBeenCalledWith('en');
    expect(mockAuthService.logout).toHaveBeenCalled();
    expect(mockUnsavedChanges.discardChanges).toHaveBeenCalled();
    expect(navigateByUrl).toHaveBeenCalledWith('/ru/how-this-site-is-built');
  });

  it('shows the login action when there is no current user', () => {
    currentUserSignal.set(null);
    fixture.detectChanges();

    const loginButton = el.querySelector('button[aria-label="Войти"]') as HTMLButtonElement;
    loginButton.click();

    expect(loginButton.textContent?.trim()).toBe('Войти');
    expect(mockAuthModalService.openLogin).toHaveBeenCalled();
  });

  it('does not request logout when discarding unsaved changes is cancelled', () => {
    mockUnsavedChanges.confirmDiscard.mockReturnValue(false);

    fixture.componentInstance.logout();

    expect(mockUnsavedChanges.confirmDiscard).toHaveBeenCalledTimes(1);
    expect(mockUnsavedChanges.discardChanges).not.toHaveBeenCalled();
    expect(mockAuthService.logout).not.toHaveBeenCalled();
  });
});
