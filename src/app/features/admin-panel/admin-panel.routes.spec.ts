import { ownerGuard, teamGuard } from '../../core/auth/auth.guard';
import { adminUnsavedChangesGuard } from './guards/admin-unsaved-changes.guard';
import { adminPanelRoutes } from './admin-panel.routes';

describe('adminPanelRoutes', () => {
  it('opens the standalone role-aware dashboard from the admin-panel root', () => {
    const children = adminPanelRoutes[0].children ?? [];
    const rootRoute = children.find((route) => route.path === '');
    const dashboardRoute = children.find((route) => route.path === 'dashboard');

    expect(rootRoute?.redirectTo).toBe('dashboard');
    expect(dashboardRoute).toBeDefined();
    expect(dashboardRoute?.canActivate).toBeUndefined();
  });

  it('keeps team-managed workspace routes behind the team guard', () => {
    const children = adminPanelRoutes[0].children ?? [];
    const teamWorkspaceRoutes = children.filter((route) =>
      route.path?.startsWith('workspace/team'),
    );
    const guardedPaths = new Set(teamWorkspaceRoutes.map((route) => route.path));

    expect(guardedPaths).toEqual(new Set(['workspace/team', 'workspace/team/:username']));
    for (const route of teamWorkspaceRoutes) {
      expect(route.canActivate).toEqual([teamGuard]);
    }
  });

  it('registers the article tag workspace with unsaved-change protection', () => {
    const tagRoute = (adminPanelRoutes[0].children ?? []).find(
      (route) => route.path === 'article-tags',
    );

    expect(tagRoute).toBeDefined();
    expect(tagRoute?.canDeactivate).toEqual([adminUnsavedChangesGuard]);
  });

  it('keeps agent client management behind the owner guard', () => {
    const route = (adminPanelRoutes[0].children ?? []).find(
      (child) => child.path === 'workspace/agent-clients',
    );

    expect(route).toBeDefined();
    expect(route?.canActivate).toEqual([ownerGuard]);
    expect(route?.canDeactivate).toEqual([adminUnsavedChangesGuard]);
  });

  it('redirects the legacy operational tools route to the standalone dashboard', () => {
    const route = (adminPanelRoutes[0].children ?? []).find(
      (child) => child.path === 'workspace/tools',
    );

    expect(route).toBeDefined();
    expect(route?.redirectTo).toBe('/admin-panel/dashboard');
    expect(route?.pathMatch).toBe('full');
    expect(route?.loadComponent).toBeUndefined();
  });

  it('does not register knowledge or resume workspace routes', () => {
    const hiddenFeatureRoutes = (adminPanelRoutes[0].children ?? []).filter(
      (child) =>
        child.path?.startsWith('knowledge/') || child.path?.startsWith('workspace/resumes'),
    );

    expect(hiddenFeatureRoutes).toEqual([]);
  });
});
