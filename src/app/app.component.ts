import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { AuthModalService } from './core/auth/auth-modal.service';
import { I18nService } from './core/i18n/i18n.service';
import { LoginPageComponent } from './features/auth/pages/login-page/login-page.component';
import { CookieConsentBannerComponent } from './features/shell/components/cookie-consent-banner/cookie-consent-banner.component';
import { NotificationAreaComponent } from './features/shell/components/notification-area/notification-area.component';
import { SiteFooterComponent } from './features/shell/components/site-footer/site-footer.component';
import { SiteHeaderComponent } from './features/shell/components/site-header/site-header.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    SiteHeaderComponent,
    SiteFooterComponent,
    LoginPageComponent,
    NotificationAreaComponent,
    CookieConsentBannerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (i18n.startupError()) {
      <main
        class="app-shell gradient-body d-flex align-items-center justify-content-center min-vh-100"
      >
        <section class="text-center px-3">
          <h1 class="h4">{{ i18n.translate('i18n.startupError.title') }}</h1>
          <p class="text-body-secondary">{{ i18n.translate('i18n.startupError.message') }}</p>
          <button type="button" class="btn btn-primary" (click)="retryI18n()">
            {{ i18n.translate('i18n.startupError.retry') }}
          </button>
        </section>
      </main>
    } @else {
      <div class="app-shell gradient-body d-flex flex-column min-vh-100">
        @if (!isAdminPanelRoute()) {
          <app-site-header />
        }
        <app-notification-area />
        <router-outlet />
        @if (!isAdminPanelRoute()) {
          <app-site-footer class="mt-auto" />
        }
        <app-cookie-consent-banner />
        @if (authModal.isLoginOpen()) {
          <app-login-page />
        }
      </div>
    }
  `,
})
export class AppComponent {
  private readonly router = inject(Router);

  readonly authModal = inject(AuthModalService);
  readonly i18n = inject(I18nService);
  readonly isAdminPanelRoute = signal(isAdminPanelUrl(this.router.url));

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        this.isAdminPanelRoute.set(isAdminPanelUrl(event.urlAfterRedirects));
      });
  }

  retryI18n(): void {
    this.i18n.retryStartup().subscribe();
  }
}

export function isAdminPanelUrl(url: string): boolean {
  const pathname = new URL(url, 'http://localhost').pathname;
  return pathname === '/admin-panel' || pathname.startsWith('/admin-panel/');
}
