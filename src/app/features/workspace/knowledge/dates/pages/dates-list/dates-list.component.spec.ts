import { NotificationService } from '@alittlemore.dev/design-system';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, Subject, of } from 'rxjs';

import { provideI18nTesting } from '../../../../../../testing/i18n-testing';
import { PersonDetail } from '../../../people/models/people.model';
import { PeopleService } from '../../../people/services/people.service';
import { KnowledgeDateDetail, KnowledgeDatesPage } from '../../models/dates.model';
import { KnowledgeDatesService } from '../../services/dates.service';
import { DatesListComponent } from './dates-list.component';

const DATE: KnowledgeDateDetail = {
  id: 'date-1',
  displayName: 'Годовщина',
  date: { day: 29, month: 2, year: null },
  description: '',
  relatedPeople: [{ id: 'person-1', displayName: 'Иван Иванов' }],
  tags: [{ id: 'tag-1', name: 'Семья', color: '#ffffff' }],
  attachments: [],
  createdAt: '2026-01-01T00:00:00+00:00',
  updatedAt: '2026-01-02T00:00:00+00:00',
};

const PERSON: PersonDetail = {
  id: 'person-1',
  displayName: 'Иван Иванов',
  lastName: 'Иванов',
  firstName: 'Иван',
  middleName: '',
  email: '',
  phone: '',
  telegram: '',
  birthday: null,
  description: '',
  tags: [],
  relationships: [],
  relatedDates: [],
  photo: null,
  attachments: [],
  createdAt: DATE.createdAt,
  updatedAt: DATE.updatedAt,
};

