import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { AccountAvatarService } from '../../../core/auth/account-avatar.service';
import { AccountInfo } from '../../../core/auth/account.model';
import { AuthSessionService } from '../../../core/auth/auth-session.service';
import { ApiClient } from '../../../core/http/api-client.service';
import { AccountService } from './account.service';

describe('AccountService', () => {
  const account: AccountInfo = {
    username: 'reader',
    role: 'user',
    firstName: 'Dmitriy',
    lastName: 'Lunev',
    middleName: null,
    gender: 'male',
    hasAvatar: true,
  };
  let currentUser: ReturnType<typeof signal<AccountInfo | null>>;
  let apiClient: {
    get: jest.Mock;
    patch: jest.Mock;
    put: jest.Mock;
    delete: jest.Mock;
  };
  let avatar: { loadFor: jest.Mock; clear: jest.Mock };
  let service: AccountService;

  beforeEach(() => {
    currentUser = signal<AccountInfo | null>(null);
    apiClient = {
      get: jest.fn(),
      patch: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    };
    avatar = { loadFor: jest.fn(() => of(void 0)), clear: jest.fn() };
    TestBed.configureTestingModule({
      providers: [
        AccountService,
        { provide: ApiClient, useValue: apiClient },
        {
          provide: AuthSessionService,
          useValue: { currentUser, setCurrentUser: (value: AccountInfo) => currentUser.set(value) },
        },
        { provide: AccountAvatarService, useValue: avatar },
      ],
    });
    service = TestBed.inject(AccountService);
  });

  it('returns the session account without a duplicate request', async () => {
    currentUser.set(account);

    await expect(firstValueFrom(service.ensureLoaded())).resolves.toEqual(account);

    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it('loads and stores the account when the session is empty', async () => {
    apiClient.get.mockReturnValueOnce(of(account));

    await expect(firstValueFrom(service.ensureLoaded())).resolves.toEqual(account);

    expect(apiClient.get).toHaveBeenCalledWith('/api/auth/account/me');
    expect(currentUser()).toEqual(account);
    expect(avatar.loadFor).toHaveBeenCalledWith(account);
  });

  it('patches JSON and replaces the session account', async () => {
    const updated = { ...account, middleName: 'Sergeevich' };
    apiClient.patch.mockReturnValueOnce(of(updated));

    await expect(
      firstValueFrom(service.updateProfile({ middleName: 'Sergeevich' })),
    ).resolves.toEqual(updated);

    expect(apiClient.patch).toHaveBeenCalledWith('/api/auth/account/me', {
      middleName: 'Sergeevich',
    });
    expect(currentUser()).toEqual(updated);
    expect(avatar.loadFor).toHaveBeenCalledWith(updated);
  });

  it('uploads FormData under the file field and reloads the private avatar', async () => {
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    apiClient.put.mockReturnValueOnce(of(account));

    await expect(firstValueFrom(service.replaceAvatar(file))).resolves.toEqual(account);

    expect(apiClient.put).toHaveBeenCalledWith('/api/auth/account/me/avatar', expect.any(FormData));
    const body = apiClient.put.mock.calls[0][1] as FormData;
    expect(body.get('file')).toBe(file);
    expect(currentUser()).toEqual(account);
    expect(avatar.loadFor).toHaveBeenCalledWith(account);
  });

  it('deletes the avatar, replaces the session account, and clears its object URL', async () => {
    const withoutAvatar = { ...account, hasAvatar: false };
    apiClient.delete.mockReturnValueOnce(of(withoutAvatar));

    await expect(firstValueFrom(service.removeAvatar())).resolves.toEqual(withoutAvatar);

    expect(apiClient.delete).toHaveBeenCalledWith('/api/auth/account/me/avatar');
    expect(currentUser()).toEqual(withoutAvatar);
    expect(avatar.clear).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['GET', () => service.ensureLoaded(), 'get'],
    ['PATCH', () => service.updateProfile({ firstName: 'Changed' }), 'patch'],
    ['PUT', () => service.replaceAvatar(new File(['x'], 'x.png')), 'put'],
    ['DELETE', () => service.removeAvatar(), 'delete'],
  ] as const)(
    'does not mutate state after a failed %s request',
    async (_label, request, method) => {
      apiClient[method].mockReturnValueOnce(throwError(() => new Error('failed')));

      await expect(firstValueFrom(request())).rejects.toThrow('failed');

      expect(currentUser()).toBeNull();
      expect(avatar.loadFor).not.toHaveBeenCalled();
      expect(avatar.clear).not.toHaveBeenCalled();
    },
  );
});
