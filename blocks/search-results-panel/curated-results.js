/*
 * Curated results — editorially chosen panels, matched on the reader's query.
 *
 * Two placements, one mechanism:
 *
 *   - the FEATURED result (the "direct answer"), across the results column
 *     between the count and the first hit; and
 *   - the PROMO rail, down the right-hand column beside them — or, below the
 *     three-column layout (a phone or a tablet), under the featured answer,
 *     between the count and the first hit.
 *
 * Both come from one DA workbook, a sheet each:
 *
 *   faq   | term | title | answer      | url title | url |
 *   promo |      | title | description | url title | url |
 *
 * The promo sheet has NO `term`: the rail is unconditional, so there is nothing
 * for one to gate. Its row ORDER is its editorial control instead.
 *
 * ONE MODULE because the matching rule has to exist once. "Whole word, anywhere
 * in the query, first row wins" (Frank, 2026-09-10) — with a comma separating
 * synonyms in one term cell, any of which matches (Frank, 2026-10-07) — is a
 * product decision one
 * character away from being a different rule — `includes(term)` rather than
 * `includes(' term ')` makes "consultant" match the `consulting` row — and two
 * copies of it would drift the first time one was tuned. It governs the FEATURED
 * answer only; the rail stopped matching when its term column was dropped.
 *
 * NOTHING HERE INVENTS COPY. A row missing its `term` or `title` is skipped with
 * a warning rather than completed, and a call to action renders only with BOTH a
 * `url` and a `url title`.
 *
 * WHY NOT AUTHORED BLOCKS. Both have to sit inside the library's own tree — one
 * in the results container, one as a grid item beside it — and both have to
 * change when the query changes. Neither is something a sibling block on the
 * page can do. So the panel block renders them, from a workbook whose path IS
 * authored, and a page can point somewhere else or nowhere.
 *
 * SHEET NAMES ARE RESOLVED, NOT ASSUMED. The first sheet has already been called
 * `data` and then `faq` inside one afternoon, and a hardcoded name fails
 * silently — the panel simply stops appearing. See resolveSheet.
 */

/** Shared root class; each placement adds its own variant class. */
const CLASS = 'search-results-panel-curated';

/** Variant classes, which carry placement and orientation only. */
const VARIANT = {
  featured: 'search-results-panel-featured',
  promo: 'search-results-panel-promo',
};

/**
 * The promo rail's container: ONE grid item holding up to PROMO_LIMIT panels.
 *
 * A container rather than three loose grid items, because the grid places the
 * third column against the results row — three siblings would each want a row of
 * their own and the second and third would land beside nothing. Everything
 * positional (the column, the sticky offset, the drop to the results list) is on
 * this element; the panels inside only carry their own look.
 */
const RAIL_CLASS = 'search-results-panel-promo-rail';

/**
 * How many promos may be on the page at once.
 *
 * A cap rather than a page-size, because the rail is a fixed column beside a
 * scrolling list: a fourth panel would push the last one below the fold on most
 * screens, where nothing would ever scroll it into view once the rail is sticky.
 */
const PROMO_LIMIT = 3;

/*
 * Sheet names tried in order, per placement, when none is authored.
 *
 * The featured sheet has now been called `data`, then `faq`, then
 * `featured-results` — three names in a week. That is exactly why this is a list
 * and not a constant: a rename is a content edit nobody thinks to tell the code
 * about, and a hardcoded name fails SILENTLY (the panel simply stops appearing).
 * Newest first, so the current name is found without walking the history.
 *
 * A single-sheet workbook has no name at all, which `resolveSheet` handles
 * separately.
 */
const SHEET_CANDIDATES = {
  featured: ['featured-results', 'faq', 'data', 'featured'],
  promo: ['promo', 'promos'],
};

/*
 * Whether a placement may fall back to a workbook's ONLY sheet when none of its
 * candidate names matched.
 *
 * The featured answer may: a one-sheet workbook is the shape this started as,
 * its sheet has no meaningful name, and "the only sheet is the content" is the
 * single sensible reading.
 *
 * The promo rail may NOT, and this is the whole distinction — it is strictly
 * opt-in. A workbook holding only `faq` has no promos, and taking its only
 * sheet renders the FAQ answers down the rail as if they were promos. Caught by
 * test rather than by reasoning: the flag exists because the fallback was shared
 * at first and did exactly that.
 */
