import { Directive, ElementRef, Injectable, OnDestroy, inject } from '@angular/core';
import { AbstractControl, NgControl } from '@angular/forms';

@Injectable()
export class WorkspaceFieldFocusService {
  private readonly targets = new Set<WorkspaceFieldTargetDirective>();

  register(target: WorkspaceFieldTargetDirective): void {
    this.targets.add(target);
  }
  unregister(target: WorkspaceFieldTargetDirective): void {
    this.targets.delete(target);
  }
  focus(control: AbstractControl<unknown> | null = null): void {
    const target = [...this.targets].find((item) =>
      control ? item.control === control : item.invalid,
    );
    target?.focus();
  }
}

@Directive({ selector: '[appWorkspaceFieldTarget]', standalone: true })
export class WorkspaceFieldTargetDirective implements OnDestroy {
  private readonly ngControl = inject(NgControl, { self: true });
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly fields = inject(WorkspaceFieldFocusService, { optional: true });

  get control(): AbstractControl<unknown> | null {
    return this.ngControl.control;
  }
  get invalid(): boolean {
    const control = this.control;
    return !!control && !control.disabled && (control.invalid || !!control.parent?.errors);
  }
  constructor() {
    this.fields?.register(this);
  }
  ngOnDestroy(): void {
    this.fields?.unregister(this);
  }
  focus(): void {
    const host = this.element.nativeElement;
    if (!host.ownerDocument.defaultView) return;
    const field = host.matches('input, textarea, select, button')
      ? host
      : host.querySelector<HTMLElement>('input, textarea, select, button, [tabindex="0"]');
    field?.scrollIntoView?.({ block: 'center', behavior: 'instant' });
    field?.focus({ preventScroll: true });
  }
}
