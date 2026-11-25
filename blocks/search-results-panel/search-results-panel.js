/* eslint-disable no-underscore-dangle */
/*
 * Search Results Panel
 *
 * Renders a StreamX search results panel: a query input, a facet sidebar and a
 * paginated result list. Authored as a key/value table, same as every other
 * config-driven block in this repo.
 *
 *   | Search Results Panel |                           |
 *   | searchApiUrl         | /search/pages             |
 *   | dataSources          | /search/arbory-pages/body |
 *   | requestId            | arbory-pages              |
 *   | pageSize             | 10                        |
 *   | namespace            | en                        |
 *
 * The panel itself comes from the vendored StreamX bundle (scripts/search/).
 * This file owns three things the bundle deliberately leaves open:
 *
 *   1. the per-hit renderers (what one result row looks like),
 *   2. the facet sidebar affordances the bundle does not ship (a filter field
 *      and removable selection badges),
 *   3. the loading adaptation — see loadSearchStyles below.
 *
 * Ported from an earlier client site's block of the same name and re-themed for Arbory
 * (search-results-panel.css). The earlier site's analytics hooks are not carried over.
 */
import { codeBasePath, loadCSS } from './platform.js';
import decorateResultsPanel from '../../scripts/search/eds/search-results-panel.js';
import {
  highlightNodes, renderSuggestion, resultUrl, SUGGESTION_CLASS,
} from './search-links.js';
import holdSuggestions from './suggestion-hold.js';
import { installMockSearch } from '../../scripts/search-mock/mock-search.js';
import { observeFeatured, observePromo } from './curated-results.js';
import { installOperatorRequestHook } from './search-operators.js';
import {
  t, formatCount, searchLanguage, searchLocale, libraryLabels, facetHeading, facetValueLabel,
} from './search-i18n.js';
import { observePoweredBy } from './powered-by.js';

/*
 * The bundle's own stylesheet.
 *
 * Written as a root-absolute literal, NOT as `${codeBase}/scripts/...`, because
 * the library's EDS decorators append a <link> to this exact string themselves
 * (`loadCssFile('/scripts/search/streamx-search.css')`, compiled into the build
 * output). Matching it byte-for-byte is what lets loadSearchStyles below both
 * pre-load and de-duplicate it.
 *
 * That is correct on EDS regardless: code and content are served from the same
 * host, so `codeBasePath()` is empty and the root-absolute path is the
 * code path. loadSearchStyles warns if that ever stops being true.
 */
const STREAMX_CSS = '/scripts/search/streamx-search.css';

/**
 * Loads the StreamX stylesheet the way aem.js loads block styles.
 *
 * The bundle ships its own loader, and it is wrong for us twice over: it is
 * fire-and-forget (so the panel paints unstyled for a frame or two) and it has
 * no de-duplication (so every re-decorate — a sort change rebuilds the panel —
 * links the same stylesheet again).
 *
 * `loadCSS` from `aem.js` is awaited and idempotent (it keys on the href), so
 * awaiting it here means the rules are in the CSSOM before the panel is
 * appended. The bundle then adds its duplicate anyway — we cannot stop it
 * without editing the bundle — so the caller drops the extras afterwards via
 * `dedupeSearchStyles`.
 *
 * @returns {Promise<void>} Resolves once the stylesheet has loaded (or failed)
 */
export async function loadSearchStyles() {
  const codeBase = codeBasePath();
  // A non-empty code base path means code is served from somewhere other than
  // the page root, and the bundle's root-absolute path would miss it. Warn
  // rather than throw: that degrades to the bundle's own (unstyled-first)
  // load, it does not break search.
  if (codeBase) {
    // eslint-disable-next-line no-console
    console.warn(
      `[search] code is served from "${codeBase}" but the bundle asks for `
      + `"${STREAMX_CSS}" — it may not resolve. See blocks/search-results-panel.`,
    );
  }
  try {
    await loadCSS(STREAMX_CSS);
  } catch {
    // A failed stylesheet must not stop the panel; the bundle retries its own.
  }
}

/**
 * Removes the duplicate stylesheet links the vendored bundle appends.
 *
 * Keeps the first, drops the rest. Safe to call after every decorate: with one
 * link present it does nothing.
 */
export function dedupeSearchStyles() {
  const links = document.head.querySelectorAll(`link[rel="stylesheet"][href="${STREAMX_CSS}"]`);
  for (let i = 1; i < links.length; i += 1) links[i].remove();
}

/*
 * Payload fields the row reads for its date and its summary, in preference
 * order. Lists rather than single names so a field rename upstream is a
 * one-line change here rather than a broken row. `firstField` takes the first the payload actually
 * carries, so a rename is a one-line change here rather than a broken row.
 *
 * The Arbory index carries `payload.date` as an ISO `yyyy-MM-dd`; a hit with no
 * date simply renders no date line.
 */
/*
 * Host the result URLs are DISPLAYED against, from the authored `resultUrlHost`
 * row. Empty means "whatever host the reader is on".
 *
 * AUTHORED rather than compiled in, because preview and review hosts
 * (`*.aem.page`, `*.aem.live`, localhost) would otherwise display their own
 * origin; the default — the reader's own origin — is right on production.
 *
 * MODULE-LEVEL because `renderItem` cannot be given it any other way: the
 * library calls the renderers itself, from a map it is handed once
 * (`searchRenderers`), so a renderer never sees the block's authored rows.
 */
let resultUrlHost = '';

/**
 * Sets the host result URLs are displayed against.
 *
 * Forgiving about the authored form: a bare host (`www.arborydigital.com`) gains a
 * scheme and a trailing slash is dropped, because both are things an author
 * will reasonably type and neither should change what is rendered.
 *
 * @param {string} [value] Authored `resultUrlHost` value
 */
export function setResultUrlHost(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) {
    resultUrlHost = '';
    return;
  }
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  resultUrlHost = withScheme.replace(/\/+$/, '');
}

const DATE_FIELDS = ['date', 'publication-date', 'article-date', 'published'];
const DESCRIPTION_FIELDS = ['description', 'summary'];

/**
 * The hit's content type, for its pill: the first value of the
 * `content_type_level0` facet family, or '' when the hit carries none.
 *
 * @param {Object} payload A hit's `_source.payload`
 * @returns {string} e.g. 'Article'
 */
export function contentTypeOf(payload) {
  const value = payload?.facets?.content_type_level0;
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === 'string' ? first.trim() : '';
}

/** First of `fields` the payload actually carries, else undefined. */
const firstField = (payload, fields) => fields
  .map((field) => payload?.[field])
  .find((value) => value !== undefined && value !== null && value !== '');

/**
 * Parses an index date value into a timestamp and whether it was date-only.
 *
 * Epoch numbers and date strings are both accepted, the same two shapes
 * `cardlist-filter.js` sorts on, using its `> 1e9` test to tell a timestamp from
 * a stray number.
 *
 * @param {string|number} value Raw payload value
 * @returns {?{ms: number, dateOnly: boolean}} null when it is not a date
 */
function parseIndexDate(value) {
  if (value === undefined || value === null || value === '') return null;

  const numeric = Number(value);
  if (!Number.isNaN(numeric) && numeric > 1e9) return { ms: numeric, dateOnly: false };

  const text = String(value).trim();
  const ms = Date.parse(text);
  if (Number.isNaN(ms)) return null;

  return { ms, dateOnly: /^\d{4}-\d{2}-\d{2}$/.test(text) };
}

/**
 * Formats an index date for display, or '' when the value is not a date.
 *
 * A date-only string is formatted in UTC on purpose: `Date.parse('2025-05-15')`
 * is midnight UTC, so rendering it in any timezone behind UTC would print the
 * 14th. Values that carry a time are left in local, where local is correct.
 *
 * @param {string|number} value Raw payload value
 * @returns {string} e.g. 'May 15, 2025', or '' if unparseable
 */
function formatItemDate(value) {
  const parsed = parseIndexDate(value);
  if (!parsed) return '';

  return new Date(parsed.ms).toLocaleDateString(searchLocale(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(parsed.dateOnly ? { timeZone: 'UTC' } : {}),
  });
}

/**
 * Renders one search result as a link to the page it represents.
 *
 * `resultUrl` turns the hit's `_id` ("en:/en/blog/…") into its URL,
 * stripping the namespace prefix when the hit carries one and mapping a folder's
 * index document to the folder. Index values are applied with textContent/href
 * rather than innerHTML, so they are never parsed as markup.
 *
 * @param {Object} item Search hit
 * @returns {HTMLElement} The rendered result
 */
