import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from './auth.service';
import { I18nService } from '../i18n/i18n.service';
import { currentPublicHomeUrlTree } from '../routing/public-home';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const i18n = inject(I18nService);
  return auth.ensureCurrentUserLoaded().pipe(
    map(() => auth.canManageContent() || currentPublicHomeUrlTree(router, i18n)),
    catchError(() => {
      auth.clearLocalSession();
      return of(currentPublicHomeUrlTree(router, i18n));
    }),
  );
};

export const teamGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const i18n = inject(I18nService);
  return auth.ensureCurrentUserLoaded().pipe(
    map(() => auth.canManageTeam() || router.createUrlTree(['/admin-panel/articles'])),
    catchError(() => {
      auth.clearLocalSession();
      return of(currentPublicHomeUrlTree(router, i18n));
    }),
  );
};

export const ownerGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const i18n = inject(I18nService);
  return auth.ensureCurrentUserLoaded().pipe(
    map(() => auth.isOwner() || router.createUrlTree(['/admin-panel/articles'])),
    catchError(() => {
      auth.clearLocalSession();
      return of(currentPublicHomeUrlTree(router, i18n));
    }),
  );
};

export const adminGuard = teamGuard;
