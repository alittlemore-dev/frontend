import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { ResumeDateFormat } from '../../models/resume-workspace.model';
import { ResumeDateFormatSettingsComponent } from './resume-date-format-settings.component';

describe('ResumeDateFormatSettingsComponent', () => {
  function create(): ReturnType<typeof TestBed.createComponent<ResumeDateFormatSettingsComponent>> {
    TestBed.configureTestingModule({
      imports: [ResumeDateFormatSettingsComponent],
      providers: [provideI18nTesting()],
    });
    const fixture = TestBed.createComponent(ResumeDateFormatSettingsComponent);
    fixture.componentRef.setInput(
      'control',
      new FormControl<ResumeDateFormat>('year', { nonNullable: true }),
    );
    fixture.componentRef.setInput('formats', ['monthYear', 'monthYearNumeric', 'fullDate', 'year']);
    fixture.componentRef.setInput('language', 'ru');
    fixture.detectChanges();
    return fixture;
  }

  it('changes the original form control and reflects programmatic changes', () => {
    const fixture = create();
    const numeric = fixture.nativeElement.querySelector(
      '#resume-date-format-monthYearNumeric',
    ) as HTMLInputElement;
    numeric.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.control().value).toBe('monthYearNumeric');
    expect(fixture.componentInstance.control().dirty).toBe(true);
    expect(numeric.checked).toBe(true);
    fixture.componentInstance.control().setValue('fullDate');
    fixture.detectChanges();
    expect(
      (fixture.nativeElement.querySelector('#resume-date-format-fullDate') as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(numeric.checked).toBe(false);
  });

  it('shows date examples in the document language', () => {
    const fixture = create();
    expect(fixture.nativeElement.textContent).toContain('авг. 2024 — янв. 2026');
    fixture.componentRef.setInput('language', 'en');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Aug 2024 — Jan 2026');
    expect(fixture.nativeElement.textContent).toContain('08/19/2024 — 01/15/2026');
  });

  it('retains required semantics, touched state and visible validation feedback', () => {
    const fixture = create();
    const radio = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    radio.dispatchEvent(new Event('blur'));
    expect(fixture.componentInstance.control().touched).toBe(true);
    fixture.componentRef.setInput('invalid', true);
    fixture.componentRef.setInput('message', 'Choose a valid format');
    fixture.detectChanges();
    expect(radio.required).toBe(true);
    expect(radio.classList.contains('is-invalid')).toBe(true);
    expect(fixture.nativeElement.querySelector('fieldset').getAttribute('aria-invalid')).toBe(
      'true',
    );
    expect(
      fixture.nativeElement.querySelector('[id="resume-date-format-error"]').textContent,
    ).toContain('Choose a valid format');
  });
});
