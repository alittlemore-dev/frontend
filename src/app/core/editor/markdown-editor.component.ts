import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import {
  MarkdownEditorComponent as DesignSystemMarkdownEditorComponent,
  type MarkdownEditorImageConfig,
  type MarkdownEditorWikiLinkConfig,
} from '@alittlemore.dev/design-system/markdown-editor';
import { map } from 'rxjs';
import { LanguageCode } from '../i18n/i18n.model';
import { I18nService } from '../i18n/i18n.service';
import { WikiLinkTargetsService } from '../wiki-links/wiki-link-targets.service';
import { applicationWikiLinks } from '../wiki-links/wiki-links';
import { EditorImageUploadService } from './editor-image-upload.service';
import { markdownEditorLabels } from './markdown-editor.labels';

@Component({
  selector: 'app-markdown-editor',
  standalone: true,
  imports: [DesignSystemMarkdownEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ds-markdown-editor
      [value]="value()"
      [attr.lang]="language()"
      [imageInteractionsDisabled]="false"
      [accessibleLabel]="accessibleLabel()"
      [labels]="labels()"
      [imageConfig]="imageConfig()"
      [wikiLinks]="wikiLinks()"
      (valueChange)="valueChange.emit($event)"
    />
  `,
})
export class MarkdownEditorComponent {
  private readonly i18n = inject(I18nService);
  private readonly imageUpload = inject(EditorImageUploadService);
  private readonly targets = inject(WikiLinkTargetsService);
  private readonly editor = viewChild(DesignSystemMarkdownEditorComponent);

  readonly value = input.required<string>();
  readonly language = input.required<LanguageCode>();
  readonly accessibleLabel = input.required<string>();
  readonly imageUploadsEnabled = input.required<boolean>();
  readonly valueChange = output<string>();

  protected readonly labels = computed(() => markdownEditorLabels(this.i18n));
  protected readonly imageConfig = computed<MarkdownEditorImageConfig>(() => ({
    upload: this.imageUploadsEnabled()
      ? {
          sources: ['picker', 'paste', 'drop'],
          acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
          upload: (file) =>
            this.imageUpload.uploadEditorImage(file).pipe(map((source) => ({ source }))),
        }
      : null,
    preview: { kind: 'direct' },
  }));
  protected readonly wikiLinks = computed<MarkdownEditorWikiLinkConfig>(() => {
    const language = this.language();
    const config = applicationWikiLinks(language);
    const statusLabels = {
      Draft: this.i18n.translate('enum.publishStatus.Draft'),
      Published: this.i18n.translate('enum.publishStatus.Published'),
    };
    return {
      ...config,
      namespaces: config.namespaces.map((namespace) => ({
        ...namespace,
        label: this.i18n.translate(
          namespace.key === 'articles' ? 'shell.nav.articles' : 'shell.nav.matrix',
        ),
      })),
      loadTargets: () =>
        this.targets.getTargets(language).pipe(
          map((registry) =>
            registry.groups.map((group) => ({
              namespace: group.type,
              targets: group.items.map((item) => ({
                key: item.slug,
                label: item.title,
                description: null,
                badge: statusLabels[item.publishStatus],
              })),
            })),
          ),
        ),
    };
  });

  focus(): void {
    this.editor()?.focus();
  }
}
