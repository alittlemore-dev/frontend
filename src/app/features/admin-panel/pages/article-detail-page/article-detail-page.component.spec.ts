import { Component, input, output, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { AdminArticleDetail, AdminArticlePayload } from '../../models/article-workspace.model';
import { ArticleWorkspaceService } from '../../services/article-workspace.service';
import { ArticleFormComponent } from '../articles-page/components/article-form/article-form.component';
import { AdminArticleDetailPageComponent } from './article-detail-page.component';
import { AdminUnsavedChangesScope } from '../../services/admin-unsaved-changes.service';

describe('AdminArticleDetailPageComponent', () => {
  let fixture: ComponentFixture<AdminArticleDetailPageComponent>;
  let routeParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let service: {
    getArticle: jest.Mock;
    updateArticle: jest.Mock;
    publishArticle: jest.Mock;
    unpublishArticle: jest.Mock;
    deleteArticle: jest.Mock;
  };
  let router: Router;
  let notifications: { success: jest.Mock; error: jest.Mock };

  beforeEach(async () => {
    routeParams = new BehaviorSubject(convertToParamMap({ slug: 'typed-articles' }));
    service = {
      getArticle: jest.fn().mockReturnValue(of(articleDetail('typed-articles', 'Published'))),
      updateArticle: jest.fn().mockReturnValue(of(articleDetail('renamed-article', 'Draft'))),
      publishArticle: jest.fn().mockReturnValue(of(undefined)),
      unpublishArticle: jest.fn().mockReturnValue(of(undefined)),
      deleteArticle: jest.fn().mockReturnValue(of(undefined)),
    };
    notifications = { success: jest.fn(), error: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [AdminArticleDetailPageComponent],
      providers: [
        provideRouter([]),
        provideI18nTesting(),
        { provide: ArticleWorkspaceService, useValue: service },
        { provide: NotificationService, useValue: notifications },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: routeParams.asObservable(),
          },
        },
      ],
    })
      .overrideComponent(AdminArticleDetailPageComponent, {
        remove: { imports: [ArticleFormComponent] },
        add: { imports: [ArticleFormStubComponent] },
      })
      .compileComponents();

    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    jest.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(AdminArticleDetailPageComponent);
    fixture.detectChanges();
  });

  it('loads the article detail and renders the duplicated actions dropdown', () => {
    expect(service.getArticle).toHaveBeenCalledWith('typed-articles', 'ru');
    expect(fixture.nativeElement.textContent).toContain('Typed articles');
    expect(
      fixture.nativeElement.querySelector('[data-testid="article-detail-actions-toggle"]'),
    ).not.toBeNull();
  });

  it('saves the article and replaces the route when the slug changes', () => {
    const form = fixture.debugElement.query(By.directive(ArticleFormStubComponent))
      ?.componentInstance as ArticleFormStubComponent | undefined;
    expect(form).toBeDefined();

    form?.articleSave.emit(articlePayload('renamed-article'));

    expect(service.updateArticle).toHaveBeenCalledWith(
      'typed-articles',
      articlePayload('renamed-article'),
      'ru',
    );
    expect(router.navigate).toHaveBeenCalledWith(['/admin-panel/articles', 'renamed-article'], {
      queryParamsHandling: 'preserve',
      replaceUrl: true,
    });
    expect(form?.acceptedArticle()?.slug).toBe('renamed-article');
  });

  it('unpublishes, confirms deletes, and returns to the article list', () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    const form = fixture.debugElement.query(By.directive(ArticleFormStubComponent))
      ?.componentInstance as ArticleFormStubComponent | undefined;

    openDetailActions();
    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="article-detail-actions-unpublish"]')
      ?.click();
    openDetailActions();
    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="article-detail-actions-delete"]')
      ?.click();

    expect(service.unpublishArticle).toHaveBeenCalledWith('typed-articles');
    expect(form?.discardAuxiliaryDrafts).toHaveBeenCalled();
    expect(window.confirm).toHaveBeenCalled();
    expect(service.deleteArticle).toHaveBeenCalledWith('typed-articles');
    expect(router.navigate).toHaveBeenCalledWith(['/admin-panel/articles'], {
      queryParamsHandling: 'preserve',
      replaceUrl: true,
    });
  });

  it('reloads when the route slug changes without recreating the component', () => {
    routeParams.next(convertToParamMap({ slug: 'another-article' }));

    expect(service.getArticle).toHaveBeenLastCalledWith('another-article', 'ru');
  });

  function openDetailActions(): void {
    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="article-detail-actions-toggle"]')
      ?.click();
    fixture.detectChanges();
  }
});

@Component({
  selector: 'app-admin-article-form',
  standalone: true,
  template: '',
})
class ArticleFormStubComponent {
  readonly article = input<AdminArticleDetail | null>(null);
  readonly unsavedChangesScope = input.required<AdminUnsavedChangesScope>();
  readonly articleSave = output<AdminArticlePayload>();
  readonly formCancel = output<void>();
  readonly acceptedArticle = signal<AdminArticleDetail | null>(null);
  readonly discardAuxiliaryDrafts = jest.fn();

  acceptSavedArticle(article: AdminArticleDetail): void {
    this.acceptedArticle.set(article);
  }
}

function articleDetail(slug: string, publishStatus: 'Draft' | 'Published'): AdminArticleDetail {
  return {
    id: '00000000000000000000000000000001',
    title: 'Typed articles',
    slug,
    folder: 'Engineering',
    folderId: 'folder-1',
    folderKey: 'engineering',
    authorUsername: 'admin',
    publishedAt: publishStatus === 'Published' ? '2026-01-02T03:04:05+00:00' : null,
    publishStatus,
    updatedAt: '2026-01-03T03:04:05+00:00',
    excerpt: 'Excerpt',
    metadata: {
      seoTitleRu: null,
      seoTitleEn: null,
      seoDescriptionRu: null,
      seoDescriptionEn: null,
      coverImageFileId: null,
      coverImageUrl: null,
      coverImageAltRu: null,
      coverImageAltEn: null,
    },
    viewCount: 7,
    tags: [],
    content: '# Content',
    createdAt: '2026-01-01T03:04:05+00:00',
    reactionCounts: { heart: 1, fire: 0, thinking: 0, neutral: 0, poop: 0 },
    translations: {
      ru: { title: 'Typed articles', content: '# Content' },
      en: { title: 'Typed articles', content: '# Content' },
    },
  };
}

function articlePayload(slug: string): AdminArticlePayload {
  return {
    slug,
    folderId: 'folder-1',
    publishStatus: 'Draft',
    tagIds: [],
    metadata: {
      seoTitleRu: null,
      seoTitleEn: null,
      seoDescriptionRu: null,
      seoDescriptionEn: null,
      coverImageFileId: null,
      coverImageAltRu: null,
      coverImageAltEn: null,
    },
    translations: {
      ru: { title: 'Typed articles', content: '# Content' },
      en: { title: 'Typed articles', content: '# Content' },
    },
  };
}
