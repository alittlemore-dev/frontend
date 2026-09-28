import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import {
  TelegramSettings,
  TelegramSettingsService,
} from '../../services/telegram-settings.service';
import { TelegramSettingsComponent } from './telegram-settings.component';

const SETTINGS: TelegramSettings = {
  available: true,
  enabled: true,
  notify: false,
  invitations: [],
  connections: [
    {
      id: 'abc',
      label: 'Boris',
      telegramUserId: 42,
      username: 'boris',
      firstName: 'Boris',
      state: 'pending',
      requestedAt: '2026-09-26T12:00:00Z',
      connectedAt: null,
      lastContactAt: '2026-09-26T12:00:00Z',
      notifyBirthday: false,
      notifyMemorableDate: false,
      language: 'en',
    },
  ],
};

describe('TelegramSettingsComponent', () => {
  let fixture: ComponentFixture<TelegramSettingsComponent>;
  const service = {
    load: jest.fn(),
    setEnabled: jest.fn(),
    setNotify: jest.fn(),
    updateConnectionSettings: jest.fn(),
    createInvitation: jest.fn(),
    cancelInvitation: jest.fn(),
    changeState: jest.fn(),
    rename: jest.fn(),
  };

  beforeEach(async () => {
    service.load.mockReset().mockReturnValue(of(SETTINGS));
    service.setEnabled.mockReset().mockReturnValue(of({ enabled: true }));
    service.setNotify.mockReset().mockReturnValue(of({ notify: false }));
    service.updateConnectionSettings.mockReset().mockReturnValue(of(SETTINGS.connections[0]));
    service.createInvitation.mockReset().mockReturnValue(
      of({
        url: 'https://t.me/shared_bot?start=secret',
        expiresAt: '2026-09-26T12:15:00Z',
      }),
    );
    service.cancelInvitation.mockReset().mockReturnValue(of(undefined));
    service.changeState
      .mockReset()
      .mockReturnValue(of({ ...SETTINGS.connections[0], state: 'active' }));
    service.rename.mockReset().mockReturnValue(of(SETTINGS.connections[0]));
    await TestBed.configureTestingModule({
      imports: [TelegramSettingsComponent],
      providers: [provideI18nTesting(), { provide: TelegramSettingsService, useValue: service }],
    }).compileComponents();
    fixture = TestBed.createComponent(TelegramSettingsComponent);
    fixture.detectChanges();
  });

  it('shows a newly generated one-time link only after creation', () => {
    const component = fixture.componentInstance;
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('#telegram-invite-link')).toBeNull();
    component.inviteLabel.setValue('Family');
    element.querySelector<HTMLButtonElement>('#telegram-create-invite')!.click();
    fixture.detectChanges();
    expect(service.createInvitation).toHaveBeenCalledWith('Family');
    expect(element.querySelector<HTMLAnchorElement>('#telegram-invite-link')?.href).toBe(
      'https://t.me/shared_bot?start=secret',
    );
  });

  it('approves a pending request and refreshes the list', () => {
    const element: HTMLElement = fixture.nativeElement;
    element.querySelector<HTMLButtonElement>('#telegram-approve-abc')!.click();
    fixture.detectChanges();
    expect(service.changeState).toHaveBeenCalledWith('abc', 'approve');
    expect(service.load).toHaveBeenCalledTimes(2);
  });

  it('reports a failed invitation without exposing an old link', () => {
    service.createInvitation.mockReturnValue(throwError(() => new Error('offline')));
    const component = fixture.componentInstance;
    const element: HTMLElement = fixture.nativeElement;
    component.inviteLabel.setValue('Family');
    element.querySelector<HTMLButtonElement>('#telegram-create-invite')!.click();
    fixture.detectChanges();
    expect(element.querySelector('#telegram-invite-link')).toBeNull();
    expect(element.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('keeps the label editor open when renaming fails', () => {
    service.rename.mockReturnValue(throwError(() => new Error('offline')));
    const component = fixture.componentInstance;
    component.beginRename('abc', 'Boris');
    component.editLabel.setValue('Family');

    component.rename('abc');
    fixture.detectChanges();

    expect(component.editingId()).toBe('abc');
    expect(component.editLabel.value).toBe('Family');
    expect(fixture.nativeElement.querySelector('#telegram-rename-abc')).not.toBeNull();
  });

  it('keeps notification selections available after a failed save', () => {
    service.updateConnectionSettings.mockReturnValue(throwError(() => new Error('offline')));
    const component = fixture.componentInstance;
    component.beginEditNotifications(SETTINGS.connections[0]);
    component.updateNotificationDraft({ notifyBirthday: true, language: 'ru' });
    component.saveNotifications();
    fixture.detectChanges();
    expect(component.notificationDraft()?.notifyBirthday).toBe(true);
    expect(component.notificationDraft()?.language).toBe('ru');
    expect(fixture.nativeElement.querySelector('#telegram-notify-birthday')).not.toBeNull();
  });

  it('saves all notification settings together and closes the editor', () => {
    const component = fixture.componentInstance;
    component.beginEditNotifications(SETTINGS.connections[0]);
    component.updateNotificationDraft({
      notifyBirthday: true,
      notifyMemorableDate: true,
      language: 'ru',
    });
    component.saveNotifications();
    fixture.detectChanges();

    expect(service.updateConnectionSettings).toHaveBeenCalledWith('abc', {
      notifyBirthday: true,
      notifyMemorableDate: true,
      language: 'ru',
    });
    expect(component.notificationDraft()).toBeNull();
    expect(service.load).toHaveBeenCalledTimes(2);
  });
});
