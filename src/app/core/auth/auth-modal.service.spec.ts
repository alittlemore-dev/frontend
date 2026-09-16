import { AuthModalService } from './auth-modal.service';

describe('AuthModalService', () => {
  it('keeps required recovery open until login completes', () => {
    const service = new AuthModalService();
    service.openLogin({ required: true });
    service.closeLogin();
    expect(service.isLoginOpen()).toBe(true);
    expect(service.loginRequired()).toBe(true);
    expect(service.completeLogin()).toBeNull();
    expect(service.isLoginOpen()).toBe(false);
    expect(service.loginRequired()).toBe(false);
  });

  it('retains the original account across concurrent failures and detects identity changes', () => {
    const service = new AuthModalService();
    service.openLogin({ required: true, account: { username: 'owner', role: 'owner' } });
    service.openLogin({ required: true, account: null });
    expect(service.requiresPrivateStateReset({ username: 'owner', role: 'owner' })).toBe(false);
    expect(service.requiresPrivateStateReset({ username: 'owner', role: 'moderator' })).toBe(true);
    expect(service.requiresPrivateStateReset({ username: 'another', role: 'owner' })).toBe(true);
  });

  it('preserves local return paths including query and fragment', () => {
    const service = new AuthModalService();
    const url = '/personal-workspace/resumes/123?tab=edit#experience';
    service.openLogin({ returnUrl: url });
    expect(service.completeLogin()).toBe(url);
  });

  it.each([
    'https://external.example',
    '//external.example',
    '/\\external.example',
    '/login?returnUrl=/login',
    '/login;next=test',
    '/%2fexternal.example',
    'relative',
    '/personal-workspace%00',
    '/personal-workspace%0A',
  ])('rejects unsafe or looping return path %s', (returnUrl) => {
    const service = new AuthModalService();
    service.openLogin({ returnUrl });
    expect(service.completeLogin()).toBeNull();
  });
});
