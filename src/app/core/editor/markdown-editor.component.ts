import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  CSP_NONCE,
  DestroyRef,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  ViewEncapsulation,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  acceptCompletion,
  closeBracketsKeymap,
  completionStatus,
  nextSnippetField,
  prevSnippetField,
  snippet,
} from '@codemirror/autocomplete';
import { defaultKeymap, historyKeymap, indentLess, indentMore } from '@codemirror/commands';
import { openSearchPanel, searchKeymap } from '@codemirror/search';
import {
  Compartment,
  EditorSelection,
  EditorState,
  Transaction,
  type Extension,
} from '@codemirror/state';
import {
  EditorView,
  drawSelection,
  keymap,
  panels,
  type Rect,
  type ViewUpdate,
} from '@codemirror/view';
import { LanguageCode } from '../i18n/i18n.model';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { ModalPageScrollLockService } from '../layout/modal-page-scroll-lock.service';
import { WikiLinkRendererService } from '../wiki-links/wiki-link-renderer.service';
import { WikiLinkTargetsService } from '../wiki-links/wiki-link-targets.service';
import { parseWikiLinks, wikiLinkPath } from '../wiki-links/wiki-links';
import {
  MARKDOWN_EDITOR_COMMANDS,
  MARKDOWN_EDITOR_SHORTCUT_GROUPS,
  MarkdownEditorCommandDefinition,
  MarkdownEditorCommandId,
  MarkdownKeyboardEvent,
  MarkdownSelection,
  MarkdownTransactionResult,
  applyMarkdownCommandTransaction,
  autoCloseMarkdownFenceTransaction,
  continueMarkdownBlockTransaction,
  findMarkdownEditorCommand,
  formatMarkdownShortcut,
  indentMarkdownLinesTransaction,
} from './markdown-editor.commands';
import { EditorImageUploadService } from './editor-image-upload.service';
import {
  markdownEditorCspExtension,
  markdownEditorFoundationExtensions,
} from './markdown-editor.extensions';
import { markdownPresentation } from './markdown-editor.presentation';
import { markdownTableEditor, type MarkdownTableEditorConfig } from './markdown-editor.tables';
import { WikiLinkCompletionData, setWikiLinkCompletionData } from './markdown-editor.wiki-links';

type AuthoringMode = 'edit' | 'source';
type EditorMode = AuthoringMode | 'preview';
type UploadStatus = 'queued' | 'uploading' | 'error';

interface ImageUpload {
  id: number;
  file: File;
  anchor: number;
  status: UploadStatus;
}

interface ResolvedShortcutGroup {
  id: string;
  labelKey: string;
  commands: readonly MarkdownEditorCommandDefinition[];
}

interface ExternalScrollSnapshot {
  container: Element;
  top: number;
  left: number;
}

interface FullscreenSnapshot {
  focusedElement: Element | null;
  externalScroll: ExternalScrollSnapshot | null;
}

const MARKDOWN_EDITOR_FULLSCREEN_ICON_PATHS = {
  enter: 'M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5',
  exit: 'M4 9h5V4M20 9h-5V4M4 15h5v5M20 15h-5v5',
} as const;

const MARKDOWN_EDITOR_TOOLBAR_ICON_PATHS = {
  togglePreview: 'M4 5h7v14H4zM15 5h5v14h-5z',
  toggleSource: 'M8 8 4 12l4 4M16 8l4 4-4 4',
  search: 'M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0M16 16l4 4',
  heading1: 'M4 5v14M12 5v14M4 12h8M16 11l2-2v10M16 19h4',
  heading2: 'M4 5v14M12 5v14M4 12h8M16 11a2 2 0 1 1 4 0c0 1.5-4 4.5-4 8h4',
  heading3: 'M4 5v14M12 5v14M4 12h8M16 10a2.5 2.5 0 1 1 2 4 2.5 2.5 0 1 1-2 4',
  heading4: 'M4 5v14M12 5v14M4 12h8M20 19V9l-4 6h5',
  heading5: 'M4 5v14M12 5v14M4 12h8M20 9h-4v4h2a3 3 0 1 1-2 5',
  heading6: 'M4 5v14M12 5v14M4 12h8M20 9h-1c-2 0-3 2-3 5v2a3 3 0 1 0 3-3h-3',
  bold: 'M7 4h6a4 4 0 0 1 0 8H7zm0 8h7a4 4 0 0 1 0 8H7z',
  italic: 'M10 4h8M6 20h8M15 4 9 20',
  strikethrough:
    'M7 5h10M6 12h12M9 19h6M16 8c0-2-1.5-3-4-3S8 6 8 8c0 1.7 1.3 2.6 4 3.3 2.7.7 4 1.6 4 3.7 0 2-1.5 4-4 4s-4-1.5-4-3',
  quote: 'M5 7h6v6H7c0 2 1 3 3 4M14 7h6v6h-4c0 2 1 3 3 4',
  unorderedList: 'M5 6h.01M5 12h.01M5 18h.01M9 6h11M9 12h11M9 18h11',
  orderedList: 'M4 5h1v3M4 8h2M4 11h2l-2 3h2M4 17h2l-2 3h2M10 6h10M10 12h10M10 18h10',
  taskList: 'M3 4h5v5H3zM3 15h5v5H3zM4.5 6.5l1 1L8 5M11 6.5h10M11 17.5h10',
  horizontalRule: 'M4 12h16',
  link: 'M10 13a5 5 0 0 0 7.1.1l2-2A5 5 0 0 0 12 4l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1',
  image:
    'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2M11 9a2 2 0 1 1-4 0 2 2 0 0 1 4 0M4 17l5-5 4 4 2-2 5 5',
  inlineCode: 'M8 8 4 12l4 4M16 8l4 4-4 4M14 4l-4 16',
  codeBlock: 'M8 8 4 12l4 4M16 8l4 4-4 4M13 5l-2 14',
  table:
    'M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1M3 9h18M3 15h18M9 4v16M15 4v16',
} satisfies Readonly<Record<MarkdownEditorCommandId, string>>;

