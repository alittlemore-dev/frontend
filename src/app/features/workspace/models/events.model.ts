export type EventFrequency = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface EventRecurrence {
  frequency: EventFrequency;
  untilDate: string | null;
}

export interface WorkspaceEvent {
  id: string;
  title: string;
  description: string;
  allDay: boolean;
  start: string;
  end: string;
  recurrence: EventRecurrence;
}

export type EventPayload = Omit<WorkspaceEvent, 'id'>;

export interface CalendarOccurrence {
  id: string;
  sourceId: string;
  kind: 'event' | 'birthday' | 'memorableDate';
  displayName: string;
  allDay: boolean;
  start: string;
  end: string;
  annualDate: { day: number; month: number; year: number | null } | null;
  relatedPeople: readonly { id: string; displayName: string }[];
}

export interface UnplacedAnnualEntry {
  sourceId: string;
  kind: 'birthday' | 'memorableDate';
  displayName: string;
  annualDate: { day: number; month: number; year: number | null };
  relatedPeople: readonly { id: string; displayName: string }[];
}

export interface CalendarOccurrences {
  entries: readonly CalendarOccurrence[];
  unplacedAnnualEntries: readonly UnplacedAnnualEntry[];
}
