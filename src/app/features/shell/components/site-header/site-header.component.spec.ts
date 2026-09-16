import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { SiteHeaderComponent, rewriteLanguagePrefixedUrl } from './site-header.component';
import { ThemeService } from '@alittlemore.dev/design-system';
import { AuthService, AccountInfo } from '../../../../core/auth/auth.service';
import { AuthModalService } from '../../../../core/auth/auth-modal.service';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { UnsavedChangesService } from '../../../../core/unsaved-changes/unsaved-changes.service';
import { createI18nTestingValue } from '../../../../testing/i18n-testing';

@Component({ standalone: true, template: '' })
class EmptyRouteComponent {}

describe('Shared site header', () => {
  let fixture: ComponentFixture<SiteHeaderComponent>;
  let el: HTMLElement;
  const currentUser = signal<AccountInfo | null>(null);
  const restoring = signal(false);
  const theme = { theme: signal('light'), toggleTheme: jest.fn() };
  const modal = { openLogin: jest.fn(), isLoginOpen: signal(false) };
  const auth = {
    currentUser,
    isRestoringSession: restoring,
    isLoggedIn: () => currentUser() !== null,
    canManageContent: () => ['owner', 'admin', 'moderator'].includes(currentUser()?.role ?? ''),
    ensureCurrentUserLoaded: jest.fn(),
    logout: jest.fn(),
  };
  const changes = { confirmDiscard: jest.fn(), discardChanges: jest.fn() };
  let i18n: ReturnType<typeof createI18nTestingValue>;

  beforeEach(async () => {
    jest.clearAllMocks();
    modal.isLoginOpen.set(false);
    currentUser.set(null);
    restoring.set(false);
    auth.ensureCurrentUserLoaded.mockReturnValue(of(void 0));
    auth.logout.mockReturnValue(of(void 0));
    changes.confirmDiscard.mockReturnValue(true);
    i18n = createI18nTestingValue();
    await TestBed.configureTestingModule({
      imports: [SiteHeaderComponent],
      providers: [
        provideRouter([{ path: '**', component: EmptyRouteComponent }]),
        { provide: AuthService, useValue: auth },
        { provide: AuthModalService, useValue: modal },
        { provide: ThemeService, useValue: theme },
        { provide: I18nService, useValue: i18n },
        { provide: UnsavedChangesService, useValue: changes },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SiteHeaderComponent);
    fixture.detectChanges();
    el = fixture.nativeElement;
    const dialog = el.querySelector('dialog')!;
    dialog.showModal = () => {
      dialog.open = true;
    };
    dialog.close = () => {
      dialog.open = false;
      dialog.dispatchEvent(new Event('close'));
    };
  });

  function button(label: string): HTMLButtonElement {
    label = i18n.translate!(label);
    const match = [...el.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === label || b.getAttribute('aria-label') === label,
    );
    if (!match) throw new Error(`Missing button: ${label}`);
    return match;
  }

  it('provides guest service entry paths without the admin panel', () => {
    button('shell.nav.toggleNavigation').click();
    fixture.detectChanges();
    expect(el.querySelector('dialog')!.open).toBe(true);
    expect([...el.querySelectorAll('ds-drawer a')].map((a) => a.getAttribute('href'))).toEqual([
      '/personal-workspace',
      '/ru/competency/matrix',
      '/ru/competency/articles',
    ]);
    el.querySelector<HTMLAnchorElement>('a[href="/ru/competency/matrix"]')!.click();
    fixture.detectChanges();
    expect(el.querySelector('dialog')!.open).toBe(false);
  });

  it('hides owner-only workspace from other authenticated roles', () => {
    currentUser.set({ username: 'moderator', role: 'moderator' });
    fixture.detectChanges();
    expect(el.querySelector('a[href="/personal-workspace"]')).toBeNull();
    expect(el.querySelector('a[href="/admin-panel"]')).not.toBeNull();
    currentUser.set({ username: 'reader', role: 'user' });
    fixture.detectChanges();
    expect(el.querySelector('a[href="/admin-panel"]')).toBeNull();
  });

  it('retains one header and changes its service icon on route changes', async () => {
    await TestBed.inject(Router).navigateByUrl('/admin-panel');
    fixture.detectChanges();
    expect(el.querySelector('.service-logo')!.getAttribute('src')).toBe(
      '/brand/admin-frame-64.png',
    );
    expect(el.querySelector('a[title="На главную"]')).toBeNull();
    await TestBed.inject(Router).navigateByUrl('/personal-workspace/resumes');
    fixture.detectChanges();
    expect(el.querySelector('.service-logo')!.getAttribute('src')).toBe(
      '/brand/archive-portal-64.png',
    );
    await TestBed.inject(Router).navigateByUrl('/ru/competency/matrix');
    fixture.detectChanges();
    expect(el.querySelector('.service-logo')!.getAttribute('src')).toBe('/logo-192x192.webp');
    await TestBed.inject(Router).navigateByUrl('/en/competency/articles');
    fixture.detectChanges();
    expect(el.querySelector('.service-logo')!.getAttribute('src')).toBe('/logo-192x192.webp');
    await TestBed.inject(Router).navigateByUrl('/ru/how-this-site-is-built');
    fixture.detectChanges();
    expect(el.querySelector('.service-logo')).toBeNull();
  });

  it('uses the account dropdown for theme, nested language choice and login', () => {
    expect(el.querySelector('ds-dropdown')).not.toBeNull();
    button('shell.theme.toggle').click();
    expect(theme.toggleTheme).toHaveBeenCalled();
    expect(el.querySelector('#site-language-options')).toBeNull();
    button('shell.language.label').click();
    fixture.detectChanges();
    const switchLanguage = jest.spyOn(i18n, 'switchLanguage');
    button('EN').click();
    expect(switchLanguage).toHaveBeenCalledWith('en');
    fixture.componentInstance.accountMenuChanged(false);
    fixture.detectChanges();
    expect(el.querySelector('#site-language-options')).toBeNull();
  });

  it('restores a session before opening the shared login modal', () => {
    button('shell.auth.login').click();
    expect(auth.ensureCurrentUserLoaded).toHaveBeenCalled();
    expect(modal.openLogin).toHaveBeenCalled();
  });

  it('does not reopen login when restoration recovered an existing account', () => {
    auth.ensureCurrentUserLoaded.mockImplementation(() => {
      currentUser.set({ username: 'owner', role: 'owner' });
      return of(void 0);
    });
    button('shell.auth.login').click();
    expect(modal.openLogin).not.toHaveBeenCalled();
  });

  it('disables login while session restoration is in flight', () => {
    restoring.set(true);
    fixture.detectChanges();
    expect(button('shell.auth.login').disabled).toBe(true);
  });

  it('guards logout against unsaved edits and disables repeated submissions', () => {
    currentUser.set({ username: 'owner', role: 'owner' });
    fixture.detectChanges();
    changes.confirmDiscard.mockReturnValue(false);
    button('shell.auth.logout').click();
    expect(auth.logout).not.toHaveBeenCalled();
    changes.confirmDiscard.mockReturnValue(true);
    const pending = new Subject<void>();
    auth.logout.mockReturnValue(pending);
    button('shell.auth.logout').click();
    fixture.detectChanges();
    expect(button('shell.auth.logout').disabled).toBe(true);
    pending.next();
    pending.complete();
    fixture.detectChanges();
    expect(changes.discardChanges).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['/ru/competency/articles?tag=x#body', 'en', '/en/competency/articles?tag=x#body'],
    [
      '/personal-workspace/resumes/42?tab=preview',
      'en',
      '/personal-workspace/resumes/42?tab=preview',
    ],
    ['/admin-panel/articles', 'ru', '/admin-panel/articles'],
  ] as const)('preserves service paths when switching %s to %s', (url, language, expected) => {
    expect(rewriteLanguagePrefixedUrl(url, language)).toBe(expected);
  });
});
