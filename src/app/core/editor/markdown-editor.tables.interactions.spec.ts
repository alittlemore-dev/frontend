import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxTree } from '@codemirror/language';
import { EditorSelection, EditorState, StateEffect, Transaction } from '@codemirror/state';
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
const NAVIGATION_SOURCE = [
  'above one',
  'above two',
  '',
  '| ABC | D | EEEE |',
  '| --- | --- | --- |',
  '| xy |  | zzzz |',
  '| q | rr | sss |',
  '',
  'below one',
  'below two',
].join('\n');

interface CellCoordinate {
  readonly row: number;
  readonly column: number;
}

interface HorizontalBoundaryCase {
  readonly name: string;
  readonly from: CellCoordinate;
  readonly direction: 'ArrowLeft' | 'ArrowRight';
  readonly to: CellCoordinate;
}

interface VerticalBoundaryCase {
  readonly name: string;
  readonly from: CellCoordinate;
  readonly direction: 'ArrowUp' | 'ArrowDown';
  readonly to: CellCoordinate;
  readonly offset: number;
}

const horizontalBoundaryCases: readonly HorizontalBoundaryCase[] = [
  {
    name: 'header column 2 to header column 1',
    from: { row: 0, column: 1 },
    direction: 'ArrowLeft',
    to: { row: 0, column: 0 },
  },
  {
    name: 'header column 3 to header column 2',
    from: { row: 0, column: 2 },
    direction: 'ArrowLeft',
    to: { row: 0, column: 1 },
  },
  {
    name: 'body column 2 to body column 1',
    from: { row: 1, column: 1 },
    direction: 'ArrowLeft',
    to: { row: 1, column: 0 },
  },
  {
    name: 'body column 3 to its empty neighbor',
    from: { row: 1, column: 2 },
    direction: 'ArrowLeft',
    to: { row: 1, column: 1 },
  },
  {
    name: 'last body column 3 to column 2',
    from: { row: 2, column: 2 },
    direction: 'ArrowLeft',
    to: { row: 2, column: 1 },
  },
  {
    name: 'first body cell to the preceding header row',
    from: { row: 1, column: 0 },
    direction: 'ArrowLeft',
    to: { row: 0, column: 2 },
  },
  {
    name: 'first last-body cell to the preceding body row',
    from: { row: 2, column: 0 },
    direction: 'ArrowLeft',
    to: { row: 1, column: 2 },
  },
  {
    name: 'header column 1 to header column 2',
    from: { row: 0, column: 0 },
    direction: 'ArrowRight',
    to: { row: 0, column: 1 },
  },
  {
    name: 'header column 2 to header column 3',
    from: { row: 0, column: 1 },
    direction: 'ArrowRight',
    to: { row: 0, column: 2 },
  },
  {
    name: 'body column 1 to its empty neighbor',
    from: { row: 1, column: 0 },
    direction: 'ArrowRight',
    to: { row: 1, column: 1 },
  },
  {
    name: 'empty body cell to body column 3',
    from: { row: 1, column: 1 },
    direction: 'ArrowRight',
    to: { row: 1, column: 2 },
  },
  {
    name: 'last body column 2 to column 3',
    from: { row: 2, column: 1 },
    direction: 'ArrowRight',
    to: { row: 2, column: 2 },
  },
  {
    name: 'final header cell to the first body cell',
    from: { row: 0, column: 2 },
    direction: 'ArrowRight',
    to: { row: 1, column: 0 },
  },
  {
    name: 'final first-body cell to the next body row',
    from: { row: 1, column: 2 },
    direction: 'ArrowRight',
    to: { row: 2, column: 0 },
  },
];

const verticalBoundaryCases: readonly VerticalBoundaryCase[] = [0, 1, 2].flatMap((column) => [
  {
    name: `header to first body in column ${column + 1} at start`,
    from: { row: 0, column },
    direction: 'ArrowDown' as const,
    to: { row: 1, column },
    offset: 0,
  },
  {
    name: `header to first body in column ${column + 1} at offset`,
    from: { row: 0, column },
    direction: 'ArrowDown' as const,
    to: { row: 1, column },
    offset: 2,
  },
  {
    name: `first body to last body in column ${column + 1}`,
    from: { row: 1, column },
    direction: 'ArrowDown' as const,
    to: { row: 2, column },
    offset: 1,
  },
  {
    name: `last body to first body in column ${column + 1}`,
    from: { row: 2, column },
    direction: 'ArrowUp' as const,
    to: { row: 1, column },
    offset: 1,
  },
  {
    name: `first body to header in column ${column + 1} at offset`,
    from: { row: 1, column },
    direction: 'ArrowUp' as const,
    to: { row: 0, column },
    offset: 2,
  },
]);

