export type MarkdownTableAlignment = 'none' | 'left' | 'center' | 'right';
export type MarkdownTablePlacement = 'before' | 'after';
export type MarkdownTableSortDirection = 'ascending' | 'descending';
export type MarkdownTableSelectionKind = 'table' | 'rows' | 'columns' | 'cells';

export interface MarkdownTableCell {
  readonly markdown: string;
  readonly before: string;
  readonly after: string;
}

export interface MarkdownTableRow {
  readonly prefix: string;
  readonly leadingPipe: boolean;
  readonly trailingPipe: boolean;
  readonly suffix: string;
  readonly cells: readonly MarkdownTableCell[];
}

export interface MarkdownTable {
  readonly lineEnding: '\n' | '\r\n';
  readonly trailingNewline: boolean;
  readonly header: MarkdownTableRow;
  readonly delimiter: MarkdownTableRow;
  readonly body: readonly MarkdownTableRow[];
  readonly alignments: readonly MarkdownTableAlignment[];
  readonly columnCount: number;
}

export interface MarkdownTableCellPosition {
  readonly row: number;
  readonly column: number;
}

export interface MarkdownTableCellRange {
  readonly anchor: MarkdownTableCellPosition;
  readonly head: MarkdownTableCellPosition;
}

export interface MarkdownTableSelectionBounds {
  readonly minRow: number;
  readonly maxRow: number;
  readonly minColumn: number;
  readonly maxColumn: number;
}

export interface MarkdownTableGrid {
  readonly rows: readonly (readonly string[])[];
}

export type MarkdownTableDeleteResult =
  | { readonly ok: true; readonly table: MarkdownTable }
  | {
      readonly ok: false;
      readonly reason: 'table-required' | 'last-column-required';
    };

export type MarkdownTableSelectionDeleteResult =
  | { readonly kind: 'table' }
  | {
      readonly kind: Exclude<MarkdownTableSelectionKind, 'table'>;
      readonly table: MarkdownTable;
    };

interface ParsedDelimitedText {
  readonly valid: boolean;
  readonly rows: readonly (readonly string[])[];
}

const DELIMITER_CELL_PATTERN = /^(:)?(-{3,})(:)?$/;
const BLOCK_CONTAINER_PATTERN = /^((?:[ \t]{0,3}>[ \t]*)+(?:(?:[-+*]|\d+[.)])[ \t]+)?)(.*)$/;
const LIST_CONTAINER_PATTERN = /^([ \t]*(?:[-+*]|\d+[.)])[ \t]+)(.*)$/;

export function parseMarkdownTable(source: string): MarkdownTable | null {
  const lineEnding: '\n' | '\r\n' = source.includes('\r\n') ? '\r\n' : '\n';
  const trailingNewline = source.endsWith('\n');
  const normalized = source.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  if (trailingNewline) {
    lines.pop();
  }
  if (lines.length < 2 || lines.some((line) => line.length === 0)) {
    return null;
  }

  const rows = lines.map(parseRow);
  const header = rows[0];
  const delimiter = rows[1];
  if (header === undefined || delimiter === undefined || header.cells.length === 0) {
    return null;
  }
  if (
    delimiter.cells.length !== header.cells.length ||
    delimiter.cells.some((cell) => parseAlignment(cell.markdown) === null)
  ) {
    return null;
  }

  const body = rows.slice(2);
  const columnCount = Math.max(
    header.cells.length,
    delimiter.cells.length,
    ...body.map((row) => row.cells.length),
  );
  const parsedAlignments = delimiter.cells.map((cell) => parseAlignment(cell.markdown));
  const alignments: MarkdownTableAlignment[] = Array.from(
    { length: columnCount },
    (_, index) => parsedAlignments[index] ?? 'none',
  );

  return {
    lineEnding,
    trailingNewline,
    header,
    delimiter,
    body,
    alignments,
    columnCount,
  };
}

export function serializeMarkdownTable(table: MarkdownTable): string {
  const lines = [
    serializeRow(table.header),
    serializeRow(table.delimiter),
    ...table.body.map(serializeRow),
  ];
  return `${lines.join(table.lineEnding)}${table.trailingNewline ? table.lineEnding : ''}`;
}

