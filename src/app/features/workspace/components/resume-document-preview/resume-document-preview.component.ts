import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import {
  ResumeExportFormat,
  ResumePayload,
  ResumeTheme,
} from '../../models/resume-workspace.model';
import { resumeDocumentBlocks } from './resume-document.model';

@Component({
  selector: 'app-resume-document-preview',
  imports: [TranslatePipe],
  templateUrl: './resume-document-preview.component.html',
  styleUrl: './resume-document-preview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResumeDocumentPreviewComponent {
  readonly payload = input.required<ResumePayload>();
  readonly theme = input.required<ResumeTheme>();
  readonly format = input.required<ResumeExportFormat>();
  readonly estimatedPageCount = output<number | null>();
  readonly fit = signal(true);
  readonly viewportWidth = signal(794);
  readonly paperWidth = computed(() => (this.format() === 'docx' ? 816 : (210 * 96) / 25.4));
  readonly scale = computed(() =>
    this.fit() ? Math.min(1, this.viewportWidth() / this.paperWidth()) : 1,
  );
  private readonly viewport = viewChild.required<ElementRef<HTMLElement>>('viewport');
  private readonly paper = viewChild.required<ElementRef<HTMLElement>>('paper');
  private readonly document = inject(DOCUMENT);
  private readonly i18n = inject(I18nService);
  readonly blocks = computed(() =>
    resumeDocumentBlocks(this.payload(), this.theme(), this.format(), (key) =>
      this.i18n.translateForLanguage(this.payload().language, key),
    ),
  );

  constructor() {
    const browserWindow = this.document.defaultView;
    const destroyRef = inject(DestroyRef);
    const injector = inject(Injector);
    effect(() => {
      this.payload();
      this.theme();
      this.format();
      this.estimatedPageCount.emit(null);
      afterNextRender(() => this.measurePaper(), { injector });
    });
    afterNextRender(() => {
      if (!browserWindow) return;
      const fonts = this.document.fonts;
      if (fonts) {
        const fontsLoaded = (): void => this.measurePaper();
        fonts.addEventListener('loadingdone', fontsLoaded);
        void fonts.ready.then(() => {
          if (!destroyRef.destroyed) this.measurePaper();
        });
        destroyRef.onDestroy(() => fonts.removeEventListener('loadingdone', fontsLoaded));
      }
      if (!browserWindow.ResizeObserver) return;
      const element = this.viewport().nativeElement;
      const observer = new browserWindow.ResizeObserver((entries) => {
        const width = entries.find((entry) => entry.target === element)?.contentRect.width;
        if (width) this.viewportWidth.set(width);
        this.measurePaper();
      });
      this.viewportWidth.set(element.clientWidth);
      observer.observe(element);
      observer.observe(this.paper().nativeElement);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  private measurePaper(): void {
    const browserWindow = this.document.defaultView;
    if (!browserWindow || this.document.fonts?.status === 'loading') return;
    const element = this.paper().nativeElement;
    const bounds = element.getBoundingClientRect();
    const style = browserWindow.getComputedStyle(element);
    const width = Number.parseFloat(style.width);
    const padding = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom);
    const pageHeight = this.format() === 'docx' ? 11 * 96 : (297 * 96) / 25.4;
    // Accent PDF reserves a separate footer frame; match the backend's 742pt content frame.
    const availableHeight =
      this.format() === 'pdf' && this.theme() === 'accent' ? (742 * 96) / 72 : pageHeight - padding;
    if (
      bounds.width <= 0 ||
      bounds.height <= 0 ||
      !Number.isFinite(width) ||
      width <= 0 ||
      !Number.isFinite(availableHeight) ||
      availableHeight <= 0
    )
      return;
    // Normalize fit-width zoom before comparing the continuous paper with printable pages.
    const contentHeight = (bounds.height * width) / bounds.width - padding;
    const pages = Math.max(1, Math.ceil((contentHeight - 1) / availableHeight));
    this.estimatedPageCount.emit(pages);
  }
}
