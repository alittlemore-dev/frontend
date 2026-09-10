import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { ApiError } from '../../../../core/models/api-error.model';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { ErrorMessageComponent } from '../../../../shared/ui/error-message/error-message.component';
import { LoadingSpinnerComponent } from '../../../../shared/ui/loading-spinner/loading-spinner.component';
import {
  AdminAction,
  AdminActionsDropdownComponent,
} from '../../components/admin-actions-dropdown/admin-actions-dropdown.component';
import { AdminArticleDetail, AdminArticlePayload } from '../../models/article-workspace.model';
import { ArticleWorkspaceService } from '../../services/article-workspace.service';
import { AdminUnsavedChangesService } from '../../services/admin-unsaved-changes.service';
import { ArticleFormComponent } from '../articles-page/components/article-form/article-form.component';

@Component({
  selector: 'app-admin-article-detail-page',
  standalone: true,
  imports: [
    TranslatePipe,
    LoadingSpinnerComponent,
    ErrorMessageComponent,
    AdminActionsDropdownComponent,
    ArticleFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './article-detail-page.component.html',
})
export class AdminArticleDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly articleWorkspace = inject(ArticleWorkspaceService);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly unsavedChanges = inject(AdminUnsavedChangesService);

  @ViewChild('articleForm') private articleForm: ArticleFormComponent | undefined;

  readonly unsavedChangesScope = this.unsavedChanges.createScope(this.destroyRef);

  readonly article = signal<AdminArticleDetail | null>(null);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly saveError = signal<ApiError | null>(null);

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.loadArticle(articleSlugFromParams(params));
    });
  }

  loadArticle(slug: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.saveError.set(null);
    this.articleWorkspace
      .getArticle(slug, this.currentLanguage())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (article) => {
          this.article.set(article);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err);
          this.loading.set(false);
          this.notifications.error(this.i18n.translate('adminArticlesWorkspace.loadError'));
        },
      });
  }

  retryLoadArticle(): void {
    this.loadArticle(articleSlugFromParams(this.route.snapshot.paramMap));
  }

  dismissSaveError(): void {
    this.saveError.set(null);
  }

  saveArticle(payload: AdminArticlePayload): void {
    const current = this.article();
    if (current === null) return;
    this.saveError.set(null);
    this.articleWorkspace
      .updateArticle(current.slug, payload, this.currentLanguage())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (article) => {
          this.articleForm?.acceptSavedArticle(article);
          this.article.set(article);
          this.notifications.success(this.i18n.translate('articles.notify.saved'));
          if (article.slug !== current.slug) {
            void this.router.navigate(['/admin-panel/articles', article.slug], {
              queryParamsHandling: 'preserve',
              replaceUrl: true,
            });
          }
        },
        error: (err: ApiError) => {
          this.saveError.set(err);
          this.notifications.error(this.i18n.translate('articles.notify.saveError'));
        },
      });
  }

  detailActions(article: AdminArticleDetail): AdminAction[] {
    return [
      article.publishStatus === 'Published'
        ? {
            id: 'unpublish',
            label: this.i18n.translate('shared.unpublish'),
            destructive: false,
            disabled: false,
          }
        : {
            id: 'publish',
            label: this.i18n.translate('shared.publish'),
            destructive: false,
            disabled: false,
          },
      {
        id: 'delete',
        label: this.i18n.translate('shared.delete'),
        destructive: true,
        disabled: false,
      },
    ];
  }

  handleDetailAction(actionId: string, article: AdminArticleDetail): void {
    switch (actionId) {
      case 'publish':
        this.publishArticle(article);
        return;
      case 'unpublish':
        this.unpublishArticle(article);
        return;
      case 'delete':
        this.deleteArticle(article);
        return;
      default:
        throw new Error(`Unsupported article detail action: ${actionId}`);
    }
  }

  publishArticle(article: AdminArticleDetail): void {
    if (!this.unsavedChangesScope.confirmDiscard()) return;
    this.articleWorkspace
      .publishArticle(article.slug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.articleForm?.discardAuxiliaryDrafts();
          this.notifications.success(this.i18n.translate('articles.notify.published'));
          this.loadArticle(article.slug);
        },
        error: () => this.notifications.error(this.i18n.translate('articles.notify.publishError')),
      });
  }

  unpublishArticle(article: AdminArticleDetail): void {
    if (!this.unsavedChangesScope.confirmDiscard()) return;
    this.articleWorkspace
      .unpublishArticle(article.slug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.articleForm?.discardAuxiliaryDrafts();
          this.notifications.success(this.i18n.translate('articles.notify.unpublished'));
          this.loadArticle(article.slug);
        },
        error: () =>
          this.notifications.error(this.i18n.translate('articles.notify.unpublishError')),
      });
  }

  deleteArticle(article: AdminArticleDetail): void {
    if (
      this.document.defaultView?.confirm(
        this.i18n.translate('adminArticlesWorkspace.confirmDelete'),
      ) !== true
    ) {
      return;
    }
    this.articleWorkspace
      .deleteArticle(article.slug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.unsavedChangesScope.commit();
          this.notifications.success(this.i18n.translate('articles.notify.deleted'));
          this.navigateToList();
        },
        error: () => this.notifications.error(this.i18n.translate('articles.notify.deleteError')),
      });
  }

  goBack(): void {
    this.navigateToList();
  }

  private navigateToList(): void {
    void this.router.navigate(['/admin-panel/articles'], {
      queryParamsHandling: 'preserve',
      replaceUrl: true,
    });
  }

  private currentLanguage(): 'ru' | 'en' {
    const language = this.i18n.language();
    if (language === null) {
      throw new Error('I18n language is not initialized');
    }
    return language;
  }
}

function articleSlugFromParams(params: ParamMap): string {
  const slug = params.get('slug');
  if (slug === null) {
    throw new Error('Article slug route parameter is required');
  }
  return slug;
}
