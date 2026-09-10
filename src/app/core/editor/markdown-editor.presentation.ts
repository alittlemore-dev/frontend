import { syntaxTree } from '@codemirror/language';
import { EditorState, Range, type Extension } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import type { SyntaxNode } from '@lezer/common';
import { tokenizeMarkdownCode } from '../markdown/markdown-syntax-highlighter';
import { parseWikiLink } from '../wiki-links/wiki-links';
import { activeWikiLinkContext, type WikiLinkSourceRange } from './markdown-editor.wiki-links';

export interface MarkdownVisibleRange {
  from: number;
  to: number;
}

const inlineCodeDecoration = Decoration.mark({ class: 'cm-markdown-inline-code' });
const lineDecorations = new Map<string, Decoration>();
const prismTokenDecorations = new Map<string, Decoration>();
const wikiLinkDecorations = new Map<string, Decoration>();
const prismHighlightClasses: Readonly<Record<string, readonly string[]>> = {
  comment: ['tok-comment'],
  prolog: ['tok-comment'],
  doctype: ['tok-comment'],
  cdata: ['tok-comment'],
  punctuation: ['tok-punctuation'],
  property: ['tok-atom'],
  tag: ['tok-atom'],
  boolean: ['tok-bool'],
  number: ['tok-number'],
  constant: ['tok-atom'],
  symbol: ['tok-atom'],
  deleted: ['tok-atom'],
  selector: ['tok-string'],
  'attr-name': ['tok-string'],
  string: ['tok-string'],
  char: ['tok-string'],
  builtin: ['tok-string'],
  inserted: ['tok-string'],
  operator: ['tok-operator'],
  entity: ['tok-operator'],
  url: ['tok-operator'],
  atrule: ['tok-keyword'],
  'attr-value': ['tok-keyword'],
  keyword: ['tok-keyword'],
  regex: ['tok-variableName'],
  important: ['tok-variableName', 'tok-strong'],
  variable: ['tok-variableName'],
  bold: ['tok-strong'],
  italic: ['tok-emphasis'],
};

class MarkdownPresentationView {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = buildMarkdownPresentationDecorations(view.state, view.visibleRanges);
  }

  update(update: ViewUpdate): void {
    if (
      update.docChanged ||
      update.viewportChanged ||
      update.selectionSet ||
      syntaxTree(update.startState) !== syntaxTree(update.state)
    ) {
      this.decorations = buildMarkdownPresentationDecorations(
        update.state,
        update.view.visibleRanges,
      );
    }
  }
}

export const markdownPresentation: Extension = ViewPlugin.fromClass(MarkdownPresentationView, {
  decorations: (presentation) => presentation.decorations,
});

export function buildMarkdownPresentationDecorations(
  state: EditorState,
  visibleRanges: readonly MarkdownVisibleRange[],
): DecorationSet {
  const lineClasses = new Map<number, Set<string>>();
  const inlineRanges: Range<Decoration>[] = [];
  const inlineRangeKeys = new Set<string>();
  const tree = syntaxTree(state);

  for (const visibleRange of visibleRanges) {
    tree.iterate({
      from: visibleRange.from,
      to: visibleRange.to,
      enter: (node) => {
        const headingLevel = markdownHeadingLevel(node.name);
        if (headingLevel !== null) {
          addLineClasses(
            state,
            visibleRange,
            node.from,
            node.to,
            lineClasses,
            `cm-markdown-heading cm-markdown-heading-${headingLevel}`,
          );
          return;
        }
        if (node.name === 'Blockquote') {
          addQuoteClasses(state, visibleRange, node.from, node.to, lineClasses);
          return;
        }
        if (node.name === 'ListItem') {
          addLineClasses(state, visibleRange, node.from, node.to, lineClasses, 'cm-markdown-list');
          return;
        }
        if (node.name === 'Task') {
          addLineClasses(
            state,
            visibleRange,
            node.from,
            node.to,
            lineClasses,
            'cm-markdown-list cm-markdown-task',
          );
          return;
        }
        if (node.name === 'FencedCode') {
          addFencedCodeClasses(state, visibleRange, node.from, node.to, lineClasses);
          addFencedCodeSyntax(state, visibleRange, node.node, inlineRanges, inlineRangeKeys);
          return;
        }
        if (node.name === 'Table') {
          addLineClasses(state, visibleRange, node.from, node.to, lineClasses, 'cm-markdown-table');
          return;
        }
        if (node.name === 'HorizontalRule') {
          addLineClasses(
            state,
            visibleRange,
            node.from,
            node.to,
            lineClasses,
            'cm-markdown-horizontal-rule',
          );
          return;
        }
        if (node.name === 'InlineCode') {
          const from = Math.max(node.from, visibleRange.from);
          const to = Math.min(node.to, visibleRange.to);
          const key = `${from}:${to}`;
          if (from < to && !inlineRangeKeys.has(key)) {
            inlineRangeKeys.add(key);
            inlineRanges.push(inlineCodeDecoration.range(from, to));
          }
          return;
        }
        if (node.name === 'Link') {
          addCompletedWikiLinkDecorations(
            state,
            visibleRange,
            node.node,
            inlineRanges,
            inlineRangeKeys,
          );
        }
      },
    });
  }

  addActiveWikiLinkDecorations(state, visibleRanges, inlineRanges, inlineRangeKeys);

  const ranges: Range<Decoration>[] = [...inlineRanges];
  for (const [position, classes] of lineClasses) {
    ranges.push(lineDecoration([...classes].join(' ')).range(position));
  }
  return Decoration.set(ranges, true);
}