const everyCell: readonly CellCoordinate[] = [0, 1, 2].flatMap((row) =>
  [0, 1, 2].map((column) => ({ row, column })),
);
const cellsWithInteriorPositions: readonly CellCoordinate[] = [
  { row: 0, column: 0 },
  { row: 0, column: 2 },
  { row: 1, column: 0 },
  { row: 1, column: 2 },
  { row: 2, column: 1 },
  { row: 2, column: 2 },
];
const whitespaceNavigationCases: readonly {
  readonly name: string;
  readonly from: CellCoordinate;
  readonly to: CellCoordinate;
}[] = [
  {
    name: 'a populated header cell',
    from: { row: 0, column: 0 },
    to: { row: 0, column: 1 },
  },
  {
    name: 'an empty body cell',
    from: { row: 1, column: 1 },
    to: { row: 1, column: 2 },
  },
  {
    name: 'a populated body cell',
    from: { row: 2, column: 1 },
    to: { row: 2, column: 2 },
  },
];

interface TopRowArrowUpCase {
  readonly name: string;
  readonly source: string;
  readonly linesAbove: number;
  readonly offset: number;
}

const topRowArrowUpCases: readonly TopRowArrowUpCase[] = buildTopRowArrowUpCases();

describe('Markdown table keyboard and editing interaction matrix', () => {
  const views: EditorView[] = [];
  let originalScrollIntoView: typeof HTMLElement.prototype.scrollIntoView;

  beforeEach(() => {
    originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: jest.fn(),
    });
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
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: originalScrollIntoView,
    });
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

  it.each(horizontalBoundaryCases)(
    'moves $name without requesting hidden-source scrolling',
    ({ from, direction, to }) => {
      const view = createView(NAVIGATION_SOURCE, views);
      const sourceCell = cellMetrics(view, from);
      const targetCell = cellMetrics(view, to);
      const startingPosition = direction === 'ArrowLeft' ? sourceCell.start : sourceCell.end;
      const expectedPosition = direction === 'ArrowLeft' ? targetCell.end : targetCell.start;
      const scrollRequests = captureScrollRequests(view);
      setCursor(view, startingPosition);
      scrollRequests.splice(0);

      const event = key(view, direction);

      expect(event.defaultPrevented).toBe(true);
      expect(view.state.selection.main.head).toBe(expectedPosition);
      expect(view.state.selection.main.assoc).toBe(direction === 'ArrowLeft' ? -1 : 0);
      expect(scrollRequests).toEqual([false]);
      expect(view.dom.querySelectorAll('.cm-markdown-table-cell-active')).toHaveLength(1);
      expect(cell(view, to).classList).toContain('cm-markdown-table-cell-active');
    },
  );

  it.each(verticalBoundaryCases)(
    'moves $name and clamps the visual column to the target content',
    ({ from, direction, to, offset }) => {
      const view = createView(NAVIGATION_SOURCE, views);
      const sourceCell = cellMetrics(view, from);
      const targetCell = cellMetrics(view, to);
      const sourcePosition = sourceCell.start + Math.min(offset, sourceCell.end - sourceCell.start);
      const visualOffset = sourcePosition - sourceCell.start;
      const expectedPosition =
        targetCell.start + Math.min(visualOffset, targetCell.end - targetCell.start);
      const scrollRequests = captureScrollRequests(view);
      setCursor(view, sourcePosition);
      scrollRequests.splice(0);

      const event = key(view, direction);

      expect(event.defaultPrevented).toBe(true);
      expect(view.state.selection.main.head).toBe(expectedPosition);
      expect(scrollRequests).toEqual([false]);
      expect(cell(view, to).classList).toContain('cm-markdown-table-cell-active');
    },
  );

  it.each(cellsWithInteriorPositions)(
    'leaves ordinary character movement inside cell $row:$column to CodeMirror',
    (coordinate) => {
      const view = createView(NAVIGATION_SOURCE, views);
      const metrics = cellMetrics(view, coordinate);
      const position = metrics.start + 1;
      setCursor(view, position);

      const left = key(view, 'ArrowLeft');
      setCursor(view, position);
      const right = key(view, 'ArrowRight');

      expect(left.defaultPrevented).toBe(false);
      expect(right.defaultPrevented).toBe(position === metrics.end);
      expect(view.state.selection.main.head).toBe(position);
    },
  );

  it.each([
    {
      name: 'the first table position with ArrowLeft',
      coordinate: { row: 0, column: 0 },
      key: 'ArrowLeft',
    },
    {
      name: 'the final table position with ArrowRight',
      coordinate: { row: 2, column: 2 },
      key: 'ArrowRight',
    },
  ] as const)(
    'keeps $name inside the grid without any scroll request',
    ({ coordinate, key: keyValue }) => {
      const view = createView(NAVIGATION_SOURCE, views);
      const metrics = cellMetrics(view, coordinate);
      const position = keyValue === 'ArrowLeft' ? metrics.start : metrics.end;
      const scrollRequests = captureScrollRequests(view);
      setCursor(view, position);
      scrollRequests.splice(0);

      const event = key(view, keyValue);

      expect(event.defaultPrevented).toBe(true);
      expect(view.state.selection.main).toEqual(EditorSelection.cursor(position));
      expect(scrollRequests).toEqual([]);
      expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
    },
  );

  it('does not trap ArrowDown at the final grid edge', () => {
    const view = createView(NAVIGATION_SOURCE, views);
    const position = cellMetrics(view, { row: 2, column: 1 }).start;
    setCursor(view, position);

    const event = key(view, 'ArrowDown');

    expect(event.defaultPrevented).toBe(false);
    expect(view.state.selection.main.head).toBe(position);
  });

  it.each(topRowArrowUpCases)(
    'leaves $name deterministically for the exact adjacent visible line',
    async ({ source, linesAbove, offset }) => {
      for (let repetition = 0; repetition < 3; repetition += 1) {
        const view = createView(source, views);
        const header = cellMetrics(view, { row: 0, column: 0 });
        const initialPosition = header.start + offset;
        const scrollRequests = captureScrollRequests(view);
        setCursor(view, initialPosition);
        view.requestMeasure();
        await flushEditorMeasure();
        scrollRequests.splice(0);

        const event = key(view, 'ArrowUp');
        const expectedPosition =
          linesAbove === 0 ? initialPosition : adjacentLinePosition(view.state, linesAbove, offset);

        expect(event.defaultPrevented).toBe(true);
        expect(view.state.selection.main).toEqual(EditorSelection.cursor(expectedPosition));
        expect(scrollRequests).toEqual(linesAbove === 0 ? [] : [true]);
        if (linesAbove === 0) {
          expect(cell(view, { row: 0, column: 0 }).classList).toContain(
            'cm-markdown-table-cell-active',
          );
        } else {
          expect(view.state.doc.lineAt(expectedPosition).number).toBe(linesAbove);
          expect(view.dom.querySelectorAll('.cm-markdown-table-cell-active')).toHaveLength(0);
        }
      }
    },
  );

  it.each([
    {
      name: 'one line above',
      line: 3,
      direction: 'ArrowDown',
      jumpTarget: { row: 0, column: 0 },
      renderedTarget: { row: 0, column: 0 },
      expectedLine: null,
    },
    {
      name: 'two lines above',
      line: 2,
      direction: 'ArrowDown',
      jumpTarget: { row: 0, column: 0 },
      renderedTarget: null,
      expectedLine: 3,
    },
    {
      name: 'one line below',
      line: 8,
      direction: 'ArrowUp',
      jumpTarget: { row: 2, column: 0 },
      renderedTarget: { row: 2, column: 0 },
      expectedLine: null,
    },
    {
      name: 'two lines below',
      line: 9,
      direction: 'ArrowUp',
      jumpTarget: { row: 2, column: 0 },
      renderedTarget: null,
      expectedLine: 8,
    },
  ] as readonly {
    readonly name: string;
    readonly line: number;
    readonly direction: 'ArrowUp' | 'ArrowDown';
    readonly jumpTarget: CellCoordinate;
    readonly renderedTarget: CellCoordinate | null;
    readonly expectedLine: number | null;
  }[])(
    'repairs a geometry jump from $name without selecting hidden syntax',
    ({ line, direction, jumpTarget, renderedTarget, expectedLine }) => {
      const view = createView(NAVIGATION_SOURCE, views);
      const ordinaryLine = view.state.doc.line(line);
      const jumpPosition = cellMetrics(view, jumpTarget).start;
      const expectedPosition =
        renderedTarget === null
          ? view.state.doc.line(requiredNumber(expectedLine)).from
          : cellMetrics(view, renderedTarget).start;
      setCursor(view, ordinaryLine.from);
      jest.spyOn(view, 'moveVertically').mockReturnValue(EditorSelection.cursor(jumpPosition));
      const scrollRequests = captureScrollRequests(view);
      scrollRequests.splice(0);

      const event = key(view, direction);

      expect(event.defaultPrevented).toBe(true);
      expect(view.state.selection.main.head).toBe(expectedPosition);
      expect(scrollRequests).toEqual([renderedTarget !== null ? false : true]);
      if (renderedTarget !== null) {
        expect(cell(view, renderedTarget).classList).toContain('cm-markdown-table-cell-active');
      }
    },
  );

  it.each(everyCell)('does not turn Space into navigation in cell $row:$column', (coordinate) => {
    const view = createView(NAVIGATION_SOURCE, views);
    const position = cellMetrics(view, coordinate).start;
    setCursor(view, position);

    const event = key(view, ' ');

    expect(event.defaultPrevented).toBe(false);
    expect(view.state.selection.main.head).toBe(position);
    expect(cell(view, coordinate).classList).toContain('cm-markdown-table-cell-active');
  });

  it.each([
    { name: 'between two characters', source: 'AB', offset: 1, spaces: 1 },
    { name: 'at the start of text', source: 'AB', offset: 0, spaces: 1 },
    { name: 'at the end of text', source: 'AB', offset: 2, spaces: 1 },
    { name: 'at the end of text twice', source: 'AB', offset: 2, spaces: 2 },
    { name: 'at the end of text three times', source: 'AB', offset: 2, spaces: 3 },
    { name: 'inside Cyrillic text', source: 'Привет', offset: 3, spaces: 1 },
    { name: 'beside an emoji', source: 'A🧭B', offset: 3, spaces: 1 },
    { name: 'inside inline Markdown', source: '**bold**', offset: 3, spaces: 1 },
  ])(
    'inserts a literal Space $name and keeps the same cell active',
    ({ source, offset, spaces }) => {
      const doc = `| ${source} | next |\n| --- | --- |\n| body | value |`;
      const view = createView(doc, views);
      const start = cellMetrics(view, { row: 0, column: 0 }).start;
      const position = start + offset;
      setCursor(view, position);

      for (let count = 0; count < spaces; count += 1) {
        typeText(view, ' ');
      }

      expect(view.state.sliceDoc(position, position + spaces)).toBe(' '.repeat(spaces));
      expect(view.state.selection.main.head).toBe(position + spaces);
      expect(cell(view, { row: 0, column: 0 }).classList).toContain(
        'cm-markdown-table-cell-active',
      );
      expect(cell(view, { row: 0, column: 1 }).textContent).toContain('next');
    },
  );

  it.each([
    { name: 'header', row: 0, column: 0 },
    { name: 'body', row: 1, column: 0 },
    { name: 'last body', row: 2, column: 0 },
  ])(
    'keeps sequential words separated by spaces in an initially empty $name cell',
    ({ row, column }) => {
      const doc = '|  | fixed |\n| --- | --- |\n|  | fixed |\n|  | fixed |';
      const view = createView(doc, views);
      setCursor(view, cellMetrics(view, { row, column }).start);

      for (const character of 'one two  three') {
        typeText(view, character);
      }

      expect(cell(view, { row, column }).textContent).toContain('one two  three');
      expect(cell(view, { row, column }).classList).toContain('cm-markdown-table-cell-active');
      expect(view.dom.querySelectorAll('.cm-markdown-table-cell-active')).toHaveLength(1);
    },
  );

  it.each([
    {
      name: 'one source-space cell',
      source: '| | fixed |\n| --- | --- |\n| | fixed |',
    },
    {
      name: 'unspaced empty cell',
      source: '|| fixed |\n| --- | --- |\n|| fixed |',
    },
  ])('types words and spaces in every compact $name without changing its pipes', ({ source }) => {
    const view = createView(source, views);
    const pipeCount = source.split('|').length - 1;

    for (const row of [0, 1]) {
      const target = cellMetrics(view, { row, column: 0 });
      setCursor(view, target.start);
      for (const character of 'one two') {
        typeText(view, character);
      }

      expect(cell(view, { row, column: 0 }).textContent).toContain('one two');
      expect(view.state.doc.toString().split('|').length - 1).toBe(pipeCount);
      expect(cell(view, { row, column: 0 }).classList).toContain('cm-markdown-table-cell-active');
    }
  });

  it('materializes trailing padding when Space follows an unpadded cell', () => {
    const source = '|one| fixed |\n| --- | --- |\n|body| fixed |';
    const view = createView(source, views);
    const first = cellMetrics(view, { row: 0, column: 0 });
    setCursor(view, first.end);

    typeText(view, ' ');

    expect(view.state.doc.toString()).toBe('|one  | fixed |\n| --- | --- |\n|body| fixed |');
    expect(view.state.selection.main.head).toBe(first.end + 1);
    expect(cell(view, { row: 0, column: 0 }).textContent).toContain('one ');
  });

  it.each([
    {
      name: 'an unspaced empty cell',
      source: '|| fixed |\n| --- | --- |\n|| fixed |',
      expectedHeader: '|  X | fixed |',
    },
    {
      name: 'a one-space empty cell',
      source: '| | fixed |\n| --- | --- |\n| | fixed |',
      expectedHeader: '|  X | fixed |',
    },
  ])('preserves a leading authored Space in $name', ({ source, expectedHeader }) => {
    const view = createView(source, views);
    const target = cellMetrics(view, { row: 0, column: 0 });
    setCursor(view, target.start);

    typeText(view, ' ');
    typeText(view, 'X');

    expect(view.state.doc.line(1).text).toBe(expectedHeader);
    expect(cell(view, { row: 0, column: 0 }).textContent).toContain(' X');
    expect(cell(view, { row: 0, column: 0 }).classList).toContain('cm-markdown-table-cell-active');
  });

  it('preserves several spaces inserted together at both compact cell edges', () => {
    const source = '|| fixed |\n| --- | --- |\n|| fixed |';
    const view = createView(source, views);
    const target = cellMetrics(view, { row: 0, column: 0 });
    setCursor(view, target.start);

    typeText(view, '  ');
    typeText(view, 'word');
    typeText(view, '  ');
    typeText(view, 'tail');

    expect(cell(view, { row: 0, column: 0 }).textContent).toContain('  word  tail');
    expect(view.state.doc.line(1).text).toBe('|   word  tail | fixed |');
  });

  it.each([
    {
      name: 'rows with a leading pipe only',
      source: '|first|last\n|---|---\n|body|tail',
    },
    {
      name: 'rows without outer pipes',
      source: 'first|last\n---|---\nbody|tail',
    },
  ])('keeps Space editable at the unpadded line end of $name', ({ source }) => {
    const view = createView(source, views);
    const target = cellMetrics(view, { row: 1, column: 1 });
    setCursor(view, target.end);

    for (const character of ' one') {
      typeText(view, character);
    }

    expect(cell(view, { row: 1, column: 1 }).textContent).toContain('tail one');
    expect(view.state.doc.lineAt(view.state.selection.main.head).text).toContain('tail one ');
    expect(cell(view, { row: 1, column: 1 }).classList).toContain('cm-markdown-table-cell-active');
  });

  it.each(everyCell)(
    'keeps a trailing Space available for the next character in cell $row:$column',
    (coordinate) => {
      const view = createView(NAVIGATION_SOURCE, views);
      const metrics = cellMetrics(view, coordinate);
      setCursor(view, metrics.end);

      typeText(view, ' ');
      typeText(view, 'X');

      expect(cell(view, coordinate).textContent).toContain(`${metrics.text} X`);
      expect(cell(view, coordinate).classList).toContain('cm-markdown-table-cell-active');
    },
  );

  it.each(whitespaceNavigationCases)(
    'keeps ArrowLeft inside $name after Space and lets ArrowRight leave only at its new end',
    ({ from, to }) => {
      const view = createView(NAVIGATION_SOURCE, views);
      const original = cellMetrics(view, from);
      setCursor(view, original.end);
      typeText(view, ' ');
      const positionAfterSpace = original.end + 1;

      const left = key(view, 'ArrowLeft');

      expect(left.defaultPrevented).toBe(false);
      expect(view.state.selection.main.head).toBe(positionAfterSpace);
      expect(cell(view, from).classList).toContain('cm-markdown-table-cell-active');

      const right = key(view, 'ArrowRight');

      expect(right.defaultPrevented).toBe(true);
      expect(view.state.selection.main.head).toBe(cellMetrics(view, to).start);
      expect(cell(view, to).classList).toContain('cm-markdown-table-cell-active');
    },
  );

  it.each(whitespaceNavigationCases)(
    'keeps $name addressable through Space, Tab, and Shift+Tab',
    ({ from, to }) => {
      const view = createView(NAVIGATION_SOURCE, views);
      const original = cellMetrics(view, from);
      setCursor(view, original.end);
      typeText(view, ' ');

      expect(key(view, 'Tab').defaultPrevented).toBe(true);
      expect(view.state.selection.main.head).toBe(cellMetrics(view, to).start);
      expect(key(view, 'Tab', { shiftKey: true }).defaultPrevented).toBe(true);
      expect(view.state.selection.main.head).toBe(cellMetrics(view, from).start);
      expect(cell(view, from).classList).toContain('cm-markdown-table-cell-active');
    },
  );

  it.each(whitespaceNavigationCases)(
    'deletes the authored trailing Space from $name without touching its separator',
    ({ from }) => {
      const view = createView(NAVIGATION_SOURCE, views);
      const originalDocument = view.state.doc.toString();
      const original = cellMetrics(view, from);
      setCursor(view, original.end);
      typeText(view, ' ');
      view.dispatch({
        selection: EditorSelection.range(original.end, original.end + 1),
        userEvent: 'select',
      });

      typeText(view, '');

      expect(view.state.doc.toString()).toBe(originalDocument);
      expect(view.state.selection.main.head).toBe(original.end);
      expect(cell(view, from).classList).toContain('cm-markdown-table-cell-active');
    },
  );

  it('replaces a same-cell text selection with Space without entering structural padding', () => {
    const source = '| alpha | beta |\n| --- | --- |\n| one | two |';
    const view = createView(source, views);
    const alpha = cellMetrics(view, { row: 0, column: 0 });
    view.dispatch({
      selection: EditorSelection.range(alpha.start + 1, alpha.end - 1),
      userEvent: 'select',
    });

    typeText(view, ' ');

    expect(cell(view, { row: 0, column: 0 }).textContent).toContain('a a');
    expect(cell(view, { row: 0, column: 1 }).textContent).toContain('beta');
  });

  it('rejects a Space replacement that crosses a structural cell separator', () => {
    const source = '| alpha | beta |\n| --- | --- |\n| one | two |';
    const view = createView(source, views);
    const alpha = cellMetrics(view, { row: 0, column: 0 });
    const beta = cellMetrics(view, { row: 0, column: 1 });
    view.dispatch({
      selection: EditorSelection.range(alpha.end - 1, beta.start + 1),
      userEvent: 'select',
    });

    typeText(view, ' ');

    expect(view.state.doc.toString()).toBe(source);
    expect(view.state.selection.main).toEqual(EditorSelection.range(alpha.end - 1, beta.start + 1));
  });

  it.each(
    everyCell.flatMap((coordinate) => [
      { ...coordinate, name: 'Tab', key: 'Tab', shiftKey: false },
      { ...coordinate, name: 'Shift+Tab', key: 'Tab', shiftKey: true },
      { ...coordinate, name: 'Enter', key: 'Enter', shiftKey: false },
      { ...coordinate, name: 'Shift+Enter', key: 'Enter', shiftKey: true },
    ]),
  )(
    'handles $name from cell $row:$column without losing table validity',
    async ({ row, column, key: keyValue, shiftKey }) => {
      const view = createView(NAVIGATION_SOURCE, views);
      view.requestMeasure();
      await flushEditorMeasure();
      const originalRows = renderedRows(view);
      const position = cellMetrics(view, { row, column }).start;
      setCursor(view, position);

      const event = key(view, keyValue, { shiftKey });

      if (keyValue === 'Tab' && shiftKey && row === 0 && column === 0) {
        expect(event.defaultPrevented).toBe(false);
        expect(view.state.selection.main.head).toBe(position);
        return;
      }
      expect(event.defaultPrevented).toBe(true);
      expect(view.dom.querySelector('.cm-markdown-table-editor')).not.toBeNull();
      expect(view.dom.querySelectorAll('.cm-markdown-table-cell-active')).toHaveLength(1);
      if (keyValue === 'Enter' && shiftKey) {
        expect(view.state.doc.toString()).toContain('<br>');
        expect(renderedRows(view)).toBe(originalRows);
      } else {
        expect(renderedRows(view)).toBeGreaterThanOrEqual(originalRows);
      }
    },
  );

  it.each(
    everyCell.flatMap((coordinate) => [
      { ...coordinate, key: 'Backspace' as const, boundary: 'start' as const },
      { ...coordinate, key: 'Delete' as const, boundary: 'end' as const },
    ]),
  )(
    'protects $key at the $boundary of cell $row:$column',
    ({ row, column, key: keyValue, boundary }) => {
      const view = createView(NAVIGATION_SOURCE, views);
      const metrics = cellMetrics(view, { row, column });
      const position = boundary === 'start' ? metrics.start : metrics.end;
      const original = view.state.doc.toString();
      setCursor(view, position);

      const event = key(view, keyValue);

      expect(event.defaultPrevented).toBe(true);
      expect(view.state.doc.toString()).toBe(original);
      expect(view.state.selection.main.head).toBe(position);
    },
  );

  it.each([
    { name: 'Backspace in the middle', key: 'Backspace', offset: 2 },
    { name: 'Delete in the middle', key: 'Delete', offset: 1 },
  ] as const)(
    'leaves $name of cell text to the normal editor command',
    ({ key: keyValue, offset }) => {
      const view = createView(NAVIGATION_SOURCE, views);
      const metrics = cellMetrics(view, { row: 0, column: 0 });
      const position = metrics.start + offset;
      setCursor(view, position);

      const event = key(view, keyValue);

      expect(event.defaultPrevented).toBe(false);
      expect(view.state.selection.main.head).toBe(position);
    },
  );

  it.each(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'] as const)(
    'does not collapse a non-empty selection for %s',
    (keyValue) => {
      const view = createView(NAVIGATION_SOURCE, views);
      const metrics = cellMetrics(view, { row: 0, column: 0 });
      const selection = EditorSelection.range(metrics.start, metrics.end);
      view.dispatch({ selection, userEvent: 'select' });

      const event = key(view, keyValue);

      expect(event.defaultPrevented).toBe(false);
      expect(view.state.selection.main).toEqual(selection);
    },
  );

  it.each(
    (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'] as const).flatMap((keyValue) => [
      { keyValue, modifier: 'Shift', options: { shiftKey: true } },
      { keyValue, modifier: 'Alt', options: { altKey: true } },
      { keyValue, modifier: 'Control', options: { ctrlKey: true } },
      { keyValue, modifier: 'Meta', options: { metaKey: true } },
    ]),
  )('preserves native $modifier+$keyValue behavior inside a cell', ({ keyValue, options }) => {
    const view = createView(NAVIGATION_SOURCE, views);
    const metrics = cellMetrics(view, { row: 0, column: 0 });
    const position = metrics.start + 1;
    setCursor(view, position);

    const event = key(view, keyValue, options);

    expect(event.defaultPrevented).toBe(false);
    expect(view.state.selection.main).toEqual(EditorSelection.cursor(position));
    expect(view.state.field(markdownTableSelectionState).anchor).toBeNull();
  });

  it.each(['Home', 'End', 'PageUp', 'PageDown', 'Insert'] as const)(
    'does not hijack %s inside a table cell',
    (keyValue) => {
      const view = createView(NAVIGATION_SOURCE, views);
      const position = cellMetrics(view, { row: 1, column: 0 }).start;
      setCursor(view, position);

      const event = key(view, keyValue);

      expect(event.defaultPrevented).toBe(false);
      expect(view.state.selection.main.head).toBe(position);
    },
  );

  it.each(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter'] as const)(
    'does not run the table shortcut for composing %s input',
    (keyValue) => {
      const view = createView(NAVIGATION_SOURCE, views);
      const metrics = cellMetrics(view, { row: 0, column: 1 });
      setCursor(view, metrics.start);
      const composing = jest.spyOn(view, 'composing', 'get').mockReturnValue(true);

      const event = key(view, keyValue, { isComposing: true });

      expect(event.defaultPrevented).toBe(false);
      expect(view.state.selection.main.head).toBe(metrics.start);
      composing.mockRestore();
    },
  );

  it('clears a rectangular selection with Escape before any outer surface handles it', () => {
    const view = createView(NAVIGATION_SOURCE, views);
    selectCells(view, { row: 1, column: 0 }, { row: 2, column: 2 });

    const event = key(view, 'Escape');

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.field(markdownTableSelectionState).anchor).toBeNull();
    expect(view.dom.querySelectorAll('.cm-markdown-table-cell-selected')).toHaveLength(0);
  });
});