let editorInstanceId = 0;

@Component({
  selector: 'app-markdown-editor',
  standalone: true,
  imports: [CdkTrapFocus, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  templateUrl: './markdown-editor.component.html',
  styleUrls: [
    './markdown-editor.component.scss',
    './markdown-editor.theme-shell.scss',
    './markdown-editor.theme-foundation.scss',
    './markdown-editor.theme-selection.scss',
    './markdown-editor.theme-presentation.scss',
    './markdown-editor.theme-highlighting.scss',
  ],
})
export class MarkdownEditorComponent implements AfterViewInit, OnDestroy {
  private readonly imageUpload = inject(EditorImageUploadService);
  private readonly i18n = inject(I18nService);
  private readonly wikiLinkRenderer = inject(WikiLinkRendererService);
  private readonly wikiLinkTargets = inject(WikiLinkTargetsService);
  private readonly pageScrollLock = inject(ModalPageScrollLockService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly cspNonce = inject(CSP_NONCE);
  private readonly contentAttributesCompartment = new Compartment();
  private readonly phrasesCompartment = new Compartment();
  private readonly presentationCompartment = new Compartment();
  private readonly instanceId = ++editorInstanceId;
  readonly sourcePanelId = `markdown-editor-source-${this.instanceId}`;
  readonly previewPanelId = `markdown-editor-preview-${this.instanceId}`;
  private lastAuthoringMode: AuthoringMode = 'edit';
  private editorView: EditorView | null = null;
  private syncingInput = false;
  private focusPending = false;
  private restoreEditorFocus = false;
  private consumeShortcutsEscapeKeyup = false;
  private pendingImageInsertionPosition: number | null = null;
  private nextUploadId = 0;
  private currentWikiLinkCompletionData: WikiLinkCompletionData | null = null;
  private fullscreenSnapshot: FullscreenSnapshot | null = null;
  private releaseFullscreenPageScroll: (() => void) | null = null;
  private consumeFullscreenEscapeKeyup = false;
  private readonly editorScrollMouseDownListener = (event: MouseEvent): void => {
    const view = this.editorView;
    if (view === null || event.target !== view.scrollDOM) {
      return;
    }
    this.handleEditorMouseDown(event, view);
  };
  private readonly fullscreenEscapeKeyupListener = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !this.consumeFullscreenEscapeKeyup) {
      return;
    }
    this.disarmFullscreenEscapeKeyup();
    this.consumeKeyboardEvent(event);
  };

  @ViewChild('editorHeader', { static: true })
  private readonly editorHeader!: ElementRef<HTMLElement>;
  @ViewChild('editorTopPanels', { static: true })
  private readonly editorTopPanels!: ElementRef<HTMLElement>;
  @ViewChild('editorHost', { static: true }) private readonly editorHost!: ElementRef<HTMLElement>;
  @ViewChild('editorShell', { static: true })
  private readonly editorShell!: ElementRef<HTMLElement>;
  @ViewChild('editorFooter', { static: true })
  private readonly editorFooter!: ElementRef<HTMLElement>;
  @ViewChild('imageInput')
  private readonly imageInput?: ElementRef<HTMLInputElement>;
  @ViewChild('previewTab', { static: true })
  private readonly previewTab!: ElementRef<HTMLButtonElement>;
  @ViewChild('fullscreenToggle', { static: true })
  private readonly fullscreenToggle!: ElementRef<HTMLButtonElement>;

  readonly value = input.required<string>();
  readonly language = input.required<LanguageCode>();
  readonly accessibleLabel = input.required<string>();
  readonly imageUploadsEnabled = input.required<boolean>();
  readonly valueChange = output<string>();

  readonly mode = signal<EditorMode>('edit');
  readonly fullscreen = signal(false);
  readonly fullscreenLabelKey = computed(() =>
    this.fullscreen() ? 'markdownEditor.fullscreen.exit' : 'markdownEditor.fullscreen.enter',
  );
  readonly fullscreenIconPath = computed(() =>
    this.fullscreen()
      ? MARKDOWN_EDITOR_FULLSCREEN_ICON_PATHS.exit
      : MARKDOWN_EDITOR_FULLSCREEN_ICON_PATHS.enter,
  );
  readonly internalValue = signal('');
  readonly uploads = signal<readonly ImageUpload[]>([]);
  readonly uploading = computed(() =>
    this.uploads().some((upload) => upload.status === 'uploading'),
  );
  readonly uploadErrors = computed(() =>
    this.uploads().filter((upload) => upload.status === 'error'),
  );
  readonly wikiLinkRegistryUnavailable = signal(false);
  readonly previewHtml = computed(() =>
    this.wikiLinkRenderer.render(this.internalValue(), this.language()),
  );
  readonly previewEmpty = computed(() => this.internalValue().trim() === '');
  readonly shortcutGroups = computed(() =>
    filterImageCommands(resolveShortcutGroups(), this.imageUploadsEnabled()),
  );
  readonly toolbarGroups = computed(() => resolveToolbarGroups(this.shortcutGroups()));
  readonly shortcutModifierHintKey =
    this.editorPlatform() === 'mac'
      ? 'markdownEditor.shortcuts.modifierHintMac'
      : 'markdownEditor.shortcuts.modifierHintOther';
  readonly editTabId = `markdown-editor-edit-tab-${this.instanceId}`;
  readonly sourceTabId = `markdown-editor-source-tab-${this.instanceId}`;
  readonly previewTabId = `markdown-editor-preview-tab-${this.instanceId}`;

  constructor() {
    effect(() => {
      const value = this.value();
      const view = this.editorView;
      if (view === null) {
        this.internalValue.set(value);
        return;
      }
      if (view.state.doc.toString() === value) {
        return;
      }

      this.syncingInput = true;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
        annotations: Transaction.addToHistory.of(false),
      });
      this.internalValue.set(value);
      this.syncingInput = false;
    });
    effect(() => {
      const contentAttributes = this.editorContentAttributes();
      const phrases = this.searchPhrases();
      const presentation = this.authoringPresentationExtensions(this.lastAuthoringMode);
      const view = this.editorView;
      if (view === null) {
        return;
      }
      view.dispatch({
        effects: [
          this.contentAttributesCompartment.reconfigure(
            EditorView.contentAttributes.of(contentAttributes),
          ),
          this.phrasesCompartment.reconfigure(EditorState.phrases.of(phrases)),
          this.presentationCompartment.reconfigure(presentation),
        ],
      });
    });
    effect((onCleanup) => {
      const language = this.language();
      if (!isPlatformBrowser(this.platformId)) {
        return;
      }

      this.wikiLinkRegistryUnavailable.set(false);
      this.updateWikiLinkCompletionData(null);
      const subscription = this.wikiLinkTargets.getTargets(language).subscribe({
        next: (registry) => {
          if (this.language() !== language) {
            return;
          }
          this.updateWikiLinkCompletionData({
            registry,
            publishStatusLabels: {
              Draft: this.i18n.translate('enum.publishStatus.Draft'),
              Published: this.i18n.translate('enum.publishStatus.Published'),
            },
          });
        },
        error: () => {
          if (this.language() === language) {
            this.wikiLinkRegistryUnavailable.set(true);
          }
        },
      });
      onCleanup(() => subscription.unsubscribe());
    });
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.editorView = new EditorView({
      parent: this.editorHost.nativeElement,
      state: EditorState.create({
        doc: this.value(),
        extensions: this.editorExtensions(),
      }),
    });
    this.editorView.scrollDOM.addEventListener('mousedown', this.editorScrollMouseDownListener);
    this.internalValue.set(this.value());
    this.editorView.dispatch({
      effects: setWikiLinkCompletionData.of(this.currentWikiLinkCompletionData),
    });
    if (this.focusPending) {
      this.focusPending = false;
      this.focusEditor(this.editorView);
    }
  }

  ngOnDestroy(): void {
    this.disarmFullscreenEscapeKeyup();
    this.releaseFullscreenPageScroll?.();
    this.releaseFullscreenPageScroll = null;
    this.fullscreenSnapshot = null;
    this.editorView?.scrollDOM.removeEventListener('mousedown', this.editorScrollMouseDownListener);
    this.editorView?.destroy();
  }

  focus(): void {
    if (this.mode() === 'preview') {
      this.selectMode(this.lastAuthoringMode);
    }
    const view = this.editorView;
    if (view === null) {
      this.focusPending = true;
      return;
    }
    this.restoreFocus(true);
  }

  selectMode(mode: EditorMode): void {
    if (mode === this.mode()) {
      return;
    }
    const externalScroll = this.captureExternalScroll();
    if (mode === 'preview') {
      this.restoreEditorFocus = this.editorView?.hasFocus ?? false;
      this.mode.set('preview');
      if (this.restoreEditorFocus) {
        this.previewTab.nativeElement.focus({ preventScroll: true });
      }
      this.restoreExternalScroll(externalScroll);
      return;
    }

    const restoreEditorFocus = this.restoreEditorFocus;
    this.lastAuthoringMode = mode;
    this.reconfigureAuthoringPresentation(mode);
    this.mode.set(mode);
    this.restoreFocus(restoreEditorFocus);
    this.restoreEditorFocus = false;
    this.restoreExternalScroll(externalScroll);
  }

  onModeTabKeydown(event: KeyboardEvent): void {
    const target = event.currentTarget;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }
    const tablist = target.parentElement;
    if (tablist === null) {
      return;
    }
    const tabs = Array.from(tablist.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const currentIndex = tabs.indexOf(target);
    const nextIndex = modeTabIndex(event.key, currentIndex, tabs.length);
    if (nextIndex === null) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    tabs[nextIndex]?.focus();
  }

  onContainerKeydown(event: KeyboardEvent): void {
    if (
      this.fullscreen() &&
      event.key === 'Escape' &&
      !event.isComposing &&
      !event.defaultPrevented
    ) {
      this.consumeKeyboardEvent(event);
      this.armFullscreenEscapeKeyup();
      this.exitFullscreen();
      return;
    }
    if (this.consumeComposingEditorShortcut(event)) {
      return;
    }
    const command = findMarkdownEditorCommand(event, this.editorPlatform());
    if (command !== 'togglePreview' && command !== 'toggleSource') {
      return;
    }
    this.consumeKeyboardEvent(event);
    if (command === 'togglePreview') {
      this.selectMode(this.mode() === 'preview' ? this.lastAuthoringMode : 'preview');
      return;
    }
    const currentAuthoring = this.mode() === 'preview' ? this.lastAuthoringMode : this.mode();
    this.selectMode(currentAuthoring === 'edit' ? 'source' : 'edit');
  }

  toggleFullscreen(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    if (this.fullscreen()) {
      this.exitFullscreen();
      return;
    }
    this.enterFullscreen();
  }

  onToolbarKeydown(event: KeyboardEvent): void {
    const target = event.currentTarget;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }
    const toolbar = target.closest<HTMLElement>('[role="toolbar"]');
    if (toolbar === null) {
      return;
    }
    const buttons = Array.from(
      toolbar.querySelectorAll<HTMLButtonElement>('[data-markdown-command]'),
    );
    const currentIndex = buttons.indexOf(target);
    const nextIndex = toolbarButtonIndex(event.key, currentIndex, buttons.length);
    if (nextIndex === null) {
      return;
    }
    event.preventDefault();
    buttons.forEach((button, index) => {
      button.tabIndex = index === nextIndex ? 0 : -1;
    });
    buttons[nextIndex]?.focus();
  }

  executeToolbarCommand(command: MarkdownEditorCommandDefinition): void {
    const view = this.editorView;
    if (view === null || command.id === 'togglePreview') {
      return;
    }
    const handled = this.executeCommand(command.id, view);
    if (handled && command.id !== 'search' && command.id !== 'image') {
      this.focusEditor(view);
    }
  }

  toolbarCommandLabel(command: MarkdownEditorCommandDefinition): string {
    return `${this.i18n.translate(command.labelKey)} (${this.shortcutLabel(command)})`;
  }

  toolbarIconPath(commandId: MarkdownEditorCommandId): string {
    return MARKDOWN_EDITOR_TOOLBAR_ICON_PATHS[commandId];
  }

  onShortcutsKeydown(event: KeyboardEvent): void {
    const summary = event.currentTarget;
    if (!(summary instanceof HTMLElement)) {
      return;
    }
    const details = summary.parentElement;
    if (event.key !== 'Escape' || !(details instanceof HTMLDetailsElement) || !details.open) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.consumeShortcutsEscapeKeyup = true;
    details.open = false;
    summary.focus({ preventScroll: true });
  }

  onShortcutsKeyup(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || !this.consumeShortcutsEscapeKeyup) {
      return;
    }
    this.consumeShortcutsEscapeKeyup = false;
    this.consumeKeyboardEvent(event);
  }

  onImageInput(event: Event): void {
    if (!this.imageUploadsEnabled()) {
      return;
    }
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    const insertionPosition = this.pendingImageInsertionPosition ?? this.currentCursor();
    this.pendingImageInsertionPosition = null;
    this.queueImageUploads(Array.from(input.files ?? []), insertionPosition);
    input.value = '';
  }

  onPreviewClick(event: MouseEvent): void {
    const browserWindow = this.document.defaultView;
    if (
      !isPlatformBrowser(this.platformId) ||
      browserWindow === null ||
      !(event.target instanceof browserWindow.Element)
    ) {
      return;
    }
    const anchor = event.target.closest('a');
    const href = anchor?.getAttribute('href');
    if (href === null || href === undefined) {
      return;
    }
    const wikiLinkPaths = new Set(
      parseWikiLinks(this.internalValue()).map((link) =>
        wikiLinkPath(link.type, link.slug, this.language()),
      ),
    );
    if (!wikiLinkPaths.has(href)) {
      return;
    }

    event.preventDefault();
    browserWindow.open(href, '_blank', 'noopener,noreferrer');
  }

  retryUpload(id: number): void {
    this.uploads.update((uploads) =>
      uploads.map((upload) => (upload.id === id ? { ...upload, status: 'queued' } : upload)),
    );
    this.processNextUpload();
  }

  dismissUpload(id: number): void {
    this.uploads.update((uploads) => uploads.filter((upload) => upload.id !== id));
    this.processNextUpload();
  }

  shortcutParts(command: MarkdownEditorCommandDefinition): readonly string[] {
    return formatMarkdownShortcut(command, this.editorPlatform());
  }

  shortcutLabel(command: MarkdownEditorCommandDefinition): string {
    return this.shortcutParts(command)
      .map((part) => (part === '⌘' ? 'Command' : part))
      .join(' + ');
  }

  private editorExtensions(): readonly Extension[] {
    return [
      ...markdownEditorFoundationExtensions,
      markdownEditorCspExtension(this.cspNonce),
      this.presentationCompartment.of(this.authoringPresentationExtensions('edit')),
      this.phrasesCompartment.of(EditorState.phrases.of(this.searchPhrases())),
      this.contentAttributesCompartment.of(
        EditorView.contentAttributes.of(this.editorContentAttributes()),
      ),
      panels({ topContainer: this.editorTopPanels.nativeElement }),
      EditorView.scrollMargins.of(() => this.editorScrollMargins()),
      keymap.of([
        {
          key: 'Enter',
          run: (view) => this.applyEnter(view),
        },
        {
          key: 'Tab',
          run: (view) => nextSnippetField(view) || this.indentSelection(view, 'more'),
        },
        {
          key: 'Shift-Tab',
          run: (view) => prevSnippetField(view) || this.indentSelection(view, 'less'),
        },
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
      ]),
      EditorView.domEventHandlers({
        mousedown: (event, view) => this.handleEditorMouseDown(event, view),
        keydown: (event, view) => this.handleEditorKeydown(event, view),
        keyup: (event, view) => this.handleEditorKeyup(event, view),
        paste: (event, view) => this.handlePaste(event, view),
        drop: (event, view) => this.handleDrop(event, view),
        dragover: (event) => this.handleDragOver(event),
      }),
      EditorView.updateListener.of((update) => this.handleEditorUpdate(update)),
    ];
  }

  private editorScrollMargins(): Pick<Rect, 'top' | 'bottom'> {
    const browserWindow = this.editorShell.nativeElement.ownerDocument.defaultView;
    let topDisplacement = 0;
    let bottomDisplacement = 0;
    if (browserWindow !== null) {
      const resolvedTop = Number.parseFloat(
        browserWindow.getComputedStyle(this.editorHeader.nativeElement).top,
      );
      const resolvedBottom = Number.parseFloat(
        browserWindow.getComputedStyle(this.editorFooter.nativeElement).bottom,
      );
      topDisplacement = Number.isFinite(resolvedTop) && resolvedTop > 0 ? resolvedTop : 0;
      bottomDisplacement =
        Number.isFinite(resolvedBottom) && resolvedBottom > 0 ? resolvedBottom : 0;
    }
    return {
      top: this.editorHeader.nativeElement.offsetHeight + topDisplacement,
      bottom: this.editorFooter.nativeElement.offsetHeight + bottomDisplacement,
    };
  }

  private handleEditorUpdate(update: ViewUpdate): void {
    if (!update.changes.empty && this.uploads().length > 0) {
      this.uploads.update((uploads) =>
        uploads.map((upload) => ({
          ...upload,
          anchor: update.changes.mapPos(upload.anchor, 1),
        })),
      );
    }
    if (!update.docChanged || this.syncingInput) {
      return;
    }
    const value = update.state.doc.toString();
    this.internalValue.set(value);
    this.valueChange.emit(value);
  }

  private handleEditorMouseDown(event: MouseEvent, view: EditorView): boolean {
    if (event.button !== 0 || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
      return false;
    }
    const documentEnd = view.state.doc.length;
    const documentEndCoordinates = view.coordsAtPos(documentEnd, -1);
    if (documentEndCoordinates === null || event.clientY <= documentEndCoordinates.bottom) {
      return false;
    }

    event.preventDefault();
    view.dispatch({
      selection: EditorSelection.cursor(documentEnd),
      userEvent: 'select.pointer',
    });
    this.focusEditor(view);
    return true;
  }

  private handleEditorKeydown(event: KeyboardEvent, view: EditorView): boolean {
    if (this.consumeComposingEditorShortcut(event)) {
      return true;
    }
    const command = findMarkdownEditorCommand(event, this.editorPlatform());
    if (command === null) {
      return false;
    }

    const handled = this.executeCommand(command, view);
    if (handled) {
      this.consumeKeyboardEvent(event);
    }
    return handled;
  }

  private handleEditorKeyup(event: KeyboardEvent, view: EditorView): boolean {
    if (event.isComposing || (event.key !== '`' && event.key !== '~')) {
      return false;
    }
    const result = autoCloseMarkdownFenceTransaction(
      view.state.doc.toString(),
      editorSelections(view),
      event.key,
    );
    if (result === null) {
      return false;
    }
    this.dispatchTransaction(view, result);
    return true;
  }

  private executeCommand(command: MarkdownEditorCommandId, view: EditorView): boolean {
    if (command === 'togglePreview') {
      this.selectMode('preview');
      return true;
    }
    if (command === 'toggleSource') {
      this.selectMode(this.mode() === 'source' ? 'edit' : 'source');
      return true;
    }
    if (command === 'search') {
      openSearchPanel(view);
      this.editorTopPanels.nativeElement
        .querySelector<HTMLInputElement>('.cm-search input[main-field]')
        ?.focus({ preventScroll: true });
      return true;
    }
    if (command === 'image') {
      if (!this.imageUploadsEnabled()) {
        return false;
      }
      this.pendingImageInsertionPosition = view.state.selection.main.head;
      this.imageInput?.nativeElement.click();
      return true;
    }
    if (command === 'link' || command === 'table') {
      return this.applySnippet(command, view);
    }

    const result = applyMarkdownCommandTransaction(
      command,
      view.state.doc.toString(),
      editorSelections(view),
    );
    if (result === null) {
      return false;
    }
    this.dispatchTransaction(view, result);
    return true;
  }

  private applySnippet(command: 'link' | 'table', view: EditorView): boolean {
    if (view.state.selection.ranges.length !== 1) {
      const result = applyMarkdownCommandTransaction(
        command,
        view.state.doc.toString(),
        editorSelections(view),
      );
      if (result === null) {
        return false;
      }
      this.dispatchTransaction(view, result);
      return true;
    }

    const selection = view.state.selection.main;
    const selectedText = view.state.sliceDoc(selection.from, selection.to);
    if (command === 'table' && selectedText.length > 0) {
      const result = applyMarkdownCommandTransaction(
        command,
        view.state.doc.toString(),
        editorSelections(view),
      );
      if (result === null) {
        return false;
      }
      this.dispatchTransaction(view, result);
      return true;
    }
    const template =
      command === 'link'
        ? linkSnippet(selectedText)
        : '| ${1} | ${2} |\n| --- | --- |\n| ${3} | ${4} |\n${0}';
    snippet(template)(view, null, selection.from, selection.to);
    return true;
  }

  private applySmartEnter(view: EditorView): boolean {
    const result = continueMarkdownBlockTransaction(
      view.state.doc.toString(),
      editorSelections(view),
    );
    if (result === null) {
      return false;
    }
    this.dispatchTransaction(view, result);
    return true;
  }

  private applyEnter(view: EditorView): boolean {
    const status = completionStatus(view.state);
    if (status !== null) {
      if (status === 'active') {
        acceptCompletion(view);
      }
      return true;
    }
    return this.applySmartEnter(view);
  }

  private indentSelection(view: EditorView, direction: 'more' | 'less'): boolean {
    const result = indentMarkdownLinesTransaction(
      view.state.doc.toString(),
      editorSelections(view),
      direction,
    );
    if (result !== null) {
      this.dispatchTransaction(view, result);
      return true;
    }
    return direction === 'more' ? indentMore(view) : indentLess(view);
  }

  private dispatchTransaction(view: EditorView, transaction: MarkdownTransactionResult): void {
    view.dispatch({
      changes: transaction.changes,
      selection: EditorSelection.create(
        transaction.selections.map((selection) =>
          EditorSelection.range(selection.anchor, selection.head),
        ),
      ),
      userEvent: 'input',
    });
  }

  private handlePaste(event: ClipboardEvent, view: EditorView): boolean {
    if (!this.imageUploadsEnabled()) {
      return false;
    }
    const files = Array.from(event.clipboardData?.items ?? [])
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);
    if (files.length === 0) {
      return false;
    }
    event.preventDefault();
    event.stopPropagation();
    this.queueImageUploads(files, view.state.selection.main.head);
    return true;
  }

  private handleDrop(event: DragEvent, view: EditorView): boolean {
    if (!this.imageUploadsEnabled()) {
      return false;
    }
    const files = Array.from(event.dataTransfer?.files ?? []).filter((file) =>
      file.type.startsWith('image/'),
    );
    if (files.length === 0) {
      return false;
    }
    event.preventDefault();
    event.stopPropagation();
    const position = view.posAtCoords({ x: event.clientX, y: event.clientY });
    this.queueImageUploads(files, position ?? view.state.selection.main.head);
    return true;
  }

  private handleDragOver(event: DragEvent): boolean {
    if (!this.imageUploadsEnabled()) {
      return false;
    }
    const hasImage = Array.from(event.dataTransfer?.items ?? []).some(
      (item) => item.kind === 'file' && item.type.startsWith('image/'),
    );
    if (!hasImage) {
      return false;
    }
    event.preventDefault();
    if (event.dataTransfer !== null) {
      event.dataTransfer.dropEffect = 'copy';
    }
    return true;
  }

  private queueImageUploads(files: readonly File[], anchor: number): void {
    if (!this.imageUploadsEnabled()) {
      return;
    }
    const images = files.filter((file) => file.type.startsWith('image/'));
    if (images.length === 0) {
      return;
    }
    const queued = images.map((file) => ({
      id: ++this.nextUploadId,
      file,
      anchor,
      status: 'queued' as const,
    }));
    this.uploads.update((uploads) => [...uploads, ...queued]);
    this.processNextUpload();
  }

  private processNextUpload(): void {
    if (this.uploads().some((upload) => upload.status === 'uploading')) {
      return;
    }
    if (this.uploads().some((upload) => upload.status === 'error')) {
      return;
    }
    const next = this.uploads().find((upload) => upload.status === 'queued');
    if (next === undefined) {
      return;
    }
    this.updateUploadStatus(next.id, 'uploading');
    this.imageUpload
      .uploadEditorImage(next.file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (markdownUrl) => {
          const current = this.uploads().find((upload) => upload.id === next.id);
          const view = this.editorView;
          if (current === undefined || view === null) {
            return;
          }
          view.dispatch({
            changes: {
              from: current.anchor,
              to: current.anchor,
              insert: markdownImage(next.file.name, markdownUrl),
            },
            userEvent: 'input',
          });
          this.uploads.update((uploads) => uploads.filter((upload) => upload.id !== next.id));
          this.processNextUpload();
        },
        error: () => this.updateUploadStatus(next.id, 'error'),
      });
  }

  private updateUploadStatus(id: number, status: UploadStatus): void {
    this.uploads.update((uploads) =>
      uploads.map((upload) => (upload.id === id ? { ...upload, status } : upload)),
    );
  }

  private currentCursor(): number {
    return this.editorView?.state.selection.main.head ?? 0;
  }

  private enterFullscreen(): void {
    const browserWindow = this.document.defaultView;
    if (browserWindow === null || this.fullscreen()) {
      return;
    }

    this.fullscreenSnapshot = {
      focusedElement: this.document.activeElement,
      externalScroll: this.captureExternalScroll(),
    };
    this.releaseFullscreenPageScroll = this.pageScrollLock.acquire();
    this.fullscreen.set(true);
    browserWindow.requestAnimationFrame(() => {
      if (this.destroyRef.destroyed || !this.fullscreen()) {
        return;
      }
      const view = this.editorView;
      view?.requestMeasure();
      this.fullscreenToggle.nativeElement.focus({ preventScroll: true });
      if (view !== null && this.mode() !== 'preview') {
        view.dispatch({
          effects: EditorView.scrollIntoView(view.state.selection.main, { y: 'center' }),
        });
      }
    });
  }

  private armFullscreenEscapeKeyup(): void {
    if (this.consumeFullscreenEscapeKeyup) {
      return;
    }
    this.consumeFullscreenEscapeKeyup = true;
    this.document.addEventListener('keyup', this.fullscreenEscapeKeyupListener, true);
  }

  private disarmFullscreenEscapeKeyup(): void {
    if (!this.consumeFullscreenEscapeKeyup) {
      return;
    }
    this.consumeFullscreenEscapeKeyup = false;
    this.document.removeEventListener('keyup', this.fullscreenEscapeKeyupListener, true);
  }

  private exitFullscreen(): void {
    const snapshot = this.fullscreenSnapshot;
    const browserWindow = this.document.defaultView;
    if (!this.fullscreen() || snapshot === null || browserWindow === null) {
      return;
    }

    this.fullscreen.set(false);
    this.fullscreenSnapshot = null;
    this.releaseFullscreenPageScroll?.();
    this.releaseFullscreenPageScroll = null;
    browserWindow.requestAnimationFrame(() => {
      if (this.destroyRef.destroyed) {
        return;
      }
      this.editorView?.requestMeasure();
      this.restoreFullscreenFocus(snapshot.focusedElement);
    });
    this.restoreExternalScroll(snapshot.externalScroll);
  }

  private restoreFullscreenFocus(focusedElement: Element | null): void {
    const browserWindow = this.document.defaultView;
    if (
      browserWindow !== null &&
      focusedElement instanceof browserWindow.HTMLElement &&
      focusedElement.isConnected
    ) {
      focusedElement.focus({ preventScroll: true });
      return;
    }
    this.fullscreenToggle.nativeElement.focus({ preventScroll: true });
  }

  private restoreFocus(shouldFocus: boolean): void {
    const view = this.editorView;
    if (view === null) {
      return;
    }
    if (shouldFocus) {
      this.focusEditor(view);
      this.document.defaultView?.requestAnimationFrame(() => {
        if (
          !this.destroyRef.destroyed &&
          this.editorView === view &&
          this.mode() !== 'preview' &&
          !view.hasFocus
        ) {
          this.focusEditor(view);
        }
      });
    }
  }

  private focusEditor(view: EditorView): void {
    view.contentDOM.focus({ preventScroll: true });
  }

  private captureExternalScroll(): ExternalScrollSnapshot | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }
    const browserWindow = this.document.defaultView;
    if (browserWindow === null) {
      return null;
    }

    let container = this.editorHost.nativeElement.parentElement;
    while (container !== null) {
      const overflowY = browserWindow.getComputedStyle(container).overflowY;
      if (
        (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
        container.scrollHeight > container.clientHeight
      ) {
        return {
          container,
          top: container.scrollTop,
          left: container.scrollLeft,
        };
      }
      container = container.parentElement;
    }

    const pageScroller = this.document.scrollingElement;
    if (!pageScroller) {
      return null;
    }
    return {
      container: pageScroller,
      top: pageScroller.scrollTop,
      left: pageScroller.scrollLeft,
    };
  }

  private restoreExternalScroll(snapshot: ExternalScrollSnapshot | null): void {
    const browserWindow = this.document.defaultView;
    if (snapshot === null || browserWindow === null) {
      return;
    }
    const restore = (): void => {
      if (this.destroyRef.destroyed) {
        return;
      }
      snapshot.container.scrollTop = snapshot.top;
      snapshot.container.scrollLeft = snapshot.left;
    };
    browserWindow.requestAnimationFrame(() => {
      restore();
      browserWindow.requestAnimationFrame(restore);
    });
  }

  private consumeKeyboardEvent(event: KeyboardEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  private consumeComposingEditorShortcut(event: KeyboardEvent): boolean {
    if (
      !event.isComposing ||
      findMarkdownEditorCommand(keyboardEventWithoutComposition(event), this.editorPlatform()) ===
        null
    ) {
      return false;
    }
    this.consumeKeyboardEvent(event);
    return true;
  }

  private editorPlatform(): 'mac' | 'other' {
    const navigator = this.document.defaultView?.navigator;
    return navigator !== undefined && /Mac|iPhone|iPad/.test(navigator.platform) ? 'mac' : 'other';
  }

  private searchPhrases(): Record<string, string> {
    return {
      Completions: this.i18n.translate('markdownEditor.completions'),
      Find: this.i18n.translate('markdownEditor.search.find'),
      Replace: this.i18n.translate('markdownEditor.search.replace'),
      next: this.i18n.translate('markdownEditor.search.next'),
      previous: this.i18n.translate('markdownEditor.search.previous'),
      all: this.i18n.translate('markdownEditor.search.all'),
      'match case': this.i18n.translate('markdownEditor.search.matchCase'),
      'by word': this.i18n.translate('markdownEditor.search.byWord'),
      regexp: this.i18n.translate('markdownEditor.search.regexp'),
      replace: this.i18n.translate('markdownEditor.search.replace'),
      'replace all': this.i18n.translate('markdownEditor.search.replaceAll'),
      close: this.i18n.translate('markdownEditor.search.close'),
      'Go to line': this.i18n.translate('markdownEditor.search.goToLine'),
      go: this.i18n.translate('markdownEditor.search.go'),
      'current match': this.i18n.translate('markdownEditor.search.currentMatch'),
      'on line': this.i18n.translate('markdownEditor.search.onLine'),
      'replaced $ matches': this.i18n.translate('markdownEditor.search.replacedMatches'),
      'replaced match on line $': this.i18n.translate('markdownEditor.search.replacedMatchOnLine'),
    };
  }

  private editorContentAttributes(): Record<string, string> {
    return {
      'aria-label': this.accessibleLabel(),
      lang: this.language(),
      spellcheck: 'true',
    };
  }

  private authoringPresentationExtensions(mode: AuthoringMode): Extension {
    if (mode === 'source') {
      return [
        EditorView.editorAttributes.of({ class: 'cm-markdown-editor-selection-drawn' }),
        drawSelection(),
      ];
    }
    return [
      EditorView.editorAttributes.of({ class: 'cm-markdown-editor-selection-native' }),
      markdownPresentation,
      markdownTableEditor({
        locale: this.language(),
        phrases: this.markdownTablePhrases(),
      }),
    ];
  }

  private markdownTablePhrases(): MarkdownTableEditorConfig['phrases'] {
    return {
      table: this.i18n.translate('markdownEditor.table.table'),
      row: this.i18n.translate('markdownEditor.table.row'),
      column: this.i18n.translate('markdownEditor.table.column'),
      range: this.i18n.translate('markdownEditor.table.range'),
      menu: this.i18n.translate('markdownEditor.table.menu'),
      addRow: this.i18n.translate('markdownEditor.table.addRow'),
      addColumn: this.i18n.translate('markdownEditor.table.addColumn'),
      moveRow: this.i18n.translate('markdownEditor.table.moveRow'),
      moveColumn: this.i18n.translate('markdownEditor.table.moveColumn'),
      insertBefore: this.i18n.translate('markdownEditor.table.insertBefore'),
      insertAfter: this.i18n.translate('markdownEditor.table.insertAfter'),
      duplicate: this.i18n.translate('markdownEditor.table.duplicate'),
      clear: this.i18n.translate('markdownEditor.table.clear'),
      copy: this.i18n.translate('markdownEditor.table.copy'),
      cut: this.i18n.translate('markdownEditor.table.cut'),
      delete: this.i18n.translate('markdownEditor.table.delete'),
      moveBefore: this.i18n.translate('markdownEditor.table.moveBefore'),
      moveAfter: this.i18n.translate('markdownEditor.table.moveAfter'),
      sortAscending: this.i18n.translate('markdownEditor.table.sortAscending'),
      sortDescending: this.i18n.translate('markdownEditor.table.sortDescending'),
      alignLeft: this.i18n.translate('markdownEditor.table.alignLeft'),
      alignCenter: this.i18n.translate('markdownEditor.table.alignCenter'),
      alignRight: this.i18n.translate('markdownEditor.table.alignRight'),
      format: this.i18n.translate('markdownEditor.table.format'),
      deleteTable: this.i18n.translate('markdownEditor.table.deleteTable'),
      clipboardFailed: this.i18n.translate('markdownEditor.table.clipboardFailed'),
    };
  }

  private reconfigureAuthoringPresentation(mode: AuthoringMode): void {
    this.editorView?.dispatch({
      effects: this.presentationCompartment.reconfigure(this.authoringPresentationExtensions(mode)),
    });
  }

  private updateWikiLinkCompletionData(data: WikiLinkCompletionData | null): void {
    this.currentWikiLinkCompletionData = data;
    this.editorView?.dispatch({ effects: setWikiLinkCompletionData.of(data) });
  }
}

