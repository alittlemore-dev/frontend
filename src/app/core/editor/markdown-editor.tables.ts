import {
  completionStatus,
  hasNextSnippetField,
  hasPrevSnippetField,
} from '@codemirror/autocomplete';
import { invertedEffects } from '@codemirror/commands';
import { syntaxTree } from '@codemirror/language';
import {
  Annotation,
  EditorSelection,
  EditorState,
  Facet,
  Prec,
  RangeSet,
  StateEffect,
  StateField,
  Transaction,
  type Extension,
  type Range,
  type TransactionSpec,
} from '@codemirror/state';
import {
  BlockWrapper,
  Decoration,
  type DecorationSet,
  Direction,
  EditorView,
  GutterMarker,
  gutterLineClass,
  keymap,
  layer,
  RectangleMarker,
  showTooltip,
  ViewPlugin,
  WidgetType,
  type Command,
  type Rect,
  type Tooltip,
  type ViewUpdate,
} from '@codemirror/view';
import type { SyntaxNode } from '@lezer/common';
import {
  applyMarkdownTableGrid,
  classifyMarkdownTableSelection,
  clearMarkdownTableColumns,
  clearMarkdownTableRows,
  clearMarkdownTableSelection,
  deleteMarkdownTableColumns,
  deleteMarkdownTableRows,
  deleteMarkdownTableSelection,
  duplicateMarkdownTableColumns,
  duplicateMarkdownTableRows,
  formatMarkdownTable,
  insertMarkdownTableColumns,
  insertMarkdownTableRows,
  markdownTableSelectionBounds,
  markdownTableSelectionToTsv,
  moveMarkdownTableColumns,
  moveMarkdownTableRows,
  parseMarkdownTable,
  parseMarkdownTableClipboard,
  serializeMarkdownTable,
  setMarkdownTableAlignment,
  sortMarkdownTableBody,
  type MarkdownTable,
  type MarkdownTableCellPosition,
  type MarkdownTableCellRange,
  type MarkdownTableRow,
} from './markdown-table';

type MarkdownTableSelectionAxis = 'row' | 'column';

export interface MarkdownTableEditorPhrases {
  readonly table: string;
  readonly row: string;
  readonly column: string;
  readonly range: string;
  readonly menu: string;
  readonly addRow: string;
  readonly addColumn: string;
  readonly moveRow: string;
  readonly moveColumn: string;
  readonly insertBefore: string;
  readonly insertAfter: string;
  readonly duplicate: string;
  readonly clear: string;
  readonly copy: string;
  readonly cut: string;
  readonly delete: string;
  readonly moveBefore: string;
  readonly moveAfter: string;
  readonly sortAscending: string;
  readonly sortDescending: string;
  readonly alignLeft: string;
  readonly alignCenter: string;
  readonly alignRight: string;
  readonly format: string;
  readonly deleteTable: string;
  readonly clipboardFailed: string;
}

export interface MarkdownTableEditorConfig {
  readonly locale: string;
  readonly phrases: MarkdownTableEditorPhrases;
}

export interface MarkdownTableEditorSelection {
  readonly tableFrom: number | null;
  readonly anchor: MarkdownTableCellPosition | null;
  readonly head: MarkdownTableCellPosition | null;
}

export type MarkdownTableEditorAction =
  | 'insertBefore'
  | 'insertAfter'
  | 'duplicate'
  | 'clear'
  | 'copy'
  | 'cut'
  | 'delete'
  | 'moveBefore'
  | 'moveAfter'
  | 'sortAscending'
  | 'sortDescending'
  | 'alignLeft'
  | 'alignCenter'
  | 'alignRight'
  | 'format'
  | 'deleteTable';

interface TableCellLayout {
  readonly rowIndex: number;
  readonly columnIndex: number;
  readonly from: number;
  readonly to: number;
  readonly renderFrom: number;
  readonly renderTo: number;
  readonly cursor: number;
  readonly virtual: boolean;
}

interface TableRowLayout {
  readonly semanticIndex: number | null;
  readonly from: number;
  readonly to: number;
  readonly cells: readonly TableCellLayout[];
  readonly structuralRanges: readonly { readonly from: number; readonly to: number }[];
}

interface TableLayout {
  readonly from: number;
  readonly to: number;
  readonly table: MarkdownTable;
  readonly rows: readonly TableRowLayout[];
  readonly semanticRows: readonly TableRowLayout[];
}

interface TableCaretTarget {
  readonly position: number;
  readonly layout: TableLayout;
  readonly cell: TableCellLayout | null;
}

interface ClearedTableCellRepair {
  readonly changes: readonly { readonly from: number; readonly insert: string }[];
  readonly cursor: number;
}

interface ClearedTableCellContext {
  readonly layout: TableLayout;
  readonly cell: TableCellLayout;
  readonly row: TableRowLayout;
  readonly sourceRow: MarkdownTableRow;
}

interface TableCaretHistoryTarget {
  readonly tableFrom: number;
  readonly row: number;
  readonly column: number;
}

interface TableCaretHistoryTransition {
  readonly from: TableCaretHistoryTarget | null;
  readonly to: TableCaretHistoryTarget | null;
}

interface SelectionContext {
  readonly layout: TableLayout;
  readonly selection: MarkdownTableCellRange;
}

interface PointerSelectionSession {
  readonly tableFrom: number;
  readonly anchor: MarkdownTableCellPosition;
  readonly cursor: number;
  readonly pointerId: number;
  crossedCell: boolean;
}

interface TableDragState {
  readonly tableFrom: number;
  readonly axis: MarkdownTableSelectionAxis;
  readonly indices: readonly number[];
  readonly pointerId: number;
  readonly targetIndex: number | null;
  readonly targetGap: number | null;
}

interface TableControlGeometry {
  readonly inlineStart: string | null;
  readonly inlineSize: string | null;
}

interface TableMenuState {
  readonly tableFrom: number;
  readonly position: number;
  readonly cell: MarkdownTableCellPosition;
}

interface TableMenuItem {
  readonly label: string;
  readonly action: MarkdownTableEditorAction;
  readonly axis: MarkdownTableSelectionAxis | null;
}

const TABLE_HEADER_DELIMITER_HEIGHT_PX = 3;

const markdownTableEditorTheme = EditorView.theme({
  '.cm-markdown-table-editor': {
    position: 'relative',
    display: 'block',
    width: '100%',
    maxWidth: '100%',
    minWidth: '0',
    boxSizing: 'border-box',
    margin: '0',
    padding: '0 1rem 0.75rem',
    color: 'var(--text-primary)',
    background: 'transparent',
    border: '0',
    borderRadius: '0px',
    boxShadow: 'none',
    fontFamily: 'var(--bs-body-font-family)',
    fontSize: '1em',
  },
  '.cm-markdown-table-row.cm-line': {
    position: 'relative',
    display: 'grid',
    gridAutoFlow: 'column',
    gridAutoColumns: 'minmax(0, 1fr)',
    alignItems: 'stretch',
    width: '100%',
    minWidth: '0',
    minHeight: '2.5rem',
    padding: '0',
    color: 'var(--text-primary)',
    background: 'transparent',
    fontFamily: 'var(--bs-body-font-family)',
    fontSize: '1em',
  },
  ".cm-markdown-table-row > .cm-widgetBuffer, .cm-markdown-table-row > span:empty:not([data-table-cell='true']), .cm-markdown-table-row > br":
    {
      display: 'none',
    },
  '.cm-markdown-table-cell': {
    position: 'relative',
    display: 'block',
    boxSizing: 'border-box',
    minWidth: '0',
    maxWidth: '100%',
    minHeight: '2.5rem',
    padding: '0.4rem 0.65rem',
    overflow: 'hidden',
    overflowWrap: 'anywhere',
    color: 'var(--text-primary)',
    background: 'transparent',
    borderInlineStartWidth: '1px',
    borderInlineStartStyle: 'solid',
    borderInlineStartColor: 'var(--border-color-solid)',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: 'var(--border-color-solid)',
    whiteSpace: 'pre-wrap',
  },
  '.cm-markdown-table-cell-first-row': {
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: 'var(--border-color-solid)',
  },
  '.cm-markdown-table-cell-last-column': {
    borderInlineEndWidth: '1px',
    borderInlineEndStyle: 'solid',
    borderInlineEndColor: 'var(--border-color-solid)',
  },
  '.cm-markdown-table-cell-active': {
    caretColor: 'var(--accent-color)',
    background: 'rgba(var(--accent-color-rgb), 0.08)',
    boxShadow: 'inset 0 0 0 1px rgba(var(--accent-color-rgb), 0.72)',
  },
  '&.cm-markdown-table-cursor-owned .cm-cursorLayer:not(.cm-markdown-table-cursor-layer) .cm-cursor-primary':
    {
      display: 'none',
    },
  '.cm-markdown-table-cursor-layer': {
    pointerEvents: 'none',
  },
  '.cm-markdown-table-cursor': {
    display: 'none',
    marginInlineStart: '-0.6px',
    borderInlineStart: '1.2px solid var(--accent-color)',
    pointerEvents: 'none',
  },
  '&.cm-focused .cm-markdown-table-cursor': {
    display: 'block',
  },
  '.cm-markdown-table-delimiter-block': {
    display: 'block',
    width: '0',
    minWidth: '0',
    height: '0',
    minHeight: '0',
    padding: '0',
    overflow: 'hidden',
    lineHeight: '0',
    border: '0',
    pointerEvents: 'none',
  },
  '.cm-markdown-table-delimiter-line.cm-line': {
    height: '0',
    minHeight: '0',
    padding: '0',
    overflow: 'hidden',
    lineHeight: '0',
    border: '0',
  },
  "[role='columnheader'].cm-markdown-table-cell": {
    backgroundImage:
      'linear-gradient(rgba(var(--accent-color-rgb), 0.38), rgba(var(--accent-color-rgb), 0.38))',
    backgroundPosition: 'bottom',
    backgroundRepeat: 'no-repeat',
    backgroundSize: `100% ${TABLE_HEADER_DELIMITER_HEIGHT_PX}px`,
    fontWeight: '650',
  },
  '.cm-markdown-table-cell-selected': {
    backgroundColor: 'var(--markdown-editor-selection-semantic)',
  },
  '.cm-markdown-table-cell-selected::after': {
    position: 'absolute',
    zIndex: '2',
    inset: '0',
    boxSizing: 'border-box',
    content: '""',
    pointerEvents: 'none',
  },
  '.cm-markdown-table-selection-top::after': {
    borderTop: '2px solid rgba(var(--accent-color-rgb), 0.8)',
  },
  '.cm-markdown-table-selection-bottom::after': {
    borderBottom: '2px solid rgba(var(--accent-color-rgb), 0.8)',
  },
  '.cm-markdown-table-selection-start::after': {
    borderInlineStart: '2px solid rgba(var(--accent-color-rgb), 0.8)',
  },
  '.cm-markdown-table-selection-end::after': {
    borderInlineEnd: '2px solid rgba(var(--accent-color-rgb), 0.8)',
  },
  '.cm-markdown-table-selection-top.cm-markdown-table-selection-start::after': {
    borderStartStartRadius: '0.4rem',
  },
  '.cm-markdown-table-selection-top.cm-markdown-table-selection-end::after': {
    borderStartEndRadius: '0.4rem',
  },
  '.cm-markdown-table-selection-bottom.cm-markdown-table-selection-start::after': {
    borderEndStartRadius: '0.4rem',
  },
  '.cm-markdown-table-selection-bottom.cm-markdown-table-selection-end::after': {
    borderEndEndRadius: '0.4rem',
  },
  '.cm-markdown-table-align-left': {
    textAlign: 'left',
  },
  '.cm-markdown-table-align-center': {
    textAlign: 'center',
  },
  '.cm-markdown-table-align-right': {
    textAlign: 'right',
  },
  '.cm-markdown-table-control': {
    position: 'absolute',
    zIndex: '3',
    display: 'grid',
    placeItems: 'center',
    padding: '0',
    color: 'var(--text-secondary)',
    background: 'transparent',
    border: '0',
    lineHeight: '1',
    opacity: '0',
    transition: 'opacity 100ms ease, color 100ms ease',
  },
  '.cm-markdown-table-control:hover, .cm-markdown-table-control:focus-visible': {
    color: 'var(--text-primary)',
    background: 'transparent',
    opacity: '1',
  },
  '.cm-markdown-table-control:focus-visible': {
    outline: '1px solid var(--bs-focus-ring-color)',
    outlineOffset: '1px',
  },
  '.cm-markdown-table-control.cm-markdown-table-drag-source, .cm-markdown-table-control.cm-markdown-table-drop-before, .cm-markdown-table-control.cm-markdown-table-drop-after':
    {
      color: 'var(--accent-color)',
      background: 'rgba(var(--accent-color-rgb), 0.12)',
      opacity: '1',
    },
  '.cm-markdown-table-control.cm-markdown-table-drag-source': {
    cursor: 'grabbing',
  },
  '.cm-markdown-table-row-handle': {
    top: '0',
    bottom: '0',
    left: '-1rem',
    width: '1rem',
    height: 'auto',
    borderRadius: '0.2rem',
    cursor: 'grab',
    touchAction: 'none',
  },
  '.cm-markdown-table-column-handle': {
    top: '-1rem',
    width: 'auto',
    height: '1.25rem',
    marginInlineStart: '0',
    borderRadius: '0.2rem',
    cursor: 'grab',
    touchAction: 'none',
  },
  '.cm-markdown-table-row-handle::before, .cm-markdown-table-column-handle::before': {
    content: '"⋮⋮"',
    fontSize: '0.7rem',
  },
  '.cm-markdown-table-drop-before::after, .cm-markdown-table-drop-after::after': {
    position: 'absolute',
    content: '""',
    background: 'var(--accent-color)',
    borderRadius: '999px',
    pointerEvents: 'none',
  },
  '.cm-markdown-table-row-handle.cm-markdown-table-drop-before::after': {
    top: '-0.35rem',
    left: '0',
    width: '100%',
    height: '0.2rem',
  },
  '.cm-markdown-table-row-handle.cm-markdown-table-drop-after::after': {
    bottom: '-0.35rem',
    left: '0',
    width: '100%',
    height: '0.2rem',
  },
  '.cm-markdown-table-column-handle.cm-markdown-table-drop-before::after': {
    top: '0',
    bottom: '0',
    left: '-0.35rem',
    width: '0.2rem',
  },
  '.cm-markdown-table-column-handle.cm-markdown-table-drop-after::after': {
    top: '0',
    right: '-0.35rem',
    bottom: '0',
    width: '0.2rem',
  },
  '.cm-markdown-table-drag-source-cell::before, .cm-markdown-table-drop-before-column::before, .cm-markdown-table-drop-after-column::before':
    {
      position: 'absolute',
      zIndex: '1',
      inset: '0',
      boxSizing: 'border-box',
      content: '""',
      pointerEvents: 'none',
    },
  '.cm-markdown-table-drag-source-cell::before': {
    background: 'rgba(var(--accent-color-rgb), 0.1)',
  },
  '.cm-markdown-table-drop-before-row': {
    boxShadow: 'inset 0 2px var(--accent-color)',
  },
  '.cm-markdown-table-drop-after-row': {
    boxShadow: 'inset 0 -2px var(--accent-color)',
  },
  '.cm-markdown-table-drop-before-column::before': {
    borderInlineStart: '2px solid var(--accent-color)',
  },
  '.cm-markdown-table-drop-after-column::before': {
    borderInlineEnd: '2px solid var(--accent-color)',
  },
  '.cm-markdown-table-add-row': {
    right: '0',
    bottom: '-0.75rem',
    left: '0',
    width: 'auto',
    height: '0.75rem',
    borderRadius: '0.2rem',
    fontSize: '0.8rem',
  },
  '.cm-markdown-table-add-column': {
    top: '0',
    right: '0',
    bottom: '0',
    width: '1.25rem',
    height: 'auto',
    borderRadius: '0.2rem',
    fontSize: '0.8rem',
  },
  '.cm-tooltip.cm-markdown-table-menu-tooltip': {
    padding: '0.3rem',
    overflow: 'hidden auto',
    color: 'var(--text-primary)',
    background: 'var(--surface-2)',
    border: '1px solid var(--border-color-solid)',
    borderRadius: '0.45rem',
    boxShadow: '0 0.5rem 1.5rem rgba(var(--text-primary-rgb), 0.18)',
  },
  '.cm-markdown-table-menu': {
    display: 'grid',
    minWidth: '13rem',
    maxHeight: 'min(28rem, 70vh)',
    gap: '0.1rem',
  },
  '.cm-markdown-table-menu-item': {
    width: '100%',
    padding: '0.45rem 0.6rem',
    color: 'var(--text-primary)',
    textAlign: 'start',
    background: 'transparent',
    border: '0',
    borderRadius: '0.3rem',
  },
  '.cm-markdown-table-menu-item:hover, .cm-markdown-table-menu-item:focus-visible': {
    background: 'rgba(var(--accent-color-rgb), 0.14)',
    outline: 'none',
  },
  '.cm-markdown-table-menu-separator': {
    height: '1px',
    margin: '0.25rem',
    background: 'var(--border-color-solid)',
  },
  '.cm-markdown-table-menu-status': {
    padding: '0.35rem 0.6rem',
    color: 'var(--danger-color, var(--text-primary))',
    fontSize: '0.85em',
  },
  '.cm-gutterElement.cm-markdown-table-continuation-gutter': {
    visibility: 'hidden',
  },
  '@media (hover: none), (pointer: coarse)': {
    '.cm-markdown-table-focused .cm-markdown-table-row-handle, .cm-markdown-table-focused .cm-markdown-table-column-handle, .cm-markdown-table-focused .cm-markdown-table-add-row, .cm-markdown-table-focused .cm-markdown-table-add-column':
      {
        opacity: '0.72',
      },
    '.cm-markdown-table-row-handle': {
      left: '-1.55rem',
      width: '2.75rem',
      height: 'auto',
    },
    '.cm-markdown-table-column-handle': {
      top: '-1.55rem',
      width: 'auto',
      height: '2.75rem',
      marginInlineStart: '0',
    },
    '.cm-markdown-table-add-row': {
      minHeight: '2.75rem',
    },
    '.cm-markdown-table-add-column': {
      minWidth: '2.75rem',
    },
  },
});

