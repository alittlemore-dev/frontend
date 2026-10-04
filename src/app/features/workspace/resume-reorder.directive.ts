import { DOCUMENT } from '@angular/common';
import { CdkDrag } from '@angular/cdk/drag-drop';
import {
  DestroyRef,
  Directive,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Directive({ selector: '[appResumeReorder]', host: { class: 'resume-reorderable' } })
export class ResumeReorderDirective {
  readonly appResumeReorderDisabled = input(false);
  readonly reorderStep = output<number>();
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly document = inject(DOCUMENT);
  private readonly drag = inject(CdkDrag, { self: true });
  private suppressClick = false;
  private releaseTimer: number | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);
    // Leave time for a click or touch scroll without making an intentional hold feel slow.
    this.drag.dragStartDelay = { mouse: 160, touch: 240 };
    this.drag.previewContainer = 'parent';
    effect(() => {
      this.drag.disabled = this.appResumeReorderDisabled();
    });
    this.drag.started.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => {
      this.suppressClick = true;
      this.drag.getPlaceholderElement()?.setAttribute('aria-hidden', 'true');
      const active = this.document.activeElement;
      if (this.document.defaultView && active instanceof HTMLElement && this.host.contains(active))
        active.blur();
    });
    this.drag.ended.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => {
      const browser = this.document.defaultView;
      if (browser)
        this.releaseTimer = browser.setTimeout(() => {
          this.suppressClick = false;
          this.releaseTimer = null;
        }, 0);
    });
    destroyRef.onDestroy(() => {
      if (this.releaseTimer !== null) this.document.defaultView?.clearTimeout(this.releaseTimer);
    });
    afterNextRender(() => {
      if (!this.document.defaultView) return;
      const prepare = (event: Event): void => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const own = target.closest('[appResumeReorder]') === this.host;
        const field = target.closest('input, textarea, select, [contenteditable="true"]');
        const action = target.closest('button, a, summary, label, [role="combobox"]');
        const allowed =
          own &&
          (!field || this.document.activeElement !== field) &&
          (!action || action.classList.contains('resume-section-toggle'));
        this.drag.disabled = this.appResumeReorderDisabled() || !allowed;
      };
      const click = (event: Event): void => {
        if (this.suppressClick) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      };
      const keyboard = (event: KeyboardEvent): void => {
        if (
          event.target instanceof Element &&
          event.target.closest('[appResumeReorder]') !== this.host
        )
          return;
        if (!event.altKey || event.ctrlKey || event.metaKey || this.appResumeReorderDisabled())
          return;
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
        event.preventDefault();
        event.stopPropagation();
        this.reorderStep.emit(event.key === 'ArrowUp' ? -1 : 1);
      };
      this.host.addEventListener('mousedown', prepare, true);
      this.host.addEventListener('touchstart', prepare, { capture: true, passive: true });
      this.host.addEventListener('click', click, true);
      this.host.addEventListener('keydown', keyboard);
      destroyRef.onDestroy(() => {
        this.host.removeEventListener('mousedown', prepare, true);
        this.host.removeEventListener('touchstart', prepare, true);
        this.host.removeEventListener('click', click, true);
        this.host.removeEventListener('keydown', keyboard);
      });
    });
  }
}
