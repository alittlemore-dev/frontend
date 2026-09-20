import { accountUnsavedChangesGuard } from './guards/account-unsaved-changes.guard';
import { accountRoutes } from './account.routes';

describe('accountRoutes', () => {
  it('uses a shell and redirects the account root to the reserved current-user page', () => {
    const shell = accountRoutes.find((route) => route.path === '');
    const redirect = shell?.children?.find((route) => route.path === '');

    expect(shell?.loadComponent).toBeDefined();
    expect(redirect).toEqual(expect.objectContaining({ redirectTo: 'me', pathMatch: 'full' }));
  });

  it('lazy-loads the profile page with a localized title and unsaved-changes guard', () => {
    const shell = accountRoutes.find((route) => route.path === '');
    const profile = shell?.children?.find((route) => route.path === 'me');

    expect(profile?.title).toBe('account.profile.title');
    expect(profile?.loadComponent).toBeDefined();
    expect(profile?.canDeactivate).toEqual([accountUnsavedChangesGuard]);
  });
});