export function renderItem(item) {
  const url = resultUrl(item);
  const { payload } = item._source;

  const link = document.createElement('a');
  link.className = 'search-results-panel-item';
  link.href = url;

  // A hit whose payload never got enriched has no title. Falling back to the
  // URL keeps the row clickable — throwing here would make the row drop out of
  // the list while it still counted toward the reported total.
  const title = document.createElement('span');
  title.className = 'search-results-panel-item__title';
  title.textContent = payload?.title || url;

  link.append(title);

  /*
   * The page's full URL, under its title.
   *
   * The hit only carries a PATH — `resultUrl` strips the namespace off `_id`
   * (`en:/en/blog/…` → `/en/blog/…`) — so the host is supplied here: the
   * authored `resultUrlHost` if there is one, otherwise the host the reader is
   * already on. That fallback is self-correcting in production, where the reader
   * IS on the public host; the authored row exists for the demo and preview
   * hosts, where the origin is a URL no reader will ever type.
   *
   * THE HREF STAYS RELATIVE, deliberately, and this is the one asymmetry worth
   * knowing. The text shows where the page lives publicly; the link goes to the
   * same document on whatever host the reader is currently browsing — so a
   * result on the preview host opens the preview copy, not production. They are
   * the same page, and on production they are the same URL.
   *
   * An apex-site hit is the exception by construction: its URL is already
   * protocol-relative (`//arborydigital.com/en/…`), so `new URL` keeps its own
   * host for the text and the link opens on that host from anywhere.
   *
   * Not a nested `<a>`: the whole row is already one anchor, and an anchor
   * inside an anchor is invalid and unreachable by keyboard. This is text that
   * SHOWS where the row goes; the row is what goes there.
   *
   * There is no thumbnail per result (deferred on the earlier site too), so this row has no
   * media column to sit beside.
   */
  const location = document.createElement('span');
  location.className = 'search-results-panel-item__url';
  try {
    location.textContent = new URL(url, resultUrlHost || window.location.origin).href;
  } catch {
    // An unparseable authored host must not cost the row its URL line.
    location.textContent = url;
  }
  link.append(location);

  /*
   * The teaser under the title.
   *
   * `highlight['payload.content']` is what OpenSearch matched, with the matched
   * terms wrapped in <em> — which is why this is the one field NOT applied with
   * textContent. The fragments are joined with an ellipsis because each is a
   * separate, non-contiguous excerpt from the page.
   *
   * The markup is rebuilt node by node rather than assigned as innerHTML: the
   * only element the highlighter emits is <em>, so anything else in there is not
   * ours and does not belong in the DOM.
   */
  /*
   * The date, as a `<time>` rather than a span: the row is the only place it
   * appears, so the machine-readable value is worth keeping beside the long form.
   */
  /*
   * The meta line: the content-type pill and the date, side by side. Either may
   * be absent, and the line is dropped when both are.
   *
   * The pill is `payload.facets.content_type_level0` — the same value the
   * Content type facet counts — so what a row says it is and what the filter
   * calls it can never disagree. Text, not a link: the whole row is already one
   * anchor.
   */
  const meta = document.createElement('span');
  meta.className = 'search-results-panel-item__meta';

  const contentType = contentTypeOf(payload);
  if (contentType) {
    const pill = document.createElement('span');
    pill.className = 'search-results-panel-item__type';
    pill.textContent = facetValueLabel(contentType);
    meta.append(pill);
  }

  const rawDate = firstField(payload, DATE_FIELDS);
  const date = formatItemDate(rawDate);
  if (date) {
    // The label is a wrapper around the `<time>` rather than part of its text,
    // so the machine-readable element still holds nothing but the date.
    const dateEl = document.createElement('span');
    dateEl.className = 'search-results-panel-item__date';
    dateEl.append(document.createTextNode(t('published')));

    const time = document.createElement('time');
    time.dateTime = String(rawDate);
    time.textContent = date;
    dateEl.append(time);

    meta.append(dateEl);
  }

  if (meta.childNodes.length) link.append(meta);

  /*
   * The summary line, preferring the AUTHORED description over the matched
   * excerpt.
   *
   * `description` is the page's own summary — a written sentence — where
   * `highlight['payload.content']` is whatever text happened to surround the
   * match, which frequently opens mid-clause. The excerpt stays as the fallback so a
   * hit with no description still says something, and it keeps the `<em>` match
   * highlighting the highlighter emits — the one field NOT applied with
   * textContent, and rebuilt node by node so nothing but `<em>` reaches the DOM.
   */
  const description = firstField(payload, DESCRIPTION_FIELDS);
  const fragments = item.highlight?.['payload.content'];
  if (description) {
    const summary = document.createElement('p');
    summary.className = 'search-results-panel-item__description';
    // textContent, so an index value is never parsed as markup.
    summary.textContent = description;
    link.append(summary);
  } else if (fragments?.length) {
    const teaser = document.createElement('p');
    teaser.className = 'search-results-panel-item__teaser';
    fragments.slice(0, 2).forEach((fragment, index) => {
      if (index > 0) teaser.append(document.createTextNode(' … '));
      teaser.append(...highlightNodes(fragment));
    });
    link.append(teaser);
  }

  /*
   * "Read more", closing the card.
   *
   * HIDDEN FROM ASSISTIVE TECH. The whole card is one anchor, so its accessible
   * name is already the title; announcing "Read more" after it would add a
   * second, less useful name for the same destination — the exact thing that
   * makes a list of "read more" links unusable by screen reader. It is a visual
   * affordance, so it is treated as one.
   *
   * Unconditional, unlike the date and the summary: it is the card's call to
   * action, not a field of the hit, so there is nothing for it to be absent for.
   */
  const more = document.createElement('span');
  more.className = 'search-results-panel-item__more';
  more.setAttribute('aria-hidden', 'true');

  const chevron = document.createElement('span');
  chevron.className = 'search-results-panel-item__more-chevron';
  more.append(chevron, document.createTextNode(t('readMore')));

  link.append(more);

  return link;
}

/*
 * Inline SVG icons replacing the library's default "🔍" and "✕" glyphs.
 *
 * These return strings rather than elements on purpose. The library's `html`
 * tag only turns HTMLElement/Array/NodeList values into real nodes and
 * concatenates everything else straight into innerHTML — and an SVG built with
 * createElementNS is an SVGElement, not an HTMLElement, so it would render as
 * the literal text "[object SVGSVGElement]".
 *
 * Both buttons already carry an aria-label, so the glyphs stay hidden.
 */
const icon = (paths) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;

export const searchIcon = () => icon('<circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" />');

export const clearIcon = () => icon('<path d="M18 6 6 18M6 6l12 12" />');

/**
 * Makes choosing a suggestion OPEN its page, rather than search for its title.
 *
 * The library's dropdown click handler cancels the link and searches for the
 * option's text; Enter on a highlighted option `.click()`s it into the same
 * handler. A CAPTURE listener on the block stops the click before it reaches the
 * dropdown, without cancelling it, so the browser follows the link (and a
 * modified click still opens a new tab).
 *
 * Enter with NO highlighted option submits what was typed, through the search
 * button (the same `submitQuery` the library's Enter runs). The library's own
 * Enter does nothing once its arrow keys step one PAST the last option, which
 * also leaves `aria-activedescendant` on that option; it is cleared after an
 * arrow key whenever nothing is highlighted.
 *
 * The dropdown stays closed while a field is being cleared or has just been
 * submitted: a submitted query's late suggestions would reopen it over the
 * results, and backspacing would open it for every shorter prefix. See
 * suggestion-hold.js, which the header's search box shares.
 *
 * @param {Element} root Element containing one or more query inputs
 */
export function observeSuggestions(root) {
  holdSuggestions(root);

  root.addEventListener('click', (event) => {
    if (!event.target.closest?.(`.${SUGGESTION_CLASS}`)) return;
    event.stopPropagation();
  }, true);

  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.isComposing) return;
    const wrapper = event.target.closest?.('.stx-query-input__input')?.closest('.stx-query-input');
    if (!wrapper || wrapper.querySelector(`.${SUGGESTION_CLASS}.is-active`)) return;
    const submit = wrapper.querySelector('.stx-query-input__search-button');
    if (!submit) return;
    event.stopPropagation();
    submit.click();
  }, true);

  root.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const input = event.target.closest?.('.stx-query-input__input');
    const wrapper = input?.closest('.stx-query-input');
    if (!wrapper || wrapper.querySelector(`.${SUGGESTION_CLASS}.is-active`)) return;
    input.removeAttribute('aria-activedescendant');
  });
}

/*
 * The renderers the library is handed.
 *
 * The library looks up `item-${_source.type}` per hit and, with no match, drops
 * the row (or shows a "Missing renderer" diagnostic when debugMode is on).
 *
 *   page/eds       — what the StreamX ingestion emits for a page published
 *                    from DA, so every Arbory page arrives under this type.
 *   page/eds-page  — an older ingestion type. Nothing Arbory publishes emits
 *                    it; the mapping is here so a re-pointed or shared index
 *                    does not silently drop half its rows.
 *
 * `suggestionItem` is the query input's dropdown option (renderSuggestion).
 */
export const searchRenderers = {
  'item-page/eds': renderItem,
  'item-page/eds-page': renderItem,
  suggestionItem: renderSuggestion,
  searchIcon,
  clearIcon,
};

/*
 * Facet headings are relabelled from search-i18n.js (`facetHeading`), KEYED ON
 * THE RENDERED TEXT, not the field, because the field never reaches the DOM:
 * `createFacetGroup` writes `humanizeFacetName(field)` into the heading and keeps
 * the field itself in a closure. So the key is that function's output —
 * `content_type_level0` → `Content Type` — and a field renamed upstream would
 * simply stop matching and show its own humanised name, which is a visible miss
 * rather than a silent wrong label.
 */

/*
 * The order the facet boxes are rendered in, top to bottom: Content type,
 * Topic, Technology, Year, Author — broadest first.
 *
 * IT HAS TO LIVE IN THE BLOCK, because the response does not carry an order
 * worth using. `createFacets` builds the rail with
 * `Object.keys(data.aggregations).map(createFacetGroup)`, so the boxes come out
 * in the order OpenSearch serialised its aggregations object — which is neither
 * the template's declaration order nor alphabetical (measured on the earlier site's index).
 *
 * KEYED ON THE ENGLISH HEADING TEXT, like the relabel above and for the same reason.
 * These are `humanizeFacetName` outputs, so `content_type_level0` is "Content
 * Type" with a capital T — the lower-case rendering is the relabel, applied
 * after this runs.
 *
 * A group NOT named here sorts last, keeping its relative order, rather than
 * being dropped. A new family added to the template is then visible-but-unplaced,
 * which someone notices; hiding it is how a facet goes missing for a month.
 */
const FACET_ORDER = [
  'Content Type',
  'Topic',
  'Technology',
  'Year',
  'Author',
];

/*
 * Facet groups whose values are ordered by their LABEL, descending, instead of
 * by count (the response's order). Year reads newest first: "2026, 2025, 2024"
 * is how a reader scans years, and by count a quiet recent year would sink
 * below a busy old one. Keyed on the heading text, like FACET_ORDER.
 */
const FACET_SORT_BY_KEY_DESC = ['Year'];

/**
 * Top-level values above which a facet group gets its filter field. Every value
 * is always shown (UAT: no "show more" / "show less"); the field is how a reader
 * finds one in a long group such as Technology or Author.
 */
const FACET_FILTER_THRESHOLD = 5;

const NODE_SELECTOR = ':scope > .stx-results-panel__facet-node';
const CHILD_NODE_SELECTOR = ':scope > .stx-results-panel__facet-children > .stx-results-panel__facet-node';
const ROW_LABEL_SELECTOR = ':scope > .stx-results-panel__facet-row .stx-results-panel__facet-label';
const FACETS_CONTAINER_CLASS = 'stx-results-panel__facets-container';
const RESULTS_META_CLASS = 'stx-results-panel__results-number';
/* The results range this file renders in place of the library's total. */
const RANGE_CLASS = 'search-results-panel-range';

