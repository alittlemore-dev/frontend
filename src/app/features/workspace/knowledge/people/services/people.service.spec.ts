import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PeopleService } from './people.service';
import { ApiClient } from '../../../../../core/http/api-client.service';
import { PersonDetail } from '../models/people.model';

const PERSON: PersonDetail = {
  id: 'person-1',
  displayName: 'Иванов Иван',
  lastName: 'Иванов',
  firstName: 'Иван',
  middleName: '',
  email: '',
  phone: '',
  telegram: '@ivanov',
  birthday: null,
  description: '',
  tags: [],
  relationships: [],
  relatedDates: [],
  photo: null,
  attachments: [],
  createdAt: '2026-01-01T00:00:00+00:00',
  updatedAt: '2026-01-01T00:00:00+00:00',
};

describe('PeopleService', () => {
  let service: PeopleService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ApiClient, PeopleService],
    });
    service = TestBed.inject(PeopleService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists people with repeated AND tag filters and maps Telegram', () => {
    let telegram = '';
    service
      .listPeople({
        page: 2,
        pageSize: 50,
        sort: 'nameAsc',
        searchQuery: ' Иван ',
        tagIds: ['tag-1', 'tag-2'],
      })
      .subscribe((page) => {
        telegram = page.people[0]?.telegram ?? '';
      });

    const request = httpMock.expectOne((value) =>
      value.url.endsWith('/api/personal-workspace/knowledge/people'),
    );
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('pageSize')).toBe('50');
    expect(request.request.params.get('sort')).toBe('nameAsc');
    expect(request.request.params.get('searchQuery')).toBe('Иван');
    expect(request.request.params.getAll('tagIds')).toEqual(['tag-1', 'tag-2']);
    request.flush({ totalCount: 1, totalPages: 1, people: [PERSON] });
    expect(telegram).toBe('@ivanov');
  });

  it('quick-creates and updates a person using explicit relationship commands', () => {
    service.createPerson({ firstName: 'Иван', lastName: 'Иванов' }).subscribe();
    const create = httpMock.expectOne((value) =>
      value.url.endsWith('/api/personal-workspace/knowledge/people'),
    );
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({ firstName: 'Иван', lastName: 'Иванов' });
    create.flush(PERSON);

    service
      .updatePerson('person-1', {
        lastName: 'Иванов',
        firstName: 'Иван',
        middleName: '',
        email: '',
        phone: '',
        telegram: '@new_ivanov',
        birthday: null,
        description: '',
        tagIds: [],
        relationshipChanges: { create: [], update: [], deleteIds: [] },
      })
      .subscribe();
    const update = httpMock.expectOne((value) =>
      value.url.endsWith('/api/personal-workspace/knowledge/people/person-1'),
    );
    expect(update.request.method).toBe('PUT');
    expect(update.request.body.relationshipChanges).toEqual({
      create: [],
      update: [],
      deleteIds: [],
    });
    expect(update.request.body.telegram).toBe('@new_ivanov');
    update.flush(PERSON);
  });

  it('uses protected endpoints for photo, attachment, and file content', () => {
    const photo = new File(['photo'], 'photo.png', { type: 'image/png' });
    service.replacePhoto('person-1', photo).subscribe();
    const photoRequest = httpMock.expectOne((value) =>
      value.url.endsWith('/api/personal-workspace/knowledge/people/person-1/photo'),
    );
    expect(photoRequest.request.method).toBe('PUT');
    expect(photoRequest.request.body).toBeInstanceOf(FormData);
    photoRequest.flush({ id: 'photo-1' });

    service.getFileContent('photo-1').subscribe();
    const contentRequest = httpMock.expectOne((value) =>
      value.url.endsWith('/api/personal-workspace/knowledge/files/photo-1/content'),
    );
    expect(contentRequest.request.responseType).toBe('blob');
    contentRequest.flush(new Blob(['photo']));
  });
});
