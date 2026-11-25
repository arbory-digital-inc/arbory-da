# Search Terms Manager

A DA app for the **curated panels** on the Arbory search results page — the
featured answer across the results column, and the promo rail beside it. Both
are authored in one workbook, `/data/search-terms` in
`arbory-digital-inc/arbory-da`, with a sheet each (`featured-results`, `promo`),
and this edits that workbook. The `search-results-panel` block reads it through
its `featuredResults` row (`/data/search-terms`).

Built by Frank for an earlier client site ("Frank's featured search tooling") and ported
here with the search page. Arbory has one site and an English-only search page,
so the tool edits one workbook; its site switcher is hidden (`SITES` in
`st-config.js`).

Open it from DA's **Apps** (see *Registering it in DA* below); it needs no token
of its own (the DA SDK supplies one) and no role beyond write access to the
site.

## Why not just edit the sheet

The sheet editor shows cells, and every way this feature goes wrong is a
property of the **set** of rows rather than of a cell. All three are silent —
nothing errors, nothing looks broken in DA, and the panel simply does not
appear:

| What goes wrong | What the sheet editor shows | What this shows | Sheet |
| --- | --- | --- | --- |
| A row missing what its sheet requires | A row | *Skipped — never appears* | both |
| A synonym an earlier row always takes (`eds, edge delivery` below an `eds` row) | A row | *"eds" goes to an earlier row first — the other terms still work* | `featured-results` |
| A row an earlier row always outranks | Two rows | *Never reached: row 1 matches every query this could* | `featured-results` |
| A `url` with no `url title` | Two cells, one full | *The call to action is left off* | both |
| Edited but never previewed | The new copy | Save previews it, every time | both |

The **never reached** check is the one with no equivalent anywhere else. First
match wins, and `readRow` normalises each term into a space-padded phrase, so a
query can only match row *i* if it contains that phrase — and if an earlier
row's phrase sits inside it as a whole word (`' aem '` inside `' aem cloud
service '`), every such query matches the earlier row too. That row is dead copy: it
is in the sheet, it reads correctly, and no reader can ever see it.

## The two sheets are not the same shape

| | `featured-results` — featured answer | `promo` — the rail |
| --- | --- | --- |
| Shows | one row | **up to three** |
| When | only when the query matches its `term` | **every search** |
| `term` column | required | **none** |
| What row order does | breaks ties between matches | **decides what shows** |

The rail is unconditional, so a term there could only answer a question nobody
is asking — it was dropped from the sheet. Everything term-shaped above is
therefore scoped to `featured-results`, and the column table in `st-config.js` (`hasTerm`) is
what every one of those branches reads.

**On the promo sheet, row order IS the content.** Rows one to three are what
every reader sees; row four is not broken, it is fourth. The tool says so rather
than warning about it.

## The block is the authority

`st-model.js` imports `readRow` and `matchCurated` **from the block that renders
the panels**, and `st-preview.js` renders with the block's `renderCurated` inside
an iframe carrying the site's real stylesheets. So "is this row live", "which row
wins this query" and "what does it look like" are answered by the code the reader
runs, at widths derived from the same grid.

The alternative — reimplementing the rules here — is the drift the block's own
header warns about: *whole word, anywhere in the query, first row wins* is one
character away from a different rule, and a second copy diverges the first time
either is tuned.

## Files

| File | What it is |
| --- | --- |
| `search-terms.html` / `.css` / `.js` | The app: shell, styles, UI |
| `st-session.js` | The DA SDK token and org — the ONLY module that imports it |
| `st-config.js` | Site (`arbory-da`), sheets, paths, copy budgets. Pure constants |
| `st-sheet.js` | Workbook envelope + row round trip. Pure, tested |
| `st-model.js` | What a set of rows will do. Built on the block's functions |
| `st-store.js` | DA source I/O, preview and publish |
| `st-preview.html` / `st-preview.js` | The preview frame (site styles, dark theme) |

`st-session.js` exists so nothing else has to import `DA_SDK`, which is a
top-level await against da.live: any module importing it can only run inside DA,
which would put the sheet shape and the matching rules out of reach of the test
runner. Tests: `test/tools/search-terms.test.js` (`npm test`).