function createView(doc: string, views: EditorView[]): EditorView {
  const parent = document.createElement('div');
  document.body.append(parent);
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [markdown({ base: markdownLanguage }), markdownTableEditor(config)],
    }),
  });
  views.push(view);
  view.focus();
  return view;
}

function cell(view: EditorView, coordinate: CellCoordinate): HTMLElement {
  const selector = `[data-table-cell="true"][data-row="${coordinate.row}"][data-column="${coordinate.column}"]`;
  let result = view.dom.querySelector<HTMLElement>(selector);
  if (result === null) {
    const targetPosition = tableCellLinePosition(view.state, coordinate);
    view.dispatch({
      selection: EditorSelection.cursor(targetPosition),
      scrollIntoView: true,
      userEvent: 'select',
    });
    result = view.dom.querySelector<HTMLElement>(selector);
  }
  if (result === null) {
    throw new Error(`Missing cell ${coordinate.row}:${coordinate.column}`);
  }
  return result;
}

function tableCellLinePosition(state: EditorState, coordinate: CellCoordinate): number {
  const cursor = syntaxTree(state).cursor();
  do {
    if (cursor.name === 'Table') {
      const headerLine = state.doc.lineAt(cursor.from);
      const lineNumber = headerLine.number + (coordinate.row === 0 ? 0 : coordinate.row + 1);
      return state.doc.line(Math.min(lineNumber, state.doc.lines)).from;
    }
  } while (cursor.next());
  return state.selection.main.head;
}

