import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiClient } from '../../../core/http/api-client.service';
import { ImportantInfoService } from './important-info.service';

describe('ImportantInfoService', () => {
  let service: ImportantInfoService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ApiClient, ImportantInfoService],
    });
    service = TestBed.inject(ImportantInfoService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('reads ordered items and writes text and order through the contract', () => {
    service.list().subscribe((items) => expect(items.map((item) => item.id)).toEqual(['a', 'b']));
    http
      .expectOne((request) => request.url.endsWith('/api/personal-workspace/important-info'))
      .flush({
        items: [
          { id: 'b', text: 'B', position: 2 },
          { id: 'a', text: 'A', position: 1 },
        ],
      });

    service.create('New').subscribe();
    const create = http.expectOne((request) =>
      request.url.endsWith('/api/personal-workspace/important-info'),
    );
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({ text: 'New' });
    create.flush({ id: 'c', text: 'New', position: 3 });

    service.update('a', 'Updated').subscribe();
    const update = http.expectOne((request) =>
      request.url.endsWith('/api/personal-workspace/important-info/a'),
    );
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual({ text: 'Updated' });
    update.flush({ id: 'a', text: 'Updated', position: 1 });

    service
      .reorder(['b', 'a'])
      .subscribe((items) => expect(items.map((item) => item.id)).toEqual(['b', 'a']));
    const order = http.expectOne((request) =>
      request.url.endsWith('/api/personal-workspace/important-info/order'),
    );
    expect(order.request.method).toBe('PUT');
    expect(order.request.body).toEqual({ ids: ['b', 'a'] });
    order.flush({
      items: [
        { id: 'a', text: 'A', position: 2 },
        { id: 'b', text: 'B', position: 1 },
      ],
    });

    service.delete('a').subscribe();
    const remove = http.expectOne((request) =>
      request.url.endsWith('/api/personal-workspace/important-info/a'),
    );
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null);
  });
});
