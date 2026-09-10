import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideI18nTesting } from '../../../../../../testing/i18n-testing';
import { ArticleListComponent } from './article-list.component';

describe('ArticleListComponent', () => {
  let fixture: ComponentFixture<ArticleListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArticleListComponent],
      providers: [provideI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(ArticleListComponent);
    fixture.componentRef.setInput('articles', [
      {
        id: '00000000000000000000000000000001',
        title: 'Typed articles',
        slug: 'typed-articles',
        folder: 'Engineering',
        folderId: 'folder-1',
        folderKey: 'engineering',
        authorUsername: 'admin',
        publishedAt: '2026-01-02T03:04:05+00:00',
        publishStatus: 'Published',
        updatedAt: '2026-01-03T03:04:05+00:00',
        excerpt: 'Excerpt',
        viewCount: 42,
        tags: [
          {
            id: '00000000000000000000000000000002',
            name: 'Python',
            slug: 'python',
            translations: { ru: { name: 'Python' }, en: { name: 'Python' } },
          },
        ],
      },
    ]);
    fixture.componentRef.setInput('page', 1);
    fixture.componentRef.setInput('totalPages', 1);
    fixture.componentRef.setInput('dateLocale', 'ru-RU');
    fixture.detectChanges();
  });

  it('renders public view count', () => {
    expect(fixture.nativeElement.textContent).toContain('42 просмотров');
  });

  it('renders localized article dates and preserves ISO values', () => {
    const timestamp = fixture.nativeElement.querySelector<HTMLTimeElement>(
      '[data-testid="article-list-date"]',
    );
    const publishedAt = '2026-01-02T03:04:05+00:00';

    expect(timestamp?.dateTime).toBe(publishedAt);
    expect(timestamp?.textContent?.trim()).toBe(formatExpectedDate(publishedAt, 'ru-RU'));
    expect(fixture.nativeElement.textContent).not.toContain(publishedAt);

    fixture.componentRef.setInput('dateLocale', 'en-US');
    fixture.detectChanges();

    expect(timestamp?.textContent?.trim()).toBe(formatExpectedDate(publishedAt, 'en-US'));
  });

  it('places inline metadata below the article tags', () => {
    const articleSummary = fixture.nativeElement.querySelector(
      '[data-testid="article-list-summary"]',
    ) as HTMLElement | null;
    const tags = fixture.nativeElement.querySelector(
      '[data-testid="article-list-tags"]',
    ) as HTMLElement | null;
    const metadata = fixture.nativeElement.querySelector(
      '[data-testid="article-list-metadata"]',
    ) as HTMLElement | null;

    expect(articleSummary).not.toBeNull();
    expect(tags).not.toBeNull();
    expect(metadata).not.toBeNull();
    expect(
      tags?.compareDocumentPosition(metadata!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(metadata?.classList).toContain('d-flex');
    expect(metadata?.classList).toContain('flex-wrap');
    expect(Array.from(metadata?.children ?? []).map((child) => child.tagName)).toEqual([
      'TIME',
      'SPAN',
      'SPAN',
    ]);
  });

  it('does not render draft badges on the public article list', () => {
    fixture.componentRef.setInput('articles', [
      {
        id: '00000000000000000000000000000003',
        title: 'Draft article',
        slug: 'draft-article',
        folder: 'Engineering',
        folderId: 'folder-1',
        folderKey: 'engineering',
        authorUsername: 'admin',
        publishedAt: null,
        publishStatus: 'Draft',
        updatedAt: '2026-01-03T03:04:05+00:00',
        excerpt: 'Draft excerpt',
        viewCount: 0,
        tags: [],
      },
    ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Черновик');
  });

  it('emits article and tag selections', () => {
    const articleSelected = jest.fn();
    const tagSelected = jest.fn();
    fixture.componentInstance.articleSelected.subscribe(articleSelected);
    fixture.componentInstance.tagSelected.subscribe(tagSelected);

    fixture.debugElement.query(By.css('.articles-title-button')).nativeElement.click();
    fixture.debugElement.query(By.css('.btn-outline-secondary')).nativeElement.click();

    expect(articleSelected).toHaveBeenCalledWith('typed-articles');
    expect(tagSelected).toHaveBeenCalledWith('python');
  });
});

function formatExpectedDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value));
}
