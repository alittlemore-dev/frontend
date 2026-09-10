import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { ConsentService } from './consent.service';

describe('ConsentService', () => {
  let service: ConsentService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ConsentService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
  });

  it('starts without cookie consent', () => {
    expect(service.cookieConsentAccepted()).toBe(false);
  });

  it('persists accepted cookie consent', () => {
    service.acceptCookieConsent();

    expect(service.cookieConsentAccepted()).toBe(true);
    expect(localStorage.getItem('cookieConsentAccepted')).toBe('true');
  });

  it('does not read localStorage when server document has no defaultView', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('localStorage is not available on the server');
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('localStorage is not available on the server');
    });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: DOCUMENT,
          useValue: {
            defaultView: null,
          },
        },
      ],
    });

    const serverService = TestBed.inject(ConsentService);

    expect(serverService.cookieConsentAccepted()).toBe(false);
    serverService.acceptCookieConsent();
    expect(serverService.cookieConsentAccepted()).toBe(true);
  });
});
