import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiClient } from '../../../../core/http/api-client.service';
import { KnowledgeFile } from './knowledge-file.model';
import { KnowledgeEditorImagesService } from './knowledge-editor-images.service';

const ITEM_ID = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const FILE_ID = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const CONTENT_PATH = `/api/knowledge/files/${FILE_ID}/content`;
const MARKDOWN_URL = `${CONTENT_PATH}#fileId=${FILE_ID}`;
const EDITOR_IMAGE: KnowledgeFile = {
  id: FILE_ID,
  itemId: ITEM_ID,
  kind: 'attachment',
  processing: 'normalizedRasterImage',
  mimeType: 'image/webp',
  sizeBytes: 128,
  name: 'diagram.png',
  originalName: 'diagram.png',
  contentPath: CONTENT_PATH,
  createdAt: '2026-01-01T00:00:00+00:00',
  updatedAt: '2026-01-01T00:00:00+00:00',
};

describe('KnowledgeEditorImagesService', () => {
  let service: KnowledgeEditorImagesService;
  let httpMock: HttpTestingController;
  let attachments: KnowledgeFile[];
  let uploaded: jest.Mock;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ApiClient,
        KnowledgeEditorImagesService,
      ],
    });
    service = TestBed.inject(KnowledgeEditorImagesService);
    httpMock = TestBed.inject(HttpTestingController);
    attachments = [];
    uploaded = jest.fn((file: KnowledgeFile) => attachments.push(file));
  });

  afterEach(() => httpMock.verify());

  it('binds multipart uploads to the item endpoint and returns a protected stable Markdown URL', () => {
    const file = new File(['png'], 'diagram.png', { type: 'image/png' });
    const capability = service.bind({
      itemId: ITEM_ID,
      attachments: () => attachments,
      uploaded,
    });
    let markdownUrl = '';
    const completionOrder: string[] = [];
    uploaded.mockImplementation((value: KnowledgeFile) => {
      attachments.push(value);
      completionOrder.push('attachment');
    });

    capability.upload(file).subscribe((result) => {
      markdownUrl = result.markdownUrl;
      completionOrder.push('markdown');
    });

    const request = httpMock.expectOne((value) =>
      value.url.endsWith(`/api/personal-workspace/knowledge/items/${ITEM_ID}/editor-images`),
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeInstanceOf(FormData);
    expect((request.request.body as FormData).get('file')).toBe(file);
    expect([...(request.request.body as FormData).keys()]).toEqual(['file']);
    request.flush(EDITOR_IMAGE);

    expect(capability.acceptedMimeTypes).toEqual(['image/jpeg', 'image/png', 'image/webp']);
    expect(markdownUrl).toBe(MARKDOWN_URL);
    expect(attachments).toEqual([EDITOR_IMAGE]);
    expect(completionOrder).toEqual(['attachment', 'markdown']);
  });

  it('loads only persisted normalized item images through the protected Blob endpoint', () => {
    attachments = [EDITOR_IMAGE];
    const capability = service.bind({
      itemId: ITEM_ID,
      attachments: () => attachments,
      uploaded,
    });
    let response: Blob | null = null;

    capability.loadPreview(MARKDOWN_URL).subscribe((blob) => {
      response = blob;
    });

    const request = httpMock.expectOne((value) =>
      value.url.endsWith(CONTENT_PATH.replace('/api/', '/api/personal-workspace/')),
    );
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['private'], { type: 'image/webp' }));
    expect(response).toBeInstanceOf(Blob);

    let error: unknown = null;
    capability.loadPreview('https://public.example/image.png').subscribe({
      error: (value: unknown) => {
        error = value;
      },
    });
    expect(error).toBeInstanceOf(Error);
    httpMock.expectNone((value) => value.url.includes('public.example'));
  });

  it.each([
    ['foreign item', { itemId: 'cccccccccccccccccccccccccccccccc' }],
    ['photo kind', { kind: 'personPhoto' as const }],
    ['raw processing', { processing: 'raw' as const }],
    ['non-normalized MIME type', { mimeType: 'image/png' }],
    [
      'mismatched file path',
      { contentPath: '/api/knowledge/files/cccccccccccccccccccccccccccccccc/content' },
    ],
  ])('rejects %s upload metadata', (_name, overrides: Partial<KnowledgeFile>) => {
    const capability = service.bind({
      itemId: ITEM_ID,
      attachments: () => attachments,
      uploaded,
    });
    let error: unknown = null;
    capability.upload(new File(['png'], 'diagram.png', { type: 'image/png' })).subscribe({
      error: (value: unknown) => {
        error = value;
      },
    });
    const request = httpMock.expectOne((value) =>
      value.url.endsWith(`/api/personal-workspace/knowledge/items/${ITEM_ID}/editor-images`),
    );
    request.flush({ ...EDITOR_IMAGE, ...overrides });

    expect(error).toBeInstanceOf(Error);
    expect(uploaded).not.toHaveBeenCalled();
  });

  it.each([
    [
      'mismatched stable fragment',
      [EDITOR_IMAGE],
      `${CONTENT_PATH}#fileId=cccccccccccccccccccccccccccccccc`,
    ],
    [
      'foreign item metadata',
      [{ ...EDITOR_IMAGE, itemId: 'cccccccccccccccccccccccccccccccc' }],
      MARKDOWN_URL,
    ],
    ['raw attachment metadata', [{ ...EDITOR_IMAGE, processing: 'raw' as const }], MARKDOWN_URL],
  ])(
    'rejects preview source with %s',
    (_name, boundAttachments: readonly KnowledgeFile[], source: string) => {
      attachments = [...boundAttachments];
      const capability = service.bind({
        itemId: ITEM_ID,
        attachments: () => attachments,
        uploaded,
      });
      let error: unknown = null;

      capability.loadPreview(source).subscribe({
        error: (value: unknown) => {
          error = value;
        },
      });

      expect(error).toBeInstanceOf(Error);
      httpMock.expectNone((value) =>
        value.url.endsWith(CONTENT_PATH.replace('/api/', '/api/personal-workspace/')),
      );
    },
  );
});
