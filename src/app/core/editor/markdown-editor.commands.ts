import { parseMarkdownTableClipboard } from './markdown-table';

export type MarkdownEditorCommandId =
  | 'togglePreview'
  | 'toggleSource'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'heading4'
  | 'heading5'
  | 'heading6'
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'quote'
  | 'unorderedList'
  | 'orderedList'
  | 'taskList'
  | 'horizontalRule'
  | 'link'
  | 'image'
  | 'inlineCode'
  | 'codeBlock'
  | 'table'
  | 'search';

export interface MarkdownSelection {
  anchor: number;
  head: number;
}

export interface MarkdownEditResult {
  value: string;
  selections: readonly MarkdownSelection[];
}

export interface MarkdownTextChange {
  from: number;
  to: number;
  insert: string;
}

export interface MarkdownTransactionResult {
  changes: readonly MarkdownTextChange[];
  selections: readonly MarkdownSelection[];
}

export interface MarkdownKeyboardEvent {
  code: string;
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  isComposing: boolean;
}

export interface MarkdownEditorShortcut {
  code: string;
  alt: boolean;
  shift: boolean;
}

export interface MarkdownEditorCommandDefinition {
  id: MarkdownEditorCommandId;
  labelKey: string;
  shortcut: MarkdownEditorShortcut;
  shortcutLabel: string;
}

export interface MarkdownEditorShortcutGroupDefinition {
  id: 'view' | 'headings' | 'inline' | 'blocks' | 'media';
  labelKey: string;
  commandIds: readonly MarkdownEditorCommandId[];
}

export type MarkdownEditorPlatform = 'mac' | 'other';
export type MarkdownIndentDirection = 'more' | 'less';

interface SelectionEdit extends MarkdownTextChange {
  selectionFrom: number;
  selectionTo: number;
  selectionReversed: boolean;
  selectionIndex: number;
}

interface SelectedLine {
  from: number;
  text: string;
}

interface LinePrefix {
  indent: string;
  marker: string;
}

const MARKDOWN_INDENT = '  ';

export const MARKDOWN_EDITOR_COMMANDS: readonly MarkdownEditorCommandDefinition[] = [
  commandDefinition(
    'togglePreview',
    'markdownEditor.command.togglePreview',
    'KeyE',
    false,
    false,
    'Mod+E',
  ),
  commandDefinition(
    'toggleSource',
    'markdownEditor.command.toggleSource',
    'KeyE',
    false,
    true,
    'Mod+Shift+E',
  ),
  commandDefinition(
    'heading1',
    'markdownEditor.command.heading1',
    'Digit1',
    true,
    false,
    'Mod+Alt+1',
  ),
  commandDefinition(
    'heading2',
    'markdownEditor.command.heading2',
    'Digit2',
    true,
    false,
    'Mod+Alt+2',
  ),
  commandDefinition(
    'heading3',
    'markdownEditor.command.heading3',
    'Digit3',
    true,
    false,
    'Mod+Alt+3',
  ),
  commandDefinition(
    'heading4',
    'markdownEditor.command.heading4',
    'Digit4',
    true,
    false,
    'Mod+Alt+4',
  ),
  commandDefinition(
    'heading5',
    'markdownEditor.command.heading5',
    'Digit5',
    true,
    false,
    'Mod+Alt+5',
  ),
  commandDefinition(
    'heading6',
    'markdownEditor.command.heading6',
    'Digit6',
    true,
    false,
    'Mod+Alt+6',
  ),
  commandDefinition('bold', 'markdownEditor.command.bold', 'KeyB', false, false, 'Mod+B'),
  commandDefinition('italic', 'markdownEditor.command.italic', 'KeyI', false, false, 'Mod+I'),
  commandDefinition(
    'strikethrough',
    'markdownEditor.command.strikethrough',
    'KeyS',
    false,
    true,
    'Mod+Shift+S',
  ),
  commandDefinition('quote', 'markdownEditor.command.quote', 'KeyQ', false, true, 'Mod+Shift+Q'),
  commandDefinition(
    'unorderedList',
    'markdownEditor.command.unorderedList',
    'KeyU',
    false,
    true,
    'Mod+Shift+U',
  ),
  commandDefinition(
    'orderedList',
    'markdownEditor.command.orderedList',
    'KeyO',
    false,
    true,
    'Mod+Shift+O',
  ),
  commandDefinition(
    'taskList',
    'markdownEditor.command.taskList',
    'KeyX',
    false,
    true,
    'Mod+Shift+X',
  ),
  commandDefinition(
    'horizontalRule',
    'markdownEditor.command.horizontalRule',
    'KeyH',
    false,
    true,
    'Mod+Shift+H',
  ),
  commandDefinition('link', 'markdownEditor.command.link', 'KeyK', false, false, 'Mod+K'),
  commandDefinition('image', 'markdownEditor.command.image', 'KeyM', false, true, 'Mod+Shift+M'),
  commandDefinition(
    'inlineCode',
    'markdownEditor.command.inlineCode',
    'KeyC',
    false,
    true,
    'Mod+Shift+C',
  ),
  commandDefinition(
    'codeBlock',
    'markdownEditor.command.codeBlock',
    'KeyC',
    true,
    false,
    'Mod+Alt+C',
  ),
  commandDefinition('table', 'markdownEditor.command.table', 'KeyT', false, true, 'Mod+Shift+T'),
  commandDefinition('search', 'markdownEditor.command.search', 'KeyF', false, false, 'Mod+F'),
];

