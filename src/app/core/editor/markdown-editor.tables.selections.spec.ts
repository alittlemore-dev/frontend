import { defaultKeymap } from '@codemirror/commands';
import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { markdownEditorFoundationExtensions } from './markdown-editor.extensions';
import {
  markdownTableEditor,
  markdownTableSelectionState,
  type MarkdownTableEditorConfig,
} from './markdown-editor.tables';

const phrases: MarkdownTableEditorConfig['phrases'] = {
  table: 'Table',
  row: 'Row',
  column: 'Column',
  range: 'Selected cells',
  menu: 'Table menu',
  addRow: 'Add row',
  addColumn: 'Add column',
  moveRow: 'Move row',
  moveColumn: 'Move column',
  insertBefore: 'Insert before',
  insertAfter: 'Insert after',
  duplicate: 'Duplicate',
  clear: 'Clear',
  copy: 'Copy',
  cut: 'Cut',
  delete: 'Delete',
  moveBefore: 'Move before',
  moveAfter: 'Move after',
  sortAscending: 'Sort ascending',
  sortDescending: 'Sort descending',
  alignLeft: 'Align left',
  alignCenter: 'Align center',
  alignRight: 'Align right',
  format: 'Format table',
  deleteTable: 'Delete table',
  clipboardFailed: 'Clipboard unavailable',
};

const config: MarkdownTableEditorConfig = { locale: 'en', phrases };
const MIXED_SOURCE = [
  'before alpha',
  'before beta',
  '',
  '| H1 | H2 | H3 |',
  '| --- | :---: | ---: |',
  '| A1 | A2 | A3 |',
  '| B1 |  | B3 |',
  '',
  'after alpha',
  'after beta',
].join('\n');

interface SelectionCase {
  readonly name: string;
  readonly anchor: number;
  readonly head: number;
  readonly touchesTable: boolean;
}

const selectionCases = buildSelectionCases(MIXED_SOURCE);