export function insertMarkdownTableRows(
  table: MarkdownTable,
  referenceRowIndex: number,
  placement: MarkdownTablePlacement,
  count: number,
): MarkdownTable {
  if (count <= 0) {
    return table;
  }
  const rows = semanticRows(table);
  const insertionIndex = clamp(
    placement === 'before' ? referenceRowIndex : referenceRowIndex + 1,
    0,
    rows.length,
  );
  const template = rows[clamp(referenceRowIndex, 0, rows.length - 1)];
  const inserted = Array.from({ length: count }, () => blankBodyRow(table, template));
  return withSemanticRows(table, [
    ...rows.slice(0, insertionIndex),
    ...inserted,
    ...rows.slice(insertionIndex),
  ]);
}

export function duplicateMarkdownTableRows(
  table: MarkdownTable,
  selectedRowIndices: readonly number[],
): MarkdownTable {
  const rows = semanticRows(table);
  const indices = normalizedIndices(selectedRowIndices, 0, rows.length - 1);
  if (indices.length === 0) {
    return table;
  }
  const duplicates = indices.map((index) => cloneRow(requiredRow(rows, index)));
  const insertionIndex = requiredLast(indices) + 1;
  return withSemanticRows(table, [
    ...rows.slice(0, insertionIndex),
    ...duplicates,
    ...rows.slice(insertionIndex),
  ]);
}

export function clearMarkdownTableRows(
  table: MarkdownTable,
  selectedRowIndices: readonly number[],
): MarkdownTable {
  const indices = new Set(normalizedIndices(selectedRowIndices, 0, table.body.length));
  const header = indices.has(0) ? clearRow(table.header, table.columnCount) : table.header;
  const body = table.body.map((row, index) =>
    indices.has(index + 1) ? clearRow(row, table.columnCount) : row,
  );
  return { ...table, header, body };
}

export function deleteMarkdownTableRows(
  table: MarkdownTable,
  selectedRowIndices: readonly number[],
): MarkdownTableDeleteResult {
  const rows = semanticRows(table);
  const indices = normalizedIndices(selectedRowIndices, 0, rows.length - 1);
  const selected = new Set(indices);
  const remaining = rows.filter((_, index) => !selected.has(index));
  if (remaining.length < 1) {
    return { ok: false, reason: 'table-required' };
  }
  const semanticRowsAfterDeletion =
    remaining.length === 1 ? [...remaining, blankBodyRow(table, remaining[0])] : remaining;
  return {
    ok: true,
    table: withSemanticRows(table, semanticRowsAfterDeletion),
  };
}

export function moveMarkdownTableRows(
  table: MarkdownTable,
  selectedRowIndices: readonly number[],
  targetRowGap: number,
): MarkdownTable {
  const rows = semanticRows(table);
  const semanticIndices = normalizedIndices(selectedRowIndices, 0, rows.length - 1);
  if (semanticIndices.length === 0) {
    return table;
  }
  const selected = new Set(semanticIndices);
  const moving = semanticIndices.map((index) => requiredRow(rows, index));
  const remaining = rows.filter((_, index) => !selected.has(index));
  const originalGap = clamp(targetRowGap, 0, rows.length);
  const removedBeforeGap = semanticIndices.filter((index) => index < originalGap).length;
  const insertionIndex = clamp(originalGap - removedBeforeGap, 0, remaining.length);
  return withSemanticRows(table, [
    ...remaining.slice(0, insertionIndex),
    ...moving,
    ...remaining.slice(insertionIndex),
  ]);
}

export function insertMarkdownTableColumns(
  table: MarkdownTable,
  referenceColumnIndex: number,
  placement: MarkdownTablePlacement,
  count: number,
): MarkdownTable {
  if (count <= 0) {
    return table;
  }
  const insertionIndex = clamp(
    placement === 'before' ? referenceColumnIndex : referenceColumnIndex + 1,
    0,
    table.columnCount,
  );
  const alignments = [...table.alignments];
  alignments.splice(insertionIndex, 0, ...Array<MarkdownTableAlignment>(count).fill('none'));
  return rebuildColumns(
    table,
    (cells, kind) => {
      const expanded = padCells(cells, table.columnCount, kind);
      expanded.splice(
        insertionIndex,
        0,
        ...Array.from({ length: count }, () =>
          kind === 'delimiter' ? delimiterCell('none') : canonicalCell(''),
        ),
      );
      return expanded;
    },
    alignments,
  );
}