/* Root class of the sort control this file mounts into the results header. */
const SORT_CLASS = 'search-results-panel-sort';
/* The page counter this file mirrors under the pagination buttons. */
const PAGE_NUMBER_CLASS = 'search-results-panel-page-number';

/* Holds the library's own numbered buttons once the arrows replace them: they
   carry its click listeners, so they are hidden rather than removed. */
const HIDDEN_PAGES_CLASS = 'search-results-panel-pages-hidden';

const PAGINATION_SELECTOR = '.stx-results-panel__pagination-container';
const ARROW_CLASS = 'search-results-panel-pagination-arrow';
/* The arrows carry `data-page-number` too; only the library's buttons fetch. */
const LIBRARY_PAGE_BUTTON = `${PAGINATION_SELECTOR} button[data-page-number]:not(.${ARROW_CLASS})`;
/* On the results container while the library has a request in flight. */
const LOADING_CLASS = 'stx-results-panel__container--loading';

/** A facet node's own bucket label, ignoring any nested below it. */
const facetLabelOf = (node) => node.querySelector(ROW_LABEL_SELECTOR)?.textContent?.trim() || '';

/**
 * Labels from the root of a facet tree down to the given node.
 *
 * Read from the DOM rather than by splitting the checkbox value, which is a
 * separator-joined path whose separator is authored (`facetPathSeparator`) and
 * so is not knowable from here.
 *
 * @param {Element} input A facet checkbox
 * @returns {string[]} Ancestor labels, outermost first
 */
function facetAncestry(input) {
  const labels = [];
  let node = input.closest('.stx-results-panel__facet-node');
  while (node) {
    const label = facetLabelOf(node);
    if (label) labels.unshift(label);
    node = node.parentElement?.closest('.stx-results-panel__facet-node') || null;
  }
  return labels;
}

/**
 * Adds a filter field to one facet group.
 *
 * The library renders every bucket the response carried, and every one stays on
 * screen: a "Show N more" cap used to hide all but five, and was removed at
 * UAT's request so that every option can be seen without expanding a list.
 * Groups ship closed (see FACET GROUPS SHIP CLOSED), so a long group only takes
 * room once the reader opens it. The field narrows what is shown while it holds
 * text and is added from here because the bundle is copy-in-only.
 *
 * Skipped entirely for groups at or under the threshold — a filter field above
 * four checkboxes is clutter, not help.
 *
 * @param {Element} group One `.stx-results-panel__facet`
 */
/**
 * Applies a heading override to one facet group, if it has one.
 *
 * Its own pass rather than a line inside `enhanceFacetGroup`, which returns
 * early for any group with five values or fewer — that one exists to add the
 * filter field, and most groups never reach it.
 * Relabelling has to happen for every group regardless of size.
 *
 * @param {Element} group One `.stx-results-panel__facet`
 */
/**
 * Sorts the facet boxes into FACET_ORDER, in place.
 *
 * Runs BEFORE `relabelFacetGroup`, because the override maps "Content Type" to
 * "Content type" and this keys on the un-overridden heading. Doing it the
 * other way round would leave the renamed box unranked and push it to the end.
 *
 * `append` on an element already in the container MOVES it, so no node is
 * recreated and the library's listeners on the checkboxes survive. The
 * unchanged case returns early: re-appending nine boxes on every response would
 * churn the DOM for nothing and defeat the reader's scroll position.
 *
 * @param {Element} container One `.stx-results-panel__facets-container`
 */
function orderFacetGroups(container) {
  const groups = [...container.querySelectorAll(':scope > .stx-results-panel__facet')];
  if (groups.length < 2) return;

  const rank = (group) => {
    const at = FACET_ORDER.indexOf(
      group.querySelector('.stx-results-panel__facet-name')?.textContent?.trim(),
    );
    return at === -1 ? FACET_ORDER.length : at;
  };

  // Stable, so unlisted groups keep the response's relative order among themselves.
  const wanted = [...groups].sort((a, b) => rank(a) - rank(b));
  if (wanted.every((group, i) => group === groups[i])) return;
  wanted.forEach((group) => container.append(group));
}

/**
 * Re-orders a FACET_SORT_BY_KEY_DESC group's values by label, descending.
 *
 * Moves the library's own nodes (`append` on a child MOVES it), so their
 * checkboxes keep the library's listeners. Numeric-aware, so "2026" sorts above
 * "2025" and a stray non-year still lands somewhere sensible. Returns early when
 * the order is already right, so a re-render does not churn the DOM.
 *
 * @param {Element} group One `.stx-results-panel__facet`
 */
export function sortFacetValuesByKey(group) {
  const name = group.querySelector('.stx-results-panel__facet-name')?.textContent?.trim();
  if (!FACET_SORT_BY_KEY_DESC.includes(name)) return;
  const values = group.querySelector('.stx-results-panel__facet-values');
  const nodes = values ? [...values.querySelectorAll(NODE_SELECTOR)] : [];
  if (nodes.length < 2) return;

  const wanted = [...nodes].sort((a, b) => facetLabelOf(b)
    .localeCompare(facetLabelOf(a), undefined, { numeric: true }));
  if (wanted.every((node, i) => node === nodes[i])) return;
  wanted.forEach((node) => values.append(node));
}

function relabelFacetGroup(group) {
  const name = group.querySelector('.stx-results-panel__facet-name');
  const label = facetHeading(name?.textContent?.trim());
  if (label) name.textContent = label;
  // Values are filter keys (the checkbox's `value`) and stay as indexed; only
  // the text beside the box is translated.
  group.querySelectorAll('.stx-results-panel__facet-label').forEach((el) => {
    const value = el.textContent.trim();
    const translated = facetValueLabel(value);
    if (translated !== value) el.textContent = translated;
  });
}

function enhanceFacetGroup(group) {
  const values = group.querySelector('.stx-results-panel__facet-values');
  const nodes = values ? [...values.querySelectorAll(NODE_SELECTOR)] : [];
  if (nodes.length <= FACET_FILTER_THRESHOLD) return;

  const groupName = group.querySelector('.stx-results-panel__facet-name')?.textContent?.trim();

  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'search-results-panel-facet-search';
  search.placeholder = t('filter');
  search.setAttribute('aria-label', groupName ? t('filterGroup', { group: groupName }) : t('filterValues'));

  const labelOf = (node) => facetLabelOf(node).toLowerCase();

  /*
   * Matches a subtree and reports whether anything in it hit, so a parent can
   * stay visible for the sake of a matching descendant.
   *
   * `inherited` carries a matched ancestor downwards: once a parent matches, its
   * whole subtree stays browsable rather than being filtered out from under it.
   */
  const filterNode = (node, query, inherited) => {
    const self = !query || labelOf(node).includes(query);
    const children = [...node.querySelectorAll(CHILD_NODE_SELECTOR)];
    const childMatch = children
      .map((child) => filterNode(child, query, inherited || self))
      .some(Boolean);

    node.hidden = !(self || childMatch || inherited);

    // A hit two levels down is worthless while its parent is still collapsed.
    if (query && childMatch) {
      const panel = node.querySelector(':scope > .stx-results-panel__facet-children');
      const toggle = node.querySelector(':scope > .stx-results-panel__facet-row .stx-results-panel__facet-subtoggle');
      if (panel) panel.hidden = false;
      if (toggle) toggle.setAttribute('aria-expanded', 'true');
    }

    return self || childMatch;
  };

  search.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase();
    nodes.forEach((node) => filterNode(node, query, false));
  });

  values.prepend(search);
}

/**
 * Mirrors the current facet selection into removable badges beside the count.
 *
 * The selection is read off the checkboxes rather than tracked here: the library
 * keeps it in a private `panelState`, but `refreshFacetStates` writes it back to
 * every input, so `:checked` is that state. It also rolls a fully selected
 * branch up to its parent, which the badges inherit for free — one chip for the
 * parent rather than one per child.
 *
 * Removal replays a real click, so the library's own change handler clears the
 * selection, rewrites the URL and re-runs the search exactly as the checkbox
 * would have.
 *
 * @param {Element} panel One `.stx-results-panel`
 */
function renderSelectedBadges(panel) {
  const meta = panel?.querySelector(`.${RESULTS_META_CLASS}`);
  if (!meta) return;

  let list = meta.querySelector('.search-results-panel-selected');
  if (!list) {
    list = document.createElement('div');
    list.className = 'search-results-panel-selected';
    meta.append(list);
  }

  const facets = panel.querySelector(`.${FACETS_CONTAINER_CLASS}`);
  const selected = facets
    ? [...facets.querySelectorAll('.stx-results-panel__facet-option input:checked')]
    : [];

  list.replaceChildren();
  list.hidden = selected.length === 0;

  selected.forEach((input) => {
    const path = facetAncestry(input);
    const leaf = path[path.length - 1] || input.value;

    const badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'search-results-panel-selected-badge';
    badge.setAttribute('aria-label', t('removeFilter', { name: path.join(' › ') || leaf }));
    // Only the ancestry a nested value carries; a top-level one adds nothing.
    if (path.length > 1) badge.title = path.join(' › ');

    const text = document.createElement('span');
    text.textContent = leaf;

    // Decorative: the button's aria-label already says what activating it does.
    const remove = document.createElement('span');
    remove.className = 'search-results-panel-selected-badge__remove';
    remove.setAttribute('aria-hidden', 'true');
    remove.textContent = '×';

    badge.append(text, remove);
    badge.addEventListener('click', () => input.click());
    list.append(badge);
  });
}

/*
 * FACET GROUPS SHIP CLOSED — and nothing here opens them.
 *
 * The library renders every group collapsed (`aria-expanded="false"`, values
 * `hidden`), which is now the behaviour we want, so this file no longer touches
 * their expanded state at all.
 *
 * There used to be an `expandFacetGroups` pass here that opened every top-level
 * group on first render, desktop only. It was removed by request: the rail is
 * five closed labels the reader opens on purpose, on every viewport. Two things
 * that pass had to get right are worth recording, because they are the reasons
 * NOT to reintroduce it casually:
 *
 *   - It had to be once-only and flagged on the PANEL, not on the facets
 *     container, because `updateFacets` replaces that container on every
 *     response — a per-container flag re-opened a group on the next query after
 *     the reader had deliberately closed it.
 *   - It was skipped on narrow screens, where the facets stack ABOVE the
 *     results and five open groups pushed the first result screens down.
 *
 * The reader's own choices persist across responses without our help: the
 * library restores each group's expanded state onto the new container itself.
 */

