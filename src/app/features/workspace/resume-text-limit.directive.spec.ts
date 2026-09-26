import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { provideI18nTesting } from '../../testing/i18n-testing';
import { ResumeTextLimitDirective } from './resume-text-limit.directive';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, ResumeTextLimitDirective],
  template: `
    <form [formGroup]="form">
      <label for="test-resume-text">Text</label>
      <input id="test-resume-text" formControlName="text" [appResumeTextLimit]="5" />
    </form>
  `,
})
class TestHostComponent {
  readonly form = new FormGroup({
    text: new FormControl('abc', { nonNullable: true, validators: Validators.maxLength(5) }),
  });
}

describe('ResumeTextLimitDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [provideI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
  });

  it('shows the current length and marks an overflow immediately', () => {
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    const counter = fixture.nativeElement.querySelector('#test-resume-text-limit') as HTMLElement;
    expect(counter.textContent).toBe('3/5');
    expect(input.getAttribute('aria-describedby')).toContain(counter.id);

    input.value = '123456';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(counter.textContent).toBe('6/5');
    expect(counter.getAttribute('aria-label')).toContain('Превышен лимит');
    expect(input.classList).toContain('resume-limit-exceeded');

    fixture.componentInstance.form.controls.text.setValue('12345');
    fixture.detectChanges();
    expect(counter.textContent).toBe('5/5');
    expect(input.classList).not.toContain('resume-limit-exceeded');
    expect(counter.classList).toContain('resume-limit-near');
  });
});
