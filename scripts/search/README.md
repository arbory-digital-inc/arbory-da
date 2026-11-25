# StreamX Search — vendored distribution

This directory holds the **StreamX Search** library's build output. It is
third-party code: it is copied in from the library repo and **must not be edited
here** — the next copy would silently overwrite the edit.

Nothing in this directory is linted: `.eslintignore` lists `scripts/search/`,
and `npm run lint:css` only globs `blocks/` and `styles/`.

## Why it lives at `scripts/search/`

The library's own EDS decorators (`eds/*.js`) call

```js
loadCssFile('/scripts/search/streamx-search.css');
```

with that path hardcoded into the build output. Moving the bundle would 404 that
fetch, and editing the path back out is exactly what the copy-in contract above
forbids. So the bundle stays where the library expects to be served from.

Our own code — the part that is ours to maintain, lint and theme for Arbory —
is in `blocks/search-results-panel/` and `blocks/search-config/`, not here.

## Updating

Change the library source, then re-copy the build output:

1. In the library repo: `npm run build`
2. Copy `dist/*.js`, `dist/*.css` and `dist/eds/*.js` into this directory.
3. Delete any previously copied bundle whose hash no longer appears in `dist`.

Copy **`.js` and `.css` only** — no `.map` and no `.d.ts`.

## Directory structure

```text
search/
├── streamx-search-inline.js          # entry points
├── streamx-search-results-panel.js
├── streamx-search-tabs.js
├── <name>-<hash>.js                  # shared chunks, renamed on every build
├── streamx-search.css
├── README.md
└── eds/                              # EDS block decorators
    ├── search-results-panel.js
    ├── search-tab.js
    └── search-tabs.js
```

The hashed chunk files are referenced by the entry points, so they are replaced
as a set — copying only some of them leaves the entries pointing at files that no
longer exist.

**Never import a hashed chunk by name from `blocks/`.** The name changes on every
build, so the import would break on the next copy. Import the stable entry points
(`streamx-search-*.js`, `eds/*.js`) instead, and where a block needs a constant
that only ships from a hashed chunk, duplicate the constant with a comment saying
why (see `FACETS_PARAM` in `blocks/search-results-panel/search-results-panel.js`).

## Provenance

Copied from `arbory-digital-inc/arbory-dev` @ `scripts/search/`, the first
Arbory site to host this integration. The bundle files are byte-identical to
that copy on purpose — keep them that way so a library update is a straight `cp`
into every repo that hosts it.

The earlier client site carries the same bundle with one local difference:
`streamx-search.css` there reads `var(--font-weight-bold)`, a token that site's styles
define. Arbory has no font-weight tokens, so this copy keeps the library's own
`600`, which is also the weight Arbory's headings and buttons use.

The blocks that drive it (`search-results-panel`, `search-config`) and the
featured-results authoring app (`tools/search-terms/`) were ported from the earlier site's
code repo and re-themed for Arbory.