export function duplicateMarkdownTableColumns(
  table: MarkdownTable,
  selectedColumnIndices: readonly number[],
): MarkdownTable {
  const indices = normalizedIndices(selectedColumnIndices, 0, table.columnCount - 1);
  if (indices.length === 0) {
    return table;
  }
  const insertionIndex = requiredLast(indices) + 1;
  const alignments = [...table.alignments];
  alignments.splice(
    insertionIndex,
    0,
    ...indices.map((index) => table.alignments[index] ?? 'none'),
  );
  return rebuildColumns(
    table,
    (cells, kind) => {
      const expanded = padCells(cells, table.columnCount, kind);
      expanded.splice(
        insertionIndex,
        0,
        ...indices.map((index) => cloneCell(requiredCell(expanded, index))),
      );
      return expanded;
    },
    alignments,
  );
}

export function clearMarkdownTableColumns(
  table: MarkdownTable,
  selectedColumnIndices: readonly number[],
): MarkdownTable {
  const selected = new Set(normalizedIndices(selectedColumnIndices, 0, table.columnCount - 1));
  return rebuildDataRows(table, (cells) =>
    padCells(cells, table.columnCount, 'data').map((cell, index) =>
      selected.has(index) ? canonicalCell('') : cell,
    ),
  );
}

export function deleteMarkdownTableColumns(
  table: MarkdownTable,
  selectedColumnIndices: readonly number[],
): MarkdownTableDeleteResult {
  const indices = normalizedIndices(selectedColumnIndices, 0, table.columnCount - 1);
  if (table.columnCount - indices.length < 1) {
    return { ok: false, reason: 'last-column-required' };
  }
  const selected = new Set(indices);
  const alignments = table.alignments.filter((_, index) => !selected.has(index));
  return {
    ok: true,
    table: rebuildColumns(
      table,
      (cells, kind) =>
        padCells(cells, table.columnCount, kind).filter((_, index) => !selected.has(index)),
      alignments,
    ),
  };
}

export function moveMarkdownTableColumns(
  table: MarkdownTable,
  selectedColumnIndices: readonly number[],
  targetColumnGap: number,
): MarkdownTable {
  const indices = normalizedIndices(selectedColumnIndices, 0, table.columnCount - 1);
  if (indices.length === 0) {
    return table;
  }
  const selected = new Set(indices);
  const originalGap = clamp(targetColumnGap, 0, table.columnCount);
  const removedBeforeGap = indices.filter((index) => index < originalGap).length;
  const insertionIndex = originalGap - removedBeforeGap;
  const reorder = <Value>(values: readonly Value[]): Value[] => {
    const moving = indices.map((index) => requiredValue(values, index));
    const remaining = values.filter((_, index) => !selected.has(index));
    return [...remaining.slice(0, insertionIndex), ...moving, ...remaining.slice(insertionIndex)];
  };
  return rebuildColumns(
    table,
    (cells, kind) => reorder(padCells(cells, table.columnCount, kind)),
    reorder(table.alignments),
  );
}

export function sortMarkdownTableBody(
  table: MarkdownTable,
  columnIndex: number,
  direction: MarkdownTableSortDirection,
  locale: string,
): MarkdownTable {
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
  const indexed = table.body.map((row, index) => ({ row, index }));
  indexed.sort((left, right) => {
    const leftValue = left.row.cells[columnIndex]?.markdown.trim() ?? '';
    const rightValue = right.row.cells[columnIndex]?.markdown.trim() ?? '';
    if (leftValue.length === 0 || rightValue.length === 0) {
      if (leftValue.length === rightValue.length) {
        return left.index - right.index;
      }
      return leftValue.length === 0 ? 1 : -1;
    }
    const compared = collator.compare(leftValue, rightValue);
    if (compared === 0) {
      return left.index - right.index;
    }
    return direction === 'ascending' ? compared : -compared;
  });
  return withBody(
    table,
    indexed.map(({ row }) => row),
  );
}