export const MARKDOWN_EDITOR_SHORTCUT_GROUPS: readonly MarkdownEditorShortcutGroupDefinition[] = [
  {
    id: 'view',
    labelKey: 'markdownEditor.shortcuts.group.view',
    commandIds: ['togglePreview', 'toggleSource', 'search'],
  },
  {
    id: 'headings',
    labelKey: 'markdownEditor.shortcuts.group.headings',
    commandIds: ['heading1', 'heading2', 'heading3', 'heading4', 'heading5', 'heading6'],
  },
  {
    id: 'inline',
    labelKey: 'markdownEditor.shortcuts.group.inline',
    commandIds: ['bold', 'italic', 'strikethrough', 'inlineCode', 'link'],
  },
  {
    id: 'blocks',
    labelKey: 'markdownEditor.shortcuts.group.blocks',
    commandIds: [
      'quote',
      'unorderedList',
      'orderedList',
      'taskList',
      'horizontalRule',
      'codeBlock',
      'table',
    ],
  },
  {
    id: 'media',
    labelKey: 'markdownEditor.shortcuts.group.media',
    commandIds: ['image'],
  },
];

export function formatMarkdownShortcut(
  command: MarkdownEditorCommandDefinition,
  platform: MarkdownEditorPlatform,
): readonly string[] {
  const parts = [platform === 'mac' ? '⌘' : 'Ctrl'];
  if (command.shortcut.alt) {
    parts.push(platform === 'mac' ? 'Option' : 'Alt');
  }
  if (command.shortcut.shift) {
    parts.push('Shift');
  }
  parts.push(shortcutKeyLabel(command.shortcut.code));
  return parts;
}

export function findMarkdownEditorCommand(
  event: MarkdownKeyboardEvent,
  platform: MarkdownEditorPlatform,
): MarkdownEditorCommandId | null {
  if (event.isComposing || !hasExactPrimaryModifier(event, platform)) {
    return null;
  }

  return (
    MARKDOWN_EDITOR_COMMANDS.find(
      (definition) =>
        definition.shortcut.code === event.code &&
        definition.shortcut.alt === event.altKey &&
        definition.shortcut.shift === event.shiftKey,
    )?.id ?? null
  );
}

export function applyMarkdownCommand(
  id: MarkdownEditorCommandId,
  value: string,
  selections: readonly MarkdownSelection[],
): MarkdownEditResult | null {
  return materializeTransaction(value, applyMarkdownCommandTransaction(id, value, selections));
}

