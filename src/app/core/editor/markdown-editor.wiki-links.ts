import {
  autocompletion,
  closeCompletion,
  pickedCompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete';
import { syntaxTree } from '@codemirror/language';
import {
  EditorSelection,
  EditorState,
  StateEffect,
  StateField,
  Transaction,
  type Extension,
} from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import type { SyntaxNode } from '@lezer/common';
import {
  WIKI_LINK_TARGET_TYPES,
  type WikiLinkTarget,
  type WikiLinkTargetRegistry,
  type WikiLinkTargetType,
} from '../wiki-links/wiki-links';

export interface WikiLinkCompletionData {
  registry: WikiLinkTargetRegistry;
  publishStatusLabels: Readonly<Record<WikiLinkTarget['publishStatus'], string>>;
}

export interface WikiLinkSourceRange {
  from: number;
  to: number;
}

export interface ActiveWikiLinkContext {
  stage: 'domain' | 'target';
  opening: WikiLinkSourceRange;
  domain: WikiLinkSourceRange;
  colon: WikiLinkSourceRange | null;
  slug: WikiLinkSourceRange | null;
  targetType: WikiLinkTargetType | null;
}

interface WikiLinkCompletion extends Completion {
  wikiLinkStage: 'domain' | 'target';
  wikiLinkTitle?: string;
  wikiLinkStatus?: string;
}

export const setWikiLinkCompletionData = StateEffect.define<WikiLinkCompletionData | null>();

const wikiLinkCompletionDataState = StateField.define<WikiLinkCompletionData | null>({
  create: () => null,
  update: (value, transaction) => {
    for (const effect of transaction.effects) {
      if (effect.is(setWikiLinkCompletionData)) {
        return effect.value;
      }
    }
    return value;
  },
});

export const wikiLinkCompletionSource = (context: CompletionContext): CompletionResult | null => {
  const activeContext = activeWikiLinkContext(context.state, context.pos);
  if (activeContext === null) {
    return null;
  }
  if (activeContext.stage === 'domain') {
    return {
      from: activeContext.domain.from,
      to: activeContext.domain.to,
      options: WIKI_LINK_TARGET_TYPES.map((targetType) => domainCompletion(targetType)),
      validFor: /^[a-z]*$/,
    };
  }

  const data = context.state.field(wikiLinkCompletionDataState, false) ?? null;
  const group = data?.registry.groups.find(
    (candidate) => candidate.type === activeContext.targetType,
  );
  const options = [...(group?.items ?? [])]
    .sort((left, right) => left.slug.localeCompare(right.slug))
    .map((target) => targetCompletion(target, data));
  return {
    from: activeContext.slug?.from ?? context.pos,
    to: activeContext.slug?.to ?? context.pos,
    options,
    validFor: /^(?:[a-z0-9]+(?:-[a-z0-9]*)*)?$/,
  };
};

export const markdownEditorWikiLinks: Extension = [
  wikiLinkCompletionDataState,
  EditorView.domEventHandlers({
    compositionstart: (_event, view) => {
      closeCompletion(view);
      return false;
    },
  }),
  autocompletion({
    activateOnTyping: true,
    filterStrict: true,
    icons: false,
    selectOnOpen: true,
    override: [wikiLinkCompletionSource],
    activateOnCompletion: (completion) =>
      (completion as WikiLinkCompletion).wikiLinkStage === 'domain',
    optionClass: (completion) =>
      (completion as WikiLinkCompletion).wikiLinkStage === 'target'
        ? 'cm-wiki-link-completion-option'
        : '',
    addToOptions: [
      {
        position: 40,
        render: (completion, _state, view) =>
          renderTargetMetadata(completion as WikiLinkCompletion, view),
      },
    ],
  }),
];

export function activeWikiLinkContext(
  state: EditorState,
  position: number,
): ActiveWikiLinkContext | null {
  if (
    state.selection.ranges.length !== 1 ||
    !state.selection.main.empty ||
    state.selection.main.head !== position ||
    isInsideCode(state, position)
  ) {
    return null;
  }

  const line = state.doc.lineAt(position);
  const beforeCursor = state.sliceDoc(line.from, position);
  const openingIndex = beforeCursor.lastIndexOf('[[');
  if (openingIndex === -1) {
    return null;
  }
  const openingFrom = line.from + openingIndex;
  const candidate = beforeCursor.slice(openingIndex + 2);
  if (candidate.includes(']]') || candidate.includes('|')) {
    return null;
  }

  const candidateFrom = openingFrom + 2;
  const colonIndex = candidate.indexOf(':');
  if (colonIndex === -1) {
    if (!/^[a-z]*$/.test(candidate)) {
      return null;
    }
    return {
      stage: 'domain',
      opening: { from: openingFrom, to: candidateFrom },
      domain: { from: candidateFrom, to: position },
      colon: null,
      slug: null,
      targetType: null,
    };
  }

  const domain = candidate.slice(0, colonIndex);
  const slug = candidate.slice(colonIndex + 1);
  if (
    candidate.indexOf(':', colonIndex + 1) !== -1 ||
    !isWikiLinkTargetType(domain) ||
    !/^(?:[a-z0-9]+(?:-[a-z0-9]*)*)?$/.test(slug)
  ) {
    return null;
  }
  const colonFrom = candidateFrom + colonIndex;
  return {
    stage: 'target',
    opening: { from: openingFrom, to: candidateFrom },
    domain: { from: candidateFrom, to: colonFrom },
    colon: { from: colonFrom, to: colonFrom + 1 },
    slug: { from: colonFrom + 1, to: position },
    targetType: domain,
  };
}

function domainCompletion(targetType: WikiLinkTargetType): WikiLinkCompletion {
  const completion: WikiLinkCompletion = {
    label: targetType,
    type: 'keyword',
    wikiLinkStage: 'domain',
  };
  completion.apply = (view, selected, from, to) => {
    const insert = `${targetType}:`;
    view.dispatch({
      changes: { from, to, insert },
      selection: EditorSelection.cursor(from + insert.length),
      annotations: [pickedCompletion.of(selected), Transaction.userEvent.of('input.complete')],
    });
  };
  return completion;
}

function targetCompletion(
  target: WikiLinkTarget,
  data: WikiLinkCompletionData | null,
): WikiLinkCompletion {
  const completion: WikiLinkCompletion = {
    label: target.slug,
    type: 'text',
    wikiLinkStage: 'target',
    wikiLinkTitle: target.title,
    wikiLinkStatus: data?.publishStatusLabels[target.publishStatus],
  };
  completion.apply = (view, selected, from, to) => {
    const after = view.state.sliceDoc(to, Math.min(view.state.doc.length, to + 2));
    const closings = after.startsWith(']]') ? '' : after.startsWith(']') ? ']' : ']]';
    view.dispatch({
      changes: { from, to, insert: `${target.slug}${closings}` },
      selection: EditorSelection.cursor(from + target.slug.length),
      annotations: [pickedCompletion.of(selected), Transaction.userEvent.of('input.complete')],
    });
  };
  return completion;
}

function renderTargetMetadata(completion: WikiLinkCompletion, view: EditorView): Node | null {
  if (
    completion.wikiLinkStage !== 'target' ||
    completion.wikiLinkTitle === undefined ||
    completion.wikiLinkStatus === undefined
  ) {
    return null;
  }
  const document = view.dom.ownerDocument;
  const metadata = document.createElement('span');
  metadata.className = 'cm-wiki-link-completion-metadata';
  const title = document.createElement('span');
  title.className = 'cm-wiki-link-completion-title';
  title.textContent = completion.wikiLinkTitle;
  const status = document.createElement('span');
  status.className = 'cm-wiki-link-completion-status';
  status.textContent = completion.wikiLinkStatus;
  metadata.append(title, status);
  return metadata;
}

function isInsideCode(state: EditorState, position: number): boolean {
  let node: SyntaxNode | null = syntaxTree(state).resolveInner(Math.max(0, position - 1), 1);
  while (node !== null) {
    if (node.name === 'InlineCode' || node.name === 'FencedCode') {
      return true;
    }
    node = node.parent;
  }
  return false;
}

function isWikiLinkTargetType(value: string): value is WikiLinkTargetType {
  return WIKI_LINK_TARGET_TYPES.some((targetType) => targetType === value);
}
