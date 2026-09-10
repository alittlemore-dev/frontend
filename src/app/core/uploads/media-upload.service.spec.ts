import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ApiClient } from '../http/api-client.service';
import { MediaUploadService } from './media-upload.service';

describe('MediaUploadService', () => {
  let service: MediaUploadService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MediaUploadService, ApiClient, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(MediaUploadService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('uploads a file through backend multipart endpoint', () => {
    let fileId: string | undefined;
    const file = new File(['image'], 'cover.png', { type: 'image/png' });

    service
      .uploadMediaFile({
        file,
        purpose: 'articleCoverImage',
        name: 'Cover',
        fileName: file.name,
      })
      .subscribe((uploadedFile) => {
        fileId = uploadedFile.id;
      });

    const uploadReq = httpMock.expectOne((request) => request.url.endsWith('/api/admin/files'));
    const body = uploadReq.request.body;
    expect(uploadReq.request.method).toBe('POST');
    expect(body).toBeInstanceOf(FormData);
    if (!(body instanceof FormData)) {
      throw new Error('Expected FormData body');
    }
    const uploadedFile = body.get('file');
    expect(body.get('purpose')).toBe('articleCoverImage');
    expect(body.get('name')).toBe('Cover');
    expect(uploadedFile).toBeInstanceOf(File);
    if (!(uploadedFile instanceof File)) {
      throw new Error('Expected file part');
    }
    expect(uploadedFile.name).toBe('cover.png');
    expect(uploadedFile.type).toBe('image/png');
    expect(uploadedFile.size).toBe(file.size);
    uploadReq.flush({
      id: 'file-1',
      purpose: 'articleCoverImage',
      namespace: 'media',
      relativePath: 'article-cover-images/file.png',
      mimeType: 'image/png',
      sizeBytes: 5,
      name: 'Cover',
      originalName: 'cover.png',
      createdAt: '2026-07-03T10:00:00+00:00',
      updatedAt: '2026-07-03T10:00:00+00:00',
      accessUrl: 'https://cdn.example.com/file.png',
      markdownUrl: 'https://cdn.example.com/file.png#fileId=file-1',
    });

    expect(fileId).toBe('file-1');
  });

  it('loads managed file metadata by id', () => {
    let accessUrl: string | undefined;

    service.getMediaFile('file-1').subscribe((file) => {
      accessUrl = file.accessUrl;
    });

    const detailReq = httpMock.expectOne((request) =>
      request.url.endsWith('/api/admin/files/file-1'),
    );
    expect(detailReq.request.method).toBe('GET');
    detailReq.flush({
      id: 'file-1',
      purpose: 'articleCoverImage',
      namespace: 'media',
      relativePath: 'article-cover-images/file.png',
      mimeType: 'image/png',
      sizeBytes: 5,
      name: 'Cover',
      originalName: 'cover.png',
      createdAt: '2026-07-03T10:00:00+00:00',
      updatedAt: '2026-07-03T10:00:00+00:00',
      accessUrl: 'https://cdn.example.com/file.png',
      markdownUrl: 'https://cdn.example.com/file.png#fileId=file-1',
    });

    expect(accessUrl).toBe('https://cdn.example.com/file.png');
  });
});
