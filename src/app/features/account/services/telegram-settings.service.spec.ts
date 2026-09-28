import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { AccountSettingsService } from '../../../core/auth/account-settings.service';
import { ApiClient } from '../../../core/http/api-client.service';
import { TelegramSettingsService } from './telegram-settings.service';

describe('TelegramSettingsService', () => {
  let service: TelegramSettingsService;
  let http: HttpTestingController;
  const accountSettings = signal({
    language: 'ru' as const,
    theme: 'dark' as const,
    timeZone: 'UTC',
    telegramBots: { 'personal-workspace': { enabled: true, notify: false } },
  });
  const preferences = { settings: accountSettings, update: jest.fn() };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TelegramSettingsService,
        ApiClient,
        { provide: AccountSettingsService, useValue: preferences },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(TelegramSettingsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads bot state from account settings and Workspace connections', () => {
    let enabled = false;
    let available = false;
    service.load().subscribe((value) => {
      enabled = value.enabled;
      available = value.available;
    });
    const workspaceRequest = http.expectOne((item) =>
      item.url.endsWith('/api/personal-workspace/telegram'),
    );
    expect(workspaceRequest.request.method).toBe('GET');
    workspaceRequest.flush({ available: true, invitations: [], connections: [] });
    expect(enabled).toBe(true);
    expect(available).toBe(true);
  });

  it('saves the Telegram switch through the full account settings update', () => {
    preferences.update.mockReturnValue(of({ settings: accountSettings() }));
    service.setEnabled(false).subscribe();

    expect(preferences.update).toHaveBeenCalledWith({
      language: 'ru',
      theme: 'dark',
      timeZone: 'UTC',
      telegramBots: { 'personal-workspace': { enabled: false, notify: false } },
    });
  });

  it('updates the bot notification switch without changing bot availability', () => {
    preferences.update.mockReturnValue(of({ settings: accountSettings() }));
    service.setNotify(true).subscribe();
    expect(preferences.update).toHaveBeenCalledWith({
      language: 'ru',
      theme: 'dark',
      timeZone: 'UTC',
      telegramBots: { 'personal-workspace': { enabled: true, notify: true } },
    });
  });

  it('saves all notification preferences for one connection', () => {
    const settings = {
      notifyBirthday: true,
      notifyMemorableDate: false,
      language: 'ru' as const,
    };
    service.updateConnectionSettings('abc', settings).subscribe();
    const request = http.expectOne((item) =>
      item.url.endsWith('/api/personal-workspace/telegram/connections/abc/settings'),
    );
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(settings);
    request.flush({});
  });

  it('creates a one-time invitation and returns its link', () => {
    let url = '';
    service.createInvitation('Family').subscribe((value) => (url = value.url));
    const request = http.expectOne((item) =>
      item.url.endsWith('/api/personal-workspace/telegram/invitations'),
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ label: 'Family' });
    request.flush({
      url: 'https://t.me/shared_bot?start=secret',
      expiresAt: '2026-09-26T12:15:00Z',
    });
    expect(url).toBe('https://t.me/shared_bot?start=secret');
  });

  it('sends block and unblock actions for one connection', () => {
    service.changeState('abc', 'block').subscribe();
    service.changeState('abc', 'unblock').subscribe();
    for (const action of ['block', 'unblock']) {
      const request = http.expectOne((item) =>
        item.url.endsWith(`/api/personal-workspace/telegram/connections/abc/${action}`),
      );
      expect(request.request.method).toBe('POST');
      request.flush({});
    }
  });
});
