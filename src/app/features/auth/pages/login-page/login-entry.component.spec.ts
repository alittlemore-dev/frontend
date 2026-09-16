import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { AuthModalService } from '../../../../core/auth/auth-modal.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { LoginEntryComponent } from './login-entry.component';

describe('LoginEntryComponent', () => {
  function setup(loggedIn: boolean, returnUrl: string) {
    TestBed.configureTestingModule({
      imports: [LoginEntryComponent],
      providers: [
        provideRouter([]),
        provideI18nTesting(),
        { provide: AuthService, useValue: { isLoggedIn: () => loggedIn } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({ returnUrl }) } },
        },
      ],
    });
    const navigate = jest.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(LoginEntryComponent);
    fixture.detectChanges();
    return { fixture, navigate, modal: TestBed.inject(AuthModalService) };
  }

  it('opens the shared login host for anonymous deep links', () => {
    const { fixture, modal, navigate } = setup(false, '/personal-workspace/resumes/123');
    expect(modal.isLoginOpen()).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
    expect(modal.completeLogin()).toBe('/personal-workspace/resumes/123');
    fixture.destroy();
  });

  it('returns authenticated visitors directly to the protected destination', () => {
    const { navigate, modal } = setup(true, '/personal-workspace');
    expect(navigate).toHaveBeenCalledWith('/personal-workspace');
    expect(modal.isLoginOpen()).toBe(false);
  });

  it('does not redirect authenticated visitors to an external return URL', () => {
    const { navigate } = setup(true, 'https://external.example');
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(String(navigate.mock.calls[0][0])).toBe('/ru/how-this-site-is-built');
  });
});
