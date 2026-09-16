import { TestBed } from '@angular/core/testing';
import { HttpContext, HttpContextToken, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiClient } from './api-client.service';

describe('ApiClient', () => {
  let service: ApiClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ApiClient, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ApiClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it.each(['GET', 'POST'])('fetches private binary responses with %s', (method) => {
    const blob = new Blob(['private']);
    let result: Blob | undefined;
    const options = { params: { documentId: 'doc-1' }, headers: { 'X-Test': 'private' } };
    const request =
      method === 'GET'
        ? service.getBlob('/api/personal-workspace/files/1', options)
        : service.postBlob('/api/personal-workspace/export', { id: '1' }, options);
    request.subscribe((value) => (result = value));
    const pending = httpMock.expectOne((req) => req.url.includes('/api/personal-workspace/'));
    expect(pending.request.responseType).toBe('blob');
    expect(pending.request.method).toBe(method);
    expect(pending.request.params.get('documentId')).toBe('doc-1');
    expect(pending.request.headers.get('X-Test')).toBe('private');
    pending.flush(blob);
    expect(result).toBe(blob);
  });

  it('should prepend base URL on GET', () => {
    let result: { id: string } | undefined;
    service.get<{ id: string }>('/api/test').subscribe((r) => (result = r));

    const req = httpMock.expectOne((r) => r.url.endsWith('/api/test'));
    expect(req.request.url).toContain('localhost:8000');
    req.flush({ id: '1' });

    expect(result).toEqual({ id: '1' });
  });

  it('should pass query params on GET', () => {
    service.get<unknown>('/api/test', { search: 'foo' }).subscribe();

    const req = httpMock.expectOne((r) => r.url.endsWith('/api/test'));
    expect(req.request.params.get('search')).toBe('foo');
    req.flush({});
  });

  it('should pass repeated query params on GET', () => {
    service.get<unknown>('/api/test', { articleIds: ['one', 'two'] }).subscribe();

    const req = httpMock.expectOne((r) => r.url.endsWith('/api/test'));
    expect(req.request.params.getAll('articleIds')).toEqual(['one', 'two']);
    req.flush({});
  });

  it('should send POST body', () => {
    service.post<unknown>('/api/test', { name: 'x' }).subscribe();

    const req = httpMock.expectOne((r) => r.url.endsWith('/api/test'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'x' });
    req.flush({});
  });

  it('should pass POST request options', () => {
    const TEST_CONTEXT = new HttpContextToken<boolean>(() => false);

    service
      .post<unknown>(
        '/api/test',
        { name: 'x' },
        {
          headers: { 'X-CSRF-Guard': '1' },
          context: new HttpContext().set(TEST_CONTEXT, true),
          withCredentials: true,
        },
      )
      .subscribe();

    const req = httpMock.expectOne((r) => r.url.endsWith('/api/test'));
    expect(req.request.headers.get('X-CSRF-Guard')).toBe('1');
    expect(req.request.context.get(TEST_CONTEXT)).toBe(true);
    expect(req.request.withCredentials).toBe(true);
    req.flush({});
  });
});