const tableStructureChange = Annotation.define<boolean>();
const emptySelection: MarkdownTableEditorSelection = {
  tableFrom: null,
  anchor: null,
  head: null,
};
const setMarkdownTableSelection = StateEffect.define<MarkdownTableEditorSelection>();
const setMarkdownTableDrag = StateEffect.define<TableDragState | null>();
const setMarkdownTableMenu = StateEffect.define<TableMenuState | null>();
const setTableCaretHistoryTarget = StateEffect.define<TableCaretHistoryTransition>({
  map: (transition, changes) => ({
    from:
      transition.from === null
        ? null
        : { ...transition.from, tableFrom: changes.mapPos(transition.from.tableFrom, 1) },
    to:
      transition.to === null
        ? null
        : { ...transition.to, tableFrom: changes.mapPos(transition.to.tableFrom, 1) },
  }),
});
const pointerSelections = new WeakMap<EditorView, PointerSelectionSession>();

const markdownTableEditorConfig = Facet.define<
  MarkdownTableEditorConfig,
  MarkdownTableEditorConfig | null
>({
  combine: (values) => values[0] ?? null,
});

export const markdownTableSelectionState = StateField.define<MarkdownTableEditorSelection>({
  create: () => emptySelection,
  update: (selection, transaction) => {
    let next = selection;
    if (transaction.docChanged && next.tableFrom !== null) {
      next = { ...next, tableFrom: transaction.changes.mapPos(next.tableFrom, 1) };
    }
    for (const effect of transaction.effects) {
      if (effect.is(setMarkdownTableSelection)) {
        next = effect.value;
      }
    }
    return next;
  },
});

const markdownTableDragState = StateField.define<TableDragState | null>({
  create: () => null,
  update: (value, transaction) => {
    let next = transaction.docChanged ? null : value;
    for (const effect of transaction.effects) {
      if (effect.is(setMarkdownTableDrag)) {
        next = effect.value;
      }
    }
    return next;
  },
});

const markdownTableMenuState = StateField.define<TableMenuState | null>({
  create: () => null,
  update: (value, transaction) => {
    let next = transaction.docChanged ? null : value;
    for (const effect of transaction.effects) {
      if (effect.is(setMarkdownTableMenu)) {
        next = effect.value;
      }
    }
    return next;
  },
  provide: (field) =>
    showTooltip.from(field, (menu): Tooltip | null =>
      menu === null
        ? null
        : {
            pos: menu.position,
            above: false,
            strictSide: false,
            arrow: false,
            create: (view) => createTableMenu(view, menu),
          },
    ),
});

const tableCaretHistoryTargetState = StateField.define<TableCaretHistoryTarget | null>({
  create: () => null,
  update: (target, transaction) => {
    let next = target;
    for (const effect of transaction.effects) {
      if (effect.is(setTableCaretHistoryTarget)) {
        next = effect.value.to;
      }
    }
    return next;
  },
});

class TableContinuationGutterMarker extends GutterMarker {
  override elementClass = 'cm-markdown-table-continuation-gutter';
}

const continuationGutterMarker = new TableContinuationGutterMarker();

const markdownTableGutterState = StateField.define<RangeSet<GutterMarker>>({
  create: (state) => buildGutterMarkers(state),
  update: (value, transaction) =>
    transaction.docChanged ? buildGutterMarkers(transaction.state) : value,
  provide: (field) => gutterLineClass.from(field),
});

class TableControlWidget extends WidgetType {
  constructor(
    readonly label: string,
    readonly action: 'add-row' | 'add-column' | 'drag-row' | 'drag-column',
    readonly tableFrom: number,
    readonly index: number | null,
    readonly classes: string,
    readonly geometry: TableControlGeometry,
  ) {
    super();
  }

  override eq(other: TableControlWidget): boolean {
    return (
      this.label === other.label &&
      this.action === other.action &&
      this.tableFrom === other.tableFrom &&
      this.index === other.index &&
      this.classes === other.classes &&
      this.geometry.inlineStart === other.geometry.inlineStart &&
      this.geometry.inlineSize === other.geometry.inlineSize
    );
  }

  override toDOM(): HTMLElement {
    const button = document.createElement('button');
    button.type = 'button';
    return this.updateButton(button);
  }

  override updateDOM(dom: HTMLElement): boolean {
    return dom instanceof HTMLButtonElement ? this.updateButton(dom) !== null : false;
  }

  override ignoreEvent(): boolean {
    return false;
  }

  private updateButton(button: HTMLButtonElement): HTMLButtonElement {
    button.className = this.classes;
    button.title = this.label;
    button.dataset['tableAction'] = this.action;
    button.dataset['tableFrom'] = this.tableFrom.toString();
    if (this.index === null) {
      delete button.dataset['index'];
    } else {
      button.dataset['index'] = this.index.toString();
    }
    if (this.action === 'drag-row' || this.action === 'drag-column') {
      button.setAttribute(
        'aria-grabbed',
        this.classes.includes('cm-markdown-table-drag-source') ? 'true' : 'false',
      );
    } else {
      button.removeAttribute('aria-grabbed');
    }
    button.setAttribute('aria-label', this.label);
    if (this.geometry.inlineStart === null) {
      button.style.removeProperty('inset-inline-start');
    } else {
      button.style.insetInlineStart = this.geometry.inlineStart;
    }
    if (this.geometry.inlineSize === null) {
      button.style.removeProperty('inline-size');
    } else {
      button.style.inlineSize = this.geometry.inlineSize;
    }
    button.textContent = this.action === 'add-row' || this.action === 'add-column' ? '+' : '';
    return button;
  }
}

class TableColumnEdgeSegmentWidget extends WidgetType {
  constructor(
    readonly label: string,
    readonly tableFrom: number,
  ) {
    super();
  }

  override eq(other: TableColumnEdgeSegmentWidget): boolean {
    return this.label === other.label && this.tableFrom === other.tableFrom;
  }

