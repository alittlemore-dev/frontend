import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotificationService } from '@alittlemore.dev/design-system';
import { Subject, of, throwError } from 'rxjs';
import { AccountAvatarService } from '../../../../core/auth/account-avatar.service';
import { AccountInfo } from '../../../../core/auth/account.model';
import { UnsavedChangesService } from '../../../../core/unsaved-changes/unsaved-changes.service';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { AccountService } from '../../services/account.service';
import { ProfilePageComponent } from './profile-page.component';

describe('ProfilePageComponent', () => {
  const account: AccountInfo = {
    username: 'd.lunev',
    role: 'user',
    firstName: 'Dmitriy',
    lastName: 'Lunev',
    middleName: null,
    gender: 'male',
    hasAvatar: false,
  };
  let fixture: ComponentFixture<ProfilePageComponent>;
  let component: ProfilePageComponent;
  let accountService: {
    ensureLoaded: jest.Mock;
    updateProfile: jest.Mock;
    replaceAvatar: jest.Mock;
    removeAvatar: jest.Mock;
  };
  let notifications: { success: jest.Mock; error: jest.Mock };
  const objectUrl = signal<string | null>(null);

  async function setup(loadResult = of(account)): Promise<void> {
    accountService = {
      ensureLoaded: jest.fn(() => loadResult),
      updateProfile: jest.fn(),
      replaceAvatar: jest.fn(),
      removeAvatar: jest.fn(),
    };
    notifications = { success: jest.fn(), error: jest.fn() };
    await TestBed.configureTestingModule({
      imports: [ProfilePageComponent],
      providers: [
        provideI18nTesting(profileMessages),
        { provide: AccountService, useValue: accountService },
        { provide: AccountAvatarService, useValue: { objectUrl } },
        { provide: NotificationService, useValue: notifications },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ProfilePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('renders loading, then the read-only profile without an email field', async () => {
    const loaded = new Subject<AccountInfo>();
    await setup(loaded);
    expect(fixture.nativeElement.textContent).toContain('Загрузка профиля');

    loaded.next(account);
    loaded.complete();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Dmitriy Lunev');
    expect(fixture.nativeElement.textContent).toContain('d.lunev');
    expect(fixture.nativeElement.textContent).toContain('Мужской');
    expect(fixture.nativeElement.querySelector('[data-testid="profile-email"]')).toBeNull();
  });

  it('renders the username as static identity outside the edit form', async () => {
    await setup();

    component.startEditing();
    fixture.detectChanges();

    const identity = fixture.nativeElement.querySelector(
      '[data-testid="profile-username-readonly"]',
    ) as HTMLElement;
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    expect(identity.textContent).toContain('d.lunev');
    expect(identity.querySelector('input, select, textarea')).toBeNull();
    expect(form.textContent).not.toContain('Имя пользователя');
  });

  it('shows load failure and retries visibly', async () => {
    await setup(throwError(() => new Error('failed')));
    expect(fixture.nativeElement.textContent).toContain('Не удалось загрузить профиль');
    accountService.ensureLoaded.mockReturnValueOnce(of(account));

    (
      fixture.nativeElement.querySelector('[data-testid="profile-retry"]') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Dmitriy Lunev');
  });

  it('uses the username for the display name and initials when names are absent', async () => {
    await setup(of({ ...account, firstName: null, lastName: null }));

    expect(
      fixture.nativeElement.querySelector('[data-testid="profile-display-name"]').textContent,
    ).toContain('d.lunev');
    expect(
      fixture.nativeElement.querySelector('[data-testid="profile-initials"]').textContent.trim(),
    ).toBe('D.');
  });

  it('derives initials from first and last names', async () => {
    await setup();
    expect(
      fixture.nativeElement.querySelector('[data-testid="profile-initials"]').textContent.trim(),
    ).toBe('DL');
  });

  it('validates names and sends only changed normalized scalar fields', async () => {
    await setup();
    component.startEditing();
    component.profileForm.controls.firstName.setValue('  Dima  ');
    component.profileForm.controls.middleName.setValue('   ');
    component.profileForm.controls.lastName.setValue('x'.repeat(101));
    component.saveProfile();
    expect(accountService.updateProfile).not.toHaveBeenCalled();

    component.profileForm.controls.lastName.setValue('Lunev');
    accountService.updateProfile.mockReturnValueOnce(
      of({ ...account, firstName: 'Dima', middleName: null }),
    );
    component.saveProfile();

    expect(accountService.updateProfile).toHaveBeenCalledWith({ firstName: 'Dima' });
    expect(component.editing()).toBe(false);
    expect(notifications.success).toHaveBeenCalledWith('Профиль сохранён');
  });

  it('keeps a failed scalar draft dirty and cancel restores the server baseline', async () => {
    await setup();
    const unsaved = TestBed.inject(UnsavedChangesService);
    component.startEditing();
    component.profileForm.controls.firstName.setValue('Draft');
    accountService.updateProfile.mockReturnValueOnce(throwError(() => new Error('failed')));

    component.saveProfile();

    expect(component.profileForm.controls.firstName.value).toBe('Draft');
    expect(component.editing()).toBe(true);
    expect(unsaved.hasChanges()).toBe(true);
    component.cancelEditing();
    expect(component.profileForm.controls.firstName.value).toBe('Dmitriy');
    expect(component.editing()).toBe(false);
    expect(unsaved.hasChanges()).toBe(false);
  });

  it('keeps edit mode clean until a scalar value changes', async () => {
    await setup();
    const unsaved = TestBed.inject(UnsavedChangesService);

    component.startEditing();
    expect(unsaved.hasChanges()).toBe(false);
    component.profileForm.controls.gender.setValue('female');
    expect(unsaved.hasChanges()).toBe(true);
  });

  it('replaces and removes the avatar immediately', async () => {
    await setup();
    const file = new File(['image'], 'avatar.png', { type: 'image/png' });
    accountService.replaceAvatar.mockReturnValueOnce(of({ ...account, hasAvatar: true }));
    accountService.removeAvatar.mockReturnValueOnce(of(account));
    const input = { files: [file], value: 'selected' } as unknown as HTMLInputElement;

    component.selectAvatar({ target: input } as unknown as Event);
    expect(accountService.replaceAvatar).toHaveBeenCalledWith(file);
    expect(input.value).toBe('');
    component.removeAvatar();
    expect(accountService.removeAvatar).toHaveBeenCalledTimes(1);
  });

  it.each([
    [new File(['text'], 'avatar.txt', { type: 'text/plain' }), 'Выберите PNG, JPEG или WebP'],
    [
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }),
      'Файл слишком большой',
    ],
  ])('rejects invalid avatar files before upload', async (file, expectedMessage) => {
    await setup();
    const input = { files: [file], value: 'selected' } as unknown as HTMLInputElement;

    component.selectAvatar({ target: input } as unknown as Event);

    expect(accountService.replaceAvatar).not.toHaveBeenCalled();
    expect(notifications.error).toHaveBeenCalledWith(expectedMessage);
    expect(input.value).toBe('');
  });

  it('disables scalar and avatar actions while their requests are busy', async () => {
    await setup(of({ ...account, hasAvatar: true }));
    const saving = new Subject<AccountInfo>();
    const removing = new Subject<AccountInfo>();
    accountService.updateProfile.mockReturnValueOnce(saving);
    accountService.removeAvatar.mockReturnValueOnce(removing);
    component.startEditing();
    component.profileForm.controls.firstName.setValue('Dima');

    component.saveProfile();
    fixture.detectChanges();
    expect(
      (fixture.nativeElement.querySelector('[data-testid="profile-save"]') as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    component.removeAvatar();
    fixture.detectChanges();
    expect(
      (
        fixture.nativeElement.querySelector(
          '[data-testid="profile-avatar-remove"]',
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});

const profileMessages: Record<string, string> = {
  'account.profile.title': 'Профиль',
  'account.profile.loading': 'Загрузка профиля',
  'account.profile.loadFailed': 'Не удалось загрузить профиль',
  'account.profile.retry': 'Повторить',
  'account.profile.saveSuccess': 'Профиль сохранён',
  'account.profile.saveFailed': 'Не удалось сохранить профиль',
  'account.profile.invalid': 'Исправьте поля формы',
  'account.profile.username': 'Имя пользователя',
  'account.profile.firstName': 'Имя',
  'account.profile.lastName': 'Фамилия',
  'account.profile.middleName': 'Отчество',
  'account.profile.gender': 'Пол',
  'account.profile.gender.male': 'Мужской',
  'account.profile.gender.female': 'Женский',
  'account.profile.changeAvatar': 'Заменить аватар',
  'account.profile.removeAvatar': 'Удалить аватар',
  'account.profile.avatarSaveSuccess': 'Аватар обновлён',
  'account.profile.avatarRemoveSuccess': 'Аватар удалён',
  'account.profile.avatarFailed': 'Не удалось обновить аватар',
  'account.profile.invalidAvatarType': 'Выберите PNG, JPEG или WebP',
  'account.profile.avatarTooLarge': 'Файл слишком большой',
  'account.profile.avatarAlt': 'Аватар пользователя',
  'validation.maxLength': 'Слишком длинное значение',
};
