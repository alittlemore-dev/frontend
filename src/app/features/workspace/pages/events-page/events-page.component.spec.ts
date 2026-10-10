import { NotificationService } from '@alittlemore.dev/design-system';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { EventsService } from '../../services/events.service';
import { EventsPageComponent } from './events-page.component';
import { AccountSettingsService } from '../../../../core/auth/account-settings.service';

const EVENTS = [
  {
    id: 'one',
    title: 'Meeting',
    description: 'Project planning',
    allDay: false,
    start: '2026-10-01T08:00:00Z',
    end: '2026-10-01T09:00:00Z',
    recurrence: { frequency: 'none', untilDate: null },
  },
  {
    id: 'two',
    title: 'Holiday',
    description: 'Break',
    allDay: true,
    start: '2026-10-02',
    end: '2026-10-03',
    recurrence: { frequency: 'yearly', untilDate: null },
  },
] as const;

describe('EventsPageComponent', () => {
  let fixture: ComponentFixture<EventsPageComponent>;
  const timeZone = signal('UTC');
  const service = { list: jest.fn(() => of(EVENTS)), delete: jest.fn(() => of(undefined)) };
  beforeEach(async () => {
    jest.clearAllMocks();
    timeZone.set('UTC');
    await TestBed.configureTestingModule({
      imports: [EventsPageComponent],
      providers: [
        provideRouter([]),
        provideI18nTesting(),
        { provide: EventsService, useValue: service },
        { provide: AccountSettingsService, useValue: { timeZone } },
        { provide: NotificationService, useValue: { success: jest.fn(), error: jest.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(EventsPageComponent);
    fixture.detectChanges();
  });
  afterEach(() => {
    jest.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('filters events by title and description on the client', () => {
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('ul')?.children).toHaveLength(2);
    expect(root.textContent).not.toContain('2026-10-01T08:00:00Z');
    const search = root.querySelector('#workspace-events-search') as HTMLInputElement;
    search.value = 'planning';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(root.querySelector('ul')?.children).toHaveLength(1);
    expect(root.textContent).toContain('Meeting');
  });

  it('deletes a confirmed series', () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    const root = fixture.nativeElement as HTMLElement;
    (root.querySelector('[data-testid="event-actions-one-delete"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(service.delete).toHaveBeenCalledWith('one');
    expect(root.querySelector('ul')?.children).toHaveLength(1);
  });

  it('opens the populated editor through the row actions menu', () => {
    const root = fixture.nativeElement as HTMLElement;
    (root.querySelector('[data-testid="event-actions-one-edit"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelector('[role="dialog"]')).not.toBeNull();
    expect((root.querySelector('#event-title') as HTMLInputElement).value).toBe('Meeting');
  });

  it('refreshes the collection through the page action', () => {
    const root = fixture.nativeElement as HTMLElement;
    Array.from(root.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Обновить')!
      .click();
    fixture.detectChanges();
    expect(service.list).toHaveBeenCalledTimes(2);
  });

  it('shows timed events in the account zone while all-day dates stay fixed', () => {
    const component = fixture.componentInstance;
    const timed = component.events()[0];
    const allDay = component.events()[1];
    const utcLabel = component.eventDateLabel(timed);
    const allDayLabel = component.eventDateLabel(allDay);
    timeZone.set('Pacific/Honolulu');
    expect(component.eventDateLabel(timed)).not.toBe(utcLabel);
    expect(component.eventDateLabel(allDay)).toBe(allDayLabel);
    expect(timed.start).toBe('2026-10-01T08:00:00Z');
  });
});
