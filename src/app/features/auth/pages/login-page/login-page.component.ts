import { Router } from '@angular/router';
import { currentPublicHomeUrlTree } from '../../../../core/routing/public-home';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../../core/auth/auth.service';
import { AuthModalService } from '../../../../core/auth/auth-modal.service';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { UnsavedChangesService } from '../../../../core/unsaved-changes/unsaved-changes.service';
import {
  ModalDialogDirective,
  ModalScrollDirective,
  NotificationService,
} from '@alittlemore.dev/design-system';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, ModalScrollDirective, ModalDialogDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss',
})
export class LoginPageComponent {
  private readonly authService = inject(AuthService);
  readonly authModal = inject(AuthModalService);
  private readonly router = inject(Router);
  private readonly unsavedChanges = inject(UnsavedChangesService);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = viewChild(ModalDialogDirective);

  readonly form = new FormGroup({
    username: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
  });

  readonly submitting = signal(false);
  readonly loginError = signal<string | null>(null);

  constructor() {
    afterNextRender({ write: () => this.dialog()?.open() });
  }

  login(): void {
    if (this.form.invalid || this.submitting()) {
      return;
    }

    const { username, password } = this.form.getRawValue();
    this.submitting.set(true);
    this.loginError.set(null);

    this.authService
      .login(username, password)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          if (this.authModal.requiresPrivateStateReset(this.authService.currentUser())) {
            this.leavePreviousAccount();
            return;
          }
          this.submitting.set(false);
          const returnUrl = this.authModal.completeLogin();
          if (returnUrl) void this.router.navigateByUrl(returnUrl);
          else this.leaveLoginRoute();
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          const message =
            err !== null && typeof err === 'object' && 'message' in err
              ? String((err as { message: unknown }).message) ||
                this.i18n.translate('auth.login.error')
              : this.i18n.translate('auth.login.error');
          this.loginError.set(message);
        },
      });
  }

  close(): void {
    this.authModal.closeLogin();
    if (!this.authModal.isLoginOpen()) this.leaveLoginRoute();
  }

  private leavePreviousAccount(): void {
    this.unsavedChanges.discardChanges();
    void this.router
      .navigateByUrl(currentPublicHomeUrlTree(this.router, this.i18n))
      .then((navigated) => {
        this.submitting.set(false);
        if (navigated) {
          this.authModal.completeLogin();
          this.notifications.success(this.i18n.translate('auth.login.identityChanged'));
        } else {
          this.loginError.set(this.i18n.translate('auth.login.error'));
        }
      })
      .catch(() => {
        this.submitting.set(false);
        this.loginError.set(this.i18n.translate('auth.login.error'));
      });
  }

  private leaveLoginRoute(): void {
    if (this.router.url.split(/[?#]/)[0] === '/login') {
      void this.router.navigateByUrl(currentPublicHomeUrlTree(this.router, this.i18n));
    }
  }
}
