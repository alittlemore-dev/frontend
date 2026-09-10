import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LoginPageComponent } from './login-page.component';
import { AuthService } from '../../../../core/auth/auth.service';
import { AuthModalService } from '../../../../core/auth/auth-modal.service';
import { provideI18nTesting } from '../../../../testing/i18n-testing';

describe('LoginPageComponent', () => {
  let fixture: ComponentFixture<LoginPageComponent>;
  let component: LoginPageComponent;
  let mockAuthService: { login: jest.Mock };
  let mockAuthModalService: { closeLogin: jest.Mock };

  beforeEach(async () => {
    mockAuthService = { login: jest.fn() };
    mockAuthModalService = { closeLogin: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [LoginPageComponent],
      providers: [
        provideRouter([]),
        provideI18nTesting(),
        { provide: AuthService, useValue: mockAuthService },
        { provide: AuthModalService, useValue: mockAuthModalService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders username and password fields', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('#login-modal')).not.toBeNull();
    expect(compiled.querySelector('.modal.force-display-block')).not.toBeNull();
    expect(compiled.querySelector('#username')).not.toBeNull();
    expect(compiled.querySelector('#password')).not.toBeNull();
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

  it('renders content-staff-only login warning', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const alert = compiled.querySelector('.alert-warning');

    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain(
      'Пока только для владельца, администраторов и модераторов',
    );
    expect(alert?.textContent).toContain('обычных пользователей');
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

    expect(mockAuthModalService.closeLogin).toHaveBeenCalled();
  });
});