export function applyMarkdownCommandTransaction(
  id: MarkdownEditorCommandId,
  value: string,
  selections: readonly MarkdownSelection[],
): MarkdownTransactionResult | null {
  if (selections.length === 0) {
    return null;
  }

  if (id === 'bold') return toggleInlineMarker(value, selections, '**');
  if (id === 'italic') return toggleInlineMarker(value, selections, '*');
  if (id === 'strikethrough') return toggleInlineMarker(value, selections, '~~');
  if (id === 'inlineCode') return toggleInlineCode(value, selections);
  if (id.startsWith('heading')) {
    return toggleLinePrefix(value, selections, {
      kind: 'heading',
      headingLevel: Number(id.slice('heading'.length)),
    });
  }
  if (id === 'quote') {
    return toggleLinePrefix(value, selections, { kind: 'quote', headingLevel: 0 });
  }
  if (id === 'unorderedList' || id === 'orderedList' || id === 'taskList') {
    return toggleLinePrefix(value, selections, { kind: id, headingLevel: 0 });
  }
  if (id === 'link') return insertLink(value, selections);
  if (id === 'horizontalRule') return insertHorizontalRule(value, selections);
  if (id === 'table') return insertTable(value, selections);
  if (id === 'codeBlock') return toggleCodeBlock(value, selections);
  return null;
}

export function continueMarkdownBlock(
  value: string,
  selections: readonly MarkdownSelection[],
): MarkdownEditResult | null {
  return materializeTransaction(value, continueMarkdownBlockTransaction(value, selections));
}

export function continueMarkdownBlockTransaction(
  value: string,
  selections: readonly MarkdownSelection[],
): MarkdownTransactionResult | null {
  const edits: MarkdownTextChange[] = [];
  const selectionPositions: number[] = [];

  for (const selection of selections) {
    if (selection.anchor !== selection.head) {
      return null;
    }
    const cursor = selection.head;
    const lineStart = value.lastIndexOf('\n', Math.max(0, cursor - 1)) + 1;
    const beforeCursor = value.slice(lineStart, cursor);
    const continuation = markdownBlockContinuation(beforeCursor);
    if (continuation === null) {
      return null;
    }

    if (continuation.removeFromLine) {
      edits.push({ from: lineStart, to: cursor, insert: '' });
      selectionPositions.push(lineStart);
    } else {
      const insert = `\n${continuation.prefix}`;
      edits.push({ from: cursor, to: cursor, insert });
      selectionPositions.push(cursor + insert.length);
    }
  }

  const mappedSelections = selectionPositions.map((position, index) => {
    const ownEdit = edits[index];
    const precedingEdits = edits.filter((edit) => edit.to <= ownEdit.from && edit !== ownEdit);
    const mappedPosition =
      position +
      precedingEdits.reduce((delta, edit) => delta + edit.insert.length - (edit.to - edit.from), 0);
    return { anchor: mappedPosition, head: mappedPosition };
  });
  return { changes: sortEdits(edits), selections: mappedSelections };
}

export function indentMarkdownLines(
  value: string,
  selections: readonly MarkdownSelection[],
  direction: MarkdownIndentDirection,
): MarkdownEditResult | null {
  return materializeTransaction(
    value,
    indentMarkdownLinesTransaction(value, selections, direction),
  );
}

export function indentMarkdownLinesTransaction(
  value: string,
  selections: readonly MarkdownSelection[],
  direction: MarkdownIndentDirection,
): MarkdownTransactionResult | null {
  const lines = selectedLines(value, selections);
  const edits: MarkdownTextChange[] = [];

  for (const line of lines) {
    if (direction === 'more') {
      edits.push({ from: line.from, to: line.from, insert: MARKDOWN_INDENT });
      continue;
    }

    const removable = /^(?: {1,2}|\t)/.exec(line.text)?.[0] ?? '';
    if (removable !== '') {
      edits.push({ from: line.from, to: line.from + removable.length, insert: '' });
    }
  }

  if (edits.length === 0) {
    return null;
  }
  return transactionWithMappedSelections(edits, selections);
}

export function autoCloseMarkdownFence(
  value: string,
  selections: readonly MarkdownSelection[],
  marker: '`' | '~',
): MarkdownEditResult | null {
  return materializeTransaction(
    value,
    autoCloseMarkdownFenceTransaction(value, selections, marker),
  );
}

