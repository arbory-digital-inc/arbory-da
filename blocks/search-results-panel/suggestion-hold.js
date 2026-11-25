/*
 * SUGGESTION HOLD — when the type-ahead dropdown must stay closed.
 *
 * The vendored query input (scripts/search/common-*.js, createQueryInput) asks
 * for suggestions on EVERY input event at or above `minSearchLength`, after a
 * 300ms debounce that nothing cancels. So:
 *
 *   - backspacing through "tax audit" fetched suggestions for "tax audi",
 *     "tax aud", "tax au"… and opened the dropdown while the reader was clearing
 *     the field (UAT: "After backspacing to delete a search term from the
 *     on-page search box, the drop-down suggestions should not appear");
 *   - a fetch started before the field emptied still landed after it, opening a
 *     list under an empty field;
 *   - Enter or the search button inside that window closed the list, and the
 *     late response reopened it over the results.
 *
 * Each of those HOLDS the field: a deletion (any `delete*` inputType —
 * Backspace, Delete, cut, a word or line deleted), the clear button, and a
 * submit. While a field is held, anything that lands in its dropdown is emptied
 * again, and its arrow keys do nothing (the library still counts the emptied
 * options and would otherwise step onto ones that are gone).
 *
 * Typing releases the hold: any input that is not a deletion — a character, a
 * paste, a dictation or autocorrect replacement. From then on the library's own
 * behaviour applies unchanged, so a new, non-empty query gets suggestions
 * exactly as before.
 */

const INPUT = '.stx-query-input__input';
const WRAPPER = '.stx-query-input';
const LIST = '.stx-query-input__suggestions-wrapper';
const HOLDERS = '.stx-query-input__search-button, .stx-query-input__clear-button';

const watched = new WeakSet();

/**
 * Holds the dropdowns of every query input inside `root`.
 *
 * Listeners go on `root`, in the capture phase, so they cover inputs the
 * library mounts later and run before its own handlers. Idempotent per root.
 *
 * @param {Element} root Element containing one or more query inputs
 * @returns {WeakSet<Element>} The held `.stx-query-input` wrappers
 */
export default function holdSuggestions(root) {
  const held = new WeakSet();
  if (watched.has(root)) return held;
  watched.add(root);

  const empty = (wrapper) => {
    const list = wrapper?.querySelector(LIST);
    if (list?.children.length) list.replaceChildren();
  };

  root.addEventListener('click', (event) => {
    const wrapper = event.target.closest?.(HOLDERS)?.closest(WRAPPER);
    if (!wrapper) return;
    held.add(wrapper);
    empty(wrapper);
  }, true);

  root.addEventListener('input', (event) => {
    const wrapper = event.target.closest?.(INPUT)?.closest(WRAPPER);
    if (!wrapper) return;
    if (event.inputType?.startsWith('delete')) {
      held.add(wrapper);
      empty(wrapper);
    } else {
      held.delete(wrapper);
    }
  }, true);

  root.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const wrapper = event.target.closest?.(INPUT)?.closest(WRAPPER);
    if (wrapper && held.has(wrapper)) event.stopPropagation();
  }, true);

  new MutationObserver(() => {
    root.querySelectorAll(`${WRAPPER} ${LIST}`).forEach((list) => {
      if (held.has(list.closest(WRAPPER))) empty(list.closest(WRAPPER));
    });
  }).observe(root, { childList: true, subtree: true });

  return held;
}
