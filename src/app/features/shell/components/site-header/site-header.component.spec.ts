import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { SiteHeaderComponent, rewriteLanguagePrefixedUrl } from './site-header.component';
import { ThemeService } from '../../../../core/layout/theme.service';
import { ThemeName } from '../../../../core/layout/theme.service';
import { AuthService, AccountInfo } from '../../../../core/auth/auth.service';
import { AuthModalService } from '../../../../core/auth/auth-modal.service';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { I18nLanguage, LanguageCode } from '../../../../core/i18n/i18n.model';

@Component({
  standalone: true,
  template: '',
})
class EmptyRouteComponent {}

describe('SiteHeaderComponent', () => {
  let fixture: ComponentFixture<SiteHeaderComponent>;
  let el: HTMLElement;
  let themeSignal: ReturnType<typeof signal<ThemeName>>;
  let currentUserSignal: ReturnType<typeof signal<AccountInfo | null>>;
  let restoringSessionSignal: ReturnType<typeof signal<boolean>>;
  let languageSignal: ReturnType<typeof signal<LanguageCode | null>>;
  let languagesSignal: ReturnType<typeof signal<I18nLanguage[]>>;
  let router: Router;
  let mockThemeService: {
    theme: ReturnType<typeof signal<ThemeName>>;
    toggleTheme: jest.Mock;
    setTheme: jest.Mock;
  };
  let mockAuthService: {
    currentUser: ReturnType<typeof signal<AccountInfo | null>>;
    isLoggedIn: () => boolean;
    canManageContent: () => boolean;
    isRestoringSession: ReturnType<typeof signal<boolean>>;
    ensureCurrentUserLoaded: jest.Mock;
    logout: jest.Mock;
  };
  let mockAuthModalService: { openLogin: jest.Mock };
  let mockI18nService: {
    language: ReturnType<typeof signal<LanguageCode | null>>;
    languages: ReturnType<typeof signal<I18nLanguage[]>>;
    switchLanguage: jest.Mock;
    translate: jest.Mock;
  };

  beforeEach(async () => {
    themeSignal = signal<ThemeName>('light');
    currentUserSignal = signal<AccountInfo | null>(null);
    restoringSessionSignal = signal(false);
    languageSignal = signal<LanguageCode | null>('ru');
    languagesSignal = signal<I18nLanguage[]>([
      { code: 'ru', label: 'Русский' },
      { code: 'en', label: 'English' },
    ]);

    mockThemeService = {
      theme: themeSignal,
      toggleTheme: jest.fn(),
      setTheme: jest.fn(),
    };

    mockAuthService = {
      currentUser: currentUserSignal,
      isLoggedIn: () => currentUserSignal() !== null,
      canManageContent: () => {
        const role = currentUserSignal()?.role;
        return role === 'owner' || role === 'admin' || role === 'moderator';
      },
      isRestoringSession: restoringSessionSignal,
      ensureCurrentUserLoaded: jest.fn().mockReturnValue(of(void 0)),
      logout: jest.fn().mockReturnValue({ subscribe: jest.fn() }),
    };
    mockAuthModalService = {
      openLogin: jest.fn(),
    };
    mockI18nService = {
      language: languageSignal,
      languages: languagesSignal,
      switchLanguage: jest.fn().mockReturnValue(of(void 0)),
      translate: jest.fn((key: string, params?: Record<string, string | number>) => {
        const messages: Record<string, string> = {
          'shell.nav.matrix': 'Матрица компетенций',
          'shell.nav.articles': 'Статьи',
          'shell.nav.adminPanel': 'Админ-панель',
          'shell.nav.toggleNavigation': 'Открыть навигацию',
          'siteBuild.hero.logoAlt': 'Логотип сайта',
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
      imports: [SiteHeaderComponent, EmptyRouteComponent],
      providers: [
        provideRouter([
          {
            path: 'ru',
            children: [{ path: 'competency-matrix', component: EmptyRouteComponent }],
          },
        ]),
        { provide: ThemeService, useValue: mockThemeService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: AuthModalService, useValue: mockAuthModalService },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SiteHeaderComponent);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
    router = TestBed.inject(Router);
  });

  it('uses the localized site-build case study as home and does not render about navigation', () => {
    expect(fixture.componentInstance.homeLink()).toBe('/ru/how-this-site-is-built');
    expect(el.querySelector('a[href="/ru/about-me"]')).toBeNull();
    expect(el.textContent).not.toContain('Обо мне');
  });

  it('renders the primary project logo in the home link', () => {
    const logo = el.querySelector('a.navbar-brand img') as HTMLImageElement | null;

    expect(logo).not.toBeNull();
    expect(logo?.getAttribute('src')).toBe('/logo-192x192.webp');
    expect(logo?.getAttribute('srcset')).toBe('/logo-192x192.webp 1x, /logo-512x512.webp 2x');
    expect(logo?.getAttribute('width')).toBe('40');
    expect(logo?.getAttribute('height')).toBe('40');
    expect(logo?.getAttribute('alt')).toBe('Логотип сайта');
  });

  it('renders nav link to the localized competency matrix page', () => {
    expect(fixture.componentInstance.matrixLink()).toBe('/ru/competency-matrix');
  });

  it('renders nav link to the localized articles page', () => {
    expect(fixture.componentInstance.articlesLink()).toBe('/ru/articles');
  });

  it('uses responsive containers for collapsed public navigation and actions', () => {
    const navList = el.querySelector('[data-testid="site-header-nav-list"]') as HTMLElement | null;
    const actions = el.querySelector('[data-testid="site-header-actions"]') as HTMLElement | null;

    expect(navList).not.toBeNull();
    expect(navList?.classList).toContain('flex-column');
    expect(navList?.classList).toContain('flex-lg-row');
    expect(actions).not.toBeNull();
    expect(actions?.classList).toContain('flex-wrap');
    expect(actions?.classList).toContain('justify-content-start');
    expect(actions?.classList).toContain('justify-content-lg-end');
  });

  it('closes expanded navigation when a public nav link is selected', () => {
    fixture.componentInstance.toggleNav();
    fixture.detectChanges();

    expect(fixture.componentInstance.isNavOpen()).toBe(true);

    const matrixLink = el.querySelector('a[aria-label="Матрица компетенций"]') as HTMLAnchorElement;
    matrixLink.click();

    expect(fixture.componentInstance.isNavOpen()).toBe(false);
  });

  it('hides admin-panel navigation from guests and regular users', () => {
    expect(el.querySelector('a[aria-label="Админ-панель"]')).toBeNull();

    currentUserSignal.set({ username: 'user', role: 'user' });
    fixture.detectChanges();

    expect(el.querySelector('a[aria-label="Админ-панель"]')).toBeNull();
  });

  it('shows admin-panel navigation to owners, admins, and moderators', () => {
    currentUserSignal.set({ username: 'owner', role: 'owner' });
    fixture.detectChanges();

    let adminLink = el.querySelector('a[aria-label="Админ-панель"]') as HTMLAnchorElement;
    expect(adminLink).not.toBeNull();
    expect(adminLink.getAttribute('href')).toBe('/admin-panel');

    currentUserSignal.set({ username: 'moderator', role: 'moderator' });
    fixture.detectChanges();

    adminLink = el.querySelector('a[aria-label="Админ-панель"]') as HTMLAnchorElement;
    expect(adminLink).not.toBeNull();

    currentUserSignal.set({ username: 'admin', role: 'admin' });
    fixture.detectChanges();

    adminLink = el.querySelector('a[aria-label="Админ-панель"]') as HTMLAnchorElement;
    expect(adminLink).not.toBeNull();
  });

  it('theme toggle button calls themeService.toggleTheme()', () => {
    const button = findButtonByText(el, 'Dark');
    expect(button).not.toBeNull();
    button.click();
    expect(mockThemeService.toggleTheme).toHaveBeenCalled();
  });

  it('toggle button text reflects current theme label', () => {
    const button = findButtonByText(el, 'Dark');
    expect(button).not.toBeNull();
    expect(button.getAttribute('aria-label')).toBeNull();
    expect(button.textContent?.trim()).toBe('Dark');

    themeSignal.set('dark');
    fixture.detectChanges();
    expect(button.textContent?.trim()).toBe('Light');
  });

  it('shows login modal button when user is not logged in', () => {
    const loginButton = el.querySelector('button[aria-label="Войти"]') as HTMLButtonElement;
    expect(loginButton).not.toBeNull();
    expect(loginButton.textContent?.trim()).toBe('Войти');
    expect(el.querySelector('a[routerLink="/login"]')).toBeNull();
  });

  it('restores an existing session before asking for credentials', () => {
    mockAuthService.ensureCurrentUserLoaded.mockImplementation(() => {
      currentUserSignal.set({ username: 'admin', role: 'admin' });
      return of(void 0);
    });

    const loginButton = el.querySelector('button[aria-label="Войти"]') as HTMLButtonElement;
    loginButton.click();
    fixture.detectChanges();

    expect(mockAuthModalService.openLogin).not.toHaveBeenCalled();
    expect(el.querySelector('[aria-label="Вы вошли как admin"]')).not.toBeNull();
  });

  it('opens login modal when session restoration leaves the user anonymous', () => {
    const loginButton = el.querySelector('button[aria-label="Войти"]') as HTMLButtonElement;
    loginButton.click();
    expect(mockAuthModalService.openLogin).toHaveBeenCalled();
  });

  it('disables login while one session restoration is in flight', () => {
    const restoration = new Subject<void>();
    mockAuthService.ensureCurrentUserLoaded.mockImplementation(() => {
      restoringSessionSignal.set(true);
      return restoration;
    });
    const loginButton = el.querySelector('button[aria-label="Войти"]') as HTMLButtonElement;

    loginButton.click();
    fixture.detectChanges();

    expect(loginButton.disabled).toBe(true);
    expect(loginButton.getAttribute('aria-busy')).toBe('true');
    loginButton.click();
    expect(mockAuthService.ensureCurrentUserLoaded).toHaveBeenCalledTimes(1);

    restoration.next();
    restoringSessionSignal.set(false);
    restoration.complete();
    fixture.detectChanges();

    expect(mockAuthModalService.openLogin).toHaveBeenCalledTimes(1);
    expect(loginButton.disabled).toBe(false);
    expect(loginButton.getAttribute('aria-busy')).toBe('false');
  });

  it('disables login during automatic startup restoration', () => {
    restoringSessionSignal.set(true);
    fixture.detectChanges();
    const loginButton = el.querySelector('button[aria-label="Войти"]') as HTMLButtonElement;

    expect(loginButton.disabled).toBe(true);
    expect(loginButton.getAttribute('aria-busy')).toBe('true');
    loginButton.click();
    expect(mockAuthService.ensureCurrentUserLoaded).not.toHaveBeenCalled();
  });

  it('shows username and logout button when logged in', () => {
    currentUserSignal.set({ username: 'admin', role: 'admin' });
    fixture.detectChanges();

    const logoutBtn = el.querySelector('button[aria-label="Выйти"]') as HTMLButtonElement;
    expect(logoutBtn).not.toBeNull();

    const usernameEl = el.querySelector('[aria-label="Вы вошли как admin"]');
    expect(usernameEl).not.toBeNull();
    expect(usernameEl?.textContent?.trim()).toBe('admin');
  });

  it('calls authService.logout() when logout button is clicked', () => {
    currentUserSignal.set({ username: 'admin', role: 'admin' });
    fixture.detectChanges();

    const logoutBtn = el.querySelector('button[aria-label="Выйти"]') as HTMLButtonElement;
    logoutBtn.click();
    expect(mockAuthService.logout).toHaveBeenCalled();
  });

  it('renders language switcher with current language selected', () => {
    const switcher = el.querySelector('[aria-label="Язык"]');
    expect(switcher).not.toBeNull();

    const buttons = Array.from(switcher?.querySelectorAll('button') ?? []);
    expect(buttons.map((button) => button.textContent?.trim())).toEqual(['RU', 'EN']);
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[1].getAttribute('aria-pressed')).toBe('false');
  });

  it('switches language and rewrites the current localized URL', () => {
    jest.spyOn(router, 'url', 'get').mockReturnValue('/ru/articles/typed-articles?tag=angular');
    const navigateByUrlSpy = jest.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const englishButton = Array.from(el.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'EN',
    ) as HTMLButtonElement;

    englishButton.click();

    expect(mockI18nService.switchLanguage).toHaveBeenCalledWith('en');
    expect(navigateByUrlSpy).toHaveBeenCalledWith('/en/articles/typed-articles?tag=angular');
  });

  it('rewrites the site-build case-study URL between localized public routes', () => {
    expect(rewriteLanguagePrefixedUrl('/ru/how-this-site-is-built#quality', 'en')).toBe(
      '/en/how-this-site-is-built#quality',
    );
    expect(rewriteLanguagePrefixedUrl('/how-this-site-is-built', 'ru')).toBe(
      '/ru/how-this-site-is-built',
    );
    expect(rewriteLanguagePrefixedUrl('/ru/updates?from=footer', 'en')).toBe(
      '/en/updates?from=footer',
    );
    expect(rewriteLanguagePrefixedUrl('/updates', 'ru')).toBe('/ru/updates');
    expect(rewriteLanguagePrefixedUrl('/about-me', 'ru')).toBe('/about-me');
  });
});

function findButtonByText(root: ParentNode, text: string): HTMLButtonElement {
  const button = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
    (item) => item.textContent?.trim() === text,
  );
  if (button === undefined) {
    throw new Error(`Missing ${text} button.`);
  }
  return button;
}