export function autoCloseMarkdownFenceTransaction(
  value: string,
  selections: readonly MarkdownSelection[],
  marker: '`' | '~',
): MarkdownTransactionResult | null {
  const edits: MarkdownTextChange[] = [];
  const originalCursorPositions: number[] = [];

  for (const selection of selections) {
    if (selection.anchor !== selection.head) {
      return null;
    }
    const cursor = selection.head;
    const lineStart = value.lastIndexOf('\n', Math.max(0, cursor - 1)) + 1;
    const nextNewline = value.indexOf('\n', cursor);
    const lineEnd = nextNewline === -1 ? value.length : nextNewline;
    const line = value.slice(lineStart, lineEnd);
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})$/.exec(line);
    if (
      fenceMatch === null ||
      fenceMatch[1][0] !== marker ||
      cursor !== lineEnd ||
      hasMatchingFenceOnNextLine(value, lineEnd, fenceMatch[1]) ||
      hasOpenFenceBefore(value, lineStart, fenceMatch[1])
    ) {
      return null;
    }
    edits.push({ from: cursor, to: cursor, insert: `\n${fenceMatch[1]}` });
    originalCursorPositions.push(cursor);
  }

  const resultSelections = originalCursorPositions.map((position, index) => {
    const shift = edits
      .slice(0, index)
      .reduce((delta, edit) => delta + edit.insert.length - (edit.to - edit.from), 0);
    const mapped = position + shift;
    return { anchor: mapped, head: mapped };
  });
  return { changes: sortEdits(edits), selections: resultSelections };
}

function commandDefinition(
  id: MarkdownEditorCommandId,
  labelKey: string,
  code: string,
  alt: boolean,
  shift: boolean,
  shortcutLabel: string,
): MarkdownEditorCommandDefinition {
  return {
    id,
    labelKey,
    shortcut: { code, alt, shift },
    shortcutLabel,
  };
}

function shortcutKeyLabel(code: string): string {
  if (code.startsWith('Key')) {
    return code.slice('Key'.length);
  }
  if (code.startsWith('Digit')) {
    return code.slice('Digit'.length);
  }
  return code;
}

function hasExactPrimaryModifier(
  event: MarkdownKeyboardEvent,
  platform: MarkdownEditorPlatform,
): boolean {
  if (platform === 'mac') {
    return event.metaKey && !event.ctrlKey;
  }
  return event.ctrlKey && !event.metaKey;
}

function toggleInlineMarker(
  value: string,
  selections: readonly MarkdownSelection[],
  marker: string,
): MarkdownTransactionResult {
  const edits = selections.map((selection, selectionIndex) =>
    inlineMarkerEdit(value, selection, marker, selectionIndex),
  );
  return transactionFromSelectionEdits(edits);
}

function inlineMarkerEdit(
  value: string,
  selection: MarkdownSelection,
  marker: string,
  selectionIndex: number,
): SelectionEdit {
  const from = Math.min(selection.anchor, selection.head);
  const to = Math.max(selection.anchor, selection.head);
  const reversed = selection.anchor > selection.head;
  const selected = value.slice(from, to);
  const markerLength = marker.length;

  if (
    selected.length >= markerLength * 2 &&
    selected.startsWith(marker) &&
    selected.endsWith(marker)
  ) {
    const insert = selected.slice(markerLength, -markerLength);
    return selectionEdit(from, to, insert, 0, insert.length, reversed, selectionIndex);
  }

  if (
    from >= markerLength &&
    value.slice(from - markerLength, from) === marker &&
    value.slice(to, to + markerLength) === marker
  ) {
    return selectionEdit(
      from - markerLength,
      to + markerLength,
      selected,
      0,
      selected.length,
      reversed,
      selectionIndex,
    );
  }

  const insert = `${marker}${selected}${marker}`;
  return selectionEdit(
    from,
    to,
    insert,
    markerLength,
    markerLength + selected.length,
    reversed,
    selectionIndex,
  );
}

