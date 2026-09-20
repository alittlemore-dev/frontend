import { inject } from '@angular/core';
import { CanActivateFn, CanActivateChildFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from './auth.service';
import { I18nService } from '../i18n/i18n.service';
import { currentPublicHomeUrlTree } from '../routing/public-home';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const i18n = inject(I18nService);
  return auth.ensureCurrentUserLoaded().pipe(
    map(
      () =>
        auth.canManageContent() ||
        (auth.isLoggedIn()
          ? currentPublicHomeUrlTree(router, i18n)
          : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } })),
    ),
    catchError(() => {
      auth.clearLocalSession();
      return of(router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } }));
    }),
  );
};

export const teamGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.ensureCurrentUserLoaded().pipe(
    map(
      () =>
        auth.canManageTeam() ||
        (auth.isLoggedIn()
          ? router.createUrlTree(['/admin-panel/articles'])
          : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } })),
    ),
    catchError(() => {
      auth.clearLocalSession();
      return of(router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } }));
    }),
  );
};

export const ownerGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.ensureCurrentUserLoaded().pipe(
    map(
      () =>
        auth.isOwner() ||
        (auth.isLoggedIn()
          ? router.createUrlTree(['/admin-panel/articles'])
          : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } })),
    ),
    catchError(() => {
      auth.clearLocalSession();
      return of(router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } }));
    }),
  );
};

export const adminGuard = teamGuard;

export const workspaceGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const i18n = inject(I18nService);
  const login = () => router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  return auth.ensureCurrentUserLoaded().pipe(
    map(
      () =>
        auth.isOwner() || (auth.isLoggedIn() ? currentPublicHomeUrlTree(router, i18n) : login()),
    ),
    catchError(() => {
      auth.clearLocalSession();
      return of(login());
    }),
  );
};

export const workspaceChildGuard: CanActivateChildFn = (route, state) =>
  workspaceGuard(route, state);

export const authChildGuard: CanActivateChildFn = (route, state) => authGuard(route, state);

export const accountGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const login = () => router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });

  return auth.ensureCurrentUserLoaded().pipe(
    map(() => auth.isLoggedIn() || login()),
    catchError(() => {
      auth.clearLocalSession();
      return of(login());
    }),
  );
};

export const accountChildGuard: CanActivateChildFn = (route, state) => accountGuard(route, state);
