import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiClient } from '../http/api-client.service';
import { EditorImageUploadService } from './editor-image-upload.service';

describe('EditorImageUploadService', () => {
  let service: EditorImageUploadService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        EditorImageUploadService,
        ApiClient,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(EditorImageUploadService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('uploads the blob as an article content image and returns markdownUrl', () => {
    let result: string | undefined;
    const blob = new Blob(['image'], { type: 'image/png' });

    service.uploadEditorImage(blob).subscribe((markdownUrl) => {
      result = markdownUrl;
    });

    const uploadReq = httpMock.expectOne((r) => r.url.endsWith('/api/admin/files'));
    const body = uploadReq.request.body;
    expect(uploadReq.request.method).toBe('POST');
    expect(body).toBeInstanceOf(FormData);
    if (!(body instanceof FormData)) {
      throw new Error('Expected FormData body');
    }
    const uploadedFile = body.get('file');
    expect(body.get('purpose')).toBe('articleContentImage');
    expect(body.get('name')).toBe('Editor image');
    expect(uploadedFile).toBeInstanceOf(File);
    if (!(uploadedFile instanceof File)) {
      throw new Error('Expected file part');
    }
    expect(uploadedFile.name).toBe('editor-image.png');
    expect(uploadedFile.type).toBe('image/png');
    expect(uploadedFile.size).toBe(blob.size);
    uploadReq.flush({
      id: 'image-file-id',
      purpose: 'articleContentImage',
      namespace: 'media',
      relativePath: 'article-content-images/image.png',
      mimeType: 'image/png',
      sizeBytes: 5,
      name: 'Editor image',
      originalName: 'editor-image.png',
      createdAt: '2026-07-03T10:00:00+00:00',
      updatedAt: '2026-07-03T10:00:00+00:00',
      accessUrl: 'https://cdn.example.com/image.png',
      markdownUrl: 'https://cdn.example.com/image.png#fileId=image-file-id',
    });

    expect(result).toBe('https://cdn.example.com/image.png#fileId=image-file-id');
  });
});
