import { UnsavedChangesService } from '../../../../core/unsaved-changes/unsaved-changes.service';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LoginPageComponent } from './login-page.component';
import { AuthService } from '../../../../core/auth/auth.service';
import { AuthModalService } from '../../../../core/auth/auth-modal.service';
import { provideI18nTesting } from '../../../../testing/i18n-testing';

describe('LoginPageComponent', () => {
  let fixture: ComponentFixture<LoginPageComponent>;
  let component: LoginPageComponent;
  let mockAuthService: { login: jest.Mock; currentUser: jest.Mock };
  let authModal: AuthModalService;

  beforeEach(async () => {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: function (this: HTMLDialogElement): void {
        this.setAttribute('open', '');
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value: function (this: HTMLDialogElement): void {
        this.removeAttribute('open');
      },
    });
    mockAuthService = {
      login: jest.fn(),
      currentUser: jest.fn(() => ({ username: 'owner', role: 'owner' })),
    };

    await TestBed.configureTestingModule({
      imports: [LoginPageComponent],
      providers: [
        provideRouter([]),
        provideI18nTesting(),
        { provide: UnsavedChangesService, useValue: { discardChanges: jest.fn() } },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compileComponents();

    authModal = TestBed.inject(AuthModalService);
    authModal.openLogin();
    fixture = TestBed.createComponent(LoginPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders username and password fields', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('#login-modal')).not.toBeNull();
    expect(compiled.querySelector('dialog[open]')).not.toBeNull();
    expect(compiled.querySelector('#username')).not.toBeNull();
    expect(compiled.querySelector('#password')).not.toBeNull();
  });

  it('prevents native cancellation while session recovery is required', () => {
    authModal.openLogin({ required: true, account: { username: 'owner', role: 'owner' } });
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    const event = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(dialog.open).toBe(true);
    expect(authModal.isLoginOpen()).toBe(true);
  });

  it('dismisses optional login on native cancellation', () => {
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(authModal.isLoginOpen()).toBe(false);
  });

  it('closes the native dialog on destruction', () => {
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    fixture.destroy();
    expect(dialog.open).toBe(false);
  });

  it('renders the modal without inline styles for strict style-src-attr CSP', () => {
    const modal = fixture.nativeElement.querySelector('#login-modal') as HTMLElement | null;
    const modalContent = fixture.nativeElement.querySelector(
      '.modal-content',
    ) as HTMLElement | null;

    expect(modal).not.toBeNull();
    expect(modal?.getAttribute('style')).toBeNull();
    expect(modalContent).not.toBeNull();
    expect(modalContent?.getAttribute('style')).toBeNull();
  });

  it('uses a fullscreen dialog on narrow public screens', () => {
    const dialog = fixture.nativeElement.querySelector('.modal-dialog') as HTMLElement | null;

    expect(dialog).not.toBeNull();
    expect(dialog?.classList).toContain('modal-fullscreen-sm-down');
  });

  it('prevents closing a required session recovery dialog', () => {
    authModal.openLogin({ required: true, account: { username: 'owner', role: 'owner' } });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.btn-close')).toBeNull();
    component.close();
    expect(authModal.isLoginOpen()).toBe(true);
  });

  it('keeps the active route on successful session recovery', () => {
    const navigate = jest.spyOn(TestBed.inject(Router), 'navigateByUrl');
    authModal.openLogin({ required: true, account: { username: 'owner', role: 'owner' } });
    mockAuthService.login.mockReturnValue(of(undefined));
    component.form.setValue({ username: 'owner', password: 'secret' });
    component.login();
    expect(authModal.isLoginOpen()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('destroys the previous private route before unlocking a different account', async () => {
    let resolveNavigation!: (value: boolean) => void;
    const navigate = jest
      .spyOn(TestBed.inject(Router), 'navigateByUrl')
      .mockImplementation(() => new Promise<boolean>((resolve) => (resolveNavigation = resolve)));
    authModal.openLogin({ required: true, account: { username: 'owner', role: 'owner' } });
    mockAuthService.currentUser.mockReturnValue({ username: 'moderator', role: 'moderator' });
    mockAuthService.login.mockReturnValue(of(undefined));
    component.form.setValue({ username: 'moderator', password: 'secret' });
    component.login();
    expect(TestBed.inject(UnsavedChangesService).discardChanges).toHaveBeenCalled();
    expect(String(navigate.mock.calls[0][0])).toBe('/ru/how-this-site-is-built');
    expect(authModal.isLoginOpen()).toBe(true);
    resolveNavigation(true);
    await fixture.whenStable();
    expect(authModal.isLoginOpen()).toBe(false);
  });

  it('returns to a guarded deep link after login', () => {
    const navigate = jest.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    authModal.openLogin({ returnUrl: '/personal-workspace/resumes/123?tab=edit' });
    mockAuthService.login.mockReturnValue(of(undefined));
    component.form.setValue({ username: 'owner', password: 'secret' });
    component.login();
    expect(navigate).toHaveBeenCalledWith('/personal-workspace/resumes/123?tab=edit');
  });

  it('submit button is disabled when form is invalid', () => {
    const button = fixture.nativeElement.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('submit button is enabled when form is valid', () => {
    component.form.setValue({ username: 'admin', password: 'secret' });
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });

  it('shows error message on login failure', () => {
    mockAuthService.login.mockReturnValue(throwError(() => ({ message: 'Invalid credentials' })));
    component.form.setValue({ username: 'admin', password: 'wrong' });
    fixture.detectChanges();

    component.login();
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('.alert-danger') as HTMLElement;
    expect(alert).not.toBeNull();
    expect(alert.textContent?.trim()).toBe('Invalid credentials');
  });

  it('does not show error message initially', () => {
    const alert = fixture.nativeElement.querySelector('.alert-danger');
    expect(alert).toBeNull();
  });

  it('calls authService.login with correct credentials', () => {
    mockAuthService.login.mockReturnValue(of(undefined));
    component.form.setValue({ username: 'admin', password: 'secret' });
    fixture.detectChanges();

    component.login();

    expect(mockAuthService.login).toHaveBeenCalledWith('admin', 'secret');
  });

  it('closes modal after successful login', () => {
    mockAuthService.login.mockReturnValue(of(undefined));
    component.form.setValue({ username: 'admin', password: 'secret' });

    component.login();

    expect(authModal.isLoginOpen()).toBe(false);
  });
});