## Save and publish

**Save always previews.** A saved-but-unpreviewed sheet is indistinguishable
from a broken feature on the results page — the page reads the published copy,
so it keeps serving the old columns. That cost an afternoon on the earlier site.

**Publish is a separate button**, and is disabled while there are unsaved rows
(publishing what is in DA while the screen shows something else would put a
version live nobody has looked at) and on any site `SITES` in `st-config.js`
marks `publish: false`. If the site is ever frozen at preview, flip it there —
the tool must not be the thing that publishes to a site somebody deliberately
froze.

## Registering it in DA

Not done yet — this is the step to take once the code is merged.

1. The app is served from the site host, so it must be on the branch that host
   serves (`main`) before the entry resolves: check
   `https://main--arbory-da--arbory-digital-inc.aem.live/tools/search-terms/search-terms.html`
   loads.
2. Open the site config, `https://da.live/config#/arbory-digital-inc/arbory-da/`,
   and add (or open) a sheet named **`apps`** with these columns and one row:

   | title | description | path |
   | --- | --- | --- |
   | Search Terms | Featured search answers and promo rail for /en search | `/app/arbory-digital-inc/arbory-da/tools/search-terms/search-terms` |

3. Save the config. The app then appears under **Apps** in DA for
   `arbory-digital-inc/arbory-da`.

The workbook does not have to exist first: on a site with no
`/data/search-terms` the tool says so and offers to create it on the first save
(which also previews it). Publish it before the live search page will show the
panels — the page reads the published copy.

## Known limits

- **Concurrent saves are reconciled per sheet, not locked.** It used to be last
  write wins: the workbook was read on open and written whole on save, so a tab
  left open replaced every later save in BOTH sheets — on the earlier site
  re-entering the featured answers in one browser wiped a promo rail saved from
  another. Save now re-reads DA first and compares three versions (`reconcile`
  in `st-sheet.js`): a sheet this tab did not change is written back exactly as
  DA holds it, a sheet only someone else changed is kept as they left it, and a
  sheet both sides changed asks before replacing theirs — then reads DA again
  after the answer, so a save made while the question was open is not written
  over. Two gaps remain — the second between the last read and the write, and
  DA's own sheet editor, which does no such check, so the same workbook edited
  there and here at once can still lose rows.
- **An open tab watches for other people's saves.** It re-reads DA when the tab
  is shown or focused, and every two minutes while it is visible (hidden tabs
  are not polled). A tab with nothing unsaved takes the new rows and says who
  saved them; a tab with unsaved rows is left alone and told who saved and when,
  and Save's check handles the rest. The name comes from DA's version list, the
  same audit trail DA keeps for every document.
- **The DA token is handed over once, at load.** nx `shell.js` posts it a
  single time and nothing feeds the SDK's refresh hook, so a tab left open long
  enough outlives it and Save answers `401`. Nothing inside the app can get a
  new one; reloading the tool from DA does. Once DA refuses the token, the tool
  keeps the unsaved rows in this browser (`localStorage`, per site) — when the
  refusal is caught, and again as the tab unloads, so rows typed after the
  warning go too — and the reload offers them back. Before that, the reload the
  error asked for discarded them.
- **A save can land without its preview.** The write and the preview are two
  calls. If the preview fails (a `403` there is the site's own permissions, not
  the DA sign-in), the banner says the rows are saved but not previewed, and the
  tab stays unsaved so Save & preview can finish the job.
- **The tool cannot run outside DA.** `st-session.js` awaits the DA SDK, which
  resolves only when the page is embedded by DA. The pure modules (`st-sheet`,
  `st-model`, `st-preview`) do run standalone, which is what the tests use.
- **No page picker.** The earlier site's copy has a Browse button beside the `url` field that
  opens that site's shared `tools/pagetree` viewer; Arbory has no such tool, so the
  button was dropped and URLs are typed (e.g. `/en/blog/what-is-document-authoring-for-edge-delivery`).
