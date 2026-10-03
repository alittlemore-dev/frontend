import { TestBed } from '@angular/core/testing';
import { NotificationService } from '@alittlemore.dev/design-system';
import { of, Subject } from 'rxjs';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { KnowledgeDatesService } from '../../knowledge/dates/services/dates.service';
import { PeopleService } from '../../knowledge/people/services/people.service';
import { CalendarKnowledgeCreateComponent } from './calendar-knowledge-create.component';

describe('CalendarKnowledgeCreateComponent', () => {
  const people = { createPerson: jest.fn() };
  const dates = { createDate: jest.fn() };
  const notifications = { success: jest.fn(), error: jest.fn() };
  beforeEach(() => {
    jest.clearAllMocks();
    people.createPerson.mockReturnValue(of({ id: 'person' }));
    dates.createDate.mockReturnValue(of({ id: 'date' }));
    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: PeopleService, useValue: people },
        { provide: KnowledgeDatesService, useValue: dates },
        { provide: NotificationService, useValue: notifications },
      ],
    });
  });
  afterEach(() => jest.restoreAllMocks());
  function create(kind: 'birthday' | 'date', initialDate: string | null) {
    const fixture = TestBed.createComponent(CalendarKnowledgeCreateComponent);
    fixture.componentRef.setInput('kind', kind);
    fixture.componentRef.setInput('initialDate', initialDate);
    fixture.detectChanges();
    return fixture;
  }

  it('prefills only day and month and creates a person with birthday in one request', () => {
    const fixture = create('birthday', '2028-02-29');
    expect(fixture.componentInstance.birthdayForm.getRawValue().date).toEqual({
      day: '29',
      month: '2',
      year: null,
    });
    fixture.componentInstance.birthdayForm.patchValue({
      firstName: ' Ivan ',
      lastName: ' Ivanov ',
    });
    const saved = jest.fn();
    fixture.componentInstance.saved.subscribe(saved);
    fixture.componentInstance.save();
    expect(people.createPerson).toHaveBeenCalledWith({
      firstName: 'Ivan',
      lastName: 'Ivanov',
      birthday: { day: 29, month: 2, year: null },
    });
    expect(dates.createDate).not.toHaveBeenCalled();
    expect(saved).toHaveBeenCalledTimes(1);
    expect(notifications.success).toHaveBeenCalled();
  });

  it('requires manually entered dates without a selection and rejects impossible or future dates', () => {
    const fixture = create('date', null);
    const component = fixture.componentInstance;
    expect(component.dateForm.getRawValue().date).toEqual({ day: '', month: '', year: null });
    component.dateForm.patchValue({ displayName: 'Anniversary', date: { day: '31', month: '2' } });
    component.save();
    expect(dates.createDate).not.toHaveBeenCalled();
    component.dateForm.patchValue({ date: { day: '1', month: '1', year: 9999 } });
    component.save();
    expect(dates.createDate).not.toHaveBeenCalled();
    component.dateForm.patchValue({ date: { day: '29', month: '2', year: null } });
    component.save();
    expect(dates.createDate).toHaveBeenCalledWith({
      displayName: 'Anniversary',
      date: { day: 29, month: 2, year: null },
    });
  });

  it('protects an edited draft on cancel and retains it after a failed save', () => {
    const response = new Subject<{ id: string }>();
    dates.createDate.mockReturnValue(response);
    const fixture = create('date', '2026-10-03');
    const component = fixture.componentInstance;
    const closed = jest.fn();
    component.closed.subscribe(closed);
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    component.dateForm.patchValue({ displayName: 'Draft' });
    component.close();
    expect(confirm).toHaveBeenCalled();
    expect(closed).not.toHaveBeenCalled();
    component.save();
    component.save();
    component.close();
    expect(dates.createDate).toHaveBeenCalledTimes(1);
    expect(closed).not.toHaveBeenCalled();
    response.error({ message: 'failed' });
    expect(component.dateForm.getRawValue().displayName).toBe('Draft');
    expect(component.error()).toEqual({ message: 'failed' });
    confirm.mockReturnValue(true);
    component.close();
    expect(closed).toHaveBeenCalledTimes(1);
  });
});
