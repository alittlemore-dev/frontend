import { history, redo, undo } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { EditorSelection, EditorState, StateEffect, Transaction } from '@codemirror/state';
import { EditorView, lineNumbers } from '@codemirror/view';
import {
  markdownTableEditor,
  markdownTableSelectionState,
  markdownTableSelectionTsv,
  pasteMarkdownTableText,
  runMarkdownTableAction,
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
const VALID_TABLE = '| Name | Value |\n| --- | ---: |\n| A | 2 |\n| B | 10 |';
const ROW_DRAG_SOURCE = '| H |\n| --- |\n| A |\n| B |\n| C |';
const COLUMN_DRAG_SOURCE = '| A | B | C | D |\n| :--- | :---: | ---: | --- |\n| 1 | 2 | 3 | 4 |';
const TABLE_CELL_CLEARING_CASES = [
  {
    name: 'the only header cell at the document start and end',
    source: '| ASCII |\n| --- |',
    row: 0,
    column: 0,
    content: 'ASCII',
    replacement: 'rewritten',
  },
  {
    name: 'the first compact header cell at the document start',
    source: '|Русский|middle|final|\n|---|---|---|\n|one|two|three|\n\nafter',
    row: 0,
    column: 0,
    content: 'Русский',
    replacement: 'Новый',
  },
  {
    name: 'a middle header cell without outer pipes at the document end',
    source: 'before\n\nfirst | naïve | final\n--- | --- | ---\none | two | three',
    row: 0,
    column: 1,
    content: 'naïve',
    replacement: 'café',
  },
  {
    name: 'the final header cell between ordinary lines',
    source:
      'before\n\n| first | middle | punctuation!? |\n| --- | --- | --- |\n| one | two | three |\n\nafter',
    row: 0,
    column: 2,
    content: 'punctuation!?',
    replacement: 'braces{}',
  },
  {
    name: 'the first cell of the first body row',
    source: '| H1 | H2 |\n| --- | --- |\n| **bold** | value |\n| final | row |',
    row: 1,
    column: 0,
    content: '**bold**',
    replacement: '_italic_',
  },
  {
    name: 'a middle cell of the first body row containing an escaped pipe',
    source: '| H1 | H2 | H3 |\n| --- | --- | --- |\n| left | a\\|b | right |\n\noutside',
    row: 1,
    column: 1,
    content: 'a\\|b',
    replacement: 'x\\|y',
  },
  {
    name: 'the final cell of a middle body row without a trailing pipe',
    source:
      'before\n\nH1 | H2 | H3\n--- | --- | ---\nA1 | A2 | A3\nB1 | B2 | emoji 🧭\nC1 | C2 | C3\n\nafter',
    emptySource:
      'before\n\nH1 | H2 | H3\n--- | --- | ---\nA1 | A2 | A3\nB1 | B2 |  |\nC1 | C2 | C3\n\nafter',
    row: 2,
    column: 2,
    content: 'emoji 🧭',
    replacement: '👩‍💻',
  },
  {
    name: 'the first cell of the final body row without outer pipes',
    source: 'H1 | H2\n--- | ---\nA1 | A2\n`code` | final',
    emptySource: 'H1 | H2\n--- | ---\nA1 | A2\n| | final',
    row: 2,
    column: 0,
    content: '`code`',
    replacement: 'plain',
  },
  {
    name: 'the final compact cell of the final body row at the document end',
    source: '|H1|H2|H3|\n|---|---|---|\n|A1|A2|A3|\n|B1|B2|日本語|',
    row: 2,
    column: 2,
    content: '日本語',
    replacement: '更新',
  },
] as const;
const TABLE_CELL_CLEARING_OPERATIONS = [
  {
    name: 'backward deletion',
    userEvent: 'delete.backward',
    selection: 'end',
  },
  {
    name: 'forward deletion',
    userEvent: 'delete.forward',
    selection: 'start',
  },
  {
    name: 'forward selected-content deletion',
    userEvent: 'delete.selection',
    selection: 'forward',
  },
  {
    name: 'reverse selected-content deletion',
    userEvent: 'delete.selection',
    selection: 'reverse',
  },
  {
    name: 'clipboard cut deletion',
    userEvent: 'delete.cut',
    selection: 'forward',
  },
] as const;
const DELIMITER_LAYOUT_CASES = [
  {
    name: 'header-only table at the document start',
    source: '| H |\n| --- |',
    rows: 1,
    columns: 1,
    width: '48rem',
    containerClass: '',
  },
  {
    name: 'two-column table between ordinary lines in a narrow modal',
    source: 'before\n\n| H1 | H2 |\n| --- | ---: |\n| A1 | A2 |\n\nafter',
    rows: 2,
    columns: 2,
    width: '22rem',
    containerClass: 'modal-body',
  },
  {
    name: 'uneven many-column table at the document end in fullscreen',
    source:
      'before\n\n| H1 | H2 | H3 | H4 |\n| --- | :---: | ---: | --- |\n| A1 |\n| B1 | B2 | B3 | B4 |',
    rows: 3,
    columns: 4,
    width: '100vw',
    containerClass: 'markdown-editor-fullscreen',
  },
] as const;
const POINTER_TYPES = ['mouse', 'touch', 'pen'] as const;
const ROW_DRAG_CASES = POINTER_TYPES.flatMap((pointerType) =>
  Array.from({ length: 4 }, (_, sourceIndex) =>
    Array.from({ length: 5 }, (_, targetGap) => {
      const rows = reorderValues(['H', 'A', 'B', 'C'], [sourceIndex], targetGap);
      return {
        name: `${pointerType} row ${sourceIndex + 1} to gap ${targetGap}`,
        pointerType,
        sourceIndex,
        targetIndex: Math.min(targetGap, 3),
        placement: targetGap === 4 ? 'after' : 'before',
        expected: singleColumnTable(rows),
        moved: remappedIndices([sourceIndex], targetGap, 4),
      } as const;
    }),
  ).flat(),
);
const COLUMN_DRAG_CASES = POINTER_TYPES.flatMap((pointerType) =>
  Array.from({ length: 4 }, (_, sourceIndex) =>
    Array.from({ length: 5 }, (_, targetGap) => {
      const order = reorderValues([0, 1, 2, 3], [sourceIndex], targetGap);
      return {
        name: `${pointerType} column ${sourceIndex + 1} to gap ${targetGap}`,
        pointerType,
        sourceIndex,
        targetIndex: Math.min(targetGap, 3),
        placement: targetGap === 4 ? 'after' : 'before',
        expected: reorderedColumnTable(order),
        moved: remappedIndices([sourceIndex], targetGap, 4),
      } as const;
    }),
  ).flat(),
);
const originalScrollIntoView = Reflect.get(HTMLElement.prototype, 'scrollIntoView') as
  HTMLElement['scrollIntoView'] | undefined;

describe('Markdown table editor extension', () => {
  const views: EditorView[] = [];

  afterEach(() => {
    views.splice(0).forEach((view) => view.destroy());
    document.body.replaceChildren();
    if (originalScrollIntoView === undefined) {
      Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
    } else {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        configurable: true,
        value: originalScrollIntoView,
      });
    }
  });

  it('renders only valid Lezer Table nodes as an accessible, normalized responsive grid', () => {
    const view = createView(
      '| A | B | C |\n| --- | --- | --- |\n| one |\n| two | three | extra |\n\n| malformed |\n| nope |',
      views,
    );

    const table = view.dom.querySelector<HTMLElement>('[role="table"]');
    expect(table?.getAttribute('aria-label')).toBe('Table');
    expect(table?.querySelectorAll('[role="row"]')).toHaveLength(3);
    expect(table?.querySelectorAll('[role="columnheader"]')).toHaveLength(3);
    const rows = table?.querySelectorAll<HTMLElement>('[role="row"]') ?? [];
    expect(
      [...rows].map((row) => row.querySelectorAll('[role="cell"], [role="columnheader"]').length),
    ).toEqual([3, 3, 3]);
    expect(getComputedStyle(table!).display).toBe('block');
    expect(getComputedStyle(rows[0]!).display).toBe('grid');
    expect(view.dom.querySelector('.cm-markdown-table-delimiter')).toBeNull();
    expect(getComputedStyle(cell(view, 1, 0)).display).toBe('block');
    expect(view.dom.querySelectorAll('.cm-markdown-table-editor')).toHaveLength(1);
    expect(view.state.doc.toString()).toContain('| malformed |\n| nope |');
  });

  it.each([
    '| malformed |\n| nope |',
    '| A | B |\n| -- | -- |\n| one | two |',
    'ordinary | prose\nwithout a delimiter',
  ])('does not expose drag hit areas for malformed table source %#', (source) => {
    const view = createView(source, views);

    expect(view.dom.querySelector('.cm-markdown-table-editor')).toBeNull();
    expect(view.dom.querySelector('.cm-markdown-table-row-handle')).toBeNull();
    expect(view.dom.querySelector('.cm-markdown-table-column-handle')).toBeNull();
  });

  it('keeps only semantic cells in each visible grid row', () => {
    const view = createView(VALID_TABLE, views);
    const rows = [
      ...view.dom.querySelectorAll<HTMLElement>(
        '.cm-markdown-table-row:not(.cm-markdown-table-delimiter)',
      ),
    ];

    for (const row of rows) {
      const flowChildren = [...row.childNodes].filter((node) => {
        if (node instanceof HTMLElement) {
          if (node.matches('[data-table-cell="true"]')) {
            return false;
          }
          const style = getComputedStyle(node);
          return style.display !== 'none' && style.position !== 'absolute';
        }
        return (node.textContent?.length ?? 0) > 0;
      });

      expect(flowChildren).toEqual([]);
      expect(row.querySelectorAll(':scope > [data-table-cell="true"]')).toHaveLength(2);
    }
  });

  it('uses a full-width editor-native grid with stable rows and quiet edge controls', () => {
    const view = createView('| H | V |\n| --- | --- |\n| filled |  |\n|  | value |', views);
    const table = view.dom.querySelector<HTMLElement>('.cm-markdown-table-editor')!;
    const populatedCell = cell(view, 1, 0);
    const emptyCell = cell(view, 1, 1);
    const addRow = button(view, 'Add row');

    expect(getComputedStyle(table).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(table).borderTopWidth).toBe('0px');
    expect(getComputedStyle(table).borderRadius).toBe('0px');
    expect(getComputedStyle(table).boxShadow).toBe('none');
    expect(getComputedStyle(table).width).toBe('100%');
    expect(getComputedStyle(table).maxWidth).toBe('100%');
    expect(getComputedStyle(table).minWidth).toBe('0');
    expect(
      getComputedStyle(table.querySelector<HTMLElement>('.cm-markdown-table-row')!).padding,
    ).toBe('0px');
    expect(getComputedStyle(populatedCell).minHeight).toBe('2.5rem');
    expect(getComputedStyle(emptyCell).minHeight).toBe('2.5rem');
    expect(getComputedStyle(populatedCell).minWidth).toBe('0');
    expect(getComputedStyle(addRow).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(addRow).borderTopWidth).toBe('0px');
  });

  it.each(DELIMITER_LAYOUT_CASES)(
    'renders one compact inert header delimiter without changing $name',
    ({ source, rows, columns, width, containerClass }) => {
      const view = createView(source, views, true);
      const original = view.state.doc.toString();
      const container = view.dom.parentElement!;
      container.className = containerClass;
      container.style.width = width;
      const table = view.dom.querySelector<HTMLElement>('.cm-markdown-table-editor')!;
      const delimiter = table.querySelector<HTMLElement>('.cm-markdown-table-delimiter-block');
      const delimiterLine = table.querySelector<HTMLElement>(
        '.cm-line.cm-markdown-table-delimiter-line',
      );
      const semanticRows = [...table.querySelectorAll<HTMLElement>('[role="row"]')];
      const headerCells = [...table.querySelectorAll<HTMLElement>('[role="columnheader"]')];
      const bodyCells = [...table.querySelectorAll<HTMLElement>('[role="cell"]')];
      const controls = [...table.querySelectorAll<HTMLElement>('.cm-markdown-table-control')];

      expect(delimiter).not.toBeNull();
      expect(delimiter?.getAttribute('aria-hidden')).toBe('true');
      expect(delimiter?.textContent).toBe('');
      expect(getComputedStyle(delimiter!).width).toBe('0px');
      expect(getComputedStyle(delimiter!).minWidth).toBe('0');
      expect(getComputedStyle(delimiter!).height).toBe('0px');
      expect(getComputedStyle(delimiter!).minHeight).toBe('0');
      expect(getComputedStyle(delimiter!).pointerEvents).toBe('none');
      expect(delimiterLine).not.toBeNull();
      expect(delimiterLine?.getAttribute('aria-hidden')).toBe('true');
      expect(getComputedStyle(delimiterLine!).height).toBe('0px');
      expect(getComputedStyle(delimiterLine!).minHeight).toBe('0');
      expect(getComputedStyle(delimiterLine!).padding).toBe('0px');
      expect(
        delimiterLine?.querySelector('[data-table-cell], .cm-markdown-table-control'),
      ).toBeNull();
      expect(semanticRows).toHaveLength(rows);
      expect(headerCells).toHaveLength(columns);
      expect(
        headerCells.every(
          (cell) =>
            getComputedStyle(cell).backgroundImage.includes('linear-gradient') &&
            getComputedStyle(cell).backgroundPosition === 'bottom' &&
            getComputedStyle(cell).backgroundRepeat === 'no-repeat' &&
            getComputedStyle(cell).backgroundSize === '100% 3px' &&
            getComputedStyle(cell).borderBottomStyle === 'solid' &&
            getComputedStyle(cell).borderBottomWidth === '1px',
        ),
      ).toBe(true);
      expect(
        bodyCells.every(
          (cell) =>
            getComputedStyle(cell).backgroundSize !== '100% 3px' &&
            getComputedStyle(cell).borderBottomWidth === '1px',
        ),
      ).toBe(true);
      expect(
        semanticRows.every(
          (row) => row.querySelectorAll('[data-table-cell="true"]').length === columns,
        ),
      ).toBe(true);
      expect(controls.every((control) => !delimiterLine?.contains(control))).toBe(true);
      expect(view.state.doc.toString()).toBe(original);

      headerCells[0]?.classList.add(
        'cm-markdown-table-cell-active',
        'cm-markdown-table-cell-selected',
      );
      expect(getComputedStyle(headerCells[0]!).backgroundImage).toContain('linear-gradient');
      expect(getComputedStyle(headerCells[0]!).backgroundSize).toBe('100% 3px');
    },
  );

  it.each([
    {
      name: 'one populated column',
      source: '| H |\n| --- |\n| value |',
      rows: 2,
      columns: 1,
    },
    {
      name: 'two columns with an empty body cell',
      source: '| H1 | H2 |\n| --- | --- |\n| value |  |',
      rows: 2,
      columns: 2,
    },
    {
      name: 'three uneven columns',
      source: '| H1 | H2 | H3 |\n| --- | --- | --- |\n| only one |',
      rows: 2,
      columns: 3,
    },
  ])('draws a complete outer border around $name', ({ source, rows, columns }) => {
    const view = createView(source, views);
    const cells = [...view.dom.querySelectorAll<HTMLElement>('[data-table-cell="true"]')];

    expect(cells).toHaveLength(rows * columns);
    for (let row = 0; row < rows; row += 1) {
      const firstCell = cell(view, row, 0);
      const lastCell = cell(view, row, columns - 1);

      expect(getComputedStyle(lastCell).borderInlineEndWidth).toBe('1px');
      expect(getComputedStyle(firstCell).borderInlineStartWidth).toBe('1px');
    }
    for (let column = 0; column < columns; column += 1) {
      expect(getComputedStyle(cell(view, 0, column)).borderTopWidth).toBe('1px');
      expect(getComputedStyle(cell(view, rows - 1, column)).borderBottomWidth).toBe('1px');
    }
  });

  it.each([
    {
      name: 'normal short grid with a gutter',
      source: '| H1 | H2 |\n| --- | --- |\n| A1 | A2 |',
      width: '60rem',
      containerClass: '',
      withLineNumbers: true,
      columns: 2,
    },
    {
      name: 'narrow empty grid without a gutter',
      source: '|  |  |  |\n| --- | --- | --- |\n|  |  |  |',
      width: '18rem',
      containerClass: '',
      withLineNumbers: false,
      columns: 3,
    },
    {
      name: 'modal many-column grid',
      source:
        '| H1 | H2 | H3 | H4 | H5 | H6 |\n| --- | --- | --- | --- | --- | --- |\n| A1 | A2 | A3 | A4 | A5 | A6 |',
      width: '32rem',
      containerClass: 'modal-body',
      withLineNumbers: true,
      columns: 6,
    },
    {
      name: 'fullscreen uneven grid',
      source:
        '| H1 | H2 | H3 | H4 |\n| --- | --- | --- | --- |\n| only one |\n| A1 | A2 | A3 | A4 |',
      width: '100vw',
      containerClass: 'markdown-editor-fullscreen',
      withLineNumbers: false,
      columns: 4,
    },
  ])(
    'keeps balanced insets and all table layers contained for a $name',
    ({ source, width, containerClass, withLineNumbers, columns }) => {
      const view = createView(source, views, withLineNumbers);
      const container = view.dom.parentElement!;
      container.className = containerClass;
      container.style.width = width;
      const table = view.dom.querySelector<HTMLElement>('.cm-markdown-table-editor')!;
      const tableStyles = getComputedStyle(table);
      const inlineStart = Number.parseFloat(tableStyles.paddingLeft);
      const inlineEnd = Number.parseFloat(tableStyles.paddingRight);
      const renderedRows = [...table.querySelectorAll<HTMLElement>('.cm-markdown-table-row')];
      const addColumnSegments = [
        ...table.querySelectorAll<HTMLElement>('.cm-markdown-table-add-column'),
      ];

      expect(inlineStart).toBeGreaterThan(0);
      expect(inlineEnd).toBe(inlineStart);
      expect(tableStyles.boxSizing).toBe('border-box');
      expect(tableStyles.width).toBe('100%');
      expect(tableStyles.maxWidth).toBe('100%');
      expect(tableStyles.minWidth).toBe('0');
      expect(
        renderedRows.every(
          (row) =>
            getComputedStyle(row).width === '100%' &&
            row.querySelectorAll('[data-table-cell="true"]').length === columns,
        ),
      ).toBe(true);
      expect(addColumnSegments).toHaveLength(renderedRows.length);
      expect(addColumnSegments.map((segment) => segment.parentElement)).toEqual(renderedRows);
      expect(
        addColumnSegments.every(
          (segment) =>
            getComputedStyle(segment).top === '0px' && getComputedStyle(segment).bottom === '0px',
        ),
      ).toBe(true);
      expect(table.querySelectorAll('button.cm-markdown-table-add-column')).toHaveLength(1);
      expect(
        [...table.querySelectorAll<HTMLElement>('.cm-markdown-table-control')].every(
          (control) =>
            control.closest('.cm-markdown-table-editor') === table &&
            getComputedStyle(control).position === 'absolute',
        ),
      ).toBe(true);
      expect(
        [...table.querySelectorAll<HTMLElement>('.cm-markdown-table-row-handle')].every(
          (handle) =>
            getComputedStyle(handle.parentElement!).position === 'relative' &&
            getComputedStyle(handle).top === '0px' &&
            getComputedStyle(handle).bottom === '0px',
        ),
      ).toBe(true);
      expect(
        [...table.querySelectorAll<HTMLElement>('.cm-markdown-table-column-handle')].map(
          (handle) => handle.style.inlineSize,
        ),
      ).toEqual(Array<string>(columns).fill(`${(1 / columns) * 100}%`));

      selectCells(view, [0, 0], [1, columns - 1]);

      expect(view.dom.querySelectorAll('.cm-markdown-table-cell-selected')).toHaveLength(
        columns * 2,
      );
      expect(view.dom.querySelector('.cm-selectionLayer')).toBeNull();
    },
  );

  it('enters and edits an authored empty cell without requesting a scroll', () => {
    const view = createView('| H | V |\n| --- | --- |\n|  | value |', views);
    const emptyCell = cell(view, 1, 0);
    const transactions: { readonly docChanged: boolean; readonly scrollIntoView: boolean }[] = [];
    const listener = EditorView.updateListener.of((update) => {
      transactions.push(
        ...update.transactions.map((transaction) => ({
          docChanged: transaction.docChanged,
          scrollIntoView: transaction.scrollIntoView,
        })),
      );
    });
    view.dispatch({ effects: StateEffect.appendConfig.of(listener) });

    pointer(emptyCell, 'pointerdown', { pointerType: 'mouse' });
    pointer(emptyCell, 'pointerup', { pointerType: 'mouse' });

    expect(cell(view, 1, 0).classList).toContain('cm-markdown-table-cell-active');
    expect(cell(view, 1, 0).dataset['activeCell']).toBe('true');

    view.dispatch(view.state.replaceSelection('typed'));

    expect(view.state.doc.toString()).toBe('| H | V |\n| --- | --- |\n| typed | value |');
    expect(transactions.some((transaction) => transaction.scrollIntoView)).toBe(false);
  });

  it('keeps browser typing in a populated cell visible without scrolling the owning page', () => {
    const view = createView('| H | V |\n| --- | --- |\n| value | other |', views);
    const position = view.state.doc.toString().indexOf('value') + 2;
    const transactions: { readonly scrollIntoView: boolean }[] = [];
    view.dispatch({
      effects: StateEffect.appendConfig.of(
        EditorView.updateListener.of((update) => {
          transactions.push(
            ...update.transactions.map((transaction) => ({
              scrollIntoView: transaction.scrollIntoView,
            })),
          );
        }),
      ),
    });
    setCursor(view, position);

    view.dispatch({
      changes: { from: position, insert: 'x' },
      selection: EditorSelection.cursor(position + 1),
      scrollIntoView: true,
      userEvent: 'input.type',
    });

    const activeCell = cell(view, 1, 0);
    expect(view.state.doc.toString()).toContain('| vaxlue | other |');
    expect(transactions.at(-1)?.scrollIntoView).toBe(false);
    expect(activeCell.classList).toContain('cm-markdown-table-cell-active');
    expect(view.contentDOM.querySelector('.cm-markdown-table-caret')).toBeNull();
  });

  it('keeps repeated browser-style input in the same header without an inline caret widget', () => {
    const source = '|  | V |\n| --- | --- |\n| value | other |';
    const view = createView(source, views);
    const emptyHeader = cell(view, 0, 0);
    pointer(emptyHeader, 'pointerdown', { pointerType: 'mouse' });
    pointer(emptyHeader, 'pointerup', { pointerType: 'mouse' });

    for (const character of ['A', 'B', 'C']) {
      view.dispatch(view.state.replaceSelection(character), {
        annotations: Transaction.userEvent.of('input.type'),
      });
    }

    const activeCell = cell(view, 0, 0);

    expect(view.state.doc.toString()).toBe('| ABC | V |\n| --- | --- |\n| value | other |');
    expect(activeCell.classList).toContain('cm-markdown-table-cell-active');
    expect(activeCell.textContent).toBe('ABC');
    expect(view.state.selection.main.assoc).toBe(-1);
    expect(view.dom.classList).toContain('cm-markdown-table-cursor-owned');
    expect(view.dom.querySelector('.cm-markdown-table-cursor-layer')).not.toBeNull();
    expect(view.contentDOM.querySelector('.cm-markdown-table-caret')).toBeNull();
  });

  it('keeps the empty-cell source cursor mapped to authored DOM after clearing the cell', () => {
    const source = '| H | V |\n| --- | --- |\n| value | other |';
    const view = createView(source, views);
    const from = source.indexOf('value');
    const to = from + 'value'.length;
    setCursor(view, to);

    view.dispatch({
      changes: { from, to, insert: '' },
      selection: EditorSelection.cursor(from),
      userEvent: 'delete.backward',
    });

    const activeCell = cell(view, 1, 0);
    const authoredWhitespace = activeCell.firstChild;

    expect(activeCell.dataset['emptyCell']).toBe('true');
    expect(activeCell.classList).toContain('cm-markdown-table-cell-active');
    expect(view.state.selection.main.head).toBe(Number(activeCell.dataset['cellFrom']));
    expect(authoredWhitespace).not.toBeNull();
    expect(view.posAtDOM(authoredWhitespace!, 0)).toBe(from);
    expect(view.contentDOM.querySelector('.cm-markdown-table-caret')).toBeNull();
  });

  it.each(
    TABLE_CELL_CLEARING_CASES.flatMap((fixture) =>
      TABLE_CELL_CLEARING_OPERATIONS.map((operation) => ({ fixture, operation })),
    ),
  )('keeps the cursor in $fixture.name after $operation.name', ({ fixture, operation }) => {
    const view = createView(fixture.source, views);
    const from = fixture.source.indexOf(fixture.content);
    const to = from + fixture.content.length;
    const emptySource =
      'emptySource' in fixture
        ? fixture.emptySource
        : `${fixture.source.slice(0, from)}${fixture.source.slice(to)}`;
    const scrollRequests: boolean[] = [];
    const initialSelection =
      operation.selection === 'start'
        ? EditorSelection.cursor(from)
        : operation.selection === 'end'
          ? EditorSelection.cursor(to)
          : operation.selection === 'forward'
            ? EditorSelection.range(from, to)
            : EditorSelection.range(to, from);
    view.dispatch({ selection: initialSelection, userEvent: 'select' });
    view.focus();
    view.dispatch({
      effects: StateEffect.appendConfig.of(
        EditorView.updateListener.of((update) => {
          scrollRequests.push(
            ...update.transactions
              .filter((transaction) => transaction.docChanged)
              .map((transaction) => transaction.scrollIntoView),
          );
        }),
      ),
    });

    view.dispatch({
      changes: { from, to, insert: '' },
      selection: EditorSelection.cursor(from),
      scrollIntoView: true,
      userEvent: operation.userEvent,
    });

    const activeCell = cell(view, fixture.row, fixture.column);
    const emptyCursor = Number(activeCell.dataset['cellFrom']);
    const replacementSource = `${emptySource.slice(0, emptyCursor)}${fixture.replacement}${emptySource.slice(emptyCursor)}`;
    expect(view.state.doc.toString()).toBe(emptySource);
    expect(view.state.selection.ranges).toHaveLength(1);
    expect(view.state.selection.main.anchor).toBe(emptyCursor);
    expect(view.state.selection.main.head).toBe(emptyCursor);
    expect(view.state.selection.main.assoc).toBe(1);
    expect(activeCell.dataset['emptyCell']).toBe('true');
    expect(activeCell.dataset['activeCell']).toBe('true');
    expect(view.dom.querySelectorAll('[data-active-cell="true"]')).toHaveLength(1);
    expect(view.dom.classList).toContain('cm-markdown-table-cursor-owned');
    expect(view.dom.querySelectorAll('.cm-markdown-table-cursor-layer')).toHaveLength(1);
    expect(view.contentDOM.querySelector('.cm-markdown-table-caret')).toBeNull();
    expect(scrollRequests).toEqual([false]);

    expect(undo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe(fixture.source);
    expect(redo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe(emptySource);
    const redoCursor = Number(cell(view, fixture.row, fixture.column).dataset['cellFrom']);
    expect(view.state.selection.ranges).toHaveLength(1);
    expect(view.state.selection.main.anchor).toBe(redoCursor);
    expect(view.state.selection.main.head).toBe(redoCursor);
    expect(view.state.selection.main.assoc).toBe(1);

    scrollRequests.length = 0;
    view.dispatch(view.state.replaceSelection(fixture.replacement), {
      annotations: Transaction.userEvent.of('input.type'),
      scrollIntoView: true,
    });

    expect(view.state.doc.toString()).toBe(replacementSource);
    expect(cell(view, fixture.row, fixture.column).dataset['activeCell']).toBe('true');
    expect(view.state.selection.main.head).toBe(emptyCursor + fixture.replacement.length);
    expect(scrollRequests).toEqual([false]);
  });

  it.each([
    {
      name: 'repeated Backspace in a canonical middle cell',
      source: '| H1 | H2 | H3 |\n| --- | --- | --- |\n| left | rewrite | right |',
      emptySource: '| H1 | H2 | H3 |\n| --- | --- | --- |\n| left |  | right |',
      row: 1,
      column: 1,
      content: 'rewrite',
      direction: 'backward',
      userEvent: 'delete.backward',
    },
    {
      name: 'repeated Delete in a final cell without a trailing pipe',
      source: '| H1 | H2 |\n| --- | --- |\n| left | rewrite',
      emptySource: '| H1 | H2 |\n| --- | --- |\n| left |  |',
      row: 1,
      column: 1,
      content: 'rewrite',
      direction: 'forward',
      userEvent: 'delete.forward',
    },
  ] as const)(
    'keeps the same cell through $name and one-step undo/redo',
    ({ source, emptySource, row, column, content, direction, userEvent }) => {
      const view = createView(source, views);
      const from = source.indexOf(content);
      setCursor(view, direction === 'backward' ? from + content.length : from);

      let remainingCharacters = content.length;
      while (remainingCharacters > 0) {
        const position = view.state.selection.main.head;
        const change =
          direction === 'backward'
            ? { from: position - 1, to: position, insert: '' }
            : { from: position, to: position + 1, insert: '' };
        view.dispatch({
          changes: change,
          selection: EditorSelection.cursor(direction === 'backward' ? position - 1 : position),
          scrollIntoView: true,
          userEvent,
        });

        expect(cell(view, row, column).dataset['activeCell']).toBe('true');
        expect(view.dom.querySelectorAll('[data-active-cell="true"]')).toHaveLength(1);
        remainingCharacters -= 1;
      }

      const emptyCursor = Number(cell(view, row, column).dataset['cellFrom']);
      expect(view.state.doc.toString()).toBe(emptySource);
      expect(view.state.selection.main.head).toBe(emptyCursor);
      expect(view.state.selection.main.assoc).toBe(1);
      expect(undo(view)).toBe(true);
      expect(view.state.doc.toString()).toBe(source);
      expect(redo(view)).toBe(true);
      expect(view.state.doc.toString()).toBe(emptySource);
      expect(view.state.selection.main.head).toBe(
        Number(cell(view, row, column).dataset['cellFrom']),
      );
      expect(view.state.selection.main.assoc).toBe(1);
    },
  );

  it('does not retain a cleared-cell target when the next edit moves to another cell', () => {
    const source = '| H1 | H2 | H3 |\n| --- | --- | --- |\n| left | middle | right |';
    const view = createView(source, views);
    const middleFrom = source.indexOf('middle');
    const rightFrom = source.indexOf('right');
    setCursor(view, middleFrom + 'middle'.length);

    view.dispatch({
      changes: { from: middleFrom, to: middleFrom + 'middle'.length, insert: '' },
      selection: EditorSelection.cursor(middleFrom),
      userEvent: 'delete.backward',
    });
    setCursor(view, rightFrom - 'middle'.length + 2);
    view.dispatch(view.state.replaceSelection('X'), {
      annotations: Transaction.userEvent.of('input.type'),
    });

    expect(view.state.doc.toString()).toBe(
      '| H1 | H2 | H3 |\n| --- | --- | --- |\n| left |  | riXght |',
    );
    expect(cell(view, 1, 2).dataset['activeCell']).toBe('true');
    expect(cell(view, 1, 1).dataset['activeCell']).toBeUndefined();
    expect(undo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe(
      '| H1 | H2 | H3 |\n| --- | --- | --- |\n| left |  | right |',
    );
    expect(undo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe(source);
    expect(redo(view)).toBe(true);
    expect(redo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe(
      '| H1 | H2 | H3 |\n| --- | --- | --- |\n| left |  | riXght |',
    );
    expect(cell(view, 1, 2).dataset['activeCell']).toBe('true');
  });

  it('preserves a protected blank terminator and moves following prose outside the table', () => {
    const source = `${VALID_TABLE}\n`;
    const view = createView(source, views);
    const terminator = view.state.doc.length;

    view.dispatch({
      changes: { from: terminator - 1, to: terminator, insert: '' },
      selection: EditorSelection.cursor(terminator - 1),
      userEvent: 'delete.backward',
    });
    expect(view.state.doc.toString()).toBe(source);

    view.dispatch({
      changes: { from: terminator, insert: 'after table' },
      selection: EditorSelection.cursor(terminator + 'after table'.length),
      scrollIntoView: true,
      userEvent: 'input.type',
    });

    expect(view.state.doc.toString()).toBe(`${VALID_TABLE}\n\nafter table`);
    expect(view.state.selection.main.head).toBe(view.state.doc.length);
    expect(view.dom.querySelectorAll('.cm-markdown-table-editor')).toHaveLength(1);
    expect(view.dom.querySelector('[role="table"]')?.textContent).not.toContain('after table');
    expect(undo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe(source);
  });

  it('adds a final blank terminator when a table is inserted at document end', () => {
    const view = createView('', views);

    view.dispatch({
      changes: { from: 0, insert: VALID_TABLE },
      selection: EditorSelection.cursor(VALID_TABLE.length),
      userEvent: 'input',
    });

    expect(view.state.doc.toString()).toBe(`${VALID_TABLE}\n`);
    expect(view.state.selection.main.head).toBe(VALID_TABLE.length + 1);
    expect(undo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe('');
  });

  it.each(
    [
      {
        name: 'the first blank line before prose',
        suffix: '\n\nfollowing prose',
        deletionOffset: 1,
      },
      {
        name: 'the first of two blank lines before prose',
        suffix: '\n\n\nfollowing prose',
        deletionOffset: 1,
      },
      {
        name: 'the second of two blank lines before prose',
        suffix: '\n\n\nfollowing prose',
        deletionOffset: 2,
      },
      {
        name: 'prose immediately after the table',
        suffix: '\nfollowing prose',
        deletionOffset: 1,
      },
    ].flatMap((testCase) =>
      (['backward', 'forward'] as const).map((direction) => ({ ...testCase, direction })),
    ),
  )(
    'deletes $name in the $direction direction with one-step undo and redo',
    ({ suffix, deletionOffset, direction }) => {
      const source = `${VALID_TABLE}${suffix}`;
      const from = VALID_TABLE.length + deletionOffset;
      const to = from + 1;
      const expected = `${source.slice(0, from)}${source.slice(to)}`;
      const view = createView(source, views);
      view.dispatch({
        selection:
          direction === 'backward' ? EditorSelection.cursor(to) : EditorSelection.cursor(from),
        userEvent: 'select',
      });

      view.dispatch({
        changes: { from, to, insert: '' },
        selection: EditorSelection.cursor(from),
        userEvent: direction === 'backward' ? 'delete.backward' : 'delete.forward',
      });

      expect(view.state.doc.toString()).toBe(expected);
      expect(undo(view)).toBe(true);
      expect(view.state.doc.toString()).toBe(source);
      expect(redo(view)).toBe(true);
      expect(view.state.doc.toString()).toBe(expected);
    },
  );

  it('protects only the final empty EOF line when multiple blank lines follow the table', () => {
    const source = `${VALID_TABLE}\n\n`;
    const view = createView(source, views);
    const earlierBreak = VALID_TABLE.length;
    const finalBreak = source.length - 1;

    view.dispatch({
      changes: { from: earlierBreak, to: earlierBreak + 1, insert: '' },
      selection: EditorSelection.cursor(earlierBreak),
      userEvent: 'delete.forward',
    });

    expect(view.state.doc.toString()).toBe(`${VALID_TABLE}\n`);
    expect(undo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe(source);

    view.dispatch({
      changes: { from: finalBreak, to: finalBreak + 1, insert: '' },
      selection: EditorSelection.cursor(finalBreak),
      userEvent: 'delete.backward',
    });

    expect(view.state.doc.toString()).toBe(source);
  });

  it.each([
    {
      name: 'the first line after a table',
      source: `${VALID_TABLE}\n\nlater`,
      position: VALID_TABLE.length + 1,
    },
    {
      name: 'the second line after a table',
      source: `${VALID_TABLE}\n\n\nlater`,
      position: VALID_TABLE.length + 2,
    },
  ])(
    'inserts text and Enter normally on $name when later content exists',
    ({ source, position }) => {
      const view = createView(source, views);

      view.dispatch({
        changes: { from: position, insert: 'editable' },
        selection: EditorSelection.cursor(position + 'editable'.length),
        userEvent: 'input.type',
      });
      const withText = `${source.slice(0, position)}editable${source.slice(position)}`;

      expect(view.state.doc.toString()).toBe(withText);
      expect(undo(view)).toBe(true);
      expect(view.state.doc.toString()).toBe(source);
      expect(redo(view)).toBe(true);
      expect(view.state.doc.toString()).toBe(withText);

      const enterPosition = position + 'editable'.length;
      view.dispatch({
        changes: { from: enterPosition, insert: '\n' },
        selection: EditorSelection.cursor(enterPosition + 1),
        userEvent: 'input',
      });

      const withEnter = `${withText.slice(0, enterPosition)}\n${withText.slice(enterPosition)}`;
      expect(view.state.doc.toString()).toBe(withEnter);
      expect(undo(view)).toBe(true);
      expect(view.state.doc.toString()).toBe(withText);
      expect(redo(view)).toBe(true);
      expect(view.state.doc.toString()).toBe(withEnter);
    },
  );

  it.each([
    { name: 'forward first following line', line: 'first', reverse: false },
    { name: 'reverse first following line', line: 'first', reverse: true },
    { name: 'forward second following line', line: 'second', reverse: false },
    { name: 'reverse second following line', line: 'second', reverse: true },
  ])('replaces a $name without protecting ordinary post-table content', ({ line, reverse }) => {
    const source = `${VALID_TABLE}\nfirst\nsecond\nlater`;
    const from = source.indexOf(line);
    const to = from + line.length;
    const selection = reverse ? EditorSelection.range(to, from) : EditorSelection.range(from, to);
    const view = createView(source, views);
    view.dispatch({ selection, userEvent: 'select' });

    view.dispatch(view.state.replaceSelection('changed'), {
      annotations: Transaction.userEvent.of('input.type'),
    });

    const expected = `${source.slice(0, from)}changed${source.slice(to)}`;
    expect(view.state.doc.toString()).toBe(expected);
    expect(undo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe(source);
    expect(redo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe(expected);
  });

  it('keeps the following source line outside the table wrapper', () => {
    const view = createView(`${VALID_TABLE}\n\nafter table`, views);
    const table = view.dom.querySelector<HTMLElement>('.cm-markdown-table-editor')!;
    const blankLine = table.nextElementSibling;
    const followingLine = blankLine?.nextElementSibling;

    expect(table.querySelectorAll(':scope > .cm-markdown-table-row')).toHaveLength(3);
    expect(blankLine?.classList).toContain('cm-line');
    expect(blankLine?.textContent).toBe('');
    expect(followingLine?.classList).toContain('cm-line');
    expect(followingLine?.textContent).toBe('after table');
    expect(getComputedStyle(table).marginTop).toBe('0px');
    expect(getComputedStyle(table).marginBottom).toBe('0px');
  });

  it('maps cells from the Lezer node start inside Markdown containers', () => {
    const source = '> | H | V |\n> | --- | --- |\n> | A | B |';
    const view = createView(source, views);

    expect(cell(view, 0, 0).textContent).toBe('H');
    setCursor(view, source.indexOf('A') + 1);
    expect(pasteMarkdownTableText(view, '1')).toBe(true);
    expect(view.state.doc.toString()).toBe('> | H | V |\n> | --- | --- |\n> | A1 | B |');
  });

  it('keeps authored markup as editable text', () => {
    const view = createView('| Value |\n| --- |\n| <img src=x onerror="alert(1)"> |', views);
    const valueCell = cell(view, 1, 0);

    expect(valueCell.textContent).toContain('<img');
    expect(valueCell.querySelector('img:not(.cm-widgetBuffer)')).toBeNull();
  });

  it('starts a rectangular selection only after an LMB drag crosses into another cell', () => {
    const view = createView(VALID_TABLE, views);
    const start = cell(view, 1, 0);
    const end = cell(view, 2, 1);

    const down = pointer(start, 'pointerdown', { pointerType: 'mouse' });
    pointer(start, 'pointerup', { pointerType: 'mouse' });
    expect(down.defaultPrevented).toBe(false);
    expect(view.state.field(markdownTableSelectionState).anchor).toBeNull();

    pointer(start, 'pointerdown', { pointerType: 'mouse' });
    pointer(end, 'pointermove', { pointerType: 'mouse' });
    pointer(end, 'pointerup', { pointerType: 'mouse' });

    expect(view.state.field(markdownTableSelectionState)).toEqual({
      tableFrom: 0,
      anchor: { row: 1, column: 0 },
      head: { row: 2, column: 1 },
    });
    expect(view.dom.querySelectorAll('.cm-markdown-table-cell-selected')).toHaveLength(4);
    expect(view.dom.querySelectorAll('.cm-markdown-table-selection-top')).toHaveLength(2);
    expect(view.dom.querySelectorAll('.cm-markdown-table-selection-bottom')).toHaveLength(2);
  });

  it('does not change cell border geometry while drawing a rectangular selection', () => {
    const view = createView(VALID_TABLE, views);
    const start = cell(view, 1, 0);
    const end = cell(view, 2, 1);
    const before = {
      start: getComputedStyle(start).borderInlineStartWidth,
      end: getComputedStyle(end).borderInlineEndWidth,
      bottom: getComputedStyle(end).borderBottomWidth,
    };

    const up = selectCellsWithPointer(view, [1, 0], [2, 1]);
    const selectedStart = cell(view, 1, 0);
    const selectedEnd = cell(view, 2, 1);

    expect(up.defaultPrevented).toBe(true);
    expect(getComputedStyle(selectedStart).borderInlineStartWidth).toBe(before.start);
    expect(getComputedStyle(selectedEnd).borderInlineEndWidth).toBe(before.end);
    expect(getComputedStyle(selectedEnd).borderBottomWidth).toBe(before.bottom);
  });

  it('selects right-to-left and clears the native browser selection after crossing cells', () => {
    const view = createView(VALID_TABLE, views);
    const start = cell(view, 2, 1);
    const end = cell(view, 1, 0);
    const startPosition = Number(start.dataset['cellFrom']);
    const selection = document.getSelection()!;
    const removeAllRanges = jest.spyOn(selection, 'removeAllRanges');

    pointer(start, 'pointerdown', { pointerType: 'mouse' });
    const move = pointer(end, 'pointermove', { pointerType: 'mouse' });
    view.dispatch({
      selection: EditorSelection.range(0, view.state.doc.length),
      userEvent: 'select.pointer',
    });
    pointer(cell(view, 1, 0), 'pointerup', { pointerType: 'mouse' });

    expect(move.defaultPrevented).toBe(true);
    expect(removeAllRanges).toHaveBeenCalled();
    expect(view.state.selection.main).toEqual(EditorSelection.cursor(startPosition));
    expect(view.state.field(markdownTableSelectionState)).toEqual({
      tableFrom: 0,
      anchor: { row: 2, column: 1 },
      head: { row: 1, column: 0 },
    });
  });

  it('resolves a crossed cell from pointer coordinates when the original cell keeps capture', () => {
    const view = createView(VALID_TABLE, views);
    const start = cell(view, 1, 0);
    const end = cell(view, 2, 1);
    const originalElementFromPoint = document.elementFromPoint;
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: (): Element => end,
    });

    try {
      pointer(start, 'pointerdown', { pointerType: 'mouse' });
      pointer(start, 'pointermove', { pointerType: 'mouse', clientX: 50, clientY: 50 });
      pointer(start, 'pointerup', { pointerType: 'mouse', clientX: 50, clientY: 50 });
    } finally {
      Object.defineProperty(document, 'elementFromPoint', {
        configurable: true,
        value: originalElementFromPoint,
      });
    }

    expect(view.state.field(markdownTableSelectionState).head).toEqual({ row: 2, column: 1 });
  });

  it('extends a range with Shift and clears it with Escape or an outside click', () => {
    const view = createView(`${VALID_TABLE}\n\noutside`, views);
    selectCells(view, [1, 0], [1, 1]);

    pointer(cell(view, 2, 1), 'pointerdown', { pointerType: 'mouse', shiftKey: true });
    expect(view.state.field(markdownTableSelectionState).head).toEqual({ row: 2, column: 1 });

    key(view, 'Escape');
    expect(view.state.field(markdownTableSelectionState).anchor).toBeNull();

    selectCells(view, [1, 0], [2, 0]);
    pointer(document.body, 'pointerdown', { pointerType: 'mouse' });
    expect(view.state.field(markdownTableSelectionState).anchor).toBeNull();
  });

  it('adaptively handles Delete and Backspace in one undoable transaction', () => {
    const view = createView(VALID_TABLE, views);
    const original = view.state.doc.toString();

    selectCells(view, [1, 0], [2, 0]);
    key(view, 'Delete');
    expect(view.state.doc.toString()).toBe('| Name | Value |\n| --- | ---: |\n|  | 2 |\n|  | 10 |');
    expect(undo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe(original);

    selectCells(view, [1, 0], [1, 1]);
    key(view, 'Backspace');
    expect(view.state.doc.toString()).toBe('| Name | Value |\n| --- | ---: |\n| B | 10 |');
    expect(undo(view)).toBe(true);

    selectCells(view, [0, 0], [2, 0]);
    key(view, 'Delete');
    expect(view.state.doc.toString()).toBe('| Value |\n| ---: |\n| 2 |\n| 10 |');
    expect(undo(view)).toBe(true);

    selectCells(view, [0, 0], [2, 1]);
    key(view, 'Delete');
    expect(view.state.doc.toString()).toBe('');
    expect(undo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe(original);
  });

  it('promotes the following row when a fully selected header is deleted', () => {
    const view = createView(VALID_TABLE, views);

    selectCells(view, [0, 0], [0, 1]);
    key(view, 'Delete');

    expect(view.state.doc.toString()).toBe('| A | 2 |\n| --- | ---: |\n| B | 10 |');
  });

  it('opens an accessible tooltip menu by right click and keyboard', () => {
    const view = createView(VALID_TABLE, views);
    contextMenu(cell(view, 1, 0));

    const menu = requiredMenu(view);
    expect(menu.getAttribute('aria-label')).toBe('Table menu');
    expect(menu.querySelector<HTMLButtonElement>('[aria-label^="Insert before"]')).not.toBeNull();
    expect(menu.querySelector<HTMLButtonElement>('[aria-label="Delete table"]')).not.toBeNull();

    const first = menu.querySelector<HTMLButtonElement>('[role="menuitem"]')!;
    let bubbledEscape = false;
    view.dom.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        bubbledEscape = true;
      }
    });
    first.focus();
    key(first, 'ArrowDown');
    expect(document.activeElement).not.toBe(first);
    key(document.activeElement as HTMLElement, 'Escape');
    expect(view.dom.querySelector('[role="menu"]')).toBeNull();
    expect(bubbledEscape).toBe(false);

    setCursor(view, VALID_TABLE.indexOf('10'));
    key(view, 'F10', { shiftKey: true });
    expect(requiredMenu(view)).not.toBeNull();
  });

  it.each(['Enter', ' '] as const)('activates context-menu items with %s', (keyValue) => {
    const view = createView(VALID_TABLE, views);
    contextMenu(cell(view, 1, 0));
    const first = requiredMenu(view).querySelector<HTMLButtonElement>('[role="menuitem"]')!;

    first.focus();
    key(first, keyValue);

    expect(view.state.doc.toString().split('\n')).toHaveLength(5);
    expect(view.dom.querySelector('[role="menu"]')).toBeNull();
    expect(undo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe(VALID_TABLE);
  });

  it('keeps the menu open and announces a clipboard failure', () => {
    const view = createView(VALID_TABLE, views);
    selectCells(view, [1, 0], [2, 1]);
    contextMenu(cell(view, 1, 0));
    const menu = requiredMenu(view);

    menu.querySelector<HTMLButtonElement>('[aria-label="Copy"]')?.click();

    expect(menu.querySelector('[role="status"]')?.textContent).toBe('Clipboard unavailable');
    expect(view.dom.querySelector('[role="menu"]')).toBe(menu);
  });

  it('shows edge add controls without adding them to table geometry', () => {
    const view = createView(VALID_TABLE, views);
    const table = view.dom.querySelector<HTMLElement>('.cm-markdown-table-editor')!;
    const addRow = button(view, 'Add row');
    const addColumn = button(view, 'Add column');
    const original = view.state.doc.toString();
    const transactions: { readonly docChanged: boolean; readonly scrollIntoView: boolean }[] = [];
    view.dispatch({
      effects: StateEffect.appendConfig.of(
        EditorView.updateListener.of((update) => {
          transactions.push(
            ...update.transactions.map((transaction) => ({
              docChanged: transaction.docChanged,
              scrollIntoView: transaction.scrollIntoView,
            })),
          );
        }),
      ),
    });

    expect(addRow.parentElement?.closest('[role="cell"], [role="columnheader"]')).toBeNull();
    expect(addColumn.parentElement?.closest('[role="cell"], [role="columnheader"]')).toBeNull();
    expect(table.querySelectorAll('[role="columnheader"]')).toHaveLength(2);
    expect(pointer(addRow, 'pointerdown', { pointerType: 'mouse' }).defaultPrevented).toBe(true);

    addRow.click();
    expect(view.state.doc.toString().split('\n')).toHaveLength(5);
    expect(
      transactions.filter((transaction) => transaction.docChanged).at(-1)?.scrollIntoView,
    ).toBe(false);
    expect(undo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe(original);
    transactions.length = 0;

    button(view, 'Add column').click();
    expect(view.state.doc.toString()).toContain('| Name | Value |  |');
    expect(view.dom.querySelectorAll('[role="columnheader"]')).toHaveLength(3);
    expect(
      [...view.dom.querySelectorAll<HTMLElement>('[role="row"]')].map(
        (row) => row.querySelectorAll('[data-table-cell="true"]').length,
      ),
    ).toEqual([3, 3, 3]);
    expect(transactions.filter((transaction) => transaction.docChanged)).toEqual([
      { docChanged: true, scrollIntoView: false },
    ]);
  });

  it.each([
    {
      name: 'header-only table at document start',
      source: '| H |\n| --- |',
      rows: 1,
    },
    {
      name: 'one body row at document end',
      source: 'before\n\n| H |\n| --- |\n| value |',
      rows: 2,
    },
    {
      name: 'empty, populated, and uneven rows between ordinary lines',
      source: 'before\n\n| A | B | C |\n|---|---|---|\n|||\n| one | two |\n| final |\n\nafter',
      rows: 4,
    },
  ])('covers the complete add-column edge and add-row boundary for $name', ({ source, rows }) => {
    const view = createView(source, views);
    const table = view.dom.querySelector<HTMLElement>('.cm-markdown-table-editor')!;
    const renderedRows = [...table.querySelectorAll<HTMLElement>('.cm-markdown-table-row')];
    const addColumns = [...table.querySelectorAll<HTMLElement>('.cm-markdown-table-add-column')];
    const addRows = [...table.querySelectorAll<HTMLButtonElement>('.cm-markdown-table-add-row')];

    expect(renderedRows).toHaveLength(rows);
    expect(addColumns).toHaveLength(rows);
    expect(addRows).toHaveLength(1);
    expect(table.querySelectorAll('[aria-label="Add column"]')).toHaveLength(1);
    for (const [index, addColumn] of addColumns.entries()) {
      expect(addColumn.parentElement).toBe(renderedRows[index]);
      expect(getComputedStyle(addColumn).top).toBe('0px');
      expect(getComputedStyle(addColumn).right).toBe('0px');
      expect(getComputedStyle(addColumn).bottom).toBe('0px');
      expect(getComputedStyle(addColumn).height).toBe('auto');
      if (index === 0) {
        expect(addColumn).toBeInstanceOf(HTMLButtonElement);
        expect(addColumn.getAttribute('aria-label')).toBe('Add column');
        expect(addColumn.getAttribute('aria-hidden')).toBeNull();
      } else {
        expect(addColumn).toBeInstanceOf(HTMLSpanElement);
        expect(addColumn.getAttribute('aria-label')).toBeNull();
        expect(addColumn.getAttribute('aria-hidden')).toBe('true');
        expect(addColumn.tabIndex).toBe(-1);
      }
    }
    expect(addRows[0]!.parentElement).toBe(renderedRows.at(-1));
    expect(getComputedStyle(addRows[0]!).right).toBe('0px');
    expect(getComputedStyle(addRows[0]!).bottom).toBe('-0.75rem');
    expect(getComputedStyle(addRows[0]!).left).toBe('0px');
    expect(getComputedStyle(addRows[0]!).width).toBe('auto');

    const original = view.state.doc.toString();
    const originalColumnCount = table.querySelectorAll('[role="columnheader"]').length;
    expect(
      pointer(addColumns.at(-1)!, 'pointerdown', { pointerType: 'mouse' }).defaultPrevented,
    ).toBe(true);
    addColumns.at(-1)!.click();
    expect(view.dom.querySelectorAll('[role="columnheader"]')).toHaveLength(
      originalColumnCount + 1,
    );
    expect(undo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe(original);
  });

  it.each([
    {
      name: 'header-only table at document start',
      source: '| H |\n| --- |',
      rows: 1,
    },
    {
      name: 'one populated body row',
      source: '| H |\n| --- |\n| value |',
      rows: 2,
    },
    {
      name: 'empty, populated, and uneven body rows between ordinary lines',
      source: 'before\n\n| A | B | C |\n|---|---|---|\n|||\n| one | two |\n| final |\n\nafter',
      rows: 4,
    },
  ])('gives every semantic row its own full-height drag hit area for $name', ({ source, rows }) => {
    const view = createView(source, views);
    const table = view.dom.querySelector<HTMLElement>('.cm-markdown-table-editor')!;
    const renderedRows = [...table.querySelectorAll<HTMLElement>('.cm-markdown-table-row')];
    const handles = [...table.querySelectorAll<HTMLElement>('.cm-markdown-table-row-handle')];

    expect(renderedRows).toHaveLength(rows);
    expect(handles).toHaveLength(rows);
    for (const [index, handle] of handles.entries()) {
      const ownerRow = renderedRows[index]!;

      expect(handle.parentElement).toBe(ownerRow);
      expect(handle.closest('[data-table-cell]')).toBeNull();
      expect(getComputedStyle(ownerRow).position).toBe('relative');
      expect(getComputedStyle(handle).top).toBe('0px');
      expect(getComputedStyle(handle).bottom).toBe('0px');
      expect(getComputedStyle(handle).height).toBe('auto');
      expect(getComputedStyle(handle).left).toBe('-1rem');
      expect(getComputedStyle(handle).width).toBe('1rem');
      expect(getComputedStyle(handle).transform).toBe('');
    }
  });

  it.each([
    {
      name: 'one column',
      source: '| A |\n| --- |\n| 1 |',
      starts: ['0%'],
      widths: ['100%'],
    },
    {
      name: 'two columns with an empty cell',
      source: '| A |  |\n| --- | --- |\n| 1 | 2 |',
      starts: ['0%', '50%'],
      widths: ['50%', '50%'],
    },
    {
      name: 'three uneven columns',
      source: '| A | B | C |\n| --- | --- | --- |\n| 1 |',
      starts: ['0%', '33.33333333333333%', '66.66666666666666%'],
      widths: ['33.33333333333333%', '33.33333333333333%', '33.33333333333333%'],
    },
  ])(
    'covers the complete rendered width of every semantic column for $name',
    ({ source, starts, widths }) => {
      const view = createView(source, views);
      const headerRow = cell(view, 0, 0).closest<HTMLElement>('.cm-markdown-table-row')!;
      const handles = [
        ...view.dom.querySelectorAll<HTMLButtonElement>('.cm-markdown-table-column-handle'),
      ];

      expect(handles.map((handle) => handle.parentElement)).toEqual(
        Array<HTMLElement>(handles.length).fill(headerRow),
      );
      expect(handles.map((handle) => handle.style.insetInlineStart)).toEqual(starts);
      expect(handles.map((handle) => handle.style.inlineSize)).toEqual(widths);
      expect(
        handles.map((handle) => Number.parseFloat(getComputedStyle(handle).marginInlineStart)),
      ).toEqual(Array<number>(handles.length).fill(0));
    },
  );

  it.each(['mouse', 'touch'] as const)(
    'moves rows with one Pointer Events transaction for %s',
    (pointerType) => {
      const view = createView(VALID_TABLE, views);
      const source = view.state.doc.toString();
      const first = button(view, 'Move row 2');
      const second = button(view, 'Move row 3');
      mockBounds(second, { left: 0, top: 100, width: 20, height: 20 });

      pointer(first, 'pointerdown', { pointerType, clientY: 5 });
      expect(first.classList).toContain('cm-markdown-table-drag-source');
      expect(first.getAttribute('aria-grabbed')).toBe('true');
      expect(cell(view, 1, 0).classList).toContain('cm-markdown-table-drag-source-cell');
      pointer(second, 'pointermove', { pointerType, clientY: 119 });
      expect(cell(view, 2, 0).closest<HTMLElement>('.cm-markdown-table-row')?.classList).toContain(
        'cm-markdown-table-drop-after-row',
      );
      pointer(second, 'pointerup', { pointerType, clientY: 119 });

      expect(view.state.doc.toString()).toContain('| B | 10 |\n| A | 2 |');
      expect(undo(view)).toBe(true);
      expect(view.state.doc.toString()).toBe(source);
    },
  );

  it('moves the header and columns with pointer drop indicators', () => {
    const view = createView('| A | B | C |\n| --- | --- | --- |\n| 1 | 2 | 3 |', views);
    const lastColumn = button(view, 'Move column 3');
    const firstColumn = button(view, 'Move column 1');
    mockBounds(firstColumn, { left: 100, top: 0, width: 20, height: 20 });

    pointer(lastColumn, 'pointerdown', { pointerType: 'mouse', clientX: 210 });
    pointer(firstColumn, 'pointermove', { pointerType: 'mouse', clientX: 101 });
    expect(firstColumn.classList).toContain('cm-markdown-table-drop-before');
    pointer(firstColumn, 'pointerup', { pointerType: 'mouse', clientX: 101 });
    expect(view.state.doc.toString()).toBe('| C | A | B |\n| --- | --- | --- |\n| 3 | 1 | 2 |');

    const header = button(view, 'Move row 1');
    const body = button(view, 'Move row 2');
    mockBounds(body, { left: 0, top: 50, width: 20, height: 20 });
    pointer(header, 'pointerdown', { pointerType: 'mouse', clientY: 5 });
    pointer(body, 'pointermove', { pointerType: 'mouse', clientY: 69 });
    pointer(body, 'pointerup', { pointerType: 'mouse', clientY: 69 });
    expect(view.state.doc.toString()).toBe('| 3 | 1 | 2 |\n| --- | --- | --- |\n| C | A | B |');
  });

  it.each(ROW_DRAG_CASES)(
    'moves $name with exact source, selection, terminal state, undo, and redo',
    ({ pointerType, sourceIndex, targetIndex, placement, expected, moved }) => {
      const view = createView(ROW_DRAG_SOURCE, views);
      const source = button(view, `Move row ${sourceIndex + 1}`);
      const target = button(view, `Move row ${targetIndex + 1}`);

      dragPointer(source, target, 'row', placement, pointerType);

      expect(view.state.doc.toString()).toBe(expected);
      expect(view.dom.querySelector('.cm-markdown-table-drag-source')).toBeNull();
      expect(
        [...view.dom.querySelectorAll('.cm-markdown-table-row-handle')].every(
          (handle) => handle.getAttribute('aria-grabbed') === 'false',
        ),
      ).toBe(true);
      if (expected === ROW_DRAG_SOURCE) {
        expect(undo(view)).toBe(false);
        return;
      }
      const selection = view.state.field(markdownTableSelectionState);
      expect(selection.anchor).toEqual({ row: moved[0], column: 0 });
      expect(selection.head).toEqual({ row: moved[0], column: 0 });
      expect(undo(view)).toBe(true);
      expect(view.state.doc.toString()).toBe(ROW_DRAG_SOURCE);
      expect(redo(view)).toBe(true);
      expect(view.state.doc.toString()).toBe(expected);
    },
  );

  it.each(COLUMN_DRAG_CASES)(
    'moves $name with alignments, exact selection, terminal state, undo, and redo',
    ({ pointerType, sourceIndex, targetIndex, placement, expected, moved }) => {
      const view = createView(COLUMN_DRAG_SOURCE, views);
      const source = button(view, `Move column ${sourceIndex + 1}`);
      const target = button(view, `Move column ${targetIndex + 1}`);

      dragPointer(source, target, 'column', placement, pointerType);

      expect(view.state.doc.toString()).toBe(expected);
      expect(view.dom.querySelector('.cm-markdown-table-drag-source')).toBeNull();
      expect(
        [...view.dom.querySelectorAll('.cm-markdown-table-column-handle')].every(
          (handle) => handle.getAttribute('aria-grabbed') === 'false',
        ),
      ).toBe(true);
      if (expected === COLUMN_DRAG_SOURCE) {
        expect(undo(view)).toBe(false);
        return;
      }
      const selection = view.state.field(markdownTableSelectionState);
      expect(selection.anchor).toEqual({ row: 0, column: moved[0] });
      expect(selection.head).toEqual({ row: 1, column: moved[0] });
      expect(undo(view)).toBe(true);
      expect(view.state.doc.toString()).toBe(COLUMN_DRAG_SOURCE);
      expect(redo(view)).toBe(true);
      expect(view.state.doc.toString()).toBe(expected);
    },
  );

  it.each(POINTER_TYPES)(
    'keeps the only semantic row and column stable for every %s drop side',
    (pointerType) => {
      const source = '| only |\n| --- |';
      for (const axis of ['row', 'column'] as const) {
        for (const placement of ['before', 'after'] as const) {
          const view = createView(source, views);
          const label = axis === 'row' ? 'Move row 1' : 'Move column 1';

          dragPointer(button(view, label), button(view, label), axis, placement, pointerType);

          expect(view.state.doc.toString()).toBe(source);
          expect(view.dom.querySelector('.cm-markdown-table-drag-source')).toBeNull();
          expect(undo(view)).toBe(false);
        }
      }
    },
  );

  it('moves rows and columns in the smallest reorderable two-by-two table', () => {
    const source = '| H1 | H2 |\n| --- | ---: |\n| B1 | B2 |';
    const rowView = createView(source, views);

    dragPointer(
      button(rowView, 'Move row 2'),
      button(rowView, 'Move row 1'),
      'row',
      'before',
      'touch',
    );
    expect(rowView.state.doc.toString()).toBe('| B1 | B2 |\n| --- | ---: |\n| H1 | H2 |');
    expect(undo(rowView)).toBe(true);
    expect(rowView.state.doc.toString()).toBe(source);

    const columnView = createView(source, views);
    dragPointer(
      button(columnView, 'Move column 2'),
      button(columnView, 'Move column 1'),
      'column',
      'before',
      'pen',
    );
    expect(columnView.state.doc.toString()).toBe('| H2 | H1 |\n| ---: | --- |\n| B2 | B1 |');
    expect(undo(columnView)).toBe(true);
    expect(columnView.state.doc.toString()).toBe(source);
  });

  it.each([
    { name: 'document start', prefix: '', suffix: '\n\nafter' },
    { name: 'document middle', prefix: 'before\n\n', suffix: '\n\nafter' },
    { name: 'document end', prefix: 'before\n\n', suffix: '' },
  ])('moves the exact table range at $name', ({ prefix, suffix }) => {
    const table = '| H1 | H2 |\n| --- | --- |\n| A1 | A2 |\n| B1 | B2 |';
    const rowView = createView(`${prefix}${table}${suffix}`, views);
    dragPointer(
      button(rowView, 'Move row 3'),
      button(rowView, 'Move row 1'),
      'row',
      'before',
      'mouse',
    );
    expect(rowView.state.doc.toString()).toBe(
      `${prefix}| B1 | B2 |\n| --- | --- |\n| H1 | H2 |\n| A1 | A2 |${suffix}`,
    );
    expect(undo(rowView)).toBe(true);
    expect(rowView.state.doc.toString()).toBe(`${prefix}${table}${suffix}`);

    const columnView = createView(`${prefix}${table}${suffix}`, views);
    dragPointer(
      button(columnView, 'Move column 2'),
      button(columnView, 'Move column 1'),
      'column',
      'before',
      'mouse',
    );
    expect(columnView.state.doc.toString()).toBe(
      `${prefix}| H2 | H1 |\n| --- | --- |\n| A2 | A1 |\n| B2 | B1 |${suffix}`,
    );
    expect(undo(columnView)).toBe(true);
    expect(columnView.state.doc.toString()).toBe(`${prefix}${table}${suffix}`);
  });

  it.each([
    {
      name: 'compact empty and populated rows without canonical spaces',
      source: '|H|V|\n|---|---|\n||\n|Бета|🙂|',
      handle: 'Move row 3',
      target: 'Move row 1',
      axis: 'row',
      expected: '|Бета|🙂|\n|---|---|\n|H|V|\n||',
    },
    {
      name: 'rows with missing outer pipes and no trailing pipe',
      source: 'H1 | H2\n--- | ---\nA | B\nC | D',
      handle: 'Move row 3',
      target: 'Move row 1',
      axis: 'row',
      expected: 'C | D\n--- | ---\nH1 | H2\nA | B',
    },
    {
      name: 'columns in rows without trailing pipes',
      source: '| H1 | H2\n| :--- | ---:\n| A | B',
      handle: 'Move column 2',
      target: 'Move column 1',
      axis: 'column',
      expected: '| H2| H1 \n| ---:| :--- \n| B| A ',
    },
  ] as const)(
    'preserves authored Markdown spelling while dragging $name',
    ({ source, handle, target, axis, expected }) => {
      const view = createView(source, views);

      dragPointer(button(view, handle), button(view, target), axis, 'before', 'mouse');

      expect(view.state.doc.toString()).toBe(expected);
      expect(undo(view)).toBe(true);
      expect(view.state.doc.toString()).toBe(source);
      expect(redo(view)).toBe(true);
      expect(view.state.doc.toString()).toBe(expected);
    },
  );

  it.each([
    {
      name: 'forward-selected body rows',
      axis: 'row',
      anchor: [1, 0],
      head: [2, 3],
      handle: 'Move row 2',
      target: 'Move row 4',
      expectedRows: [0, 3, 1, 2],
      expectedColumns: [0, 1, 2, 3],
      expectedAnchor: { row: 2, column: 0 },
      expectedHead: { row: 3, column: 3 },
    },
    {
      name: 'reverse-selected header and first body row',
      axis: 'row',
      anchor: [1, 3],
      head: [0, 0],
      handle: 'Move row 1',
      target: 'Move row 4',
      expectedRows: [2, 3, 0, 1],
      expectedColumns: [0, 1, 2, 3],
      expectedAnchor: { row: 2, column: 0 },
      expectedHead: { row: 3, column: 3 },
    },
    {
      name: 'forward-selected first and middle columns',
      axis: 'column',
      anchor: [0, 0],
      head: [3, 1],
      handle: 'Move column 1',
      target: 'Move column 4',
      expectedRows: [0, 1, 2, 3],
      expectedColumns: [2, 3, 0, 1],
      expectedAnchor: { row: 0, column: 2 },
      expectedHead: { row: 3, column: 3 },
    },
    {
      name: 'reverse-selected middle and final columns',
      axis: 'column',
      anchor: [3, 3],
      head: [0, 2],
      handle: 'Move column 4',
      target: 'Move column 1',
      expectedRows: [0, 1, 2, 3],
      expectedColumns: [2, 3, 0, 1],
      expectedAnchor: { row: 0, column: 0 },
      expectedHead: { row: 3, column: 1 },
    },
  ] as const)(
    'moves $name as one contiguous block',
    ({
      axis,
      anchor,
      head,
      handle,
      target,
      expectedRows,
      expectedColumns,
      expectedAnchor,
      expectedHead,
    }) => {
      const source = fourByFourTable([0, 1, 2, 3], [0, 1, 2, 3]);
      const view = createView(source, views);
      selectCells(view, anchor, head);

      dragPointer(
        button(view, handle),
        button(view, target),
        axis,
        axis === 'row' ? 'after' : target.endsWith('4') ? 'after' : 'before',
        'mouse',
      );

      expect(view.state.doc.toString()).toBe(fourByFourTable(expectedRows, expectedColumns));
      expect(view.state.field(markdownTableSelectionState).anchor).toEqual(expectedAnchor);
      expect(view.state.field(markdownTableSelectionState).head).toEqual(expectedHead);
      expect(undo(view)).toBe(true);
      expect(view.state.doc.toString()).toBe(source);
      expect(redo(view)).toBe(true);
      expect(view.state.doc.toString()).toBe(fourByFourTable(expectedRows, expectedColumns));
    },
  );

  it.each([
    {
      name: 'a row outside a full-row selection',
      axis: 'row',
      anchor: [1, 0],
      head: [2, 3],
      handle: 'Move row 4',
      target: 'Move row 1',
      placement: 'before',
      expectedRows: [3, 0, 1, 2],
      expectedColumns: [0, 1, 2, 3],
    },
    {
      name: 'one row inside a partial-row selection',
      axis: 'row',
      anchor: [1, 1],
      head: [2, 3],
      handle: 'Move row 2',
      target: 'Move row 4',
      placement: 'after',
      expectedRows: [0, 2, 3, 1],
      expectedColumns: [0, 1, 2, 3],
    },
    {
      name: 'a column outside a full-column selection',
      axis: 'column',
      anchor: [0, 1],
      head: [3, 2],
      handle: 'Move column 4',
      target: 'Move column 1',
      placement: 'before',
      expectedRows: [0, 1, 2, 3],
      expectedColumns: [3, 0, 1, 2],
    },
    {
      name: 'one column inside a partial-column selection',
      axis: 'column',
      anchor: [1, 1],
      head: [3, 2],
      handle: 'Move column 2',
      target: 'Move column 4',
      placement: 'after',
      expectedRows: [0, 1, 2, 3],
      expectedColumns: [0, 2, 3, 1],
    },
  ] as const)(
    'moves only $name',
    ({ axis, anchor, head, handle, target, placement, expectedRows, expectedColumns }) => {
      const view = createView(fourByFourTable([0, 1, 2, 3], [0, 1, 2, 3]), views);
      selectCells(view, anchor, head);

      dragPointer(button(view, handle), button(view, target), axis, placement, 'touch');

      expect(view.state.doc.toString()).toBe(fourByFourTable(expectedRows, expectedColumns));
    },
  );

  it.each([
    { name: 'secondary mouse button', button: 2, isPrimary: true },
    { name: 'middle mouse button', button: 1, isPrimary: true },
    { name: 'non-primary touch', button: 0, isPrimary: false },
  ])('does not start a drag for $name', ({ button: mouseButton, isPrimary }) => {
    const view = createView(ROW_DRAG_SOURCE, views);
    const handle = button(view, 'Move row 2');

    pointer(handle, 'pointerdown', {
      pointerType: 'mouse',
      button: mouseButton,
      isPrimary,
    });

    expect(handle.getAttribute('aria-grabbed')).toBe('false');
    expect(view.dom.querySelector('.cm-markdown-table-drag-source')).toBeNull();
  });

  it('captures the originating pointer so release outside the narrow edge remains observable', () => {
    const view = createView(ROW_DRAG_SOURCE, views);
    const handle = button(view, 'Move row 2');
    const capture = jest.fn();
    handle.setPointerCapture = capture;

    pointer(handle, 'pointerdown', { pointerType: 'touch', pointerId: 7 });

    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith(7);
  });

  it.each(['pointercancel', 'lostpointercapture', 'Escape', 'document change'] as const)(
    'clears drag state without moving on %s',
    (terminal) => {
      const view = createView(ROW_DRAG_SOURCE, views);
      const source = button(view, 'Move row 2');
      const target = button(view, 'Move row 4');

      pointer(source, 'pointerdown', { pointerType: 'mouse', pointerId: 7 });
      pointAtDropTarget(target, 'row');
      pointer(target, 'pointermove', { pointerType: 'mouse', pointerId: 7, clientY: 199 });
      expect(view.dom.querySelector('.cm-markdown-table-drop-after')).not.toBeNull();

      if (terminal === 'Escape') {
        key(view, 'Escape');
      } else if (terminal === 'document change') {
        view.dispatch({ changes: { from: ROW_DRAG_SOURCE.indexOf('H') + 1, insert: 'X' } });
      } else {
        pointer(source, terminal, { pointerType: 'mouse', pointerId: 7 });
      }

      expect(view.state.doc.toString()).toBe(
        terminal === 'document change' ? ROW_DRAG_SOURCE.replace('H', 'HX') : ROW_DRAG_SOURCE,
      );
      expect(view.dom.querySelector('.cm-markdown-table-drag-source')).toBeNull();
      expect(view.dom.querySelector('.cm-markdown-table-drop-after')).toBeNull();
    },
  );

  it('binds a drag to its originating pointer and ignores a different pointer release', () => {
    const view = createView(ROW_DRAG_SOURCE, views);
    const source = button(view, 'Move row 2');
    const target = button(view, 'Move row 4');

    pointer(source, 'pointerdown', { pointerType: 'touch', pointerId: 7 });
    pointAtDropTarget(target, 'row');
    pointer(target, 'pointermove', { pointerType: 'touch', pointerId: 8, clientY: 199 });
    expect(target.classList).not.toContain('cm-markdown-table-drop-after');
    pointer(target, 'pointermove', { pointerType: 'touch', pointerId: 7, clientY: 199 });
    pointer(target, 'pointerup', { pointerType: 'touch', pointerId: 8, clientY: 199 });

    expect(view.state.doc.toString()).toBe(ROW_DRAG_SOURCE);
    expect(view.dom.querySelector('.cm-markdown-table-drag-source')).not.toBeNull();

    pointer(target, 'pointerup', { pointerType: 'touch', pointerId: 7, clientY: 199 });
    expect(view.state.doc.toString()).toBe('| H |\n| --- |\n| B |\n| C |\n| A |');
    expect(view.dom.querySelector('.cm-markdown-table-drag-source')).toBeNull();
  });

  it('ignores cancellation from another pointer and cancellation without an active drag', () => {
    const view = createView(ROW_DRAG_SOURCE, views);
    const source = button(view, 'Move row 2');

    pointer(source, 'pointerdown', { pointerType: 'touch', pointerId: 7 });
    pointer(source, 'pointercancel', { pointerType: 'touch', pointerId: 8 });
    expect(view.dom.querySelector('.cm-markdown-table-drag-source')).not.toBeNull();

    pointer(source, 'pointercancel', { pointerType: 'touch', pointerId: 7 });
    expect(view.dom.querySelector('.cm-markdown-table-drag-source')).toBeNull();

    pointer(source, 'pointercancel', { pointerType: 'touch', pointerId: 7 });
    expect(view.state.doc.toString()).toBe(ROW_DRAG_SOURCE);
  });

  it('clears a previous target when the pointer leaves the originating table or axis', () => {
    const secondTable = '| X | Y |\n| --- | --- |\n| 9 | 10 |';
    const view = createView(`${COLUMN_DRAG_SOURCE}\n\n${secondTable}`, views);
    const source = buttonInTable(view, 0, 'Move column 1');
    const validTarget = buttonInTable(view, 0, 'Move column 4');
    const otherAxis = buttonInTable(view, 0, 'Move row 2');
    const otherTable = buttonInTable(view, 1, 'Move column 2');

    pointer(source, 'pointerdown', { pointerType: 'mouse' });
    pointAtDropTarget(validTarget, 'column');
    pointer(validTarget, 'pointermove', { pointerType: 'mouse', clientX: 199 });
    expect(validTarget.classList).toContain('cm-markdown-table-drop-after');

    pointer(otherAxis, 'pointermove', { pointerType: 'mouse' });
    expect(view.dom.querySelector('.cm-markdown-table-drop-after')).toBeNull();
    pointer(otherTable, 'pointermove', { pointerType: 'mouse' });
    expect(view.dom.querySelector('.cm-markdown-table-drop-after')).toBeNull();
    pointer(otherTable, 'pointerup', { pointerType: 'mouse' });

    expect(view.state.doc.toString()).toBe(`${COLUMN_DRAG_SOURCE}\n\n${secondTable}`);
    expect(view.dom.querySelector('.cm-markdown-table-drag-source')).toBeNull();
  });

  it('cancels a drop released outside a valid hit area after visiting one', () => {
    const view = createView(ROW_DRAG_SOURCE, views);
    const source = button(view, 'Move row 2');
    const validTarget = button(view, 'Move row 4');

    pointer(source, 'pointerdown', { pointerType: 'mouse' });
    pointAtDropTarget(validTarget, 'row');
    pointer(validTarget, 'pointermove', { pointerType: 'mouse', clientY: 199 });
    pointer(view.contentDOM, 'pointermove', { pointerType: 'mouse' });
    pointer(view.contentDOM, 'pointerup', { pointerType: 'mouse' });

    expect(view.state.doc.toString()).toBe(ROW_DRAG_SOURCE);
    expect(view.dom.querySelector('.cm-markdown-table-drag-source')).toBeNull();
  });

  it('resolves a captured pointer from viewport coordinates and clears it outside the viewport', () => {
    const view = createView(ROW_DRAG_SOURCE, views);
    const source = button(view, 'Move row 2');
    const target = button(view, 'Move row 4');
    const originalElementFromPoint = document.elementFromPoint;
    const elementFromPoint = jest.fn<HTMLElement | null, [number, number]>();
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: elementFromPoint,
    });

    try {
      pointer(source, 'pointerdown', { pointerType: 'mouse' });
      pointAtDropTarget(target, 'row');
      elementFromPoint.mockReturnValue(target);
      pointer(source, 'pointermove', { pointerType: 'mouse', clientY: 199 });
      expect(target.classList).toContain('cm-markdown-table-drop-after');

      elementFromPoint.mockReturnValue(null);
      pointer(source, 'pointermove', { pointerType: 'mouse', clientY: -1 });
      expect(view.dom.querySelector('.cm-markdown-table-drop-before')).toBeNull();
      expect(view.dom.querySelector('.cm-markdown-table-drop-after')).toBeNull();
      pointer(source, 'pointerup', { pointerType: 'mouse', clientY: -1 });

      expect(view.state.doc.toString()).toBe(ROW_DRAG_SOURCE);
      expect(view.dom.querySelector('.cm-markdown-table-drag-source')).toBeNull();
    } finally {
      if (originalElementFromPoint === undefined) {
        Reflect.deleteProperty(document, 'elementFromPoint');
      } else {
        Object.defineProperty(document, 'elementFromPoint', {
          configurable: true,
          value: originalElementFromPoint,
        });
      }
    }
  });

  it('copies, cuts, and pastes from the top-left selected cell', () => {
    const view = createView(VALID_TABLE, views);
    selectCells(view, [0, 0], [2, 0]);

    expect(markdownTableSelectionTsv(view)).toBe('Name\nA\nB');

    const writes: Record<string, string> = {};
    const event = new Event('cut', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', {
      value: {
        setData: (format: string, value: string): void => {
          writes[format] = value;
        },
      },
    });
    view.contentDOM.dispatchEvent(event);
    expect(writes['text/plain']).toBe('Name\nA\nB');
    expect(view.state.doc.toString()).toBe('| Value |\n| ---: |\n| 2 |\n| 10 |');

    expect(undo(view)).toBe(true);
    selectCells(view, [1, 0], [2, 1]);
    expect(pasteMarkdownTableText(view, 'x\ty')).toBe(true);
    expect(view.state.doc.toString()).toContain('| x | y |');
  });

  it('keeps navigation, hard breaks, escaped pipes, and separator protection', () => {
    const view = createView('| H |\n| --- |\n| A |', views);
    setCursor(view, view.state.doc.toString().indexOf('A') + 1);

    key(view, 'Tab');
    expect(view.state.doc.toString().split('\n')).toHaveLength(4);
    key(view, 'Enter', { shiftKey: true });
    expect(view.state.doc.toString()).toContain('<br>');
    key(view, '|');
    expect(view.state.doc.toString()).toContain('\\|');

    const delimiterPosition = view.state.doc.toString().indexOf('| --- |');
    setCursor(view, delimiterPosition + 1);
    const before = view.state.doc.toString();
    key(view, 'Backspace');
    expect(view.state.doc.toString()).toBe(before);
  });

  it('rejects typing before the first header cell while keeping cell content editable', () => {
    const view = createView('| H | V |\n| --- | --- |\n| A | B |', views);
    const original = view.state.doc.toString();

    view.dispatch({ changes: { from: 0, insert: 'broken' } });
    expect(view.state.doc.toString()).toBe(original);

    const header = cell(view, 0, 0);
    const position = Number(header.dataset['cellFrom']);
    view.dispatch({ selection: EditorSelection.cursor(position) });
    view.dispatch(view.state.replaceSelection('safe'));
    expect(view.state.doc.toString()).toBe('| safeH | V |\n| --- | --- |\n| A | B |');
  });

  it('moves predictably across cell boundaries and vertically in the same column', () => {
    const source = '| ABC | D |\n| --- | --- |\n| xy | zzzz |';
    const view = createView(source, views);
    const headerStart = source.indexOf('ABC');
    const secondHeaderStart = source.indexOf('D');
    const bodyStart = source.indexOf('xy');

    setCursor(view, headerStart + 3);
    expect(key(view, 'ArrowRight').defaultPrevented).toBe(true);
    expect(view.state.selection.main.head).toBe(secondHeaderStart);

    expect(key(view, 'ArrowLeft').defaultPrevented).toBe(true);
    expect(view.state.selection.main.head).toBe(headerStart + 3);

    setCursor(view, headerStart + 1);
    expect(key(view, 'ArrowDown').defaultPrevented).toBe(true);
    expect(view.state.selection.main.head).toBe(bodyStart + 1);

    expect(key(view, 'ArrowUp').defaultPrevented).toBe(true);
    expect(view.state.selection.main.head).toBe(headerStart + 1);

    setCursor(view, headerStart + 1);
    expect(key(view, 'ArrowRight').defaultPrevented).toBe(false);
    expect(view.state.selection.main.head).toBe(headerStart + 1);
  });

  it('keeps horizontal arrows inside the outer table edges', () => {
    const source = 'before\n\n| ABC | D |\n| --- | --- |\n| xy | zzzz |\n\nafter';
    const view = createView(source, views);
    const firstCellStart = source.indexOf('ABC');
    const lastCellEnd = source.indexOf('zzzz') + 'zzzz'.length;
    const scrollRenderedCell = jest.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollRenderedCell,
    });

    setCursor(view, firstCellStart);
    expect(key(view, 'ArrowLeft').defaultPrevented).toBe(true);
    expect(view.state.selection.main.head).toBe(firstCellStart);

    setCursor(view, lastCellEnd);
    expect(key(view, 'ArrowRight').defaultPrevented).toBe(true);
    expect(view.state.selection.main.head).toBe(lastCellEnd);
    expect(scrollRenderedCell).not.toHaveBeenCalled();
  });

  it('leaves the top edge explicitly while preserving native movement below the table', () => {
    const source = 'before\n\n| ABC | D |\n| --- | --- |\n| xy | zzzz |\n\nafter';
    const view = createView(source, views);
    const firstRowPosition = source.indexOf('ABC') + 1;
    const lastRowPosition = source.indexOf('xy') + 1;
    const adjacentLineAbove = view.state.doc.line(2);

    setCursor(view, firstRowPosition);
    expect(key(view, 'ArrowUp').defaultPrevented).toBe(true);
    expect(view.state.selection.main.head).toBe(adjacentLineAbove.from);

    setCursor(view, lastRowPosition);
    expect(key(view, 'ArrowDown').defaultPrevented).toBe(false);
    expect(view.state.selection.main.head).toBe(lastRowPosition);
  });

  it('scrolls rendered target cells instead of hidden source geometry in both directions', () => {
    const source = '| ABC | D |\n| --- | --- |\n| xy | zzzz |';
    const view = createView(source, views);
    const previousCellEnd = source.indexOf('ABC') + 'ABC'.length;
    const currentCellStart = source.indexOf('D');
    const scrollRenderedCell = jest.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollRenderedCell,
    });
    const scrollRequests: boolean[] = [];
    view.dispatch({
      effects: StateEffect.appendConfig.of(
        EditorView.updateListener.of((update) => {
          scrollRequests.push(
            ...update.transactions.map((transaction) => transaction.scrollIntoView),
          );
        }),
      ),
    });
    setCursor(view, currentCellStart);
    scrollRequests.splice(0);

    expect(key(view, 'ArrowLeft').defaultPrevented).toBe(true);

    expect(view.state.selection.main.head).toBe(previousCellEnd);
    expect(view.state.selection.main.assoc).toBe(-1);
    expect(scrollRequests).toEqual([false]);
    expect(scrollRenderedCell).toHaveBeenCalledWith({
      block: 'nearest',
      inline: 'nearest',
    });
    expect(scrollRenderedCell.mock.instances[0]).toBe(cell(view, 0, 0));

    expect(key(view, 'ArrowRight').defaultPrevented).toBe(true);

    expect(view.state.selection.main.head).toBe(currentCellStart);
    expect(scrollRequests).toEqual([false, false]);
    expect(scrollRenderedCell).toHaveBeenCalledTimes(2);
    expect(scrollRenderedCell.mock.instances[1]).toBe(cell(view, 0, 1));
  });

  it('scrolls rendered target cells instead of hidden source geometry vertically', () => {
    const source = '| ABC | D |\n| --- | --- |\n| xy | zzzz |';
    const view = createView(source, views);
    const headerPosition = source.indexOf('ABC') + 1;
    const bodyPosition = source.indexOf('xy') + 1;
    const scrollRenderedCell = jest.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollRenderedCell,
    });
    const scrollRequests: boolean[] = [];
    view.dispatch({
      effects: StateEffect.appendConfig.of(
        EditorView.updateListener.of((update) => {
          scrollRequests.push(
            ...update.transactions.map((transaction) => transaction.scrollIntoView),
          );
        }),
      ),
    });
    setCursor(view, headerPosition);
    scrollRequests.splice(0);

    expect(key(view, 'ArrowDown').defaultPrevented).toBe(true);

    expect(view.state.selection.main.head).toBe(bodyPosition);
    expect(scrollRequests).toEqual([false]);
    expect(scrollRenderedCell).toHaveBeenCalledWith({
      block: 'nearest',
      inline: 'nearest',
    });
    expect(scrollRenderedCell.mock.instances[0]).toBe(cell(view, 1, 0));

    expect(key(view, 'ArrowUp').defaultPrevented).toBe(true);

    expect(view.state.selection.main.head).toBe(headerPosition);
    expect(scrollRequests).toEqual([false, false]);
    expect(scrollRenderedCell).toHaveBeenCalledTimes(2);
    expect(scrollRenderedCell.mock.instances[1]).toBe(cell(view, 0, 0));
  });

  it('enters the rendered table from the ordinary line above without scrolling source geometry', () => {
    const source = 'above\n\n| ABC | D |\n| --- | --- |\n| xy | zzzz |';
    const view = createView(source, views);
    const lineAbove = view.state.doc.line(2);
    const headerPosition = source.indexOf('ABC') + 1;
    const scrollRenderedCell = jest.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollRenderedCell,
    });
    const scrollRequests: boolean[] = [];
    view.dispatch({
      effects: StateEffect.appendConfig.of(
        EditorView.updateListener.of((update) => {
          scrollRequests.push(
            ...update.transactions.map((transaction) => transaction.scrollIntoView),
          );
        }),
      ),
    });
    setCursor(view, lineAbove.from);
    jest.spyOn(view, 'moveVertically').mockReturnValue(EditorSelection.cursor(headerPosition));
    scrollRequests.splice(0);

    expect(key(view, 'ArrowDown').defaultPrevented).toBe(true);

    expect(view.state.selection.main.head).toBe(headerPosition);
    expect(scrollRequests).toEqual([false]);
    expect(scrollRenderedCell).toHaveBeenCalledWith({
      block: 'nearest',
      inline: 'nearest',
    });
    expect(scrollRenderedCell.mock.instances[0]).toBe(cell(view, 0, 0));
  });

  it('enters the rendered table without source scrolling after a vertical geometry jump', () => {
    const source = 'above\n\n| ABC | D |\n| --- | --- |\n| xy | zzzz |';
    const view = createView(source, views);
    const lineAbove = view.state.doc.line(2);
    const headerStart = source.indexOf('ABC');
    const bodyStart = source.indexOf('xy');
    const scrollRenderedCell = jest.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollRenderedCell,
    });
    const scrollRequests: boolean[] = [];
    view.dispatch({
      effects: StateEffect.appendConfig.of(
        EditorView.updateListener.of((update) => {
          scrollRequests.push(
            ...update.transactions.map((transaction) => transaction.scrollIntoView),
          );
        }),
      ),
    });
    setCursor(view, lineAbove.from);
    jest.spyOn(view, 'moveVertically').mockReturnValue(EditorSelection.cursor(bodyStart));
    scrollRequests.splice(0);

    expect(key(view, 'ArrowDown').defaultPrevented).toBe(true);

    expect(view.state.selection.main.head).toBe(headerStart);
    expect(scrollRequests).toEqual([false]);
    expect(scrollRenderedCell).toHaveBeenCalledWith({
      block: 'nearest',
      inline: 'nearest',
    });
    expect(scrollRenderedCell.mock.instances[0]).toBe(cell(view, 0, 0));
  });

  it('uses the rendered adjacent row when a horizontal arrow crosses a row boundary', () => {
    const source = '| ABC | D |\n| --- | --- |\n| xy | zzzz |';
    const view = createView(source, views);
    const secondHeaderEnd = source.indexOf('D') + 'D'.length;
    const firstBodyStart = source.indexOf('xy');
    const scrollRenderedCell = jest.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollRenderedCell,
    });

    setCursor(view, secondHeaderEnd);
    expect(key(view, 'ArrowRight').defaultPrevented).toBe(true);

    expect(view.state.selection.main.head).toBe(firstBodyStart);
    expect(scrollRenderedCell.mock.instances[0]).toBe(cell(view, 1, 0));

    setCursor(view, firstBodyStart);
    scrollRenderedCell.mockClear();
    expect(key(view, 'ArrowLeft').defaultPrevented).toBe(true);

    expect(view.state.selection.main.head).toBe(secondHeaderEnd);
    expect(scrollRenderedCell.mock.instances[0]).toBe(cell(view, 0, 1));
  });

  it('repairs a vertical geometry jump from ordinary text below a table', () => {
    const source = `${VALID_TABLE}\n\nbelow one\nbelow two\nbelow three`;
    const view = createView(source, views);
    const lastLine = view.state.doc.line(view.state.doc.lines);
    const previousLine = view.state.doc.line(lastLine.number - 1);
    setCursor(view, lastLine.to);
    jest
      .spyOn(view, 'moveVertically')
      .mockReturnValue(EditorSelection.cursor(source.indexOf('| B | 10 |')));

    expect(key(view, 'ArrowUp').defaultPrevented).toBe(true);
    expect(view.state.doc.lineAt(view.state.selection.main.head).number).toBe(previousLine.number);
    expect(view.state.selection.main.head).toBe(previousLine.to);
  });

  it('shows a compact delimiter, hides its line number, and preserves surrounding line geometry', () => {
    const source = `before\n${VALID_TABLE}\n\nafter`;
    const view = createView(source, views, true);
    const continuationMarkers = [
      ...view.dom.querySelectorAll<HTMLElement>('.cm-markdown-table-continuation-gutter'),
    ];
    const gutterElements = [...view.dom.querySelectorAll<HTMLElement>('.cm-gutterElement')];
    const headerBlock = view.lineBlockAt(source.indexOf('| Name'));
    const firstBodyBlock = view.lineBlockAt(source.indexOf('| A |'));
    const finalBodyBlock = view.lineBlockAt(source.indexOf('| B |'));
    const afterBlock = view.lineBlockAt(source.indexOf('after'));

    expect(continuationMarkers.map((marker) => marker.textContent)).toEqual(['3', '5']);
    expect(
      continuationMarkers.every((marker) => getComputedStyle(marker).visibility === 'hidden'),
    ).toBe(true);
    expect(gutterElements.some((marker) => marker.textContent === '4')).toBe(false);
    expect(gutterElements.find((marker) => marker.textContent === '2')?.classList).not.toContain(
      'cm-markdown-table-continuation-gutter',
    );
    expect(view.dom.querySelectorAll('.cm-markdown-table-delimiter')).toHaveLength(0);
    const delimiter = view.dom.querySelector<HTMLElement>('.cm-markdown-table-delimiter-block');
    const delimiterLine = view.dom.querySelector<HTMLElement>(
      '.cm-line.cm-markdown-table-delimiter-line',
    );
    expect(delimiter).not.toBeNull();
    expect(getComputedStyle(delimiter!).height).toBe('0px');
    expect(getComputedStyle(delimiter!).lineHeight).toBe('0');
    expect(delimiterLine).not.toBeNull();
    expect(getComputedStyle(delimiterLine!).height).toBe('0px');
    expect(getComputedStyle(delimiterLine!).lineHeight).toBe('0');
    expect(getComputedStyle(delimiterLine!).padding).toBe('0px');
    expect(
      [...view.dom.querySelectorAll<HTMLElement>('[role="columnheader"]')].every(
        (cell) =>
          getComputedStyle(cell).backgroundSize === '100% 3px' &&
          getComputedStyle(cell).borderBottomWidth === '1px',
      ),
    ).toBe(true);
    expect(
      view.dom.querySelectorAll('.cm-markdown-table-editor > .cm-markdown-table-row'),
    ).toHaveLength(3);
    expect(firstBodyBlock.top).toBe(headerBlock.top + headerBlock.height);
    expect(afterBlock.top).toBeGreaterThanOrEqual(finalBodyBlock.top + finalBodyBlock.height);
  });

  it('keeps structural actions available for range-aware context commands', () => {
    const view = createView(VALID_TABLE, views);
    selectCells(view, [1, 1], [2, 1]);

    expect(runMarkdownTableAction(view, 'sortDescending')).toBe(true);
    expect(view.state.doc.toString()).toContain('| B | 10 |\n| A | 2 |');
    expect(runMarkdownTableAction(view, 'alignCenter')).toBe(true);
    expect(view.state.doc.toString()).toContain(':---:');
    expect(runMarkdownTableAction(view, 'format')).toBe(true);
    expect(view.state.doc.toString()).toMatch(/^\| .+ \|$/m);
  });
});

