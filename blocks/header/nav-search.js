/**
 * The search box in the header: the magnifying glass authored in the nav
 * (`:search:` in the tools section) opens a box that suggests pages as you type
 * and sends the query to the language's search page, `/<lang>/search`.
 *
 * Everything it needs comes from the page's language, so the 11 locale navs only
 * have to carry the icon: suggestions come from that language's documents, and
 * the labels from `search-i18n.js`. The StreamX input (suggestions) loads on the
 * first open, not with the page; until it arrives, the plain input still submits
 * to the search page.
 */
import { loadCSS } from '../../scripts/aem.js';
import { libraryLabels, searchLanguage, t } from '../search-results-panel/search-i18n.js';

/* The suggestion endpoint: GET with `query` and `namespace`, routed to StreamX. */
const SUGGEST_URL = '/search/pages';
const QUERY_PARAM = 'query';
const MIN_SEARCH_LENGTH = 2;

/**
 * The search page for a language, with the query.
 *
 * @param {string} lang e.g. 'de'
 * @param {string} [query]
 * @returns {string} e.g. '/de/search?query=edge'
 */
export function searchPageUrl(lang, query = '') {
  const page = `/${lang}/search`;
  return query.trim() ? `${page}?${QUERY_PARAM}=${encodeURIComponent(query.trim())}` : page;
}

/**
 * Replaces the plain input with the StreamX one, which adds suggestions.
 *
 * @param {Element} navSearch The `.nav-search` element
 * @param {string} lang The page's language
 * @returns {Promise<Element|null>} The new input, or null if it could not load
 */
async function mountSuggestions(navSearch, lang) {
  const plain = navSearch.querySelector('.nav-search-input');
  try {
    loadCSS(`${window.hlx.codeBasePath}/scripts/search/streamx-search.css`);
    const [{ createSearchInput }, { renderSuggestion }] = await Promise.all([
      import('../../scripts/search/streamx-search-inline.js'),
      import('../search-results-panel/search-links.js'),
    ]);
    const labels = libraryLabels(lang);
    const typed = plain.value;
    const hadFocus = document.activeElement === plain;
    const element = createSearchInput({
      searchOpenElementSelector: '',
      searchApiUrl: SUGGEST_URL,
      searchPageUrl: (query) => searchPageUrl(lang, query),
      minSearchLength: MIN_SEARCH_LENGTH,
      queryParam: QUERY_PARAM,
      namespace: lang,
      showSearchButton: false,
      // The search page's option: a folder's index page links to the folder
      // (the library's own links `/en/index`, a 404), and an apex-site hit to its
      // own host. Same class, so the capture click below still finds it.
      renderers: { suggestionItem: renderSuggestion },
      labels: {
        inputPlaceholder: labels.inputPlaceholder,
        inputLabel: labels.inputLabel,
        clearButtonAria: labels.clearButtonAria,
        searchButtonAria: labels.searchButtonAria,
      },
    }, plain);
    const input = element.querySelector('input');
    input.classList.add('nav-search-input');
    if (typed) {
      input.value = typed;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (hadFocus || navSearch.classList.contains('expanded')) input.focus();
    return input;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Header search suggestions failed to load; the box still searches', error);
    return null;
  }
}

/**
 * Builds the expanding search box from the search icon authored in the nav.
 *
 * @param {Element} icon The authored `span.icon-search`
 * @param {Object} [options]
 * @param {MediaQueryList} [options.isDesktop] Desktop keeps the query on close
 * @returns {Element} The `.nav-search` element
 */
export default function createNavSearch(icon, { isDesktop } = {}) {
  const lang = searchLanguage();
  const labels = libraryLabels(lang);

  const navSearch = document.createElement('div');
  navSearch.className = 'nav-search';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'nav-search-toggle';
  toggle.setAttribute('aria-label', t('openSearch', {}, lang));
  toggle.setAttribute('aria-expanded', 'false');
  toggle.append(icon);

  const form = document.createElement('form');
  form.className = 'nav-search-form';
  form.setAttribute('role', 'search');
  form.action = `/${lang}/search`;

  const input = document.createElement('input');
  input.type = 'search';
  input.name = QUERY_PARAM;
  input.className = 'nav-search-input';
  input.placeholder = labels.inputPlaceholder;
  input.setAttribute('aria-label', labels.inputLabel);
  form.append(input);

  // The StreamX input submits on Enter itself; this covers the plain one.
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = form.querySelector('input')?.value || '';
    if (query.trim()) window.location.href = searchPageUrl(lang, query);
  });

  let suggestions;
  const loadSuggestions = () => {
    suggestions ||= mountSuggestions(navSearch, lang);
    return suggestions;
  };
  const getInput = () => form.querySelector('input');

  const setExpanded = (expanded) => {
    navSearch.classList.toggle('expanded', expanded);
    toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    toggle.setAttribute('aria-label', t(expanded ? 'closeSearch' : 'openSearch', {}, lang));
    if (expanded) {
      getInput().focus();
      loadSuggestions();
    }
    // the mobile takeover is transient: dismissing it also clears the query
    if (!isDesktop?.matches && !expanded) getInput().value = '';
  };

  toggle.addEventListener('click', () => {
    setExpanded(!navSearch.classList.contains('expanded'));
  });
  // start fetching the suggestion code as soon as someone reaches for the icon
  toggle.addEventListener('pointerenter', loadSuggestions, { once: true });
  toggle.addEventListener('focus', loadSuggestions, { once: true });

  form.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      setExpanded(false);
      toggle.focus();
    }
  });

  // A suggestion opens its page. The bundle would instead search for the
  // suggestion's text, which is often a sentence from the body; stopping the
  // click here, before it reaches the bundle, leaves the link to do its job.
  // Enter on a highlighted suggestion clicks it, so it lands here too.
  navSearch.addEventListener('click', (e) => {
    const item = e.target.closest('.stx-suggestion__item');
    if (item?.getAttribute('href')) e.stopPropagation();
  }, true);

  // collapse when clicking outside the search element
  document.addEventListener('click', (e) => {
    if (navSearch.classList.contains('expanded') && !navSearch.contains(e.target)) {
      setExpanded(false);
    }
  });

  navSearch.append(toggle, form);
  return navSearch;
}