describe('DatesListComponent', () => {
  let fixture: ComponentFixture<DatesListComponent>;
  let datesResponse: Observable<KnowledgeDatesPage>;
  let datesService: {
    listDates: jest.Mock;
    createDate: jest.Mock;
    deleteDate: jest.Mock;
  };
  let peopleService: {
    listTags: jest.Mock;
    listPeople: jest.Mock;
  };
  let notifications: { success: jest.Mock; error: jest.Mock };
  let router: Router;

  beforeEach(async () => {
    datesResponse = of({ totalCount: 1, totalPages: 3, dates: [DATE] });
    datesService = {
      listDates: jest.fn(() => datesResponse),
      createDate: jest.fn().mockReturnValue(of(DATE)),
      deleteDate: jest.fn().mockReturnValue(of(void 0)),
    };
    peopleService = {
      listTags: jest.fn().mockReturnValue(of(DATE.tags)),
      listPeople: jest.fn().mockReturnValue(of({ totalCount: 1, totalPages: 1, people: [PERSON] })),
    };
    notifications = { success: jest.fn(), error: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [DatesListComponent],
      providers: [
        provideRouter([]),
        provideI18nTesting({
          'knowledgeDates.empty': 'Даты не найдены.',
          'knowledgeDates.validationError': 'Исправьте поля.',
          'shared.notSet': 'Не задано',
        }),
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(
              convertToParamMap({
                q: 'годов',
                page: '2',
                pageSize: '50',
                sort: 'dateDesc',
                tagIds: ['tag-1', 'tag-1'],
                relatedPersonId: 'person-1',
              }),
            ),
          },
        },
        { provide: KnowledgeDatesService, useValue: datesService },
        { provide: PeopleService, useValue: peopleService },
        { provide: NotificationService, useValue: notifications },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
  });

  afterEach(() => fixture?.destroy());

  it('restores URL filters, deduplicates tags, and renders date relationships', () => {
    fixture = TestBed.createComponent(DatesListComponent);
    fixture.detectChanges();

    expect(datesService.listDates).toHaveBeenCalledWith({
      page: 2,
      pageSize: 50,
      sort: 'dateDesc',
      searchQuery: 'годов',
      tagIds: ['tag-1'],
      relatedPersonId: 'person-1',
    });
    expect(fixture.nativeElement.textContent).toContain('Годовщина');
    expect(fixture.nativeElement.textContent).toContain('Иван Иванов');
    expect(fixture.nativeElement.textContent).toContain('Семья');
  });

  it('shows ten related People per Date row until the row is expanded', () => {
    datesResponse = of({
      totalCount: 1,
      totalPages: 3,
      dates: [
        {
          ...DATE,
          relatedPeople: Array.from({ length: 11 }, (_, index) => ({
            id: `person-${index + 1}`,
            displayName: `Человек ${index + 1}`,
          })),
        },
      ],
    });
    fixture = TestBed.createComponent(DatesListComponent);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelectorAll('[data-testid^="dates-related-person-date-1-"]'),
    ).toHaveLength(10);

    const toggle = fixture.nativeElement.querySelector(
      '[data-testid="dates-related-people-toggle-date-1"]',
    ) as HTMLButtonElement;
    toggle.click();
    fixture.detectChanges();

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(
      fixture.nativeElement.querySelectorAll('[data-testid^="dates-related-person-date-1-"]'),
    ).toHaveLength(11);
  });

  it('shows loading, error notification, and retry state', () => {
    const response = new Subject<KnowledgeDatesPage>();
    datesResponse = response;
    fixture = TestBed.createComponent(DatesListComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('ds-loading-spinner')).not.toBeNull();
    response.error({ status: 500, message: 'failed' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('ds-error-message')).not.toBeNull();
    expect(notifications.error).toHaveBeenCalled();
  });

  it('blocks an invalid quick-create date and opens a valid yearless leap date', () => {
    fixture = TestBed.createComponent(DatesListComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const navigate = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    component.openCreateDialog();
    component.createForm.setValue({
      displayName: ' Неверная ',
      date: { day: '31', month: '4', year: '2020' },
    });
    component.createDate();
    expect(datesService.createDate).not.toHaveBeenCalled();
    expect(notifications.error).toHaveBeenCalled();

    component.createForm.setValue({
      displayName: ' Годовщина ',
      date: { day: '29', month: '2', year: '' },
    });
    component.createDate();

    expect(datesService.createDate).toHaveBeenCalledWith({
      displayName: 'Годовщина',
      date: { day: 29, month: 2, year: null },
    });
    expect(navigate).toHaveBeenCalledWith(['/personal-workspace/knowledge/dates', 'date-1'], {
      queryParamsHandling: 'preserve',
    });
    expect(notifications.success).toHaveBeenCalled();
  });

  it('marks only required quick-create fields with red asterisks', () => {
    fixture = TestBed.createComponent(DatesListComponent);
    fixture.detectChanges();

    fixture.componentInstance.openCreateDialog();
    fixture.detectChanges();

    const markers = Array.from(
      fixture.nativeElement.querySelectorAll(
        '[data-testid="dates-create-dialog"] .required-marker',
      ),
    ) as HTMLElement[];
    const yearLabel = fixture.nativeElement.querySelector(
      'label[for="date-create-year"]',
    ) as HTMLLabelElement;

    expect(markers).toHaveLength(3);
    expect(markers.every((marker) => marker.classList.contains('text-danger'))).toBe(true);
    expect(yearLabel.textContent?.trim()).toBe('Год начала');
    expect(yearLabel.querySelector('.required-marker')).toBeNull();
  });

  it('keeps the latest People search result and ignores a stale error', () => {
    const older = new Subject<{
      totalCount: number;
      totalPages: number;
      people: PersonDetail[];
    }>();
    const latest = new Subject<{
      totalCount: number;
      totalPages: number;
      people: PersonDetail[];
    }>();
    peopleService.listPeople
      .mockReset()
      .mockReturnValueOnce(of({ totalCount: 0, totalPages: 1, people: [] }))
      .mockReturnValueOnce(older)
      .mockReturnValueOnce(latest);
    fixture = TestBed.createComponent(DatesListComponent);
    fixture.detectChanges();

    fixture.componentInstance.searchPeople('old');
    fixture.componentInstance.searchPeople('new');
    latest.next({
      totalCount: 1,
      totalPages: 1,
      people: [{ ...PERSON, id: 'latest', displayName: 'Latest' }],
    });
    older.error(new Error('stale'));

    expect(fixture.componentInstance.personCandidates()).toContainEqual(
      expect.objectContaining({ id: 'latest' }),
    );
    expect(notifications.error).not.toHaveBeenCalled();
  });

  it('routes and deletes from row actions while preserving query state', () => {
    fixture = TestBed.createComponent(DatesListComponent);
    fixture.detectChanges();
    const navigate = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    fixture.componentInstance.handleDateAction('edit', DATE);
    expect(navigate).toHaveBeenCalledWith(['/personal-workspace/knowledge/dates', 'date-1'], {
      queryParamsHandling: 'preserve',
    });

    fixture.componentInstance.handleDateAction('delete', DATE);
    expect(datesService.deleteDate).toHaveBeenCalledWith('date-1');
    expect(notifications.success).toHaveBeenCalled();
  });
});