function createView(doc: string, views: EditorView[], withLineNumbers = false): EditorView {
  const parent = document.createElement('div');
  document.body.append(parent);
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        markdown({ base: markdownLanguage }),
        history(),
        ...(withLineNumbers ? [lineNumbers()] : []),
        markdownTableEditor(config),
      ],
    }),
  });
  views.push(view);
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

function button(view: EditorView, label: string): HTMLButtonElement {
  const result = view.dom.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (result === null) {
    throw new Error(`Missing button ${label}`);
  }
  return result;
}

function buttonInTable(view: EditorView, tableIndex: number, label: string): HTMLButtonElement {
  const table = view.dom.querySelectorAll<HTMLElement>('.cm-markdown-table-editor')[tableIndex];
  const result = table?.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (result === null || result === undefined) {
    throw new Error(`Missing button ${label} in table ${tableIndex}`);
  }
  return result;
}

function dragPointer(
  source: HTMLButtonElement,
  target: HTMLButtonElement,
  axis: 'row' | 'column',
  placement: 'before' | 'after',
  pointerType: (typeof POINTER_TYPES)[number],
): void {
  pointer(source, 'pointerdown', { pointerType });
  pointAtDropTarget(target, axis);
  const coordinate = placement === 'before' ? 101 : 199;
  pointer(target, 'pointermove', {
    pointerType,
    ...(axis === 'row' ? { clientY: coordinate } : { clientX: coordinate }),
  });
  pointer(target, 'pointerup', {
    pointerType,
    ...(axis === 'row' ? { clientY: coordinate } : { clientX: coordinate }),
  });
}

