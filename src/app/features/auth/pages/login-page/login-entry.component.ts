import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthModalService, safeReturnUrl } from '../../../../core/auth/auth-modal.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { currentPublicHomeUrlTree } from '../../../../core/routing/public-home';

@Component({
  selector: 'app-login-entry',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
export class LoginEntryComponent implements OnInit, OnDestroy {
  private readonly authModal = inject(AuthModalService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly i18n = inject(I18nService);

  ngOnInit(): void {
    const returnUrl = safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
    if (this.auth.isLoggedIn()) {
      void this.router.navigateByUrl(returnUrl ?? currentPublicHomeUrlTree(this.router, this.i18n));
    } else {
      this.authModal.openLogin({ returnUrl: returnUrl ?? undefined });
    }
  }

  ngOnDestroy(): void {
    this.authModal.closeLogin();
  }
}