function cellMetrics(
  view: EditorView,
  coordinate: CellCoordinate,
): { readonly start: number; readonly end: number; readonly text: string } {
  const target = cell(view, coordinate);
  const start = Number(target.dataset['cellFrom']);
  const text = target.dataset['emptyCell'] === 'true' ? '' : (target.textContent ?? '');
  return {
    start,
    end: start + text.length,
    text,
  };
}

function setCursor(view: EditorView, position: number): void {
  view.dispatch({ selection: EditorSelection.cursor(position), userEvent: 'select' });
  view.focus();
}

function typeText(view: EditorView, text: string): void {
  const selection = view.state.selection.main;
  view.dispatch({
    changes: { from: selection.from, to: selection.to, insert: text },
    selection: EditorSelection.cursor(selection.from + text.length),
    annotations: Transaction.userEvent.of('input.type'),
    scrollIntoView: true,
  });
}

function key(
  view: EditorView,
  keyValue: string,
  options: {
    readonly shiftKey?: boolean;
    readonly altKey?: boolean;
    readonly ctrlKey?: boolean;
    readonly metaKey?: boolean;
    readonly isComposing?: boolean;
  } = {},
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: keyValue,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  view.contentDOM.dispatchEvent(event);
  return event;
}

function captureScrollRequests(view: EditorView): boolean[] {
  const requests: boolean[] = [];
  view.dispatch({
    effects: StateEffect.appendConfig.of(
      EditorView.updateListener.of((update) => {
        requests.push(...update.transactions.map((transaction) => transaction.scrollIntoView));
      }),
    ),
  });
  return requests;
}

