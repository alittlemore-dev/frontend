import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { SeoService } from '../../../../core/seo/seo.service';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { SitemapArticlesService } from '../../services/sitemap-articles.service';
import { SitemapPageComponent } from './sitemap-page.component';

describe('SitemapPageComponent', () => {
  let fixture: ComponentFixture<SitemapPageComponent>;
  let sitemapArticlesService: { getPublishedArticles: jest.Mock };
  let seoService: { setTranslatedMeta: jest.Mock };

  beforeEach(async () => {
    sitemapArticlesService = {
      getPublishedArticles: jest.fn().mockReturnValue(
        of([
          {
            title: 'Typed articles',
            slug: 'typed-articles',
          },
        ]),
      ),
    };
    seoService = {
      setTranslatedMeta: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [SitemapPageComponent],
      providers: [
        provideRouter([]),
        provideI18nTesting(),
        { provide: SeoService, useValue: seoService },
        { provide: SitemapArticlesService, useValue: sitemapArticlesService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SitemapPageComponent);
  });

  it('renders localized links to published articles', () => {
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector(
      '[data-testid="sitemap-article-link"]',
    ) as HTMLAnchorElement;

    expect(sitemapArticlesService.getPublishedArticles).toHaveBeenCalledWith('ru');
    expect(fixture.nativeElement.textContent).toContain('Опубликованные статьи');
    expect(link.textContent?.trim()).toBe('Typed articles');
    expect(link.getAttribute('href')).toBe('/ru/articles/typed-articles');
  });

  it('renders a localized link to the site-build case study', () => {
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector(
      'a[href="/ru/how-this-site-is-built"]',
    ) as HTMLAnchorElement | null;

    expect(link).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Как устроен сайт');
    expect(fixture.nativeElement.querySelector('a[href="/ru/about-me"]')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Обо мне');
  });

  it('renders a localized link to updates', () => {
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector(
      'a[href="/ru/updates"]',
    ) as HTMLAnchorElement | null;

    expect(link).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Обновления');
  });
});
