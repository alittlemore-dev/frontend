import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiClient } from '../../../../../core/http/api-client.service';
import { KnowledgeDateDetail } from '../models/dates.model';
import { KnowledgeDatesService } from './dates.service';

const DATE: KnowledgeDateDetail = {
  id: 'date-1',
  displayName: 'Годовщина',
  date: { day: 29, month: 2, year: null },
  description: '',
  relatedPeople: [{ id: 'person-1', displayName: 'Иван Иванов' }],
  tags: [],
  attachments: [],
  createdAt: '2026-01-01T00:00:00+00:00',
  updatedAt: '2026-01-01T00:00:00+00:00',
};

describe('KnowledgeDatesService', () => {
  let service: KnowledgeDatesService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ApiClient,
        KnowledgeDatesService,
      ],
    });
    service = TestBed.inject(KnowledgeDatesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('maps URL-backed list filters and clones nested response data', () => {
    let responseDate = DATE.date;
    service
      .listDates({
        page: 2,
        pageSize: 50,
        sort: 'dateDesc',
        searchQuery: ' годов ',
        tagIds: ['tag-1', 'tag-2'],
        relatedPersonId: 'person-1',
      })
      .subscribe((page) => {
        responseDate = page.dates[0]!.date;
      });

    const request = httpMock.expectOne((value) =>
      value.url.endsWith('/api/personal-workspace/knowledge/dates'),
    );
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('pageSize')).toBe('50');
    expect(request.request.params.get('sort')).toBe('dateDesc');
    expect(request.request.params.get('searchQuery')).toBe('годов');
    expect(request.request.params.getAll('tagIds')).toEqual(['tag-1', 'tag-2']);
    expect(request.request.params.get('relatedPersonId')).toBe('person-1');
    request.flush({ totalCount: 1, totalPages: 1, dates: [DATE] });
    expect(responseDate).toEqual({ day: 29, month: 2, year: null });
    expect(responseDate).not.toBe(DATE.date);
  });

  it('uses the Dates CRUD contract and generic private attachment endpoints', () => {
    service
      .createDate({
        displayName: 'Годовщина',
        date: { day: 29, month: 2, year: null },
      })
      .subscribe();
    const create = httpMock.expectOne((value) =>
      value.url.endsWith('/api/personal-workspace/knowledge/dates'),
    );
    expect(create.request.method).toBe('POST');
    create.flush(DATE);

    service
      .updateDate('date-1', {
        displayName: 'Годовщина',
        date: { day: 29, month: 2, year: null },
        description: 'Описание',
        tagIds: ['tag-1'],
        personIds: ['person-1'],
      })
      .subscribe();
    const update = httpMock.expectOne((value) =>
      value.url.endsWith('/api/personal-workspace/knowledge/dates/date-1'),
    );
    expect(update.request.method).toBe('PUT');
    expect(update.request.body.personIds).toEqual(['person-1']);
    update.flush(DATE);

    service.getFileContent('file-1').subscribe();
    const content = httpMock.expectOne((value) =>
      value.url.endsWith('/api/personal-workspace/knowledge/files/file-1/content'),
    );
    expect(content.request.responseType).toBe('blob');
    content.flush(new Blob(['private']));
  });
});