function pointAtDropTarget(target: HTMLElement, axis: 'row' | 'column'): void {
  const start = 100;
  const size = 100;
  mockBounds(target, {
    left: axis === 'column' ? start : 0,
    top: axis === 'row' ? start : 0,
    width: axis === 'column' ? size : 20,
    height: axis === 'row' ? size : 20,
  });
}

function selectCells(
  view: EditorView,
  anchor: readonly [number, number],
  head: readonly [number, number],
): void {
  selectCellsWithPointer(view, anchor, head);
}

function selectCellsWithPointer(
  view: EditorView,
  anchor: readonly [number, number],
  head: readonly [number, number],
): MouseEvent {
  const start = cell(view, anchor[0], anchor[1]);
  pointer(start, 'pointerdown', { pointerType: 'mouse' });
  pointer(cell(view, head[0], head[1]), 'pointermove', { pointerType: 'mouse' });
  return pointer(cell(view, head[0], head[1]), 'pointerup', { pointerType: 'mouse' });
}

function pointer(
  target: HTMLElement,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel' | 'lostpointercapture',
  options: {
    pointerType: (typeof POINTER_TYPES)[number];
    shiftKey?: boolean;
    clientX?: number;
    clientY?: number;
    pointerId?: number;
    button?: number;
    isPrimary?: boolean;
  },
): MouseEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    shiftKey: options.shiftKey,
    clientX: options.clientX,
    clientY: options.clientY,
    button: options.button,
  });
  Object.defineProperty(event, 'pointerType', { value: options.pointerType });
  Object.defineProperty(event, 'pointerId', { value: options.pointerId ?? 1 });
  Object.defineProperty(event, 'isPrimary', { value: options.isPrimary ?? true });
  target.dispatchEvent(event);
  return event;
}

