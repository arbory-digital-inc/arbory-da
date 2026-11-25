/* --------------------------------------------------------------------------
 * Search Terms Manager — configuration (single source of truth)
 *
 * The curated panels on the search results page — the FEATURED answer across
 * the results column, and the PROMO rail beside it — are authored in one DA
 * workbook with a sheet each. That workbook is the only thing this tool edits.
 *
 * WHY A TOOL AND NOT THE SHEET EDITOR. The sheet editor shows cells. It cannot
 * show the three things that actually decide whether a row ever reaches a
 * reader, all of which are properties of the SET of rows rather than of a cell:
 *
 *   - the block skips a row missing what its sheet requires, silently as far as
 *     the sheet is concerned (the warning goes to a console nobody has open);
 *   - on the FEATURED sheet the FIRST matching row wins, so a row can be
 *     permanently unreachable because an earlier row's term is a whole word
 *     inside its own; and
 *   - the results page reads the PUBLISHED copy, so an edited-but-unpreviewed
 *     sheet looks exactly like the feature being broken (it cost an afternoon on
 *     the earlier site, where this tool was built).
 *
 * THE TWO SHEETS STOPPED BEING THE SAME SHAPE. The promo rail is unconditional —
 * up to three panels on every search, in sheet order — so it has no `term`
 * column at all, and none of the term-shaped traps above apply to it. What an
 * author needs to see there is different: which three rows are the ones anyone
 * will actually see. `hasTerm` below is what everything keys off.
 *
 * ------------------------------------------------------------------------ */

/*
 * NO DA SDK IMPORT HERE, deliberately. `st-session.js` owns that, because
 * `DA_SDK` is a top-level await against da.live: anything importing it can only
 * run inside DA, and that would put the sheet shape, the site list and the
 * matching rules — the parts most worth testing — out of reach of the test
 * runner. Everything in this file is a plain constant.
 */

export const ADMIN_SOURCE = 'https://admin.da.live/source';
export const ADMIN_VERSIONS = 'https://admin.da.live/versionlist';
export const ADMIN_AEM = 'https://admin.hlx.page';

/* Content is shared across code branches; preview/publish always target `main`. */
export const CONTENT_REF = 'main';

/** Where the workbook lives, on every site. */
export const SHEET_PATH = 'data/search-terms.json';

/** The path an author writes into the block's `featuredResults` row. */
export const AUTHORED_PATH = '/data/search-terms';

/*
 * The sites this tool can edit — on Arbory, one: `arbory-digital-inc/arbory-da`,
 * whose search page is English only (namespace `en`). The org comes from the
 * DA context (st-session.js, falling back to `arbory-digital-inc`).
 *
 * A list rather than a constant because the tool was built for two sites
 * (US and Canada) and keeps its site switcher; with one entry the switcher is
 * hidden. A second language site with its own search page would be a second
 * entry here, and its block's `featuredResults` row would name its workbook.
 *
 * `publish: false` holds a site at preview: the Publish button is disabled and a
 * human publishes. The tool must not be the thing that publishes to a site
 * somebody deliberately froze.
 *
 * A site with NO workbook yet (the source 404s) is not an error state: no
 * workbook means no curated panels, which is a valid configuration. The tool
 * offers to create one rather than presenting an empty sheet as if it existed.
 */
export const SITES = [
  { repo: 'arbory-da', label: 'Arbory Digital', publish: true },
];

/*
 * The two sheets, and what differs between them.
 *
 * `bodyKey` is the header this tool WRITES. The block accepts `answer`,
 * `description`, `summary` or `body` in either sheet (see BODY_KEYS in
 * curated-results.js), so an existing sheet using another of them keeps
 * working — `readSheet` in st-store.js preserves whichever header it finds
 * rather than renaming a column under the author.
 *
 * `measure` is the width the copy has to live in, and it is why the two sheets
 * get different hints. The promo rail is a grid track of `minmax(200px, 22%)`
 * (search-results-panel.css), so at the breakpoint where the third column
 * appears it is about 200-250px wide — a heading of three or four words. The
 * featured answer runs the full results column and has no such pressure.
 */
export const SHEETS = [
  {
    key: 'faq',
    /*
     * The NAMES this sheet has had in the workbook, newest first.
     *
     * `key` is the tool's own identifier and never changes; this is what the
     * sheet is actually called in DA, and it has been `data`, then `faq`, then
     * `featured-results` inside a week. A rename is a content edit nobody thinks
     * to tell the code about and it fails SILENTLY — the tool reads an empty
     * sheet and offers to save one over the top. The block keeps the same list
     * for the same reason (SHEET_CANDIDATES in curated-results.js).
     */
    sheetNames: ['featured-results', 'faq', 'data', 'featured'],
    label: 'Featured answer',
    placement: 'featured',
    bodyKey: 'answer',
    bodyLabel: 'Answer',
    blurb: 'Across the results column, above the first hit.',
    titleBudget: 0,
    bodyBudget: 0,
    hasTerm: true,
    shows: 1,
  },
  {
    key: 'promo',
    sheetNames: ['promo', 'promos'],
    label: 'Promo rail',
    placement: 'promo',
    bodyKey: 'description',
    bodyLabel: 'Description',
    blurb: 'Down the third column beside the results — the first three, on every search.',
    titleBudget: 34,
    bodyBudget: 150,
    hasTerm: false,
    shows: 3,
  },
];

/** The sheet definition for a key, or the featured one. */
export const sheetDef = (key) => SHEETS.find((s) => s.key === key) || SHEETS[0];

/** The site definition for a repo. */
export const siteDef = (repo) => SITES.find((s) => s.repo === repo) || SITES[0];

/**
 * Column headers written for a new sheet, in the order the author reads them.
 *
 * `url title` carries a SPACE, because that is what the live sheet uses and what
 * the authoring documentation tells people to type. The block collapses headers
 * (`url title`, `URL Title`, `urlTitle` all land on the same field), so this is
 * a presentation choice — but writing back a different spelling than the author
 * sees in DA would be a gratuitous diff on every save.
 */
export const columnsFor = (key) => {
  const def = sheetDef(key);
  return [
    ...(def.hasTerm ? ['term'] : []),
    'title',
    def.bodyKey,
    'url title',
    'url',
  ];
};
