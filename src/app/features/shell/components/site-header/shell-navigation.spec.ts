import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, RouterOutlet, provideRouter } from '@angular/router';
import { ThemeService } from '@alittlemore.dev/design-system';
import { SiteHeaderComponent } from './site-header.component';
import { SiteFooterComponent } from '../site-footer/site-footer.component';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { I18nBundle } from '../../../../core/i18n/i18n.model';
import { i18nBundleResolver } from '../../../../core/i18n/i18n.resolver';
import { AuthService } from '../../../../core/auth/auth.service';
import { AuthModalService } from '../../../../core/auth/auth-modal.service';
import { AccountAvatarService } from '../../../../core/auth/account-avatar.service';
import { AccountSettingsService } from '../../../../core/auth/account-settings.service';

@Component({
  imports: [SiteHeaderComponent, SiteFooterComponent, RouterOutlet],
  template: '<app-site-header /><router-outlet /><app-site-footer />',
})
class ShellHost {}
@Component({ template: '<h1>Page</h1>' })
class Page {}

describe('Shared shell across localization bundles', () => {
  it.each(['ru', 'en'] as const)(
    'keeps header labels and first-click navigation usable in %s',
    async (language) => {
      localStorage.clear();
      localStorage.setItem('chosenLanguage', language);
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([
            {
              path: ':language/how-this-site-is-built',
              component: Page,
              resolve: { localization: i18nBundleResolver(I18nBundle.HowThisSiteIsBuilt) },
            },
            {
              path: ':language/updates',
              component: Page,
              resolve: { localization: i18nBundleResolver(I18nBundle.Updates) },
            },
            {
              path: ':language/competency/articles',
              component: Page,
              resolve: { localization: i18nBundleResolver(I18nBundle.Articles) },
            },
          ]),
          {
            provide: AuthService,
            useValue: {
              currentUser: signal(null),
              isLoggedIn: () => false,
              canManageContent: () => false,
              isRestoringSession: signal(false),
            },
          },
          { provide: AuthModalService, useValue: { isLoginOpen: signal(false) } },
          { provide: AccountAvatarService, useValue: { objectUrl: signal(null) } },
          {
            provide: AccountSettingsService,
            useValue: { saving: signal(false), applicationFailed: signal(false) },
          },
          { provide: ThemeService, useValue: { theme: signal('light') } },
        ],
      });
      const http = TestBed.inject(HttpTestingController);
      const i18n = TestBed.inject(I18nService);
      i18n.initialize().subscribe();
      http
        .expectOne((request) => request.url.endsWith('/api/i18n/languages'))
        .flush({
          defaultLanguage: language,
          languages: [
            { code: 'ru', label: 'Русский' },
            { code: 'en', label: 'English' },
          ],
        });
      http
        .expectOne((request) => request.url.endsWith(`/api/i18n/bundles/shared/${language}`))
        .flush({
          bundle: 'shared',
          language,
          messages: {
            'shell.services.site': 'alittlemore.dev',
            'shell.services.articles': 'Articles',
            'shell.footer.updates': 'Updates',
            'shell.footer.siteBuild': 'How this site is built',
            'shell.nav.toggleNavigation': 'Open services',
            'shell.account': 'Account',
            'shell.settings': 'Settings',
          },
        });
      const fixture = TestBed.createComponent(ShellHost);
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      const dialog = el.querySelector('dialog')!;
      dialog.showModal = () => {
        dialog.open = true;
      };
      dialog.close = () => {
        dialog.open = false;
        dialog.dispatchEvent(new Event('close'));
      };
      const router = TestBed.inject(Router);
      const started = router.navigateByUrl(`/${language}/how-this-site-is-built`);
      await settle();
      http
        .expectOne((request) =>
          request.url.endsWith(`/api/i18n/bundles/how-this-site-is-built/${language}`),
        )
        .flush({
          bundle: 'how-this-site-is-built',
          language,
          messages: { 'siteBuild.hero.logoAlt': 'Page-specific logo' },
        });
      await started;
      fixture.detectChanges();
      el.querySelector<HTMLAnchorElement>(`a[href="/${language}/updates"]`)!.click();
      await settle();
      http
        .expectOne((request) => request.url.endsWith(`/api/i18n/bundles/updates/${language}`))
        .flush({ bundle: 'updates', language, messages: { 'updates.title': 'Updates' } });
      await fixture.whenStable();
      fixture.detectChanges();
      expect(router.url).toBe(`/${language}/updates`);
      expect(el.querySelector('.service-name')!.textContent).toBe('alittlemore.dev');
      expect(el.querySelector('.service-logo')!.getAttribute('alt')).toBe('alittlemore.dev');
      expect(i18n.startupError()).toBe(false);
      el.querySelector<HTMLButtonElement>('button[aria-label="Open services"]')!.click();
      fixture.detectChanges();
      expect(dialog.open).toBe(true);
      el.querySelector<HTMLAnchorElement>(`a[href="/${language}/competency/articles"]`)!.click();
      await settle();
      http
        .expectOne((request) => request.url.endsWith(`/api/i18n/bundles/articles/${language}`))
        .flush({ bundle: 'articles', language, messages: { 'articles.title': 'Articles' } });
      await fixture.whenStable();
      fixture.detectChanges();
      expect(router.url).toBe(`/${language}/competency/articles`);
      expect(dialog.open).toBe(false);
      expect(el.querySelector('.service-name')!.textContent).toBe('Articles');
      el.querySelector<HTMLAnchorElement>(`a[href="/${language}/updates"]`)!.click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(router.url).toBe(`/${language}/updates`);
      expect(el.querySelector('.service-name')!.textContent).toBe('alittlemore.dev');
      http.verify();
      fixture.destroy();
      localStorage.clear();
    },
  );
});

async function settle(): Promise<void> {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}