function toggleInlineCode(
  value: string,
  selections: readonly MarkdownSelection[],
): MarkdownTransactionResult {
  const edits = selections.map((selection, selectionIndex) => {
    const from = Math.min(selection.anchor, selection.head);
    const to = Math.max(selection.anchor, selection.head);
    const reversed = selection.anchor > selection.head;
    const selected = value.slice(from, to);
    const surroundingFence = surroundingInlineCode(value, from, to);

    if (surroundingFence !== null) {
      return selectionEdit(
        surroundingFence.from,
        surroundingFence.to,
        selected,
        0,
        selected.length,
        reversed,
        selectionIndex,
      );
    }

    const longestRun = longestBacktickRun(selected);
    const fence = '`'.repeat(Math.max(1, longestRun + 1));
    const needsPadding = selected.startsWith('`') || selected.endsWith('`');
    const padding = needsPadding ? ' ' : '';
    const insert = `${fence}${padding}${selected}${padding}${fence}`;
    const selectionFrom = fence.length + padding.length;
    return selectionEdit(
      from,
      to,
      insert,
      selectionFrom,
      selectionFrom + selected.length,
      reversed,
      selectionIndex,
    );
  });
  return transactionFromSelectionEdits(edits);
}

function toggleLinePrefix(
  value: string,
  selections: readonly MarkdownSelection[],
  options: {
    kind: 'heading' | 'quote' | 'unorderedList' | 'orderedList' | 'taskList';
    headingLevel: number;
  },
): MarkdownTransactionResult | null {
  const lines = selectedLines(value, selections);
  if (lines.length === 0) {
    return null;
  }
  const prefixes = lines.map((line) => linePrefix(line.text, options.kind));
  const remove = prefixes.every((prefix) =>
    prefixMatchesCommand(prefix, options.kind, options.headingLevel),
  );
  const edits: MarkdownTextChange[] = [];

  lines.forEach((line, index) => {
    const prefix = prefixes[index];
    if (remove) {
      edits.push({
        from: line.from + prefix.indent.length,
        to: line.from + prefix.indent.length + prefix.marker.length,
        insert: '',
      });
      return;
    }

    const marker =
      options.kind === 'heading'
        ? `${'#'.repeat(options.headingLevel)} `
        : options.kind === 'quote'
          ? '> '
          : options.kind === 'unorderedList'
            ? '- '
            : options.kind === 'orderedList'
              ? `${index + 1}. `
              : '- [ ] ';
    edits.push({
      from: line.from + prefix.indent.length,
      to: line.from + prefix.indent.length + prefix.marker.length,
      insert: marker,
    });
  });

  return transactionWithMappedSelections(edits, selections);
}

function linePrefix(
  line: string,
  kind: 'heading' | 'quote' | 'unorderedList' | 'orderedList' | 'taskList',
): LinePrefix {
  const indent = /^[ \t]*/.exec(line)?.[0] ?? '';
  const rest = line.slice(indent.length);
  const markerPattern =
    kind === 'heading'
      ? /^#{1,6}[ \t]+/
      : kind === 'quote'
        ? /^>[ \t]?/
        : /^(?:-\s+\[[ xX]\]\s+|[-+*]\s+|\d+[.)]\s+)/;
  return {
    indent,
    marker: markerPattern.exec(rest)?.[0] ?? '',
  };
}

function prefixMatchesCommand(
  prefix: LinePrefix,
  kind: 'heading' | 'quote' | 'unorderedList' | 'orderedList' | 'taskList',
  headingLevel: number,
): boolean {
  if (kind === 'heading') {
    const headingMarker = '#'.repeat(headingLevel);
    return (
      prefix.marker.startsWith(headingMarker) &&
      /^[ \t]+$/.test(prefix.marker.slice(headingMarker.length))
    );
  }
  if (kind === 'quote') return /^>[ \t]?$/.test(prefix.marker);
  if (kind === 'unorderedList') return /^[-+*]\s+$/.test(prefix.marker);
  if (kind === 'orderedList') return /^\d+[.)]\s+$/.test(prefix.marker);
  return /^-\s+\[[ xX]\]\s+$/.test(prefix.marker);
}

