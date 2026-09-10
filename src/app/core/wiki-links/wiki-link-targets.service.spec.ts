import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiClient } from '../http/api-client.service';
import { WikiLinkTargetsService } from './wiki-link-targets.service';
import { WikiLinkTargetRegistry } from './wiki-links';

describe('WikiLinkTargetsService', () => {
  let service: WikiLinkTargetsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        WikiLinkTargetsService,
        ApiClient,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(WikiLinkTargetsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('loads typed wiki-link targets with explicit language', () => {
    let received: WikiLinkTargetRegistry | undefined;

    service.getTargets('ru').subscribe((registry) => (received = registry));

    const req = httpMock.expectOne((r) => r.url.endsWith('/api/admin/wiki-links/targets'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('language')).toBe('ru');
    req.flush({
      targets: [
        {
          type: 'articles',
          items: [
            {
              slug: 'typed-articles',
              title: 'Типизированные статьи',
              publishStatus: 'Published',
            },
          ],
        },
        {
          type: 'matrix',
          items: [
            {
              slug: 'how-to-write-function',
              title: 'Как написать функцию',
              publishStatus: 'Draft',
            },
          ],
        },
      ],
    });

    expect(received?.groups).toEqual([
      {
        type: 'articles',
        items: [
          {
            slug: 'typed-articles',
            title: 'Типизированные статьи',
            publishStatus: 'Published',
          },
        ],
      },
      {
        type: 'matrix',
        items: [
          {
            slug: 'how-to-write-function',
            title: 'Как написать функцию',
            publishStatus: 'Draft',
          },
        ],
      },
    ]);
    expect(received?.lookup.get('articles')).toEqual(new Set(['typed-articles']));
    expect(received?.lookup.get('matrix')).toEqual(new Set(['how-to-write-function']));
  });

  it('shares one HTTP request between subscribers for the same language', () => {
    const first = jest.fn();
    const second = jest.fn();

    service.getTargets('ru').subscribe(first);
    service.getTargets('ru').subscribe(second);

    const requests = httpMock.match((request) =>
      request.url.endsWith('/api/admin/wiki-links/targets'),
    );
    expect(requests).toHaveLength(1);
    requests[0].flush({ targets: [] });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('caches RU and EN registries separately', () => {
    service.getTargets('ru').subscribe();
    service.getTargets('en').subscribe();
    service.getTargets('ru').subscribe();

    const requests = httpMock.match((request) =>
      request.url.endsWith('/api/admin/wiki-links/targets'),
    );
    expect(requests).toHaveLength(2);
    expect(requests.map((request) => request.request.params.get('language'))).toEqual(['ru', 'en']);
    for (const request of requests) {
      request.flush({ targets: [] });
    }
  });
});