export function setMarkdownTableAlignment(
  table: MarkdownTable,
  selectedColumnIndices: readonly number[],
  alignment: Exclude<MarkdownTableAlignment, 'none'>,
): MarkdownTable {
  const selected = new Set(normalizedIndices(selectedColumnIndices, 0, table.columnCount - 1));
  const alignments = Array.from({ length: table.columnCount }, (_, index) =>
    selected.has(index) ? alignment : (table.alignments[index] ?? 'none'),
  );
  const delimiterCells = padCells(table.delimiter.cells, table.columnCount, 'delimiter').map(
    (cell, index) =>
      selected.has(index)
        ? { ...cell, markdown: delimiterMarker(alignment, minimumDelimiterWidth(alignment)) }
        : cell,
  );
  return {
    ...table,
    alignments,
    delimiter: { ...table.delimiter, cells: delimiterCells },
  };
}

export function formatMarkdownTable(table: MarkdownTable): string {
  const dataRows = [
    padCells(table.header.cells, table.columnCount, 'data'),
    ...table.body.map((row) => padCells(row.cells, table.columnCount, 'data')),
  ];
  const widths = Array.from({ length: table.columnCount }, (_, index) => {
    const contentWidth = Math.max(...dataRows.map((cells) => cells[index]?.markdown.length ?? 0));
    return Math.max(contentWidth, minimumDelimiterWidth(table.alignments[index] ?? 'none'));
  });
  const formatDataRow = (row: MarkdownTableRow): string =>
    canonicalFormattedRow(
      row.prefix,
      padCells(row.cells, table.columnCount, 'data').map((cell, index) =>
        cell.markdown.padEnd(requiredNumber(widths, index), ' '),
      ),
    );
  const delimiter = canonicalFormattedRow(
    table.delimiter.prefix,
    widths.map((width, index) => delimiterMarker(table.alignments[index] ?? 'none', width)),
  );
  const lines = [formatDataRow(table.header), delimiter, ...table.body.map(formatDataRow)];
  return `${lines.join(table.lineEnding)}${table.trailingNewline ? table.lineEnding : ''}`;
}

export function markdownTableSelectionBounds(
  table: MarkdownTable,
  selection: MarkdownTableCellRange,
): MarkdownTableSelectionBounds {
  const lastRow = table.body.length;
  const lastColumn = table.columnCount - 1;
  const anchorRow = clamp(selection.anchor.row, 0, lastRow);
  const headRow = clamp(selection.head.row, 0, lastRow);
  const anchorColumn = clamp(selection.anchor.column, 0, lastColumn);
  const headColumn = clamp(selection.head.column, 0, lastColumn);
  return {
    minRow: Math.min(anchorRow, headRow),
    maxRow: Math.max(anchorRow, headRow),
    minColumn: Math.min(anchorColumn, headColumn),
    maxColumn: Math.max(anchorColumn, headColumn),
  };
}

export function classifyMarkdownTableSelection(
  table: MarkdownTable,
  selection: MarkdownTableCellRange,
): MarkdownTableSelectionKind {
  const bounds = markdownTableSelectionBounds(table, selection);
  const allRows = bounds.minRow === 0 && bounds.maxRow === table.body.length;
  const allColumns = bounds.minColumn === 0 && bounds.maxColumn === table.columnCount - 1;
  if (allRows && allColumns) {
    return 'table';
  }
  if (allColumns) {
    return 'rows';
  }
  if (allRows) {
    return 'columns';
  }
  return 'cells';
}

export function clearMarkdownTableSelection(
  table: MarkdownTable,
  selection: MarkdownTableCellRange,
): MarkdownTable {
  const bounds = markdownTableSelectionBounds(table, selection);
  const rows = semanticRows(table).map((row, rowIndex) => {
    if (rowIndex < bounds.minRow || rowIndex > bounds.maxRow) {
      return row;
    }
    const cells = padCells(row.cells, table.columnCount, 'data').map((cell, columnIndex) =>
      columnIndex >= bounds.minColumn && columnIndex <= bounds.maxColumn ? canonicalCell('') : cell,
    );
    return { ...row, cells };
  });
  return withSemanticRows(table, rows);
}

