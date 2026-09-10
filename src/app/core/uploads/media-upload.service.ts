import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client.service';

export type FilePurpose = 'articleContentImage' | 'articleCoverImage' | 'attachment';

interface FileResponseDto {
  id: string;
  purpose: FilePurpose;
  namespace: string;
  relativePath: string;
  mimeType: string;
  sizeBytes: number;
  name: string;
  originalName: string;
  createdAt: string;
  updatedAt: string;
  accessUrl: string;
  markdownUrl: string;
}

export type UploadedMediaFile = FileResponseDto;

export interface MediaUploadRequest {
  file: Blob;
  purpose: FilePurpose;
  name: string;
  fileName: string;
}

@Injectable({ providedIn: 'root' })
export class MediaUploadService {
  private readonly api = inject(ApiClient);

  uploadMediaFile(request: MediaUploadRequest): Observable<UploadedMediaFile> {
    const formData = new FormData();
    formData.append('purpose', request.purpose);
    formData.append('name', request.name);
    formData.append('file', request.file, request.fileName);
    return this.api.post<FileResponseDto>('/api/admin/files', formData);
  }

  getMediaFile(fileId: string): Observable<UploadedMediaFile> {
    return this.api.get<FileResponseDto>(`/api/admin/files/${fileId}`);
  }
}
