import { TestBed } from '@angular/core/testing';
import { AuthSessionService } from './auth-session.service';

describe('AuthSessionService', () => {
  let service: AuthSessionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthSessionService);
  });

  it('tracks current user and derived auth state', () => {
    service.setCurrentUser({ username: 'admin', role: 'admin' });

    expect(service.currentUser()).toEqual({ username: 'admin', role: 'admin' });
    expect(service.isLoggedIn()).toBe(true);
    expect(service.isAdmin()).toBe(true);
    expect(service.canManageContent()).toBe(true);
    expect(service.canManageTeam()).toBe(true);
  });

  it('allows owners to manage content and team without exact admin access', () => {
    service.setCurrentUser({ username: 'owner', role: 'owner' });

    expect(service.isLoggedIn()).toBe(true);
    expect(service.isAdmin()).toBe(false);
    expect(service.canManageContent()).toBe(true);
    expect(service.canManageTeam()).toBe(true);
  });

  it('allows moderators to manage content without admin access', () => {
    service.setCurrentUser({ username: 'moderator', role: 'moderator' });

    expect(service.isLoggedIn()).toBe(true);
    expect(service.isAdmin()).toBe(false);
    expect(service.canManageContent()).toBe(true);
    expect(service.canManageTeam()).toBe(false);
  });

  it('does not allow regular users to manage content', () => {
    service.setCurrentUser({ username: 'user', role: 'user' });

    expect(service.isLoggedIn()).toBe(true);
    expect(service.isAdmin()).toBe(false);
    expect(service.canManageContent()).toBe(false);
    expect(service.canManageTeam()).toBe(false);
  });

  it('clears current user', () => {
    service.setCurrentUser({ username: 'admin', role: 'admin' });

    service.clear();

    expect(service.currentUser()).toBeNull();
    expect(service.isLoggedIn()).toBe(false);
    expect(service.isAdmin()).toBe(false);
    expect(service.canManageContent()).toBe(false);
    expect(service.canManageTeam()).toBe(false);
  });
});
