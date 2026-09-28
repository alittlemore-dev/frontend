import { draftToPayload, eventToDraft } from './event-time';

describe('event time conversion', () => {
  it('converts a timed event in its IANA time zone to a UTC instant', () => {
    const payload = draftToPayload(
      {
        title: ' Meeting ',
        description: '',
        allDay: false,
        start: '2026-10-01T12:00',
        end: '2026-10-01T13:00',
        frequency: 'weekly',
        untilDate: '2026-11-01',
      },
      'Europe/Moscow',
    );
    expect(payload.start).toBe('2026-10-01T09:00:00Z');
    expect(payload.end).toBe('2026-10-01T10:00:00Z');
    expect(eventToDraft({ id: 'e1', ...payload }, 'Europe/Moscow').start).toBe('2026-10-01T12:00');
  });

  it('displays the last included all-day date and sends an exclusive end', () => {
    const payload = draftToPayload(
      {
        title: 'Holiday',
        description: '',
        allDay: true,
        start: '2026-12-31',
        end: '2026-12-31',
        frequency: 'none',
        untilDate: '',
      },
      'UTC',
    );
    expect(payload.end).toBe('2027-01-01');
    expect(eventToDraft({ id: 'e1', ...payload }, 'UTC').end).toBe('2026-12-31');
    expect(payload.recurrence.untilDate).toBeNull();
  });

  it('rejects a reversed timed range', () => {
    expect(() =>
      draftToPayload(
        {
          title: 'Meeting',
          description: '',
          allDay: false,
          start: '2026-01-01T12:00',
          end: '2026-01-01T11:00',
          frequency: 'none',
          untilDate: '',
        },
        'UTC',
      ),
    ).toThrow();
  });

  it('keeps exact instants for the repeated 01:30 hour in New York', () => {
    const draft = {
      title: 'Night shift',
      description: '',
      allDay: false,
      start: '2026-11-01T01:30',
      end: '2026-11-01T01:30',
      frequency: 'none' as const,
      untilDate: '',
    };
    const payload = draftToPayload(draft, 'America/New_York', {
      start: '2026-11-01T05:30:00Z',
      end: '2026-11-01T06:30:00Z',
    });
    expect(payload.start).toBe('2026-11-01T05:30:00Z');
    expect(payload.end).toBe('2026-11-01T06:30:00Z');
    expect(() => draftToPayload(draft, 'America/New_York')).toThrow();
  });
});
