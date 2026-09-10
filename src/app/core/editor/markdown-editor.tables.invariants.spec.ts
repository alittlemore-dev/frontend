import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { EditorSelection, EditorState, Transaction } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
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
const originalRangeGetClientRects = Reflect.get(Range.prototype, 'getClientRects') as
  Range['getClientRects'] | undefined;
const originalRangeGetBoundingClientRect = Reflect.get(Range.prototype, 'getBoundingClientRect') as
  Range['getBoundingClientRect'] | undefined;
const STRUCTURAL_SOURCE = [
  'before',
  '',
  '| H1 | H2 | H3 |',
  '| --- | :---: | ---: |',
  '| A1 | A2 | A3 |',
  '| B1 |  | B3 |',
  '',
  'after',
].join('\n');

interface SourceLine {
  readonly from: number;
  readonly to: number;
}

interface CaretInvariantCase {
  readonly name: string;
  readonly position: number;
  readonly expected: number;
  readonly outsideTable: boolean;
}

interface SelectionShapeCase {
  readonly name: string;
  readonly anchor: readonly [number, number];
  readonly head: readonly [number, number];
}

interface SelectionOverlapCase {
  readonly name: string;
  readonly from: number;
  readonly to: number;
  readonly protected: boolean;
}

interface FillFixture {
  readonly name: string;
  readonly source: string;
  readonly rows: number;
  readonly columns: number;
}

const caretInvariantCases = buildCaretInvariantCases(STRUCTURAL_SOURCE);
const allowedCaretCases = buildAllowedCaretCases(STRUCTURAL_SOURCE);
const selectionShapes: readonly SelectionShapeCase[] = [
  { name: 'partial row', anchor: [1, 0], head: [1, 1] },
  { name: 'complete row', anchor: [1, 0], head: [1, 2] },
  { name: 'partial column', anchor: [1, 1], head: [2, 1] },
  { name: 'complete column', anchor: [0, 1], head: [2, 1] },
  { name: 'inner rectangle', anchor: [1, 1], head: [2, 2] },
  { name: 'whole table', anchor: [0, 0], head: [2, 2] },
  { name: 'reverse partial row', anchor: [1, 2], head: [1, 1] },
  { name: 'reverse partial column', anchor: [2, 1], head: [1, 1] },
  { name: 'reverse rectangle', anchor: [2, 2], head: [1, 1] },
  { name: 'reverse whole table', anchor: [2, 2], head: [0, 0] },
];
const fillFixtures: readonly FillFixture[] = [
  {
    name: 'dense three-by-three table',
    source: '| H1 | H2 | H3 |\n| --- | --- | --- |\n| A1 | A2 | A3 |\n| B1 | B2 | B3 |\n\noutside',
    rows: 3,
    columns: 3,
  },
  {
    name: 'authored empty cells',
    source: '|  | H2 |\n| --- | --- |\n|  |  |\n\noutside',
    rows: 2,
    columns: 2,
  },
  {
    name: 'inline Markdown',
    source:
      '| **bold** | `code` | [link](https://example.com) |\n| --- | --- | --- |\n| _italic_ | ~~strike~~ | plain |\n\noutside',
    rows: 2,
    columns: 3,
  },
  {
    name: 'escaped pipe and punctuation',
    source:
      '| a\\|b | x:y | braces{} |\n| --- | --- | --- |\n| slash\\\\ | quote" | apostrophe\' |\n\noutside',
    rows: 2,
    columns: 3,
  },
  {
    name: 'Unicode and emoji',
    source:
      '| Русский | 日本語 | emoji 🧭 |\n| --- | --- | --- |\n| naïve | العربية | 👩‍💻 |\n\noutside',
    rows: 2,
    columns: 3,
  },
  {
    name: 'short rows with virtual cells',
    source: '| H1 | H2 | H3 |\n| --- | --- | --- |\n| only one |\n| first | second |\n\noutside',
    rows: 3,
    columns: 3,
  },
];

