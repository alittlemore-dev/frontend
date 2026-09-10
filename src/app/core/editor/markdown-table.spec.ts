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
  escapeMarkdownTableCell,
  formatMarkdownTable,
  insertMarkdownTableColumns,
  insertMarkdownTableRows,
  markdownTableSelectionToTsv,
  moveMarkdownTableColumns,
  moveMarkdownTableRows,
  parseMarkdownTable,
  parseMarkdownTableClipboard,
  serializeMarkdownTable,
  setMarkdownTableAlignment,
  sortMarkdownTableBody,
} from './markdown-table';

describe('Markdown table core', () => {
  it('parses valid tables without losing optional pipes, empty cells, inline Markdown, or prefixes', () => {
    const source =
      '> Name | Value | Empty\n> :--- | :---: | ---:\n> **Ada** | [[matrix:python\\|Python]] |  |\n> Grace | `a\\|b`';
    const table = requiredTable(source);

    expect(table.columnCount).toBe(3);
    expect(table.alignments).toEqual(['left', 'center', 'right']);
    expect(table.header.prefix).toBe('> ');
    expect(table.header.leadingPipe).toBe(false);
    expect(table.header.trailingPipe).toBe(false);
    expect(table.body[0]?.cells.map((cell) => cell.markdown)).toEqual([
      '**Ada**',
      '[[matrix:python\\|Python]]',
      '',
    ]);
    expect(serializeMarkdownTable(table)).toBe(source);
  });

  it('preserves list continuation prefixes, outer-pipe styles, CRLF, and a trailing newline', () => {
    const source = '- | A | B |\r\n  | --- | --- |\r\n  | 1 | 2 |\r\n';
    const table = requiredTable(source);

    expect(table.header.prefix).toBe('- ');
    expect(table.delimiter.prefix).toBe('  ');
    expect(table.body[0]?.prefix).toBe('  ');
    expect(serializeMarkdownTable(table)).toBe(source);
  });

  it('accepts one-column tables and headers without body rows', () => {
    const table = requiredTable('Only\n---');

    expect(table.columnCount).toBe(1);
    expect(table.body).toEqual([]);
  });

  it('round-trips uneven body rows without inventing or dropping cells', () => {
    const source = '| A | B |\n| --- | --- |\n| one |\n| two | three | extra |';
    const table = requiredTable(source);

    expect(table.columnCount).toBe(3);
    expect(table.body.map((row) => row.cells.length)).toEqual([1, 3]);
    expect(serializeMarkdownTable(table)).toBe(source);
  });

  it('rejects malformed tables', () => {
    expect(parseMarkdownTable('| A | B |\n| -- | --- |')).toBeNull();
    expect(parseMarkdownTable('| A | B |')).toBeNull();
    expect(parseMarkdownTable('| A | B |\n| --- |\n| 1 | 2 |')).toBeNull();
    expect(parseMarkdownTable('| A | B |\n| --- | nope |')).toBeNull();
  });

  it('inserts rows before and after a reference while preserving nested continuation prefixes', () => {
    const table = requiredTable('> | A | B |\n> | --- | --- |\n> | one | two |');

    expect(serializeMarkdownTable(insertMarkdownTableRows(table, 1, 'before', 1))).toBe(
      '> | A | B |\n> | --- | --- |\n> |  |  |\n> | one | two |',
    );
    expect(serializeMarkdownTable(insertMarkdownTableRows(table, 1, 'after', 2))).toBe(
      '> | A | B |\n> | --- | --- |\n> | one | two |\n> |  |  |\n> |  |  |',
    );
  });

  it('duplicates non-contiguous rows as one ordered block after the greatest selected row', () => {
    const table = requiredTable('| H |\n| --- |\n| one |\n| two |\n| three |\n| four |');

    expect(serializeMarkdownTable(duplicateMarkdownTableRows(table, [1, 3]))).toBe(
      '| H |\n| --- |\n| one |\n| two |\n| three |\n| one |\n| three |\n| four |',
    );
  });

  it('clears selected rows and promotes the next row when deleting the header', () => {
    const table = requiredTable('| H | V |\n| --- | --- |\n| one | 1 |\n| two | 2 |');

    expect(serializeMarkdownTable(clearMarkdownTableRows(table, [2]))).toBe(
      '| H | V |\n| --- | --- |\n| one | 1 |\n|  |  |',
    );
    const deleted = deleteMarkdownTableRows(table, [0]);
    expect(deleted.ok).toBe(true);
    if (deleted.ok) {
      expect(serializeMarkdownTable(deleted.table)).toBe('| one | 1 |\n| --- | --- |\n| two | 2 |');
    }
  });

  it('preserves one blank body row when deleting the last remaining data row', () => {
    const table = requiredTable('| H | V |\n| --- | --- |\n| one | 1 |');
    const deletedBody = deleteMarkdownTableRows(table, [1]);

    expect(deletedBody.ok).toBe(true);
    if (deletedBody.ok) {
      expect(serializeMarkdownTable(deletedBody.table)).toBe('| H | V |\n| --- | --- |\n|  |  |');
    }

    const deletedHeader = deleteMarkdownTableRows(table, [0]);
    expect(deletedHeader.ok).toBe(true);
    if (deletedHeader.ok) {
      expect(serializeMarkdownTable(deletedHeader.table)).toBe(
        '| one | 1 |\n| --- | --- |\n|  |  |',
      );
    }
  });

  it('moves non-contiguous rows as one block using insertion rather than swap semantics', () => {
    const table = requiredTable('| H |\n| --- |\n| one |\n| two |\n| three |\n| four |');

    expect(serializeMarkdownTable(moveMarkdownTableRows(table, [1, 3], 5))).toBe(
      '| H |\n| --- |\n| two |\n| four |\n| one |\n| three |',
    );
  });

  it('moves the header as a data row and promotes the row dropped before it', () => {
    const table = requiredTable('| H |\n| --- |\n| one |\n| two |');

    expect(serializeMarkdownTable(moveMarkdownTableRows(table, [0], 3))).toBe(
      '| one |\n| --- |\n| two |\n| H |',
    );
  });

  it('inserts, duplicates, clears, and moves columns without losing escaped content', () => {
    const table = requiredTable('| A | B | C |\n| --- | --- | --- |\n| a\\|1 | b | c |');
    const inserted = insertMarkdownTableColumns(table, 1, 'before', 1);
    const duplicated = duplicateMarkdownTableColumns(inserted, [0, 2]);
    const cleared = clearMarkdownTableColumns(duplicated, [1]);
    const moved = moveMarkdownTableColumns(cleared, [0, 3], 6);

    expect(serializeMarkdownTable(moved)).toBe(
      '|  | B | B | C | A | A |\n' +
        '| --- | --- | --- | --- | --- | --- |\n' +
        '|  | b | b | c | a\\|1 | a\\|1 |',
    );
  });

  it('does not delete the final column', () => {
    const oneColumn = requiredTable('| H |\n| --- |\n| value |');
    expect(deleteMarkdownTableColumns(oneColumn, [0])).toEqual({
      ok: false,
      reason: 'last-column-required',
    });

    const twoColumns = requiredTable('| A | B |\n| --- | --- |\n| 1 | 2 |');
    const deleted = deleteMarkdownTableColumns(twoColumns, [0]);
    expect(deleted.ok).toBe(true);
    if (deleted.ok) {
      expect(serializeMarkdownTable(deleted.table)).toBe('| B |\n| --- |\n| 2 |');
    }
  });

  it('sorts body rows naturally and stably while keeping empty values last', () => {
    const table = requiredTable(
      '| Name | Rank |\n| --- | --- |\n| item 10 | b |\n|  | empty |\n| item 2 | first |\n| item 2 | second |',
    );

    expect(serializeMarkdownTable(sortMarkdownTableBody(table, 0, 'ascending', 'en'))).toBe(
      '| Name | Rank |\n' +
        '| --- | --- |\n' +
        '| item 2 | first |\n' +
        '| item 2 | second |\n' +
        '| item 10 | b |\n' +
        '|  | empty |',
    );
    expect(serializeMarkdownTable(sortMarkdownTableBody(table, 0, 'descending', 'en'))).toBe(
      '| Name | Rank |\n' +
        '| --- | --- |\n' +
        '| item 10 | b |\n' +
        '| item 2 | first |\n' +
        '| item 2 | second |\n' +
        '|  | empty |',
    );
  });

  it('sets multiple alignments and explicitly formats a canonical padded table', () => {
    const table = requiredTable('A | Longer\n--- | :---:\nx | **wide**');
    const aligned = setMarkdownTableAlignment(table, [0, 1], 'right');

    expect(aligned.alignments).toEqual(['right', 'right']);
    expect(formatMarkdownTable(aligned)).toBe(
      '| A    | Longer   |\n| ---: | -------: |\n| x    | **wide** |',
    );
  });

  it('classifies rectangular selections using table, row, column, then cell priority', () => {
    const table = requiredTable('| A | B | C |\n| --- | --- | --- |\n| 1 | 2 | 3 |\n| 4 | 5 | 6 |');

    expect(
      classifyMarkdownTableSelection(table, range({ row: 0, column: 0 }, { row: 2, column: 2 })),
    ).toBe('table');
    expect(
      classifyMarkdownTableSelection(table, range({ row: 1, column: 0 }, { row: 2, column: 2 })),
    ).toBe('rows');
    expect(
      classifyMarkdownTableSelection(table, range({ row: 0, column: 1 }, { row: 2, column: 2 })),
    ).toBe('columns');
    expect(
      classifyMarkdownTableSelection(table, range({ row: 1, column: 1 }, { row: 2, column: 2 })),
    ).toBe('cells');
  });

  it('adaptively deletes the table, rows, columns, or only cell contents', () => {
    const table = requiredTable('| A | B | C |\n| --- | --- | --- |\n| 1 | 2 | 3 |\n| 4 | 5 | 6 |');

    expect(
      deleteMarkdownTableSelection(table, range({ row: 0, column: 0 }, { row: 2, column: 2 })),
    ).toEqual({ kind: 'table' });

    const rows = deleteMarkdownTableSelection(
      table,
      range({ row: 1, column: 0 }, { row: 1, column: 2 }),
    );
    expect(rows.kind).toBe('rows');
    if (rows.kind === 'rows') {
      expect(serializeMarkdownTable(rows.table)).toBe(
        '| A | B | C |\n| --- | --- | --- |\n| 4 | 5 | 6 |',
      );
    }

    const columns = deleteMarkdownTableSelection(
      table,
      range({ row: 0, column: 1 }, { row: 2, column: 1 }),
    );
    expect(columns.kind).toBe('columns');
    if (columns.kind === 'columns') {
      expect(serializeMarkdownTable(columns.table)).toBe(
        '| A | C |\n| --- | --- |\n| 1 | 3 |\n| 4 | 6 |',
      );
    }

    const cells = deleteMarkdownTableSelection(
      table,
      range({ row: 1, column: 1 }, { row: 2, column: 2 }),
    );
    expect(cells.kind).toBe('cells');
    if (cells.kind === 'cells') {
      expect(serializeMarkdownTable(cells.table)).toBe(
        '| A | B | C |\n| --- | --- | --- |\n| 1 |  |  |\n| 4 |  |  |',
      );
    }
  });

  it('clears only the contents of a rectangular cell selection', () => {
    const table = requiredTable('| A | B | C |\n| --- | --- | --- |\n| 1 | 2 | 3 |\n| 4 | 5 | 6 |');

    expect(
      serializeMarkdownTable(
        clearMarkdownTableSelection(table, range({ row: 0, column: 1 }, { row: 1, column: 2 })),
      ),
    ).toBe('| A |  |  |\n| --- | --- | --- |\n| 1 |  |  |\n| 4 | 5 | 6 |');
  });

  it('copies rectangular selections as consistently quoted TSV', () => {
    const table = requiredTable('| A | B |\n| --- | --- |\n| one | x |\n| two<br>lines | a"b |');

    expect(
      markdownTableSelectionToTsv(table, range({ row: 1, column: 0 }, { row: 2, column: 1 })),
    ).toBe('one\tx\n"two\nlines"\t"a""b"');
    expect(
      markdownTableSelectionToTsv(table, range({ row: 0, column: 1 }, { row: 2, column: 1 })),
    ).toBe('B\nx\n"a""b"');
  });

  it('parses TSV, consistent quoted CSV, and multiline text into grids', () => {
    expect(parseMarkdownTableClipboard('a\tb\nc\td')).toEqual({
      rows: [
        ['a', 'b'],
        ['c', 'd'],
      ],
    });
    expect(parseMarkdownTableClipboard('a,"b,b","line\nbreak","a""b"\nc,d,e,f')).toEqual({
      rows: [
        ['a', 'b,b', 'line<br>break', 'a"b'],
        ['c', 'd', 'e', 'f'],
      ],
    });
    expect(parseMarkdownTableClipboard('first\nsecond\nthird')).toEqual({
      rows: [['first'], ['second'], ['third']],
    });
    expect(parseMarkdownTableClipboard('not,consistent\nplain')).toEqual({
      rows: [['not,consistent'], ['plain']],
    });
  });

  it('escapes literal pipes without double-escaping existing escaped pipes', () => {
    expect(escapeMarkdownTableCell('a|b \\| c \\\\| d')).toBe('a\\|b \\| c \\\\\\| d');
  });

  it('pastes from the active cell and expands rows and columns', () => {
    const table = requiredTable('| A |\n| --- |\n| old |');
    const grid = parseMarkdownTableClipboard('x,y\nz,w');
    const result = applyMarkdownTableGrid(table, 1, 0, grid);

    expect(serializeMarkdownTable(result)).toBe('| A |  |\n| --- | --- |\n| x | y |\n| z | w |');
  });
});

function requiredTable(source: string): NonNullable<ReturnType<typeof parseMarkdownTable>> {
  const table = parseMarkdownTable(source);
  expect(table).not.toBeNull();
  if (table === null) {
    throw new Error('Expected a valid Markdown table');
  }
  return table;
}

function range(
  anchor: { readonly row: number; readonly column: number },
  head: { readonly row: number; readonly column: number },
) {
  return { anchor, head };
}
