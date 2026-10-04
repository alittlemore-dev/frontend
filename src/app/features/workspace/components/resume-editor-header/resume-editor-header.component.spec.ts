import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { chooseSiteSelectOption } from '@alittlemore.dev/design-system/testing';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { ResumeEditorHeaderComponent } from './resume-editor-header.component';

@Component({
  imports: [ReactiveFormsModule, ResumeEditorHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<form [formGroup]="form">
    <app-resume-editor-header
      [ready]="true"
      [languageOptions]="options"
      [titleMax]="255"
      [titleInvalid]="invalid()"
      [titleMessage]="'Title is required'"
      [saveDisabled]="disabled()"
      (save)="save()"
    />
  </form>`,
})
class HeaderHostComponent {
  readonly form = new FormGroup({
    title: new FormControl('Backend resume', { nonNullable: true }),
    language: new FormControl('ru', { nonNullable: true }),
  });
  readonly options = [
    { value: 'ru', label: 'RU' },
    { value: 'en', label: 'EN' },
  ];
  readonly save = jest.fn();
  readonly invalid = signal(false);
  readonly disabled = signal(false);
}

describe('ResumeEditorHeaderComponent', () => {
  let fixture: ComponentFixture<HeaderHostComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HeaderHostComponent],
      providers: [provideI18nTesting()],
    });
    fixture = TestBed.createComponent(HeaderHostComponent);
    fixture.detectChanges();
  });

  it('edits the existing parent form controls and emits save', () => {
    const title = fixture.nativeElement.querySelector('#resume-title') as HTMLInputElement;
    title.value = 'Updated resume';
    title.dispatchEvent(new Event('input'));
    chooseSiteSelectOption(fixture, '#resume-language', 'en');
    expect(fixture.componentInstance.form.getRawValue()).toEqual({
      title: 'Updated resume',
      language: 'en',
    });
    const save = fixture.nativeElement.querySelector(
      'button[aria-label="Сохранить"]',
    ) as HTMLButtonElement;
    save.click();
    expect(fixture.componentInstance.save).toHaveBeenCalledTimes(1);
  });

  it('keeps invalid title feedback and disables save while busy', () => {
    fixture.componentInstance.invalid.set(true);
    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#resume-title').classList).toContain('is-invalid');
    expect(fixture.nativeElement.textContent).toContain('Title is required');
    const save = fixture.nativeElement.querySelector(
      'button[aria-label="Сохранить"]',
    ) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    save.click();
    expect(fixture.componentInstance.save).not.toHaveBeenCalled();
  });
});
