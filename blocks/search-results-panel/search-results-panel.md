---
block: search-results-panel
model: key-value
variants: { classes: [] }
rules:
  - "Renders the site search results page: query input, facet rail, sort control and a paginated result list, from the StreamX search bundle in scripts/search/."
  - "Reads key/value rows; requires searchApiUrl, dataSources, requestId and namespace (`en`)."
  - "Facet groups, in order: Content type, Topic, Technology, Year, Author. Year lists newest first; the others by count. Groups all start CLOSED; groups with more than five values get a filter field."
  - "Below 900px the sort control and the facet groups are a menu: a `Sorts and filters` button beside the count swaps the results for them, and a sticky `View N Results` button (or Escape) swaps back."
  - "Below 1200px the featured answer and then the promo rail sit between the count and the first result; from 1200px the promo rail is a sticky third column beside the results."
  - "Results are ordered by RELEVANCE by default; a Sort by dropdown offers Date (newest first), persisted as `stx-sort=date` and sent as `params.sort = date:desc`."
  - "Optionally shows curated panels from one DA workbook named by the featuredResults row (authored with the Search Terms app, tools/search-terms/): a featured result across the results column when the query matches a term, and a promo rail of up to three panels on every search."
  - "A result renders as title, the page URL, a content-type pill and `Published <date>`, the page description (or the matched excerpt when it has none), and a Read more affordance, ruled off inside one list."
  - "The mockData row (or `?stx-mock=1`) runs the block against a small local fixture and must never be set on a live page."
  - "The summary reads `Showing 11-20 of N Results`; the page is kept in the URL as `stx-page` and the facet selection as `stx-facets`, both by replaceState."
  - "A query with no results shows an announced `No results for “<query>”.` message, with a Clear all filters action when a filter emptied the list."
  - "Search operators: uppercase AND / OR and \"quoted phrases\" are parsed in the block and sent as `params.operators`."
---

# Search Results Panel

The Arbory site search results page. Ported from an earlier client site's block of the
same name; the panel itself is the vendored StreamX bundle (`scripts/search/`),
and this block owns the result rows, the facet affordances, sort, pager, empty
state, mobile menu and the curated panels.

## Authoring

One block on the search page (e.g. `/en/search`), as a key/value table:

| Search Results Panel | |
| --- | --- |
| `searchApiUrl` | `/search/pages` |
| `dataSources` | `/search/arbory-pages/body` |
| `requestId` | `arbory-pages` |
| `namespace` | `en` |
| `pageSize` | `10` |
| `inputPlaceholder` | `Search Arbory Digital` |
| `totalResults` | `{{totalCount}} results` |
| `featuredResults` | `/data/search-terms` |

| Row | Required | Contract |
| --- | --- | --- |
| `searchApiUrl` | yes | Suggestion endpoint (GET), e.g. `/search/pages` |
| `dataSources` | yes | Results endpoint (POST), e.g. `/search/arbory-pages/body` |
| `requestId` | yes | OpenSearch search-template id: `arbory-pages` |
| `namespace` | yes | Which documents to search: `en` |
| `pageSize` | | Results per page (default 10) |
| `minSearchLength` | | Characters before a search fires (default 3) |
| `inputPlaceholder` | | Placeholder text in the search field |
| `paginationInfo` | | e.g. `Page {{currentPage}} of {{pageNumber}}` (hidden; the pager composes its own label) |
| `totalResults` | | e.g. `{{totalCount}} results` — the block reads the count from it |
| `facetFieldSize` | | Values requested per facet (default 20) |
| `facetDepthLevel` | | Facet tree depth (default 1, i.e. flat) |
| `featuredResults` | | Path of the curated-panels workbook, e.g. `/data/search-terms` |
| `featuredSheet` | | Sheet holding the featured answers (default: `featured-results`, `faq`, `data`, `featured`, then a sole sheet) |
| `promoSheet` | | Sheet holding the promo rail (default: `promo`, `promos`; no sheet, no rail) |
| `resultUrlHost` | | Host result URLs are DISPLAYED against, e.g. `https://www.arborydigital.com` (default: the page's own origin; links stay relative) |
| `mockData` | | `true` runs on the local fixture — never on a live page |

`/search/*` is routed to StreamX by the CDN, so both endpoints are same-origin
paths. Search is not linked from the header or nav yet; see
`blocks/search-config/` for the config block a later header search will read.

## Curated panels

The `featuredResults` workbook has two sheets, authored with the Search Terms
DA app (`tools/search-terms/`, "Frank's featured search tooling"):

```text
featured-results | term | title | answer      | url title | url |
promo            |      | title | description | url title | url |
```

A featured row matches when any of its comma-separated terms appears in the
query as a whole word; the first matching row wins. Promo rows show on every
search, in sheet order, up to three.

## Development without the backend

Append `?stx-mock=1` to any page carrying this block (or author `mockData` =
`true` on a review page) and both endpoints are answered from
`scripts/search-mock/arbory-search-fixture.json` — fifteen real Arbory pages
with hand-assigned facets.