describe('Markdown table editor invariants', () => {
  const views: EditorView[] = [];

  beforeEach(() => {
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value: () => [],
    });
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => zeroRect(),
    });
  });

  afterEach(() => {
    views.splice(0).forEach((view) => view.destroy());
    document.body.replaceChildren();
    if (originalRangeGetClientRects === undefined) {
      Reflect.deleteProperty(Range.prototype, 'getClientRects');
    } else {
      Object.defineProperty(Range.prototype, 'getClientRects', {
        configurable: true,
        value: originalRangeGetClientRects,
      });
    }
    if (originalRangeGetBoundingClientRect === undefined) {
      Reflect.deleteProperty(Range.prototype, 'getBoundingClientRect');
    } else {
      Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
        configurable: true,
        value: originalRangeGetBoundingClientRect,
      });
    }
  });

  it.each(caretInvariantCases)('normalizes the caret away from $name', ({ position, expected }) => {
    const view = createView(STRUCTURAL_SOURCE, views, 0);

    view.dispatch({ selection: EditorSelection.cursor(position), userEvent: 'select' });

    expect(view.state.selection.main).toEqual(EditorSelection.cursor(expected));
    expect(view.state.doc.toString()).toBe(STRUCTURAL_SOURCE);
  });

  it.each(allowedCaretCases)('keeps the caret at $name', ({ position }) => {
    const view = createView(STRUCTURAL_SOURCE, views, 0);

    view.dispatch({ selection: EditorSelection.cursor(position), userEvent: 'select' });

    expect(view.state.selection.main).toEqual(EditorSelection.cursor(position));
  });

  it.each(caretInvariantCases)(
    'redirects typing from $name to the exact next editable position',
    ({ position, expected, outsideTable }) => {
      const view = createView(STRUCTURAL_SOURCE, views, position);

      view.dispatch({
        changes: { from: position, insert: 'X' },
        selection: EditorSelection.cursor(position + 1),
        scrollIntoView: true,
        userEvent: 'input.type',
      });

      const insertion = 'X';
      expect(view.state.doc.toString()).toBe(
        `${STRUCTURAL_SOURCE.slice(0, expected)}${insertion}${STRUCTURAL_SOURCE.slice(expected)}`,
      );
      expect(view.state.selection.main.head).toBe(expected + insertion.length);
      if (outsideTable) {
        expect(
          [...view.dom.querySelectorAll<HTMLElement>('[data-table-cell="true"]')]
            .map((tableCell) => tableCell.textContent)
            .join(''),
        ).not.toContain('X');
      }
    },
  );

  it.each(
    caretInvariantCases.flatMap((caretCase) =>
      (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'] as const).map((keyValue) => ({
        ...caretCase,
        keyValue,
      })),
    ),
  )('recovers $keyValue from $name', ({ position, expected, keyValue }) => {
    const view = createView(STRUCTURAL_SOURCE, views, position);

    const event = key(view, keyValue);

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.selection.main).toEqual(EditorSelection.cursor(expected));
  });

  it.each(selectionShapes)(
    'selects a rectangular $name in either direction',
    ({ anchor, head }) => {
      const source = '| H1 | H2 | H3 |\n| --- | --- | --- |\n| A1 | A2 | A3 |\n| B1 | B2 | B3 |';
      const view = createView(source, views, source.indexOf('H1'));

      selectCells(view, anchor, head);

      const state = view.state.field(markdownTableSelectionState);
      const minRow = Math.min(anchor[0], head[0]);
      const maxRow = Math.max(anchor[0], head[0]);
      const minColumn = Math.min(anchor[1], head[1]);
      const maxColumn = Math.max(anchor[1], head[1]);
      expect(state).toEqual({
        tableFrom: 0,
        anchor: { row: anchor[0], column: anchor[1] },
        head: { row: head[0], column: head[1] },
      });
      expect(view.dom.querySelectorAll('.cm-markdown-table-cell-selected')).toHaveLength(
        (maxRow - minRow + 1) * (maxColumn - minColumn + 1),
      );
      expect(view.state.selection.main).toEqual(
        EditorSelection.cursor(Number(cell(view, anchor[0], anchor[1]).dataset['cellFrom'])),
      );
    },
  );

  it.each(buildSelectionOverlapCases(STRUCTURAL_SOURCE))(
    'preserves $name while preventing structural deletion',
    ({ from, to, protected: protectedSelection }) => {
      const view = createView(STRUCTURAL_SOURCE, views, from);
      const original = view.state.doc.toString();

      view.dispatch({ selection: EditorSelection.range(from, to), userEvent: 'select' });

      expect(view.state.selection.main).toEqual(EditorSelection.range(from, to));
      for (const keyValue of ['Backspace', 'Delete'] as const) {
        const event = key(view, keyValue);
        expect(event.defaultPrevented).toBe(protectedSelection);
        expect(view.state.doc.toString()).toBe(original);
      }
    },
  );

  it.each(buildSelectionOverlapCases(STRUCTURAL_SOURCE))(
    '$name is $protected for direct replacement',
    ({ from, to, protected: protectedSelection }) => {
      const view = createView(STRUCTURAL_SOURCE, views, from);

      view.dispatch({
        changes: { from, to, insert: 'X' },
        selection: EditorSelection.cursor(from + 1),
        userEvent: 'input.type',
      });

      const expected = protectedSelection
        ? STRUCTURAL_SOURCE
        : `${STRUCTURAL_SOURCE.slice(0, from)}X${STRUCTURAL_SOURCE.slice(to)}`;
      expect(view.state.doc.toString()).toBe(expected);
    },
  );

  it.each(fillFixtures)(
    'fills every visible cell in $name and keeps one table caret',
    async ({ source, rows, columns }) => {
      const view = createView(source, views, source.indexOf('|'));

      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const target = cell(view, row, column);
          mockBounds(target, row, column);
          if (target.dataset['emptyCell'] === 'true') {
            pointer(target, 'pointerdown');
            pointer(target, 'pointerup');
          } else {
            setCursor(view, Number(target.dataset['cellFrom']));
          }
          const marker = `x${row}${column}`;
          view.dispatch(view.state.replaceSelection(marker), {
            annotations: Transaction.userEvent.of('input.type'),
          });
          await flushEditorMeasure();

          expect(cell(view, row, column).textContent).toContain(marker);
          expect(view.dom.querySelectorAll('.cm-markdown-table-cell-active')).toHaveLength(1);
          expect(cell(view, row, column).classList).toContain('cm-markdown-table-cell-active');
          expect(view.dom.querySelectorAll('.cm-markdown-table-cursor-layer')).toHaveLength(1);
          expect(view.dom.querySelectorAll('.cm-markdown-table-cursor')).toHaveLength(1);
          expect(visiblePrimaryCursors(view)).toHaveLength(1);
          expect(view.contentDOM.querySelector('.cm-markdown-table-caret')).toBeNull();
        }
      }
    },
  );

  it('renders one focused table caret on a blinking cursor layer', async () => {
    const source = '| H1 | H2 |\n| --- | --- |\n| A1 | A2 |';
    const view = createView(source, views, source.indexOf('A1') + 1);
    const target = cell(view, 1, 0);
    mockBounds(target, 1, 0);
    setCursor(view, source.indexOf('A1') + 1);
    await flushEditorMeasure();
    const layer = view.dom.querySelector<HTMLElement>('.cm-markdown-table-cursor-layer');
    const marker = view.dom.querySelector<HTMLElement>('.cm-markdown-table-cursor');

    expect(layer).not.toBeNull();
    expect(marker).not.toBeNull();
    expect(getComputedStyle(marker!).display).toBe('block');
    expect(layer!.classList).toContain('cm-cursorLayer');
    expect(view.dom.classList).toContain('cm-focused');
    expect(visiblePrimaryCursors(view)).toEqual([marker]);

    setCursor(view, source.indexOf('A1') + 2);
    await flushEditorMeasure();

    expect(view.dom.querySelectorAll('.cm-markdown-table-cursor')).toHaveLength(1);
  });

  it.each([
    {
      name: 'canonical header cells in a two-row table',
      source: '|  |  |\n| --- | --- |\n| body | value |',
      row: 0,
    },
    {
      name: 'compact header cells in a many-row table',
      source: '|||\n|---|---|\n| first | value |\n| second | value |',
      row: 0,
    },
    {
      name: 'canonical body cells in a two-row table',
      source: '| H1 | H2 |\n| --- | --- |\n|  |  |',
      row: 1,
    },
    {
      name: 'compact middle-body cells in a many-row table',
      source: '| H1 | H2 |\n|---|---|\n|||\n| final | value |',
      row: 1,
    },
  ])(
    'keeps one cell-line caret across repeated ArrowLeft moves between $name',
    async ({ source, row }) => {
      const view = createView(source, views, 0);
      const nativeBounds = HTMLElement.prototype.getBoundingClientRect;
      const bounds = jest
        .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
        .mockImplementation(function (this: HTMLElement): DOMRect {
          const cellRow = Number(this.dataset['row']);
          const cellColumn = Number(this.dataset['column']);
          return this.dataset['tableCell'] === 'true' &&
            Number.isInteger(cellRow) &&
            Number.isInteger(cellColumn)
            ? positionedRect(cellRow, cellColumn)
            : nativeBounds.call(this);
        });
      const coordinates = jest.spyOn(view, 'coordsAtPos').mockReturnValue({
        left: 10,
        right: 10,
        top: row * 40 - 80,
        bottom: row * 40 + 120,
      });

      try {
        for (let repetition = 0; repetition < 3; repetition += 1) {
          setCursor(view, Number(cell(view, row, 1).dataset['cellFrom']));
          const event = key(view, 'ArrowLeft');
          await flushEditorMeasure();

          const activeLeft = cell(view, row, 0);
          const marker = view.dom.querySelector<HTMLElement>('.cm-markdown-table-cursor');
          const markerHeight = Number.parseFloat(marker?.style.height ?? '');

          expect(event.defaultPrevented).toBe(true);
          expect(view.state.selection.main.head).toBe(Number(activeLeft.dataset['cellFrom']));
          expect(activeLeft.classList).toContain('cm-markdown-table-cell-active');
          expect(view.dom.querySelectorAll('.cm-markdown-table-cell-active')).toHaveLength(1);
          expect(visiblePrimaryCursors(view)).toHaveLength(1);
          expect(Number.isFinite(markerHeight)).toBe(true);
          expect(markerHeight).toBeGreaterThan(0);
          expect(markerHeight).toBeLessThanOrEqual(40);
        }
      } finally {
        coordinates.mockRestore();
        bounds.mockRestore();
      }
    },
  );
});