  override toDOM(): HTMLElement {
    const segment = document.createElement('span');
    segment.className = 'cm-markdown-table-control cm-markdown-table-add-column';
    segment.title = this.label;
    segment.dataset['tableAction'] = 'add-column';
    segment.dataset['tableFrom'] = this.tableFrom.toString();
    segment.setAttribute('aria-hidden', 'true');
    segment.textContent = '+';
    return segment;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

class TableDelimiterWidget extends WidgetType {
  override eq(): boolean {
    return true;
  }

  override get estimatedHeight(): number {
    return 0;
  }

  override toDOM(): HTMLElement {
    const delimiter = document.createElement('div');
    delimiter.className = 'cm-markdown-table-delimiter-block';
    delimiter.setAttribute('aria-hidden', 'true');
    return delimiter;
  }
}

const tableDelimiterWidget = new TableDelimiterWidget();

const markdownTableCursorLayer = layer({
  above: true,
  class: 'cm-markdown-table-cursor-layer',
  markers: (view) => {
    if (!ownsTableCursor(view.state)) {
      return [];
    }
    const active = activeTableCell(view.state);
    if (active === null) {
      return [];
    }
    const cell = renderedTableCell(view, active.layout.from, active.cell);
    if (cell === null) {
      return [];
    }
    const coordinates = tableCursorCoordinates(view, active.cell, cell);
    const scrollBounds = view.scrollDOM.getBoundingClientRect();
    const baseLeft =
      view.textDirection === Direction.LTR
        ? scrollBounds.left
        : scrollBounds.right - view.scrollDOM.clientWidth * view.scaleX;
    return [
      new RectangleMarker(
        'cm-markdown-table-cursor',
        coordinates.left - (baseLeft - view.scrollDOM.scrollLeft * view.scaleX),
        coordinates.top - (scrollBounds.top - view.scrollDOM.scrollTop * view.scaleY),
        null,
        coordinates.bottom - coordinates.top,
      ),
    ];
  },
  update: (update) =>
    update.docChanged ||
    update.selectionSet ||
    update.viewportChanged ||
    update.geometryChanged ||
    update.focusChanged,
  mount: (element) => {
    element.classList.add('cm-cursorLayer', 'cm-markdown-table-cursor-layer');
  },
});

class EmptyTableCellWidget extends WidgetType {
  constructor(
    readonly role: 'cell' | 'columnheader',
    readonly classes: string,
    readonly tableFrom: number,
    readonly row: number,
    readonly column: number,
    readonly position: number,
  ) {
    super();
  }

  override eq(other: EmptyTableCellWidget): boolean {
    return (
      this.role === other.role &&
      this.classes === other.classes &&
      this.tableFrom === other.tableFrom &&
      this.row === other.row &&
      this.column === other.column &&
      this.position === other.position
    );
  }

  override toDOM(): HTMLElement {
    const cell = document.createElement('span');
    cell.className = this.classes;
    cell.setAttribute('role', this.role);
    cell.dataset['tableCell'] = 'true';
    cell.dataset['emptyCell'] = 'true';
    cell.dataset['tableFrom'] = this.tableFrom.toString();
    cell.dataset['row'] = this.row.toString();
    cell.dataset['column'] = this.column.toString();
    cell.dataset['cellFrom'] = this.position.toString();
    if (this.classes.includes('cm-markdown-table-cell-selected')) {
      cell.setAttribute('aria-selected', 'true');
    }
    if (this.classes.includes('cm-markdown-table-cell-active')) {
      cell.dataset['activeCell'] = 'true';
    }
    return cell;
  }

  override coordsAt(dom: HTMLElement): Rect {
    const bounds = dom.getBoundingClientRect();
    const styles = dom.ownerDocument.defaultView?.getComputedStyle(dom);
    const padding = cssPixels(styles?.paddingInlineStart ?? styles?.paddingLeft, 0);
    const fontSize = cssPixels(styles?.fontSize, 16);
    const lineHeight = Math.min(
      bounds.height,
      cssPixels(styles?.lineHeight, Math.max(fontSize * 1.2, 1)),
    );
    const left =
      styles?.direction === 'rtl'
        ? Math.max(bounds.left, bounds.right - padding)
        : bounds.left + padding;
    const top = bounds.top + Math.max((bounds.height - lineHeight) / 2, 0);
    return {
      left,
      right: left,
      top,
      bottom: top + lineHeight,
    };
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

function cssPixels(value: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
}

function ownsTableCursor(state: EditorState): boolean {
  const tableSelection = state.field(markdownTableSelectionState, false);
  return (
    state.selection.ranges.length === 1 &&
    state.selection.main.empty &&
    tableSelection?.anchor === null &&
    activeTableCell(state) !== null
  );
}

function renderedTableCell(
  view: EditorView,
  tableFrom: number,
  cell: TableCellLayout,
): HTMLElement | null {
  return (
    [...view.contentDOM.querySelectorAll<HTMLElement>('[data-table-cell="true"]')].find(
      (element) =>
        numberData(element, 'tableFrom') === tableFrom &&
        numberData(element, 'row') === cell.rowIndex &&
        numberData(element, 'column') === cell.columnIndex,
    ) ?? null
  );
}

function tableCursorCoordinates(
  view: EditorView,
  cell: TableCellLayout,
  element: HTMLElement,
): Rect {
  const position = view.state.selection.main.head;
  if (cell.from === cell.to) {
    return fallbackCellCaretCoordinates(element, false);
  }
  const side = position >= cell.to ? -1 : view.state.selection.main.assoc || 1;
  const nativeCoordinates = view.coordsAtPos(position, side);
  const bounds = element.getBoundingClientRect();
  if (nativeCoordinates !== null && rectBelongsToCell(nativeCoordinates, bounds)) {
    return nativeCoordinates;
  }
  return (
    domTextCaretCoordinates(element, Math.max(position - cell.from, 0)) ??
    fallbackCellCaretCoordinates(element, position >= cell.to && cell.from < cell.to)
  );
}

function rectBelongsToCell(rect: Rect, cell: DOMRect): boolean {
  const tolerance = 1;
  return (
    rect.bottom > rect.top &&
    rect.left >= cell.left - tolerance &&
    rect.left <= cell.right + tolerance &&
    rect.top >= cell.top - tolerance &&
    rect.bottom <= cell.bottom + tolerance
  );
}

function domTextCaretCoordinates(element: HTMLElement, offset: number): Rect | null {
  const textNodes: Text[] = [];
  const walker = element.ownerDocument.createTreeWalker(element, 4);
  for (let current = walker.nextNode(); current !== null; current = walker.nextNode()) {
    if (
      current instanceof Text &&
      current.parentElement?.closest('.cm-markdown-table-control') === null
    ) {
      textNodes.push(current);
    }
  }
  if (textNodes.length === 0) {
    return null;
  }
  let remaining = Math.min(
    offset,
    textNodes.reduce((length, node) => length + node.data.length, 0),
  );
  let target = textNodes[0]!;
  for (const node of textNodes) {
    target = node;
    if (remaining <= node.data.length) {
      break;
    }
    remaining -= node.data.length;
  }
  const range = element.ownerDocument.createRange();
  range.setStart(target, Math.min(remaining, target.data.length));
  range.collapse(true);
  const collapsed = range.getBoundingClientRect();
  if (collapsed.bottom > collapsed.top) {
    return collapsed;
  }
  const characterOffset = Math.min(remaining, target.data.length) - 1;
  if (characterOffset < 0) {
    return null;
  }
  range.setStart(target, characterOffset);
  range.setEnd(target, characterOffset + 1);
  const character = range.getBoundingClientRect();
  return character.bottom > character.top
    ? {
        left: character.right,
        right: character.right,
        top: character.top,
        bottom: character.bottom,
      }
    : null;
}

function fallbackCellCaretCoordinates(element: HTMLElement, atEnd: boolean): Rect {
  const bounds = element.getBoundingClientRect();
  const styles = element.ownerDocument.defaultView?.getComputedStyle(element);
  const paddingStart = cssPixels(styles?.paddingInlineStart ?? styles?.paddingLeft, 0);
  const paddingEnd = cssPixels(styles?.paddingInlineEnd ?? styles?.paddingRight, 0);
  const fontSize = cssPixels(styles?.fontSize, 16);
  const lineHeight = Math.min(
    bounds.height,
    cssPixels(styles?.lineHeight, Math.max(fontSize * 1.2, 1)),
  );
  const left = atEnd ? bounds.right - paddingEnd : bounds.left + paddingStart;
  const top = bounds.top + Math.max((bounds.height - lineHeight) / 2, 0);
  return { left, right: left, top, bottom: top + lineHeight };
}

export function markdownTableEditor(config: MarkdownTableEditorConfig): Extension {
  const decorationsField = createTableDecorationsState(config);
  const fromEditorContent =
    (command: Command): Command =>
    (view) =>
      editorContentHasFocus(view) && !view.composing && command(view);
  return [
    markdownTableEditorTheme,
    markdownTableCursorLayer,
    EditorView.editorAttributes.of((view) => ({
      class: ownsTableCursor(view.state) ? 'cm-markdown-table-cursor-owned' : '',
    })),
    markdownTableEditorConfig.of(config),
    markdownTableSelectionState,
    markdownTableDragState,
    markdownTableMenuState,
    markdownTableGutterState,
    tableCaretHistoryTargetState,
    invertedEffects.of((transaction) =>
      transaction.effects.flatMap((effect) =>
        effect.is(setTableCaretHistoryTarget)
          ? [
              setTableCaretHistoryTarget.of({
                from: effect.value.to,
                to: effect.value.from,
              }),
            ]
          : [],
      ),
    ),
    EditorView.updateListener.of(repairTableCaretAfterDocumentChange),
    ViewPlugin.fromClass(TableOutsidePointerPlugin),
    EditorState.transactionFilter.of((transaction) => protectTableStructure(transaction)),
    decorationsField,
    EditorView.blockWrappers.of((view) => buildBlockWrappers(view.state, config.phrases)),
    Prec.highest(
      keymap.of([
        { key: 'Tab', run: fromEditorContent((view) => navigateTableCell(view, 1, false)) },
        {
          key: 'Shift-Tab',
          run: fromEditorContent((view) => navigateTableCell(view, -1, false)),
        },
        { key: 'Enter', run: fromEditorContent((view) => navigateTableCell(view, 1, true)) },
        { key: 'Shift-Enter', run: fromEditorContent(insertTableHardBreak) },
        {
          key: 'ArrowLeft',
          run: fromEditorContent((view) => navigateTableArrow(view, 'left')),
        },
        {
          key: 'ArrowRight',
          run: fromEditorContent((view) => navigateTableArrow(view, 'right')),
        },
        {
          key: 'ArrowUp',
          run: fromEditorContent((view) => navigateTableArrow(view, 'up')),
        },
        {
          key: 'ArrowDown',
          run: fromEditorContent((view) => navigateTableArrow(view, 'down')),
        },
        { key: 'Escape', run: (view) => closeTableSurface(view) },
        {
          key: 'Backspace',
          run: fromEditorContent((view) => protectOrDeleteTableStructure(view, 'backward')),
        },
        {
          key: 'Delete',
          run: fromEditorContent((view) => protectOrDeleteTableStructure(view, 'forward')),
        },
      ]),
    ),
    EditorView.domEventHandlers({
      pointerdown: (event, view) => handlePointerDown(event, view),
      pointermove: (event, view) => handlePointerMove(event, view),
      pointerup: (event, view) => handlePointerUp(event, view),
      pointercancel: (event, view) => cancelTableDrag(event, view),
      lostpointercapture: (event, view) => cancelTableDrag(event, view),
      click: (event, view) => handleClick(event, view),
      contextmenu: (event, view) => handleContextMenu(event, view),
      keydown: (event, view) => handleEditorKeyDown(event, view),
      copy: (event, view) => handleCopy(event, view, false),
      cut: (event, view) => handleCopy(event, view, true),
      paste: (event, view) => handlePaste(event, view),
    }),
  ];
}

class TableOutsidePointerPlugin {
  private readonly ownerDocument: Document;
  private readonly handlePointerDown = (event: PointerEvent): void => {
    const target = event.target;
    if (
      target instanceof Node &&
      !this.view.dom.contains(target) &&
      !(target instanceof Element && target.closest('.cm-markdown-table-menu') !== null)
    ) {
      clearCellSelection(this.view);
      closeTableMenu(this.view);
    }
  };

  constructor(private readonly view: EditorView) {
    this.ownerDocument = view.dom.ownerDocument;
    this.ownerDocument.addEventListener('pointerdown', this.handlePointerDown, true);
  }

  destroy(): void {
    this.ownerDocument.removeEventListener('pointerdown', this.handlePointerDown, true);
  }
}

export function markdownTableSelectionTsv(view: EditorView): string | null {
  const context = selectedTableContext(view.state);
  if (context === null) {
    return null;
  }
  const value = markdownTableSelectionToTsv(context.layout.table, context.selection);
  return value.length === 0 ? null : value;
}

export function pasteMarkdownTableText(view: EditorView, text: string): boolean {
  const selected = selectedTableContext(view.state);
  const active = activeTableCell(view.state);
  if (selected === null && active === null) {
    return false;
  }
  const grid = parseMarkdownTableClipboard(text);
  const singleCell = grid.rows.length === 1 ? grid.rows[0] : undefined;
  if (selected === null && singleCell?.length === 1) {
    view.dispatch(view.state.replaceSelection(singleCell[0] ?? ''), {
      annotations: Transaction.userEvent.of('input.paste'),
    });
    return true;
  }
  const layout = selected?.layout ?? active?.layout;
  if (layout === undefined) {
    return false;
  }
  const start =
    selected === null
      ? requiredActiveCell(active).cell
      : {
          rowIndex: markdownTableSelectionBounds(layout.table, selected.selection).minRow,
          columnIndex: markdownTableSelectionBounds(layout.table, selected.selection).minColumn,
        };
  const changed = applyMarkdownTableGrid(layout.table, start.rowIndex, start.columnIndex, grid);
  const lastRow = start.rowIndex + Math.max(0, grid.rows.length - 1);
  const lastColumn =
    start.columnIndex + Math.max(0, Math.max(...grid.rows.map((row) => row.length), 1) - 1);
  return replaceTable(
    view,
    layout,
    changed,
    { rowIndex: lastRow, columnIndex: lastColumn, atEnd: true },
    true,
    true,
  );
}

export function runMarkdownTableAction(
  view: EditorView,
  action: MarkdownTableEditorAction,
): boolean {
  const context = selectedTableContext(view.state);
  const layout = context?.layout ?? tableAtPosition(view.state, view.state.selection.main.head);
  if (layout === null) {
    return false;
  }
  if (action === 'deleteTable') {
    return deleteWholeTable(view, layout);
  }
  if (action === 'format') {
    return replaceTableSource(view, layout, formatMarkdownTable(layout.table), false, true, null);
  }
  if (context === null) {
    return false;
  }
  if (action === 'copy') {
    return markdownTableSelectionTsv(view) !== null;
  }
  if (action === 'cut' || action === 'delete') {
    return deleteSelectedRange(view, context.layout, context.selection);
  }
  if (action === 'clear') {
    return replaceTablePreservingRange(
      view,
      context.layout,
      clearMarkdownTableSelection(context.layout.table, context.selection),
      context.selection,
    );
  }
  const bounds = markdownTableSelectionBounds(context.layout.table, context.selection);
  if (action === 'sortAscending' || action === 'sortDescending') {
    if (bounds.minColumn !== bounds.maxColumn) {
      return false;
    }
    const table = sortMarkdownTableBody(
      context.layout.table,
      bounds.minColumn,
      action === 'sortAscending' ? 'ascending' : 'descending',
      requiredConfig(view.state).locale,
    );
    return replaceTablePreservingRange(view, context.layout, table, context.selection);
  }
  if (action === 'alignLeft' || action === 'alignCenter' || action === 'alignRight') {
    const columns = inclusiveIndices(bounds.minColumn, bounds.maxColumn);
    const alignment =
      action === 'alignLeft' ? 'left' : action === 'alignCenter' ? 'center' : 'right';
    const table = setMarkdownTableAlignment(context.layout.table, columns, alignment);
    return replaceTablePreservingRange(view, context.layout, table, context.selection);
  }
  const kind = classifyMarkdownTableSelection(context.layout.table, context.selection);
  if (kind === 'rows') {
    return runAxisAction(view, context, action, 'row');
  }
  if (kind === 'columns') {
    return runAxisAction(view, context, action, 'column');
  }
  return false;
}

function createTableDecorationsState(config: MarkdownTableEditorConfig): StateField<{
  readonly decorations: DecorationSet;
  readonly atomicDecorations: DecorationSet;
}> {
  return StateField.define({
    create: (state) => buildDecorations(state, config),
    update: (value, transaction) =>
      transaction.docChanged ||
      !transaction.startState.selection.eq(transaction.state.selection) ||
      transaction.effects.some(
        (effect) => effect.is(setMarkdownTableSelection) || effect.is(setMarkdownTableDrag),
      )
        ? buildDecorations(transaction.state, config)
        : value,
    provide: (field) => [
      EditorView.decorations.from(field, (value) => value.decorations),
      EditorView.atomicRanges.of((view) => view.state.field(field).atomicDecorations),
    ],
  });
}

function buildBlockWrappers(
  state: EditorState,
  phrases: MarkdownTableEditorPhrases,
): ReturnType<typeof BlockWrapper.set> {
  const selection = state.field(markdownTableSelectionState);
  return BlockWrapper.set(
    findTableLayouts(state).map((layout) => {
      const focused =
        state.selection.main.head >= layout.from && state.selection.main.head <= layout.to;
      return BlockWrapper.create({
        tagName: 'div',
        attributes: {
          class: ['cm-markdown-table-editor', focused ? 'cm-markdown-table-focused' : '']
            .filter((value) => value.length > 0)
            .join(' '),
          role: 'table',
          'aria-label':
            selection.tableFrom === layout.from && selection.anchor !== null
              ? `${phrases.table}: ${phrases.range}`
              : phrases.table,
          'aria-multiselectable': 'true',
          'data-table-from': layout.from.toString(),
          tabindex: '-1',
        },
      }).range(layout.from, layout.to);
    }),
    true,
  );
}

function buildDecorations(
  state: EditorState,
  config: MarkdownTableEditorConfig,
): {
  readonly decorations: DecorationSet;
  readonly atomicDecorations: DecorationSet;
} {
  const ranges: Range<Decoration>[] = [];
  const atomic: Range<Decoration>[] = [];
  const editorSelection = state.field(markdownTableSelectionState);
  const drag = state.field(markdownTableDragState);
  for (const layout of findTableLayouts(state)) {
    const selection =
      editorSelection.tableFrom === layout.from &&
      editorSelection.anchor !== null &&
      editorSelection.head !== null
        ? { anchor: editorSelection.anchor, head: editorSelection.head }
        : null;
    const bounds =
      selection === null ? null : markdownTableSelectionBounds(layout.table, selection);
    for (const [rowPosition, row] of layout.rows.entries()) {
      const isDelimiter = row.semanticIndex === null;
      if (isDelimiter) {
        const nextRow = layout.rows[rowPosition + 1];
        ranges.push(
          Decoration.line({
            attributes: {
              class: 'cm-markdown-table-delimiter-line',
              'aria-hidden': 'true',
            },
          }).range(row.from),
        );
        const replacement = Decoration.replace({
          block: true,
          inclusive: false,
          widget: tableDelimiterWidget,
        }).range(row.from, nextRow?.from ?? row.to);
        ranges.push(replacement);
        atomic.push(replacement);
        continue;
      }
      ranges.push(
        Decoration.line({
          attributes: {
            class: [
              'cm-markdown-table',
              'cm-markdown-table-row',
              ...tableRowDragClasses(drag, layout.from, requiredSemanticIndex(row)),
            ].join(' '),
            role: 'row',
          },
        }).range(row.from),
      );
      const rowIndex = requiredSemanticIndex(row);
      const rowHandle = new TableControlWidget(
        `${config.phrases.moveRow} ${rowIndex + 1}`,
        'drag-row',
        layout.from,
        rowIndex,
        dragHandleClasses(drag, layout.from, 'row', rowIndex),
        { inlineStart: null, inlineSize: null },
      );
      ranges.push(
        Decoration.widget({
          widget: rowHandle,
          side: -400,
        }).range(requiredValue(row.cells, 0).renderFrom),
      );
      ranges.push(
        Decoration.widget({
          widget:
            rowIndex === 0
              ? new TableControlWidget(
                  config.phrases.addColumn,
                  'add-column',
                  layout.from,
                  null,
                  'cm-markdown-table-control cm-markdown-table-add-column',
                  { inlineStart: null, inlineSize: null },
                )
              : new TableColumnEdgeSegmentWidget(config.phrases.addColumn, layout.from),
          side: -2000,
        }).range(requiredValue(row.cells, 0).renderFrom),
      );
      if (rowIndex === layout.table.body.length) {
        ranges.push(
          Decoration.widget({
            widget: new TableControlWidget(
              config.phrases.addRow,
              'add-row',
              layout.from,
              null,
              'cm-markdown-table-control cm-markdown-table-add-row',
              { inlineStart: null, inlineSize: null },
            ),
            side: -1900,
          }).range(requiredValue(row.cells, 0).renderFrom),
        );
      }
      for (const structuralRange of row.structuralRanges) {
        const replacement = Decoration.replace({ inclusive: false }).range(
          structuralRange.from,
          structuralRange.to,
        );
        ranges.push(replacement);
        atomic.push(replacement);
      }
      for (const cell of row.cells) {
        const active =
          state.selection.ranges.length === 1 &&
          state.selection.main.empty &&
          !cell.virtual &&
          ((state.selection.main.head >= cell.from && state.selection.main.head <= cell.to) ||
            state.selection.main.head === cell.cursor);
        const classes = tableCellClasses(layout, cell, bounds, active, drag);
        const role = cell.rowIndex === 0 ? 'columnheader' : 'cell';
        if (!cell.virtual && cell.renderFrom < cell.renderTo) {
          ranges.push(
            Decoration.mark({
              class: classes,
              inclusiveStart: true,
              inclusiveEnd: true,
              attributes: {
                role,
                'data-table-cell': 'true',
                'data-table-from': layout.from.toString(),
                'data-row': cell.rowIndex.toString(),
                'data-column': cell.columnIndex.toString(),
                'data-cell-from': cell.cursor.toString(),
                ...(cell.from === cell.to ? { 'data-empty-cell': 'true' } : {}),
                ...(classes.includes('cm-markdown-table-cell-selected')
                  ? { 'aria-selected': 'true' }
                  : {}),
                ...(active ? { 'data-active-cell': 'true' } : {}),
              },
            }).range(cell.renderFrom, cell.renderTo),
          );
        } else {
          ranges.push(
            Decoration.widget({
              widget: new EmptyTableCellWidget(
                role,
                classes,
                layout.from,
                cell.rowIndex,
                cell.columnIndex,
                cell.cursor,
              ),
              side: cell.columnIndex + 1,
            }).range(cell.renderFrom),
          );
        }
        if (cell.rowIndex === 0) {
          ranges.push(
            Decoration.widget({
              widget: new TableControlWidget(
                `${config.phrases.moveColumn} ${cell.columnIndex + 1}`,
                'drag-column',
                layout.from,
                cell.columnIndex,
                dragHandleClasses(drag, layout.from, 'column', cell.columnIndex),
                {
                  inlineStart: `${(cell.columnIndex / layout.table.columnCount) * 100}%`,
                  inlineSize: `${(1 / layout.table.columnCount) * 100}%`,
                },
              ),
              side: -500 + cell.columnIndex,
            }).range(cell.renderFrom),
          );
        }
      }
    }
  }
  return {
    decorations: Decoration.set(ranges, true),
    atomicDecorations: Decoration.set(atomic, true),
  };
}

function buildGutterMarkers(state: EditorState): RangeSet<GutterMarker> {
  const markers = findTableLayouts(state).flatMap((layout) =>
    layout.rows.slice(1).map((row) => continuationGutterMarker.range(row.from)),
  );
  return RangeSet.of(markers, true);
}

function tableCellClasses(
  layout: TableLayout,
  cell: TableCellLayout,
  bounds: ReturnType<typeof markdownTableSelectionBounds> | null,
  active: boolean,
  drag: TableDragState | null,
): string {
  const selected =
    bounds !== null &&
    cell.rowIndex >= bounds.minRow &&
    cell.rowIndex <= bounds.maxRow &&
    cell.columnIndex >= bounds.minColumn &&
    cell.columnIndex <= bounds.maxColumn;
  return [
    'cm-markdown-table-cell',
    cell.rowIndex === 0 ? 'cm-markdown-table-cell-first-row' : '',
    cell.columnIndex === layout.table.columnCount - 1 ? 'cm-markdown-table-cell-last-column' : '',
    `cm-markdown-table-align-${layout.table.alignments[cell.columnIndex] ?? 'none'}`,
    active ? 'cm-markdown-table-cell-active' : '',
    selected ? 'cm-markdown-table-cell-selected' : '',
    selected && cell.rowIndex === bounds?.minRow ? 'cm-markdown-table-selection-top' : '',
    selected && cell.rowIndex === bounds?.maxRow ? 'cm-markdown-table-selection-bottom' : '',
    selected && cell.columnIndex === bounds?.minColumn ? 'cm-markdown-table-selection-start' : '',
    selected && cell.columnIndex === bounds?.maxColumn ? 'cm-markdown-table-selection-end' : '',
    ...tableCellDragClasses(drag, layout.from, cell),
  ]
    .filter((value) => value.length > 0)
    .join(' ');
}

function tableRowDragClasses(
  drag: TableDragState | null,
  tableFrom: number,
  rowIndex: number,
): readonly string[] {
  if (drag?.tableFrom !== tableFrom || drag.axis !== 'row') {
    return [];
  }
  return [
    drag.indices.includes(rowIndex) ? 'cm-markdown-table-drag-source-row' : '',
    drag.targetIndex === rowIndex && drag.targetGap === rowIndex
      ? 'cm-markdown-table-drop-before-row'
      : '',
    drag.targetIndex === rowIndex && drag.targetGap === rowIndex + 1
      ? 'cm-markdown-table-drop-after-row'
      : '',
  ].filter((value) => value.length > 0);
}

function tableCellDragClasses(
  drag: TableDragState | null,
  tableFrom: number,
  cell: TableCellLayout,
): readonly string[] {
  if (drag?.tableFrom !== tableFrom) {
    return [];
  }
  const cellIndex = drag.axis === 'row' ? cell.rowIndex : cell.columnIndex;
  return [
    drag.indices.includes(cellIndex) ? 'cm-markdown-table-drag-source-cell' : '',
    drag.axis === 'column' &&
    drag.targetIndex === cell.columnIndex &&
    drag.targetGap === cell.columnIndex
      ? 'cm-markdown-table-drop-before-column'
      : '',
    drag.axis === 'column' &&
    drag.targetIndex === cell.columnIndex &&
    drag.targetGap === cell.columnIndex + 1
      ? 'cm-markdown-table-drop-after-column'
      : '',
  ].filter((value) => value.length > 0);
}

function dragHandleClasses(
  drag: TableDragState | null,
  tableFrom: number,
  axis: MarkdownTableSelectionAxis,
  index: number,
): string {
  const dropClass =
    drag?.tableFrom === tableFrom && drag.axis === axis && drag.targetIndex === index
      ? drag.targetGap === index
        ? 'cm-markdown-table-drop-before'
        : 'cm-markdown-table-drop-after'
      : '';
  const sourceClass =
    drag?.tableFrom === tableFrom && drag.axis === axis && drag.indices.includes(index)
      ? 'cm-markdown-table-drag-source'
      : '';
  return [
    'cm-markdown-table-control',
    axis === 'row' ? 'cm-markdown-table-row-handle' : 'cm-markdown-table-column-handle',
    sourceClass,
    dropClass,
  ]
    .filter((value) => value.length > 0)
    .join(' ');
}

function handlePointerDown(event: PointerEvent, view: EditorView): boolean {
  const control = tableControl(event.target);
  if (control !== null) {
    const action = control.dataset['tableAction'];
    if (action === 'drag-row' || action === 'drag-column') {
      if (!(control instanceof HTMLButtonElement) || !event.isPrimary || event.button !== 0) {
        return false;
      }
      return startTableDrag(event, view, control, action === 'drag-row' ? 'row' : 'column');
    }
    if (action === 'add-row' || action === 'add-column') {
      event.preventDefault();
      return true;
    }
    return false;
  }
  const targetCell = tableCellElement(event.target);
  if (targetCell === null) {
    pointerSelections.delete(view);
    clearCellSelection(view);
    return false;
  }
  const cell = cellData(targetCell);
  const cursor = numberData(targetCell, 'cellFrom');
  if (cell === null || cursor === null) {
    return false;
  }
  const current = view.state.field(markdownTableSelectionState);
  if (event.shiftKey && current.tableFrom === cell.tableFrom && current.anchor !== null) {
    event.preventDefault();
    view.dispatch({
      effects: setMarkdownTableSelection.of({
        tableFrom: cell.tableFrom,
        anchor: current.anchor,
        head: { row: cell.row, column: cell.column },
      }),
      userEvent: 'select.pointer',
    });
    focusEditorWithoutScroll(view);
    return true;
  }
  pointerSelections.set(view, {
    tableFrom: cell.tableFrom,
    anchor: { row: cell.row, column: cell.column },
    cursor,
    pointerId: event.pointerId,
    crossedCell: false,
  });
  if (targetCell.dataset['emptyCell'] === 'true') {
    event.preventDefault();
    return enterEmptyTableCell(view, cell);
  }
  return false;
}

function enterEmptyTableCell(
  view: EditorView,
  target: { readonly tableFrom: number; readonly row: number; readonly column: number },
): boolean {
  const layout = tableByFrom(view.state, target.tableFrom);
  if (layout === null) {
    return false;
  }
  const selection: MarkdownTableCellRange = {
    anchor: { row: target.row, column: target.column },
    head: { row: target.row, column: target.column },
  };
  const table = clearMarkdownTableSelection(layout.table, selection);
  const source = serializeMarkdownTable(table);
  const cursorOffset = cellOffset(table, target.row, target.column, false);
  const replaced =
    source === view.state.sliceDoc(layout.from, layout.to)
      ? dispatchTableCursor(view, layout.from + cursorOffset)
      : replaceTableSource(view, layout, source, true, false, cursorOffset);
  focusEditorWithoutScroll(view);
  return replaced;
}

function dispatchTableCursor(view: EditorView, position: number): boolean {
  view.dispatch({
    selection: EditorSelection.cursor(position),
    effects: [setMarkdownTableSelection.of(emptySelection), setMarkdownTableMenu.of(null)],
    userEvent: 'select.pointer',
  });
  return true;
}

function handlePointerMove(event: PointerEvent, view: EditorView): boolean {
  const drag = view.state.field(markdownTableDragState);
  if (drag !== null) {
    if (event.pointerId !== drag.pointerId) {
      return false;
    }
    event.preventDefault();
    const target = tableDragTarget(event, view, drag);
    if (drag.targetIndex !== (target?.index ?? null) || drag.targetGap !== (target?.gap ?? null)) {
      view.dispatch({
        effects: setMarkdownTableDrag.of({
          ...drag,
          targetIndex: target?.index ?? null,
          targetGap: target?.gap ?? null,
        }),
        userEvent: 'select.pointer',
      });
    }
    return true;
  }
  const pointerTarget = pointerTargetAtCoordinates(event, view);
  const session = pointerSelections.get(view);
  if (session === undefined || session.pointerId !== event.pointerId) {
    return false;
  }
  const target = tableCellElement(pointerTarget);
  const cell = target === null ? null : cellData(target);
  if (
    cell === null ||
    cell.tableFrom !== session.tableFrom ||
    (cell.row === session.anchor.row && cell.column === session.anchor.column)
  ) {
    return false;
  }
  session.crossedCell = true;
  event.preventDefault();
  view.dom.ownerDocument.getSelection()?.removeAllRanges();
  view.dispatch({
    selection: EditorSelection.cursor(session.cursor),
    effects: setMarkdownTableSelection.of({
      tableFrom: session.tableFrom,
      anchor: session.anchor,
      head: { row: cell.row, column: cell.column },
    }),
    userEvent: 'select.pointer',
  });
  focusEditorWithoutScroll(view);
  return true;
}

function pointerTargetAtCoordinates(event: PointerEvent, view: EditorView): EventTarget | null {
  const ownerDocument = view.dom.ownerDocument;
  const elementFromPoint = ownerDocument.elementFromPoint;
  return typeof elementFromPoint === 'function'
    ? elementFromPoint.call(ownerDocument, event.clientX, event.clientY)
    : event.target;
}

function handlePointerUp(event: PointerEvent, view: EditorView): boolean {
  const drag = view.state.field(markdownTableDragState);
  if (drag !== null) {
    if (event.pointerId !== drag.pointerId) {
      return false;
    }
    event.preventDefault();
    const target = tableDragTarget(event, view, drag);
    return finishTableDrag(view, {
      ...drag,
      targetIndex: target?.index ?? null,
      targetGap: target?.gap ?? null,
    });
  }
  const session = pointerSelections.get(view);
  if (session === undefined || session.pointerId !== event.pointerId) {
    return false;
  }
  pointerSelections.delete(view);
  if (session.crossedCell) {
    event.preventDefault();
    view.dom.ownerDocument.getSelection()?.removeAllRanges();
    view.dispatch({
      selection: EditorSelection.cursor(session.cursor),
      userEvent: 'select.pointer',
    });
    focusEditorWithoutScroll(view);
  } else {
    clearCellSelection(view);
  }
  return session.crossedCell;
}

function cancelTableDrag(event: PointerEvent, view: EditorView): boolean {
  const drag = view.state.field(markdownTableDragState);
  if (drag === null || event.pointerId !== drag.pointerId) {
    return false;
  }
  view.dispatch({
    effects: setMarkdownTableDrag.of(null),
    userEvent: 'select.pointer',
  });
  return true;
}

function handleClick(event: MouseEvent, view: EditorView): boolean {
  const control = tableControl(event.target);
  if (control === null) {
    return false;
  }
  const tableFrom = numberData(control, 'tableFrom');
  const action = control.dataset['tableAction'];
  if (tableFrom === null || (action !== 'add-row' && action !== 'add-column')) {
    return false;
  }
  const layout = tableByFrom(view.state, tableFrom);
  if (layout === null) {
    return false;
  }
  event.preventDefault();
  const table =
    action === 'add-row'
      ? insertMarkdownTableRows(layout.table, layout.table.body.length, 'after', 1)
      : insertMarkdownTableColumns(layout.table, layout.table.columnCount - 1, 'after', 1);
  const replaced = replaceTable(view, layout, table, null, true, false);
  focusEditorWithoutScroll(view);
  return replaced;
}

function handleContextMenu(event: MouseEvent, view: EditorView): boolean {
  const target = tableCellElement(event.target);
  if (target === null) {
    return false;
  }
  const cell = cellData(target);
  const position = numberData(target, 'cellFrom');
  if (cell === null || position === null) {
    return false;
  }
  event.preventDefault();
  const current = selectedTableContext(view.state);
  const inside =
    current !== null &&
    current.layout.from === cell.tableFrom &&
    positionInsideSelection(current.layout.table, current.selection, {
      row: cell.row,
      column: cell.column,
    });
  const effects: StateEffect<unknown>[] = [
    setMarkdownTableMenu.of({
      tableFrom: cell.tableFrom,
      position,
      cell: { row: cell.row, column: cell.column },
    }),
  ];
  if (!inside) {
    effects.push(
      setMarkdownTableSelection.of({
        tableFrom: cell.tableFrom,
        anchor: { row: cell.row, column: cell.column },
        head: { row: cell.row, column: cell.column },
      }),
    );
  }
  view.dispatch({ effects, userEvent: 'select.pointer' });
  return true;
}

function handleEditorKeyDown(event: KeyboardEvent, view: EditorView): boolean {
  if (event.key === 'F10' && event.shiftKey) {
    const context = selectedTableContext(view.state);
    const active = activeTableCell(view.state);
    const layout = context?.layout ?? active?.layout;
    const cell =
      context === null
        ? active?.cell
        : {
            rowIndex: markdownTableSelectionBounds(layout!.table, context.selection).minRow,
            columnIndex: markdownTableSelectionBounds(layout!.table, context.selection).minColumn,
            from: selectionCellPosition(layout!, context.selection),
          };
    if (layout === undefined || cell === undefined) {
      return false;
    }
    event.preventDefault();
    const effects: StateEffect<unknown>[] = [
      setMarkdownTableMenu.of({
        tableFrom: layout.from,
        position: cell.from,
        cell: { row: cell.rowIndex, column: cell.columnIndex },
      }),
    ];
    if (context === null) {
      effects.push(
        setMarkdownTableSelection.of({
          tableFrom: layout.from,
          anchor: { row: cell.rowIndex, column: cell.columnIndex },
          head: { row: cell.rowIndex, column: cell.columnIndex },
        }),
      );
    }
    view.dispatch({ effects, userEvent: 'select' });
    return true;
  }
  if (
    !editorContentHasFocus(view) ||
    event.key !== '|' ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    event.isComposing ||
    activeTableCell(view.state) === null
  ) {
    return false;
  }
  event.preventDefault();
  view.dispatch(view.state.replaceSelection('\\|'), {
    annotations: Transaction.userEvent.of('input.type'),
  });
  return true;
}

function handleCopy(event: ClipboardEvent, view: EditorView, cut: boolean): boolean {
  const text = markdownTableSelectionTsv(view);
  if (text === null || event.clipboardData === null) {
    return false;
  }
  event.preventDefault();
  event.clipboardData.setData('text/plain', text);
  if (cut) {
    const context = selectedTableContext(view.state);
    if (context !== null) {
      deleteSelectedRange(view, context.layout, context.selection);
    }
  }
  return true;
}

function handlePaste(event: ClipboardEvent, view: EditorView): boolean {
  const containsFile = Array.from(event.clipboardData?.items ?? []).some(
    (item) => item.kind === 'file',
  );
  const text = event.clipboardData?.getData('text/plain');
  if (
    containsFile ||
    text === undefined ||
    text.length === 0 ||
    (selectedTableContext(view.state) === null && activeTableCell(view.state) === null)
  ) {
    return false;
  }
  event.preventDefault();
  return pasteMarkdownTableText(view, text);
}

function startTableDrag(
  event: PointerEvent,
  view: EditorView,
  handle: HTMLButtonElement,
  axis: MarkdownTableSelectionAxis,
): boolean {
  const tableFrom = numberData(handle, 'tableFrom');
  const index = numberData(handle, 'index');
  if (tableFrom === null || index === null) {
    return false;
  }
  const layout = tableByFrom(view.state, tableFrom);
  if (layout === null) {
    return false;
  }
  event.preventDefault();
  handle.focus({ preventScroll: true });
  handle.setPointerCapture?.(event.pointerId);
  const context = selectedTableContext(view.state);
  const indices = selectedIndicesForDrag(layout, context, axis, index);
  view.dispatch({
    effects: setMarkdownTableDrag.of({
      tableFrom,
      axis,
      indices,
      pointerId: event.pointerId,
      targetIndex: index,
      targetGap: index,
    }),
    userEvent: 'select.pointer',
  });
  return true;
}

function finishTableDrag(view: EditorView, drag: TableDragState): boolean {
  const layout = tableByFrom(view.state, drag.tableFrom);
  if (layout === null || drag.targetGap === null) {
    view.dispatch({ effects: setMarkdownTableDrag.of(null) });
    return true;
  }
  const table =
    drag.axis === 'row'
      ? moveMarkdownTableRows(layout.table, drag.indices, drag.targetGap)
      : moveMarkdownTableColumns(layout.table, drag.indices, drag.targetGap);
  if (serializeMarkdownTable(table) === serializeMarkdownTable(layout.table)) {
    view.dispatch({ effects: setMarkdownTableDrag.of(null) });
    return true;
  }
  const length = drag.axis === 'row' ? layout.table.body.length + 1 : layout.table.columnCount;
  const moved = remapMovedIndices(drag.indices, drag.targetGap, length);
  const first = moved[0] ?? 0;
  const last = moved[moved.length - 1] ?? first;
  const selection: MarkdownTableCellRange =
    drag.axis === 'row'
      ? {
          anchor: { row: first, column: 0 },
          head: { row: last, column: table.columnCount - 1 },
        }
      : {
          anchor: { row: 0, column: first },
          head: { row: table.body.length, column: last },
        };
  view.dispatch({
    changes: { from: layout.from, to: layout.to, insert: serializeMarkdownTable(table) },
    selection: EditorSelection.cursor(layout.from),
    effects: [
      setMarkdownTableSelection.of({ tableFrom: layout.from, ...selection }),
      setMarkdownTableDrag.of(null),
    ],
    annotations: tableStructureChange.of(true),
    userEvent: 'input.table',
  });
  return true;
}

function selectedIndicesForDrag(
  layout: TableLayout,
  context: SelectionContext | null,
  axis: MarkdownTableSelectionAxis,
  index: number,
): readonly number[] {
  if (context === null || context.layout.from !== layout.from) {
    return [index];
  }
  const kind = classifyMarkdownTableSelection(layout.table, context.selection);
  const bounds = markdownTableSelectionBounds(layout.table, context.selection);
  if (axis === 'row' && kind === 'rows' && index >= bounds.minRow && index <= bounds.maxRow) {
    return inclusiveIndices(bounds.minRow, bounds.maxRow);
  }
  if (
    axis === 'column' &&
    kind === 'columns' &&
    index >= bounds.minColumn &&
    index <= bounds.maxColumn
  ) {
    return inclusiveIndices(bounds.minColumn, bounds.maxColumn);
  }
  return [index];
}

function tableDragTarget(
  event: PointerEvent,
  view: EditorView,
  drag: TableDragState,
): { readonly index: number; readonly gap: number } | null {
  const handle = tableDragHandle(pointerTargetAtCoordinates(event, view));
  if (handle === null) {
    return null;
  }
  const tableFrom = numberData(handle, 'tableFrom');
  const index = numberData(handle, 'index');
  const action = handle.dataset['tableAction'];
  const axis = action === 'drag-row' ? 'row' : action === 'drag-column' ? 'column' : null;
  if (tableFrom !== drag.tableFrom || index === null || axis !== drag.axis) {
    return null;
  }
  return { index, gap: tableDropGap(event, handle, axis, index) };
}

function tableDropGap(
  event: PointerEvent,
  button: HTMLButtonElement,
  axis: MarkdownTableSelectionAxis,
  targetIndex: number,
): number {
  const bounds = button.getBoundingClientRect();
  const before =
    axis === 'column'
      ? event.clientX < bounds.left + bounds.width / 2
      : event.clientY < bounds.top + bounds.height / 2;
  return targetIndex + (before ? 0 : 1);
}

function createTableMenu(
  view: EditorView,
  menuState: TableMenuState,
): { readonly dom: HTMLElement; readonly mount: () => void } {
  const phrases = requiredConfig(view.state).phrases;
  const dom = document.createElement('div');
  dom.className = 'cm-markdown-table-menu-tooltip cm-markdown-table-menu';
  dom.setAttribute('role', 'menu');
  dom.setAttribute('aria-label', phrases.menu);
  const items = tableMenuItems(view.state, menuState);
  items.forEach((item, index) => {
    if (index > 0 && menuGroup(item) !== menuGroup(requiredValue(items, index - 1))) {
      const separator = document.createElement('div');
      separator.className = 'cm-markdown-table-menu-separator';
      separator.setAttribute('role', 'separator');
      dom.append(separator);
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cm-markdown-table-menu-item';
    button.setAttribute('role', 'menuitem');
    button.setAttribute('aria-label', item.label);
    button.textContent = item.label;
    button.addEventListener('click', () => runTableMenuItem(view, item, dom));
    dom.append(button);
  });
  dom.addEventListener('keydown', (event) => handleMenuKeyDown(event, view, dom));
  return {
    dom,
    mount: () =>
      dom.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus({ preventScroll: true }),
  };
}

function tableMenuItems(state: EditorState, menu: TableMenuState): readonly TableMenuItem[] {
  const phrases = requiredConfig(state).phrases;
  const context = selectedTableContext(state);
  const layout = tableByFrom(state, menu.tableFrom);
  if (layout === null) {
    return [];
  }
  const selection =
    context?.layout.from === layout.from
      ? context.selection
      : { anchor: menu.cell, head: menu.cell };
  const bounds = markdownTableSelectionBounds(layout.table, selection);
  const singleCell = bounds.minRow === bounds.maxRow && bounds.minColumn === bounds.maxColumn;
  const kind = classifyMarkdownTableSelection(layout.table, selection);
  const items: TableMenuItem[] = [];
  if (singleCell || kind === 'rows') {
    items.push(
      { label: `${phrases.insertBefore} · ${phrases.row}`, action: 'insertBefore', axis: 'row' },
      { label: `${phrases.insertAfter} · ${phrases.row}`, action: 'insertAfter', axis: 'row' },
      { label: `${phrases.duplicate} · ${phrases.row}`, action: 'duplicate', axis: 'row' },
      { label: `${phrases.moveBefore} · ${phrases.row}`, action: 'moveBefore', axis: 'row' },
      { label: `${phrases.moveAfter} · ${phrases.row}`, action: 'moveAfter', axis: 'row' },
    );
  }
  if (singleCell || kind === 'columns') {
    items.push(
      {
        label: `${phrases.insertBefore} · ${phrases.column}`,
        action: 'insertBefore',
        axis: 'column',
      },
      {
        label: `${phrases.insertAfter} · ${phrases.column}`,
        action: 'insertAfter',
        axis: 'column',
      },
      {
        label: `${phrases.duplicate} · ${phrases.column}`,
        action: 'duplicate',
        axis: 'column',
      },
      { label: phrases.sortAscending, action: 'sortAscending', axis: 'column' },
      { label: phrases.sortDescending, action: 'sortDescending', axis: 'column' },
      { label: phrases.moveBefore, action: 'moveBefore', axis: 'column' },
      { label: phrases.moveAfter, action: 'moveAfter', axis: 'column' },
    );
  }
  items.push(
    { label: phrases.alignLeft, action: 'alignLeft', axis: 'column' },
    { label: phrases.alignCenter, action: 'alignCenter', axis: 'column' },
    { label: phrases.alignRight, action: 'alignRight', axis: 'column' },
    { label: phrases.copy, action: 'copy', axis: null },
    { label: phrases.cut, action: 'cut', axis: null },
    { label: phrases.clear, action: 'clear', axis: null },
    { label: phrases.delete, action: 'delete', axis: null },
    { label: phrases.format, action: 'format', axis: null },
    { label: phrases.deleteTable, action: 'deleteTable', axis: null },
  );
  return items;
}

function menuGroup(item: TableMenuItem): string {
  if (item.action === 'copy' || item.action === 'cut' || item.action === 'clear') {
    return 'clipboard';
  }
  if (item.action === 'delete' || item.action === 'format' || item.action === 'deleteTable') {
    return 'table';
  }
  if (item.action.startsWith('align')) {
    return 'alignment';
  }
  return item.axis ?? 'range';
}

function runTableMenuItem(view: EditorView, item: TableMenuItem, menu: HTMLElement): void {
  if (item.action === 'copy' || item.action === 'cut') {
    copySelectionFromMenu(view, item.action === 'cut', menu);
    return;
  }
  const context = selectedTableContext(view.state);
  const handled =
    item.axis !== null && context !== null
      ? runAxisAction(view, context, item.action, item.axis)
      : runMarkdownTableAction(view, item.action);
  if (handled) {
    closeTableMenu(view);
  }
}

function copySelectionFromMenu(view: EditorView, cut: boolean, menu: HTMLElement): void {
  const text = markdownTableSelectionTsv(view);
  const context = selectedTableContext(view.state);
  const originalDocument = view.state.doc;
  if (
    text === null ||
    context === null ||
    typeof navigator === 'undefined' ||
    navigator.clipboard === undefined
  ) {
    reportClipboardFailure(view, menu);
    return;
  }
  void navigator.clipboard.writeText(text).then(
    () => {
      const current = selectedTableContext(view.state);
      if (
        cut &&
        current !== null &&
        view.state.doc.eq(originalDocument) &&
        sameCellSelection(context, current)
      ) {
        deleteSelectedRange(view, current.layout, current.selection);
      }
      closeTableMenu(view);
    },
    () => reportClipboardFailure(view, menu),
  );
}

function reportClipboardFailure(view: EditorView, menu: HTMLElement): void {
  const message = requiredConfig(view.state).phrases.clipboardFailed;
  let status = menu.querySelector<HTMLElement>('.cm-markdown-table-menu-status');
  if (status === null) {
    status = document.createElement('div');
    status.className = 'cm-markdown-table-menu-status';
    status.setAttribute('role', 'status');
    menu.append(status);
  }
  status.textContent = message;
  view.dispatch({ effects: EditorView.announce.of(message) });
}

function handleMenuKeyDown(event: KeyboardEvent, view: EditorView, menu: HTMLElement): void {
  const items = [...menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
  const current = items.indexOf(document.activeElement as HTMLButtonElement);
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    closeTableMenu(view);
    focusEditorWithoutScroll(view);
    return;
  }
  if ((event.key === 'Enter' || event.key === ' ') && current >= 0) {
    event.preventDefault();
    requiredValue(items, current).click();
    return;
  }
  let next: number | null = null;
  if (event.key === 'ArrowDown') {
    next = (Math.max(current, -1) + 1) % items.length;
  } else if (event.key === 'ArrowUp') {
    next = (current <= 0 ? items.length : current) - 1;
  } else if (event.key === 'Home') {
    next = 0;
  } else if (event.key === 'End') {
    next = items.length - 1;
  }
  if (next !== null && items.length > 0) {
    event.preventDefault();
    requiredValue(items, next).focus({ preventScroll: true });
  }
}

function closeTableMenu(view: EditorView): void {
  if (view.state.field(markdownTableMenuState) !== null) {
    view.dispatch({ effects: setMarkdownTableMenu.of(null) });
  }
}

function runAxisAction(
  view: EditorView,
  context: SelectionContext,
  action: MarkdownTableEditorAction,
  axis: MarkdownTableSelectionAxis,
): boolean {
  const bounds = markdownTableSelectionBounds(context.layout.table, context.selection);
  const indices =
    axis === 'row'
      ? inclusiveIndices(bounds.minRow, bounds.maxRow)
      : inclusiveIndices(bounds.minColumn, bounds.maxColumn);
  const first = requiredValue(indices, 0);
  const last = requiredValue(indices, indices.length - 1);
  let table: MarkdownTable | null = null;
  if (axis === 'row') {
    if (action === 'insertBefore') {
      table = insertMarkdownTableRows(context.layout.table, first, 'before', 1);
    } else if (action === 'insertAfter') {
      table = insertMarkdownTableRows(context.layout.table, last, 'after', 1);
    } else if (action === 'duplicate') {
      table = duplicateMarkdownTableRows(context.layout.table, indices);
    } else if (action === 'moveBefore') {
      table = moveMarkdownTableRows(context.layout.table, indices, Math.max(0, first - 1));
    } else if (action === 'moveAfter') {
      table = moveMarkdownTableRows(context.layout.table, indices, last + 2);
    } else if (action === 'clear') {
      table = clearMarkdownTableRows(context.layout.table, indices);
    } else if (action === 'delete') {
      const result = deleteMarkdownTableRows(context.layout.table, indices);
      table = result.ok ? result.table : null;
    }
  } else if (action === 'insertBefore') {
    table = insertMarkdownTableColumns(context.layout.table, first, 'before', 1);
  } else if (action === 'insertAfter') {
    table = insertMarkdownTableColumns(context.layout.table, last, 'after', 1);
  } else if (action === 'duplicate') {
    table = duplicateMarkdownTableColumns(context.layout.table, indices);
  } else if (action === 'moveBefore') {
    table = moveMarkdownTableColumns(context.layout.table, indices, Math.max(0, first - 1));
  } else if (action === 'moveAfter') {
    table = moveMarkdownTableColumns(context.layout.table, indices, last + 2);
  } else if (action === 'clear') {
    table = clearMarkdownTableColumns(context.layout.table, indices);
  } else if (action === 'delete') {
    const result = deleteMarkdownTableColumns(context.layout.table, indices);
    table = result.ok ? result.table : null;
  } else if (action === 'sortAscending' || action === 'sortDescending') {
    table =
      indices.length === 1
        ? sortMarkdownTableBody(
            context.layout.table,
            first,
            action === 'sortAscending' ? 'ascending' : 'descending',
            requiredConfig(view.state).locale,
          )
        : null;
  } else if (action === 'alignLeft' || action === 'alignCenter' || action === 'alignRight') {
    const alignment =
      action === 'alignLeft' ? 'left' : action === 'alignCenter' ? 'center' : 'right';
    table = setMarkdownTableAlignment(context.layout.table, indices, alignment);
  }
  if (
    table === null ||
    serializeMarkdownTable(table) === serializeMarkdownTable(context.layout.table)
  ) {
    return false;
  }
  return replaceTable(view, context.layout, table, null, true, false);
}

function navigateTableArrow(
  view: EditorView,
  direction: 'left' | 'right' | 'up' | 'down',
): boolean {
  if (completionStatus(view.state) !== null || !view.state.selection.main.empty) {
    return false;
  }
  const recovery = nextEditableTablePosition(view.state, view.state.selection.main.head);
  if (recovery !== null) {
    view.dispatch({
      selection: EditorSelection.cursor(recovery.position),
      scrollIntoView: false,
      userEvent: 'select',
    });
    if (recovery.cell !== null) {
      renderedTableCell(view, recovery.layout.from, recovery.cell)?.scrollIntoView?.({
        block: 'nearest',
        inline: 'nearest',
      });
    }
    return true;
  }
  const active = activeTableCell(view.state);
  if (active === null) {
    return direction === 'up' || direction === 'down'
      ? repairSkippedTableLineMovement(view, direction)
      : false;
  }
  const position = view.state.selection.main.head;
  const activeStart = active.cell.from === active.cell.to ? active.cell.cursor : active.cell.from;
  const activeEnd = active.cell.from === active.cell.to ? active.cell.cursor : active.cell.to;
  const horizontal = direction === 'left' || direction === 'right';
  if (direction === 'up' && active.cell.rowIndex === 0) {
    return leaveTableAbove(view, active.layout, position - activeStart);
  }
  if (
    horizontal &&
    ((direction === 'left' && position > activeStart) ||
      (direction === 'right' && position < activeEnd))
  ) {
    return false;
  }

  let rowIndex = active.cell.rowIndex;
  let columnIndex = active.cell.columnIndex;
  let targetPosition: 'start' | 'end' | number;
  if (direction === 'left' || direction === 'right') {
    const delta = direction === 'left' ? -1 : 1;
    columnIndex += delta;
    if (columnIndex < 0) {
      rowIndex -= 1;
      columnIndex = active.layout.table.columnCount - 1;
    } else if (columnIndex >= active.layout.table.columnCount) {
      rowIndex += 1;
      columnIndex = 0;
    }
    targetPosition = direction === 'left' ? 'end' : 'start';
  } else {
    rowIndex += direction === 'up' ? -1 : 1;
    targetPosition = Math.max(0, position - activeStart);
  }

  const target = active.layout.semanticRows[rowIndex]?.cells[columnIndex];
  if (target === undefined) {
    // Editor mode hides the structural pipes around the grid. Letting CodeMirror handle a
    // horizontal edge would move the caret into that zero-height source and scroll the page to it.
    return horizontal;
  }
  const cursor =
    targetPosition === 'start'
      ? target.cursor
      : targetPosition === 'end'
        ? target.to
        : target.cursor + Math.min(targetPosition, target.to - target.from);
  view.dispatch({
    // Keep CodeMirror's geometry on the previous cell side of the hidden Markdown boundary.
    selection: EditorSelection.create([
      EditorSelection.cursor(cursor, targetPosition === 'end' ? -1 : 0),
    ]),
    scrollIntoView: false,
    userEvent: 'select',
  });
  renderedTableCell(view, active.layout.from, target)?.scrollIntoView?.({
    block: 'nearest',
    inline: 'nearest',
  });
  return true;
}

function leaveTableAbove(view: EditorView, layout: TableLayout, visualColumn: number): boolean {
  const headerLine = view.state.doc.lineAt(layout.from);
  if (headerLine.number === 1) {
    return true;
  }
  const targetLine = view.state.doc.line(headerLine.number - 1);
  const targetPosition = targetLine.from + Math.min(Math.max(visualColumn, 0), targetLine.length);
  view.dispatch({
    selection: EditorSelection.cursor(targetPosition),
    scrollIntoView: true,
    userEvent: 'select',
  });
  return true;
}

function repairSkippedTableLineMovement(view: EditorView, direction: 'up' | 'down'): boolean {
  const selection = view.state.selection.main;
  const moved = view.moveVertically(selection, direction === 'down');
  const currentLine = view.state.doc.lineAt(selection.head);
  const movedLine = view.state.doc.lineAt(moved.head);
  if (Math.abs(currentLine.number - movedLine.number) <= 1) {
    const target = tableCellAtPosition(view.state, moved.head);
    if (target === null) {
      return false;
    }
    view.dispatch({
      selection: EditorSelection.create([moved]),
      scrollIntoView: false,
      userEvent: 'select',
    });
    renderedTableCell(view, target.layout.from, target.cell)?.scrollIntoView?.({
      block: 'nearest',
      inline: 'nearest',
    });
    return true;
  }
  const movementFrom = Math.min(selection.head, moved.head);
  const movementTo = Math.max(selection.head, moved.head);
  const crossedTable = findTableLayouts(view.state).some(
    (layout) => layout.from <= movementTo && layout.to >= movementFrom,
  );
  const targetLineNumber = currentLine.number + (direction === 'up' ? -1 : 1);
  if (!crossedTable || targetLineNumber < 1 || targetLineNumber > view.state.doc.lines) {
    return false;
  }
  const targetLine = view.state.doc.line(targetLineNumber);
  const column = selection.head - currentLine.from;
  const targetPosition = targetLine.from + Math.min(column, targetLine.length);
  const target = tableCellAtPosition(view.state, targetPosition);
  if (target !== null) {
    const cursor = Math.max(target.cell.cursor, Math.min(targetPosition, target.cell.to));
    view.dispatch({
      selection: EditorSelection.cursor(cursor),
      scrollIntoView: false,
      userEvent: 'select',
    });
    renderedTableCell(view, target.layout.from, target.cell)?.scrollIntoView?.({
      block: 'nearest',
      inline: 'nearest',
    });
    return true;
  }
  view.dispatch({
    selection: EditorSelection.cursor(targetPosition),
    scrollIntoView: true,
    userEvent: 'select',
  });
  return true;
}

function navigateTableCell(view: EditorView, direction: -1 | 1, sameColumn: boolean): boolean {
  if (
    completionStatus(view.state) !== null ||
    (!sameColumn &&
      (direction === 1 ? hasNextSnippetField(view.state) : hasPrevSnippetField(view.state)))
  ) {
    return false;
  }
  const active = activeTableCell(view.state);
  if (active === null) {
    return false;
  }
  const rowCount = active.layout.semanticRows.length;
  let rowIndex = active.cell.rowIndex;
  let columnIndex = active.cell.columnIndex;
  if (sameColumn) {
    rowIndex += direction;
  } else {
    columnIndex += direction;
    if (columnIndex >= active.layout.table.columnCount) {
      rowIndex += 1;
      columnIndex = 0;
    } else if (columnIndex < 0) {
      rowIndex -= 1;
      columnIndex = active.layout.table.columnCount - 1;
    }
  }
  if (rowIndex < 0) {
    return false;
  }
  if (rowIndex >= rowCount) {
    const table = insertMarkdownTableRows(
      active.layout.table,
      active.layout.table.body.length,
      'after',
      1,
    );
    return replaceTable(
      view,
      active.layout,
      table,
      { rowIndex, columnIndex, atEnd: false },
      true,
      true,
    );
  }
  const target = active.layout.semanticRows[rowIndex]?.cells[columnIndex];
  if (target === undefined) {
    return false;
  }
  view.dispatch({
    selection: EditorSelection.cursor(target.cursor),
    scrollIntoView: true,
    userEvent: 'select',
  });
  return true;
}

function insertTableHardBreak(view: EditorView): boolean {
  if (activeTableCell(view.state) === null) {
    return false;
  }
  view.dispatch(view.state.replaceSelection('<br>'), {
    annotations: Transaction.userEvent.of('input.type'),
  });
  return true;
}

function protectOrDeleteTableStructure(
  view: EditorView,
  direction: 'backward' | 'forward',
): boolean {
  const selected = selectedTableContext(view.state);
  if (selected !== null) {
    return deleteSelectedRange(view, selected.layout, selected.selection);
  }
  const selection = view.state.selection.main;
  if (!selection.empty) {
    return selectionTouchesHiddenStructure(view.state, selection.from, selection.to);
  }
  const active = activeTableCell(view.state);
  if (active === null) {
    return false;
  }
  const position = selection.head;
  const activeStart = active.cell.from === active.cell.to ? active.cell.cursor : active.cell.from;
  const activeEnd = active.cell.from === active.cell.to ? active.cell.cursor : active.cell.to;
  if (direction === 'backward') {
    const before = position > 0 ? view.state.sliceDoc(position - 1, position) : '';
    return isStructuralCharacter(before) || position <= activeStart;
  }
  const after = position < view.state.doc.length ? view.state.sliceDoc(position, position + 1) : '';
  return isStructuralCharacter(after) || position >= activeEnd;
}

function closeTableSurface(view: EditorView): boolean {
  if (view.state.field(markdownTableDragState) !== null) {
    view.dispatch({
      effects: setMarkdownTableDrag.of(null),
      userEvent: 'select',
    });
    return true;
  }
  if (view.state.field(markdownTableMenuState) !== null) {
    closeTableMenu(view);
    return true;
  }
  return clearCellSelection(view);
}

function clearCellSelection(view: EditorView): boolean {
  const current = view.state.field(markdownTableSelectionState);
  if (current.anchor === null) {
    return false;
  }
  view.dispatch({
    effects: setMarkdownTableSelection.of(emptySelection),
    userEvent: 'select',
  });
  return true;
}

function deleteSelectedRange(
  view: EditorView,
  layout: TableLayout,
  selection: MarkdownTableCellRange,
): boolean {
  const result = deleteMarkdownTableSelection(layout.table, selection);
  return result.kind === 'table'
    ? deleteWholeTable(view, layout)
    : replaceTable(view, layout, result.table, null, true, false);
}

function replaceTablePreservingRange(
  view: EditorView,
  layout: TableLayout,
  table: MarkdownTable,
  selection: MarkdownTableCellRange,
): boolean {
  if (serializeMarkdownTable(table) === serializeMarkdownTable(layout.table)) {
    return false;
  }
  const bounds = markdownTableSelectionBounds(table, selection);
  const range: MarkdownTableCellRange = {
    anchor: { row: bounds.minRow, column: bounds.minColumn },
    head: { row: bounds.maxRow, column: bounds.maxColumn },
  };
  view.dispatch({
    changes: { from: layout.from, to: layout.to, insert: serializeMarkdownTable(table) },
    selection: EditorSelection.cursor(layout.from),
    effects: setMarkdownTableSelection.of({ tableFrom: layout.from, ...range }),
    annotations: tableStructureChange.of(true),
    userEvent: 'input.table',
  });
  return true;
}

function deleteWholeTable(view: EditorView, layout: TableLayout): boolean {
  let from = layout.from;
  let to = layout.to;
  if (to < view.state.doc.length && view.state.sliceDoc(to, to + 1) === '\n') {
    to += 1;
  } else if (from > 0 && view.state.sliceDoc(from - 1, from) === '\n') {
    from -= 1;
  }
  view.dispatch({
    changes: { from, to, insert: '' },
    selection: EditorSelection.cursor(from),
    effects: [
      setMarkdownTableSelection.of(emptySelection),
      setMarkdownTableMenu.of(null),
      setMarkdownTableDrag.of(null),
    ],
    annotations: tableStructureChange.of(true),
    userEvent: 'delete.table',
  });
  return true;
}

function replaceTable(
  view: EditorView,
  layout: TableLayout,
  table: MarkdownTable,
  cursor: {
    readonly rowIndex: number;
    readonly columnIndex: number;
    readonly atEnd: boolean;
  } | null,
  clearSelection: boolean,
  scrollIntoView: boolean,
): boolean {
  const source = serializeMarkdownTable(table);
  const cursorOffset =
    cursor === null ? null : cellOffset(table, cursor.rowIndex, cursor.columnIndex, cursor.atEnd);
  return replaceTableSource(view, layout, source, clearSelection, scrollIntoView, cursorOffset);
}

function replaceTableSource(
  view: EditorView,
  layout: TableLayout,
  source: string,
  clearSelection: boolean,
  scrollIntoView: boolean,
  cursorOffset: number | null,
): boolean {
  const position =
    cursorOffset === null
      ? Math.min(layout.from, layout.from + source.length)
      : layout.from + cursorOffset;
  view.dispatch({
    changes: { from: layout.from, to: layout.to, insert: source },
    selection: EditorSelection.cursor(position),
    effects: clearSelection
      ? [setMarkdownTableSelection.of(emptySelection), setMarkdownTableMenu.of(null)]
      : [],
    annotations: tableStructureChange.of(true),
    scrollIntoView,
    userEvent: 'input.table',
  });
  return true;
}

function editorContentHasFocus(view: EditorView): boolean {
  return view.root.activeElement === view.contentDOM;
}

function focusEditorWithoutScroll(view: EditorView): void {
  view.contentDOM.focus({ preventScroll: true });
}

function protectTableStructure(transaction: Transaction): Transaction | readonly TransactionSpec[] {
  const stabilizedWhitespace = stabilizedTableWhitespaceInput(transaction);
  if (stabilizedWhitespace !== null) {
    return [stabilizedWhitespace];
  }
  const redirectedInput = redirectedTableInput(transaction);
  if (redirectedInput !== null) {
    return [redirectedInput];
  }
  if (
    transaction.docChanged &&
    transaction.annotation(tableStructureChange) !== true &&
    transactionTouchesProtectedStructure(transaction)
  ) {
    return [];
  }

  const clearedCell = clearedTableCellContext(transaction);
  const clearedCellRepair =
    clearedCell === null ? null : clearedTableCellRepair(transaction, clearedCell);
  const historyTarget =
    clearedCell === null
      ? null
      : {
          tableFrom: clearedCell.layout.from,
          row: clearedCell.cell.rowIndex,
          column: clearedCell.cell.columnIndex,
        };
  const effects =
    historyTarget === null
      ? transaction.effects
      : [
          ...transaction.effects,
          setTableCaretHistoryTarget.of({
            from: transaction.startState.field(tableCaretHistoryTargetState),
            to: historyTarget,
          }),
        ];
  const terminatorRepairs = transaction.docChanged ? tableTerminatorTypingRepairs(transaction) : [];
  const endRepair =
    transaction.docChanged &&
    clearedCellRepair === null &&
    terminatorRepairs.length === 0 &&
    hasNewTableEndingAtDocumentEnd(transaction)
      ? [{ from: transaction.newDoc.length, insert: '\n' }]
      : [];
  const repairs = [...(clearedCellRepair?.changes ?? []), ...terminatorRepairs, ...endRepair];
  const normalizedSelection =
    endRepair.length > 0
      ? transaction.newSelection
      : normalizeTableCaretSelection(transaction.state, transaction.newSelection);
  const suppressContentEditScroll =
    transaction.scrollIntoView &&
    isTableContentEdit(transaction) &&
    (activeTableCell(transaction.startState) !== null || terminatorRepairs.length > 0);
  const selection =
    clearedCellRepair === null
      ? stabilizedTableContentEditSelection(transaction, normalizedSelection)
      : EditorSelection.create([EditorSelection.cursor(clearedCellRepair.cursor, 1)]);
  const suppressStructuralSelectionScroll = normalizedSelection !== transaction.newSelection;
  if (
    repairs.length === 0 &&
    historyTarget === null &&
    !suppressContentEditScroll &&
    !suppressStructuralSelectionScroll &&
    selection === transaction.newSelection
  ) {
    return transaction;
  }

  return [
    transactionAsSpec(
      transaction,
      suppressContentEditScroll || suppressStructuralSelectionScroll
        ? false
        : transaction.scrollIntoView,
      selection,
      effects,
    ),
    ...(repairs.length === 0
      ? []
      : [
          {
            changes: repairs,
            sequential: true,
            ...(clearedCellRepair !== null
              ? { selection: EditorSelection.cursor(clearedCellRepair.cursor, 1) }
              : endRepair.length === 0
                ? {}
                : {
                    selection: EditorSelection.cursor(transaction.newDoc.length + 1),
                  }),
          } satisfies TransactionSpec,
        ]),
  ];
}

function clearedTableCellContext(transaction: Transaction): ClearedTableCellContext | null {
  if (
    !transaction.docChanged ||
    !isTableContentEdit(transaction) ||
    transaction.startState.selection.ranges.length !== 1
  ) {
    return null;
  }
  const active = activeTableCell(transaction.startState);
  if (active === null || active.cell.virtual || active.cell.from === active.cell.to) {
    return null;
  }
  let clearsCell = false;
  let changeCount = 0;
  transaction.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    changeCount += 1;
    clearsCell = inserted.length === 0 && fromA <= active.cell.from && toA >= active.cell.to;
  });
  if (changeCount !== 1 || !clearsCell) {
    return null;
  }
  const row = active.layout.semanticRows[active.cell.rowIndex];
  const sourceRow =
    active.cell.rowIndex === 0
      ? active.layout.table.header
      : active.layout.table.body[active.cell.rowIndex - 1];
  if (row === undefined || sourceRow === undefined) {
    return null;
  }
  return { layout: active.layout, cell: active.cell, row, sourceRow };
}

function clearedTableCellRepair(
  transaction: Transaction,
  context: ClearedTableCellContext,
): ClearedTableCellRepair | null {
  const { layout, cell, row, sourceRow } = context;
  const leadingPosition = transaction.changes.mapPos(row.from + sourceRow.prefix.length, -1);
  const trailingPosition = transaction.changes.mapPos(row.to, 1);
  const addLeadingPipe = cell.columnIndex === 0 && !sourceRow.leadingPipe;
  const addTrailingPipe =
    cell.columnIndex === layout.table.columnCount - 1 && !sourceRow.trailingPipe;
  if (!addLeadingPipe && !addTrailingPipe) {
    return null;
  }
  const cursorBeforeRepair = transaction.changes.mapPos(cell.from, -1);
  if (addLeadingPipe && addTrailingPipe && leadingPosition === trailingPosition) {
    return {
      changes: [{ from: leadingPosition, insert: '||' }],
      cursor: leadingPosition + 1,
    };
  }
  return {
    changes: [
      ...(addLeadingPipe ? [{ from: leadingPosition, insert: '|' }] : []),
      ...(addTrailingPipe ? [{ from: trailingPosition, insert: ' |' }] : []),
    ],
    cursor: cursorBeforeRepair + (addLeadingPipe && leadingPosition <= cursorBeforeRepair ? 1 : 0),
  };
}

function stabilizedTableWhitespaceInput(transaction: Transaction): TransactionSpec | null {
  if (
    !transaction.docChanged ||
    !transaction.isUserEvent('input') ||
    transaction.annotation(tableStructureChange) === true ||
    transaction.startState.selection.ranges.length !== 1 ||
    !transaction.startState.selection.main.empty
  ) {
    return null;
  }
  const position = transaction.startState.selection.main.head;
  const active = editableTableCellAtPosition(transaction.startState, position);
  if (active === null) {
    return null;
  }
  let insertedText: string | null = null;
  let changeCount = 0;
  transaction.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    changeCount += 1;
    const text = inserted.toString();
    if (fromA === position && toA === position && /^[\t ]+$/u.test(text)) {
      insertedText = text;
    }
  });
  if (changeCount !== 1 || insertedText === null) {
    return null;
  }
  const leadingPadding =
    position === active.cell.from &&
    transaction.startState.sliceDoc(Math.max(0, position - 1), position) === '|'
      ? ' '
      : '';
  const line = transaction.startState.doc.lineAt(position);
  const endsAtSeparator =
    transaction.startState.sliceDoc(
      position,
      Math.min(position + 1, transaction.startState.doc.length),
    ) === '|';
  const trailingPadding =
    position === active.cell.to && (endsAtSeparator || line.to === position) ? ' ' : '';
  if (leadingPadding.length === 0 && trailingPadding.length === 0) {
    return null;
  }
  const insertion = `${leadingPadding}${insertedText}${trailingPadding}`;
  return {
    changes: { from: position, insert: insertion },
    selection: EditorSelection.cursor(position + insertion.length - trailingPadding.length),
    effects: transaction.effects,
    annotations: transactionAnnotations(transaction),
    scrollIntoView: false,
  };
}

function redirectedTableInput(transaction: Transaction): TransactionSpec | null {
  if (
    !transaction.docChanged ||
    !transaction.isUserEvent('input') ||
    transaction.annotation(tableStructureChange) === true ||
    transaction.startState.selection.ranges.length !== 1 ||
    !transaction.startState.selection.main.empty
  ) {
    return null;
  }
  const position = transaction.startState.selection.main.head;
  const target = nextEditableTablePosition(transaction.startState, position);
  if (target === null) {
    return null;
  }
  let insertedText: string | null = null;
  let changeCount = 0;
  transaction.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    changeCount += 1;
    if (fromA === position && toA === position && inserted.length > 0) {
      insertedText = inserted.toString();
    }
  });
  if (changeCount !== 1 || insertedText === null) {
    return null;
  }
  const needsTerminator =
    insertedText[0] !== '\n' &&
    insertedText[0] !== '\r' &&
    isTableTerminatorPosition(transaction.startState, target.position);
  const insertion = needsTerminator ? `\n${insertedText}` : insertedText;
  return {
    changes: { from: target.position, insert: insertion },
    selection: EditorSelection.cursor(target.position + insertion.length),
    effects: transaction.effects,
    annotations: transactionAnnotations(transaction),
    scrollIntoView: false,
  };
}

