import { NotificationService } from '@alittlemore.dev/design-system';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { convertToParamMap, ActivatedRoute, Router, provideRouter } from '@angular/router';
import { Observable, of, Subject } from 'rxjs';
import { provideI18nTesting } from '../../../../../../testing/i18n-testing';

import { PeoplePage, PersonDetail } from '../../models/people.model';
import { PeopleService } from '../../services/people.service';
import { PeopleListComponent } from './people-list.component';

const EMPTY_PAGE: PeoplePage = { totalCount: 0, totalPages: 2, people: [] };
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

describe('PeopleListComponent', () => {
  let fixture: ComponentFixture<PeopleListComponent>;
  let peopleResponse: Observable<PeoplePage>;
  let peopleService: {
    listPeople: jest.Mock;
    listTags: jest.Mock;
    createPerson: jest.Mock;
    deletePerson: jest.Mock;
    getFileContent: jest.Mock;
    createTag: jest.Mock;
    updateTag: jest.Mock;
    deleteTag: jest.Mock;
  };
  let notifications: { success: jest.Mock; error: jest.Mock };
  let router: Router;

  beforeEach(async () => {
    peopleResponse = of(EMPTY_PAGE);
    peopleService = {
      listPeople: jest.fn(() => peopleResponse),
      listTags: jest.fn().mockReturnValue(of([])),
      createPerson: jest.fn().mockReturnValue(of(PERSON)),
      deletePerson: jest.fn().mockReturnValue(of(void 0)),
      getFileContent: jest.fn().mockReturnValue(of(new Blob(['photo']))),
      createTag: jest.fn(),
      updateTag: jest.fn(),
      deleteTag: jest.fn(),
    };
    notifications = { success: jest.fn(), error: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [PeopleListComponent],
      providers: [
        provideRouter([]),
        provideI18nTesting({
          'shared.notSet': 'Не задано',
          'knowledgePeople.empty': 'Люди не найдены.',
          'knowledgePeople.validationError': 'Исправьте поля.',
        }),
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(
              convertToParamMap({
                q: 'Иван',
                page: '2',
                pageSize: '50',
                sort: 'nameAsc',
                tagIds: ['tag-1', 'tag-2'],
              }),
            ),
          },
        },
        { provide: PeopleService, useValue: peopleService },
        { provide: NotificationService, useValue: notifications },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
  });

  afterEach(() => fixture?.destroy());

  it('restores URL filters and renders the empty state', () => {
    fixture = TestBed.createComponent(PeopleListComponent);
    fixture.detectChanges();

    expect(peopleService.listPeople).toHaveBeenCalledWith({
      page: 2,
      pageSize: 50,
      sort: 'nameAsc',
      searchQuery: 'Иван',
      tagIds: ['tag-1', 'tag-2'],
    });
    expect(fixture.nativeElement.textContent).toContain('Люди не найдены.');
  });

  it('shows loading and then populated content', () => {
    const response = new Subject<PeoplePage>();
    peopleResponse = response;
    fixture = TestBed.createComponent(PeopleListComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('ds-loading-spinner')).not.toBeNull();

    response.next({
      totalCount: 1,
      totalPages: 2,
      people: [{ ...PERSON, tags: [], photo: null }],
    });
    response.complete();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Иванов Иван');
  });

  it('shows Telegram and routes or deletes through the row actions dropdown', () => {
    const deleteResponse = new Subject<void>();
    const navigate = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    peopleService.deletePerson.mockReturnValue(deleteResponse);
    peopleResponse = of({
      totalCount: 1,
      totalPages: 2,
      people: [PERSON],
    });
    fixture = TestBed.createComponent(PeopleListComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('@ivanov');
    const editAction = fixture.nativeElement.querySelector(
      '[data-testid="people-actions-person-1-edit"]',
    ) as HTMLButtonElement | null;
    expect(editAction).not.toBeNull();
    editAction?.click();
    expect(navigate).toHaveBeenCalledWith(['/personal-workspace/knowledge/people', 'person-1'], {
      queryParamsHandling: 'preserve',
    });

    const deleteAction = fixture.nativeElement.querySelector(
      '[data-testid="people-actions-person-1-delete"]',
    ) as HTMLButtonElement | null;
    expect(deleteAction).not.toBeNull();
    deleteAction?.click();
    fixture.detectChanges();
    expect(peopleService.deletePerson).toHaveBeenCalledWith('person-1');
    expect(
      fixture.nativeElement.querySelector('[data-testid="people-actions-person-1-delete"]'),
    ).toBeNull();

    deleteResponse.error(new Error('delete failed'));
    fixture.detectChanges();
    expect(notifications.error).toHaveBeenCalled();
    expect(
      fixture.nativeElement.querySelector('[data-testid="people-actions-person-1-delete"]'),
    ).not.toBeNull();
  });

  it('shows only populated contacts without per-field placeholders', () => {
    peopleResponse = of({
      totalCount: 1,
      totalPages: 2,
      people: [
        {
          ...PERSON,
          email: 'ivan@example.com',
          phone: '',
          telegram: '@ivanov',
        },
      ],
    });
    fixture = TestBed.createComponent(PeopleListComponent);
    fixture.detectChanges();

    const contacts = fixture.nativeElement.querySelector(
      '[data-testid="people-contacts-person-1"]',
    ) as HTMLElement | null;

    expect(contacts?.textContent).toContain('ivan@example.com');
    expect(contacts?.textContent).toContain('@ivanov');
    expect(contacts?.textContent).not.toContain('Не задано');
  });

  it('shows one placeholder when every contact is empty', () => {
    peopleResponse = of({
      totalCount: 1,
      totalPages: 2,
      people: [{ ...PERSON, email: '', phone: '', telegram: '' }],
    });
    fixture = TestBed.createComponent(PeopleListComponent);
    fixture.detectChanges();

    const contacts = fixture.nativeElement.querySelector(
      '[data-testid="people-contacts-person-1"]',
    ) as HTMLElement | null;
    const placeholders = contacts?.textContent?.match(/Не задано/g) ?? [];

    expect(placeholders).toHaveLength(1);
  });

  it('keeps the latest page when an older request succeeds later', () => {
    const olderResponse = new Subject<PeoplePage>();
    const latestResponse = new Subject<PeoplePage>();
    peopleService.listPeople.mockReturnValueOnce(olderResponse).mockReturnValueOnce(latestResponse);
    fixture = TestBed.createComponent(PeopleListComponent);
    fixture.detectChanges();

    fixture.componentInstance.loadPeople();
    latestResponse.next({
      totalCount: 1,
      totalPages: 2,
      people: [{ ...PERSON, id: 'latest-person', displayName: 'Latest Person' }],
    });
    olderResponse.next({
      totalCount: 1,
      totalPages: 2,
      people: [
        {
          ...PERSON,
          id: 'older-person',
          displayName: 'Older Person',
          photo: {
            id: 'older-photo',
            itemId: 'older-person',
            kind: 'personPhoto',
            processing: 'normalizedRasterImage',
            mimeType: 'image/webp',
            sizeBytes: 10,
            name: 'older.webp',
            originalName: 'older.webp',
            contentPath: '/api/knowledge/files/older-photo/content',
            createdAt: PERSON.createdAt,
            updatedAt: PERSON.updatedAt,
          },
        },
      ],
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Latest Person');
    expect(fixture.nativeElement.textContent).not.toContain('Older Person');
    expect(peopleService.getFileContent).not.toHaveBeenCalled();
  });

  it('keeps loading without notifying when an older request fails', () => {
    const olderResponse = new Subject<PeoplePage>();
    const latestResponse = new Subject<PeoplePage>();
    peopleService.listPeople.mockReturnValueOnce(olderResponse).mockReturnValueOnce(latestResponse);
    fixture = TestBed.createComponent(PeopleListComponent);
    fixture.detectChanges();

    fixture.componentInstance.loadPeople();
    olderResponse.error(new Error('stale request'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('ds-loading-spinner')).not.toBeNull();
    expect(notifications.error).not.toHaveBeenCalled();

    latestResponse.next({
      totalCount: 1,
      totalPages: 2,
      people: [{ ...PERSON, id: 'latest-person', displayName: 'Latest Person' }],
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Latest Person');
  });

  it('blocks invalid quick create and navigates to a valid created person', () => {
    fixture = TestBed.createComponent(PeopleListComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const navigate = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    component.openCreateDialog();
    component.createPerson();
    expect(notifications.error).toHaveBeenCalled();
    expect(peopleService.createPerson).not.toHaveBeenCalled();

    component.createForm.setValue({ firstName: ' Иван ', lastName: ' Иванов ' });
    component.createPerson();

    expect(peopleService.createPerson).toHaveBeenCalledWith({
      firstName: 'Иван',
      lastName: 'Иванов',
    });
    expect(navigate).toHaveBeenCalledWith(['/personal-workspace/knowledge/people', 'person-1'], {
      queryParamsHandling: 'preserve',
    });
  });

  it('creates and revokes protected photo object URLs', () => {
    const createObjectURL = jest.fn().mockReturnValue('blob:private-photo');
    const revokeObjectURL = jest.fn();
    Object.defineProperty(window.URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    });
    peopleResponse = of({
      totalCount: 1,
      totalPages: 2,
      people: [
        {
          ...PERSON,
          tags: [],
          photo: {
            id: 'photo-1',
            itemId: 'person-1',
            kind: 'personPhoto',
            processing: 'normalizedRasterImage',
            mimeType: 'image/webp',
            sizeBytes: 10,
            name: 'photo.webp',
            originalName: 'photo.webp',
            contentPath: '/api/knowledge/files/photo-1/content',
            createdAt: PERSON.createdAt,
            updatedAt: PERSON.updatedAt,
          },
        },
      ],
    });

    fixture = TestBed.createComponent(PeopleListComponent);
    fixture.detectChanges();
    expect(peopleService.getFileContent).toHaveBeenCalledWith('photo-1');
    expect(createObjectURL).toHaveBeenCalled();

    fixture.destroy();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:private-photo');
  });
});
