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
} from '@alittlemore.dev/design-system/markdown-editor';
import { Observable, map } from 'rxjs';
import { LanguageCode } from '../i18n/i18n.model';
import { I18nService } from '../i18n/i18n.service';
import { markdownEditorLabels } from './markdown-editor.labels';

export interface MarkdownEditorImageUploadResult {
  markdownUrl: string;
}

export interface MarkdownEditorImageCapability {
  acceptedMimeTypes: readonly string[];
  upload(file: File): Observable<MarkdownEditorImageUploadResult>;
  loadPreview(markdownUrl: string): Observable<Blob>;
}

@Component({
  selector: 'app-markdown-editor',
  standalone: true,
  imports: [DesignSystemMarkdownEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ds-markdown-editor
      [value]="value()"
      [attr.lang]="language()"
      [imageInteractionsDisabled]="uploadInteractionsDisabled()"
      [accessibleLabel]="accessibleLabel()"
      [labels]="labels()"
      [imageConfig]="imageConfig()"
      [wikiLinks]="null"
      (valueChange)="valueChange.emit($event)"
      (imageUploadPendingChange)="imageUploadPendingChange.emit($event)"
    />
  `,
})
export class MarkdownEditorComponent {
  private readonly i18n = inject(I18nService);
  private readonly editor = viewChild(DesignSystemMarkdownEditorComponent);
  readonly value = input.required<string>();
  readonly language = input.required<LanguageCode>();
  readonly accessibleLabel = input.required<string>();
  readonly imageCapability = input.required<MarkdownEditorImageCapability | null>();
  readonly uploadInteractionsDisabled = input.required<boolean>();
  readonly imagePreviewRevision = input.required<number>();
  readonly valueChange = output<string>();
  readonly imageUploadPendingChange = output<boolean>();
  protected readonly labels = computed(() => markdownEditorLabels(this.i18n));
  protected readonly imageConfig = computed<MarkdownEditorImageConfig | null>(() => {
    const capability = this.imageCapability();
    if (capability === null) return null;
    return {
      upload: {
        sources: ['picker', 'paste', 'drop'],
        acceptedMimeTypes: capability.acceptedMimeTypes,
        upload: (file) =>
          capability.upload(file).pipe(map(({ markdownUrl }) => ({ source: markdownUrl }))),
      },
      preview: {
        kind: 'blob',
        revision: this.imagePreviewRevision(),
        load: (source) => capability.loadPreview(source),
      },
    };
  });

  focus(): void {
    this.editor()?.focus();
  }
}