describe('Markdown table mixed-selection rendering', () => {
  const views: EditorView[] = [];

  afterEach(() => {
    views.splice(0).forEach((view) => view.destroy());
    document.body.replaceChildren();
  });

  it.each(selectionCases)(
    'keeps $name as an ordinary source selection without a geometric overlay',
    ({ anchor, head }) => {
      const view = createProductionLikeView(MIXED_SOURCE, views);
      const original = view.state.doc.toString();
      const expected = EditorSelection.range(anchor, head);

      view.dispatch({ selection: expected, userEvent: 'select' });

      expect(view.state.selection.main).toEqual(expected);
      expect(view.state.doc.toString()).toBe(original);
      expect(view.state.field(markdownTableSelectionState).anchor).toBeNull();
      expect(view.dom.querySelector('.cm-selectionLayer')).toBeNull();
      expect(view.dom.querySelectorAll('.cm-selectionBackground')).toHaveLength(0);
      expect(view.dom.querySelectorAll('.cm-markdown-table-cell-selected')).toHaveLength(0);
    },
  );

  it.each(selectionCases.filter(({ touchesTable }) => touchesTable))(
    'protects table structure when Backspace or Delete targets $name',
    ({ anchor, head }) => {
      const view = createProductionLikeView(MIXED_SOURCE, views);
      const original = view.state.doc.toString();
      view.dispatch({ selection: EditorSelection.range(anchor, head), userEvent: 'select' });

      for (const keyValue of ['Backspace', 'Delete'] as const) {
        const event = key(view, keyValue);

        expect(event.defaultPrevented).toBe(true);
        expect(view.state.doc.toString()).toBe(original);
        expect(view.state.selection.main).toEqual(EditorSelection.range(anchor, head));
      }
    },
  );

  it.each(selectionCases.filter(({ touchesTable }) => !touchesTable))(
    'leaves ordinary editing behavior available for $name',
    ({ anchor, head }) => {
      const view = createProductionLikeView(MIXED_SOURCE, views);
      view.dispatch({ selection: EditorSelection.range(anchor, head), userEvent: 'select' });

      expect(key(view, 'Backspace').defaultPrevented).toBe(true);
      expect(view.state.doc.toString()).not.toBe(MIXED_SOURCE);
    },
  );

  it.each([
    {
      name: 'forward disjoint selections',
      ranges: [
        [0, 6],
        [index('A1'), index('A1') + 2],
      ],
    },
    {
      name: 'reverse disjoint selections',
      ranges: [
        [index('after alpha') + 5, index('after alpha')],
        [index('H2') + 2, index('H2')],
      ],
    },
    {
      name: 'selections in three cells',
      ranges: [
        [index('H1'), index('H1') + 2],
        [index('A2'), index('A2') + 2],
        [index('B3'), index('B3') + 2],
      ],
    },
  ])('preserves $name without drawing duplicate cursor or range layers', ({ ranges }) => {
    const view = createProductionLikeView(MIXED_SOURCE, views);
    const selection = EditorSelection.create(
      ranges.map(([anchor, head]) => EditorSelection.range(required(anchor), required(head))),
    );

    view.dispatch({ selection, userEvent: 'select' });

    expect(view.state.selection.ranges.map(({ anchor, head }) => ({ anchor, head }))).toEqual(
      selection.ranges.map(({ anchor, head }) => ({ anchor, head })),
    );
    expect(view.dom.querySelector('.cm-selectionLayer')).toBeNull();
    expect(view.dom.querySelectorAll('.cm-cursorLayer')).toHaveLength(1);
    expect(view.dom.querySelectorAll('.cm-markdown-table-cursor-layer')).toHaveLength(1);
  });

  it.each([
    { name: 'a partial cell', row: 1, column: 0, offset: 1 },
    { name: 'the start of a populated cell', row: 0, column: 1, offset: 0 },
    { name: 'the end of a populated cell', row: 2, column: 2, offset: 2 },
    { name: 'an empty cell', row: 2, column: 1, offset: 0 },
  ])('keeps a collapsed caret in $name free of selection artifacts', ({ row, column, offset }) => {
    const view = createProductionLikeView(MIXED_SOURCE, views);
    const target = cell(view, row, column);
    const position = Number(target.dataset['cellFrom']) + offset;

    view.dispatch({ selection: EditorSelection.cursor(position), userEvent: 'select' });

    expect(view.state.selection.main.empty).toBe(true);
    expect(view.dom.querySelector('.cm-selectionLayer')).toBeNull();
    expect(view.dom.querySelectorAll('.cm-selectionBackground')).toHaveLength(0);
    expect(view.dom.querySelectorAll('.cm-markdown-table-cell-active')).toHaveLength(1);
  });

  it.each([
    { name: 'a partial row', anchor: [1, 0], head: [1, 1], count: 2 },
    { name: 'a whole row', anchor: [1, 0], head: [1, 2], count: 3 },
    { name: 'a partial column', anchor: [1, 1], head: [2, 1], count: 2 },
    { name: 'a whole column', anchor: [0, 1], head: [2, 1], count: 3 },
    { name: 'an inner rectangle', anchor: [1, 1], head: [2, 2], count: 4 },
    { name: 'the whole table', anchor: [0, 0], head: [2, 2], count: 9 },
    { name: 'a reverse row', anchor: [1, 2], head: [1, 0], count: 3 },
    { name: 'a reverse column', anchor: [2, 1], head: [0, 1], count: 3 },
    { name: 'a reverse rectangle', anchor: [2, 2], head: [1, 1], count: 4 },
    { name: 'the reverse whole table', anchor: [2, 2], head: [0, 0], count: 9 },
  ])('renders $name only through the bounded semantic cell overlay', ({ anchor, head, count }) => {
    const view = createProductionLikeView(MIXED_SOURCE, views);

    selectCells(view, tuple(anchor), tuple(head));

    expect(view.state.selection.main.empty).toBe(true);
    expect(view.dom.querySelector('.cm-selectionLayer')).toBeNull();
    expect(view.dom.querySelectorAll('.cm-selectionBackground')).toHaveLength(0);
    expect(view.dom.querySelectorAll('.cm-markdown-table-cell-selected')).toHaveLength(count);
    expect(
      [...view.dom.querySelectorAll<HTMLElement>('.cm-markdown-table-cell-selected')].every(
        (selectedCell) => selectedCell.getAttribute('aria-selected') === 'true',
      ),
    ).toBe(true);
  });

  it('keeps a same-cell pointer gesture as native text editing without a table overlay', () => {
    const view = createProductionLikeView(MIXED_SOURCE, views);
    const target = cell(view, 1, 0);

    pointer(target, 'pointerdown');
    pointer(target, 'pointermove');
    pointer(target, 'pointerup');

    expect(view.state.field(markdownTableSelectionState).anchor).toBeNull();
    expect(view.dom.querySelectorAll('.cm-markdown-table-cell-selected')).toHaveLength(0);
    expect(view.dom.querySelector('.cm-selectionLayer')).toBeNull();
  });

  it('contracts an existing rectangular selection to one semantic cell with Shift', () => {
    const view = createProductionLikeView(MIXED_SOURCE, views);
    selectCells(view, [1, 0], [1, 1]);

    pointer(cell(view, 1, 0), 'pointerdown', true);

    expect(view.dom.querySelectorAll('.cm-markdown-table-cell-selected')).toHaveLength(1);
    expect(cell(view, 1, 0).getAttribute('aria-selected')).toBe('true');
    expect(view.dom.querySelector('.cm-selectionLayer')).toBeNull();
  });
});