function normalizeTableCaretSelection(
  state: EditorState,
  selection: EditorSelection,
): EditorSelection {
  if (selection.ranges.length !== 1 || !selection.main.empty) {
    return selection;
  }
  const target = nextEditableTablePosition(state, selection.main.head);
  return target === null
    ? selection
    : EditorSelection.create([EditorSelection.cursor(target.position)]);
}

function stabilizedTableContentEditSelection(
  transaction: Transaction,
  selection: EditorSelection,
): EditorSelection {
  if (!isTableContentEdit(transaction)) {
    return selection;
  }
  return stabilizedTableCaretSelection(transaction.state, selection);
}

function stabilizedTableCaretSelection(
  state: EditorState,
  selection: EditorSelection,
): EditorSelection {
  if (selection.ranges.length !== 1 || !selection.main.empty) {
    return selection;
  }
  const active = editableTableCellAtPosition(state, selection.main.head);
  if (active === null) {
    return selection;
  }
  const position = selection.main.head;
  const assoc =
    position === active.cell.to && active.cell.from < active.cell.to
      ? -1
      : position === active.cell.from
        ? 1
        : selection.main.assoc;
  return assoc === selection.main.assoc
    ? selection
    : EditorSelection.create([EditorSelection.cursor(position, assoc)]);
}