export function deleteMarkdownTableSelection(
  table: MarkdownTable,
  selection: MarkdownTableCellRange,
): MarkdownTableSelectionDeleteResult {
  const kind = classifyMarkdownTableSelection(table, selection);
  if (kind === 'table') {
    return { kind };
  }
  const bounds = markdownTableSelectionBounds(table, selection);
  if (kind === 'rows') {
    const indices = inclusiveIndices(bounds.minRow, bounds.maxRow);
    const deleted = deleteMarkdownTableRows(table, indices);
    return deleted.ok ? { kind, table: deleted.table } : { kind: 'cells', table };
  }
  if (kind === 'columns') {
    const indices = inclusiveIndices(bounds.minColumn, bounds.maxColumn);
    const deleted = deleteMarkdownTableColumns(table, indices);
    return deleted.ok ? { kind, table: deleted.table } : { kind: 'cells', table };
  }
  return { kind, table: clearMarkdownTableSelection(table, selection) };
}

export function markdownTableSelectionToTsv(
  table: MarkdownTable,
  selection: MarkdownTableCellRange,
): string {
  const bounds = markdownTableSelectionBounds(table, selection);
  const grid = semanticRows(table)
    .slice(bounds.minRow, bounds.maxRow + 1)
    .map((row) =>
      padCells(row.cells, table.columnCount, 'data')
        .slice(bounds.minColumn, bounds.maxColumn + 1)
        .map((cell) => clipboardCellValue(cell.markdown)),
    );
  return grid.map((row) => row.map((cell) => quoteDelimitedCell(cell, '\t')).join('\t')).join('\n');
}

export function parseMarkdownTableClipboard(text: string): MarkdownTableGrid {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (containsUnquotedDelimiter(normalized, '\t')) {
    const tsv = parseDelimitedText(normalized, '\t');
    return { rows: normalizeImportedGrid(tsv.rows) };
  }
  if (containsUnquotedDelimiter(normalized, ',')) {
    const csv = parseDelimitedText(normalized, ',');
    const width = csv.rows[0]?.length ?? 0;
    if (
      csv.valid &&
      width > 1 &&
      csv.rows.length > 0 &&
      csv.rows.every((row) => row.length === width)
    ) {
      return { rows: normalizeImportedGrid(csv.rows) };
    }
  }
  const lines = normalized.split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return { rows: lines.map((line) => [normalizeImportedCell(line)]) };
}

export function escapeMarkdownTableCell(value: string): string {
  let result = '';
  let precedingBackslashes = 0;
  for (const character of value) {
    if (character === '|') {
      if (precedingBackslashes % 2 === 0) {
        result += '\\';
      }
      result += character;
      precedingBackslashes = 0;
      continue;
    }
    result += character;
    precedingBackslashes = character === '\\' ? precedingBackslashes + 1 : 0;
  }
  return result;
}

export function applyMarkdownTableGrid(
  table: MarkdownTable,
  startRowIndex: number,
  startColumnIndex: number,
  grid: MarkdownTableGrid,
): MarkdownTable {
  if (grid.rows.length === 0) {
    return table;
  }
  const gridWidth = Math.max(...grid.rows.map((row) => row.length), 0);
  if (gridWidth === 0) {
    return table;
  }
  const safeStartRow = Math.max(0, startRowIndex);
  const safeStartColumn = Math.max(0, startColumnIndex);
  const requiredColumns = safeStartColumn + gridWidth;
  let result =
    requiredColumns > table.columnCount
      ? insertMarkdownTableColumns(
          table,
          table.columnCount - 1,
          'after',
          requiredColumns - table.columnCount,
        )
      : table;
  const finalRowIndex = safeStartRow + grid.rows.length - 1;
  if (finalRowIndex > result.body.length) {
    result = insertMarkdownTableRows(
      result,
      result.body.length,
      'after',
      finalRowIndex - result.body.length,
    );
  }

  let header = result.header;
  const body = [...result.body];
  grid.rows.forEach((sourceRow, rowOffset) => {
    const semanticRowIndex = safeStartRow + rowOffset;
    const target = semanticRowIndex === 0 ? header : requiredRow(body, semanticRowIndex - 1);
    const cells = padCells(target.cells, result.columnCount, 'data');
    sourceRow.forEach((value, columnOffset) => {
      cells[safeStartColumn + columnOffset] = canonicalCell(
        escapeMarkdownTableCell(value.replace(/\r?\n/g, '<br>')),
      );
    });
    const updated = { ...target, cells };
    if (semanticRowIndex === 0) {
      header = updated;
    } else {
      body[semanticRowIndex - 1] = updated;
    }
  });
  return { ...result, header, body };
}

