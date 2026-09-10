import { closeBrackets } from '@codemirror/autocomplete';
import { history } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { bracketMatching, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { highlightSelectionMatches, search } from '@codemirror/search';
import { EditorState, type Extension } from '@codemirror/state';
import {
  EditorView,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  lineNumbers,
} from '@codemirror/view';
import { classHighlighter } from '@lezer/highlight';
import { markdownEditorWikiLinks } from './markdown-editor.wiki-links';

export const markdownEditorLanguage = markdown({ base: markdownLanguage });

const markdownEditorSearchTheme = EditorView.theme({
  '.cm-panel.cm-search input[type=checkbox]': {
    accentColor: 'var(--accent-color)',
  },
  '.cm-panel.cm-search .cm-textfield:focus': {
    borderColor: 'var(--accent-color)',
    outline: '0',
    boxShadow: '0 0 0 0.2rem var(--bs-focus-ring-color)',
  },
  '.cm-panel.cm-search input[type=checkbox]:focus-visible, .cm-panel.cm-search .cm-button:focus-visible, .cm-panel.cm-search [name=close]:focus-visible':
    {
      outline: '0.2rem solid var(--bs-focus-ring-color)',
      outlineOffset: '0.1rem',
    },
});

export const markdownEditorFoundationExtensions: readonly Extension[] = [
  EditorState.allowMultipleSelections.of(true),
  EditorView.editorAttributes.of({ class: 'markdown-editor-static-theme' }),
  indentUnit.of('  '),
  markdownEditorLanguage,
  history(),
  lineNumbers(),
  dropCursor(),
  highlightActiveLine(),
  highlightActiveLineGutter(),
  bracketMatching(),
  closeBrackets(),
  markdownEditorWikiLinks,
  search({ top: true }),
  markdownEditorSearchTheme,
  highlightSelectionMatches(),
  syntaxHighlighting(classHighlighter),
  EditorView.lineWrapping,
];

export function markdownEditorCspExtension(nonce: string | null): Extension {
  return nonce === null ? [] : EditorView.cspNonce.of(nonce);
}
