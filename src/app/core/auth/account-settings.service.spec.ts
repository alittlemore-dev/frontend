import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ThemeService } from '@alittlemore.dev/design-system';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import { I18nService } from '../i18n/i18n.service';
import { AccountInfo } from './account.model';
import { AuthSessionService } from './auth-session.service';
import { AccountSettingsService } from './account-settings.service';

@Component({ standalone: true, template: '' })
class EmptyPage {}

const account: AccountInfo = {
  username: 'reader',
  role: 'user',
  firstName: null,
  lastName: null,
  middleName: null,
  gender: null,
  hasAvatar: false,
  settings: { language: 'en', theme: 'light' },
};

describe('AccountSettingsService', () => {
  const api = { put: jest.fn(), get: jest.fn() };
  const i18n = { language: signal('ru'), switchLanguage: jest.fn(), persistLanguage: jest.fn() };
  const theme = { setTheme: jest.fn() };
  let service: AccountSettingsService;
  let session: AuthSessionService;
  beforeEach(() => {
    jest.clearAllMocks();
    i18n.switchLanguage.mockReturnValue(of(void 0));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: EmptyPage }]),
        { provide: ApiClient, useValue: api },
        { provide: I18nService, useValue: i18n },
        { provide: ThemeService, useValue: theme },
      ],
    });
    service = TestBed.inject(AccountSettingsService);
    session = TestBed.inject(AuthSessionService);
  });

  it('applies server preferences without writing them back', () => {
    session.setCurrentUser(account);
    TestBed.tick();
    expect(theme.setTheme).toHaveBeenCalledWith('light');
    expect(i18n.switchLanguage).toHaveBeenCalledWith('en', false);
    expect(i18n.persistLanguage).toHaveBeenCalledWith('en');
    expect(api.put).not.toHaveBeenCalled();
  });

  it('saves the full settings and keeps the previous account until success', async () => {
    session.setCurrentUser(account);
    const result = new Subject<AccountInfo>();
    api.put.mockReturnValue(result);
    const saved = firstValueFrom(service.update({ language: 'ru', theme: 'dark' }));
    expect(service.saving()).toBe(true);
    expect(session.currentUser()).toEqual(account);
    expect(api.put).toHaveBeenCalledWith('/api/auth/account/me/settings', {
      language: 'ru',
      theme: 'dark',
    });
    result.next({ ...account, settings: { language: 'ru', theme: 'dark' } });
    result.complete();
    await saved;
    TestBed.tick();
    expect(session.currentUser()?.settings.theme).toBe('dark');
    expect(service.saving()).toBe(false);
  });

  it('preserves confirmed values when PUT fails', async () => {
    session.setCurrentUser(account);
    api.put.mockReturnValue(throwError(() => new Error('offline')));
    await expect(firstValueFrom(service.update({ language: 'ru', theme: 'dark' }))).rejects.toThrow(
      'offline',
    );
    expect(session.currentUser()).toEqual(account);
    expect(service.saving()).toBe(false);
  });

  it('offers retry when the language bundle fails without losing the account', () => {
    i18n.switchLanguage.mockReturnValueOnce(throwError(() => new Error('bundle')));
    session.setCurrentUser(account);
    TestBed.tick();
    expect(service.applicationFailed()).toBe(true);
    expect(session.currentUser()).toEqual(account);
    service.retryApplication();
    TestBed.tick();
    expect(service.applicationFailed()).toBe(false);
  });

  it('uses the public URL language without overwriting the account preference', () => {
    const router = TestBed.inject(Router);
    jest.spyOn(router, 'url', 'get').mockReturnValue('/ru/competency/articles');
    session.setCurrentUser(account);
    TestBed.tick();
    expect(i18n.switchLanguage).toHaveBeenCalledWith('ru', false);
    expect(i18n.persistLanguage).toHaveBeenCalledWith('en');
  });
  it('restores account language when leaving a public route', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/ru/competency/articles');
    session.setCurrentUser(account);
    TestBed.tick();
    expect(i18n.switchLanguage).toHaveBeenLastCalledWith('ru', false);
    await router.navigateByUrl('/account/settings');
    TestBed.tick();
    expect(i18n.switchLanguage).toHaveBeenLastCalledWith('en', false);
  });

  it('refreshes the account whenever settings are opened', async () => {
    session.setCurrentUser(account);
    const updated = { ...account, settings: { language: 'ru', theme: 'dark' } };
    api.get.mockReturnValue(of(updated));
    await firstValueFrom(service.load());
    expect(api.get).toHaveBeenCalledWith('/api/auth/account/me');
    expect(session.currentUser()).toEqual(updated);
  });
  it('does not let an older refresh overwrite a confirmed save', async () => {
    session.setCurrentUser(account);
    const loadResponse = new Subject<AccountInfo>();
    api.get.mockReturnValue(loadResponse);
    const loading = firstValueFrom(service.load());
    const updated: AccountInfo = { ...account, settings: { language: 'ru', theme: 'dark' } };
    api.put.mockReturnValue(of(updated));
    await firstValueFrom(service.update(updated.settings));
    loadResponse.next(account);
    await loading;
    expect(session.currentUser()).toEqual(updated);
  });

  it('ignores a late save after logout and same-user relogin', () => {
    session.setCurrentUser(account);
    const response = new Subject<AccountInfo>();
    api.put.mockReturnValue(response);
    const next = jest.fn();
    service.update({ language: 'ru', theme: 'dark' }).subscribe(next);
    session.clear();
    session.setCurrentUser(account);
    response.next({ ...account, settings: { language: 'ru', theme: 'dark' } });
    response.complete();
    expect(session.currentUser()).toEqual(account);
    expect(next).not.toHaveBeenCalled();
    expect(service.saving()).toBe(false);
  });
});
