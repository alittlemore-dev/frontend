import { TestBed } from '@angular/core/testing';
import { AuthTokenService } from './auth-token.service';

describe('AuthTokenService', () => {
  let service: AuthTokenService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthTokenService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
  });

  it('token starts null even when legacy localStorage contains a token', () => {
    localStorage.setItem('accessToken', 'legacy-token');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthTokenService);

    expect(service.token()).toBeNull();
  });

  it('setToken updates only the in-memory signal', () => {
    const setItem = jest.spyOn(Storage.prototype, 'setItem');

    service.setToken('test-token-123');

    expect(service.token()).toBe('test-token-123');
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(setItem).not.toHaveBeenCalled();
  });

  it('clearToken clears only the in-memory signal', () => {
    const removeItem = jest.spyOn(Storage.prototype, 'removeItem');

    service.setToken('test-token-123');
    service.clearToken();

    expect(service.token()).toBeNull();
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('does not touch localStorage APIs', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('localStorage must not be read for auth');
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('localStorage must not be written for auth');
    });
    jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('localStorage must not be cleared for auth');
    });

    expect(service.token()).toBeNull();
    service.setToken('memory-token');
    expect(service.token()).toBe('memory-token');
    service.clearToken();
    expect(service.token()).toBeNull();
  });
});
