import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../../../../../testing/i18n-testing';
import { ArticleSeoAnalysis } from '../../../../models/article-seo-analysis';
import { ArticleSeoPanelComponent } from './article-seo-panel.component';

describe('ArticleSeoPanelComponent', () => {
  let fixture: ComponentFixture<ArticleSeoPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArticleSeoPanelComponent],
      providers: [provideI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(ArticleSeoPanelComponent);
    fixture.componentRef.setInput('analysis', analysis());
    fixture.detectChanges();
  });

  it('renders overall status, canonical path, and checks', () => {
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('SEO-анализ');
    expect(text).toContain('2 предупреждения');
    expect(text).toContain('/articles/typed-articles');
    expect(text).toContain('Длина заголовка');
    expect(text).toContain('Теги');
  });
});

function analysis(): ArticleSeoAnalysis {
  return {
    overallStatus: 'warning',
    canonicalPath: '/articles/typed-articles',
    descriptionPreview:
      'This article explains how typed Angular forms and localized fields work together.',
    goodCount: 1,
    warningCount: 2,
    missingCount: 0,
    checks: [
      {
        id: 'title-present',
        status: 'good',
        titleKey: 'articles.seoAnalysis.check.titlePresent',
        messageKey: 'articles.seoAnalysis.message.titlePresent.good',
      },
      {
        id: 'title-length',
        status: 'warning',
        titleKey: 'articles.seoAnalysis.check.titleLength',
        messageKey: 'articles.seoAnalysis.message.titleLength.warning',
      },
      {
        id: 'tags',
        status: 'warning',
        titleKey: 'articles.seoAnalysis.check.tags',
        messageKey: 'articles.seoAnalysis.message.tags.warning',
      },
    ],
  };
}
