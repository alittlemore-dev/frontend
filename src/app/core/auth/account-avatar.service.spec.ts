import { DOCUMENT } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import { AccountAvatarService } from './account-avatar.service';
import { AccountInfo } from './account.model';

describe('AccountAvatarService', () => {
  const account: AccountInfo = {
    username: 'user',
    role: 'user',
    firstName: null,
    lastName: null,
    middleName: null,
    gender: null,
    hasAvatar: true,
  };

  function setup(platformId: object = 'browser') {
    const createObjectURL = jest.fn(() => 'blob:avatar');
    const revokeObjectURL = jest.fn();
    const apiClient = { getBlob: jest.fn(() => of(new Blob(['avatar']))) };
    const browserUrl = { createObjectURL, revokeObjectURL };

    TestBed.configureTestingModule({
      providers: [
        AccountAvatarService,
        { provide: ApiClient, useValue: apiClient },
        { provide: PLATFORM_ID, useValue: platformId },
        { provide: DOCUMENT, useValue: { defaultView: { URL: browserUrl } } },
      ],
    });

    return {
      service: TestBed.inject(AccountAvatarService),
      apiClient,
      createObjectURL,
      revokeObjectURL,
    };
  }

  it('does not request an avatar when the account has none', () => {
    const { service, apiClient } = setup();

    service.loadFor({ ...account, hasAvatar: false }).subscribe();

    expect(apiClient.getBlob).not.toHaveBeenCalled();
    expect(service.objectUrl()).toBeNull();
  });

  it('loads the private avatar as an authenticated Blob', () => {
    const { service, apiClient, createObjectURL } = setup();

    service.loadFor(account).subscribe();

    expect(apiClient.getBlob).toHaveBeenCalledWith('/api/auth/account/me/avatar');
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(service.objectUrl()).toBe('blob:avatar');
  });

  it('revokes the previous URL before publishing its replacement', () => {
    const { service, createObjectURL, revokeObjectURL } = setup();
    createObjectURL.mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second');

    service.loadFor(account).subscribe();
    service.reload().subscribe();

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:first');
    expect(revokeObjectURL.mock.invocationCallOrder[0]).toBeLessThan(
      createObjectURL.mock.invocationCallOrder[1],
    );
    expect(service.objectUrl()).toBe('blob:second');
  });

  it('clears the current URL and absorbs avatar request errors', () => {
    const { service, apiClient, revokeObjectURL } = setup();
    service.loadFor(account).subscribe();
    apiClient.getBlob.mockReturnValueOnce(throwError(() => new Error('unavailable')));
    let completed = false;

    service.reload().subscribe(() => {
      completed = true;
    });

    expect(completed).toBe(true);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:avatar');
    expect(service.objectUrl()).toBeNull();
  });

  it('clears and revokes the current URL explicitly', () => {
    const { service, revokeObjectURL } = setup();
    service.loadFor(account).subscribe();

    service.clear();

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:avatar');
    expect(service.objectUrl()).toBeNull();
  });

  it('clears and revokes the current URL on destruction', () => {
    const { service, revokeObjectURL } = setup();
    service.loadFor(account).subscribe();

    service.ngOnDestroy();

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:avatar');
    expect(service.objectUrl()).toBeNull();
  });

  it('does not request or create object URLs on the server', () => {
    const { service, apiClient, createObjectURL, revokeObjectURL } = setup('server');

    service.loadFor(account).subscribe();
    service.clear();
    service.ngOnDestroy();

    expect(apiClient.getBlob).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });
});