function parseRow(line: string): MarkdownTableRow {
  const { prefix, content } = splitPrefix(line);
  const firstNonWhitespace = content.search(/\S/);
  const leadingPipe =
    firstNonWhitespace >= 0 &&
    content[firstNonWhitespace] === '|' &&
    !isEscaped(content, firstNonWhitespace);
  const contentWithoutLeadingPipe = leadingPipe ? content.slice(firstNonWhitespace + 1) : content;
  const prefixWithWhitespace = leadingPipe
    ? `${prefix}${content.slice(0, firstNonWhitespace)}`
    : prefix;
  const lastNonWhitespace = findLastNonWhitespace(contentWithoutLeadingPipe);
  const trailingPipe =
    lastNonWhitespace >= 0 &&
    contentWithoutLeadingPipe[lastNonWhitespace] === '|' &&
    !isEscaped(contentWithoutLeadingPipe, lastNonWhitespace);
  const suffix = trailingPipe ? contentWithoutLeadingPipe.slice(lastNonWhitespace + 1) : '';
  const cellsSource = trailingPipe
    ? contentWithoutLeadingPipe.slice(0, lastNonWhitespace)
    : contentWithoutLeadingPipe;
  const segments = splitUnescaped(cellsSource, '|');
  return {
    prefix: prefixWithWhitespace,
    leadingPipe,
    trailingPipe,
    suffix,
    cells: segments.map(parseCell),
  };
}

function splitPrefix(line: string): { readonly prefix: string; readonly content: string } {
  const firstNonWhitespace = line.search(/\S/);
  if (firstNonWhitespace >= 0 && line[firstNonWhitespace] === '|') {
    return { prefix: line.slice(0, firstNonWhitespace), content: line.slice(firstNonWhitespace) };
  }
  const block = BLOCK_CONTAINER_PATTERN.exec(line);
  if (block !== null) {
    return { prefix: block[1] ?? '', content: block[2] ?? '' };
  }
  const list = LIST_CONTAINER_PATTERN.exec(line);
  if (list !== null && (list[2] ?? '').includes('|')) {
    return { prefix: list[1] ?? '', content: list[2] ?? '' };
  }
  return { prefix: '', content: line };
}

function parseCell(source: string): MarkdownTableCell {
  const leading = /^\s*/.exec(source)?.[0] ?? '';
  const trailing = /\s*$/.exec(source)?.[0] ?? '';
  const contentEnd = Math.max(leading.length, source.length - trailing.length);
  return {
    markdown: source.slice(leading.length, contentEnd),
    before: leading,
    after: source.slice(contentEnd),
  };
}

function parseAlignment(markdown: string): MarkdownTableAlignment | null {
  const match = DELIMITER_CELL_PATTERN.exec(markdown.trim());
  if (match === null) {
    return null;
  }
  if (match[1] !== undefined && match[3] !== undefined) {
    return 'center';
  }
  if (match[1] !== undefined) {
    return 'left';
  }
  if (match[3] !== undefined) {
    return 'right';
  }
  return 'none';
}

function serializeRow(row: MarkdownTableRow): string {
  return (
    row.prefix +
    (row.leadingPipe ? '|' : '') +
    row.cells.map((cell) => `${cell.before}${cell.markdown}${cell.after}`).join('|') +
    (row.trailingPipe ? '|' : '') +
    row.suffix
  );
}

