import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../../../../../core/i18n/i18n.service';
import { LanguageCode } from '../../../../../../core/i18n/i18n.model';
import { WikiLinkRendererService } from '../../../../../../core/wiki-links/wiki-link-renderer.service';
import { ArticleTag } from '../../../../models/article-workspace.model';

@Component({
  selector: 'app-admin-article-authoring-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './article-authoring-preview.component.html',
})
export class ArticleAuthoringPreviewComponent {
  private readonly wikiLinkRenderer = inject(WikiLinkRendererService);
  private readonly i18n = inject(I18nService);

  readonly title = input.required<string>();
  readonly content = input.required<string>();
  readonly tags = input.required<readonly ArticleTag[]>();
  readonly coverImageUrl = input.required<string | null>();
  readonly coverImageAlt = input.required<string | null>();
  readonly seoTitle = input.required<string | null>();
  readonly seoDescription = input.required<string | null>();
  readonly language = input.required<LanguageCode>();
  readonly bundleVersion = input.required<number>();

  readonly contentHtml = computed(() =>
    this.wikiLinkRenderer.render(this.content(), this.language()),
  );
  readonly socialTitle = computed(() => this.seoTitle()?.trim() || this.title().trim());
  readonly socialDescription = computed(() => this.seoDescription()?.trim() ?? '');

  previewMessage(key: string): string {
    this.bundleVersion();
    return this.i18n.translateForLanguage(this.language(), key);
  }
}