function addCompletedWikiLinkDecorations(
  state: EditorState,
  visibleRange: MarkdownVisibleRange,
  link: SyntaxNode,
  ranges: Range<Decoration>[],
  rangeKeys: Set<string>,
): void {
  const candidateFrom = link.from - 1;
  const candidateTo = link.to + 1;
  if (candidateFrom < 0 || candidateTo > state.doc.length) {
    return;
  }
  const candidate = state.sliceDoc(candidateFrom, candidateTo);
  const parsed = parseWikiLink(candidate);
  if (parsed === null) {
    return;
  }

  const domainFrom = candidateFrom + 2;
  const colonFrom = domainFrom + parsed.type.length;
  const slugFrom = colonFrom + 1;
  const slugTo = slugFrom + parsed.slug.length;
  addWikiLinkDecoration(
    { from: candidateFrom, to: domainFrom },
    visibleRange,
    'cm-wiki-link-delimiter',
    ranges,
    rangeKeys,
  );
  addWikiLinkDecoration(
    { from: domainFrom, to: colonFrom },
    visibleRange,
    'cm-wiki-link-domain',
    ranges,
    rangeKeys,
  );
  addWikiLinkDecoration(
    { from: colonFrom, to: slugFrom },
    visibleRange,
    'cm-wiki-link-colon',
    ranges,
    rangeKeys,
  );
  addWikiLinkDecoration(
    { from: slugFrom, to: slugTo },
    visibleRange,
    'cm-wiki-link-slug',
    ranges,
    rangeKeys,
  );
  const labelSeparator = state.sliceDoc(slugTo, slugTo + 2);
  const labelSeparatorLength = labelSeparator.startsWith('\\|')
    ? 2
    : labelSeparator.startsWith('|')
      ? 1
      : 0;
  if (labelSeparatorLength > 0) {
    addWikiLinkDecoration(
      { from: slugTo, to: slugTo + labelSeparatorLength },
      visibleRange,
      'cm-wiki-link-label-separator',
      ranges,
      rangeKeys,
    );
    addWikiLinkDecoration(
      { from: slugTo + labelSeparatorLength, to: candidateTo - 2 },
      visibleRange,
      'cm-wiki-link-label',
      ranges,
      rangeKeys,
    );
  }
  addWikiLinkDecoration(
    { from: candidateTo - 2, to: candidateTo },
    visibleRange,
    'cm-wiki-link-delimiter',
    ranges,
    rangeKeys,
  );
}

function addActiveWikiLinkDecorations(
  state: EditorState,
  visibleRanges: readonly MarkdownVisibleRange[],
  ranges: Range<Decoration>[],
  rangeKeys: Set<string>,
): void {
  const active = activeWikiLinkContext(state, state.selection.main.head);
  if (active === null) {
    return;
  }
  for (const visibleRange of visibleRanges) {
    addActiveWikiLinkRange(active.opening, visibleRange, 'delimiter', ranges, rangeKeys);
    addActiveWikiLinkRange(active.domain, visibleRange, 'domain', ranges, rangeKeys);
    if (active.colon !== null) {
      addActiveWikiLinkRange(active.colon, visibleRange, 'colon', ranges, rangeKeys);
    }
    if (active.slug !== null) {
      addActiveWikiLinkRange(active.slug, visibleRange, 'slug', ranges, rangeKeys);
    }
  }
}

function addActiveWikiLinkRange(
  range: WikiLinkSourceRange,
  visibleRange: MarkdownVisibleRange,
  semanticClass: 'delimiter' | 'domain' | 'colon' | 'slug',
  ranges: Range<Decoration>[],
  rangeKeys: Set<string>,
): void {
  addWikiLinkDecoration(
    range,
    visibleRange,
    `cm-wiki-link-${semanticClass} cm-wiki-link-active`,
    ranges,
    rangeKeys,
  );
}

function addWikiLinkDecoration(
  range: WikiLinkSourceRange,
  visibleRange: MarkdownVisibleRange,
  className: string,
  ranges: Range<Decoration>[],
  rangeKeys: Set<string>,
): void {
  const from = Math.max(range.from, visibleRange.from);
  const to = Math.min(range.to, visibleRange.to);
  const key = `${from}:${to}:${className}`;
  if (from >= to || rangeKeys.has(key)) {
    return;
  }
  rangeKeys.add(key);
  ranges.push(wikiLinkDecoration(className).range(from, to));
}

