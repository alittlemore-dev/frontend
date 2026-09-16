import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthModalService } from './core/auth/auth-modal.service';
import { I18nService } from './core/i18n/i18n.service';
import { LoginPageComponent } from './features/auth/pages/login-page/login-page.component';
import { CookieConsentBannerComponent } from './features/shell/components/cookie-consent-banner/cookie-consent-banner.component';
import { NotificationAreaComponent } from '@alittlemore.dev/design-system';
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
        <div
          class="d-flex flex-column flex-grow-1"
          [attr.inert]="authModal.loginRequired() ? '' : null"
          [attr.aria-hidden]="authModal.loginRequired() ? 'true' : null"
        >
          <app-site-header />
          <ds-notification-area [closeLabel]="i18n.translate('shared.close')" />
          <router-outlet />
          <app-site-footer class="mt-auto" />
          <app-cookie-consent-banner />
        </div>
        @if (authModal.isLoginOpen()) {
          <app-login-page />
        }
      </div>
    }
  `,
})
export class AppComponent {
  readonly authModal = inject(AuthModalService);
  readonly i18n = inject(I18nService);

  retryI18n(): void {
    this.i18n.retryStartup().subscribe();
  }
}