function insertLink(
  value: string,
  selections: readonly MarkdownSelection[],
): MarkdownTransactionResult {
  const edits = selections.map((selection, selectionIndex) => {
    const from = Math.min(selection.anchor, selection.head);
    const to = Math.max(selection.anchor, selection.head);
    const reversed = selection.anchor > selection.head;
    const selected = value.slice(from, to);
    const label = escapeMarkdownLinkLabel(selected === '' ? 'text' : selected);
    const insert = `[${label}](https://)`;
    const selectionFrom = selected === '' ? 1 : label.length + 3;
    const selectionTo = selected === '' ? 1 + label.length : insert.length - 1;
    return selectionEdit(
      from,
      to,
      insert,
      selectionFrom,
      selectionTo,
      reversed && selected !== '',
      selectionIndex,
    );
  });
  return transactionFromSelectionEdits(edits);
}

function escapeMarkdownLinkLabel(value: string): string {
  return value.replace(/([\\[\]])/g, '\\$1');
}

function insertHorizontalRule(
  value: string,
  selections: readonly MarkdownSelection[],
): MarkdownTransactionResult {
  const edits = selections.map((selection, selectionIndex) => {
    const from = Math.min(selection.anchor, selection.head);
    const to = Math.max(selection.anchor, selection.head);
    const before = value.slice(0, from);
    const after = value.slice(to);
    const prefix =
      before === '' ? '' : before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
    const suffix =
      after === '' ? '' : after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
    const insert = `${prefix}---${suffix}`;
    return selectionEdit(from, to, insert, insert.length, insert.length, false, selectionIndex);
  });
  return transactionFromSelectionEdits(edits);
}

function insertTable(
  value: string,
  selections: readonly MarkdownSelection[],
): MarkdownTransactionResult {
  const edits = selections.map((selection, selectionIndex) => {
    const from = Math.min(selection.anchor, selection.head);
    const to = Math.max(selection.anchor, selection.head);
    const table = markdownTableFromSelection(value.slice(from, to));
    return selectionEdit(from, to, table, 2, 2, false, selectionIndex);
  });
  return transactionFromSelectionEdits(edits);
}

function markdownTableFromSelection(selectedText: string): string {
  if (
    selectedText.length === 0 ||
    (!selectedText.includes('\t') &&
      !selectedText.includes(',') &&
      !selectedText.includes('\n') &&
      !selectedText.includes('\r'))
  ) {
    return '|  |  |\n| --- | --- |\n|  |  |';
  }
  const grid = parseMarkdownTableClipboard(selectedText).rows;
  const columnCount = Math.max(...grid.map((row) => row.length), 0);
  if (grid.length === 0 || columnCount === 0) {
    return '|  |  |\n| --- | --- |\n|  |  |';
  }
  const row = (cells: readonly string[]): string =>
    `| ${Array.from({ length: columnCount }, (_, index) => cells[index] ?? '').join(' | ')} |`;
  const header = row(grid[0] ?? []);
  const delimiter = row(Array<string>(columnCount).fill('---'));
  const bodyRows = grid.length > 1 ? grid.slice(1).map(row) : [row([])];
  return [header, delimiter, ...bodyRows].join('\n');
}

function toggleCodeBlock(
  value: string,
  selections: readonly MarkdownSelection[],
): MarkdownTransactionResult {
  const edits = selections.map((selection, selectionIndex) => {
    const from = Math.min(selection.anchor, selection.head);
    const to = Math.max(selection.anchor, selection.head);
    const selected = value.slice(from, to);
    const reversed = selection.anchor > selection.head;
    const surroundingFence = surroundingCodeBlock(value, from, to);
    if (surroundingFence !== null) {
      return selectionEdit(
        surroundingFence.from,
        surroundingFence.to,
        selected,
        0,
        selected.length,
        reversed,
        selectionIndex,
      );
    }
    const fence = '`'.repeat(Math.max(3, longestBacktickRun(selected) + 1));
    const insert = `${fence}\n${selected}\n${fence}`;
    return selectionEdit(
      from,
      to,
      insert,
      fence.length + 1,
      fence.length + 1 + selected.length,
      reversed,
      selectionIndex,
    );
  });
  return transactionFromSelectionEdits(edits);
}

function selectionEdit(
  from: number,
  to: number,
  insert: string,
  selectionFrom: number,
  selectionTo: number,
  selectionReversed: boolean,
  selectionIndex: number,
): SelectionEdit {
  return {
    from,
    to,
    insert,
    selectionFrom,
    selectionTo,
    selectionReversed,
    selectionIndex,
  };
}

