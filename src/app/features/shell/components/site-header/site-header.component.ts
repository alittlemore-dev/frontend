import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import {
  DrawerComponent,
  DropdownComponent,
  NotificationService,
  ThemeService,
} from '@alittlemore.dev/design-system';
import { finalize } from 'rxjs';
import { AccountAvatarService } from '../../../../core/auth/account-avatar.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { AuthModalService } from '../../../../core/auth/auth-modal.service';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { LanguageCode } from '../../../../core/i18n/i18n.model';
import { localizedPublicHomePath } from '../../../../core/routing/public-home';
import { ServiceIdentityService } from '../../../../core/routing/service-identity.service';
import { UnsavedChangesService } from '../../../../core/unsaved-changes/unsaved-changes.service';

@Component({
  selector: 'app-site-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslatePipe, DrawerComponent, DropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './site-header.component.html',
  styleUrl: './site-header.component.scss',
})
export class SiteHeaderComponent {
  private readonly themeService = inject(ThemeService);
  private readonly authService = inject(AuthService);
  private readonly accountAvatar = inject(AccountAvatarService);
  private readonly authModal = inject(AuthModalService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changes = inject(UnsavedChangesService);
  private readonly notifications = inject(NotificationService);
  private readonly accountMenu = viewChild(DropdownComponent);
  readonly identity = inject(ServiceIdentityService);
  readonly navigation = viewChild(DrawerComponent);
  readonly isNavOpen = signal(false);
  readonly languageMenuOpen = signal(false);
  readonly busy = signal(false);
  readonly restoringSession = this.authService.isRestoringSession;
  readonly homeLink = computed(() => localizedPublicHomePath(this.currentLanguage()));
  readonly matrixLink = computed(() => `/${this.currentLanguage()}/competency/matrix`);
  readonly articlesLink = computed(() => `/${this.currentLanguage()}/competency/articles`);
  readonly toggleLabel = computed(() =>
    this.i18n.translate(
      this.themeService.theme() === 'light' ? 'shell.theme.dark' : 'shell.theme.light',
    ),
  );
  readonly isLoggedIn = computed(() => this.authService.isLoggedIn());
  readonly accountTrigger = computed(() => {
    const account = this.authService.currentUser();
    if (account === null) return { username: '', avatarObjectUrl: null, initials: '' };
    const nameInitials = [account.firstName, account.lastName]
      .filter((part): part is string => typeof part === 'string' && part.trim() !== '')
      .map((part) => Array.from(part.trim())[0])
      .join('');
    return {
      username: account.username,
      avatarObjectUrl: this.accountAvatar.objectUrl(),
      initials: (
        nameInitials || Array.from(account.username).slice(0, 2).join('')
      ).toLocaleUpperCase(),
    };
  });
  readonly canManageContent = computed(() => this.authService.canManageContent());
  readonly canOpenWorkspace = computed(
    () => !this.isLoggedIn() || this.authService.currentUser()?.role === 'owner',
  );
  readonly languageOptions = computed(() =>
    this.i18n.languages().map((language) => ({
      code: language.code,
      label: language.label,
      shortLabel: language.code.toUpperCase(),
      selected: language.code === this.i18n.language(),
    })),
  );

  constructor() {
    effect(() => {
      if (this.authModal.isLoginOpen()) {
        this.navigation()?.close();
        this.accountMenu()?.close();
      }
    });
  }

  toggleNav(): void {
    this.navigation()?.open();
  }
  closeNav(): void {
    this.navigation()?.close();
  }
  toggle(): void {
    this.themeService.toggleTheme();
  }

  accountMenuChanged(open: boolean): void {
    if (!open) this.languageMenuOpen.set(false);
  }

  closeAccountMenu(): void {
    this.accountMenu()?.close();
  }

  openLogin(): void {
    if (this.restoringSession()) return;
    this.accountMenu()?.close();
    this.authService
      .ensureCurrentUserLoaded()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          if (!this.authService.isLoggedIn()) this.authModal.openLogin();
        },
        error: () => this.authModal.openLogin(),
      });
  }

  logout(): void {
    if (this.busy() || !this.changes.confirmDiscard()) return;
    this.busy.set(true);
    this.accountMenu()?.close();
    this.authService
      .logout()
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.finishLogout(),
        error: () => {
          this.notifications.error(this.i18n.translate('shell.auth.logoutFailed'));
          this.finishLogout();
        },
      });
  }

  switchLanguage(language: LanguageCode): void {
    const nextUrl = rewriteLanguagePrefixedUrl(this.router.url, language);
    this.i18n
      .switchLanguage(language)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          if (nextUrl !== this.router.url) void this.router.navigateByUrl(nextUrl);
        },
        error: () => this.notifications.error(this.i18n.translate('shell.language.failed')),
      });
  }

  private finishLogout(): void {
    this.changes.discardChanges();
    if (this.identity.service() === 'workspace' || this.identity.service() === 'admin') {
      void this.router.navigateByUrl(this.homeLink());
    }
  }

  private currentLanguage(): LanguageCode {
    const language = this.i18n.language();
    if (language === null) throw new Error('I18n language is not initialized');
    return language;
  }
}

export function rewriteLanguagePrefixedUrl(currentUrl: string, language: LanguageCode): string {
  const url = new URL(currentUrl, 'http://localhost');
  const segments = url.pathname.split('/').filter((segment) => segment.length > 0);
  if (segments[0] === 'ru' || segments[0] === 'en') segments[0] = language;
  else if (isPublicRouteSegment(segments[0])) segments.unshift(language);
  else return currentUrl;
  return `/${segments.join('/')}${url.search}${url.hash}`;
}

function isPublicRouteSegment(segment: string | undefined): boolean {
  return (
    segment === undefined ||
    [
      'competency',
      'competency-matrix',
      'how-this-site-is-built',
      'articles',
      'updates',
      'sitemap',
    ].includes(segment)
  );
}
