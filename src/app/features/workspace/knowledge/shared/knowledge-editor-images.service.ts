import { Injectable, inject } from '@angular/core';
import { Observable, map, throwError } from 'rxjs';
import {
  MarkdownEditorImageCapability,
  MarkdownEditorImageUploadResult,
} from '../../../../core/editor/workspace-markdown-editor.component';
import { ApiClient } from '../../../../core/http/api-client.service';
import { KnowledgeFile } from './knowledge-file.model';

const KNOWLEDGE_EDITOR_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export interface KnowledgeEditorImageBinding {
  itemId: string;
  attachments: () => readonly KnowledgeFile[];
  uploaded: (file: KnowledgeFile) => void;
}

@Injectable({ providedIn: 'root' })
export class KnowledgeEditorImagesService {
  private readonly api = inject(ApiClient);

  bind(binding: KnowledgeEditorImageBinding): MarkdownEditorImageCapability {
    return {
      acceptedMimeTypes: KNOWLEDGE_EDITOR_IMAGE_MIME_TYPES,
      upload: (file) => this.upload(binding, file),
      loadPreview: (markdownUrl) => this.loadPreview(binding, markdownUrl),
    };
  }

  private upload(
    binding: KnowledgeEditorImageBinding,
    file: File,
  ): Observable<MarkdownEditorImageUploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    return this.api
      .post<KnowledgeFile>(
        `/api/personal-workspace/knowledge/items/${binding.itemId}/editor-images`,
        formData,
      )
      .pipe(
        map((uploaded) => {
          if (!isBoundNormalizedImage(uploaded, binding.itemId)) {
            throw new Error('Knowledge editor image response metadata is invalid');
          }
          binding.uploaded(uploaded);
          return { markdownUrl: markdownUrl(uploaded) };
        }),
      );
  }

  private loadPreview(binding: KnowledgeEditorImageBinding, source: string): Observable<Blob> {
    const attachment = binding
      .attachments()
      .find((file) => isBoundNormalizedImage(file, binding.itemId) && markdownUrl(file) === source);
    if (attachment === undefined) {
      return throwError(() => new Error('Knowledge editor image source is not a bound attachment'));
    }
    return this.api.getBlob(attachment.contentPath.replace('/api/', '/api/personal-workspace/'));
  }
}

function isBoundNormalizedImage(file: KnowledgeFile, itemId: string): boolean {
  return (
    file.itemId === itemId &&
    file.kind === 'attachment' &&
    file.processing === 'normalizedRasterImage' &&
    file.mimeType === 'image/webp' &&
    file.contentPath === `/api/knowledge/files/${file.id}/content`
  );
}

function markdownUrl(file: KnowledgeFile): string {
  return `${file.contentPath}#fileId=${encodeURIComponent(file.id)}`;
}
