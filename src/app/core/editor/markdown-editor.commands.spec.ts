import {
  MARKDOWN_EDITOR_COMMANDS,
  MARKDOWN_EDITOR_SHORTCUT_GROUPS,
  MarkdownEditorCommandId,
  MarkdownKeyboardEvent,
  applyMarkdownCommand,
  applyMarkdownCommandTransaction,
  autoCloseMarkdownFence,
  continueMarkdownBlock,
  findMarkdownEditorCommand,
  formatMarkdownShortcut,
  indentMarkdownLines,
} from './markdown-editor.commands';

interface Selection {
  anchor: number;
  head: number;
}

describe('Markdown editor commands', () => {
  it('returns granular changes for multi-selection commands', () => {
    expect(
      applyMarkdownCommandTransaction('bold', 'one two', [selection(0, 3), selection(4, 7)]),
    ).toEqual({
      changes: [
        { from: 0, to: 3, insert: '**one**' },
        { from: 4, to: 7, insert: '**two**' },
      ],
      selections: [
        { anchor: 2, head: 5 },
        { anchor: 10, head: 13 },
      ],
    });
  });

  it('wraps, unwraps, and inserts paired inline markers', () => {
    expect(command('bold', 'text', selection(0, 4))).toEqual({
      value: '**text**',
      selections: [selection(2, 6)],
    });
    expect(command('bold', '**text**', selection(2, 6))).toEqual({
      value: 'text',
      selections: [selection(0, 4)],
    });
    expect(command('bold', '', selection(0))).toEqual({
      value: '****',
      selections: [selection(2)],
    });
  });

  it('applies inline formatting to multiple selections without losing their ranges', () => {
    expect(command('italic', 'one two', [selection(0, 3), selection(4, 7)])).toEqual({
      value: '*one* *two*',
      selections: [selection(1, 4), selection(7, 10)],
    });
  });

  it('uses a safe inline-code delimiter when the selected code contains backticks', () => {
    expect(command('inlineCode', 'a`b', selection(0, 3))).toEqual({
      value: '``a`b``',
      selections: [selection(2, 5)],
    });
    expect(command('inlineCode', '`a`', selection(0, 3))).toEqual({
      value: '`` `a` ``',
      selections: [selection(3, 6)],
    });
    expect(command('inlineCode', '`` `a` ``', selection(3, 6))).toEqual({
      value: '`a`',
      selections: [selection(0, 3)],
    });
  });

  it('toggles headings for all selected lines', () => {
    expect(command('heading2', 'First\nSecond', selection(0, 12))).toEqual({
      value: '## First\n## Second',
      selections: [selection(3, 18)],
    });
    expect(command('heading2', '## First\n## Second', selection(3, 18))).toEqual({
      value: 'First\nSecond',
      selections: [selection(0, 12)],
    });
    expect(command('heading2', '##\tFirst', selection(3, 8))).toEqual({
      value: 'First',
      selections: [selection(0, 5)],
    });
  });

  it('toggles quotes and list types across selected lines', () => {
    expect(command('unorderedList', '', selection(0)).value).toBe('- ');
    expect(command('quote', 'First\nSecond', selection(0, 12)).value).toBe('> First\n> Second');
    expect(command('orderedList', 'First\nSecond', selection(0, 12)).value).toBe(
      '1. First\n2. Second',
    );
    expect(command('taskList', '- First\n- Second', selection(0, 16)).value).toBe(
      '- [ ] First\n- [ ] Second',
    );
  });

  it('inserts link, table, rule, and fenced-code snippets', () => {
    expect(command('link', 'label', selection(0, 5))).toEqual({
      value: '[label](https://)',
      selections: [selection(8, 16)],
    });
    expect(command('link', 'a [label]', selection(0, 9)).value).toBe('[a \\[label\\]](https://)');
    expect(command('table', '', selection(0)).value).toBe('|  |  |\n| --- | --- |\n|  |  |');
    expect(command('table', 'Name\tValue\nAda\t42', selection(0, 17)).value).toBe(
      '| Name | Value |\n| --- | --- |\n| Ada | 42 |',
    );
    expect(command('table', 'Name,"Quoted value"\nAda,"say ""hi"""', selection(0, 37)).value).toBe(
      '| Name | Quoted value |\n| --- | --- |\n| Ada | say "hi" |',
    );
    expect(command('horizontalRule', 'beforeafter', selection(6)).value).toBe(
      'before\n\n---\n\nafter',
    );
    expect(command('codeBlock', '```\nvalue', selection(0, 9)).value).toBe(
      '````\n```\nvalue\n````',
    );
    expect(command('codeBlock', '````\n```\nvalue\n````', selection(5, 14))).toEqual({
      value: '```\nvalue',
      selections: [selection(0, 9)],
    });
  });

  it('continues and exits unordered, ordered, task, and quote blocks', () => {
    expect(continueMarkdownBlock('- item', [selection(6)])).toEqual({
      value: '- item\n- ',
      selections: [selection(9)],
    });
    expect(continueMarkdownBlock('9. item', [selection(7)])).toEqual({
      value: '9. item\n10. ',
      selections: [selection(12)],
    });
    expect(continueMarkdownBlock('- [x] item', [selection(10)])).toEqual({
      value: '- [x] item\n- [ ] ',
      selections: [selection(17)],
    });
    expect(continueMarkdownBlock('> quote', [selection(7)])).toEqual({
      value: '> quote\n> ',
      selections: [selection(10)],
    });
    expect(continueMarkdownBlock('- ', [selection(2)])).toEqual({
      value: '',
      selections: [selection(0)],
    });
  });

  it('indents and unindents complete selected lines', () => {
    expect(indentMarkdownLines('- one\n- two', [selection(0, 11)], 'more')).toEqual({
      value: '  - one\n  - two',
      selections: [selection(2, 15)],
    });
    expect(indentMarkdownLines('  - one\n  - two', [selection(2, 15)], 'less')).toEqual({
      value: '- one\n- two',
      selections: [selection(0, 11)],
    });
  });

  it('auto-closes backtick and tilde fences without duplicating closing fences', () => {
    expect(autoCloseMarkdownFence('```', [selection(3)], '`')).toEqual({
      value: '```\n```',
      selections: [selection(3)],
    });
    expect(autoCloseMarkdownFence('~~~', [selection(3)], '~')).toEqual({
      value: '~~~\n~~~',
      selections: [selection(3)],
    });
    expect(autoCloseMarkdownFence('```\n```', [selection(3)], '`')).toBeNull();
    expect(
      autoCloseMarkdownFence('```ts\nconst answer = 42;\n```', [selection(29)], '`'),
    ).toBeNull();
  });

  it('matches physical shortcuts independently of the active keyboard layout', () => {
    expect(
      findMarkdownEditorCommand(keyboardEvent({ code: 'KeyB', key: 'и', ctrlKey: true }), 'other'),
    ).toBe('bold');
    expect(
      findMarkdownEditorCommand(
        keyboardEvent({ code: 'Digit3', key: '3', metaKey: true, altKey: true }),
        'mac',
      ),
    ).toBe('heading3');
  });

  it('requires exact modifiers and ignores shortcuts during IME composition', () => {
    expect(
      findMarkdownEditorCommand(
        keyboardEvent({ code: 'KeyB', key: 'b', ctrlKey: true, shiftKey: true }),
        'other',
      ),
    ).toBeNull();
    expect(
      findMarkdownEditorCommand(
        keyboardEvent({ code: 'KeyB', key: 'b', ctrlKey: true, isComposing: true }),
        'other',
      ),
    ).toBeNull();
  });

  it('publishes the complete stable initial shortcut registry', () => {
    expect(
      Object.fromEntries(
        MARKDOWN_EDITOR_COMMANDS.map((definition) => [definition.id, definition.shortcutLabel]),
      ),
    ).toEqual({
      togglePreview: 'Mod+E',
      toggleSource: 'Mod+Shift+E',
      heading1: 'Mod+Alt+1',
      heading2: 'Mod+Alt+2',
      heading3: 'Mod+Alt+3',
      heading4: 'Mod+Alt+4',
      heading5: 'Mod+Alt+5',
      heading6: 'Mod+Alt+6',
      bold: 'Mod+B',
      italic: 'Mod+I',
      strikethrough: 'Mod+Shift+S',
      quote: 'Mod+Shift+Q',
      unorderedList: 'Mod+Shift+U',
      orderedList: 'Mod+Shift+O',
      taskList: 'Mod+Shift+X',
      horizontalRule: 'Mod+Shift+H',
      link: 'Mod+K',
      image: 'Mod+Shift+M',
      inlineCode: 'Mod+Shift+C',
      codeBlock: 'Mod+Alt+C',
      table: 'Mod+Shift+T',
      search: 'Mod+F',
    });
  });

  it('groups every command once and formats truthful platform-specific shortcuts', () => {
    const groupedCommandIds = MARKDOWN_EDITOR_SHORTCUT_GROUPS.flatMap((group) => group.commandIds);
    expect(groupedCommandIds).toHaveLength(MARKDOWN_EDITOR_COMMANDS.length);
    expect(new Set(groupedCommandIds)).toEqual(
      new Set(MARKDOWN_EDITOR_COMMANDS.map((commandDefinition) => commandDefinition.id)),
    );
    const heading = MARKDOWN_EDITOR_COMMANDS.find(({ id }) => id === 'heading1');
    if (heading === undefined) {
      throw new Error('Missing heading1 command');
    }

    expect(formatMarkdownShortcut(heading, 'mac')).toEqual(['⌘', 'Option', '1']);
    expect(formatMarkdownShortcut(heading, 'other')).toEqual(['Ctrl', 'Alt', '1']);
  });
});

function command(
  id: MarkdownEditorCommandId,
  value: string,
  selections: Selection | readonly Selection[],
) {
  const result = applyMarkdownCommand(
    id,
    value,
    Array.isArray(selections) ? selections : [selections],
  );
  if (result === null) {
    throw new Error(`Command ${id} did not produce a Markdown change`);
  }
  return result;
}

function selection(anchor: number, head: number = anchor): Selection {
  return { anchor, head };
}

function keyboardEvent(overrides: Partial<MarkdownKeyboardEvent>): MarkdownKeyboardEvent {
  return {
    code: '',
    key: '',
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    isComposing: false,
    ...overrides,
  };
}