function contextMenu(target: HTMLElement): void {
  target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
}

function requiredMenu(view: EditorView): HTMLElement {
  const menu = view.dom.querySelector<HTMLElement>('[role="menu"]');
  if (menu === null) {
    throw new Error('Missing table menu');
  }
  return menu;
}

function setCursor(view: EditorView, position: number): void {
  view.dispatch({ selection: { anchor: position } });
  view.focus();
}

function key(
  target: EditorView | HTMLElement,
  keyValue: string,
  options: { shiftKey?: boolean } = {},
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: keyValue,
    bubbles: true,
    cancelable: true,
    shiftKey: options.shiftKey,
  });
  (target instanceof EditorView ? target.contentDOM : target).dispatchEvent(event);
  return event;
}

function mockBounds(
  target: HTMLElement,
  bounds: {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
  },
): void {
  Object.defineProperty(target, 'getBoundingClientRect', {
    value: () => ({
      ...bounds,
      right: bounds.left + bounds.width,
      bottom: bounds.top + bounds.height,
      x: bounds.left,
      y: bounds.top,
      toJSON: (): string => '',
    }),
  });
}

function reorderValues<Value>(
  values: readonly Value[],
  selectedIndices: readonly number[],
  targetGap: number,
): Value[] {
  const selected = new Set(selectedIndices);
  const moving = selectedIndices.map((index) => values[index]!);
  const remaining = values.filter((_, index) => !selected.has(index));
  const removedBeforeGap = selectedIndices.filter((index) => index < targetGap).length;
  const insertionIndex = Math.max(0, Math.min(targetGap - removedBeforeGap, remaining.length));
  return [...remaining.slice(0, insertionIndex), ...moving, ...remaining.slice(insertionIndex)];
}

