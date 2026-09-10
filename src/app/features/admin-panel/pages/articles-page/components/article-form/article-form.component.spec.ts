import { Component, input, output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { MarkdownEditorComponent } from '../../../../../../core/editor/markdown-editor.component';
import { I18nService } from '../../../../../../core/i18n/i18n.service';
import { WikiLinkTargetsService } from '../../../../../../core/wiki-links/wiki-link-targets.service';
import {
  MediaUploadService,
  UploadedMediaFile,
} from '../../../../../../core/uploads/media-upload.service';
import { provideI18nTesting } from '../../../../../../testing/i18n-testing';
import { chooseSiteSelectOption } from '../../../../../../testing/site-select-testing';
import { ArticleWorkspaceService } from '../../../../services/article-workspace.service';
import { ArticleDetail, ArticleTag } from '../../../../models/article-workspace.model';
import { AdminUnsavedChangesScope } from '../../../../services/admin-unsaved-changes.service';
import { ArticleFormComponent } from './article-form.component';

const INVALID_SHORT_TEXT = 'x'.repeat(256);
const INVALID_SEO_DESCRIPTION = 'x'.repeat(321);
const INVALID_ARTICLE_CONTENT = 'x'.repeat(100_001);
const PYTHON_TAG_ID = '00000000000000000000000000000001';
const BACKEND_TAG_ID = '00000000000000000000000000000003';

interface ArticleValidationCase {
  description: string;
  selector: string;
  expectedMessage: string;
  setInvalidValue: () => void;
  invalidClass?: string;
}

describe('ArticleFormComponent', () => {
  let fixture: ComponentFixture<ArticleFormComponent>;
  let articlesService: {
    getFolders: jest.Mock;
    createFolder: jest.Mock;
    updateFolderPriorities: jest.Mock;
    searchTags: jest.Mock;
  };
  let mediaUpload: { uploadMediaFile: jest.Mock; getMediaFile: jest.Mock };
  let wikiLinkTargetsService: { getTargets: jest.Mock };
  let unsavedChangesScope: AdminUnsavedChangesScope;
  let confirmDiscard: jest.Mock<boolean, []>;

  beforeEach(async () => {
    mediaUpload = {
      getMediaFile: jest.fn().mockReturnValue(
        of({
          id: 'cover-file-id',
          purpose: 'articleCoverImage',
          namespace: 'media',
          relativePath: 'article-cover-images/cover.png',
          mimeType: 'image/png',
          sizeBytes: 5,
          name: 'cover.png',
          originalName: 'cover.png',
          createdAt: '2026-07-03T10:00:00+00:00',
          updatedAt: '2026-07-03T10:00:00+00:00',
          accessUrl: 'https://cdn.example.com/cover.jpg',
          markdownUrl: 'https://cdn.example.com/cover.jpg#fileId=cover-file-id',
        }),
      ),
      uploadMediaFile: jest.fn().mockReturnValue(
        of({
          id: 'cover-file-id',
          purpose: 'articleCoverImage',
          namespace: 'media',
          relativePath: 'article-cover-images/cover.png',
          mimeType: 'image/png',
          sizeBytes: 5,
          name: 'cover.png',
          originalName: 'cover.png',
          createdAt: '2026-07-03T10:00:00+00:00',
          updatedAt: '2026-07-03T10:00:00+00:00',
          accessUrl: 'https://cdn.example.com/cover.jpg',
          markdownUrl: 'https://cdn.example.com/cover.jpg#fileId=cover-file-id',
        }),
      ),
    };
    wikiLinkTargetsService = {
      getTargets: jest.fn().mockReturnValue(
        of({
          groups: [],
          lookup: new Map([
            ['articles', new Set(['typed-article'])],
            ['matrix', new Set(['known-question'])],
          ]),
        }),
      ),
    };
    articlesService = {
      getFolders: jest.fn().mockReturnValue(
        of([
          {
            id: 'folder-1',
            key: 'engineering',
            name: 'Инженерия',
            priority: 1,
            translations: {
              ru: { name: 'Инженерия' },
              en: { name: 'Engineering' },
            },
          },
        ]),
      ),
      createFolder: jest.fn().mockReturnValue(
        of({
          id: 'folder-2',
          key: 'architecture',
          name: 'Архитектура',
          priority: 2,
          translations: {
            ru: { name: 'Архитектура' },
            en: { name: 'Architecture' },
          },
        }),
      ),
      updateFolderPriorities: jest.fn().mockReturnValue(of(undefined)),
      searchTags: jest
        .fn()
        .mockReturnValue(
          of([
            tag({ id: PYTHON_TAG_ID, nameRu: 'Питон', nameEn: 'Python', slug: 'python' }),
            tag({ id: BACKEND_TAG_ID, nameRu: 'Бэкенд', nameEn: 'Backend', slug: 'backend' }),
          ]),
        ),
    };

    await TestBed.configureTestingModule({
      imports: [ArticleFormComponent],
      providers: [
        provideRouter([]),
        { provide: ArticleWorkspaceService, useValue: articlesService },
        { provide: MediaUploadService, useValue: mediaUpload },
        { provide: WikiLinkTargetsService, useValue: wikiLinkTargetsService },
        provideI18nTesting(),
      ],
    })
      .overrideComponent(ArticleFormComponent, {
        remove: { imports: [MarkdownEditorComponent] },
        add: { imports: [MarkdownEditorStubComponent] },
      })
      .compileComponents();

    createFixture();
  });

  it('tracks authoring values against the loaded baseline and becomes clean after a full revert', () => {
    expect(unsavedChangesScope.hasChanges()).toBe(false);

    setInput('#articleTitleRu', 'Черновик');
    expect(unsavedChangesScope.hasChanges()).toBe(true);

    setInput('#articleTitleRu', '');
    expect(unsavedChangesScope.hasChanges()).toBe(false);
  });

  it('starts in edit mode and does not treat view or preview-language changes as authored data', () => {
    expect(viewModeButton('edit').getAttribute('aria-pressed')).toBe('true');
    expect(viewModeButton('preview').getAttribute('aria-pressed')).toBe('false');
    expect(editForm().hidden).toBe(false);
    expect(previewSection().hidden).toBe(true);
    expect(unsavedChangesScope.hasChanges()).toBe(false);

    clickViewMode('preview');

    expect(viewModeButton('edit').getAttribute('aria-pressed')).toBe('false');
    expect(viewModeButton('preview').getAttribute('aria-pressed')).toBe('true');
    expect(editForm().hidden).toBe(true);
    expect(previewSection().hidden).toBe(false);

    previewLanguageButton('en').click();
    fixture.detectChanges();
    clickViewMode('edit');

    expect(previewLanguageButton('en').textContent?.trim()).toBe('EN');
    expect(editLanguageButton('ru').classList).toContain('active');
    expect(unsavedChangesScope.hasChanges()).toBe(false);
  });

  it('suggests slug from title until slug is edited manually', () => {
    const title = fixture.debugElement.query(By.css('#articleTitleEn'))
      .nativeElement as HTMLInputElement;
    const slug = fixture.debugElement.query(By.css('#articleSlug'))
      .nativeElement as HTMLInputElement;

    title.value = 'New Angular article';
    title.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(slug.value).toBe('new-angular-article');

    slug.value = 'manual-slug';
    slug.dispatchEvent(new Event('input'));
    title.value = 'Another title';
    title.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(slug.value).toBe('manual-slug');
  });

  it('refreshes form values when a different article input is loaded', () => {
    fixture.componentRef.setInput('article', articleDetail('first-article', 'First article'));
    fixture.detectChanges();

    expect(elementValue('#articleSlug')).toBe('first-article');
    expect(elementValue('#articleTitleEn')).toBe('First article');

    fixture.componentRef.setInput('article', articleDetail('second-article', 'Second article'));
    fixture.detectChanges();

    expect(elementValue('#articleSlug')).toBe('second-article');
    expect(elementValue('#articleTitleEn')).toBe('Second article');
  });

  it('renders the cover file picker surface in the active application language', () => {
    TestBed.inject(I18nService).switchLanguage('en').subscribe();
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      '[data-testid="article-cover-file-button"]',
    ) as HTMLButtonElement | null;
    const status = fixture.nativeElement.querySelector(
      '[data-testid="article-cover-file-status"]',
    ) as HTMLElement | null;
    const input = fixture.nativeElement.querySelector('#articleCoverImageFile') as HTMLInputElement;

    expect(button?.textContent?.trim()).toBe('Choose file');
    expect(status?.textContent?.trim()).toBe('No file selected');
    expect(input.hidden).toBe(true);
  });

  it('opens the native cover file picker from the localized button', () => {
    const input = fixture.nativeElement.querySelector('#articleCoverImageFile') as HTMLInputElement;
    const inputClick = jest.spyOn(input, 'click');
    const button = fixture.nativeElement.querySelector(
      '[data-testid="article-cover-file-button"]',
    ) as HTMLButtonElement;

    button.click();

    expect(inputClick).toHaveBeenCalledTimes(1);
  });

  it('passes content language and localized labels to both Markdown editors', () => {
    const editors = fixture.debugElement
      .queryAll(By.directive(MarkdownEditorStubComponent))
      .map((debugElement) => debugElement.componentInstance as MarkdownEditorStubComponent);

    expect(editors.map((editor) => editor.language())).toEqual(['ru', 'en']);
    expect(editors.map((editor) => editor.accessibleLabel())).toEqual([
      'Содержимое RU',
      'Содержимое EN',
    ]);
  });

  it('emits payload with selected tags', () => {
    const titleRu = fixture.debugElement.query(By.css('#articleTitleRu'))
      .nativeElement as HTMLInputElement;
    const titleEn = fixture.debugElement.query(By.css('#articleTitleEn'))
      .nativeElement as HTMLInputElement;
    const contentEditors = fixture.debugElement.queryAll(By.directive(MarkdownEditorStubComponent));
    const saveSpy = jest.fn();
    fixture.componentInstance.articleSave.subscribe(saveSpy);

    titleRu.value = 'Типизированная статья';
    titleRu.dispatchEvent(new Event('input'));
    titleEn.value = 'Typed article';
    titleEn.dispatchEvent(new Event('input'));
    contentEditors[0].componentInstance.valueChange.emit('Содержимое');
    contentEditors[1].componentInstance.valueChange.emit('Content');
    selectFolder('folder-1');
    const seoTitleRu = fixture.debugElement.query(By.css('#articleSeoTitleRu'))
      .nativeElement as HTMLInputElement;
    seoTitleRu.value = 'SEO типизированная статья';
    seoTitleRu.dispatchEvent(new Event('input'));
    const seoTitleEn = fixture.debugElement.query(By.css('#articleSeoTitleEn'))
      .nativeElement as HTMLInputElement;
    seoTitleEn.value = 'SEO typed article';
    seoTitleEn.dispatchEvent(new Event('input'));
    const seoDescriptionRu = fixture.debugElement.query(By.css('#articleSeoDescriptionRu'))
      .nativeElement as HTMLTextAreaElement;
    seoDescriptionRu.value = 'Описание для поисковой выдачи';
    seoDescriptionRu.dispatchEvent(new Event('input'));
    const seoDescriptionEn = fixture.debugElement.query(By.css('#articleSeoDescriptionEn'))
      .nativeElement as HTMLTextAreaElement;
    seoDescriptionEn.value = 'Description for search results';
    seoDescriptionEn.dispatchEvent(new Event('input'));
    uploadCoverFile();
    const coverImageAltRu = fixture.debugElement.query(By.css('#articleCoverImageAltRu'))
      .nativeElement as HTMLInputElement;
    coverImageAltRu.value = 'Обложка';
    coverImageAltRu.dispatchEvent(new Event('input'));
    const coverImageAltEn = fixture.debugElement.query(By.css('#articleCoverImageAltEn'))
      .nativeElement as HTMLInputElement;
    coverImageAltEn.value = 'Cover';
    coverImageAltEn.dispatchEvent(new Event('input'));
    fixture.componentInstance.selectTag(
      tag({ id: PYTHON_TAG_ID, nameRu: 'Питон', nameEn: 'Python', slug: 'python' }),
    );
    fixture.detectChanges();

    const form = fixture.debugElement.query(By.css('form')).nativeElement as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));

    expect(saveSpy).toHaveBeenCalledWith({
      slug: 'typed-article',
      folderId: 'folder-1',
      publishStatus: 'Draft',
      tagIds: [PYTHON_TAG_ID],
      metadata: {
        seoTitleRu: 'SEO типизированная статья',
        seoTitleEn: 'SEO typed article',
        seoDescriptionRu: 'Описание для поисковой выдачи',
        seoDescriptionEn: 'Description for search results',
        coverImageFileId: 'cover-file-id',
        coverImageAltRu: 'Обложка',
        coverImageAltEn: 'Cover',
      },
      translations: {
        ru: { title: 'Типизированная статья', content: 'Содержимое' },
        en: { title: 'Typed article', content: 'Content' },
      },
    });
  });

  it('searches tags only after two characters and a 200 ms debounce', async () => {
    setInput('[data-testid="article-tag-search"]', 'p');
    await waitForTagSearch();

    expect(articlesService.searchTags).not.toHaveBeenCalled();

    setInput('[data-testid="article-tag-search"]', 'py');
    expect(fixture.componentInstance.tagSearchControl.value).toBe('py');
    await wait(100);
    expect(articlesService.searchTags).not.toHaveBeenCalled();

    await wait(120);
    fixture.detectChanges();

    expect(articlesService.searchTags).toHaveBeenCalledWith('py', 10, 'ru');
    expect(fixture.nativeElement.textContent).toContain('Питон');
    expect(fixture.nativeElement.textContent).toContain('Python');
    expect(fixture.nativeElement.textContent).toContain('python');
  });

  it('adds one suggested tag, excludes it from later results, and removes it with one button', async () => {
    const search = fixture.nativeElement.querySelector(
      '[data-testid="article-tag-search"]',
    ) as HTMLInputElement;
    setInput('[data-testid="article-tag-search"]', 'py');
    await waitForTagSearch();
    fixture.detectChanges();

    fixture.nativeElement
      .querySelector<HTMLButtonElement>(`[data-testid="article-tag-suggestion-${PYTHON_TAG_ID}"]`)
      ?.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Питон');
    expect(search.value).toBe('');
    expect(document.activeElement).toBe(search);
    expect(unsavedChangesScope.hasChanges()).toBe(true);

    setInput('[data-testid="article-tag-search"]', 'py');
    await waitForTagSearch();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector(
        `[data-testid="article-tag-suggestion-${PYTHON_TAG_ID}"]`,
      ),
    ).toBeNull();

    fixture.nativeElement
      .querySelector<HTMLButtonElement>(`[data-testid="article-tag-remove-${PYTHON_TAG_ID}"]`)
      ?.click();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector(`[data-testid="article-tag-chip-${PYTHON_TAG_ID}"]`),
    ).toBeNull();
    expect(unsavedChangesScope.hasChanges()).toBe(false);
  });

  it('selects suggestions with the keyboard and closes them with Escape', async () => {
    const search = fixture.nativeElement.querySelector(
      '[data-testid="article-tag-search"]',
    ) as HTMLInputElement;
    setInput('[data-testid="article-tag-search"]', 'tag');
    await waitForTagSearch();
    fixture.detectChanges();

    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector(`[data-testid="article-tag-chip-${BACKEND_TAG_ID}"]`),
    ).not.toBeNull();

    setInput('[data-testid="article-tag-search"]', 'py');
    await waitForTagSearch();
    fixture.detectChanges();
    const keyupSpy = jest.fn();
    fixture.nativeElement.addEventListener('keyup', keyupSpy);
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    search.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.article-tag-suggestions')).toBeNull();
    expect(keyupSpy).not.toHaveBeenCalled();
  });

  it('shows a search error and cancels stale tag searches', async () => {
    const first = new Subject<ArticleTag[]>();
    articlesService.searchTags
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(throwError(() => new Error('Nope')));

    setInput('[data-testid="article-tag-search"]', 'py');
    await waitForTagSearch();
    setInput('[data-testid="article-tag-search"]', 'back');
    await waitForTagSearch();
    fixture.detectChanges();

    first.next([tag({ id: PYTHON_TAG_ID, nameRu: 'Питон', nameEn: 'Python', slug: 'python' })]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Не удалось найти теги.');
    expect(fixture.nativeElement.textContent).not.toContain('Питон');
  });

  it('renders no tag checkboxes or inline tag authoring controls', () => {
    const picker = fixture.nativeElement.querySelector(
      '[data-testid="article-tag-picker"]',
    ) as HTMLElement | null;

    expect(picker).not.toBeNull();
    expect(picker?.querySelector('input[type="checkbox"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('#newTagNameRu')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid^="article-tag-"][data-testid$="-save"]'),
    ).toBeNull();
  });

  it('localizes selected tag chips and preview with their independent language controls', () => {
    fixture.componentInstance.selectTag(
      tag({ id: PYTHON_TAG_ID, nameRu: 'Питон', nameEn: 'Python', slug: 'python' }),
    );
    fixture.detectChanges();

    clickViewMode('preview');

    const picker = fixture.nativeElement.querySelector(
      '[data-testid="article-tag-picker"]',
    ) as HTMLElement;
    const preview = fixture.nativeElement.querySelector('.articles-preview-article') as HTMLElement;
    expect(picker.textContent).toContain('Питон');
    expect(picker.textContent).not.toContain('Python');
    expect(preview.textContent).toContain('Питон');
    expect(preview.textContent).not.toContain('Python');

    previewLanguageButton('en').click();
    fixture.detectChanges();

    expect(picker.textContent).toContain('Питон');
    expect(picker.textContent).not.toContain('Python');
    expect(preview.textContent).toContain('Python');
    expect(preview.textContent).not.toContain('Питон');
  });

  it('switches preview language and preserves unsaved editor values when returning to edit mode', () => {
    setInput('#articleTitleRu', 'Русский предпросмотр');
    setInput('#articleTitleEn', 'English preview');
    setArticleContent('ru', 'Читайте [[articles:typed-article|русскую статью]].');
    setArticleContent('en', 'Read the [[articles:typed-article|English article]].');
    fixture.componentInstance.selectTag(
      tag({ id: PYTHON_TAG_ID, nameRu: 'Питон', nameEn: 'Python', slug: 'python' }),
    );
    fixture.componentInstance.setActiveLanguageTab('en');
    fixture.detectChanges();

    clickViewMode('preview');

    expect(previewSection().textContent).toContain('Русский предпросмотр');
    expect(previewSection().textContent).toContain('Питон');
    expect(previewSection().querySelector('a')?.getAttribute('href')).toBe(
      '/ru/articles/typed-article',
    );

    previewLanguageButton('en').click();
    fixture.detectChanges();

    expect(previewSection().textContent).toContain('English preview');
    expect(previewSection().textContent).toContain('Python');
    expect(previewSection().querySelector('a')?.getAttribute('href')).toBe(
      '/en/articles/typed-article',
    );

    clickViewMode('edit');

    expect(elementValue('#articleTitleRu')).toBe('Русский предпросмотр');
    expect(elementValue('#articleTitleEn')).toBe('English preview');
    expect(editLanguageButton('en').classList).toContain('active');
  });

  it('keeps the current preview language and content when another bundle fails to load', () => {
    const i18n = TestBed.inject(I18nService);
    jest
      .spyOn(i18n, 'ensureLanguageBundle')
      .mockReturnValue(throwError(() => new Error('bundle unavailable')));
    setInput('#articleTitleRu', 'Русский предпросмотр');
    setInput('#articleTitleEn', 'English preview');
    clickViewMode('preview');

    previewLanguageButton('en').click();
    fixture.detectChanges();

    expect(previewLanguageButton('ru').getAttribute('aria-pressed')).toBe('true');
    expect(previewLanguageButton('en').getAttribute('aria-pressed')).toBe('false');
    expect(previewSection().textContent).toContain('Русский предпросмотр');
    expect(previewSection().textContent).toContain('Не удалось загрузить язык предпросмотра.');
  });

  it('disables preview language controls while the selected bundle is loading', () => {
    const i18n = TestBed.inject(I18nService);
    const bundle$ = new Subject<void>();
    jest.spyOn(i18n, 'ensureLanguageBundle').mockReturnValue(bundle$);
    clickViewMode('preview');

    previewLanguageButton('en').click();
    fixture.detectChanges();

    expect(previewLanguageButton('ru').disabled).toBe(true);
    expect(previewLanguageButton('en').disabled).toBe(true);

    bundle$.next();
    bundle$.complete();
    fixture.detectChanges();

    expect(previewLanguageButton('en').disabled).toBe(false);
    expect(previewLanguageButton('en').getAttribute('aria-pressed')).toBe('true');
  });

  it('submits valid unsaved article data from preview mode', () => {
    const saveSpy = jest.fn();
    fixture.componentInstance.articleSave.subscribe(saveSpy);
    fillValidArticleMinimum();

    clickViewMode('preview');
    articleSaveButton().click();
    fixture.detectChanges();

    expect(saveSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'typed-article',
        translations: {
          ru: { title: 'Типизированная статья', content: 'Содержимое' },
          en: { title: 'Typed article', content: 'Content' },
        },
      }),
    );
    expect(previewSection().hidden).toBe(false);
  });

  it('keeps preview mode and language after an existing article is accepted as saved', () => {
    fixture.componentRef.setInput('article', articleDetail('typed-article', 'Typed article'));
    fixture.detectChanges();
    clickViewMode('preview');
    previewLanguageButton('en').click();
    fixture.detectChanges();

    fixture.componentInstance.acceptSavedArticle(
      articleDetail('renamed-article', 'Renamed article'),
    );
    fixture.detectChanges();

    expect(previewSection().hidden).toBe(false);
    expect(previewLanguageButton('en').getAttribute('aria-pressed')).toBe('true');
    expect(previewSection().textContent).toContain('Renamed article');
  });

  it('returns to visible edit validation when invalid preview data is saved', () => {
    const saveSpy = jest.fn();
    fixture.componentInstance.articleSave.subscribe(saveSpy);

    clickViewMode('preview');
    articleSaveButton().click();
    fixture.detectChanges();

    expect(saveSpy).not.toHaveBeenCalled();
    expect(editForm().hidden).toBe(false);
    expect(previewSection().hidden).toBe(true);
    expect(fixture.nativeElement.querySelector('#articleSlug').classList).toContain('is-invalid');
  });

  it('marks required article fields and blocks empty submit', () => {
    const saveSpy = jest.fn();
    fixture.componentInstance.articleSave.subscribe(saveSpy);

    const form = fixture.debugElement.query(By.css('form')).nativeElement as HTMLFormElement;
    const slug = fixture.debugElement.query(By.css('#articleSlug'))
      .nativeElement as HTMLInputElement;
    const titleRu = fixture.debugElement.query(By.css('#articleTitleRu'))
      .nativeElement as HTMLInputElement;
    const contentRuEditor = fixture.nativeElement.querySelector(
      '[data-testid="article-content-ru-editor"]',
    ) as HTMLElement | null;

    expect(fixture.nativeElement.textContent).toContain('Slug *');
    expect(fixture.nativeElement.textContent).toContain('Папка *');
    expect(fixture.nativeElement.textContent).toContain('Заголовок RU *');
    expect(fixture.nativeElement.textContent).toContain('Содержимое RU *');
    expect(contentRuEditor).not.toBeNull();

    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(saveSpy).not.toHaveBeenCalled();
    expect(slug.classList).toContain('is-invalid');
    expect(titleRu.classList).toContain('is-invalid');
    expect(
      fixture.nativeElement.querySelector('[data-testid="article-folder-select"]').classList,
    ).toContain('is-invalid');
    expect(contentRuEditor?.classList).toContain('article-markdown-editor-invalid');

    slug.value = 'typed-article';
    slug.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(slug.classList).not.toContain('is-invalid');
  });

  it.each<ArticleValidationCase>([
    {
      description: 'article slug pattern',
      selector: '#articleSlug',
      expectedMessage: 'Используйте строчные латинские буквы, цифры и одинарные дефисы.',
      setInvalidValue: () => setInput('#articleSlug', 'Invalid Slug'),
    },
    {
      description: 'RU title required text',
      selector: '#articleTitleRu',
      expectedMessage: 'Заполните поле.',
      setInvalidValue: () => setInput('#articleTitleRu', '   '),
    },
    {
      description: 'RU content required text',
      selector: '[data-testid="article-content-ru-editor"]',
      expectedMessage: 'Заполните поле.',
      invalidClass: 'is-invalid',
      setInvalidValue: () => setArticleContent('ru', '   '),
    },
    {
      description: 'EN title required text',
      selector: '#articleTitleEn',
      expectedMessage: 'Заполните поле.',
      setInvalidValue: () => setInput('#articleTitleEn', '   '),
    },
    {
      description: 'EN content max length',
      selector: '[data-testid="article-content-en-editor"]',
      expectedMessage: 'Максимум 100000 символов.',
      invalidClass: 'is-invalid',
      setInvalidValue: () => setArticleContent('en', INVALID_ARTICLE_CONTENT),
    },
    {
      description: 'RU SEO title max length',
      selector: '#articleSeoTitleRu',
      expectedMessage: 'Максимум 255 символов.',
      setInvalidValue: () => setInput('#articleSeoTitleRu', INVALID_SHORT_TEXT),
    },
    {
      description: 'EN SEO title max length',
      selector: '#articleSeoTitleEn',
      expectedMessage: 'Максимум 255 символов.',
      setInvalidValue: () => setInput('#articleSeoTitleEn', INVALID_SHORT_TEXT),
    },
    {
      description: 'RU SEO description max length',
      selector: '#articleSeoDescriptionRu',
      expectedMessage: 'Максимум 320 символов.',
      setInvalidValue: () => setInput('#articleSeoDescriptionRu', INVALID_SEO_DESCRIPTION),
    },
    {
      description: 'EN SEO description max length',
      selector: '#articleSeoDescriptionEn',
      expectedMessage: 'Максимум 320 символов.',
      setInvalidValue: () => setInput('#articleSeoDescriptionEn', INVALID_SEO_DESCRIPTION),
    },
    {
      description: 'RU cover alt max length',
      selector: '#articleCoverImageAltRu',
      expectedMessage: 'Максимум 255 символов.',
      setInvalidValue: () => setInput('#articleCoverImageAltRu', INVALID_SHORT_TEXT),
    },
    {
      description: 'EN cover alt max length',
      selector: '#articleCoverImageAltEn',
      expectedMessage: 'Максимум 255 символов.',
      setInvalidValue: () => setInput('#articleCoverImageAltEn', INVALID_SHORT_TEXT),
    },
  ])('shows invalid styling and localized feedback for $description', (validationCase) => {
    const saveSpy = jest.fn();
    fixture.componentInstance.articleSave.subscribe(saveSpy);
    fillValidArticleMinimum();
    validationCase.setInvalidValue();

    submitArticleForm();

    expect(saveSpy).not.toHaveBeenCalled();
    expectInvalidControl(
      validationCase.selector,
      validationCase.expectedMessage,
      validationCase.invalidClass,
    );
  });

  it('marks the hidden language tab that contains an invalid article field', () => {
    fillValidArticleMinimum();
    setInput('#articleTitleEn', '   ');
    fixture.componentInstance.setActiveLanguageTab('ru');
    fixture.detectChanges();

    submitArticleForm();

    const englishTab = buttonByText('Английский');
    expect(englishTab.classList).toContain('text-danger');
    expect(englishTab.getAttribute('aria-invalid')).toBe('true');
    expect(englishTab.textContent).toContain('!');
    expectInvalidControl('#articleTitleEn', 'Заполните поле.');
  });

  it('keeps whitespace-only required article fields invalid', () => {
    const saveSpy = jest.fn();
    fixture.componentInstance.articleSave.subscribe(saveSpy);
    const slug = fixture.debugElement.query(By.css('#articleSlug'))
      .nativeElement as HTMLInputElement;

    slug.value = '   ';
    slug.dispatchEvent(new Event('input'));
    fixture.debugElement.query(By.css('form')).nativeElement.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(saveSpy).not.toHaveBeenCalled();
    expect(slug.classList).toContain('is-invalid');
  });

  it('blocks invalid article slug and content length violations', () => {
    const saveSpy = jest.fn();
    fixture.componentInstance.articleSave.subscribe(saveSpy);
    fillValidArticleMinimum();
    setInput('#articleSlug', 'Invalid Slug');

    submitArticleForm();

    expect(saveSpy).not.toHaveBeenCalled();

    setInput('#articleSlug', 'typed-article');
    const contentEditors = fixture.debugElement.queryAll(By.directive(MarkdownEditorStubComponent));
    contentEditors[1].componentInstance.valueChange.emit('x'.repeat(100_001));
    fixture.detectChanges();

    submitArticleForm();

    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('uploads cover image and writes file id into the article metadata payload', () => {
    const saveSpy = jest.fn();
    fixture.componentInstance.articleSave.subscribe(saveSpy);

    fillValidArticleMinimum();
    const file = uploadCoverFile();
    submitArticleForm();

    expect(mediaUpload.uploadMediaFile).toHaveBeenCalledWith({
      file,
      purpose: 'articleCoverImage',
      name: 'cover.png',
      fileName: 'cover.png',
    });
    expect(
      fixture.nativeElement.querySelector('[data-testid="article-cover-file-status"]').textContent,
    ).toContain('cover.png');
    expect(saveSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          coverImageFileId: 'cover-file-id',
        }),
      }),
    );
  });

  it('shows existing cover image when an article is opened for editing', () => {
    fixture.componentRef.setInput(
      'article',
      articleDetailWithCover({
        coverImageFileId: 'cover-file-id',
        coverImageUrl: 'https://cdn.example.com/existing-cover.jpg',
      }),
    );
    fixture.detectChanges();

    const cover = fixture.nativeElement.querySelector(
      '[data-testid="article-cover-current-preview"]',
    ) as HTMLImageElement | null;

    expect(cover).not.toBeNull();
    expect(cover?.getAttribute('src')).toBe('https://cdn.example.com/existing-cover.jpg');
    expect(mediaUpload.getMediaFile).not.toHaveBeenCalled();
  });

  it('explains that an existing cover can be replaced and exposes an accessible remove action', () => {
    fixture.componentRef.setInput(
      'article',
      articleDetailWithCover({
        coverImageFileId: 'cover-file-id',
        coverImageUrl: 'https://cdn.example.com/existing-cover.jpg',
      }),
    );
    fixture.detectChanges();

    const label = fixture.nativeElement.querySelector(
      'label[for="articleCoverImageFile"]',
    ) as HTMLLabelElement;
    const hint = fixture.nativeElement.querySelector(
      '#articleCoverImageReplaceHint',
    ) as HTMLElement | null;
    const fileButton = fixture.nativeElement.querySelector(
      '[data-testid="article-cover-file-button"]',
    ) as HTMLButtonElement;
    const removeButton = fixture.nativeElement.querySelector(
      '[data-testid="article-cover-remove"]',
    ) as HTMLButtonElement | null;

    expect(label.textContent).toContain('Заменить обложку');
    expect(hint?.textContent).toContain(
      'Обложка установлена. Выберите новый файл, чтобы заменить её.',
    );
    expect(fileButton.getAttribute('aria-describedby')).toContain('articleCoverImageReplaceHint');
    expect(removeButton?.getAttribute('aria-label')).toBe('Удалить обложку');
    expect(removeButton?.getAttribute('title')).toBe('Удалить обложку');
    expect(removeButton?.textContent).toContain('−');
  });

  it('removes the cover from form state without saving and focuses the replacement button', () => {
    fixture.componentRef.setInput(
      'article',
      articleDetailWithCover({
        coverImageFileId: 'cover-file-id',
        coverImageUrl: 'https://cdn.example.com/existing-cover.jpg',
      }),
    );
    fixture.detectChanges();
    const saveSpy = jest.fn();
    fixture.componentInstance.articleSave.subscribe(saveSpy);
    const fileInput = fixture.nativeElement.querySelector(
      '#articleCoverImageFile',
    ) as HTMLInputElement;
    const fileButton = fixture.nativeElement.querySelector(
      '[data-testid="article-cover-file-button"]',
    ) as HTMLButtonElement;
    Object.defineProperty(fileInput, 'value', {
      configurable: true,
      value: 'C:\\fakepath\\cover.png',
      writable: true,
    });

    const removeButton = fixture.nativeElement.querySelector(
      '[data-testid="article-cover-remove"]',
    ) as HTMLButtonElement;
    removeButton.click();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="article-cover-current-preview"]'),
    ).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="article-cover-remove"]')).toBeNull();
    expect(fixture.componentInstance.form.controls.coverImageFileId.value).toBe('');
    expect(fixture.componentInstance.form.controls.coverImageAltRu.value).toBe('');
    expect(fixture.componentInstance.form.controls.coverImageAltEn.value).toBe('');
    expect(fileInput.value).toBe('');
    expect(
      fixture.nativeElement.querySelector('[data-testid="article-cover-file-status"]').textContent,
    ).toContain('Файл не выбран');
    expect(document.activeElement).toBe(fileButton);
    expect(fixture.componentInstance.form.dirty).toBe(true);
    expect(unsavedChangesScope.hasChanges()).toBe(true);
    expect(saveSpy).not.toHaveBeenCalled();

    submitArticleForm();

    expect(saveSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          coverImageFileId: null,
          coverImageAltRu: null,
          coverImageAltEn: null,
        }),
      }),
    );
  });

  it('keeps cover removal disabled while a replacement upload is in progress', () => {
    fixture.componentRef.setInput(
      'article',
      articleDetailWithCover({
        coverImageFileId: 'cover-file-id',
        coverImageUrl: 'https://cdn.example.com/existing-cover.jpg',
      }),
    );
    fixture.detectChanges();
    const upload$ = new Subject<UploadedMediaFile>();
    mediaUpload.uploadMediaFile.mockReturnValue(upload$);

    uploadCoverFile();

    const removeButton = fixture.nativeElement.querySelector(
      '[data-testid="article-cover-remove"]',
    ) as HTMLButtonElement;
    expect(removeButton.disabled).toBe(true);

    removeButton.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.form.controls.coverImageFileId.value).toBe('cover-file-id');
    expect(
      fixture.nativeElement.querySelector('[data-testid="article-cover-current-preview"]'),
    ).not.toBeNull();
  });

  it('keeps the existing replacement upload flow available', () => {
    fixture.componentRef.setInput(
      'article',
      articleDetailWithCover({
        coverImageFileId: 'existing-cover-file-id',
        coverImageUrl: 'https://cdn.example.com/existing-cover.jpg',
      }),
    );
    fixture.detectChanges();

    uploadCoverFile();

    const cover = fixture.nativeElement.querySelector(
      '[data-testid="article-cover-current-preview"]',
    ) as HTMLImageElement;
    expect(fixture.componentInstance.form.controls.coverImageFileId.value).toBe('cover-file-id');
    expect(cover.getAttribute('src')).toBe('https://cdn.example.com/cover.jpg');
    expect(fixture.nativeElement.textContent).toContain('Заменить обложку');
  });

  it('restores existing cover preview from file metadata when detail has only a file id', () => {
    fixture.componentRef.setInput(
      'article',
      articleDetailWithCover({
        coverImageFileId: 'cover-file-id',
        coverImageUrl: null,
      }),
    );
    fixture.detectChanges();

    const cover = fixture.nativeElement.querySelector(
      '[data-testid="article-cover-current-preview"]',
    ) as HTMLImageElement | null;

    expect(mediaUpload.getMediaFile).toHaveBeenCalledWith('cover-file-id');
    expect(cover).not.toBeNull();
    expect(cover?.getAttribute('src')).toBe('https://cdn.example.com/cover.jpg');
  });

  it('keeps cover removal available when the existing preview lookup fails', () => {
    mediaUpload.getMediaFile.mockReturnValue(throwError(() => new Error('preview unavailable')));
    fixture.componentRef.setInput(
      'article',
      articleDetailWithCover({
        coverImageFileId: 'cover-file-id',
        coverImageUrl: null,
      }),
    );
    fixture.detectChanges();

    const removeButton = fixture.nativeElement.querySelector(
      '[data-testid="article-cover-remove"]',
    ) as HTMLButtonElement | null;

    expect(mediaUpload.getMediaFile).toHaveBeenCalledWith('cover-file-id');
    expect(
      fixture.nativeElement.querySelector('[data-testid="article-cover-current-preview"]'),
    ).toBeNull();
    expect(removeButton).not.toBeNull();
    expect(removeButton?.getAttribute('aria-label')).toBe('Удалить обложку');
  });

  it('shows cover upload progress and disables save while uploading', () => {
    const upload$ = new Subject<UploadedMediaFile>();
    mediaUpload.uploadMediaFile.mockReturnValue(upload$);
    const file = uploadCoverFile();

    expect(mediaUpload.uploadMediaFile).toHaveBeenCalledWith({
      file,
      purpose: 'articleCoverImage',
      name: 'cover.png',
      fileName: 'cover.png',
    });
    expect(fixture.nativeElement.textContent).toContain('Загрузка обложки');
    const fileButton = fixture.nativeElement.querySelector(
      '[data-testid="article-cover-file-button"]',
    ) as HTMLButtonElement;
    const saveButton = fixture.debugElement.query(By.css('button[type="submit"]'))
      .nativeElement as HTMLButtonElement;
    expect(fileButton.disabled).toBe(true);
    expect(fileButton.getAttribute('aria-busy')).toBe('true');
    expect(saveButton.disabled).toBe(true);

    upload$.next({
      id: 'cover-file-id',
      purpose: 'articleCoverImage',
      namespace: 'media',
      relativePath: 'article-cover-images/cover.png',
      mimeType: 'image/png',
      sizeBytes: 5,
      name: 'cover.png',
      originalName: 'cover.png',
      createdAt: '2026-07-03T10:00:00+00:00',
      updatedAt: '2026-07-03T10:00:00+00:00',
      accessUrl: 'https://cdn.example.com/cover.jpg',
      markdownUrl: 'https://cdn.example.com/cover.jpg#fileId=cover-file-id',
    });
    upload$.complete();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Загрузка обложки');
    expect(fileButton.disabled).toBe(false);
    expect(fileButton.hasAttribute('aria-busy')).toBe(false);
    expect(saveButton.disabled).toBe(false);
  });

  it('shows a visible cover upload error and does not keep stale uploading state', () => {
    mediaUpload.uploadMediaFile.mockReturnValue(throwError(() => new Error('upload failed')));

    uploadCoverFile();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Не удалось загрузить обложку');
    expect(
      fixture.nativeElement.querySelector('[data-testid="article-cover-file-status"]').textContent,
    ).toContain('Файл не выбран');
    const saveButton = fixture.debugElement.query(By.css('button[type="submit"]'))
      .nativeElement as HTMLButtonElement;
    expect(saveButton.disabled).toBe(false);
  });

  it('updates SEO analysis while editing localized fields', () => {
    const slug = fixture.debugElement.query(By.css('#articleSlug'))
      .nativeElement as HTMLInputElement;
    const titleRu = fixture.debugElement.query(By.css('#articleTitleRu'))
      .nativeElement as HTMLInputElement;
    const contentEditors = fixture.debugElement.queryAll(By.directive(MarkdownEditorStubComponent));

    slug.value = 'typed-article';
    slug.dispatchEvent(new Event('input'));
    titleRu.value = 'Типизированная статья для поиска';
    titleRu.dispatchEvent(new Event('input'));
    selectFolder('folder-1');
    contentEditors[0].componentInstance.valueChange.emit(
      'Эта статья объясняет работу типизированных Angular форм, сигналов и локализованных полей в редакторе статей.',
    );
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('SEO-анализ');
    expect(text).toContain('/articles/typed-article');
  });

  it('warns when typed wiki links point to missing targets', () => {
    const contentEditors = fixture.debugElement.queryAll(By.directive(MarkdownEditorStubComponent));

    contentEditors[0].componentInstance.valueChange.emit(
      'См. [[articles:typed-article]] и [[matrix:missing-question|отсутствующий вопрос]].',
    );
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('matrix:missing-question');
  });

  it('renders active-language preview content with wiki links', () => {
    const titleRu = fixture.debugElement.query(By.css('#articleTitleRu'))
      .nativeElement as HTMLInputElement;
    const contentEditors = fixture.debugElement.queryAll(By.directive(MarkdownEditorStubComponent));

    titleRu.value = 'Предпросмотр статьи';
    titleRu.dispatchEvent(new Event('input'));
    contentEditors[0].componentInstance.valueChange.emit(
      'Откройте [[articles:typed-article|типизированную статью]].',
    );
    fixture.detectChanges();

    clickViewMode('preview');

    const preview = fixture.debugElement.query(By.css('.articles-preview-article'))
      .nativeElement as HTMLElement;
    const link = fixture.debugElement.query(By.css('.articles-preview-article a'))
      .nativeElement as HTMLAnchorElement;

    expect(preview.textContent).toContain('Предпросмотр статьи');
    expect(preview.textContent).toContain('типизированную статью');
    expect(link.getAttribute('href')).toBe('/ru/articles/typed-article');
  });

  function elementValue(selector: string): string {
    const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement | null;
    expect(input).not.toBeNull();
    return (input as HTMLInputElement).value;
  }

  function createFixture(): void {
    fixture?.destroy();
    fixture = TestBed.createComponent(ArticleFormComponent);
    confirmDiscard = jest.fn(() => false);
    unsavedChangesScope = new AdminUnsavedChangesScope(confirmDiscard, () => undefined);
    fixture.componentRef.setInput('article', null);
    fixture.componentRef.setInput('unsavedChangesScope', unsavedChangesScope);
    fixture.detectChanges();
  }

  function wait(durationMs: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, durationMs));
  }

  function waitForTagSearch(): Promise<void> {
    return wait(220);
  }

  function setInput(selector: string, value: string): void {
    const input = fixture.nativeElement.querySelector(selector) as
      HTMLInputElement | HTMLTextAreaElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function fillValidArticleMinimum(): void {
    setInput('#articleSlug', 'typed-article');
    selectFolder('folder-1');
    setInput('#articleTitleRu', 'Типизированная статья');
    setInput('#articleTitleEn', 'Typed article');
    const contentEditors = fixture.debugElement.queryAll(By.directive(MarkdownEditorStubComponent));
    contentEditors[0].componentInstance.valueChange.emit('Содержимое');
    contentEditors[1].componentInstance.valueChange.emit('Content');
    fixture.detectChanges();
  }

  function selectFolder(folderId: string): void {
    chooseSiteSelectOption(fixture, '[data-testid="article-folder-select"]', folderId);
  }

  function uploadCoverFile(): File {
    const fileInput = fixture.debugElement.query(By.css('#articleCoverImageFile'))
      .nativeElement as HTMLInputElement;
    const file = new File(['cover'], 'cover.png', { type: 'image/png' });
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fileInput.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    return file;
  }

  function setArticleContent(language: 'ru' | 'en', value: string): void {
    const contentEditors = fixture.debugElement.queryAll(By.directive(MarkdownEditorStubComponent));
    const index = language === 'ru' ? 0 : 1;
    contentEditors[index].componentInstance.valueChange.emit(value);
    fixture.detectChanges();
  }

  function expectInvalidControl(
    selector: string,
    expectedMessage: string,
    invalidClass = 'is-invalid',
  ): void {
    const element = fixture.nativeElement.querySelector(selector) as HTMLElement | null;
    expect(element).not.toBeNull();
    expect(element?.classList).toContain(invalidClass);
    expect(element?.getAttribute('aria-invalid')).toBe('true');
    expect(fixture.nativeElement.textContent).toContain(expectedMessage);
  }

  function buttonByText(text: string): HTMLButtonElement {
    const button = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLButtonElement>('button'),
    ).find((candidate) => candidate.textContent?.includes(text));
    if (button === undefined) {
      throw new Error(`Button not found: ${text}`);
    }
    return button;
  }

  function viewModeButton(mode: 'edit' | 'preview'): HTMLButtonElement {
    const button = fixture.nativeElement.querySelector(
      `[data-testid="article-form-view-${mode}"]`,
    ) as HTMLButtonElement | null;
    if (button === null) {
      throw new Error(`Article form view mode button not found: ${mode}`);
    }
    return button;
  }

  function clickViewMode(mode: 'edit' | 'preview'): void {
    viewModeButton(mode).click();
    fixture.detectChanges();
  }

  function editForm(): HTMLFormElement {
    const form = fixture.nativeElement.querySelector(
      '[data-testid="article-form-edit"]',
    ) as HTMLFormElement | null;
    if (form === null) {
      throw new Error('Article edit form not found');
    }
    return form;
  }

  function previewSection(): HTMLElement {
    const section = fixture.nativeElement.querySelector(
      '[data-testid="article-form-preview"]',
    ) as HTMLElement | null;
    if (section === null) {
      throw new Error('Article preview section not found');
    }
    return section;
  }

  function previewLanguageButton(language: 'ru' | 'en'): HTMLButtonElement {
    const button = fixture.nativeElement.querySelector(
      `[data-testid="article-preview-language-${language}"]`,
    ) as HTMLButtonElement | null;
    if (button === null) {
      throw new Error(`Article preview language button not found: ${language}`);
    }
    return button;
  }

  function editLanguageButton(language: 'ru' | 'en'): HTMLButtonElement {
    const button = fixture.nativeElement.querySelector(
      `[data-testid="article-form-language-${language}"]`,
    ) as HTMLButtonElement | null;
    if (button === null) {
      throw new Error(`Article edit language button not found: ${language}`);
    }
    return button;
  }

  function articleSaveButton(): HTMLButtonElement {
    const button = fixture.nativeElement.querySelector(
      '[data-testid="article-form-save"]',
    ) as HTMLButtonElement | null;
    if (button === null) {
      throw new Error('Article save button not found');
    }
    return button;
  }

  function submitArticleForm(): void {
    fixture.debugElement.query(By.css('form')).nativeElement.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }
});