function buildCaretInvariantCases(source: string): readonly CaretInvariantCase[] {
  const header = sourceLine(source, '| H1');
  const delimiter = sourceLine(source, '| ---');
  const firstBody = sourceLine(source, '| A1');
  const secondBody = sourceLine(source, '| B1');
  const headerPipes = characterPositions(source, '|', header);
  const firstBodyPipes = characterPositions(source, '|', firstBody);
  const secondBodyPipes = characterPositions(source, '|', secondBody);
  const h2 = requiredIndex(source, 'H2');
  const h3 = requiredIndex(source, 'H3');
  const a1 = requiredIndex(source, 'A1');
  const a2 = requiredIndex(source, 'A2');
  const b1 = requiredIndex(source, 'B1');
  const b3 = requiredIndex(source, 'B3');
  const emptyCursor = requiredValue(secondBodyPipes, 1) + 2;
  const terminator = secondBody.to + 1;

  return [
    {
      name: 'the header leading pipe',
      position: header.from,
      expected: requiredIndex(source, 'H1'),
      outsideTable: false,
    },
    {
      name: 'the header leading padding',
      position: header.from + 1,
      expected: requiredIndex(source, 'H1'),
      outsideTable: false,
    },
    {
      name: 'the first header separator',
      position: requiredValue(headerPipes, 1),
      expected: h2,
      outsideTable: false,
    },
    {
      name: 'padding after the first header separator',
      position: requiredValue(headerPipes, 1) + 1,
      expected: h2,
      outsideTable: false,
    },
    {
      name: 'the second header separator',
      position: requiredValue(headerPipes, 2),
      expected: h3,
      outsideTable: false,
    },
    {
      name: 'padding after the second header separator',
      position: requiredValue(headerPipes, 2) + 1,
      expected: h3,
      outsideTable: false,
    },
    {
      name: 'the header trailing pipe',
      position: requiredValue(headerPipes, 3),
      expected: a1,
      outsideTable: false,
    },
    { name: 'the header line end', position: header.to, expected: a1, outsideTable: false },
    {
      name: 'the delimiter leading pipe',
      position: delimiter.from,
      expected: a1,
      outsideTable: false,
    },
    { name: 'delimiter content', position: delimiter.from + 5, expected: a1, outsideTable: false },
    {
      name: 'the delimiter trailing pipe',
      position: delimiter.to - 1,
      expected: a1,
      outsideTable: false,
    },
    { name: 'the delimiter line end', position: delimiter.to, expected: a1, outsideTable: false },
    { name: 'a body leading pipe', position: firstBody.from, expected: a1, outsideTable: false },
    {
      name: 'body leading padding',
      position: firstBody.from + 1,
      expected: a1,
      outsideTable: false,
    },
    {
      name: 'a body separator',
      position: requiredValue(firstBodyPipes, 1),
      expected: a2,
      outsideTable: false,
    },
    {
      name: 'padding after a body separator',
      position: requiredValue(firstBodyPipes, 1) + 1,
      expected: a2,
      outsideTable: false,
    },
    {
      name: 'a body trailing pipe',
      position: requiredValue(firstBodyPipes, 3),
      expected: b1,
      outsideTable: false,
    },
    { name: 'a body line end', position: firstBody.to, expected: b1, outsideTable: false },
    {
      name: 'the final row leading pipe',
      position: secondBody.from,
      expected: b1,
      outsideTable: false,
    },
    {
      name: 'the final row leading padding',
      position: secondBody.from + 1,
      expected: b1,
      outsideTable: false,
    },
    {
      name: 'the separator before an empty cell',
      position: requiredValue(secondBodyPipes, 1),
      expected: emptyCursor,
      outsideTable: false,
    },
    {
      name: 'padding before an empty cell',
      position: requiredValue(secondBodyPipes, 1) + 1,
      expected: emptyCursor,
      outsideTable: false,
    },
    {
      name: 'the separator after an empty cell',
      position: requiredValue(secondBodyPipes, 2),
      expected: b3,
      outsideTable: false,
    },
    {
      name: 'padding after an empty cell',
      position: requiredValue(secondBodyPipes, 2) + 1,
      expected: b3,
      outsideTable: false,
    },
    {
      name: 'the final trailing pipe',
      position: requiredValue(secondBodyPipes, 3),
      expected: terminator,
      outsideTable: true,
    },
    {
      name: 'the final table line end',
      position: secondBody.to,
      expected: terminator,
      outsideTable: true,
    },
  ];
}