function addFencedCodeSyntax(
  state: EditorState,
  visibleRange: MarkdownVisibleRange,
  fencedCode: SyntaxNode,
  ranges: Range<Decoration>[],
  rangeKeys: Set<string>,
): void {
  const codeText = fencedCode.getChild('CodeText');
  if (codeText === null) {
    return;
  }
  const codeInfo = fencedCode.getChild('CodeInfo');
  const highlighted = tokenizeMarkdownCode(
    state.sliceDoc(codeText.from, codeText.to),
    codeInfo === null ? undefined : state.sliceDoc(codeInfo.from, codeInfo.to),
  );
  if (highlighted === null) {
    return;
  }

  for (const token of highlighted.tokens) {
    const from = Math.max(codeText.from + token.from, visibleRange.from);
    const to = Math.min(codeText.from + token.to, visibleRange.to);
    const className = prismTokenClassName(token.types);
    const key = `${from}:${to}:${className}`;
    if (from >= to || className === '' || rangeKeys.has(key)) {
      continue;
    }
    rangeKeys.add(key);
    ranges.push(prismTokenDecoration(className).range(from, to));
  }
}

function markdownHeadingLevel(nodeName: string): number | null {
  const match = /^(?:ATXHeading|SetextHeading)([1-6])$/.exec(nodeName);
  return match === null ? null : Number(match[1]);
}

function prismTokenClassName(types: readonly string[]): string {
  return [
    ...new Set(
      types.flatMap((type) => [`cm-prism-${type}`, ...(prismHighlightClasses[type] ?? [])]),
    ),
  ].join(' ');
}

function addQuoteClasses(
  state: EditorState,
  visibleRange: MarkdownVisibleRange,
  from: number,
  to: number,
  lineClasses: Map<number, Set<string>>,
): void {
  visitVisibleLines(state, visibleRange, from, to, (lineFrom, lineText) => {
    addClasses(lineClasses, lineFrom, 'cm-markdown-quote');
    if (/^ {0,3}>\s*\[![^\]\r\n]+\]/.test(lineText)) {
      addClasses(lineClasses, lineFrom, 'cm-markdown-callout');
    }
  });
}

function addFencedCodeClasses(
  state: EditorState,
  visibleRange: MarkdownVisibleRange,
  from: number,
  to: number,
  lineClasses: Map<number, Set<string>>,
): void {
  const firstLine = state.doc.lineAt(from);
  const lastLine = state.doc.lineAt(Math.max(from, to - 1));
  const opening = /^ {0,3}(`{3,}|~{3,})/.exec(firstLine.text);
  const hasClosingFence =
    opening !== null &&
    new RegExp(
      `^ {0,3}${escapeRegularExpression(opening[1][0])}{${opening[1].length},}[ \\t]*$`,
    ).test(lastLine.text);

  visitVisibleLines(state, visibleRange, from, to, (lineFrom) => {
    addClasses(lineClasses, lineFrom, 'cm-markdown-code-block');
    if (lineFrom === firstLine.from) {
      addClasses(lineClasses, lineFrom, 'cm-markdown-code-fence cm-markdown-code-fence-start');
    }
    if (hasClosingFence && lineFrom === lastLine.from) {
      addClasses(lineClasses, lineFrom, 'cm-markdown-code-fence cm-markdown-code-fence-end');
    }
  });
}

function addLineClasses(
  state: EditorState,
  visibleRange: MarkdownVisibleRange,
  from: number,
  to: number,
  lineClasses: Map<number, Set<string>>,
  classes: string,
): void {
  visitVisibleLines(state, visibleRange, from, to, (lineFrom) => {
    addClasses(lineClasses, lineFrom, classes);
  });
}

function visitVisibleLines(
  state: EditorState,
  visibleRange: MarkdownVisibleRange,
  from: number,
  to: number,
  visit: (lineFrom: number, lineText: string) => void,
): void {
  const rangeFrom = Math.max(from, visibleRange.from);
  const rangeTo = Math.min(to, visibleRange.to);
  if (rangeFrom >= rangeTo) {
    return;
  }

  let line = state.doc.lineAt(rangeFrom);
  while (line.from < rangeTo) {
    visit(line.from, line.text);
    if (line.number >= state.doc.lines) {
      break;
    }
    line = state.doc.line(line.number + 1);
  }
}

function addClasses(
  lineClasses: Map<number, Set<string>>,
  position: number,
  classes: string,
): void {
  const classSet = lineClasses.get(position) ?? new Set<string>();
  for (const className of classes.split(' ')) {
    classSet.add(className);
  }
  lineClasses.set(position, classSet);
}

function lineDecoration(className: string): Decoration {
  const existing = lineDecorations.get(className);
  if (existing !== undefined) {
    return existing;
  }
  const decoration = Decoration.line({ class: className });
  lineDecorations.set(className, decoration);
  return decoration;
}

function prismTokenDecoration(className: string): Decoration {
  const existing = prismTokenDecorations.get(className);
  if (existing !== undefined) {
    return existing;
  }
  const decoration = Decoration.mark({ class: className });
  prismTokenDecorations.set(className, decoration);
  return decoration;
}

function wikiLinkDecoration(className: string): Decoration {
  const existing = wikiLinkDecorations.get(className);
  if (existing !== undefined) {
    return existing;
  }
  const decoration = Decoration.mark({ class: className });
  wikiLinkDecorations.set(className, decoration);
  return decoration;
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
