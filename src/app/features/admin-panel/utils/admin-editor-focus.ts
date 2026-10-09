export function revealAdminEditorTarget(target: HTMLElement | null): void {
  if (target === null) return;
  let parent = target.parentElement;
  while (parent !== null) {
    if (parent.tagName === 'DETAILS') (parent as HTMLDetailsElement).open = true;
    parent = parent.parentElement;
  }
  target.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
}
