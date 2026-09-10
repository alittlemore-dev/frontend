import { EditorState } from '@codemirror/state';
import { ensureSyntaxTree, syntaxTreeAvailable } from '@codemirror/language';
import { markdownEditorLanguage } from './markdown-editor.extensions';
import { buildMarkdownPresentationDecorations } from './markdown-editor.presentation';

describe('Markdown editor presentation', () => {
  it('builds semantic decorations only for visible document ranges', () => {
    const document = ['# Outside viewport', '', 'plain', '', '## Visible heading'].join('\n');
    const visibleFrom = document.indexOf('## Visible');
    const state = completelyParsedMarkdownState(document);
    const decorations = buildMarkdownPresentationDecorations(state, [
      { from: visibleFrom, to: document.length },
    ]);
    const classes: { from: number; className: string }[] = [];

    decorations.between(0, state.doc.length, (from, _to, decoration) => {
      const className = decoration.spec.class as string | undefined;
      if (className !== undefined) {
        classes.push({ from, className });
      }
    });

    expect(classes.length).toBeGreaterThan(0);
    expect(classes.every(({ from }) => from >= visibleFrom)).toBe(true);
    expect(classes.some(({ className }) => className.includes('cm-markdown-heading-2'))).toBe(true);
    expect(classes.some(({ className }) => className.includes('cm-markdown-heading-1'))).toBe(
      false,
    );
  });

  it.each([
    ['[[articles:typed-articles]]', 'articles', 'typed-articles'],
    ['[[matrix:known-question]]', 'matrix', 'known-question'],
  ])('decorates the semantic ranges in a completed %s wiki-link', (document, domain, slug) => {
    const classes = wikiLinkClasses(document);

    expect(classes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: '[[', className: 'cm-wiki-link-delimiter' }),
        expect.objectContaining({ text: domain, className: 'cm-wiki-link-domain' }),
        expect.objectContaining({ text: ':', className: 'cm-wiki-link-colon' }),
        expect.objectContaining({ text: slug, className: 'cm-wiki-link-slug' }),
        expect.objectContaining({ text: ']]', className: 'cm-wiki-link-delimiter' }),
      ]),
    );
  });

  it('decorates the optional label separately', () => {
    const classes = wikiLinkClasses('[[matrix:known-question|Custom label]]');

    expect(classes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: '|', className: 'cm-wiki-link-label-separator' }),
        expect.objectContaining({ text: 'Custom label', className: 'cm-wiki-link-label' }),
      ]),
    );
  });

  it('decorates an escaped table-safe label separator separately', () => {
    const classes = wikiLinkClasses('[[matrix:known-question\\|Custom label]]');

    expect(classes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: '\\|', className: 'cm-wiki-link-label-separator' }),
        expect.objectContaining({ text: 'Custom label', className: 'cm-wiki-link-label' }),
      ]),
    );
  });

  it('decorates multiple visible wiki-links', () => {
    const document = '[[articles:first-article]] and [[matrix:second-question]]';
    const classes = wikiLinkClasses(document);

    expect(classes.filter(({ className }) => className === 'cm-wiki-link-domain')).toHaveLength(2);
    expect(classes.filter(({ className }) => className === 'cm-wiki-link-slug')).toHaveLength(2);
  });

  it('clips wiki-link decorations to visible ranges', () => {
    const document = 'outside [[articles:hidden-link]]\nvisible [[matrix:shown-link]]';
    const visibleFrom = document.indexOf('visible');
    const classes = wikiLinkClasses(document, [{ from: visibleFrom, to: document.length }]);

    expect(classes.some(({ text }) => text === 'hidden-link')).toBe(false);
    expect(classes.some(({ text }) => text === 'shown-link')).toBe(true);
    expect(classes.every(({ from }) => from >= visibleFrom)).toBe(true);
  });

  it.each([
    '[ordinary](https://example.com)',
    '[[unprefixed-link]]',
    '[[unknown:target]]',
    '[[articles:Invalid]]',
    '`[[matrix:inline-code]]`',
    '```md\n[[matrix:fenced-code]]\n```',
  ])('does not decorate unsupported or code-contained syntax: %s', (document) => {
    expect(wikiLinkClasses(document)).toEqual([]);
  });

  it.each([
    ['[[art', 'art', 'cm-wiki-link-domain'],
    ['[[matrix:known', 'known', 'cm-wiki-link-slug'],
  ])('decorates the active incomplete fragment in %s', (document, text, className) => {
    const classes = wikiLinkClasses(document);

    expect(classes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text,
          className: expect.stringContaining(className),
        }),
      ]),
    );
    expect(classes.some((item) => item.className.includes('cm-wiki-link-active'))).toBe(true);
  });

  it('changes only active-fragment decoration behavior when the selection moves', () => {
    const document = '[[art cursor]]';
    const active = wikiLinkClasses(document, undefined, '[[art'.length);
    const inactive = wikiLinkClasses(document, undefined, document.length);

    expect(active.some(({ className }) => className.includes('cm-wiki-link-active'))).toBe(true);
    expect(inactive.some(({ className }) => className.includes('cm-wiki-link-active'))).toBe(false);
  });
});

interface DecorationClass {
  from: number;
  text: string;
  className: string;
}

function wikiLinkClasses(
  document: string,
  visibleRanges: readonly { from: number; to: number }[] = [{ from: 0, to: document.length }],
  cursor: number = document.length,
): DecorationClass[] {
  const state = completelyParsedMarkdownState(document, cursor);
  const decorations = buildMarkdownPresentationDecorations(state, visibleRanges);
  const classes: DecorationClass[] = [];

  decorations.between(0, state.doc.length, (from, to, decoration) => {
    const className = decoration.spec.class as string | undefined;
    if (className?.includes('cm-wiki-link-')) {
      classes.push({
        from,
        text: state.sliceDoc(from, to),
        className,
      });
    }
  });
  return classes;
}

function completelyParsedMarkdownState(
  document: string,
  cursor: number = document.length,
): EditorState {
  const state = EditorState.create({
    doc: document,
    selection: { anchor: cursor },
    extensions: [markdownEditorLanguage],
  });
  if (ensureSyntaxTree(state, state.doc.length, 1000) === null) {
    throw new Error('Markdown syntax tree did not finish parsing');
  }
  const parsedState = state.update().state;
  if (!syntaxTreeAvailable(parsedState, parsedState.doc.length)) {
    throw new Error('Markdown syntax tree was not committed to editor state');
  }
  return parsedState;
}
