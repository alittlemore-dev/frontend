import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { MediaUploadService } from '../uploads/media-upload.service';

@Injectable({ providedIn: 'root' })
export class EditorImageUploadService {
  private readonly mediaUpload = inject(MediaUploadService);

  uploadEditorImage(blob: Blob): Observable<string> {
    return this.mediaUpload
      .uploadMediaFile({
        file: blob,
        purpose: 'articleContentImage',
        name: 'Editor image',
        fileName: editorImageFileName(blob),
      })
      .pipe(map((file) => file.markdownUrl));
  }
}

function editorImageFileName(blob: Blob): string {
  if (blob.type === 'image/jpeg') return 'editor-image.jpg';
  if (blob.type === 'image/webp') return 'editor-image.webp';
  if (blob.type === 'image/gif') return 'editor-image.gif';
  return 'editor-image.png';
}
