import { Directive, DestroyRef, ElementRef, inject, input } from '@angular/core';
import { ModalPageScrollLockService } from './modal-page-scroll-lock.service';

const WHEEL_DELTA_LINE = 1;
const WHEEL_DELTA_PAGE = 2;
const LINE_SCROLL_PIXELS = 16;

interface ModalTouchScrollState {
  area: HTMLElement;
  clientY: number;
}

@Directive({
  selector: '[appModalScroll]',
  standalone: true,
  host: {
    '(wheel)': 'handleWheel($event)',
    '(touchstart)': 'handleTouchStart($event)',
    '(touchmove)': 'handleTouchMove($event)',
    '(touchend)': 'clearTouchState()',
    '(touchcancel)': 'clearTouchState()',
  },
})
export class ModalScrollDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly pageScrollLock = inject(ModalPageScrollLockService);
  private readonly destroyRef = inject(DestroyRef);
  private touchState: ModalTouchScrollState | null = null;

  readonly appModalScroll = input.required<HTMLElement>();

  constructor() {
    const releasePageScroll = this.pageScrollLock.acquire();
    this.destroyRef.onDestroy(releasePageScroll);
  }

  handleWheel(event: WheelEvent): void {
    const preferredArea = this.appModalScroll();
    if (containsEventTarget(preferredArea, event.target)) return;

    const scrollArea = this.availableScrollArea(preferredArea);
    if (scrollArea === null) return;

    const delta = wheelDeltaPixels(event, scrollArea.clientHeight);
    if (delta === 0) return;

    scrollElement(scrollArea, delta);
    event.preventDefault();
  }

  handleTouchStart(event: TouchEvent): void {
    const touch = singleTouch(event);
    if (touch === null) return;

    const preferredArea = this.appModalScroll();
    if (containsEventTarget(preferredArea, event.target)) return;

    const scrollArea = this.availableScrollArea(preferredArea);
    if (scrollArea === null) return;
    this.touchState = { area: scrollArea, clientY: touch.clientY };
  }

  handleTouchMove(event: TouchEvent): void {
    const touch = singleTouch(event);
    if (this.touchState === null || touch === null) return;

    const delta = this.touchState.clientY - touch.clientY;
    this.touchState.clientY = touch.clientY;
    if (delta === 0) return;

    scrollElement(this.touchState.area, delta);
    event.preventDefault();
  }

  clearTouchState(): void {
    this.touchState = null;
  }

  private availableScrollArea(preferredArea: HTMLElement): HTMLElement | null {
    if (isScrollable(preferredArea)) return preferredArea;
    return isScrollable(this.host) ? this.host : null;
  }
}

function containsEventTarget(container: HTMLElement, target: EventTarget | null): boolean {
  const nodeConstructor = container.ownerDocument.defaultView?.Node;
  return (
    nodeConstructor !== undefined && target instanceof nodeConstructor && container.contains(target)
  );
}

function isScrollable(element: HTMLElement): boolean {
  return element.scrollHeight > element.clientHeight;
}

function wheelDeltaPixels(event: WheelEvent, pageHeight: number): number {
  if (event.deltaMode === WHEEL_DELTA_LINE) return event.deltaY * LINE_SCROLL_PIXELS;
  if (event.deltaMode === WHEEL_DELTA_PAGE) return event.deltaY * pageHeight;
  return event.deltaY;
}

function scrollElement(element: HTMLElement, delta: number): void {
  const maximum = Math.max(0, element.scrollHeight - element.clientHeight);
  element.scrollTop = Math.min(maximum, Math.max(0, element.scrollTop + delta));
}

function singleTouch(event: TouchEvent): Touch | null {
  return event.touches.length === 1 ? event.touches.item(0) : null;
}
