import { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { createWikiLinkTargetRegistry } from '../wiki-links/wiki-links';
import { markdownEditorLanguage } from './markdown-editor.extensions';
import {
  WikiLinkCompletionData,
  markdownEditorWikiLinks,
  setWikiLinkCompletionData,
  wikiLinkCompletionSource,
} from './markdown-editor.wiki-links';

const completionData: WikiLinkCompletionData = {
  registry: createWikiLinkTargetRegistry([
    {
      type: 'articles',
      items: [
        {
          slug: 'typed-articles',
          title: 'Типизированные статьи',
          publishStatus: 'Published',
        },
      ],
    },
    {
      type: 'matrix',
      items: [
        {
          slug: 'draft-question',
          title: 'Черновой вопрос',
          publishStatus: 'Draft',
        },
        {
          slug: 'known-question',
          title: 'Известный вопрос',
          publishStatus: 'Published',
        },
      ],
    },
  ]),
  publishStatusLabels: {
    Draft: 'Черновик',
    Published: 'Опубликовано',
  },
};

describe('Markdown editor wiki-link completions', () => {
  it('offers every typed domain after the opening delimiters', () => {
    const { state, cursor } = markedState('[[');
    const result = completionResult(state, cursor);

    expect(result.from).toBe(2);
    expect(result.options.map((option) => option.label)).toEqual(['articles', 'matrix']);
  });

  it('uses only the partial domain as the strict filtering range', () => {
    const { state, cursor } = markedState('Before [[ma');
    const result = completionResult(state, cursor);

    expect(state.sliceDoc(result.from, cursor)).toBe('ma');
    expect(result.options.map((option) => option.label)).toEqual(['articles', 'matrix']);
  });

  it('applies a domain minimally and immediately exposes its targets', () => {
    const { state, cursor } = markedState('Before [[ma¦]] after');
    const domainResult = completionResult(state, cursor);
    const view = new EditorView({ state });

    applyCompletion(view, domainResult, 'matrix');

    expect(view.state.doc.toString()).toBe('Before [[matrix:]] after');
    expect(view.state.selection.main.head).toBe('Before [[matrix:'.length);
    const targetResult = completionResult(view.state, view.state.selection.main.head);
    expect(targetResult.options.map((option) => option.label)).toEqual([
      'draft-question',
      'known-question',
    ]);
    view.destroy();
  });

  it('returns sorted target slugs with localized title and publication metadata', () => {
    const { state, cursor } = markedState('[[matrix:');
    const result = completionResult(state, cursor);

    expect(result.options).toEqual([
      expect.objectContaining({
        label: 'draft-question',
        wikiLinkTitle: 'Черновой вопрос',
        wikiLinkStatus: 'Черновик',
      }),
      expect.objectContaining({
        label: 'known-question',
        wikiLinkTitle: 'Известный вопрос',
        wikiLinkStatus: 'Опубликовано',
      }),
    ]);
  });

  it('uses only the partial slug as the strict filtering range', () => {
    const { state, cursor } = markedState('[[matrix:kn');
    const result = completionResult(state, cursor);

    expect(state.sliceDoc(result.from, cursor)).toBe('kn');
    expect(result.options.map((option) => option.label)).toContain('known-question');
  });

  it('preserves existing closing brackets and places the cursor before them', () => {
    const { state, cursor } = markedState('Before [[matrix:kn]] after');
    const result = completionResult(state, cursor);
    const view = new EditorView({ state });

    applyCompletion(view, result, 'known-question');

    expect(view.state.doc.toString()).toBe('Before [[matrix:known-question]] after');
    expect(view.state.selection.main.head).toBe(view.state.doc.toString().indexOf(']]'));
    view.destroy();
  });

  it('adds missing closing brackets without touching neighboring Markdown', () => {
    const { state, cursor } = markedState('**Before** [[matrix:kn');
    const result = completionResult(state, cursor);
    const view = new EditorView({ state });

    applyCompletion(view, result, 'known-question');

    expect(view.state.doc.toString()).toBe('**Before** [[matrix:known-question]]');
    expect(view.state.selection.main.head).toBe(view.state.doc.toString().indexOf(']]'));
    view.destroy();
  });

  it('adds only one missing closing bracket', () => {
    const { state, cursor } = markedState('[[matrix:kn]');
    const result = completionResult(state, cursor);
    const view = new EditorView({ state });

    applyCompletion(view, result, 'known-question');

    expect(view.state.doc.toString()).toBe('[[matrix:known-question]]');
    view.destroy();
  });

  it('returns an empty target list for a supported domain with no items', () => {
    const emptyMatrixData: WikiLinkCompletionData = {
      ...completionData,
      registry: createWikiLinkTargetRegistry([
        { type: 'articles', items: [] },
        { type: 'matrix', items: [] },
      ]),
    };
    const { state, cursor } = markedState('[[matrix:', emptyMatrixData);

    expect(completionResult(state, cursor).options).toEqual([]);
  });

  it.each([
    ['an ordinary Markdown link', '[label](target)'],
    ['a complete wiki-link', '[[matrix:known-question]]¦'],
    ['wiki-link label text', '[[matrix:known-question|Label'],
    ['inline code', '`[[matrix:`'],
    ['fenced code', '```md\n[[matrix:\n```'],
  ])('does not complete inside %s', (_name, document) => {
    const { state, cursor } = markedState(document);

    expect(wikiLinkCompletionSource(new CompletionContext(state, cursor, false))).toBeNull();
  });

  it('does not complete a non-empty selection', () => {
    const state = configuredState(
      '[[matrix:',
      EditorSelection.single(2, '[[matrix:'.length),
      completionData,
    );

    expect(
      wikiLinkCompletionSource(new CompletionContext(state, state.selection.main.head, false)),
    ).toBeNull();
  });

  it('does not complete multiple selections', () => {
    const document = '[[\n[[';
    const state = configuredState(
      document,
      EditorSelection.create([EditorSelection.cursor(2), EditorSelection.cursor(document.length)]),
      completionData,
    );

    expect(
      wikiLinkCompletionSource(new CompletionContext(state, state.selection.main.head, false)),
    ).toBeNull();
  });
});

function markedState(
  document: string,
  data: WikiLinkCompletionData = completionData,
): { state: EditorState; cursor: number } {
  const marker = document.indexOf('¦');
  const cursor = marker === -1 ? cursorForDocument(document) : marker;
  const cleanDocument = marker === -1 ? document : document.replace('¦', '');
  return {
    state: configuredState(cleanDocument, EditorSelection.cursor(cursor), data),
    cursor,
  };
}

function cursorForDocument(document: string): number {
  const closing = document.indexOf(']]');
  if (closing !== -1) {
    const colon = document.lastIndexOf(':', closing);
    if (colon !== -1) {
      return closing;
    }
  }
  if (document.endsWith(']')) {
    return document.length - 1;
  }
  if (document.includes('```')) {
    const activeLine = document.indexOf('[[matrix:') + '[[matrix:'.length;
    return activeLine;
  }
  return document.length;
}

function configuredState(
  document: string,
  selection: EditorSelection,
  data: WikiLinkCompletionData,
): EditorState {
  const state = EditorState.create({
    doc: document,
    selection,
    extensions: [
      EditorState.allowMultipleSelections.of(true),
      markdownEditorLanguage,
      markdownEditorWikiLinks,
    ],
  });
  return state.update({ effects: setWikiLinkCompletionData.of(data) }).state;
}

function completionResult(state: EditorState, cursor: number): CompletionResult {
  const result = wikiLinkCompletionSource(new CompletionContext(state, cursor, false));
  if (result === null) {
    throw new Error('Expected wiki-link completions');
  }
  return result;
}

function applyCompletion(view: EditorView, result: CompletionResult, label: string): void {
  const completion = result.options.find((option) => option.label === label);
  if (completion === undefined || typeof completion.apply !== 'function') {
    throw new Error(`Missing completion apply function for ${label}`);
  }
  completion.apply(
    view,
    completion as Completion,
    result.from,
    result.to ?? view.state.selection.main.head,
  );
}