const SOLE_SHEET_FALLBACK = { featured: true, promo: false };

/** Where each parsed workbook is cached — one fetch per path, ever. */
const workbooks = new Map();

/**
 * Normalises text for whole-word matching, and PADS it with spaces.
 *
 * Punctuation becomes space rather than being stripped, so "careers?" and
 * "tax/consulting" split into words instead of fusing into one. The padding is
 * what makes the whole-word test a plain `includes(' term ')` — no regex, so a
 * term containing regex metacharacters needs no escaping, and a multi-word term
 * ("business tax") is matched as a phrase for free.
 *
 * @param {*} value Raw text
 * @returns {string} e.g. ` aem cloud service `, or ` ` when empty
 */
const normalize = (value) => ` ${String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()} `;

/**
 * Collapses a sheet header to a comparable key.
 *
 * Headers are author-facing text in a spreadsheet, so `url title`, `URL Title`
 * and `urlTitle` all have to reach the same field — the live sheet uses
 * `url title`, with a space, and nothing stops that being edited.
 *
 * @param {string} key A column header
 * @returns {string} e.g. `urltitle`
 */
const keyOf = (key) => String(key).toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Splits a term cell into its synonyms, each normalised for matching.
 *
 * `taxes, tax` is two terms, and a row matches when the query contains ANY of
 * them. Each piece is still one whole word or phrase — `business tax, tax
 * advice` is the two phrases "business tax" and "tax advice".
 *
 * A piece that normalises to nothing (`tax,` or `, ,`) is dropped rather than
 * kept as a padded blank: `' '` is inside every query, so it would match
 * everything (see readRow).
 *
 * EXPORTED for the Search Terms Manager, which shows each synonym's reach.
 *
 * @param {string} cell The raw term cell
 * @returns {{terms: string[], labels: string[]}} Padded terms, and the author's
 *   own spelling of each (same order), for messages
 */
export function splitTerms(cell) {
  const terms = [];
  const labels = [];
  String(cell ?? '').split(',').forEach((piece) => {
    const term = normalize(piece);
    if (!term.trim() || terms.includes(term)) return;
    terms.push(term);
    labels.push(piece.trim());
  });
  return { terms, labels };
}

/** Body copy, whatever the sheet calls it. `faq` says `answer`, `promo` says
 *  `description`; both are accepted everywhere so a rename cannot break one. */
const BODY_KEYS = ['answer', 'description', 'summary', 'body'];

/**
 * Reads one sheet row, or null if it cannot be shown.
 *
 * EXPORTED for the Search Terms Manager (`/tools/search-terms/`), which has to
 * judge a row an author is still typing — a row that is not in the workbook yet
 * and so cannot be read back through `loadCurated`. It calls this so the tool's
 * verdict on a draft row is the block's verdict, not a second implementation of
 * these rules that would drift the first time one was tuned. The console
 * warnings are the same ones, which is also how the tool surfaces them.
 *
 * @param {Object} raw One entry from a sheet's `data` array
 * @param {number} index Its position, which is its editorial priority
 * @returns {?Object} The parsed row
 */
export function readRow(raw, index, { requireTerm = true } = {}) {
  const cells = {};
  Object.entries(raw || {}).forEach(([key, value]) => {
    cells[keyOf(key)] = typeof value === 'string' ? value.trim() : value;
  });

  const { term, title } = cells;
  const { terms, labels } = splitTerms(term);
  if (!title) {
    // eslint-disable-next-line no-console
    console.warn(`[curated-results] sheet row ${index + 1} needs a "title"; skipped.`, raw);
    return null;
  }

  /*
   * `term` is required only where it decides anything.
   *
   * On the FEATURED sheet it is the gate: a row with no term can never be
   * matched, so it is dead copy and saying so is the whole point. On the PROMO
   * sheet there is nothing to gate — every promo shows, in sheet order — so the
   * column was dropped, and demanding it would reject the entire rail.
   */
  if (requireTerm && !terms.length) {
    // eslint-disable-next-line no-console
    console.warn(
      `[curated-results] sheet row ${index + 1} ("${title}") needs a "term" to be `
      + 'matchable; skipped.',
      raw,
    );
    return null;
  }

  // Both or neither: a link with no label would need copy invented for it, and a
  // label with no href is not a link.
  const { url, urltitle: urlTitle } = cells;
  if (Boolean(url) !== Boolean(urlTitle)) {
    // eslint-disable-next-line no-console
    console.warn(
      `[curated-results] "${term}" has a "url" or a "url title" but not both; `
      + 'its call to action is left off.',
    );
  }

  const body = BODY_KEYS.map((key) => cells[key]).find(Boolean) || '';

  return {
    index,
    /*
     * Never a padded blank — `splitTerms` drops those, because `' '` is inside
     * every query and would match everything. A promo row's list is empty, and an
     * empty list matches nothing.
     */
    terms,
    termLabels: labels,
    label: term || '',
    title,
    body,
    url: url && urlTitle ? url : '',
    urlTitle: url && urlTitle ? urlTitle : '',
  };
}

