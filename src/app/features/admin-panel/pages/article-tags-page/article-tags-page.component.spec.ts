import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { ArticleTag } from '../../models/article-workspace.model';
import { ArticleWorkspaceService } from '../../services/article-workspace.service';
import { ArticleTagsPageComponent } from './article-tags-page.component';

const PYTHON_TAG_ID = '00000000000000000000000000000001';
const DJANGO_TAG_ID = '00000000000000000000000000000002';

describe('ArticleTagsPageComponent', () => {
  let fixture: ComponentFixture<ArticleTagsPageComponent>;
  let articlesService: {
    getTags: jest.Mock;
    createTag: jest.Mock;
    updateTag: jest.Mock;
    deleteTag: jest.Mock;
  };
  let notifications: { success: jest.Mock; error: jest.Mock };
  let routeQueryParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let router: Router;

  beforeEach(async () => {
    articlesService = {
      getTags: jest.fn().mockReturnValue(of(allTags())),
      createTag: jest
        .fn()
        .mockReturnValue(
          of(tag('00000000000000000000000000000003', 'Бэкенд', 'Backend', 'backend')),
        ),
      updateTag: jest
        .fn()
        .mockReturnValue(of(tag(PYTHON_TAG_ID, 'Питон 3', 'Python 3', 'python-3'))),
      deleteTag: jest.fn().mockReturnValue(of(undefined)),
    };
    notifications = { success: jest.fn(), error: jest.fn() };
    routeQueryParams = new BehaviorSubject(convertToParamMap({}));

    await TestBed.configureTestingModule({
      imports: [ArticleTagsPageComponent],
      providers: [
        provideRouter([]),
        { provide: ArticleWorkspaceService, useValue: articlesService },
        { provide: NotificationService, useValue: notifications },
        provideI18nTesting(),
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: routeQueryParams.asObservable() },
        },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  it('renders tags without status or deleted-tag controls', () => {
    render();

    expect(articlesService.getTags).toHaveBeenCalledWith('ru');
    expect(text()).toContain('Питон');
    expect(text()).toContain('Python');
    expect(text()).toContain('Джанго');
    expect(text()).toContain('Django');
    expect(fixture.nativeElement.querySelector('[data-testid="article-tags-status"]')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="article-tags-include-deleted"]'),
    ).toBeNull();
    expect(text()).not.toContain('Активен');
    expect(text()).not.toContain('Удалён');
  });

  it('restores search from the URL and debounces URL updates', fakeAsync(() => {
    routeQueryParams.next(convertToParamMap({ q: 'django' }));
    render();

    expect(text()).not.toContain('Питон');
    expect(text()).toContain('Джанго');
    jest.mocked(router.navigate).mockClear();

    fixture.componentInstance.setSearchQuery('python');
    tick(249);
    expect(router.navigate).not.toHaveBeenCalled();
    tick(1);

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { q: 'python' },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      }),
    );
  }));

  it('renders loading, error, and empty states', () => {
    const tags$ = new Subject<ArticleTag[]>();
    articlesService.getTags.mockReturnValue(tags$);
    render();
    expect(fixture.nativeElement.querySelector('app-loading-spinner')).not.toBeNull();

    tags$.error({ code: 'load', type: 'error', message: 'Nope', location: null, attr: null });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-error-message')).not.toBeNull();

    articlesService.getTags.mockReturnValue(of([]));
    fixture.componentInstance.loadTags();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-empty-state')).not.toBeNull();
  });

  it('filters locally by both names and slug', () => {
    render();

    setInput('[data-testid="article-tags-search"]', 'python');
    expect(rows()).toHaveLength(1);
    expect(text()).toContain('Питон');

    setInput('[data-testid="article-tags-search"]', 'django');
    expect(rows()).toHaveLength(1);
    expect(text()).toContain('Джанго');
  });

  it('creates a tag in the modal and suggests slug from the English name', () => {
    render();

    click('[data-testid="article-tags-create"]');
    setInput('[data-testid="article-tag-form-name-ru"]', ' Бэкенд ');
    setInput('[data-testid="article-tag-form-name-en"]', 'Backend Platform');

    expect(inputValue('[data-testid="article-tag-form-slug"]')).toBe('backend-platform');

    submit('[data-testid="article-tag-form"]');
    fixture.detectChanges();

    expect(articlesService.createTag).toHaveBeenCalledWith(
      {
        slug: 'backend-platform',
        translations: { ru: { name: 'Бэкенд' }, en: { name: 'Backend Platform' } },
      },
      'ru',
    );
    expect(notifications.success).toHaveBeenCalledWith('Тег создан.');
    expect(fixture.nativeElement.querySelector('[data-testid="article-tag-dialog"]')).toBeNull();
  });

  it('edits a tag without regenerating its slug from the English name', () => {
    render();

    fixture.componentInstance.openEdit(allTags()[0]);
    fixture.detectChanges();
    setInput('[data-testid="article-tag-form-name-en"]', 'Python 3');

    expect(inputValue('[data-testid="article-tag-form-slug"]')).toBe('python');

    setInput('[data-testid="article-tag-form-slug"]', 'python-3');
    submit('[data-testid="article-tag-form"]');
    fixture.detectChanges();

    expect(articlesService.updateTag).toHaveBeenCalledWith(
      PYTHON_TAG_ID,
      {
        slug: 'python-3',
        translations: { ru: { name: 'Питон' }, en: { name: 'Python 3' } },
      },
      'ru',
    );
    expect(notifications.success).toHaveBeenCalledWith('Тег сохранён.');
  });

  it('blocks empty and duplicate-slug submissions with visible feedback', () => {
    render();

    click('[data-testid="article-tags-create"]');
    submit('[data-testid="article-tag-form"]');
    fixture.detectChanges();

    expect(articlesService.createTag).not.toHaveBeenCalled();
    expect(text()).toContain('Заполните поле.');
    expect(notifications.error).toHaveBeenCalledWith('Проверьте поля тега.');

    setInput('[data-testid="article-tag-form-name-ru"]', 'Дубликат');
    setInput('[data-testid="article-tag-form-name-en"]', 'Duplicate');
    setInput('[data-testid="article-tag-form-slug"]', 'django');
    submit('[data-testid="article-tag-form"]');
    fixture.detectChanges();

    expect(articlesService.createTag).not.toHaveBeenCalled();
    expect(text()).toContain('Тег с таким slug уже существует.');
  });

  it('confirms permanent deletion', () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
    render();

    fixture.componentInstance.deleteTag(allTags()[0]);

    expect(confirm).toHaveBeenCalledWith(
      'Удалить тег навсегда? Он будет убран из всех статей. Это действие нельзя отменить.',
    );
    expect(articlesService.deleteTag).toHaveBeenCalledWith(PYTHON_TAG_ID);
    expect(notifications.success).toHaveBeenCalledWith('Тег удалён.');
  });

  it('keeps a changed modal open when discard is rejected and keeps server errors inline', () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    articlesService.createTag.mockReturnValue(
      throwError(() => ({
        code: 'save',
        type: 'error',
        message: 'Nope',
        location: null,
        attr: null,
      })),
    );
    render();

    click('[data-testid="article-tags-create"]');
    setInput('[data-testid="article-tag-form-name-ru"]', 'Бэкенд');
    fixture.componentInstance.closeDialog();
    fixture.detectChanges();

    expect(confirm).toHaveBeenCalled();
    expect(
      fixture.nativeElement.querySelector('[data-testid="article-tag-dialog"]'),
    ).not.toBeNull();

    setInput('[data-testid="article-tag-form-name-en"]', 'Backend');
    setInput('[data-testid="article-tag-form-slug"]', 'backend');
    submit('[data-testid="article-tag-form"]');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-error-message')).not.toBeNull();
    expect(notifications.error).toHaveBeenCalledWith('Не удалось создать тег.');
  });

  function render(): void {
    fixture = TestBed.createComponent(ArticleTagsPageComponent);
    fixture.detectChanges();
  }

  function text(): string {
    return fixture.nativeElement.textContent as string;
  }

  function rows(): HTMLElement[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll<HTMLElement>('[data-testid="article-tag-row"]'),
    );
  }

  function click(selector: string): void {
    const button = fixture.nativeElement.querySelector(selector) as HTMLButtonElement | null;
    expect(button).not.toBeNull();
    button?.click();
    fixture.detectChanges();
  }

  function submit(selector: string): void {
    const form = fixture.nativeElement.querySelector(selector) as HTMLFormElement | null;
    expect(form).not.toBeNull();
    form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }

  function setInput(selector: string, value: string): void {
    const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement | null;
    expect(input).not.toBeNull();
    if (input === null) return;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function inputValue(selector: string): string {
    return (fixture.nativeElement.querySelector(selector) as HTMLInputElement).value;
  }
});

function allTags(): ArticleTag[] {
  return [
    tag(PYTHON_TAG_ID, 'Питон', 'Python', 'python'),
    tag(DJANGO_TAG_ID, 'Джанго', 'Django', 'django'),
  ];
}

function tag(id: string, nameRu: string, nameEn: string, slug: string): ArticleTag {
  return {
    id,
    name: nameRu,
    slug,
    translations: { ru: { name: nameRu }, en: { name: nameEn } },
  };
}