function transactionFromSelectionEdits(
  selectionEdits: readonly SelectionEdit[],
): MarkdownTransactionResult {
  const sorted = [...selectionEdits].sort((left, right) => left.from - right.from);
  assertNonOverlappingEdits(sorted);
  const resultSelections: MarkdownSelection[] = Array.from(
    { length: selectionEdits.length },
    () => ({ anchor: 0, head: 0 }),
  );
  let delta = 0;

  for (const edit of sorted) {
    const replacementStart = edit.from + delta;
    const selectionFrom = replacementStart + edit.selectionFrom;
    const selectionTo = replacementStart + edit.selectionTo;
    resultSelections[edit.selectionIndex] = edit.selectionReversed
      ? { anchor: selectionTo, head: selectionFrom }
      : { anchor: selectionFrom, head: selectionTo };
    delta += edit.insert.length - (edit.to - edit.from);
  }

  return {
    changes: sorted.map(({ from, to, insert }) => ({ from, to, insert })),
    selections: resultSelections,
  };
}

function transactionWithMappedSelections(
  edits: readonly MarkdownTextChange[],
  selections: readonly MarkdownSelection[],
): MarkdownTransactionResult {
  const sorted = sortEdits(edits);
  return {
    changes: sorted,
    selections: selections.map((selection) => ({
      anchor: mapPosition(selection.anchor, sorted, 1),
      head: mapPosition(selection.head, sorted, 1),
    })),
  };
}

function materializeTransaction(
  value: string,
  transaction: MarkdownTransactionResult | null,
): MarkdownEditResult | null {
  if (transaction === null) {
    return null;
  }
  return {
    value: applyEdits(value, transaction.changes),
    selections: transaction.selections,
  };
}

function sortEdits(edits: readonly MarkdownTextChange[]): readonly MarkdownTextChange[] {
  const sorted = [...edits].sort((left, right) => left.from - right.from);
  assertNonOverlappingEdits(sorted);
  return sorted;
}

function applyEdits(value: string, edits: readonly MarkdownTextChange[]): string {
  let result = value;
  for (const edit of [...edits].sort((left, right) => right.from - left.from)) {
    result = `${result.slice(0, edit.from)}${edit.insert}${result.slice(edit.to)}`;
  }
  return result;
}

function mapPosition(
  position: number,
  edits: readonly MarkdownTextChange[],
  association: -1 | 1,
): number {
  let delta = 0;
  for (const edit of edits) {
    if (position < edit.from || (position === edit.from && association < 0)) {
      break;
    }
    if (edit.from === edit.to) {
      delta += edit.insert.length;
      continue;
    }
    if (position <= edit.to) {
      return edit.from + delta + (association < 0 ? 0 : edit.insert.length);
    }
    delta += edit.insert.length - (edit.to - edit.from);
  }
  return position + delta;
}

function assertNonOverlappingEdits(edits: readonly MarkdownTextChange[]): void {
  for (let index = 1; index < edits.length; index += 1) {
    if (edits[index].from < edits[index - 1].to) {
      throw new Error('Markdown command selections must not overlap');
    }
  }
}

function selectedLines(
  value: string,
  selections: readonly MarkdownSelection[],
): readonly SelectedLine[] {
  const starts = new Set<number>();
  for (const selection of selections) {
    const from = Math.min(selection.anchor, selection.head);
    const to = Math.max(selection.anchor, selection.head);
    const firstLineStart = value.lastIndexOf('\n', Math.max(0, from - 1)) + 1;
    const inclusiveEnd = to > from && value[to - 1] === '\n' ? to - 1 : to;
    let lineStart = firstLineStart;
    while (lineStart <= inclusiveEnd) {
      starts.add(lineStart);
      const newline = value.indexOf('\n', lineStart);
      if (newline === -1 || newline >= inclusiveEnd) {
        break;
      }
      lineStart = newline + 1;
    }
  }

  return [...starts]
    .sort((left, right) => left - right)
    .map((from) => {
      const newline = value.indexOf('\n', from);
      return {
        from,
        text: value.slice(from, newline === -1 ? value.length : newline),
      };
    });
}

