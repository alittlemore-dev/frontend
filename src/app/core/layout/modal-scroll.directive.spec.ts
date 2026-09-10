import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ModalPageScrollLockService } from './modal-page-scroll-lock.service';
import { ModalScrollDirective } from './modal-scroll.directive';

@Component({
  selector: 'app-modal-scroll-test-host',
  standalone: true,
  imports: [ModalScrollDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <section data-testid="modal" [appModalScroll]="scrollArea">
        <header data-testid="modal-header">Header</header>
        <div #scrollArea data-testid="modal-scroll-area">
          <button type="button" data-testid="modal-content">Content</button>
        </div>
      </section>
    }
  `,
})
export class ModalScrollTestHostComponent {
  readonly open = signal(true);
}

describe('ModalScrollDirective', () => {
  let fixture: ComponentFixture<ModalScrollTestHostComponent>;
  let acquire: jest.Mock;
  let release: jest.Mock;

  beforeEach(async () => {
    release = jest.fn();
    acquire = jest.fn(() => release);
    await TestBed.configureTestingModule({
      imports: [ModalScrollTestHostComponent],
      providers: [{ provide: ModalPageScrollLockService, useValue: { acquire } }],
    }).compileComponents();

    fixture = TestBed.createComponent(ModalScrollTestHostComponent);
    fixture.detectChanges();
  });

  it('locks the page while present and releases it when removed', () => {
    expect(acquire).toHaveBeenCalledTimes(1);

    fixture.componentInstance.open.set(false);
    fixture.detectChanges();

    expect(release).toHaveBeenCalledTimes(1);
  });

  it('routes wheel scrolling over modal chrome to the modal body', () => {
    const scrollArea = element('[data-testid="modal-scroll-area"]');
    makeScrollable(scrollArea, 600, 200);
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 80 });

    element('[data-testid="modal-header"]').dispatchEvent(event);

    expect(scrollArea.scrollTop).toBe(80);
    expect(event.defaultPrevented).toBe(true);
  });

  it('preserves native scrolling for events that start inside the modal body', () => {
    const scrollArea = element('[data-testid="modal-scroll-area"]');
    makeScrollable(scrollArea, 600, 200);
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 80 });

    element('[data-testid="modal-content"]').dispatchEvent(event);

    expect(scrollArea.scrollTop).toBe(0);
    expect(event.defaultPrevented).toBe(false);
  });

  it('falls back to scrolling the modal container when its body does not overflow', () => {
    const modal = element('[data-testid="modal"]');
    const scrollArea = element('[data-testid="modal-scroll-area"]');
    makeScrollable(scrollArea, 200, 200);
    makeScrollable(modal, 600, 200);
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 50 });

    element('[data-testid="modal-header"]').dispatchEvent(event);

    expect(modal.scrollTop).toBe(50);
    expect(event.defaultPrevented).toBe(true);
  });

  it('routes touch scrolling that starts outside the modal body', () => {
    const scrollArea = element('[data-testid="modal-scroll-area"]');
    const header = element('[data-testid="modal-header"]');
    makeScrollable(scrollArea, 600, 200);

    header.dispatchEvent(touchEvent('touchstart', 180));
    const move = touchEvent('touchmove', 120);
    header.dispatchEvent(move);
    header.dispatchEvent(new Event('touchend', { bubbles: true }));

    expect(scrollArea.scrollTop).toBe(60);
    expect(move.defaultPrevented).toBe(true);
  });

  function element(selector: string): HTMLElement {
    return fixture.debugElement.query(By.css(selector)).nativeElement as HTMLElement;
  }
});

function makeScrollable(element: HTMLElement, scrollHeight: number, clientHeight: number): void {
  Object.defineProperty(element, 'scrollHeight', { configurable: true, value: scrollHeight });
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: clientHeight });
  element.scrollTop = 0;
}

function touchEvent(type: string, clientY: number): TouchEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as TouchEvent;
  const touch = { clientY } as Touch;
  const touches = Object.assign([touch], {
    item: (index: number): Touch | null => (index === 0 ? touch : null),
  }) as unknown as TouchList;
  Object.defineProperty(event, 'touches', { value: touches });
  return event;
}