function canonicalFormattedRow(prefix: string, values: readonly string[]): string {
  return `${prefix}| ${values.join(' | ')} |`;
}

function canonicalCell(markdown: string): MarkdownTableCell {
  return { markdown, before: ' ', after: ' ' };
}

function delimiterCell(alignment: MarkdownTableAlignment): MarkdownTableCell {
  return canonicalCell(delimiterMarker(alignment, minimumDelimiterWidth(alignment)));
}

function delimiterMarker(alignment: MarkdownTableAlignment, width: number): string {
  const safeWidth = Math.max(width, minimumDelimiterWidth(alignment));
  switch (alignment) {
    case 'left':
      return `:${'-'.repeat(safeWidth - 1)}`;
    case 'center':
      return `:${'-'.repeat(safeWidth - 2)}:`;
    case 'right':
      return `${'-'.repeat(safeWidth - 1)}:`;
    case 'none':
      return '-'.repeat(safeWidth);
  }
}

function minimumDelimiterWidth(alignment: MarkdownTableAlignment): number {
  return alignment === 'center' ? 5 : alignment === 'none' ? 3 : 4;
}

function blankBodyRow(
  table: MarkdownTable,
  template: MarkdownTableRow | undefined,
): MarkdownTableRow {
  const fallback = table.body[table.body.length - 1] ?? table.delimiter;
  const style = template ?? fallback;
  return {
    prefix: continuationPrefix(style.prefix, table.header.prefix, table.delimiter.prefix),
    leadingPipe: style.leadingPipe,
    trailingPipe: style.trailingPipe,
    suffix: '',
    cells: Array.from({ length: table.columnCount }, () => canonicalCell('')),
  };
}

function continuationPrefix(
  candidate: string,
  headerPrefix: string,
  delimiterPrefix: string,
): string {
  if (candidate === headerPrefix && headerPrefix !== delimiterPrefix) {
    return delimiterPrefix;
  }
  return candidate;
}

function clearRow(row: MarkdownTableRow, columnCount: number): MarkdownTableRow {
  return {
    ...row,
    cells: Array.from({ length: columnCount }, () => canonicalCell('')),
  };
}

function cloneRow(row: MarkdownTableRow): MarkdownTableRow {
  return { ...row, cells: row.cells.map(cloneCell) };
}

function cloneCell(cell: MarkdownTableCell): MarkdownTableCell {
  return { ...cell };
}

function withBody(table: MarkdownTable, body: readonly MarkdownTableRow[]): MarkdownTable {
  return { ...table, body };
}

function semanticRows(table: MarkdownTable): readonly MarkdownTableRow[] {
  return [table.header, ...table.body];
}

function withSemanticRows(table: MarkdownTable, rows: readonly MarkdownTableRow[]): MarkdownTable {
  return {
    ...table,
    header: requiredRow(rows, 0),
    body: rows.slice(1),
  };
}

function rebuildColumns(
  table: MarkdownTable,
  transform: (
    cells: readonly MarkdownTableCell[],
    kind: 'data' | 'delimiter',
  ) => readonly MarkdownTableCell[],
  alignments: readonly MarkdownTableAlignment[],
): MarkdownTable {
  const header = { ...table.header, cells: transform(table.header.cells, 'data') };
  const delimiter = {
    ...table.delimiter,
    cells: transform(table.delimiter.cells, 'delimiter'),
  };
  const body = table.body.map((row) => ({
    ...row,
    cells: transform(row.cells, 'data'),
  }));
  return {
    ...table,
    header,
    delimiter,
    body,
    alignments,
    columnCount: alignments.length,
  };
}

function rebuildDataRows(
  table: MarkdownTable,
  transform: (cells: readonly MarkdownTableCell[]) => readonly MarkdownTableCell[],
): MarkdownTable {
  return {
    ...table,
    header: { ...table.header, cells: transform(table.header.cells) },
    body: table.body.map((row) => ({ ...row, cells: transform(row.cells) })),
  };
}

