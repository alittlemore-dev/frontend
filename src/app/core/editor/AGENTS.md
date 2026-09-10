# Markdown Editor Instructions

These rules apply to every file under `frontend/src/app/core/editor/`.

## Architecture

- Markdown source is the canonical document. Editor presentation, preview, uploads, and commands
  must not create a second content model or silently rewrite unrelated source.
- Keep Editor, Source, and Preview as modes of one editor integration. Preserve the same document,
  selection, history, unsaved value, and upload anchors when changing modes or fullscreen state.
- Build on direct modular CodeMirror 6 packages and public extension points. Do not depend on copied
  internals, an Angular CodeMirror wrapper, `basicSetup`, or raw mutation of CodeMirror-owned DOM.
- Keep the Angular component focused on lifecycle, accessibility, i18n, SSR/browser boundaries,
  uploads, and integration. Put commands, Markdown semantics, presentation, and table behavior in
  cohesive Angular-independent modules.
- Apply local edits as minimal CodeMirror transactions so undo/redo, selections, history, parser
  state, and scroll intent remain correct. Replace the whole document only for a genuinely changed
  external input and keep that synchronization out of user undo history.

## Markdown and Rendering Contracts

- Derive syntax-aware presentation from the CodeMirror syntax tree and viewport-aware extensions.
  Add a new syntax feature through the shared parser, command, highlighting, and preview contracts
  that actually need it; do not add a parallel parser or an unrelated language registry.
- Heading commands must produce valid ATX headings at the requested level, operate consistently on
  every selected line, and toggle the same heading level without damaging the selected text.
- Link commands must preserve valid escaped Markdown. Typed wiki links must keep their typed target
  and optional label semantics and resolve to localized internal routes through the shared wiki-link
  contracts.
- Image paste, drop, and picker flows must be available only when uploads are enabled. Preserve the
  captured insertion position and stable file order, expose upload failures, and let private-content
  consumers disable inline images rather than bypassing their protected-file workflow.
- Render preview only through the centralized sanitized renderer. Preserve wiki-link handling and
  shared syntax highlighting, and keep regression tests for scripts, event-handler attributes, and
  unsafe URL schemes whenever rendering or sanitization changes.
- Keep table behavior as a Markdown editing extension: source remains real Markdown, edits remain
  undoable, malformed input stays editable, and keyboard, pointer, clipboard, selection, and
  adjacent-prose behavior remain accessible and deterministic.

## Security, SSR, and Styling

- Treat SSR as a render-only path. Guard CodeMirror setup, DOM access, storage, timers, clipboard,
  downloads, uploads, focus management, geometry, and other browser-only capabilities with injected
  platform/document abstractions.
- Pass Angular's CSP nonce to CodeMirror's supported nonce configuration. Keep compiled editor styles
  component-scoped and lazy; do not introduce runtime inline positioning, copied CodeMirror base
  styles, broader CSP sources, or global editor theme imports.
- Preserve accessible names, focus restoration, keyboard-trap escape, IME composition, native
  platform navigation/undo, readable selection/caret states, and reduced interference with browser
  input behavior.

## Testing and Verification

- Use TDD for every editor behavior change or bug fix: add the smallest focused failing behavioral
  regression first, confirm the failure reason, then implement the shared invariant behind it.
- Inspect the task-relevant existing coverage before changing behavior. Fully cover changed critical
  editor and Markdown behavior across the applicable modes, boundaries, input methods, selection
  directions, undo/redo, and malformed-input cases without imposing arbitrary numeric coverage gates.
- Test observable contracts through public CodeMirror state, transactions, commands, events, stable
  semantic classes, and rendered output. Do not assert private helper names, source text, arbitrary
  DOM nesting, or other implementation details.
- Do not weaken, delete, skip, or narrow an existing regression test merely to accept a new
  implementation. When the product contract intentionally changes, state the change and replace the
  old expectation with coverage for the new contract and the previous regression boundary.
- JSDOM cannot prove real-browser geometry, scrolling, selection color, caret rendering, font
  metrics, clipboard permissions, or all IME behavior. Report any remaining browser-only gap and ask
  the user to confirm the required manual browser check before claiming that behavior is verified.
- Run the relevant focused editor suites during red/green work and the applicable frontend Make
  checks before completion, then review for regressions, flaky timing, accessibility gaps, SSR/CSP
  violations, and untested browser-only behavior.
