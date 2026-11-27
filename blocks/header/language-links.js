/*
 * Language links for the header's language selector.
 *
 * A link points at the same page in another language: the locale folder is
 * swapped and the rest of the path kept. On the search page it also keeps the
 * search, so a reader can compare results across languages without typing the
 * query again: the query, the facet selection, the sort order and the active
 * tab. Facet values are indexed in English for every language (see
 * blocks/search-results-panel/search-i18n.js), so a filter means the same in
 * the other language.
 *
 * Not carried: the result page (`stx-page`), since page 4 here may not exist
 * there, and any other param.
 *
 * The search page changes its URL with replaceState as the reader types and
 * filters, which fires no event, so the header recomputes the links each time
 * the selector is opened or a link is about to be followed (refreshLanguageLinks).
 */

/** Search state worth keeping across a language switch. */
export const CARRIED_PARAMS = ['query', 'stx-facets', 'stx-sort', 'stx-tab'];

/**
 * The URL of the current page in another language.
 *
 * @param {string} code Target language folder, e.g. `pt`
 * @param {URL|Location} [from] The current page
 * @returns {string} Absolute URL
 */
export function languageHref(code, from = window.location) {
  const pathParts = from.pathname.split('/');
  // Drop the empty first element and the language folder, if there is one.
  pathParts.splice(0, pathParts[1] && pathParts[1].length <= 5 ? 2 : 1);
  const url = new URL(`/${code}/${pathParts.join('/')}`, from.origin);

  const current = new URLSearchParams(from.search);
  CARRIED_PARAMS.forEach((param) => {
    const value = current.get(param);
    if (value) url.searchParams.set(param, value);
  });
  return url.href;
}

/**
 * Points every `a[data-lang]` under `root` at the current page and search.
 *
 * @param {ParentNode} root
 */
export function refreshLanguageLinks(root) {
  root.querySelectorAll('a[data-lang]').forEach((link) => {
    link.href = languageHref(link.dataset.lang);
  });
}
