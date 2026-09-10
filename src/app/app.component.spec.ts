import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { AuthService } from './core/auth/auth.service';
import { AuthModalService } from './core/auth/auth-modal.service';
import { ThemeService } from './core/layout/theme.service';
import { NotificationService } from './core/notifications/notification.service';
import { ConsentService } from './core/privacy/consent.service';
import { I18nService } from './core/i18n/i18n.service';

@Component({
  standalone: true,
  template: '',
})
class BlankRouteComponent {}

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let isLoginOpen: ReturnType<typeof signal<boolean>>;
  let startupError: ReturnType<typeof signal<boolean>>;
  let retryStartup: jest.Mock;

  beforeEach(async () => {
    isLoginOpen = signal(false);
    startupError = signal(false);
    retryStartup = jest.fn().mockReturnValue({ subscribe: jest.fn() });

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([{ path: 'admin-panel', component: BlankRouteComponent }]),
        {
          provide: AuthModalService,
          useValue: {
            isLoginOpen,
            openLogin: jest.fn(),
            closeLogin: jest.fn(() => isLoginOpen.set(false)),
          },
        },
        {
          provide: AuthService,
          useValue: {
            currentUser: signal(null),
            isLoggedIn: () => false,
            isRestoringSession: signal(false),
            canManageContent: () => false,
            ensureCurrentUserLoaded: jest.fn(),
            logout: jest.fn(),
            login: jest.fn(),
          },
        },
        {
          provide: ThemeService,
          useValue: {
            theme: signal('light'),
            toggleTheme: jest.fn(),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            notifications: signal([]),
            dismiss: jest.fn(),
          },
        },
        {
          provide: ConsentService,
          useValue: {
            cookieConsentAccepted: signal(true),
            acceptCookieConsent: jest.fn(),
          },
        },
        {
          provide: I18nService,
          useValue: {
            language: signal('ru'),
            languages: signal([
              { code: 'ru', label: 'Русский' },
              { code: 'en', label: 'English' },
            ]),
            startupError,
            retryStartup,
            translate: (key: string) => {
              const messages: Record<string, string> = {
                'i18n.startupError.title': 'Failed to load localization',
                'i18n.startupError.message': 'Check the API connection and try again.',
                'i18n.startupError.retry': 'Retry',
                'shell.nav.matrix': 'Матрица компетенций',
                'shell.nav.articles': 'Статьи',
                'shell.nav.adminPanel': 'Админ-панель',
                'shell.nav.toggleNavigation': 'Открыть навигацию',
                'shell.theme.dark': 'Dark',
                'shell.theme.light': 'Light',
                'shell.theme.toggle': 'Переключить тему',
                'shell.auth.login': 'Войти',
                'shell.language.label': 'Язык',
              };
              return messages[key] ?? key;
            },
            switchLanguage: jest.fn().mockReturnValue({ subscribe: jest.fn() }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
  });

  it('renders the login component as a modal when requested', () => {
    isLoginOpen.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-login-page')).not.toBeNull();
  });

  it('renders global notification area', () => {
    expect(fixture.nativeElement.querySelector('app-notification-area')).not.toBeNull();
  });

  it('renders cookie consent banner host', () => {
    expect(fixture.nativeElement.querySelector('app-cookie-consent-banner')).not.toBeNull();
  });

  it('renders startup error instead of the app shell when i18n bootstrap failed', () => {
    startupError.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-site-header')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Failed to load localization');
  });

  it('retries i18n startup from the startup error screen', () => {
    startupError.set(true);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    button.click();

    expect(retryStartup).toHaveBeenCalled();
  });

  it('hides the public site header and footer on admin-panel routes', async () => {
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/admin-panel');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-site-header')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-site-footer')).toBeNull();
  });
});