/**
 * Picks the wanted sheet out of a workbook, whichever envelope it arrived in.
 *
 * DA serves two shapes, and a workbook silently changes from one to the other
 * the moment someone adds a second sheet:
 *
 *   single: { ":type": "sheet",       data: [ …rows ] }
 *   multi:  { ":type": "multi-sheet", ":names": ["faq","promo"],
 *             faq: { data: [ …rows ] }, promo: { data: [ …rows ] } }
 *
 * That transition is not theoretical — it happened to this workbook, and the
 * reader that only understood `body.data` as an array started rejecting every
 * row. Both shapes are read here, and an explicitly authored name wins over
 * every guess.
 *
 * When nothing matches by name, a workbook with exactly ONE sheet falls back to
 * it — but only for a placement that allows it (see SOLE_SHEET_FALLBACK), and
 * never when there are several, since picking arbitrarily would render promos as
 * featured answers or the reverse.
 *
 * @param {Object} body Parsed workbook JSON
 * @param {string} [wanted] Authored sheet name
 * @param {string[]} [candidates] Names to try when none is authored
 * @param {boolean} [sole] Whether a lone unnamed-match sheet may be used
 * @returns {?Array} The sheet's rows
 */
function resolveSheet(body, wanted, candidates = [], sole = false) {
  if (Array.isArray(body?.data)) {
    /*
     * A single, unnamed sheet — the legacy shape. An authored name cannot be
     * honoured because there is nothing to match it against, and there is
     * nothing else it could mean.
     *
     * Gated on `sole` for the same reason the fallback below is: this shape is
     * the FEATURED content, and handing it to the promo rail would put the
     * answers down the rail.
     */
    return sole ? body.data : null;
  }

  const names = Array.isArray(body?.[':names']) ? body[':names'] : [];
  const rowsOf = (name) => {
    const sheet = body?.[name];
    return Array.isArray(sheet?.data) ? sheet.data : null;
  };

  if (wanted) {
    const rows = rowsOf(wanted);
    if (rows) return rows;
    // eslint-disable-next-line no-console
    console.warn(
      `[curated-results] no sheet named "${wanted}" in this workbook`
      + `${names.length ? ` (it has: ${names.join(', ')})` : ''}.`,
    );
    return null;
  }

  const found = candidates.map(rowsOf).find(Boolean);
  if (found) return found;

  if (sole && names.length === 1) return rowsOf(names[0]);
  return null;
}

/**
 * Fetches a workbook once, and parses one sheet out of it.
 *
 * Never throws and never blocks the panel: a missing workbook (an unauthored
 * path), a 404, a non-JSON body, or a sheet that is not there all resolve to an
 * empty list, and the panel renders exactly as it does without them. These are
 * enhancements — they must not be able to take the results page down.
 *
 * @param {Object} options
 * @param {string} options.path Authored workbook path, e.g. `/data/search-terms`
 * @param {string} [options.sheet] Authored sheet name
 * @param {string} [options.placement] `featured` or `promo`, for the name guesses
 * @returns {Promise<Object[]>} Parsed rows, in sheet order
 */