/**
 * Keeps the facet controls and the selection badges attached across re-renders.
 *
 * `updateFacets` replaces the entire facets container on every response, so a
 * one-shot pass would be thrown away by the next query, filter or page change.
 * The results header is the opposite — `updateResultsMeta` rewrites its text in
 * place — so the badge list is built once there and refilled.
 *
 * Only *added* nodes are inspected, and neither the controls nor the badges are
 * one of the two watched classes, so nothing inserted here retriggers this.
 *
 * @param {Element} root Element containing one or more results panels
 */
export function observeFacets(root) {
  const enhance = (container) => {
    const panel = container.closest('.stx-results-panel');
    if (!container.dataset.facetsEnhanced) {
      container.dataset.facetsEnhanced = 'true';
      orderFacetGroups(container);
      container.querySelectorAll('.stx-results-panel__facet').forEach((group) => {
        // Before relabelling, which it keys on the library's heading.
        sortFacetValuesByKey(group);
        // Before the filter field is built: its `aria-label` is composed from the
        // heading, so relabelling afterwards would leave "Filter Content Type".
        relabelFacetGroup(group);
        enhanceFacetGroup(group);
      });
    }
    renderSelectedBadges(panel);
  };

  const collect = (node, className) => {
    if (!(node instanceof HTMLElement)) return [];
    return node.classList.contains(className) ? [node] : [...node.querySelectorAll(`.${className}`)];
  };

  const handleAdded = (node) => {
    collect(node, FACETS_CONTAINER_CLASS).forEach(enhance);
    // The header can arrive after the facets on first render, so a selection
    // restored from the URL still gets its badges.
    collect(node, RESULTS_META_CLASS)
      .forEach((meta) => renderSelectedBadges(meta.closest('.stx-results-panel')));
  };

  root.querySelectorAll(`.${FACETS_CONTAINER_CLASS}`).forEach(enhance);

  const observer = new MutationObserver((records) => {
    records.forEach((record) => record.addedNodes.forEach(handleAdded));
  });
  observer.observe(root, { childList: true, subtree: true });

  // Delegated, so the badges update on the click rather than waiting for the
  // response that replaces the facets. The library's own listener sits on the
  // input and has already run by the time this fires.
  root.addEventListener('change', (event) => {
    if (!event.target.closest?.('.stx-results-panel__facet-option')) return;
    renderSelectedBadges(event.target.closest('.stx-results-panel'));
  });
}

/* ----------------------------------------------------------------- sort --- */

/*
 * DATE SORT — a reader-facing control the vendored library does not have.
 *
 * The bundle has no notion of sort order at all: `buildSearchRequestBody` sends
 * `from`, `size`, `facets`, `query`, `namespace` and `filter_query`, and nothing
 * else. So all three moving parts live here — the control, getting the choice
 * into the request, and getting the panel to ask again.
 *
 * RELEVANCE IS THE DEFAULT, and it is the ABSENCE of a sort rather than a value:
 * with the switch off no `sort` reaches the request and the index answers in its
 * own order. That is the only sensible default for a SEARCH page — a reader who typed a query
 * wants the best match first, not whatever was published most recently.
 *
 * The dropdown offers ONE alternative order: date, reverse chronological. There
 * is no ascending option, because "oldest first" is not a thing anyone asks a
 * search engine for. The mock still honours `date:asc` if a caller sends it.
 *
 * NEEDS THE BACKEND TO READ IT. The request is a POST to an OpenSearch SEARCH
 * TEMPLATE (`body.id` = the authored `requestId`), so `params.sort` does nothing
 * at all unless the template reads it — an unrecognised param changes nothing
 * and returns a clean 200. The earlier template emits a painless script sort inside a
 * `{{#sort}}` section; the `arbory-pages` template is built to the same
 * contract.
 *
 * It sits in the facet rail's row, beside the query field — see mountSortControl.
 */

/** URL param the reader's choice is persisted under. */
const SORT_PARAM = 'stx-sort';

/** Its only value. Absent means relevance. */
const SORT_BY_DATE = 'date';

/** What that becomes on the request. Reverse chronological. */
const SORT_BY_DATE_PARAM = 'date:desc';

/** Distinguishes the labels when more than one panel is on the page. */
let sortLabelSeq = 0;

/** Whether the reader has chosen date order. */
const sortedByDate = () => new URLSearchParams(window.location.search)
  .get(SORT_PARAM) === SORT_BY_DATE;

/**
 * Mirrors the choice into the URL, so a sorted result set can be shared and
 * survives a reload.
 *
 * `replaceState` and a param DELETED for relevance, matching how the
 * library keeps the facet selection (`writeFacetsToUrl`): a click on a control
 * is not a navigation, and relevance is the default, so a URL that says nothing
 * about order is the one worth sharing.
 *
 * @param {boolean} on Whether date order is wanted
 */
function writeSort(on) {
  const url = new URL(window.location.href);
  if (on) url.searchParams.set(SORT_PARAM, SORT_BY_DATE);
  else url.searchParams.delete(SORT_PARAM);
  window.history.replaceState({}, '', url);
}

let sortHookInstalled = false;

/**
 * Adds `params.sort` to the panel's search requests, when date order is chosen.
 *
 * A `fetch` wrapper because the request is built inside the bundle, by a
 * function that takes no sort and is not exported — and the bundle is
 * copy-in-only, so it cannot be taught one. This is the same interception the
 * mock uses, and it is installed AFTER the mock deliberately: the mock captures
 * `window.fetch` when it installs, so wrapping afterwards puts this outside it
 * and the mock receives the modified body.
 *
 * The state is read from the URL PER REQUEST rather than closed over, so this
 * stays a stateless one-time install with no wiring to the control. On
 * relevance it adds nothing at all — that order is the index's own, not a value
 * we ask for.
 *
 * Narrow by shape, not by URL: a POST whose body is JSON carrying a `params`
 * object is the search request and nothing else on these pages is. Anything that
 * does not match is passed through untouched, including the suggestion dropdown's
 * GETs — sorting a typeahead by date would bury the best match.
 */
function installSortRequestHook() {
  if (sortHookInstalled) return;
  sortHookInstalled = true;
  const inner = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    if (!sortedByDate()) return inner(input, init);
    if ((init?.method || 'GET').toUpperCase() !== 'POST') return inner(input, init);
    if (typeof init.body !== 'string') return inner(input, init);

    let payload;
    try {
      payload = JSON.parse(init.body);
    } catch {
      return inner(input, init);
    }
    if (!payload?.params || typeof payload.params !== 'object') return inner(input, init);

    payload.params.sort = SORT_BY_DATE_PARAM;
    return inner(input, { ...init, body: JSON.stringify(payload) });
  };
}

/**
 * Builds the control: a labelled dropdown.
 *
 * A native `<select>` with a real `<label for>`, rather than a custom listbox.
 * Two options is exactly what a select is for, it needs no keyboard handling of
 * ours, and on a phone it opens the platform picker — all of which a scripted
 * dropdown would have to reimplement and would reimplement worse.
 *
 * Relevance carries the EMPTY value, so the option list reads the way the
 * behaviour works: choosing it sends no `sort` at all, which is what relevance
 * is. See installSortRequestHook.
 *
 * It was a two-state switch before this, and the dropdown says more with the
 * same clicks: a switch labelled "Sort by date" never names the thing it falls
 * back to, so "off" meant relevance only to someone who already knew. Both
 * orders are now written down.
 *
 * @param {Function} remount Re-runs the panel so the new order is fetched
 * @returns {HTMLElement} The control
 */
function buildSortControl(remount) {
  const current = sortedByDate() ? SORT_BY_DATE : '';

  const wrap = document.createElement('div');
  wrap.className = SORT_CLASS;

  sortLabelSeq += 1;
  const id = `${SORT_CLASS}-select-${sortLabelSeq}`;

  const label = document.createElement('label');
  label.className = `${SORT_CLASS}__label`;
  label.htmlFor = id;
  label.textContent = t('sortBy');

  /*
   * A wrapper around the select, purely so the chevron has something to position
   * against. The select's own native arrow is turned off in CSS (`appearance:
   * none`) because its position is the browser's to decide and could not be made
   * to sit an equal distance from the right edge as the label does from the
   * left. The replacement is drawn on this element's `::after`, in the same
   * rotated-square construction as every other chevron in the sheet — which also
   * keeps it `currentcolor`, so it follows the site's high-contrast palette where
   * a background-image arrow could not.
   */
  const field = document.createElement('span');
  field.className = `${SORT_CLASS}__field`;

  const select = document.createElement('select');
  select.className = `${SORT_CLASS}__select`;
  select.id = id;

  [['', t('relevance')], [SORT_BY_DATE, t('date')]].forEach(([value, text]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    if (value === current) option.selected = true;
    select.append(option);
  });

  select.addEventListener('change', () => {
    writeSort(select.value === SORT_BY_DATE);
    remount();
  });

  field.append(select);
  wrap.append(label, field);
  return wrap;
}

/**
 * Puts the control in the library's outer wrapper, once, as a grid item of its
 * own directly after the query field.
 *
 * IT USED TO LIVE INSIDE THE FACETS CONTAINER, prepended above the groups. That
 * made it the rail's first child, so the rail's top edge was the CONTROL's top
 * edge — and the first facet heading sat a control's height below the results
 * container it should have lined up with. Moving it out is what lets the rail
 * and the results start on the same line.
 *
 * Inserted AFTER `.stx-query-input`, so the TAB order is query field, sort,
 * facets, results. Below 900px the stylesheet reorders the single column with
 * `order` and the control is drawn only inside the filter menu (see
 * observeFilterMenu), so the position no longer decides where it appears there.
 *
 * Two things fall out of the move. It no longer needs the results-header
 * fallback that covered a response with no facet aggregations — the wrapper is
 * always there, so the control always has a home. And it now SURVIVES a
 * re-render: the wrapper is not replaced on a response, where the facets
 * container is replaced on every one.
 *
 * @param {Element} wrapper One `.stx-search-results-panel`
 * @param {Function} remount Re-runs the panel so the new order is fetched
 */