function buildSelectionCases(source: string): readonly SelectionCase[] {
  const beforeAlpha = requiredIndex(source, 'before alpha');
  const beforeBeta = requiredIndex(source, 'before beta');
  const header = sourceLine(source, '| H1');
  const delimiter = sourceLine(source, '| ---');
  const firstBody = sourceLine(source, '| A1');
  const lastBody = sourceLine(source, '| B1');
  const h1 = requiredIndex(source, 'H1');
  const h2 = requiredIndex(source, 'H2');
  const h3 = requiredIndex(source, 'H3');
  const a1 = requiredIndex(source, 'A1');
  const a2 = requiredIndex(source, 'A2');
  const a3 = requiredIndex(source, 'A3');
  const b1 = requiredIndex(source, 'B1');
  const afterAlpha = requiredIndex(source, 'after alpha');
  const afterBeta = requiredIndex(source, 'after beta');
  const forward: readonly SelectionCase[] = [
    {
      name: 'text inside one ordinary line',
      anchor: beforeAlpha,
      head: beforeAlpha + 6,
      touchesTable: false,
    },
    {
      name: 'two ordinary lines above the table',
      anchor: beforeAlpha + 3,
      head: beforeBeta + 7,
      touchesTable: false,
    },
    {
      name: 'two ordinary lines below the table',
      anchor: afterAlpha + 2,
      head: afterBeta + 6,
      touchesTable: false,
    },
    { name: 'part of one header cell', anchor: h1, head: h1 + 1, touchesTable: false },
    { name: 'one complete header cell', anchor: h2, head: h2 + 2, touchesTable: false },
    { name: 'part of one body cell', anchor: a2, head: a2 + 1, touchesTable: false },
    {
      name: 'adjacent cells in one row',
      anchor: h1,
      head: h2 + 2,
      touchesTable: true,
    },
    {
      name: 'the first and last header cells',
      anchor: h1,
      head: h3 + 2,
      touchesTable: true,
    },
    {
      name: 'the same column across header and body',
      anchor: h1,
      head: b1 + 2,
      touchesTable: true,
    },
    {
      name: 'diagonal cells across the table',
      anchor: h3,
      head: b1 + 2,
      touchesTable: true,
    },
    {
      name: 'a complete header source line',
      anchor: header.from,
      head: header.to,
      touchesTable: true,
    },
    {
      name: 'the complete delimiter source line',
      anchor: delimiter.from,
      head: delimiter.to,
      touchesTable: true,
    },
    {
      name: 'a complete body source line',
      anchor: firstBody.from,
      head: firstBody.to,
      touchesTable: true,
    },
    {
      name: 'the table from the first leading pipe to the final trailing pipe',
      anchor: header.from,
      head: lastBody.to,
      touchesTable: true,
    },
    {
      name: 'ordinary prose entering the header',
      anchor: beforeBeta + 3,
      head: h2 + 1,
      touchesTable: true,
    },
    {
      name: 'ordinary prose entering the body',
      anchor: beforeAlpha + 4,
      head: a3 + 1,
      touchesTable: true,
    },
    {
      name: 'the header leaving into ordinary prose',
      anchor: h2,
      head: afterAlpha + 5,
      touchesTable: true,
    },
    {
      name: 'the body leaving into ordinary prose',
      anchor: a1,
      head: afterBeta + 4,
      touchesTable: true,
    },
    {
      name: 'ordinary prose surrounding the complete table',
      anchor: beforeAlpha + 2,
      head: afterAlpha + 8,
      touchesTable: true,
    },
    {
      name: 'the complete document',
      anchor: 0,
      head: source.length,
      touchesTable: true,
    },
  ];
  return forward.flatMap((selectionCase) => [
    selectionCase,
    {
      ...selectionCase,
      name: `reverse ${selectionCase.name}`,
      anchor: selectionCase.head,
      head: selectionCase.anchor,
    },
  ]);
}