function surroundingInlineCode(
  value: string,
  from: number,
  to: number,
): { from: number; to: number } | null {
  let before = 0;
  for (let index = from - 1; index >= 0 && value[index] === '`'; index -= 1) {
    before += 1;
  }
  let after = 0;
  for (let index = to; index < value.length && value[index] === '`'; index += 1) {
    after += 1;
  }
  if (before > 0 && before === after) {
    return { from: from - before, to: to + after };
  }

  if (value[from - 1] !== ' ' || value[to] !== ' ') {
    return null;
  }
  before = 0;
  for (let index = from - 2; index >= 0 && value[index] === '`'; index -= 1) {
    before += 1;
  }
  after = 0;
  for (let index = to + 1; index < value.length && value[index] === '`'; index += 1) {
    after += 1;
  }
  return before > 0 && before === after ? { from: from - before - 1, to: to + after + 1 } : null;
}

function surroundingCodeBlock(
  value: string,
  from: number,
  to: number,
): { from: number; to: number } | null {
  const before = value.slice(0, from);
  const opening = /(^|\n)(`{3,}|~{3,})[^\n]*\n$/.exec(before);
  if (opening === null) {
    return null;
  }
  const after = value.slice(to);
  const closing = /^\n(`{3,}|~{3,})[ \t]*(?=\n|$)/.exec(after);
  if (
    closing === null ||
    closing[1][0] !== opening[2][0] ||
    closing[1].length < opening[2].length
  ) {
    return null;
  }
  return {
    from: from - opening[0].length + opening[1].length,
    to: to + closing[0].length,
  };
}

function longestBacktickRun(value: string): number {
  return Math.max(0, ...Array.from(value.matchAll(/`+/g), (match) => match[0].length));
}

function markdownBlockContinuation(
  beforeCursor: string,
): { prefix: string; removeFromLine: boolean } | null {
  const task = /^([ \t]*)([-+*])\s+\[([ xX])\]\s+(.*)$/.exec(beforeCursor);
  if (task !== null) {
    return {
      prefix: `${task[1]}${task[2]} [ ] `,
      removeFromLine: task[4] === '',
    };
  }
  const ordered = /^([ \t]*)(\d+)([.)])\s+(.*)$/.exec(beforeCursor);
  if (ordered !== null) {
    return {
      prefix: `${ordered[1]}${Number(ordered[2]) + 1}${ordered[3]} `,
      removeFromLine: ordered[4] === '',
    };
  }
  const unordered = /^([ \t]*)([-+*])\s+(.*)$/.exec(beforeCursor);
  if (unordered !== null) {
    return {
      prefix: `${unordered[1]}${unordered[2]} `,
      removeFromLine: unordered[3] === '',
    };
  }
  const quote = /^([ \t]*)(>+[ \t]?)(.*)$/.exec(beforeCursor);
  if (quote !== null) {
    return {
      prefix: `${quote[1]}${quote[2].trimEnd()} `,
      removeFromLine: quote[3] === '',
    };
  }
  return null;
}

function hasMatchingFenceOnNextLine(value: string, lineEnd: number, fence: string): boolean {
  if (lineEnd >= value.length || value[lineEnd] !== '\n') {
    return false;
  }
  const nextStart = lineEnd + 1;
  const nextEnd = value.indexOf('\n', nextStart);
  return value.slice(nextStart, nextEnd === -1 ? value.length : nextEnd).trim() === fence;
}

function hasOpenFenceBefore(value: string, lineStart: number, currentFence: string): boolean {
  const marker = currentFence[0];
  const currentLength = currentFence.length;
  let openLength: number | null = null;
  for (const line of value.slice(0, lineStart).split(/\r?\n/)) {
    const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (match === null || match[1][0] !== marker) {
      continue;
    }
    if (openLength === null) {
      if (marker === '`' && match[2].includes('`')) {
        continue;
      }
      openLength = match[1].length;
    } else if (match[1].length >= openLength && match[2].trim() === '') {
      openLength = null;
    }
  }
  return openLength !== null && currentLength >= openLength;
}
