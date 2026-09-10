import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeService } from '../../../../core/layout/theme.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { AuthModalService } from '../../../../core/auth/auth-modal.service';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { LanguageCode } from '../../../../core/i18n/i18n.model';
import { localizedPublicHomePath } from '../../../../core/routing/public-home';

interface LanguageOption {
  code: LanguageCode;
  label: string;
  shortLabel: string;
  selected: boolean;
}

@Component({
  selector: 'app-site-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './site-header.component.html',
})
export class SiteHeaderComponent {
  private readonly themeService = inject(ThemeService);
  private readonly authService = inject(AuthService);
  private readonly authModal = inject(AuthModalService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly isNavOpen = signal(false);
  readonly restoringSession = this.authService.isRestoringSession;
  readonly homeLink = computed(() => localizedPublicHomePath(this.currentLanguage()));
  readonly matrixLink = computed(() => `/${this.currentLanguage()}/competency-matrix`);
  readonly articlesLink = computed(() => `/${this.currentLanguage()}/articles`);
  readonly adminPanelLink = computed(() => '/admin-panel');
  readonly toggleLabel = computed(() =>
    this.i18n.translate(
      this.themeService.theme() === 'light' ? 'shell.theme.dark' : 'shell.theme.light',
    ),
  );
  readonly isLoggedIn = computed(() => this.authService.isLoggedIn());
  readonly canManageContent = computed(() => this.authService.canManageContent());
  readonly username = computed(() => this.authService.currentUser()?.username ?? null);
  readonly languageOptions = computed<LanguageOption[]>(() => {
    const currentLanguage = this.i18n.language();
    return this.i18n.languages().map((language) => ({
      code: language.code,
      label: language.label,
      shortLabel: language.code.toUpperCase(),
      selected: language.code === currentLanguage,
    }));
  });

  toggleNav(): void {
    this.isNavOpen.update((v) => !v);
  }

  closeNav(): void {
    this.isNavOpen.set(false);
  }

  toggle(): void {
    this.themeService.toggleTheme();
  }

  openLogin(): void {
    if (this.restoringSession()) return;
    this.authService
      .ensureCurrentUserLoaded()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          if (!this.authService.isLoggedIn()) {
            this.authModal.openLogin();
          }
        },
        error: () => this.authModal.openLogin(),
      });
  }

  logout(): void {
    this.authService.logout().subscribe({
      error: () => {
        // Force local logout even if server endpoint fails
        this.authService.clearLocalSession();
      },
    });
  }

  switchLanguage(language: LanguageCode): void {
    const nextUrl = rewriteLanguagePrefixedUrl(this.router.url, language);
    this.i18n.switchLanguage(language).subscribe({
      next: () => this.router.navigateByUrl(nextUrl),
    });
  }

  private currentLanguage(): LanguageCode {
    const language = this.i18n.language();
    if (language === null) {
      throw new Error('I18n language is not initialized');
    }
    return language;
  }
}

export function rewriteLanguagePrefixedUrl(currentUrl: string, language: LanguageCode): string {
  const url = new URL(currentUrl, 'http://localhost');
  const segments = url.pathname.split('/').filter((segment) => segment.length > 0);

  if (segments[0] === 'ru' || segments[0] === 'en') {
    segments[0] = language;
  } else if (isPublicRouteSegment(segments[0])) {
    segments.unshift(language);
  } else {
    return currentUrl;
  }

  return `/${segments.join('/')}${url.search}${url.hash}`;
}

function isPublicRouteSegment(segment: string | undefined): boolean {
  return (
    segment === undefined ||
    segment === 'competency-matrix' ||
    segment === 'how-this-site-is-built' ||
    segment === 'articles' ||
    segment === 'updates' ||
    segment === 'sitemap'
  );
}