function isTableContentEdit(transaction: Transaction): boolean {
  return transaction.isUserEvent('input') || transaction.isUserEvent('delete');
}

function repairTableCaretAfterDocumentChange(update: ViewUpdate): void {
  if (!update.docChanged) {
    return;
  }
  const target = update.state.field(tableCaretHistoryTargetState);
  const layout = target === null ? null : tableByFrom(update.state, target.tableFrom);
  const cell =
    target === null || layout === null
      ? null
      : (layout.semanticRows[target.row]?.cells[target.column] ?? null);
  const selection =
    cell === null || cell.virtual
      ? stabilizedTableCaretSelection(update.state, update.state.selection)
      : EditorSelection.create([EditorSelection.cursor(cell.cursor, 1)]);
  const effects =
    target === null
      ? []
      : [
          setTableCaretHistoryTarget.of({
            from: target,
            to: null,
          }),
        ];
  if (selection.eq(update.state.selection, true) && effects.length === 0) {
    return;
  }
  update.view.dispatch({
    selection,
    effects,
    annotations: Transaction.addToHistory.of(false),
    scrollIntoView: false,
  });
}

function transactionTouchesProtectedStructure(transaction: Transaction): boolean {
  let blocked = false;
  transaction.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    if (
      (toA > fromA && selectionTouchesHiddenStructure(transaction.startState, fromA, toA)) ||
      (fromA === toA &&
        inserted.length > 0 &&
        insertionTouchesHiddenStructure(transaction.startState, fromA))
    ) {
      blocked = true;
    }
  });
  return blocked;
}