function buildAllowedCaretCases(
  source: string,
): readonly { readonly name: string; readonly position: number }[] {
  const h1 = requiredIndex(source, 'H1');
  const h2 = requiredIndex(source, 'H2');
  const b3 = requiredIndex(source, 'B3');
  const secondBody = sourceLine(source, '| B1');
  const secondBodyPipes = characterPositions(source, '|', secondBody);
  return [
    { name: 'ordinary prose before the table', position: 2 },
    { name: 'the start of a populated header cell', position: h1 },
    { name: 'the middle of a populated header cell', position: h1 + 1 },
    { name: 'the end of a populated header cell', position: h1 + 2 },
    { name: 'another populated header cell', position: h2 + 1 },
    {
      name: 'the authored empty-cell cursor',
      position: requiredValue(secondBodyPipes, 1) + 2,
    },
    { name: 'the end of the last populated cell', position: b3 + 2 },
    { name: 'the protected blank line after the table', position: secondBody.to + 1 },
    { name: 'ordinary prose after the table', position: requiredIndex(source, 'after') + 2 },
  ];
}

function buildSelectionOverlapCases(source: string): readonly SelectionOverlapCase[] {
  const header = sourceLine(source, '| H1');
  const delimiter = sourceLine(source, '| ---');
  const h1 = requiredIndex(source, 'H1');
  const h2 = requiredIndex(source, 'H2');
  const a2 = requiredIndex(source, 'A2');
  const after = requiredIndex(source, 'after');
  return [
    { name: 'selection around the whole table', from: 0, to: source.length, protected: true },
    { name: 'selection entering the table from above', from: 2, to: h1 + 1, protected: true },
    { name: 'selection leaving the table below', from: a2, to: after + 2, protected: true },
    { name: 'selection across adjacent cells', from: h1 + 1, to: h2 + 1, protected: true },
    {
      name: 'selection of the delimiter row',
      from: delimiter.from,
      to: delimiter.to,
      protected: true,
    },
    {
      name: 'selection across the header newline',
      from: header.to - 1,
      to: delimiter.from + 1,
      protected: true,
    },
    { name: 'selection inside one cell', from: h1, to: h1 + 1, protected: false },
  ];
}

