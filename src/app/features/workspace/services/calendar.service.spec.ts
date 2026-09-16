import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiClient } from '../../../core/http/api-client.service';
import { CalendarService } from './calendar.service';

describe('CalendarService', () => {
  let service: CalendarService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CalendarService, ApiClient, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CalendarService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('loads the standalone calendar with an explicit reference date and window', () => {
    let firstRelatedPersonName = '';

    service.getCalendar('2026-07-31', 'currentAndNextMonths').subscribe((calendar) => {
      firstRelatedPersonName = calendar.entries[0].relatedPeople[0].displayName;
    });

    const request = httpMock.expectOne((value) =>
      value.url.endsWith('/api/personal-workspace/calendar'),
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('referenceDate')).toBe('2026-07-31');
    expect(request.request.params.get('window')).toBe('currentAndNextMonths');
    request.flush({
      referenceDate: '2026-07-31',
      window: 'currentAndNextMonths',
      summary: { memorableDateCount: 1, birthdayCount: 0 },
      entries: [
        {
          id: 'date-1',
          kind: 'memorableDate',
          displayName: 'Годовщина',
          annualDate: { day: 2, month: 8, year: 2020 },
          period: 'nextMonth',
          occurrenceYear: 2026,
          relatedPeople: [{ id: 'person-1', displayName: 'Анна' }],
        },
      ],
    });

    expect(firstRelatedPersonName).toBe('Анна');
  });

  it('serializes the single-month window explicitly', () => {
    service.getCalendar('2027-02-01', 'month').subscribe();

    const request = httpMock.expectOne((value) =>
      value.url.endsWith('/api/personal-workspace/calendar'),
    );
    expect(request.request.params.get('referenceDate')).toBe('2027-02-01');
    expect(request.request.params.get('window')).toBe('month');
    request.flush({
      referenceDate: '2027-02-01',
      window: 'month',
      summary: { memorableDateCount: 0, birthdayCount: 0 },
      entries: [],
    });
  });
});