function createProductionLikeView(doc: string, views: EditorView[]): EditorView {
  const parent = document.createElement('div');
  parent.className = 'markdown-editor-shell';
  document.body.append(parent);
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        ...markdownEditorFoundationExtensions,
        markdownTableEditor(config),
        keymap.of(defaultKeymap),
      ],
    }),
  });
  views.push(view);
  view.focus();
  return view;
}

function key(view: EditorView, keyValue: 'Backspace' | 'Delete'): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: keyValue,
    bubbles: true,
    cancelable: true,
  });
  view.contentDOM.dispatchEvent(event);
  return event;
}

function selectCells(
  view: EditorView,
  anchor: readonly [number, number],
  head: readonly [number, number],
): void {
  pointer(cell(view, anchor[0], anchor[1]), 'pointerdown');
  pointer(cell(view, head[0], head[1]), 'pointermove');
  pointer(cell(view, head[0], head[1]), 'pointerup');
}

function pointer(
  target: HTMLElement,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  shiftKey = false,
): void {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, shiftKey });
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  target.dispatchEvent(event);
}

function cell(view: EditorView, row: number, column: number): HTMLElement {
  const result = view.dom.querySelector<HTMLElement>(
    `[data-table-cell="true"][data-row="${row}"][data-column="${column}"]`,
  );
  if (result === null) {
    throw new Error(`Missing cell ${row}:${column}`);
  }
  return result;
}

function sourceLine(source: string, text: string): { readonly from: number; readonly to: number } {
  const from = requiredIndex(source, text);
  const lineBreak = source.indexOf('\n', from);
  return { from, to: lineBreak === -1 ? source.length : lineBreak };
}

function index(text: string): number {
  return requiredIndex(MIXED_SOURCE, text);
}

function requiredIndex(source: string, text: string): number {
  const result = source.indexOf(text);
  if (result === -1) {
    throw new Error(`Missing ${text}`);
  }
  return result;
}

function required(value: number | undefined): number {
  if (value === undefined) {
    throw new Error('Missing selection boundary');
  }
  return value;
}

function tuple(value: readonly number[]): readonly [number, number] {
  const first = value[0];
  const second = value[1];
  if (first === undefined || second === undefined) {
    throw new Error('Missing cell coordinate');
  }
  return [first, second];
}