function sourceLine(source: string, text: string): SourceLine {
  const from = requiredIndex(source, text);
  const lineBreak = source.indexOf('\n', from);
  return { from, to: lineBreak === -1 ? source.length : lineBreak };
}

function characterPositions(
  source: string,
  character: string,
  line: SourceLine,
): readonly number[] {
  const positions: number[] = [];
  for (let position = line.from; position < line.to; position += 1) {
    if (source[position] === character) {
      positions.push(position);
    }
  }
  return positions;
}

function requiredIndex(source: string, text: string): number {
  const index = source.indexOf(text);
  if (index === -1) {
    throw new Error(`Missing ${text}`);
  }
  return index;
}

function requiredValue(values: readonly number[], index: number): number {
  const value = values[index];
  if (value === undefined) {
    throw new Error(`Missing value at ${index}`);
  }
  return value;
}

function createView(doc: string, views: EditorView[], selection: number): EditorView {
  const parent = document.createElement('div');
  document.body.append(parent);
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      selection: EditorSelection.cursor(selection),
      extensions: [markdown({ base: markdownLanguage }), markdownTableEditor(config)],
    }),
  });
  views.push(view);
  view.focus();
  return view;
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

function setCursor(view: EditorView, position: number): void {
  view.dispatch({ selection: EditorSelection.cursor(position), userEvent: 'select' });
  view.focus();
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
): MouseEvent {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  target.dispatchEvent(event);
  return event;
}

function key(
  view: EditorView,
  keyValue: 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Backspace' | 'Delete',
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: keyValue,
    bubbles: true,
    cancelable: true,
  });
  view.contentDOM.dispatchEvent(event);
  return event;
}

function visiblePrimaryCursors(view: EditorView): readonly HTMLElement[] {
  return [
    ...view.dom.querySelectorAll<HTMLElement>('.cm-cursor-primary, .cm-markdown-table-cursor'),
  ].filter((element) => getComputedStyle(element).display !== 'none');
}

function mockBounds(target: HTMLElement, row: number, column: number): void {
  const bounds = positionedRect(row, column);
  Object.defineProperty(target, 'getBoundingClientRect', {
    configurable: true,
    value: () => bounds,
  });
}

function positionedRect(row: number, column: number): DOMRect {
  const left = column * 120;
  const top = row * 40;
  return {
    left,
    right: left + 120,
    top,
    bottom: top + 40,
    width: 120,
    height: 40,
    x: left,
    y: top,
    toJSON: (): string => '',
  };
}

function flushEditorMeasure(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

function zeroRect(): DOMRect {
  return {
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON: (): string => '',
  };
}