function buildTopRowArrowUpCases(): readonly TopRowArrowUpCase[] {
  return [false, true].flatMap((populated) =>
    [2, 4].flatMap((semanticRows) =>
      [1, 2, 4].flatMap((columnCount) =>
        [0, 1, 3].flatMap((linesAbove) =>
          (populated ? [0, 2, 4] : [0]).map((offset) => ({
            name: `${populated ? 'populated' : 'empty'} top-left cell at offset ${offset}, ${semanticRows} rows, ${columnCount} columns, ${linesAbove} lines above`,
            source: topRowArrowUpSource({
              populated,
              semanticRows,
              columnCount,
              linesAbove,
            }),
            linesAbove,
            offset,
          })),
        ),
      ),
    ),
  );
}

function topRowArrowUpSource(options: {
  readonly populated: boolean;
  readonly semanticRows: number;
  readonly columnCount: number;
  readonly linesAbove: number;
}): string {
  const header = Array.from({ length: options.columnCount }, (_, column) =>
    column === 0 ? (options.populated ? 'ABCD' : '') : `H${column + 1}`,
  );
  const delimiter = Array.from({ length: options.columnCount }, () => '---');
  const body = Array.from({ length: options.semanticRows - 1 }, (_, row) =>
    Array.from({ length: options.columnCount }, (_, column) => `R${row + 1}C${column + 1}`),
  );
  const table = [header, delimiter, ...body].map((cells) => `| ${cells.join(' | ')} |`).join('\n');
  const linesAbove = Array.from(
    { length: options.linesAbove },
    (_, index) => `above line ${index + 1}`,
  );
  return [...linesAbove, table].join('\n');
}

function adjacentLinePosition(state: EditorState, lineNumber: number, column: number): number {
  const line = state.doc.line(lineNumber);
  return line.from + Math.min(column, line.length);
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

function renderedRows(view: EditorView): number {
  return view.dom.querySelectorAll('.cm-markdown-table-row').length;
}

function requiredNumber(value: number | null): number {
  if (value === null) {
    throw new Error('Missing expected line');
  }
  return value;
}

function selectCells(view: EditorView, anchor: CellCoordinate, head: CellCoordinate): void {
  pointer(cell(view, anchor), 'pointerdown');
  pointer(cell(view, head), 'pointermove');
  pointer(cell(view, head), 'pointerup');
}

function pointer(target: HTMLElement, type: 'pointerdown' | 'pointermove' | 'pointerup'): void {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  target.dispatchEvent(event);
}