export async function loadCurated({ path, sheet, placement = 'featured' }) {
  if (!path) return [];

  // `.json` is how DA serves a workbook; an authored path may or may not carry it.
  const url = path.endsWith('.json') ? path : `${path}.json`;

  if (!workbooks.has(url)) {
    workbooks.set(url, fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.warn(`[curated-results] could not read "${url}": ${error.message}`);
        return null;
      }));
  }

  const body = await workbooks.get(url);
  if (!body) return [];

  const rows = resolveSheet(
    body,
    sheet,
    SHEET_CANDIDATES[placement],
    SOLE_SHEET_FALLBACK[placement],
  );
  if (!rows) return [];
  const requireTerm = placement !== 'promo';
  return rows.map((raw, i) => readRow(raw, i, { requireTerm })).filter(Boolean);
}

/**
 * The row to show for a query, or null.
 *
 * Whole word by construction: both sides are space-padded by `normalize`, so
 * ` cloud ` is found in ` aem cloud service ` and not in
 * ` cloudflare `. A row matches when ANY of its comma-separated terms does.
 * `find` gives first-match-wins, which is what makes the sheet's row order its
 * priority order.
 *
 * @param {Object[]} rows Parsed sheet rows
 * @param {string} query The reader's query
 * @returns {?Object} The matching row
 */
export function matchCurated(rows, query) {
  const haystack = normalize(query);
  if (haystack.trim() === '') return null;
  // A row with no terms (a promo row) matches nothing, never everything.
  return rows.find((row) => row.terms?.some((term) => haystack.includes(term))) || null;
}

/**
 * The promos to show: the first PROMO_LIMIT rows, on EVERY search.
 *
 * NO MATCHING. The promo sheet has no `term` column — it was removed once the
 * rail became unconditional, because a term can only express *whether* a row
 * shows and the answer is now always "yes". What is left is an ordered list, and
 * the sheet's ROW ORDER is the whole editorial control: rows one to three are
 * what every reader sees.
 *
 * The featured answer still matches, and still needs its terms. The two sheets
 * genuinely behave differently now, which is why this is a separate function
 * rather than a flag on `matchCurated`.
 *
 * @param {Object[]} rows Parsed sheet rows, in sheet order
 * @returns {Object[]} The first PROMO_LIMIT of them
 */
export function selectPromos(rows) {
  return rows.slice(0, PROMO_LIMIT);
}

/**
 * Builds a panel.
 *
 * The heading is an `h3`, per the design and by request. It skips a level from
 * the page's `h1`, which is a heading-order best practice (WCAG G141, under
 * 1.3.1) rather than a conformance failure — worth knowing if an automated audit
 * flags `heading-order`: it is this, and it is deliberate.
 *
 * Every value is applied with `textContent`/`href`, so sheet content is never
 * parsed as markup — an author with sheet access cannot inject script.
 *
 * @param {Object} row A parsed sheet row
 * @param {string} placement `featured` or `promo`
 * @returns {HTMLElement} The panel
 */
export function renderCurated(row, placement = 'featured') {
  // `aside` for the promo, which is genuinely tangential to the results; the
  // featured answer is a direct response to the query, so it is not.
  const panel = document.createElement(placement === 'promo' ? 'aside' : 'div');
  panel.className = `${CLASS} ${VARIANT[placement] || VARIANT.featured}`;
  panel.dataset.curated = String(row.index);

  const title = document.createElement('h3');
  title.className = `${CLASS}__title`;
  title.textContent = row.title;
  panel.append(title);

  if (row.body) {
    const body = document.createElement('p');
    body.className = `${CLASS}__body`;
    body.textContent = row.body;
    panel.append(body);
  }

  if (row.url) {
    const cta = document.createElement('a');
    cta.className = `${CLASS}__cta`;
    cta.href = row.url;

    /*
     * The label is WRAPPED in an element rather than left as a bare text node,
     * so it can be one flex item that wraps internally. As loose text it was a
     * run of separate items, and in the narrow promo rail the chevron wrapped
     * away from the last word onto a line of its own.
     */
    const label = document.createElement('span');
    label.className = `${CLASS}__cta-label`;
    label.textContent = row.urlTitle;
    cta.append(label);

    // Decorative: the link's own text says where it goes.
    const chevron = document.createElement('span');
    chevron.className = `${CLASS}__chevron`;
    chevron.setAttribute('aria-hidden', 'true');
    cta.append(chevron);

    panel.append(cta);
  }

  return panel;
}