function padCells(
  cells: readonly MarkdownTableCell[],
  columnCount: number,
  kind: 'data' | 'delimiter',
): MarkdownTableCell[] {
  const padded = cells.map(cloneCell);
  while (padded.length < columnCount) {
    padded.push(kind === 'delimiter' ? delimiterCell('none') : canonicalCell(''));
  }
  return padded;
}

function normalizedIndices(indices: readonly number[], minimum: number, maximum: number): number[] {
  return [...new Set(indices)]
    .filter((index) => Number.isInteger(index) && index >= minimum && index <= maximum)
    .sort((left, right) => left - right);
}

function inclusiveIndices(minimum: number, maximum: number): number[] {
  return Array.from({ length: maximum - minimum + 1 }, (_, offset) => minimum + offset);
}

function clipboardCellValue(markdown: string): string {
  return markdown.replace(/<br\s*\/?>/giu, '\n').replace(/\\\|/gu, '|');
}

function quoteDelimitedCell(value: string, delimiter: string): string {
  if (!value.includes(delimiter) && !value.includes('\n') && !value.includes('"')) {
    return value;
  }
  return `"${value.replace(/"/g, '""')}"`;
}

function parseDelimitedText(text: string, delimiter: string): ParsedDelimitedText {
  const rows: string[][] = [[]];
  let value = '';
  let quoted = false;
  let quoteClosed = false;
  let valid = true;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index] ?? '';
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          quoted = false;
          quoteClosed = true;
        }
      } else {
        value += character;
      }
      continue;
    }
    if (quoteClosed && character !== delimiter && character !== '\n') {
      valid = false;
      value += character;
      quoteClosed = false;
      continue;
    }
    if (character === '"' && value.length === 0) {
      quoted = true;
      continue;
    }
    if (character === delimiter) {
      requiredMutableRow(rows).push(value);
      value = '';
      quoteClosed = false;
      continue;
    }
    if (character === '\n') {
      requiredMutableRow(rows).push(value);
      rows.push([]);
      value = '';
      quoteClosed = false;
      continue;
    }
    value += character;
  }
  if (quoted) {
    valid = false;
  }
  requiredMutableRow(rows).push(value);
  if (
    rows.length > 1 &&
    requiredMutableRow(rows).length === 1 &&
    requiredMutableRow(rows)[0] === ''
  ) {
    rows.pop();
  }
  return { valid, rows };
}

function containsUnquotedDelimiter(text: string, delimiter: string): boolean {
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && character === delimiter) {
      return true;
    }
  }
  return false;
}

function normalizeImportedGrid(
  rows: readonly (readonly string[])[],
): readonly (readonly string[])[] {
  return rows.map((row) => row.map(normalizeImportedCell));
}

function normalizeImportedCell(value: string): string {
  return escapeMarkdownTableCell(value.replace(/\n/g, '<br>'));
}

function splitUnescaped(source: string, delimiter: string): string[] {
  const parts: string[] = [];
  let start = 0;
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === delimiter && !isEscaped(source, index)) {
      parts.push(source.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(source.slice(start));
  return parts;
}

function isEscaped(source: string, index: number): boolean {
  let backslashes = 0;
  for (let current = index - 1; current >= 0 && source[current] === '\\'; current -= 1) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
}

function findLastNonWhitespace(value: string): number {
  for (let index = value.length - 1; index >= 0; index -= 1) {
    if (!/\s/u.test(value[index] ?? '')) {
      return index;
    }
  }
  return -1;
}

function requiredRow(rows: readonly MarkdownTableRow[], index: number): MarkdownTableRow {
  return requiredValue(rows, index);
}

function requiredCell(cells: readonly MarkdownTableCell[], index: number): MarkdownTableCell {
  return requiredValue(cells, index);
}

function requiredValue<Value>(values: readonly Value[], index: number): Value {
  const value = values[index];
  if (value === undefined) {
    throw new RangeError(`Missing value at index ${index}`);
  }
  return value;
}

function requiredNumber(values: readonly number[], index: number): number {
  return requiredValue(values, index);
}

function requiredLast(values: readonly number[]): number {
  return requiredValue(values, values.length - 1);
}

function requiredMutableRow(rows: string[][]): string[] {
  return requiredValue(rows, rows.length - 1);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
