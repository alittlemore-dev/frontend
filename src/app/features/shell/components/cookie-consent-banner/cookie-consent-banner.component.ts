import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { ConsentService } from '../../../../core/privacy/consent.service';

@Component({
  selector: 'app-cookie-consent-banner',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!consent.cookieConsentAccepted()) {
      <section class="cookie-consent-banner p-2" data-testid="cookie-consent" aria-live="polite">
        <div class="container d-flex gap-2 align-items-center">
          <p class="m-0 flex-grow-1 small">
            {{ 'shell.cookie.text' | t }}
          </p>
          <button
            type="button"
            class="btn btn-sm button-active flex-shrink-0"
            (click)="consent.acceptCookieConsent()"
          >
            {{ 'shell.cookie.accept' | t }}
          </button>
        </div>
      </section>
    }
  `,
})
export class CookieConsentBannerComponent {
  readonly consent = inject(ConsentService);
}
