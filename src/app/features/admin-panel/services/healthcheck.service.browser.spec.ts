import { DOCUMENT } from '@angular/common';
import {
  FetchBackend,
  HttpBackend,
  HttpRequest,
  HttpResponse,
  provideHttpClient,
  withInterceptors,
  withNoXsrfProtection,
} from '@angular/common/http';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthTokenService } from '../../../core/auth/auth-token.service';
import { BrowserApiBackend } from '../../../core/http/browser-api.backend';
import { authInterceptor } from '../../../core/interceptors/auth.interceptor';
import { healthcheckDto } from '../models/healthcheck.fixture';
import { HealthcheckService } from './healthcheck.service';

jest.mock('../../../../environments/environment', () => ({
  environment: { production: true, apiUrl: '', siteUrl: '' },
}));

describe('HealthcheckService browser transport', () => {
  it('sends the owner session to the infrastructure namespace and maps the response', () => {
    const transport = {
      handle: jest.fn((request: HttpRequest<unknown>) => {
        expect(request.url).toBe('https://site.example/api/infra/healthcheck');
        expect(request.headers.get('Authorization')).toBe('Bearer owner-session-fixture');
        return of(new HttpResponse({ status: 200, body: healthcheckDto() }));
      }),
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor]), withNoXsrfProtection()),
        BrowserApiBackend,
        { provide: HttpBackend, useExisting: BrowserApiBackend },
        { provide: FetchBackend, useValue: transport },
        { provide: DOCUMENT, useValue: { location: { origin: 'https://site.example' } } },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    TestBed.inject(AuthTokenService).setToken('owner-session-fixture');
    const next = jest.fn();
    TestBed.inject(HealthcheckService).getHealthcheck().subscribe(next);

    expect(transport.handle).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        systems: [expect.objectContaining({ id: 'backups', status: 'healthy' })],
      }),
    );
  });
});
