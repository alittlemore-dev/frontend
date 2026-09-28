import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiClient } from '../../../core/http/api-client.service';
import { EventPayload } from '../models/events.model';
import { EventsService } from './events.service';

const EVENT: EventPayload = {
  title: 'Meeting',
  description: 'Discuss',
  allDay: false,
  start: '2026-10-01T08:00:00Z',
  end: '2026-10-01T09:00:00Z',
  recurrence: { frequency: 'weekly', untilDate: '2026-11-01' },
};

describe('EventsService', () => {
  let service: EventsService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ApiClient, EventsService],
    });
    service = TestBed.inject(EventsService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('uses event CRUD and visible occurrence range endpoints', () => {
    service.list().subscribe((events) => expect(events).toHaveLength(1));
    http
      .expectOne((request) => request.url.endsWith('/api/personal-workspace/events'))
      .flush({ events: [{ id: 'e1', ...EVENT }] });
    service.get('e1').subscribe((event) => expect(event.id).toBe('e1'));
    http
      .expectOne((request) => request.url.endsWith('/api/personal-workspace/events/e1'))
      .flush({ id: 'e1', ...EVENT });
    service.create(EVENT).subscribe();
    const create = http.expectOne((request) =>
      request.url.endsWith('/api/personal-workspace/events'),
    );
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(EVENT);
    create.flush({ id: 'e1', ...EVENT });
    service.update('e1', EVENT).subscribe();
    const update = http.expectOne((request) =>
      request.url.endsWith('/api/personal-workspace/events/e1'),
    );
    expect(update.request.method).toBe('PUT');
    update.flush({ id: 'e1', ...EVENT });
    service.delete('e1').subscribe();
    const remove = http.expectOne((request) =>
      request.url.endsWith('/api/personal-workspace/events/e1'),
    );
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null);

    service
      .occurrences('2026-10-01', '2026-11-01')
      .subscribe((value) => expect(value.entries).toEqual([]));
    const occurrence = http.expectOne((request) =>
      request.url.endsWith('/api/personal-workspace/calendar/occurrences'),
    );
    expect(occurrence.request.params.get('startDate')).toBe('2026-10-01');
    expect(occurrence.request.params.get('endDate')).toBe('2026-11-01');
    expect(occurrence.request.params.has('timeZone')).toBe(false);
    occurrence.flush({ entries: [], unplacedAnnualEntries: [] });
  });
});
