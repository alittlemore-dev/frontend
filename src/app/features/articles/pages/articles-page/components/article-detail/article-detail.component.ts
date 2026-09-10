import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { LanguageCode } from '../../../../../../core/i18n/i18n.model';
import { TranslatePipe } from '../../../../../../core/i18n/translate.pipe';
import { ApiError } from '../../../../../../core/models/api-error.model';
import { WikiLinkRendererService } from '../../../../../../core/wiki-links/wiki-link-renderer.service';
import { ErrorMessageComponent } from '../../../../../../shared/ui/error-message/error-message.component';
import { LoadingSpinnerComponent } from '../../../../../../shared/ui/loading-spinner/loading-spinner.component';
import { formatLocalizedDate } from '../../../../../../shared/utils/localized-date';
import { ArticleDetail, ArticleReactionKind } from '../../../../models/articles.model';

interface ReactionOption {
  kind: ArticleReactionKind;
  emoji: string;
  labelKey: string;
}

const REACTION_OPTIONS: ReactionOption[] = [
  { kind: 'heart', emoji: '❤️', labelKey: 'enum.articleReaction.heart' },
  { kind: 'fire', emoji: '🔥', labelKey: 'enum.articleReaction.fire' },
  { kind: 'thinking', emoji: '🤔', labelKey: 'enum.articleReaction.thinking' },
  { kind: 'neutral', emoji: '😐', labelKey: 'enum.articleReaction.neutral' },
  { kind: 'poop', emoji: '💩', labelKey: 'enum.articleReaction.poop' },
];

@Component({
  selector: 'app-article-detail',
  standalone: true,
  imports: [LoadingSpinnerComponent, ErrorMessageComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './article-detail.component.html',
})
export class ArticleDetailComponent {
  private readonly wikiLinkRenderer = inject(WikiLinkRendererService);

  readonly article = input<ArticleDetail | null>(null);
  readonly loading = input(false);
  readonly error = input<ApiError | null>(null);
  readonly dateLocale = input.required<string>();
  readonly language = input.required<LanguageCode>();
  readonly selectedReaction = input<ArticleReactionKind | null>(null);
  readonly reactionLoading = input(false);

  readonly back = output<void>();
  readonly tagSelected = output<string>();
  readonly reactionSelected = output<ArticleReactionKind>();

  readonly reactions = REACTION_OPTIONS;

  readonly contentHtml = computed(() => {
    const article = this.article();
    if (!article?.content) return '';
    return this.wikiLinkRenderer.render(article.content, this.language());
  });

  readonly coverImageUrl = computed(() => this.article()?.metadata.coverImageUrl ?? null);

  readonly coverImageAlt = computed(() => {
    const metadata = this.article()?.metadata;
    if (!metadata) return '';
    return this.language() === 'ru'
      ? (metadata.coverImageAltRu ?? '')
      : (metadata.coverImageAltEn ?? '');
  });

  readonly isPublished = computed(() => this.article()?.publishStatus === 'Published');

  articleDate(): string {
    const value = this.articleDateValue();
    return value === '' ? '' : formatLocalizedDate(value, this.dateLocale(), 'date');
  }

  articleDateValue(): string {
    const article = this.article();
    return article?.publishedAt ?? article?.updatedAt ?? '';
  }

  reactionCount(kind: ArticleReactionKind): number {
    const article = this.article();
    if (!article) return 0;
    return article.reactionCounts[kind];
  }
}
