import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiClient } from '../../../core/http/api-client.service';
import { CalendarOccurrences, EventPayload, WorkspaceEvent } from '../models/events.model';

const PATH = '/api/personal-workspace/events';

@Injectable({ providedIn: 'root' })
export class EventsService {
  private readonly api = inject(ApiClient);

  list(): Observable<readonly WorkspaceEvent[]> {
    return this.api.get<{ events: WorkspaceEvent[] }>(PATH).pipe(map(({ events }) => events));
  }

  get(id: string): Observable<WorkspaceEvent> {
    return this.api.get<WorkspaceEvent>(`${PATH}/${encodeURIComponent(id)}`);
  }

  create(payload: EventPayload): Observable<WorkspaceEvent> {
    return this.api.post<WorkspaceEvent>(PATH, payload);
  }

  update(id: string, payload: EventPayload): Observable<WorkspaceEvent> {
    return this.api.put<WorkspaceEvent>(`${PATH}/${encodeURIComponent(id)}`, payload);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`${PATH}/${encodeURIComponent(id)}`);
  }

  occurrences(startDate: string, endDate: string): Observable<CalendarOccurrences> {
    return this.api.get<CalendarOccurrences>('/api/personal-workspace/calendar/occurrences', {
      startDate,
      endDate,
    });
  }
}