function resolveShortcutGroups(): readonly ResolvedShortcutGroup[] {
  const commandsById = new Map(
    MARKDOWN_EDITOR_COMMANDS.map((command) => [command.id, command] as const),
  );
  return MARKDOWN_EDITOR_SHORTCUT_GROUPS.map((group) => ({
    id: group.id,
    labelKey: group.labelKey,
    commands: group.commandIds.map((commandId) => {
      const command = commandsById.get(commandId);
      if (command === undefined) {
        throw new Error(`Unknown Markdown editor command: ${commandId}`);
      }
      return command;
    }),
  }));
}

function resolveToolbarGroups(
  shortcutGroups: readonly ResolvedShortcutGroup[],
): readonly ResolvedShortcutGroup[] {
  return shortcutGroups
    .map((group) => ({
      ...group,
      commands: group.commands.filter(
        (command) => command.id !== 'togglePreview' && command.id !== 'toggleSource',
      ),
    }))
    .filter((group) => group.commands.length > 0);
}

function filterImageCommands(
  shortcutGroups: readonly ResolvedShortcutGroup[],
  imageUploadsEnabled: boolean,
): readonly ResolvedShortcutGroup[] {
  if (imageUploadsEnabled) {
    return shortcutGroups;
  }
  return shortcutGroups
    .map((group) => ({
      ...group,
      commands: group.commands.filter((command) => command.id !== 'image'),
    }))
    .filter((group) => group.commands.length > 0);
}