function mountSortControl(wrapper, remount) {
  if (!wrapper || wrapper.querySelector(`:scope > .${SORT_CLASS}`)) return;

  const control = buildSortControl(remount);
  const input = wrapper.querySelector(':scope > .stx-query-input');
  if (input) input.after(control);
  else wrapper.prepend(control);
}

/**
 * Keeps the sort control attached across every re-render.
 *
 * The wrapper survives a query, a facet change and a page change, so in practice
 * this mounts once — but a REMOUNT, which is how a sort change takes effect,
 * rebuilds the block from nothing and the control has to come back with it.
 * Same observer shape as observeResultsRange, and `mountSortControl` is a no-op
 * once the control is present, so the two passes cannot fight.
 *
 * @param {Element} root Element containing one or more results panels
 * @param {Function} remount Re-runs the panel so the new order is fetched
 */
export function observeSort(root, remount) {
  const render = () => root.querySelectorAll('.stx-search-results-panel').forEach((wrapper) => {
    mountSortControl(wrapper, remount);
  });
  render();
  new MutationObserver(render).observe(root, { childList: true, subtree: true });
}

/**
 * The result count the library last rendered. Authored as "{{totalCount}}
 * results", so the digits are pulled out; a label with no digits is NaN, not 0,
 * so it never reads as "no results".
 *
 * @param {Element} panel One `.stx-results-panel`
 * @returns {number} The total
 */
function totalOf(panel) {
  const text = panel.querySelector('.stx-results-panel__total-number')?.textContent || '';
  return /\d/.test(text) ? Number(text.replace(/[^\d]/g, '')) : NaN;
}

/**
 * The page the library is on: its active numbered button, searched across the
 * whole nav. enhancePagination moves those buttons into a hidden holder, so a
 * lookup in the visible list read page 1 — "Showing 1-10" — on every page.
 *
 * @param {Element} panel One `.stx-results-panel`
 * @returns {number} The current page, 1 when there is no pager
 */
function currentPageOf(panel) {
  const active = panel.querySelector(`${PAGINATION_SELECTOR} button.stx-is-active[data-page-number]`);
  return Number(active?.dataset.pageNumber) || 1;
}

/**
 * Renders "Showing 1-8 of 26 Results" over the library's plain total.
 *
 * The range CANNOT be authored. The library composes the header from
 * two label templates and hands `totalResults` only `totalCount`, and
 * `paginationInfo` only `currentPage`/`pageNumber` — the first-to-last range is
 * never one of the arguments, so no combination of `{{...}}` produces it. It has
 * to be computed, which is what this does.
 *
 * The library's own `.stx-results-panel__total-number` is LEFT INTACT and hidden
 * in CSS rather than rewritten. `updateResultsMeta` rewrites that element's text
 * on every response, so overwriting it would destroy the one reliable source for
 * the count — the next pass would be parsing this function's own sentence back
 * out. Reading it and writing a sibling keeps the two directions separate.
 *
 * With no results the range is REMOVED, not left alone: a query with none kept
 * the previous query's "Showing 1-10 of 747 Results". renderEmptyState speaks
 * instead.
 *
 * @param {Element} panel One `.stx-results-panel`
 */
function renderResultsRange(panel) {
  const meta = panel?.querySelector(`.${RESULTS_META_CLASS}`);
  const totalEl = meta?.querySelector('.stx-results-panel__total-number');
  if (!meta || !totalEl) return;

  const total = totalOf(panel);
  const rows = panel.querySelectorAll('.stx-results-panel__results-item').length;
  if (!(total > 0) || !rows) {
    meta.querySelector(`.${RANGE_CLASS}`)?.remove();
    return;
  }

  const page = currentPageOf(panel);

  /*
   * `pageSize` is authored per `search-tab` and never reaches the panel's DOM,
   * so the widest page seen stands in for it: every page but the last is full.
   * Reading low cannot mislead — that only happens when the last page is also
   * the ONLY page, and there the range is 1-total either way.
   */
  const size = Math.max(Number(panel.dataset.pageSize) || 0, rows);
  panel.dataset.pageSize = String(size);

  const start = (page - 1) * size + 1;
  const end = Math.min(start + rows - 1, total);
  const text = t('showing', { start: formatCount(start), end: formatCount(end), total: formatCount(total) });

  let range = meta.querySelector(`.${RANGE_CLASS}`);
  if (!range) {
    range = document.createElement('span');
    range.className = RANGE_CLASS;
    totalEl.after(range);
  }
  // Writing this span mutates the subtree observeResultsRange watches, so an
  // unconditional assignment would re-enter forever. Equal text ends the cycle.
  if (range.textContent !== text) range.textContent = text;
}

/**
 * Rebuilds the pagination as `« ‹ Page N › »` — a page label between arrows,
 * with the library's numbered buttons hidden in CSS.
 *
 * None of this can be authored, and none of it is the library's arrangement.
 * `createPagination` renders numbers, ellipses and
 * NO directional controls at all, and `createResultsNumber` builds the page
 * counter into the results header at the top, beside the total.
 *
 * The arrows have to be WIRED here, not just built. `bindPagination` attaches a
 * listener to each `button[data-page-number]` at the moment it constructs the
 * nav — it is not delegated — so an arrow appended afterwards is never bound: it
 * renders correctly and does nothing. Rather than duplicate the library's fetch,
 * an arrow FORWARDS its click to the numbered button for the page it targets.
 *
 * WHICH TARGETS ARE REACHABLE, therefore, is decided by what `createPagination`
 * drew, not by what the page count is:
 *
 *   - first (1) and prev (current − 1) are always reachable. The window is five
 *     wide and clamped to the start, so page 1 is in it whenever current ≤ 3,
 *     and it is pushed in explicitly whenever the window starts later.
 *   - next (current + 1) is always reachable: the window is centred on
 *     current − 2, so current ± 1 is inside it at every position.
 *   - LAST is not. With more than five pages the window is `start … start + 4`
 *     and the final page is simply absent unless the reader is already near the
 *     end — so `»` is DISABLED there rather than silently doing nothing. It
 *     works on any result set of five pages or fewer, which is most filtered
 *     searches; making it work on all of them needs the bundle to include the
 *     last page in its window, which is a change to `createPagination`, not
 *     something this file can reach.
 *
 * The label is COMPOSED here rather than mirrored from the library's own
 * `__page-number`, because that element carries the authored `paginationInfo`
 * sentence ("Page 1 of 4") and the design asks for just "Page 1". The authored
 * row still drives the counter the library renders; it is hidden in CSS, the
 * same way `__total-number` is (see renderResultsRange).
 *
 * This re-runs per render. The `arrows` flag lives on the LIST, which is
 * replaced along with the nav, so a fresh render is re-enhanced while a
 * re-entrant pass within one render is not.
 *
 * @param {Element} panel One `.stx-results-panel`
 */
function enhancePagination(panel) {
  const nav = panel.querySelector('.stx-results-panel__pagination-container');
  const list = nav?.querySelector('.stx-results-panel__pagination-list');
  if (!nav || !list) return;
  if (list.dataset.arrows === 'true') return;

  const numbered = [...list.querySelectorAll('button[data-page-number]')]
    .map((button) => Number(button.dataset.pageNumber))
    .filter(Number.isFinite);
  if (!numbered.length) return;

  const current = Number(list.querySelector('button.stx-is-active')?.dataset.pageNumber) || 1;

  /*
   * The true page count, from the total and the page size — NOT from the highest
   * number the library drew, which is only the end of its five-page window.
   *
   * Both values are read the way renderResultsRange reads them: the digits out
   * of the library's own total, and the widest page seen stashed on the panel.
   * Falls back to the drawn maximum when the total is not there to read.
   */
  const totalEl = panel.querySelector('.stx-results-panel__total-number');
  const total = Number(totalEl?.textContent.replace(/[^\d]/g, ''));
  const size = Number(panel.dataset.pageSize) || 0;
  const pages = (Number.isFinite(total) && total > 0 && size > 0)
    ? Math.ceil(total / size)
    : Math.max(...numbered);
  if (pages < 2) return;

  list.dataset.arrows = 'true';

  /*
   * The numbered buttons are the ONLY things wired to the library's fetch, so
   * they are moved aside rather than discarded — `replaceChildren` below would
   * otherwise take the mechanism with them. The holder is hidden in CSS and
   * `aria-hidden`, since the arrows above now speak for it.
   */
  const holder = document.createElement('div');
  holder.className = HIDDEN_PAGES_CLASS;
  holder.setAttribute('aria-hidden', 'true');
  holder.append(...list.children);
  nav.append(holder);

  /*
   * A target is real only if it goes SOMEWHERE and the library drew a button for
   * it. Both halves matter: `first` on page 1 and `last` on the final page are
   * in range and rendered, but lead back to where the reader already is, so they
   * are dead ends and read better greyed out than as live controls that appear
   * to do nothing. `first`/`prev`/`next` always satisfy the rendered half;
   * `last` frequently does not (see above).
   */
  const reachable = (page) => page >= 1
    && page <= pages
    && page !== current
    && numbered.includes(page);

  const arrow = (name, target, label) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `search-results-panel-pagination-arrow search-results-panel-pagination-arrow--${name}`;
    button.setAttribute('aria-label', label);
    if (reachable(target)) button.dataset.pageNumber = String(target);
    else button.disabled = true;

    // Decorative: the button's aria-label already says where it goes. Two
    // chevrons for the jump arrows, one for the step arrows.
    const marks = name === 'first' || name === 'last' ? 2 : 1;
    for (let i = 0; i < marks; i += 1) {
      const chevron = document.createElement('span');
      chevron.className = 'search-results-panel-pagination-chevron';
      chevron.setAttribute('aria-hidden', 'true');
      button.append(chevron);
    }
    return button;
  };

  const label = document.createElement('span');
  label.className = PAGE_NUMBER_CLASS;
  label.textContent = t('page', { n: formatCount(current) });

  list.replaceChildren(
    arrow('first', 1, t('firstPage')),
    arrow('prev', current - 1, t('prevPage')),
    label,
    arrow('next', current + 1, t('nextPage')),
    arrow('last', pages, t('lastPage')),
  );

  /*
   * Delegated on the list, which is replaced with the nav on every render, so
   * the listener goes with it and cannot accumulate.
   *
   * The numbered buttons are still in the nav — hidden, not removed — because
   * they carry the library's own listeners, which is the whole mechanism here.
   * `replaceChildren` above would have thrown them away, so they are moved into
   * a hidden holder first.
   */
  list.addEventListener('click', (event) => {
    const button = event.target.closest('.search-results-panel-pagination-arrow');
    if (!button || button.disabled) return;
    nav.querySelector(
      `.${HIDDEN_PAGES_CLASS} button[data-page-number="${button.dataset.pageNumber}"]`,
    )?.click();
  });
}

