import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { CookieConsentBannerComponent } from './cookie-consent-banner.component';
import { ConsentService } from '../../../../core/privacy/consent.service';

describe('CookieConsentBannerComponent', () => {
  let fixture: ComponentFixture<CookieConsentBannerComponent>;
  let accepted: ReturnType<typeof signal<boolean>>;
  let acceptCookieConsent: jest.Mock;

  beforeEach(async () => {
    accepted = signal(false);
    acceptCookieConsent = jest.fn(() => accepted.set(true));

    await TestBed.configureTestingModule({
      imports: [CookieConsentBannerComponent],
      providers: [
        {
          provide: ConsentService,
          useValue: {
            cookieConsentAccepted: accepted,
            acceptCookieConsent,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CookieConsentBannerComponent);
    fixture.detectChanges();
  });

  it('shows banner until cookie consent is accepted', () => {
    expect(fixture.nativeElement.querySelector('[data-testid="cookie-consent"]')).toBeTruthy();

    accepted.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="cookie-consent"]')).toBeNull();
  });

  it('accepts cookie consent from the button', () => {
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    button.click();

    expect(acceptCookieConsent).toHaveBeenCalled();
  });
});