function remappedIndices(
  selectedIndices: readonly number[],
  targetGap: number,
  length: number,
): readonly number[] {
  const removedBeforeGap = selectedIndices.filter((index) => index < targetGap).length;
  const first = Math.max(0, Math.min(targetGap, length) - removedBeforeGap);
  return selectedIndices.map((_, offset) => first + offset);
}

function singleColumnTable(rows: readonly string[]): string {
  const [header, ...body] = rows;
  return [`| ${header} |`, '| --- |', ...body.map((value) => `| ${value} |`)].join('\n');
}

function reorderedColumnTable(order: readonly number[]): string {
  const headers = ['A', 'B', 'C', 'D'];
  const delimiters = [':---', ':---:', '---:', '---'];
  const body = ['1', '2', '3', '4'];
  return [
    `| ${order.map((index) => headers[index]).join(' | ')} |`,
    `| ${order.map((index) => delimiters[index]).join(' | ')} |`,
    `| ${order.map((index) => body[index]).join(' | ')} |`,
  ].join('\n');
}

function fourByFourTable(rowOrder: readonly number[], columnOrder: readonly number[]): string {
  const rows = rowOrder.map((row) => columnOrder.map((column) => `R${row + 1}C${column + 1}`));
  const [header, ...body] = rows;
  const delimiter = columnOrder.map(() => '---');
  return [
    `| ${header?.join(' | ')} |`,
    `| ${delimiter.join(' | ')} |`,
    ...body.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}