/**
 * Publishes how far the promo rail has to drop to line up with the RESULTS LIST.
 *
 * The rail is a grid item in the same row as the results container, so by
 * default its top meets the container's top — which is the "Showing 1-8 of N
 * Results" header, not the first result. The distance between the two is not a
 * constant: it is that header, plus the featured answer whenever the query
 * matched one, plus whatever those reflow to at a given width.
 *
 * MEASURED, because the alternatives do not work here. Flattening the container
 * with `display: contents` would put its children in the outer grid and let CSS
 * align the rail against the list directly — but the container carries
 * `position: relative` for the library's loading overlay, and a box that
 * generates no principal box is not a containing block, so the overlay would
 * escape to the page. Moving the header out of the container is worse:
 * `updateResultsMeta` re-queries it *inside* the container on every response, so
 * a hoisted header silently stops updating its count.
 *
 * Published as a custom property rather than written to the rail's `margin`, so
 * the STYLESHEET decides whether to use it — below the three-column breakpoint
 * the rail is a full-width panel inside the results, above the list, where an
 * offset would be meaningless. See the promo rules in search-results-panel.css.
 *
 * Only ever writes a style attribute, which the reconcile observer does not
 * watch (it takes `childList` and `characterData`), so this cannot re-enter.
 *
 * @param {Element} root Element containing one or more results panels
 */
function publishPromoOffset(root) {
  root.querySelectorAll('.stx-search-results-panel').forEach((wrapper) => {
    const container = wrapper.querySelector('.stx-results-panel__container');
    const list = container?.querySelector('.stx-results-panel__results-list');
    if (!container || !list) return;

    // Both rects move together with scroll, so their difference is stable.
    const offset = Math.max(
      0,
      Math.round(list.getBoundingClientRect().top - container.getBoundingClientRect().top),
    );
    const current = wrapper.style.getPropertyValue('--stx-promo-offset');
    if (current === `${offset}px`) return;
    wrapper.style.setProperty('--stx-promo-offset', `${offset}px`);
  });
}

/**
 * Keeps the right panels in the right place, for the life of the page.
 *
 * RECONCILES rather than renders once, because the two things it depends on
 * change independently and neither is a signal we own:
 *
 *   - the host is replaced wholesale by `renderFullResults` (a fresh search, a
 *     facet change, a sort — which remounts the whole panel), and
 *   - the QUERY can change WITHOUT that happening: a new query on an
 *     already-rendered panel goes through `updateResultsList`, which swaps the
 *     list's children and rewrites the header text in place. A render-once pass
 *     would leave the previous query's panels above the new results, which is
 *     worse than showing none.
 *
 * `select` decides WHICH rows a placement shows and `apply` decides where they
 * go; everything between — the workbook read, the observers, the identity guard
 * that stops this re-entering forever — is the same for both.
 *
 * @param {Element} root Element containing one or more results panels
 * @param {Object} options See observeFeatured / observePromo
 * @returns {Promise<void>} Resolves once the workbook has been read
 */