function transactionAsSpec(
  transaction: Transaction,
  scrollIntoView: boolean,
  selection: EditorSelection,
  effects: readonly StateEffect<unknown>[],
): TransactionSpec {
  return {
    changes: transaction.changes,
    selection,
    effects,
    annotations: transactionAnnotations(transaction),
    scrollIntoView,
  };
}

function transactionAnnotations(transaction: Transaction): readonly Annotation<unknown>[] {
  const annotations: Annotation<unknown>[] = [];
  const userEvent = transaction.annotation(Transaction.userEvent);
  const addToHistory = transaction.annotation(Transaction.addToHistory);
  const remote = transaction.annotation(Transaction.remote);
  const structureChange = transaction.annotation(tableStructureChange);
  if (userEvent !== undefined) {
    annotations.push(Transaction.userEvent.of(userEvent));
  }
  if (addToHistory !== undefined) {
    annotations.push(Transaction.addToHistory.of(addToHistory));
  }
  if (remote !== undefined) {
    annotations.push(Transaction.remote.of(remote));
  }
  if (structureChange !== undefined) {
    annotations.push(tableStructureChange.of(structureChange));
  }
  return annotations;
}

function tableTerminatorTypingRepairs(
  transaction: Transaction,
): readonly { readonly from: number; readonly insert: string }[] {
  if (!transaction.isUserEvent('input')) {
    return [];
  }
  const repairs: { from: number; insert: string }[] = [];
  transaction.changes.iterChanges((fromA, toA, fromB, _toB, inserted) => {
    const firstCharacter = inserted.length === 0 ? '' : inserted.sliceString(0, 1);
    if (
      fromA === toA &&
      inserted.length > 0 &&
      firstCharacter !== '\n' &&
      firstCharacter !== '\r' &&
      isTableTerminatorPosition(transaction.startState, fromA)
    ) {
      repairs.push({ from: fromB, insert: '\n' });
    }
  });
  return repairs;
}