@Component({
  selector: 'app-markdown-editor',
  standalone: true,
  template: '',
})
class MarkdownEditorStubComponent {
  readonly value = input<string>('');
  readonly language = input.required<'ru' | 'en'>();
  readonly accessibleLabel = input.required<string>();
  readonly imageUploadsEnabled = input.required<boolean>();
  readonly valueChange = output<string>();
}

function tag(params: { id: string; nameRu: string; nameEn: string; slug: string }): ArticleTag {
  return {
    id: params.id,
    name: params.nameRu,
    slug: params.slug,
    translations: {
      ru: { name: params.nameRu },
      en: { name: params.nameEn },
    },
  };
}

function articleDetail(slug: string, title: string): ArticleDetail {
  return {
    id: `0000000000000000000000000000000${slug === 'first-article' ? '1' : '2'}`,
    title,
    slug,
    folder: 'Engineering',
    folderId: 'folder-1',
    folderKey: 'engineering',
    authorUsername: 'admin',
    publishedAt: null,
    publishStatus: 'Draft',
    updatedAt: '2026-01-03T03:04:05+00:00',
    excerpt: '',
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
    viewCount: 0,
    tags: [],
    content: '# Content',
    createdAt: '2026-01-01T03:04:05+00:00',
    reactionCounts: { heart: 0, fire: 0, thinking: 0, neutral: 0, poop: 0 },
    translations: {
      ru: { title: `${title} RU`, content: '# RU' },
      en: { title, content: '# EN' },
    },
  };
}

function articleDetailWithCover(params: {
  coverImageFileId: string;
  coverImageUrl: string | null;
}): ArticleDetail {
  const article = articleDetail('covered-article', 'Covered article');
  return {
    ...article,
    metadata: {
      ...article.metadata,
      coverImageFileId: params.coverImageFileId,
      coverImageUrl: params.coverImageUrl,
      coverImageAltRu: 'Обложка',
      coverImageAltEn: 'Cover',
    },
  };
}
