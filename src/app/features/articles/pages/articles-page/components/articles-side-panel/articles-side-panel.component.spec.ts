import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../../../../../testing/i18n-testing';
import { ArticleTree } from '../../../../models/articles.model';
import { ArticlesSidePanelComponent } from './articles-side-panel.component';

describe('ArticlesSidePanelComponent', () => {
  let fixture: ComponentFixture<ArticlesSidePanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArticlesSidePanelComponent],
      providers: [provideI18nTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ArticlesSidePanelComponent);
  });

  it('renders expanded folder navigation and the current article', () => {
    const tree: ArticleTree = {
      folders: [
        {
          folderId: 'folder-1',
          folderKey: 'engineering',
          folder: 'Engineering',
          articles: [
            {
              title: 'Typed articles',
              slug: 'typed-articles',
              publishStatus: 'Published',
              publishedAt: '2026-01-02T03:04:05+00:00',
              updatedAt: '2026-01-03T03:04:05+00:00',
            },
          ],
        },
      ],
    };
    fixture.componentRef.setInput('tree', tree);
    fixture.componentRef.setInput('currentSlug', 'typed-articles');
    fixture.detectChanges();

    const folder = fixture.nativeElement.querySelector('ds-navigation button') as HTMLButtonElement;
    folder.click();
    fixture.detectChanges();

    const article = fixture.nativeElement.querySelector('ds-navigation a') as HTMLButtonElement;

    expect(folder.getAttribute('aria-expanded')).toBe('true');
    expect(article.getAttribute('aria-current')).toBe('page');
    expect(article.getAttribute('href')).toBe('/ru/competency/articles/typed-articles');
    const selected = jest.fn();
    fixture.componentInstance.articleSelected.subscribe(selected);
    article.click();
    expect(selected).toHaveBeenCalledWith('typed-articles');
  });
});