function isTableTerminatorPosition(state: EditorState, position: number): boolean {
  return (
    position === state.doc.length &&
    findTableLayouts(state).some((layout) => tableTerminatorRange(state, layout) !== null)
  );
}

function hasNewTableEndingAtDocumentEnd(transaction: Transaction): boolean {
  const mappedExistingStarts = new Set(
    findTableLayouts(transaction.startState).map((layout) =>
      transaction.changes.mapPos(layout.from, -1),
    ),
  );
  return findTableLayouts(transaction.state).some(
    (layout) =>
      layout.to === transaction.state.doc.length && !mappedExistingStarts.has(layout.from),
  );
}

function activeTableCell(
  state: EditorState,
): { readonly layout: TableLayout; readonly cell: TableCellLayout } | null {
  if (state.selection.ranges.length !== 1) {
    return null;
  }
  return editableTableCellAtPosition(state, state.selection.main.head);
}

function editableTableCellAtPosition(
  state: EditorState,
  position: number,
): { readonly layout: TableLayout; readonly cell: TableCellLayout } | null {
  const layout = tableAtPosition(state, position);
  if (layout === null) {
    return null;
  }
  for (const row of layout.semanticRows) {
    for (const cell of row.cells) {
      if (editableCellContainsPosition(cell, position)) {
        return { layout, cell };
      }
    }
  }
  return null;
}

function tableCellAtPosition(
  state: EditorState,
  position: number,
): { readonly layout: TableLayout; readonly cell: TableCellLayout } | null {
  const editable = editableTableCellAtPosition(state, position);
  if (editable !== null) {
    return editable;
  }
  const layout = tableAtPosition(state, position);
  if (layout === null) {
    return null;
  }
  const containingRow = layout.semanticRows.find(
    (row) => position >= row.from && position <= row.to,
  );
  if (containingRow !== undefined && containingRow.cells.length > 0) {
    const nearest = containingRow.cells.reduce((current, candidate) =>
      distanceFromCell(position, candidate) < distanceFromCell(position, current)
        ? candidate
        : current,
    );
    return { layout, cell: nearest };
  }
  return null;
}

