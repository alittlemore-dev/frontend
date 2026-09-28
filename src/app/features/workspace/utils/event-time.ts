import { Temporal } from 'temporal-polyfill';
import { EventPayload, WorkspaceEvent } from '../models/events.model';

export interface EventDraft {
  title: string;
  description: string;
  allDay: boolean;
  start: string;
  end: string;
  frequency: EventPayload['recurrence']['frequency'];
  untilDate: string;
}

export interface EventEditorInitial extends Pick<EventDraft, 'allDay' | 'start' | 'end'> {
  startInstant?: string;
  endInstant?: string;
}

export interface ExactEventInstants {
  start?: string;
  end?: string;
}

export function eventToDraft(event: WorkspaceEvent, timeZone: string): EventDraft {
  return {
    title: event.title,
    description: event.description,
    allDay: event.allDay,
    start: event.allDay ? event.start : localDateTime(event.start, timeZone),
    end: event.allDay
      ? Temporal.PlainDate.from(event.end).subtract({ days: 1 }).toString()
      : localDateTime(event.end, timeZone),
    frequency: event.recurrence.frequency,
    untilDate: event.recurrence.untilDate ?? '',
  };
}

export function draftToPayload(
  draft: EventDraft,
  timeZone: string,
  exactInstants?: ExactEventInstants,
): EventPayload {
  new Intl.DateTimeFormat('en', { timeZone });
  const start = draft.allDay
    ? draft.start
    : (exactInstants?.start ?? utcDateTime(draft.start, timeZone));
  const end = draft.allDay
    ? nextDate(draft.end)
    : (exactInstants?.end ?? utcDateTime(draft.end, timeZone));
  if (
    Temporal.PlainDate.from(draft.start.slice(0, 10)).toString() !== draft.start.slice(0, 10) ||
    Temporal.PlainDate.from(draft.end.slice(0, 10)).toString() !== draft.end.slice(0, 10) ||
    (draft.allDay
      ? draft.end < draft.start
      : Temporal.Instant.compare(Temporal.Instant.from(end), Temporal.Instant.from(start)) <= 0)
  ) {
    throw new RangeError('Invalid event date range');
  }
  if (draft.frequency !== 'none' && draft.untilDate) {
    const until = Temporal.PlainDate.from(draft.untilDate).toString();
    if (until < draft.start.slice(0, 10))
      throw new RangeError('Recurrence ends before event starts');
  }
  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    allDay: draft.allDay,
    start,
    end,
    recurrence: {
      frequency: draft.frequency,
      untilDate: draft.frequency === 'none' || !draft.untilDate ? null : draft.untilDate,
    },
  };
}

export function nextDate(date: string): string {
  return Temporal.PlainDate.from(date).add({ days: 1 }).toString();
}

function localDateTime(instant: string, timeZone: string): string {
  return Temporal.Instant.from(instant)
    .toZonedDateTimeISO(timeZone)
    .toPlainDateTime()
    .toString({ smallestUnit: 'minute' });
}

function utcDateTime(local: string, timeZone: string): string {
  const dateTime = Temporal.PlainDateTime.from(local);
  return dateTime.toZonedDateTime(timeZone).toInstant().toString();
}