function editorSelections(view: EditorView): readonly MarkdownSelection[] {
  return view.state.selection.ranges.map((selection) => ({
    anchor: selection.anchor,
    head: selection.head,
  }));
}

function modeTabIndex(key: string, currentIndex: number, tabCount: number): number | null {
  if (key === 'Home') return 0;
  if (key === 'End') return tabCount - 1;
  if (key === 'ArrowRight' || key === 'ArrowDown') return (currentIndex + 1) % tabCount;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (currentIndex - 1 + tabCount) % tabCount;
  return null;
}

function toolbarButtonIndex(key: string, currentIndex: number, buttonCount: number): number | null {
  if (key === 'Home') return 0;
  if (key === 'End') return buttonCount - 1;
  if (key === 'ArrowRight') return (currentIndex + 1) % buttonCount;
  if (key === 'ArrowLeft') return (currentIndex - 1 + buttonCount) % buttonCount;
  return null;
}

function linkSnippet(selectedText: string): string {
  if (selectedText === '') {
    return '[${1}](${2})${0}';
  }
  return `[${escapeSnippetText(selectedText)}](${'${1}'})${'${0}'}`;
}

function escapeSnippetText(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('[', '\\[')
    .replaceAll(']', '\\]')
    .replaceAll('$', '\\$')
    .replaceAll('{', '\\{')
    .replaceAll('}', '\\}');
}

function markdownImage(fileName: string, markdownUrl: string): string {
  const alt = fileName
    .replaceAll('\\', '\\\\')
    .replaceAll('[', '\\[')
    .replaceAll(']', '\\]')
    .replaceAll(/\r?\n/g, ' ');
  const url = markdownUrl.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
  return `![${alt}](${url})`;
}

function keyboardEventWithoutComposition(event: KeyboardEvent): MarkdownKeyboardEvent {
  return {
    code: event.code,
    key: event.key,
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
    isComposing: false,
  };
}