/* ------------------------------------------------------------ no results --- */

const EMPTY_CLASS = 'search-results-panel-empty';

/* The library's facet param, and its per-tab form `stx-facets-<tab id>` (the
   tab id read off the panel's `stx-tab-content-<tab id>`). Duplicated because
   they only ship from a hash-named chunk (see scripts/search/README.md). */
const FACETS_PARAM = 'stx-facets';
const TAB_CONTENT_PREFIX = 'stx-tab-content-';

/** The URL param `panel` keeps its facet selection under. */
function facetsParamOf(panel) {
  const tab = panel.closest(`[id^="${TAB_CONTENT_PREFIX}"]`);
  return tab ? `${FACETS_PARAM}-${tab.id.slice(TAB_CONTENT_PREFIX.length)}` : FACETS_PARAM;
}

/** Whether the URL holds a facet selection under `param`. */
function urlHasFacets(param) {
  const raw = new URLSearchParams(window.location.search).get(param);
  if (!raw) return false;
  try {
    return Object.values(JSON.parse(raw) || {})
      .some((values) => Array.isArray(values) && values.length > 0);
  } catch {
    return false;
  }
}

/**
 * Whether a filter narrows the panel. The URL counts as well as the checkboxes:
 * a selection can be live with NO checkbox on screen (a deep link outside the
 * rail's top buckets, or no results and so no rail).
 */
function hasActiveFilters(panel) {
  if (panel.querySelector('.stx-results-panel__facet-option input:checked')) return true;
  return urlHasFacets(facetsParamOf(panel));
}

/** Unticks every ticked facet with a replayed click, as a selection badge does. */
function clearFacetSelection(panel) {
  panel.querySelectorAll('.stx-results-panel__facet-option input:checked')
    .forEach((input) => input.click());
}

/** How this file reloads the page; an object so a test can stand in for it. */
export const pageReload = { to: (href) => window.location.replace(href) };

/**
 * "Clear all filters" in the tabbed host, whose panels the library builds once
 * per tab and this file cannot rebuild. Unticks through the library; a
 * selection with no checkbox to untick is read by the library only when it
 * mounts, so the page is reloaded without it (`replace`: no history entry).
 *
 * @param {Element} panel One `.stx-results-panel`
 */
function clearFiltersOrReload(panel) {
  clearFacetSelection(panel);
  const param = facetsParamOf(panel);
  if (!urlHasFacets(param)) return;
  const url = new URL(window.location.href);
  url.searchParams.delete(param);
  pageReload.to(url.href);
}

/** The empty state's sentence, as nodes. The query is URL input: text only. */
function emptyMessage(query, filtered) {
  const title = document.createElement('p');
  title.className = `${EMPTY_CLASS}__title`;
  title.textContent = query ? t('noResultsFor', { query }) : t('noResults');

  const hint = document.createElement('p');
  hint.className = `${EMPTY_CLASS}__hint`;
  hint.textContent = filtered ? t('hintFiltered') : t('hint');
  return [title, hint];
}

/**
 * Says so when a search has no results, instead of showing a blank panel (the
 * library draws an empty list and a hidden "0 results"). When a FILTER emptied
 * the list, a "Clear all filters" button sits under the message; the selection
 * badges stay too, but a selection with no checkbox on screen has no badge.
 *
 * THE LIVE REGION IS PERMANENT: created empty with the container and only ever
 * re-texted, because a region inserted already holding its text, or shown from
 * `display: none`, is not reliably announced. Empty, it draws nothing. The
 * button sits outside it, so it is not read out with the message.
 *
 * Not redrawn while loading: the URL already holds the NEXT query by then.
 *
 * @param {Element} panel One `.stx-results-panel`
 * @param {Object} options `queryParam`, and `onClear(panel)` for the button
 */
function renderEmptyState(panel, { queryParam = 'query', onClear }) {
  const container = panel.querySelector('.stx-results-panel__container');
  const list = container?.querySelector('.stx-results-panel__results-list');
  if (!container || !list) return;

  let empty = container.querySelector(`:scope > .${EMPTY_CLASS}`);
  if (!empty) {
    empty = document.createElement('div');
    empty.className = EMPTY_CLASS;

    const region = document.createElement('div');
    region.className = `${EMPTY_CLASS}__status`;
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'true');

    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = `${EMPTY_CLASS}__clear`;
    clear.textContent = t('clearAll');
    clear.hidden = true;
    clear.addEventListener('click', () => onClear(panel));

    empty.append(region, clear);
    list.after(empty);
  }
  if (container.classList.contains(LOADING_CLASS)) return;

  const region = empty.querySelector(`.${EMPTY_CLASS}__status`);
  const clear = empty.querySelector(`.${EMPTY_CLASS}__clear`);

  const rows = panel.querySelectorAll('.stx-results-panel__results-item').length;
  const none = totalOf(panel) === 0 && rows === 0;
  const filtered = none && hasActiveFilters(panel);
  const query = none ? (new URLSearchParams(window.location.search).get(queryParam) || '').trim() : '';

  // Compared before writing: this runs on every mutation under the panel,
  // including its own, and re-writing the same text would re-announce it.
  const key = none ? JSON.stringify([query, filtered]) : '';
  if (region.dataset.key !== key) {
    region.dataset.key = key;
    region.replaceChildren(...(none ? emptyMessage(query, filtered) : []));
  }
  if (clear.hidden === filtered) clear.hidden = !filtered;
}

/* ------------------------------------------------------- page in the URL --- */

/** URL param the standalone panel's page is kept under. Absent means page 1. */
const PAGE_PARAM = 'stx-page';

/** The page `search` asks for; anything but a whole number above 1 is page 1. */
function pageFromSearch(search) {
  const raw = (new URLSearchParams(search).get(PAGE_PARAM) || '').trim();
  return /^\d+$/.test(raw) && Number(raw) > 1 ? Number(raw) : 1;
}

/**
 * `search` with the page param set to `page`, or removed for page 1. Edited as
 * text, not through URLSearchParams, so every other param keeps its exact
 * spelling (re-serialising turns `%20` into `+` and re-encodes the facet JSON).
 *
 * @param {string} search e.g. `window.location.search`
 * @param {number} page The page
 * @returns {string} The new search string, '' when nothing is left
 */
