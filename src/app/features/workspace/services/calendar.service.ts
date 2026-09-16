import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiClient } from '../../../core/http/api-client.service';
import { Calendar, CalendarWindow } from '../models/calendar.model';

@Injectable({ providedIn: 'root' })
export class CalendarService {
  private readonly api = inject(ApiClient);

  getCalendar(referenceDate: string, window: CalendarWindow): Observable<Calendar> {
    return this.api
      .get<Calendar>('/api/personal-workspace/calendar', { referenceDate, window })
      .pipe(map(mapCalendar));
  }
}

function mapCalendar(calendar: Calendar): Calendar {
  return {
    referenceDate: calendar.referenceDate,
    window: calendar.window,
    summary: { ...calendar.summary },
    entries: calendar.entries.map((entry) => ({
      ...entry,
      annualDate: { ...entry.annualDate },
      relatedPeople: entry.relatedPeople.map((person) => ({ ...person })),
    })),
  };
}