async function observeCurated(root, options) {
  const {
    path, sheet, queryParam = 'query', placement, select, hosts, apply, settle, media,
  } = options;
  const rows = await loadCurated({ path, sheet, placement });
  if (!rows.length) return;

  const reconcile = () => {
    const query = new URLSearchParams(window.location.search).get(queryParam) || '';
    const chosen = select(rows, query);
    // The identity of a whole SET, so a reorder counts as a change and an
    // unchanged set does not — which is what stops the observer re-entering.
    const key = chosen.map((row) => row.index).join(',');
    hosts(root).forEach((host) => apply(host, chosen, key));
    settle?.(root);
  };

  reconcile();
  new MutationObserver(reconcile).observe(root, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  // A placement that depends on the viewport has to move when it changes, and
  // crossing a breakpoint mutates nothing the observer above would see.
  media?.addEventListener('change', reconcile);
  if (settle) {
    /*
     * The offset `settle` publishes depends on the height of the results header,
     * which reflows on its own — the count wraps to two lines at a narrow
     * results column, and the range text changes length as the reader pages. A
     * mutation observer does not see a reflow, so the container is watched for
     * resize as well.
     */
    const observer = new ResizeObserver(() => settle(root));
    root.querySelectorAll('.stx-results-panel__container').forEach((el) => observer.observe(el));
  }
}

/**
 * The featured answer: ONE panel, and only when the query matches a term.
 *
 * Mounted into the library's results container, and inserted before the results
 * LIST rather than prepended to the container, so it lands under the
 * "Showing 1-10 of N Results" header instead of over it — and before the promo
 * rail when a phone or a tablet has put that in the container too (see
 * placeRail), so the two land in the same order whichever arrives first.
 *
 * @param {Element} root Element containing one or more results panels
 * @param {Object} options `path`, `sheet`, `queryParam`
 * @returns {Promise<void>} Resolves once the workbook has been read
 */
export function observeFeatured(root, options) {
  return observeCurated(root, {
    ...options,
    placement: 'featured',
    select: (rows, query) => [matchCurated(rows, query)].filter(Boolean),
    hosts: (el) => [...el.querySelectorAll('.stx-results-panel__container')],
    apply: (host, chosen) => {
      const existing = host.querySelector(`:scope > .${VARIANT.featured}`);
      const row = chosen[0];

      if (!row) {
        existing?.remove();
        return;
      }
      if (existing?.dataset.curated === String(row.index)) return;

      const panel = renderCurated(row, 'featured');
      if (existing) {
        existing.replaceWith(panel);
        return;
      }
      const next = host.querySelector(`:scope > .${RAIL_CLASS}, .stx-results-panel__results-list`);
      if (next) next.before(panel);
      else host.append(panel);
    },
  });
}

/**
 * Puts the rail where the viewport wants it.
 *
 * INLINE (a phone or a tablet): inside the results container, directly before
 * the list — so under the count and the featured answer, above the first
 * result. The container is replaced on a fresh render and takes the rail with
 * it, so this runs on every reconcile and re-mounts it, exactly as the featured
 * answer is.
 *
 * Otherwise: a grid item of the wrapper, beside the results. Also the fallback
 * when there is no list to sit above — a failed request renders an error box
 * instead of the container — where the stylesheet orders the rail above it.
 *
 * Moves only what is out of place, so a settled rail does not re-trigger the
 * observer that called this.
 *
 * @param {Element} wrapper One `.stx-search-results-panel`
 * @param {Element} rail The rail container
 * @param {boolean} inline Whether the viewport is narrow enough to inline it
 */
function placeRail(wrapper, rail, inline) {
  const list = inline
    && wrapper.querySelector('.stx-results-panel__container > .stx-results-panel__results-list');
  if (list) {
    if (rail.nextElementSibling !== list) list.before(rail);
    return;
  }
  if (rail.parentElement !== wrapper) wrapper.append(rail);
}

/**
 * The promo rail: up to three panels, on every search.
 *
 * Mounted into the library's OUTER wrapper (`.stx-search-results-panel`), not
 * into the results container, for two reasons: the wrapper is the element whose
 * grid has a third column to sit in, and it survives a re-render — where
 * `renderFullResults` empties `.stx-results-panel` on every response, so a rail
 * mounted inside would be destroyed and rebuilt on each one.
 *
 * The panels go in a RAIL container (see RAIL_CLASS) rather than straight into
 * the wrapper, so the three of them are one grid item.
 *
 * On a phone or a tablet (`inline`) the rail moves into the results instead —
 * see placeRail.
 *
 * @param {Element} root Element containing one or more results panels
 * @param {Object} options `path`, `sheet`, `queryParam`, and `inline`: a media
 *   query under which the rail sits in the results column rather than beside it
 * @returns {Promise<void>} Resolves once the workbook has been read
 */
export function observePromo(root, options) {
  const media = options.inline ? window.matchMedia(options.inline) : null;
  return observeCurated(root, {
    ...options,
    placement: 'promo',
    select: selectPromos,
    hosts: (el) => [...el.querySelectorAll('.stx-search-results-panel')],
    media,
    apply: (host, chosen, key) => {
      // Anywhere in the wrapper: on a phone or a tablet it is inside the container.
      let rail = host.querySelector(`.${RAIL_CLASS}`);

      if (!chosen.length) {
        rail?.remove();
        return;
      }
      if (!rail) {
        rail = document.createElement('div');
        rail.className = RAIL_CLASS;
      }
      placeRail(host, rail, Boolean(media?.matches));
      if (rail.dataset.curatedKey === key) return;

      rail.dataset.curatedKey = key;
      rail.replaceChildren(...chosen.map((row) => renderCurated(row, 'promo')));
    },
    settle: publishPromoOffset,
  });
}
