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
      <section
        class="cookie-consent-banner position-fixed bottom-0 start-0 end-0 p-3"
        data-testid="cookie-consent"
        aria-live="polite"
      >
        <div class="container d-flex flex-column flex-md-row gap-3 align-items-md-center">
          <p class="m-0 flex-grow-1">
            {{ 'shell.cookie.text' | t }}
          </p>
          <button
            type="button"
            class="btn button-active flex-shrink-0"
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