export function withPage(search, page) {
  const query = search.replace(/^\?/, '');
  const parts = query ? query.split('&').filter((part) => part.split('=')[0] !== PAGE_PARAM) : [];
  if (page > 1) parts.push(`${PAGE_PARAM}=${page}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

/** The search the URL names (query, filters, sort, tab), whatever its page. */
const currentSearch = () => withPage(window.location.search, 1);

/* -------------------------------------------------- after a page change --- */

/**
 * Scrolls `el`'s top into view when it is above the viewport or under the fixed
 * header (`scroll-padding-top`, which `scrollIntoView` honours), smoothly unless
 * the reader asked for reduced motion. An element already below that line is
 * left where it is.
 *
 * @param {Element} el The element whose top the reader should see
 */
function scrollTopIntoView(el) {
  const offset = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
  if (el.getBoundingClientRect().top >= offset) return;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ block: 'start', behavior: still ? 'auto' : 'smooth' });
}

/**
 * Brings a page the reader opened to them: the pager is at the BOTTOM of the
 * list, and the button the library refocuses is one enhancePagination hides.
 * Scrolls the results' top into view (scrollTopIntoView) and focuses the
 * summary.
 *
 * @param {Element} panel One `.stx-results-panel`
 * @param {boolean} scroll Whether to scroll as well as focus
 */
function revealResults(panel, scroll) {
  const container = panel.querySelector('.stx-results-panel__container');
  if (!container) return;
  if (scroll) scrollTopIntoView(container);
  // Focusable by script only: it labels the list, it is not a control.
  const target = container.querySelector(`.${RANGE_CLASS}`) || container;
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}

/**
 * Keeps the results range, the pagination footer and the empty state correct
 * across re-renders, and reveals a page the reader opens (revealResults).
 *
 * Separate from observeFacets because the two watch different mutations:
 * `updateFacets` REPLACES the facets container (an added element), while
 * `updateResultsMeta` rewrites the header's text in place — a characterData
 * change, and one whose added nodes are text, not elements. observeFacets sees
 * neither, so this observer opts into both.
 *
 * @param {Element} root Element containing one or more results panels
 * @param {Object} [options] `queryParam`, and `clearFilters(panel)` for "Clear
 *   all filters" (default clearFiltersOrReload; may return a promise)
 * @returns {Function} Re-runs the render pass
 */
export function observeResultsRange(root, options = {}) {
  const clearFilters = options.clearFilters || clearFiltersOrReload;

  /*
   * Panels waiting for an answer to reveal: `{ scroll, page, search }`, the page
   * asked for and the search it was asked in. Dropped at the next settle, and
   * revealed only if that settle IS the answer: a failed request leaves the old
   * page, and a query, filter, tab or Back that overtook it changes the search,
   * so neither moves the reader.
   */
  const reveal = new WeakMap();
  const revealIfDue = (panel) => {
    const due = reveal.get(panel);
    const container = panel.querySelector('.stx-results-panel__container');
    if (!due || !container || container.classList.contains(LOADING_CLASS)) return;
    reveal.delete(panel);
    if (currentPageOf(panel) !== due.page || currentSearch() !== due.search) return;
    revealResults(panel, due.scroll);
  };

  // "Clear all filters" goes away with the results it was for, so focus moves
  // to the new results. The panel may have been rebuilt; the live one is used.
  const onClear = async (panel) => {
    await clearFilters(panel);
    const live = panel.isConnected ? panel : root.querySelector('.stx-results-panel');
    if (!live) return;
    reveal.set(live, { scroll: false, page: 1, search: currentSearch() });
    revealIfDue(live);
  };

  const render = () => root.querySelectorAll('.stx-results-panel').forEach((panel) => {
    renderResultsRange(panel);
    enhancePagination(panel);
    renderEmptyState(panel, { queryParam: options.queryParam, onClear });
    revealIfDue(panel);
  });

  render();
  new MutationObserver(render).observe(root, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  /*
   * A page the READER chose, which is always through an arrow: the library's
   * buttons are hidden behind them, and observePageParam's restore clicks those
   * directly. The arrow has forwarded the click by the time it bubbles here, so
   * the request is in flight and the reveal waits for its answer.
   */
  root.addEventListener('click', (event) => {
    const arrow = event.target.closest?.(`.${ARROW_CLASS}`);
    const panel = arrow?.closest('.stx-results-panel');
    if (!panel?.querySelector(`.${LOADING_CLASS}`)) return;
    const page = Number(arrow.dataset.pageNumber);
    reveal.set(panel, { scroll: true, page, search: currentSearch() });
  });

  return render;
}

/**
 * Keeps the standalone panel's page in the URL, and opens a linked page on load.
 * (Standalone only: the tabbed host keeps one panel per tab in one URL.)
 *
 * WRITING. Whenever the panel settles, the URL is made to say the page on
 * screen, by `replaceState` only, so Back and Forward stay the library's. That
 * one rule covers the reader paging and every return to page 1 (a new query, a
 * filter, a sort's rebuild).
 *
 * READING, on load only. The library opens on page 1 and fetches a page only
 * through its own buttons, drawn for pages 1-5 and the last; so once the first
 * answer is in, the drawn page nearest the linked one is clicked (the last, for
 * a link past the end). The URL then says the page actually shown. Only that
 * first answer, and only for the linked search: after a failed first request,
 * or a new query, sort or Back before the answer, the panel stays on page 1.
 *
 * @param {Element} root The block
 */
export function observePageParam(root) {
  const linked = pageFromSearch(window.location.search);
  const linkedSearch = currentSearch();
  const nearer = (best, page) => (Math.abs(page - linked) < Math.abs(best - linked) ? page : best);
  let restoring = true;

  const sync = () => {
    const panel = root.isConnected && root.querySelector('.stx-results-panel');
    if (!panel) return;
    // A first request that failed leaves the link as it was, for a reload.
    if (panel.querySelector('.stx-results-panel__error')) restoring = false;
    const container = panel.querySelector('.stx-results-panel__container');
    if (!container || container.classList.contains(LOADING_CLASS)) return;

    if (restoring) {
      restoring = false;
      const target = [...panel.querySelectorAll(LIBRARY_PAGE_BUTTON)]
        .map((button) => Number(button.dataset.pageNumber))
        .reduce(nearer, 1);
      if (currentSearch() === linkedSearch && target !== currentPageOf(panel)) {
        panel.querySelector(`${LIBRARY_PAGE_BUTTON}[data-page-number="${target}"]`).click();
        return;
      }
    }

    const { pathname, search, hash } = window.location;
    const next = withPage(search, currentPageOf(panel));
    if (next !== search) window.history.replaceState(window.history.state, '', `${pathname}${next}${hash}`);
  };

  sync();
  new MutationObserver(sync).observe(root, { childList: true, subtree: true });
}

/* ---------------------------------------------- the mobile filter menu --- */

/*
 * BELOW 900px THE SORT AND THE FACETS ARE A MENU, not a stack above the results.
 *
 * The results header carries the count and a "Sorts and filters" button, and
 * the button swaps the results for the facet groups IN PLACE — not an overlay —
 * with a sticky "View N Results" button at the bottom of the screen to swap
 * them back. Stacking the sort control and five facet headings between the
 * query field and the first result buried the results on a phone.
 *
 * Open/closed is a class on the BLOCK, because the block is the one element no
 * render replaces: a response swaps the facets container, and a sort change
 * (`resort`) swaps the library's whole wrapper. State kept on either would close
 * the menu under the reader mid-use. Everything visual — what hides and what
 * reorders — is in the stylesheet, behind the same 900px breakpoint the grid
 * goes two-column at (Arbory's desktop breakpoint). At and above it the class
 * changes nothing and neither control is drawn.
 */

const MENU_OPEN_CLASS = 'search-results-panel--filters-open';
const MENU_TOGGLE_CLASS = 'search-results-panel-filters-toggle';
const VIEW_RESULTS_CLASS = 'search-results-panel-view-results';

/**
 * The phone layout: the filter menu. Must match the breakpoint in
 * search-results-panel.css.
 */
const MOBILE_MEDIA = '(width < 900px)';

/**
 * Everywhere short of the three-column layout — a phone AND a tablet — the promo
 * rail sits inside the results, above the first one (observePromo's `inline`).
 * On a tablet it used to be a grid row of its own under the results, which put
 * it below the pager, a full page of scrolling away. Must match the
 * three-column breakpoint in search-results-panel.css.
 */
const INLINE_PROMO_MEDIA = '(width < 1200px)';

/**
 * "View 619 Results", from the count the library last rendered.
 *
 * @param {Element} panel One `.stx-results-panel`
 * @returns {string} The close button's label
 */
function viewResultsLabel(panel) {
  const total = panel ? totalOf(panel) : NaN;
  if (Number.isNaN(total)) return t('viewResults');
  return total === 1 ? t('viewResultsOne') : t('viewResultsMany', { n: formatCount(total) });
}

/**
 * Mounts the menu's two controls and keeps them current across re-renders.
 *
 * The OPEN control goes in the results header, beside the count. The header
 * lives inside the results container, which the library replaces on a fresh
 * render, so the control is re-mounted when it goes missing — the same
 * idempotent pass renderResultsRange makes there.
 *
 * The CLOSE control is a grid item of the library's wrapper, after the panel,
 * like the sort control: the wrapper survives a response, so the button does
 * too, and only its label is refreshed as the count changes.
 *
 * @param {Element} block The block
 */
export function observeFilterMenu(block) {
  const isOpen = () => block.classList.contains(MENU_OPEN_CLASS);

  const render = () => block.querySelectorAll('.stx-search-results-panel').forEach((wrapper) => {
    const panel = wrapper.querySelector(':scope > .stx-results-panel');
    const meta = panel?.querySelector(`.${RESULTS_META_CLASS}`);

    if (meta) {
      let toggle = meta.querySelector(`:scope > .${MENU_TOGGLE_CLASS}`);
      if (!toggle) {
        toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = MENU_TOGGLE_CLASS;
        toggle.textContent = t('sortsAndFilters');
        // Before the selection badges, which wrap to a row of their own.
        const badges = meta.querySelector(':scope > .search-results-panel-selected');
        if (badges) badges.before(toggle);
        else meta.append(toggle);
      }
      toggle.setAttribute('aria-expanded', String(isOpen()));
    }

    let view = wrapper.querySelector(`:scope > .${VIEW_RESULTS_CLASS}`);
    if (!view) {
      view = document.createElement('button');
      view.type = 'button';
      view.className = VIEW_RESULTS_CLASS;
      if (panel) panel.after(view);
      else wrapper.append(view);
    }
    // Writing the label is itself a mutation this pass observes, so an
    // unconditional assignment would re-enter forever. Equal text ends it.
    const label = viewResultsLabel(panel);
    if (view.textContent !== label) view.textContent = label;
  });

  /*
   * Moves the reader to the top of the results container, which heads both
   * views: the count is the first thing in it, open or closed. Closing after a
   * long scroll down the facet list would otherwise land them part-way down the
   * results.
   *
   * Focus follows the swap, because the control that was activated is the one
   * thing the swap hides: into the menu (the sort control) on open, back to the
   * toggle on close.
   *
   * Neither happens when the READER did not ask (`byReader: false`), which is
   * the window widening past the breakpoint.
   */
  const setOpen = (open, { byReader = true } = {}) => {
    if (open === isOpen()) return;
    block.classList.toggle(MENU_OPEN_CLASS, open);
    render();
    if (!byReader) return;

    const wrapper = block.querySelector('.stx-search-results-panel');
    const container = wrapper?.querySelector('.stx-results-panel__container');
    if (!container) return;
    scrollTopIntoView(container);

    const target = open
      ? wrapper.querySelector(`.${SORT_CLASS}__select, .stx-results-panel__facet-toggle`)
      : container.querySelector(`.${MENU_TOGGLE_CLASS}`);
    target?.focus({ preventScroll: true });
  };

  block.addEventListener('click', (event) => {
    if (event.target.closest?.(`.${MENU_TOGGLE_CLASS}`)) setOpen(true);
    else if (event.target.closest?.(`.${VIEW_RESULTS_CLASS}`)) setOpen(false);
  });

  // Escape closes, except in the query field, where it belongs to the
  // suggestion dropdown.
  block.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !isOpen()) return;
    if (event.target.closest?.('.stx-query-input')) return;
    setOpen(false);
  });

  // Widening past the breakpoint shows the rail anyway; closing keeps a reader
  // who narrows the window again from coming back to a menu nobody opened.
  const media = window.matchMedia(MOBILE_MEDIA);
  media.addEventListener('change', () => {
    if (!media.matches) setOpen(false, { byReader: false });
  });

  render();
  new MutationObserver(render).observe(block, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

/**
 * Reads the block's key/value rows.
 *
 * Must run before the library's decorator, which consumes the rows and then
 * clears the block. A local copy of the library's `getEDSConfig` rather than an
 * import: that helper only ships from a hash-named chunk, and those names change
 * on every re-copy of the bundle (see scripts/search/README.md).
 *
 * @param {Element} block A search block, still holding its authored rows
 * @returns {Object} Authored keys mapped to their values
 */
export function readRows(block) {
  const rows = {};
  block.querySelectorAll(':scope > div').forEach((row) => {
    const [keyEl, valueEl] = row.querySelectorAll(':scope > div');
    const key = keyEl?.textContent?.trim();
    const value = valueEl?.textContent?.trim();
    if (key && value) rows[key] = value;
  });
  return rows;
}

/**
 * Keeps the panel's query field in step with the query in the URL.
 *
 * The library seeds the field from `?query=` once, when it mounts, and never
 * again. A search submitted somewhere else on the page — the header bar, in
 * place, or the browser's back button — changes the URL and re-runs the results,
 * but left the field holding the query the page opened with. So the field is
 * written back from the URL on the same two signals the library re-fetches on:
 * its own `urlchange` event and `popstate`.
 *
 * Writes the value directly rather than dispatching `input`, which would also
 * open the typeahead dropdown for a query the reader did not type here. Looked
 * up per event, not held: a re-sort swaps in a whole new panel.
 *
 * @param {Element} block The search-results-panel block
 * @param {string} [queryParam] The authored query param; the library's default
 *   is `query`
 */
function observeQueryParam(block, queryParam = 'query') {
  const sync = () => {
    const input = block.querySelector('.stx-query-input__input');
    if (!input) return;
    const query = new URLSearchParams(window.location.search).get(queryParam) || '';
    if (input.value === query) return;
    input.value = query;
    input.closest('.stx-query-input')
      ?.querySelector('.stx-query-input__clear-button')
      ?.classList.toggle('stx-hidden', !query);
  };
  window.addEventListener('urlchange', sync);
  window.addEventListener('popstate', sync);
}

/**
 * `search` without `name`. Edited as text, like withPage, so every other param
 * keeps its exact spelling.
 *
 * @param {string} search e.g. `window.location.search`
 * @param {string} name The param to drop
 * @returns {string} The new search string, '' when nothing is left
 */
export function withoutParam(search, name) {
  const query = search.replace(/^\?/, '');
  const parts = query ? query.split('&').filter((part) => decodeURIComponent(part.split('=')[0]) !== name) : [];
  return parts.length ? `?${parts.join('&')}` : '';
}

/**
 * Clearing the query field clears the results it was showing.
 *
 * After clearing the search box, the results should also clear. The
 * vendored query input empties the field and its dropdown — on the clear button
 * and on deleting the last character — but never touches the URL, and the URL's
 * query param is the ONLY thing its results panel re-fetches on. So the panel
 * kept the old query's rows, count and curated answer under an empty field.
 *
 * An emptied field therefore drops the query param and announces it the way the
 * library's own submit does (`pushState` + `urlchange`). The panel re-runs as a
 * search with no query — the same state as the page opened with none — and the
 * range, empty state, curated panels and page param all follow from that render,
 * exactly as they do for any other new query. Pushed, not replaced, so Back
 * returns to the cleared query, like Back after a submit does.
 *
 * Listens on `root` in the bubble phase, so the library's clear handler has
 * already emptied the field when this runs, and inputs the library mounts later
 * (a tab, a re-sort) are covered. Does nothing when the URL holds no query, so
 * clearing a field that was never searched pushes no history entry.
 *
 * @param {Element} root Element containing one or more query inputs
 * @param {string} [queryParam] The authored query param; the library's default
 *   is `query`
 */
export function observeQueryClear(root, queryParam = 'query') {
  const clear = (wrapper) => {
    const input = wrapper?.querySelector('.stx-query-input__input');
    if (!input || input.value) return;
    // The library leaves its clear button showing after a clear-button click.
    wrapper.querySelector('.stx-query-input__clear-button')?.classList.add('stx-hidden');
    const { pathname, search, hash } = window.location;
    if (!new URLSearchParams(search).get(queryParam)) return;
    window.history.pushState({}, '', `${pathname}${withoutParam(search, queryParam)}${hash}`);
    window.dispatchEvent(new Event('urlchange'));
  };
  root.addEventListener('click', (event) => {
    clear(event.target.closest?.('.stx-query-input__clear-button')?.closest('.stx-query-input'));
  });
  root.addEventListener('input', (event) => {
    clear(event.target.closest?.('.stx-query-input__input')?.closest('.stx-query-input'));
  });
}

/**
 * The rows a page in another language would otherwise have to author: the
 * bundle's own labels (placeholder, total, pagination, button names) in the
 * page's language, and `namespace` as that language, so /de/search searches
 * only German pages. Each is added only when the page does not author it.
 *
 * @param {Element[]} rows The authored key/value rows
 * @returns {Element[]} Rows to append
 */
export function localeRows(rows) {
  const authored = new Set(rows.map((row) => row.children[0]?.textContent?.trim()));
  const wanted = { namespace: searchLanguage(), ...libraryLabels() };
  return Object.entries(wanted)
    .filter(([key]) => !authored.has(key))
    .map(([key, value]) => {
      const row = document.createElement('div');
      const name = document.createElement('div');
      const cell = document.createElement('div');
      name.textContent = key;
      cell.textContent = value;
      row.append(name, cell);
      return row;
    });
}

export default async function decorate(block) {
  const rows = readRows(block);
  // Before the panel mounts: the interceptor has to be in place when the first
  // request goes out. A no-op unless the page opted in — see mock-search.js.
  await installMockSearch(rows);
  await loadSearchStyles();

  /*
   * The authored rows, kept because the library CONSUMES them: `decorate` reads
   * the block's key/value divs and then empties the block. A sort change has to
   * re-run that decorator, so the rows it reads are restored from this copy
   * first. Cloned again per mount, so one remount cannot spend them.
   */
  const authoredRows = [...block.children].map((row) => row.cloneNode(true));
  authoredRows.push(...localeRows(authoredRows));

  // AFTER installMockSearch, so these wrap the mock rather than the other way
  // round and the mock sees the sort and the operators. See
  // installSortRequestHook and search-operators.js.
  installSortRequestHook();
  installOperatorRequestHook();

  // Before the first render, since `renderItem` reads it per row.
  setResultUrlHost(rows.resultUrlHost);

  /*
   * Builds a panel from the authored rows, into `host`.
   *
   * A whole new panel rather than a targeted re-fetch, because the library
   * exposes no way to ask an existing one to search again: `buildResultsForPage`
   * is private, and the only re-fetch it wires to the outside world is a change
   * to the query param. What matters survives anyway — the query and the facet
   * selection are both read back from the URL, by the library itself — and the
   * page resets to 1, which is the right place to be looking once the order has
   * changed.
   */
  const build = (host) => {
    host.replaceChildren(...authoredRows.map((row) => row.cloneNode(true)));
    decorateResultsPanel(host, searchRenderers);
    dedupeSearchStyles();
  };

  /*
   * Resolves once a panel has finished its first request.
   *
   * The library mounts a loader and swaps it for one of exactly two terminal
   * states: `__container` (results, including a zero-hit list) or `__error`. So
   * "ready" is the presence of either, and the timeout is a backstop for a
   * request that never settles at all — swapping in a stuck panel is still
   * better than leaving the reader with a control that did nothing.
   */
  const READY = '.stx-results-panel__container, .stx-results-panel__error';
  const ready = (host) => new Promise((resolve) => {
    if (host.querySelector(READY)) {
      resolve();
      return;
    }
    const observer = new MutationObserver(() => {
      if (!host.querySelector(READY)) return;
      observer.disconnect();
      resolve();
    });
    observer.observe(host, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      resolve();
    }, 8000);
  });

  /*
   * Re-sorts WITHOUT the page going blank.
   *
   * Rebuilding in place emptied the block, so the reader lost the results, the
   * facet rail and the block's whole height for as long as the request took —
   * which read as the page flashing, and jumped the scroll position as the
   * footer came up to meet it. The panel is built DETACHED instead, and swapped
   * in only once it has content, so what is on screen never goes away.
   *
   * The old results are dimmed meanwhile with the library's own loading class,
   * rather than a spinner of ours — same affordance a page change already gets.
   *
   * `pending` makes the LAST click win: a reader toggling twice quickly has two
   * requests in flight, and without the check the slower one could land second
   * and leave the panel disagreeing with the control.
   */
  let pending = 0;
  const resort = async () => {
    const live = block.querySelector('.stx-results-panel__container');
    if (live) {
      live.classList.add('stx-results-panel__container--loading');
      live.setAttribute('aria-busy', 'true');
    }

    pending += 1;
    const token = pending;
    const staging = document.createElement('div');
    build(staging);
    await ready(staging);
    if (token !== pending) return;

    // The observers below watch `block`, which is NOT replaced, so moving the
    // finished panel in is what triggers them to enhance it — the same path the
    // first mount takes.
    block.replaceChildren(...staging.childNodes);
  };

  // "Clear all filters": untick through the library; a selection with no
  // checkbox is read only on mount, so it is dropped from the URL and the panel
  // rebuilt, as for a sort.
  const clearFilters = async (panel) => {
    clearFacetSelection(panel);
    if (!urlHasFacets(FACETS_PARAM)) return;
    const url = new URL(window.location.href);
    url.searchParams.delete(FACETS_PARAM);
    window.history.replaceState({}, '', url);
    await resort();
  };

  build(block);
  observeQueryParam(block, rows.queryParam);
  observeQueryClear(block, rows.queryParam);
  observeFacets(block);
  observeResultsRange(block, { queryParam: rows.queryParam, clearFilters });
  observeSort(block, resort);
  observeFilterMenu(block);
  observeSuggestions(block);
  observePageParam(block);
  observePoweredBy(block);

  /*
   * The two curated panels — the featured answer and the promo rail — from one
   * authored workbook, a sheet each. Below the three-column layout both sit
   * between the count and the first result, featured answer first.
   *
   * Not awaited: they fetch a workbook, and the results must not wait on an
   * enhancement. Each reconciles itself onto whatever is on screen when it
   * arrives, and does nothing at all when the path is unauthored or its sheet is
   * missing — e.g. the promo rail on any page whose workbook has no promo
   * sheet.
   *
   * ONE fetch serves both: `loadCurated` caches per URL, so the second call
   * reads the same parsed workbook.
   */
  const curated = { path: rows.featuredResults, queryParam: rows.queryParam };
  observeFeatured(block, { ...curated, sheet: rows.featuredSheet });
  observePromo(block, { ...curated, sheet: rows.promoSheet, inline: INLINE_PROMO_MEDIA });
}
