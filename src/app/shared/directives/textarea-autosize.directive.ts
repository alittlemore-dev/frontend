import { isPlatformBrowser } from '@angular/common';
import {
  DestroyRef,
  Directive,
  ElementRef,
  NgZone,
  PLATFORM_ID,
  afterEveryRender,
  afterNextRender,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgControl } from '@angular/forms';

@Directive({
  selector: 'textarea[appTextareaAutosize]',
  standalone: true,
  host: {
    class: 'app-textarea-autosize',
    rows: '1',
    '(input)': 'onInput()',
  },
})
export class TextareaAutosizeDirective {
  private readonly element = inject<ElementRef<HTMLTextAreaElement>>(ElementRef);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly zone = inject(NgZone);
  private resizeFrame: number | undefined;
  private previousValue: string | undefined;

  constructor() {
    if (!this.browser) return;
    const textarea = this.element.nativeElement;
    const destroyRef = inject(DestroyRef);
    const control = inject(NgControl, { self: true, optional: true });
    const browserWindow = textarea.ownerDocument.defaultView;
    let observer: ResizeObserver | undefined;
    destroyRef.onDestroy(() => {
      observer?.disconnect();
      if (this.resizeFrame !== undefined) browserWindow?.cancelAnimationFrame(this.resizeFrame);
    });

    afterNextRender({
      mixedReadWrite: () => {
        this.resize();
        this.zone.runOutsideAngular(() => {
          control?.valueChanges
            ?.pipe(takeUntilDestroyed(destroyRef))
            .subscribe(() => this.scheduleResize());

          const ResizeObserverConstructor = browserWindow?.ResizeObserver;
          if (!ResizeObserverConstructor) return;
          let previousWidth = textarea.getBoundingClientRect().width;
          observer = new ResizeObserverConstructor((entries) => {
            const width = entries[0]?.contentRect.width;
            if (width === undefined || width === previousWidth) return;
            previousWidth = width;
            if (width > 0) this.resize();
          });
          observer.observe(textarea);
        });
      },
    });

    afterEveryRender({
      mixedReadWrite: () => {
        if (textarea.value !== this.previousValue) this.resize();
      },
    });
  }

  onInput(): void {
    this.scheduleResize();
  }

  private scheduleResize(): void {
    if (!this.browser || this.resizeFrame !== undefined) return;
    const browserWindow = this.element.nativeElement.ownerDocument.defaultView;
    if (!browserWindow) return;
    if (!browserWindow.requestAnimationFrame) {
      this.resize();
      return;
    }
    this.zone.runOutsideAngular(() => {
      this.resizeFrame = browserWindow.requestAnimationFrame(() => {
        this.resizeFrame = undefined;
        this.resize();
      });
    });
  }

  private resize(): void {
    const textarea = this.element.nativeElement;
    const browserWindow = textarea.ownerDocument.defaultView;
    if (!this.browser || !browserWindow) return;

    const previousHeight = textarea.style.height;
    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    if (scrollHeight === 0) {
      textarea.style.height = previousHeight;
      return;
    }

    const styles = browserWindow.getComputedStyle(textarea);
    const padding = (parseFloat(styles.paddingTop) || 0) + (parseFloat(styles.paddingBottom) || 0);
    const borders =
      (parseFloat(styles.borderTopWidth) || 0) + (parseFloat(styles.borderBottomWidth) || 0);
    const height =
      styles.boxSizing === 'border-box' ? scrollHeight + borders : scrollHeight - padding;
    textarea.style.height = `${Math.ceil(height)}px`;
    this.previousValue = textarea.value;
  }
}
