import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  CSP_NONCE,
  Directive,
  ElementRef,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  inject,
  input,
} from '@angular/core';

const BOTTOM_INSET_PROPERTY = '--markdown-editor-sticky-bottom-inset';
const SCOPE_ATTRIBUTE = 'data-markdown-editor-sticky-bottom-inset-scope';

let stickyBottomInsetScopeId = 0;

@Directive({
  selector: '[appMarkdownEditorStickyBottomInset]',
  standalone: true,
})
export class MarkdownEditorStickyBottomInsetDirective implements OnInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly cspNonce = inject(CSP_NONCE);
  private observer: ResizeObserver | null = null;
  private styleElement: HTMLStyleElement | null = null;
  private scope: HTMLElement | null = null;
  private scopeId: string | null = null;

  readonly appMarkdownEditorStickyBottomInset = input.required<HTMLElement>();

  ngOnInit(): void {
    const browserWindow = this.document.defaultView;
    if (
      !isPlatformBrowser(this.platformId) ||
      browserWindow === null ||
      typeof browserWindow.ResizeObserver !== 'function' ||
      this.document.head === null
    ) {
      return;
    }

    const scope = this.appMarkdownEditorStickyBottomInset();
    if (scope.ownerDocument !== this.document) {
      return;
    }
    const scopeId = `markdown-editor-sticky-bottom-inset-${++stickyBottomInsetScopeId}`;
    const styleElement = this.document.createElement('style');
    if (this.cspNonce !== null) {
      styleElement.setAttribute('nonce', this.cspNonce);
    }
    const observer = new browserWindow.ResizeObserver((entries) => {
      const entry = entries.find((candidate) => candidate.target === this.host);
      const blockSize = entry?.borderBoxSize[0]?.blockSize;
      if (blockSize === undefined || !Number.isFinite(blockSize)) {
        return;
      }
      const roundedBlockSize = Math.ceil(Math.max(0, blockSize));
      styleElement.textContent =
        `[${SCOPE_ATTRIBUTE}="${scopeId}"] { ` +
        `${BOTTOM_INSET_PROPERTY}: ${roundedBlockSize}px; }`;
    });
    try {
      scope.setAttribute(SCOPE_ATTRIBUTE, scopeId);
      this.document.head.append(styleElement);
      observer.observe(this.host, { box: 'border-box' });
    } catch {
      observer.disconnect();
      styleElement.remove();
      if (scope.getAttribute(SCOPE_ATTRIBUTE) === scopeId) {
        scope.removeAttribute(SCOPE_ATTRIBUTE);
      }
      return;
    }

    this.scope = scope;
    this.scopeId = scopeId;
    this.styleElement = styleElement;
    this.observer = observer;
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.styleElement?.remove();
    this.styleElement = null;
    if (
      this.scope !== null &&
      this.scopeId !== null &&
      this.scope.getAttribute(SCOPE_ATTRIBUTE) === this.scopeId
    ) {
      this.scope.removeAttribute(SCOPE_ATTRIBUTE);
    }
    this.scope = null;
    this.scopeId = null;
  }
}