function nextEditableTablePosition(state: EditorState, position: number): TableCaretTarget | null {
  const layout = tableAtPosition(state, position);
  if (layout === null || editableTableCellAtPosition(state, position) !== null) {
    return null;
  }
  const rowIndex = layout.rows.findIndex((row) => position >= row.from && position <= row.to);
  if (rowIndex === -1) {
    return null;
  }
  for (let index = rowIndex; index < layout.rows.length; index += 1) {
    const row = requiredValue(layout.rows, index);
    if (row.semanticIndex === null) {
      continue;
    }
    const cells = row.cells.filter((cell) => !cell.virtual);
    for (const cell of cells) {
      const start = cell.from === cell.to ? cell.cursor : cell.from;
      if (index > rowIndex || start > position) {
        return { position: start, layout, cell };
      }
    }
  }
  const lastCell = layout.semanticRows
    .at(-1)
    ?.cells.filter((cell) => !cell.virtual)
    .at(-1);
  if (layout.to >= state.doc.length || state.sliceDoc(layout.to, layout.to + 1) !== '\n') {
    return lastCell === undefined ? null : { position: lastCell.to, layout, cell: lastCell };
  }
  return { position: layout.to + 1, layout, cell: null };
}

function editableCellContainsPosition(cell: TableCellLayout, position: number): boolean {
  if (cell.virtual) {
    return false;
  }
  return cell.from === cell.to
    ? position === cell.cursor
    : position >= cell.from && position <= cell.to;
}

function selectedTableContext(state: EditorState): SelectionContext | null {
  const selection = state.field(markdownTableSelectionState);
  if (selection.tableFrom === null || selection.anchor === null || selection.head === null) {
    return null;
  }
  const layout = tableByFrom(state, selection.tableFrom);
  return layout === null
    ? null
    : { layout, selection: { anchor: selection.anchor, head: selection.head } };
}

function tableAtPosition(state: EditorState, position: number): TableLayout | null {
  return (
    findTableLayouts(state).find((layout) => position >= layout.from && position <= layout.to) ??
    null
  );
}

function tableByFrom(state: EditorState, from: number): TableLayout | null {
  return findTableLayouts(state).find((layout) => layout.from === from) ?? null;
}

function findTableLayouts(state: EditorState): readonly TableLayout[] {
  const layouts: TableLayout[] = [];
  const seen = new Set<number>();
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name !== 'Table' || seen.has(node.from)) {
        return;
      }
      const layout = tableLayout(state, node.node);
      if (layout !== null) {
        seen.add(node.from);
        layouts.push(layout);
      }
    },
  });
  return layouts;
}

function tableLayout(state: EditorState, node: SyntaxNode): TableLayout | null {
  const source = state.sliceDoc(node.from, node.to);
  const parsedTable = parseMarkdownTable(source);
  if (parsedTable === null) {
    return null;
  }
  const firstProseRow = parsedTable.body.findIndex((row) => !isExplicitTableBodyRow(row));
  const table =
    firstProseRow === -1
      ? parsedTable
      : {
          ...parsedTable,
          body: parsedTable.body.slice(0, firstProseRow),
          trailingNewline: false,
        };
  const sourceRows = [table.header, table.delimiter, ...table.body];
  const rows: TableRowLayout[] = [];
  let lineFrom = node.from;
  sourceRows.forEach((row, physicalIndex) => {
    const semanticIndex = physicalIndex === 1 ? null : physicalIndex === 0 ? 0 : physicalIndex - 1;
    const line = state.doc.lineAt(Math.min(lineFrom, state.doc.length));
    rows.push(
      buildRowLayout(
        row,
        line.from,
        line.to,
        semanticIndex,
        physicalIndex === 0 ? node.from : line.from,
        table.columnCount,
      ),
    );
    lineFrom = line.to + 1;
  });
  return {
    from: node.from,
    to: node.from + serializeMarkdownTable(table).length,
    table,
    rows,
    semanticRows: rows.filter(
      (row): row is TableRowLayout & { readonly semanticIndex: number } =>
        row.semanticIndex !== null,
    ),
  };
}

function isExplicitTableBodyRow(row: MarkdownTableRow): boolean {
  return row.leadingPipe || row.trailingPipe || row.cells.length > 1;
}

function buildRowLayout(
  row: MarkdownTableRow,
  lineFrom: number,
  lineTo: number,
  semanticIndex: number | null,
  contentFrom: number,
  columnCount: number,
): TableRowLayout {
  let cursor = contentFrom + row.prefix.length;
  if (row.leadingPipe) {
    cursor += 1;
  }
  const cells: TableCellLayout[] = row.cells.map((cell, columnIndex) => {
    const sourceFrom = cursor;
    const markdownFrom = cursor + cell.before.length;
    const markdownTo = markdownFrom + cell.markdown.length;
    cursor = markdownTo + cell.after.length;
    const rawCell = `${cell.before}${cell.markdown}${cell.after}`;
    const leadingStructuralSpace = rawCell.length > 1 && startsWithWhitespace(rawCell) ? 1 : 0;
    const trailingStructuralSpace = endsWithWhitespace(rawCell) ? 1 : 0;
    const from = Math.min(cursor, sourceFrom + leadingStructuralSpace);
    const to = Math.max(from, cursor - trailingStructuralSpace);
    const cellCursor = from;
    const renderFrom = from === to && from === cursor && from > sourceFrom ? from - 1 : from;
    const renderTo = from === to && renderFrom < cursor ? renderFrom + 1 : to;
    if (columnIndex < row.cells.length - 1) {
      cursor += 1;
    }
    return {
      rowIndex: semanticIndex ?? -1,
      columnIndex,
      from,
      to,
      renderFrom,
      renderTo,
      cursor: cellCursor,
      virtual: false,
    };
  });
  const virtualPosition = Math.min(cursor, lineTo);
  while (semanticIndex !== null && cells.length < columnCount) {
    cells.push({
      rowIndex: semanticIndex,
      columnIndex: cells.length,
      from: virtualPosition,
      to: virtualPosition,
      renderFrom: virtualPosition,
      renderTo: virtualPosition,
      cursor: virtualPosition,
      virtual: true,
    });
  }
  const structuralRanges: { readonly from: number; readonly to: number }[] = [];
  if (cells.length === 0) {
    pushNonEmptyRange(structuralRanges, lineFrom, lineTo);
  } else {
    pushNonEmptyRange(structuralRanges, lineFrom, requiredValue(cells, 0).renderFrom);
    cells.forEach((cell, index) => {
      const next = cells[index + 1];
      pushNonEmptyRange(structuralRanges, cell.renderTo, next?.renderFrom ?? lineTo);
    });
  }
  return {
    semanticIndex,
    from: lineFrom,
    to: lineTo,
    cells,
    structuralRanges,
  };
}

function startsWithWhitespace(value: string): boolean {
  return value.length > 0 && /\s/u.test(value[0] ?? '');
}

function endsWithWhitespace(value: string): boolean {
  return value.length > 0 && /\s/u.test(value.at(-1) ?? '');
}

function cellOffset(
  table: MarkdownTable,
  rowIndex: number,
  columnIndex: number,
  atEnd: boolean,
): number {
  const rows = [table.header, table.delimiter, ...table.body];
  const physicalIndex = rowIndex === 0 ? 0 : rowIndex + 1;
  const safePhysicalIndex = clampInteger(physicalIndex, 0, rows.length - 1);
  let offset = 0;
  for (let index = 0; index < safePhysicalIndex; index += 1) {
    offset += serializeRowForPosition(requiredValue(rows, index)).length + table.lineEnding.length;
  }
  const row = requiredValue(rows, safePhysicalIndex);
  const safeColumn = clampInteger(columnIndex, 0, Math.max(0, row.cells.length - 1));
  offset += row.prefix.length + (row.leadingPipe ? 1 : 0);
  for (let index = 0; index < safeColumn; index += 1) {
    const cell = requiredCell(row, index);
    offset += cell.before.length + cell.markdown.length + cell.after.length + 1;
  }
  const cell = requiredCell(row, safeColumn);
  if (cell.markdown.length === 0) {
    return offset + Math.floor((cell.before.length + cell.after.length) / 2);
  }
  return offset + cell.before.length + (atEnd ? cell.markdown.length : 0);
}

function selectionTouchesHiddenStructure(state: EditorState, from: number, to: number): boolean {
  if (from === to) {
    return false;
  }
  return findTableLayouts(state).some((layout) => {
    const terminator = tableTerminatorRange(state, layout);
    if (terminator !== null && rangesOverlap(from, to, terminator.from, terminator.to)) {
      return true;
    }
    if (from >= layout.to || to <= layout.from) {
      return false;
    }
    return layout.rows.some((row, index) => {
      if (
        row.semanticIndex === null &&
        rangesOverlap(from, to, row.from, Math.max(row.from + 1, row.to))
      ) {
        return true;
      }
      if (row.structuralRanges.some((range) => rangesOverlap(from, to, range.from, range.to))) {
        return true;
      }
      const nextRow = layout.rows[index + 1];
      return nextRow !== undefined && rangesOverlap(from, to, row.to, nextRow.from);
    });
  });
}

function tableTerminatorRange(
  state: EditorState,
  layout: TableLayout,
): { readonly from: number; readonly to: number } | null {
  if (
    layout.to >= state.doc.length ||
    !/^(?:\r?\n)+$/u.test(state.sliceDoc(layout.to, state.doc.length))
  ) {
    return null;
  }
  const finalLine = state.doc.line(state.doc.lines);
  if (finalLine.from !== state.doc.length || finalLine.length !== 0 || finalLine.number === 1) {
    return null;
  }
  const precedingLine = state.doc.line(finalLine.number - 1);
  return { from: precedingLine.to, to: finalLine.from };
}

function insertionTouchesHiddenStructure(state: EditorState, position: number): boolean {
  const layout = tableAtPosition(state, position);
  if (layout === null) {
    return false;
  }
  const row = layout.rows.find(
    (candidate) => position >= candidate.from && position <= candidate.to,
  );
  if (row === undefined || row.semanticIndex === null) {
    return true;
  }
  return !row.cells.some((cell) => editableCellContainsPosition(cell, position));
}

function selectionCellPosition(layout: TableLayout, selection: MarkdownTableCellRange): number {
  const bounds = markdownTableSelectionBounds(layout.table, selection);
  return layout.semanticRows[bounds.minRow]?.cells[bounds.minColumn]?.cursor ?? layout.from;
}

function positionInsideSelection(
  table: MarkdownTable,
  selection: MarkdownTableCellRange,
  position: MarkdownTableCellPosition,
): boolean {
  const bounds = markdownTableSelectionBounds(table, selection);
  return (
    position.row >= bounds.minRow &&
    position.row <= bounds.maxRow &&
    position.column >= bounds.minColumn &&
    position.column <= bounds.maxColumn
  );
}

function sameCellSelection(left: SelectionContext, right: SelectionContext): boolean {
  return (
    left.layout.from === right.layout.from &&
    left.selection.anchor.row === right.selection.anchor.row &&
    left.selection.anchor.column === right.selection.anchor.column &&
    left.selection.head.row === right.selection.head.row &&
    left.selection.head.column === right.selection.head.column
  );
}

function remapMovedIndices(
  indices: readonly number[],
  targetGap: number,
  length: number,
): readonly number[] {
  const moving = [...new Set(indices)]
    .filter((index) => index >= 0 && index < length)
    .sort((left, right) => left - right);
  const gap = clampInteger(targetGap, 0, length);
  const removedBeforeGap = moving.filter((index) => index < gap).length;
  const first = gap - removedBeforeGap;
  return moving.map((_, offset) => first + offset);
}

function tableControl(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>('[data-table-action]') : null;
}

function tableDragHandle(target: EventTarget | null): HTMLButtonElement | null {
  const control = tableControl(target);
  const action = control?.dataset['tableAction'];
  return control instanceof HTMLButtonElement && (action === 'drag-row' || action === 'drag-column')
    ? control
    : null;
}

function tableCellElement(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>('[data-table-cell="true"]') : null;
}

function cellData(
  element: HTMLElement,
): { readonly tableFrom: number; readonly row: number; readonly column: number } | null {
  const tableFrom = numberData(element, 'tableFrom');
  const row = numberData(element, 'row');
  const column = numberData(element, 'column');
  return tableFrom === null || row === null || column === null ? null : { tableFrom, row, column };
}

function numberData(
  element: HTMLElement,
  key: 'tableFrom' | 'index' | 'cellFrom' | 'row' | 'column',
): number | null {
  const value = element.dataset[key];
  if (value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function rangesOverlap(
  leftFrom: number,
  leftTo: number,
  rightFrom: number,
  rightTo: number,
): boolean {
  return leftFrom < rightTo && leftTo > rightFrom;
}

function pushNonEmptyRange(
  ranges: { readonly from: number; readonly to: number }[],
  from: number,
  to: number,
): void {
  if (from < to) {
    ranges.push({ from, to });
  }
}

function isStructuralCharacter(value: string): boolean {
  return value === '|' || value === '\n' || value === '\r';
}

function distanceFromCell(position: number, cell: TableCellLayout): number {
  if (position < cell.from) {
    return cell.from - position;
  }
  if (position > cell.to) {
    return position - cell.to;
  }
  return 0;
}

function inclusiveIndices(minimum: number, maximum: number): number[] {
  return Array.from({ length: maximum - minimum + 1 }, (_, offset) => minimum + offset);
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function serializeRowForPosition(row: MarkdownTableRow): string {
  return (
    row.prefix +
    (row.leadingPipe ? '|' : '') +
    row.cells.map((cell) => `${cell.before}${cell.markdown}${cell.after}`).join('|') +
    (row.trailingPipe ? '|' : '') +
    row.suffix
  );
}

function requiredSemanticIndex(row: TableRowLayout): number {
  if (row.semanticIndex === null) {
    throw new Error('Delimiter row has no semantic index');
  }
  return row.semanticIndex;
}

function requiredCell(row: MarkdownTableRow, index: number): MarkdownTableRow['cells'][number] {
  const cell = row.cells[index];
  if (cell === undefined) {
    throw new Error(`Missing table cell ${index}`);
  }
  return cell;
}

function requiredValue<Value>(values: readonly Value[], index: number): Value {
  const value = values[index];
  if (value === undefined) {
    throw new Error(`Missing value ${index}`);
  }
  return value;
}

function requiredActiveCell(
  active: ReturnType<typeof activeTableCell>,
): NonNullable<ReturnType<typeof activeTableCell>> {
  if (active === null) {
    throw new Error('Active table cell is required');
  }
  return active;
}

function requiredConfig(state: EditorState): MarkdownTableEditorConfig {
  const config = state.facet(markdownTableEditorConfig);
  if (config === null) {
    throw new Error('Markdown table editor config is required');
  }
  return config;
}
