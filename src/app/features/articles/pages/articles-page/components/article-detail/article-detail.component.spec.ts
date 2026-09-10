import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideI18nTesting } from '../../../../../../testing/i18n-testing';
import { ArticleDetailComponent } from './article-detail.component';

describe('ArticleDetailComponent', () => {
  let fixture: ComponentFixture<ArticleDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArticleDetailComponent],
      providers: [provideI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(ArticleDetailComponent);
    fixture.componentRef.setInput('article', {
      id: '00000000000000000000000000000001',
      title: 'Typed articles',
      slug: 'typed-articles',
      folder: 'Engineering',
      folderId: 'folder-1',
      folderKey: 'engineering',
      authorUsername: 'admin',
      publishedAt: '2026-01-02T03:04:05+00:00',
      publishStatus: 'Published',
      createdAt: '2026-01-01T03:04:05+00:00',
      updatedAt: '2026-01-03T03:04:05+00:00',
      excerpt: 'Excerpt',
      content: '# Content\n\nRead [[matrix:how-to-write-function|matrix question]].',
      metadata: {
        seoTitleRu: 'SEO Typed articles RU',
        seoTitleEn: 'SEO Typed articles EN',
        seoDescriptionRu:
          'SEO description RU with enough text to be useful for search snippets and social cards.',
        seoDescriptionEn:
          'SEO description EN with enough text to be useful for search snippets and social cards.',
        coverImageFileId: 'cover-file-id',
        coverImageUrl: 'https://example.com/cover.jpg',
        coverImageAltRu: 'Cover image RU',
        coverImageAltEn: 'Cover image EN',
      },
      viewCount: 42,
      reactionCounts: { heart: 1, fire: 2, thinking: 3, neutral: 4, poop: 5 },
      tags: [
        {
          id: '00000000000000000000000000000002',
          name: 'Python',
          slug: 'python',
          translations: { ru: { name: 'Python' }, en: { name: 'Python' } },
        },
      ],
      translations: {
        ru: {
          title: 'Typed articles',
          content: '# Content\n\nRead [[matrix:how-to-write-function|matrix question]].',
        },
        en: {
          title: 'Typed articles',
          content: '# Content\n\nRead [[matrix:how-to-write-function|matrix question]].',
        },
      },
    });
    fixture.componentRef.setInput('selectedReaction', 'poop');
    fixture.componentRef.setInput('dateLocale', 'ru-RU');
    fixture.componentRef.setInput('language', 'en');
    fixture.detectChanges();
  });

  it('renders public view count and reaction counts', () => {
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('42 просмотров');
    expect(text).toContain('5');
  });

  it('renders the public cover image with localized alt text', () => {
    const coverSlot = fixture.nativeElement.querySelector<HTMLElement>(
      '[data-testid="article-detail-cover-slot"]',
    );
    const coverImage = fixture.nativeElement.querySelector<HTMLImageElement>(
      '[data-testid="article-detail-cover"]',
    );

    expect(coverSlot?.classList.contains('ratio')).toBe(true);
    expect(coverSlot?.classList.contains('ratio-16x9')).toBe(true);
    expect(coverImage?.getAttribute('src')).toBe('https://example.com/cover.jpg');
    expect(coverImage?.alt).toBe('Cover image EN');
    expect(coverImage?.width).toBe(1600);
    expect(coverImage?.height).toBe(900);

    fixture.componentRef.setInput('language', 'ru');
    fixture.detectChanges();

    expect(coverImage?.alt).toBe('Cover image RU');
  });

  it('uses an empty alt when the localized cover alt is absent', () => {
    fixture.componentRef.setInput('article', {
      ...fixture.componentInstance.article()!,
      metadata: {
        ...fixture.componentInstance.article()!.metadata,
        coverImageAltEn: null,
      },
    });
    fixture.detectChanges();

    const coverImage = fixture.nativeElement.querySelector<HTMLImageElement>(
      '[data-testid="article-detail-cover"]',
    );

    expect(coverImage?.alt).toBe('');
  });

  it('does not render a cover image when its URL is absent', () => {
    fixture.componentRef.setInput('article', {
      ...fixture.componentInstance.article()!,
      metadata: {
        ...fixture.componentInstance.article()!.metadata,
        coverImageUrl: null,
      },
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="article-detail-cover"]')).toBeNull();
  });

  it('renders a localized article date and preserves the ISO value', () => {
    const timestamp = fixture.nativeElement.querySelector<HTMLTimeElement>(
      '[data-testid="article-detail-date"]',
    );
    const publishedAt = fixture.componentInstance.article()!.publishedAt!;

    expect(timestamp?.dateTime).toBe(publishedAt);
    expect(timestamp?.textContent?.trim()).toBe(formatExpectedDate(publishedAt, 'ru-RU'));
    expect(fixture.nativeElement.textContent).not.toContain(publishedAt);

    fixture.componentRef.setInput('dateLocale', 'en-US');
    fixture.detectChanges();

    expect(timestamp?.textContent?.trim()).toBe(formatExpectedDate(publishedAt, 'en-US'));
  });

  it('does not render authoring SEO analysis on the public article detail', () => {
    const text = fixture.nativeElement.textContent as string;

    expect(text).not.toContain('SEO-анализ');
  });

  it('emits selected reaction', () => {
    const reactionSelected = jest.fn();
    fixture.componentInstance.reactionSelected.subscribe(reactionSelected);

    const heartButton = fixture.debugElement.query(By.css('[data-testid="reaction-heart"]'));
    heartButton.nativeElement.click();

    expect(reactionSelected).toHaveBeenCalledWith('heart');
  });

  it('keeps visible reaction button text inside the accessible name', () => {
    const heartButton = fixture.debugElement.query(By.css('[data-testid="reaction-heart"]'))
      .nativeElement as HTMLButtonElement;

    expect(heartButton.getAttribute('aria-label')).toBeNull();
    expect(heartButton.querySelector('.visually-hidden')?.textContent?.trim()).toBe('Понравилось');
    expect(heartButton.textContent).toContain('1');
  });

  it('renders typed wiki links to matrix questions', () => {
    const link = fixture.debugElement.query(By.css('.articles-markdown a'))
      .nativeElement as HTMLAnchorElement;

    expect(link.getAttribute('href')).toBe('/en/competency-matrix/questions/how-to-write-function');
    expect(link.textContent).toBe('matrix question');
  });

  it('renders highlighted fenced code on the public article detail', () => {
    fixture.componentRef.setInput('article', {
      ...fixture.componentInstance.article()!,
      content: '```ts\nconst answer = 42;\n```',
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('code.language-ts')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.token.keyword')?.textContent).toBe('const');
  });

  it('does not render admin actions or draft badges on public article details', () => {
    fixture.componentRef.setInput('article', {
      ...fixture.componentInstance.article()!,
      publishStatus: 'Draft',
      publishedAt: null,
    });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;

    expect(text).not.toContain('Редактировать');
    expect(text).not.toContain('Опубликовать');
    expect(text).not.toContain('Снять с публикации');
    expect(text).not.toContain('Удалить');
    expect(text).not.toContain('Черновик');
  });
});

function formatExpectedDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value));
}
