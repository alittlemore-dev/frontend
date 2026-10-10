import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  WorkspaceFieldFocusService,
  WorkspaceFieldTargetDirective,
} from './form-field-focus.directive';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, WorkspaceFieldTargetDirective],
  providers: [WorkspaceFieldFocusService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<form [formGroup]="form">
    <input appWorkspaceFieldTarget formControlName="name" />
    <div formGroupName="nested">
      <textarea appWorkspaceFieldTarget formControlName="name"></textarea>
    </div>
  </form>`,
})
class FormHostComponent {
  readonly fields = inject(WorkspaceFieldFocusService);
  readonly form = new FormGroup({
    name: new FormControl('', Validators.required),
    nested: new FormGroup({ name: new FormControl('', Validators.required) }),
  });
}

describe('WorkspaceFieldFocusService', () => {
  it('focuses a field in a group whose cross-field validation fails', () => {
    const fixture = TestBed.createComponent(FormHostComponent);
    fixture.detectChanges();
    fixture.componentInstance.form.controls.name.setValue('Valid');
    fixture.componentInstance.form.controls.nested.controls.name.setValue('Valid');
    fixture.componentInstance.form.controls.nested.setErrors({ range: true });
    const focus = jest.spyOn(fixture.nativeElement.querySelector('textarea'), 'focus');
    fixture.componentInstance.fields.focus();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });
  it('focuses the exact control even when a nested group repeats its name', () => {
    const fixture = TestBed.createComponent(FormHostComponent);
    fixture.detectChanges();
    const field = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    const focus = jest.spyOn(field, 'focus');
    fixture.componentInstance.fields.focus(
      fixture.componentInstance.form.controls.nested.controls.name,
    );
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });
  it('focuses the first invalid control and releases destroyed fields', () => {
    const fixture = TestBed.createComponent(FormHostComponent);
    fixture.detectChanges();
    const field = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    const focus = jest.spyOn(field, 'focus');
    fixture.componentInstance.fields.focus();
    expect(focus).toHaveBeenCalledTimes(1);
    fixture.destroy();
    fixture.componentInstance.fields.focus();
    expect(focus).toHaveBeenCalledTimes(1);
  });
});
