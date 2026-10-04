import { CdkDrag, CdkDropList } from '@angular/cdk/drag-drop';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ResumeReorderDirective } from './resume-reorder.directive';
import { ResumeEditorSectionComponent } from './components/resume-editor-section/resume-editor-section.component';

@Component({
  imports: [CdkDrag, ResumeReorderDirective],
  template: `<div cdkDrag appResumeReorder (reorderStep)="step.set($event)">
    <button class="resume-section-toggle" (click)="expanded.set(!expanded())">Toggle</button>
    <input aria-label="Text" />
    <button (click)="removed.set(true)">Remove</button>
  </div>`,
})
class HostComponent {
  readonly expanded = signal(false);
  readonly removed = signal(false);
  readonly step = signal(0);
}

@Component({
  imports: [CdkDrag, CdkDropList, ResumeReorderDirective, ResumeEditorSectionComponent],
  template: `<div cdkDropList>
    <app-resume-editor-section
      cdkDrag
      appResumeReorder
      sectionKey="expanded"
      title="Company"
      summary="Engineer"
      backToStartLabel="Back to section start"
      [expanded]="true"
      style="height: 900px"
    >
      <input id="expanded-role" aria-label="Role" />
    </app-resume-editor-section>
  </div>`,
})
class ExpandedGroupHostComponent {}

describe('ResumeReorderDirective', () => {
  function create(): ReturnType<typeof TestBed.createComponent<HostComponent>> {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    document.body.append(fixture.nativeElement);
    return fixture;
  }
  function mouse(target: Element | Document, type: string, x: number): void {
    target.dispatchEvent(
      new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        button: 0,
        buttons: 1,
        detail: 1,
        clientX: x,
        clientY: 10,
      }),
    );
  }
  function touch(target: Element | Document, type: string, x: number): TouchEvent {
    const point = { identifier: 1, clientX: x, clientY: 10, pageX: x, pageY: 10 } as Touch;
    const event = new TouchEvent(type, {
      bubbles: true,
      cancelable: true,
      touches: type === 'touchend' ? [] : [point],
      targetTouches: type === 'touchend' ? [] : [point],
      changedTouches: [point],
    });
    target.dispatchEvent(event);
    return event;
  }
  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps an ordinary click as disclosure and starts dragging only after holding', () => {
    jest.useFakeTimers();
    const fixture = create();
    const toggle = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    mouse(toggle, 'mousedown', 10);
    jest.advanceTimersByTime(80);
    mouse(document, 'mouseup', 10);
    toggle.click();
    expect(fixture.componentInstance.expanded()).toBe(true);
    const drag = fixture.debugElement.query(By.directive(CdkDrag)).injector.get(CdkDrag);
    const started = jest.fn();
    drag.started.subscribe(started);
    mouse(toggle, 'mousedown', 10);
    jest.advanceTimersByTime(159);
    expect(started).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    mouse(document, 'mousemove', 30);
    expect(started).toHaveBeenCalledTimes(1);
    toggle.click();
    expect(fixture.componentInstance.expanded()).toBe(true);
    mouse(document, 'mouseup', 30);
    fixture.destroy();
  });

  it('preserves focused text selection and excludes deletion actions from dragging', () => {
    jest.useFakeTimers();
    const fixture = create();
    const drag = fixture.debugElement.query(By.directive(CdkDrag)).injector.get(CdkDrag);
    const started = jest.fn();
    drag.started.subscribe(started);
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.focus();
    mouse(input, 'mousedown', 10);
    jest.advanceTimersByTime(500);
    mouse(document, 'mousemove', 30);
    expect(started).not.toHaveBeenCalled();
    mouse(document, 'mouseup', 30);
    const remove = fixture.nativeElement.querySelectorAll('button')[1] as HTMLButtonElement;
    mouse(remove, 'mousedown', 10);
    jest.advanceTimersByTime(500);
    mouse(document, 'mousemove', 30);
    expect(started).not.toHaveBeenCalled();
    remove.click();
    expect(fixture.componentInstance.removed()).toBe(true);
    fixture.destroy();
  });

  it('lets movement before the hold delay cancel the drag', () => {
    jest.useFakeTimers();
    const fixture = create();
    const drag = fixture.debugElement.query(By.directive(CdkDrag)).injector.get(CdkDrag);
    const started = jest.fn();
    drag.started.subscribe(started);
    mouse(fixture.nativeElement.querySelector('button'), 'mousedown', 10);
    mouse(document, 'mousemove', 30);
    jest.advanceTimersByTime(500);
    mouse(document, 'mousemove', 50);
    expect(started).not.toHaveBeenCalled();
    mouse(document, 'mouseup', 50);
    fixture.destroy();
  });

  it('lets an early touch swipe scroll and starts a held touch after a short delay', () => {
    jest.useFakeTimers();
    const fixture = create();
    const toggle = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    const drag = fixture.debugElement.query(By.directive(CdkDrag)).injector.get(CdkDrag);
    const started = jest.fn();
    drag.started.subscribe(started);
    touch(toggle, 'touchstart', 10);
    const swipe = touch(document, 'touchmove', 30);
    jest.advanceTimersByTime(300);
    touch(document, 'touchmove', 50);
    expect(started).not.toHaveBeenCalled();
    expect(swipe.defaultPrevented).toBe(false);
    touch(document, 'touchend', 50);
    touch(toggle, 'touchstart', 10);
    jest.advanceTimersByTime(239);
    expect(started).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    const heldMove = touch(document, 'touchmove', 30);
    expect(started).toHaveBeenCalledTimes(1);
    expect(heldMove.defaultPrevented).toBe(true);
    touch(document, 'touchend', 30);
    fixture.destroy();
  });

  it('keeps the full height of an expanded group in its placeholder without duplicate ids', async () => {
    jest.useFakeTimers();
    TestBed.configureTestingModule({ imports: [ExpandedGroupHostComponent] });
    const fixture = TestBed.createComponent(ExpandedGroupHostComponent);
    fixture.detectChanges();
    document.body.append(fixture.nativeElement);
    const group = fixture.nativeElement.querySelector('app-resume-editor-section') as HTMLElement;
    const originalHeight = getComputedStyle(group).height;
    mouse(group.querySelector('button')!, 'mousedown', 10);
    jest.advanceTimersByTime(400);
    mouse(document, 'mousemove', 30);
    const placeholder = fixture.nativeElement.querySelector('.cdk-drag-placeholder') as HTMLElement;
    expect(placeholder).not.toBeNull();
    expect(getComputedStyle(placeholder).height).toBe(originalHeight);
    expect(placeholder.getAttribute('aria-hidden')).toBe('true');
    expect(placeholder.querySelectorAll('[id]')).toHaveLength(0);
    expect(document.querySelectorAll('#expanded-role')).toHaveLength(1);
    mouse(document, 'mouseup', 30);
    await Promise.resolve();
    fixture.destroy();
  });
});
