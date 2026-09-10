import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { LanguageCode } from '../../../../core/i18n/i18n.model';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { SeoService } from '../../../../core/seo/seo.service';
import { SitemapArticle, SitemapArticlesService } from '../../services/sitemap-articles.service';

interface SitemapArticleLink {
  title: string;
  commands: string[];
}

@Component({
  selector: 'app-sitemap-page',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sitemap-page.component.html',
})
export class SitemapPageComponent implements OnInit {
  private readonly seoService = inject(SeoService);
  private readonly i18n = inject(I18nService);
  private readonly sitemapArticlesService = inject(SitemapArticlesService);
  private readonly destroyRef = inject(DestroyRef);

  readonly publishedArticles = signal<SitemapArticle[]>([]);
  readonly publishedArticlesLoading = signal(false);
  readonly publishedArticlesError = signal(false);
  readonly language = computed(() => {
    const language = this.i18n.language();
    if (language === null) {
      throw new Error('I18n language is not initialized');
    }
    return language;
  });
  readonly publishedArticleLinks = computed<SitemapArticleLink[]>(() =>
    this.publishedArticles().map((article) => ({
      title: article.title,
      commands: ['/', this.language(), 'articles', article.slug],
    })),
  );

  private readonly publishedArticlesLanguageEffect = effect(() => {
    const language = this.i18n.language();
    if (language === null) return;
    untracked(() => this.loadPublishedArticles(language));
  });

  ngOnInit(): void {
    this.seoService.setTranslatedMeta({
      titleKey: 'sitemap.seo.title',
      descriptionKey: 'sitemap.seo.description',
      canonicalPath: '/sitemap',
    });
  }

  private loadPublishedArticles(language: LanguageCode): void {
    this.publishedArticlesLoading.set(true);
    this.publishedArticlesError.set(false);
    this.sitemapArticlesService
      .getPublishedArticles(language)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (articles) => {
          this.publishedArticles.set(articles);
          this.publishedArticlesLoading.set(false);
        },
        error: () => {
          this.publishedArticles.set([]);
          this.publishedArticlesError.set(true);
          this.publishedArticlesLoading.set(false);
        },
      });
  }
}
