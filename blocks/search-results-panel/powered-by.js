/**
 * "Search powered by: Arbory Digital + StreamX", at the foot of the facet
 * column, linking to the podcast episode about how the search is built, in the
 * page's language.
 *
 * It lives INSIDE the facets container so it sits right under the last facet
 * group (a row of its own in the grid would start below the results). That
 * container is replaced on every response, and facet ordering re-appends the
 * groups, so an observer puts the badge back and keeps it last. On a phone it
 * shows in the "Sorts and filters" menu, under the facets.
 */
import { searchLanguage, t } from './search-i18n.js';

const FACETS_CONTAINER = '.stx-results-panel__facets-container';
export const POWERED_BY_CLASS = 'search-results-panel-powered-by';

/* The episode is published in every site language at the same path. */
const EPISODE = 'podcast/making-aem-and-edge-delivery-go-crazy-fast';

/**
 * The episode in a language.
 *
 * @param {string} lang e.g. 'ja'
 * @returns {string} e.g. '/ja/podcast/making-aem-and-edge-delivery-go-crazy-fast'
 */
export function poweredByHref(lang = searchLanguage()) {
  return `/${lang}/${EPISODE}`;
}

function logo(file, alt, width, height) {
  const img = document.createElement('img');
  img.src = `${window.hlx?.codeBasePath || ''}/icons/${file}`;
  img.alt = alt;
  img.width = width;
  img.height = height;
  img.loading = 'lazy';
  img.decoding = 'async';
  return img;
}

/**
 * Builds the badge.
 *
 * @param {string} [lang] Defaults to the page's language
 * @returns {Element} The link
 */
export function buildPoweredBy(lang = searchLanguage()) {
  const link = document.createElement('a');
  link.className = POWERED_BY_CLASS;
  link.href = poweredByHref(lang);

  const caption = document.createElement('span');
  caption.className = `${POWERED_BY_CLASS}__caption`;
  caption.textContent = t('poweredBy', {}, lang);

  const logos = document.createElement('span');
  logos.className = `${POWERED_BY_CLASS}__logos`;
  const plus = document.createElement('span');
  plus.className = `${POWERED_BY_CLASS}__plus`;
  plus.setAttribute('aria-hidden', 'true');
  plus.textContent = '+';
  logos.append(
    logo('arbory-digital-logo.svg', 'Arbory Digital', 174, 81),
    plus,
    logo('streamx-logo.svg', 'StreamX', 187, 48),
  );

  link.append(caption, logos);
  return link;
}

/**
 * Keeps one badge at the end of every facets container in `root`.
 *
 * @param {Element} root The block
 */
export function observePoweredBy(root) {
  const render = () => root.querySelectorAll(FACETS_CONTAINER).forEach((container) => {
    if (container.lastElementChild?.classList.contains(POWERED_BY_CLASS)) return;
    // moved back to the end when facet ordering appended groups after it
    container.append(container.querySelector(`:scope > .${POWERED_BY_CLASS}`) || buildPoweredBy());
  });
  render();
  new MutationObserver(render).observe(root, { childList: true, subtree: true });
}
