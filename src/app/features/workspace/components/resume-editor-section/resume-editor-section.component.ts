import { DOCUMENT } from '@angular/common';
import { CdkDragHandle, CdkDragPreview } from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'app-resume-editor-section',
  imports: [CdkDragHandle, CdkDragPreview],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './resume-editor-section.component.html',
  styleUrl: './resume-editor-section.component.scss',
  host: { '[class.resume-nested-section]': 'nested()' },
})
export class ResumeEditorSectionComponent {
  readonly sectionKey = input.required<string>();
  readonly title = input.required<string>();
  readonly summary = input.required<string>();
  readonly expanded = input.required<boolean>();
  readonly backToStartLabel = input.required<string>();
  readonly nested = input(false);
  readonly invalid = input(false);
  readonly reorderHelpId = input<string | null>(null);
  readonly expandedChange = output<boolean>();
  readonly stuck = signal(false);
  private readonly document = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly marker = viewChild.required<ElementRef<HTMLElement>>('marker');
  private readonly header = viewChild.required<ElementRef<HTMLElement>>('header');
  private readonly toggle = viewChild.required<ElementRef<HTMLButtonElement>>('toggle');

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const browser = this.document.defaultView;
      if (!browser?.IntersectionObserver) return;
      const offset =
        Number.parseFloat(browser.getComputedStyle(this.header().nativeElement).top) || 0;
      const observer = new browser.IntersectionObserver(
        ([entry]) => {
          if (entry) this.stuck.set(!entry.isIntersecting && entry.boundingClientRect.top < offset);
        },
        { rootMargin: `-${offset}px 0px 0px 0px`, threshold: 0 },
      );
      observer.observe(this.marker().nativeElement);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  backToStart(): void {
    const browser = this.document.defaultView;
    if (!browser) return;
    const reducedMotion = browser.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.host.nativeElement.scrollIntoView({
      block: 'start',
      behavior: reducedMotion ? 'instant' : 'smooth',
    });
    this.toggle().nativeElement.focus({ preventScroll: true });
  }
}
