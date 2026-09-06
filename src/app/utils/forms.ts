/**
 * Blocks the browser's implicit "submit the form on Enter" behavior for
 * ordinary fields, while still letting Enter insert a newline in a
 * <textarea> and letting Enter activate a focused <button> (e.g. the Save
 * button) as normal. Bind to `(keydown.enter)` on the `<form>` element so a
 * single listener covers every descendant field, including inputs rendered
 * by nested components like `app-checklist-editor`.
 */
export function preventEnterSubmit(event: Event): void {
  const target = event.target as HTMLElement;
  if (target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON') return;
  event.preventDefault();
}
