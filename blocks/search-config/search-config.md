---
block: search-config
model: key-value
variants: { classes: [] }
rules:
  - "Headless configuration block for a header search, authored inside the navigation fragment."
  - "Renders nothing; its decorator empties the block and publishes the authored rows as a data-search-config attribute."
  - "Values authored as links are read from the href, so a URL may be authored either as a link or as plain text."
  - "Not consumed yet: the header does not mount a search control today, so authoring it changes nothing visible."
---

# Search Config

Carries a header search's configuration from the navigation document into the
DOM. It has no appearance.

| Row | Contract |
| --- | --- |
| `searchApiUrl` | Suggestion endpoint the header search queries, e.g. `/search/pages` |
| `searchPageUrl` | Results page a submitted query navigates to, e.g. `/search` |
| `namespace` | Which documents to search: `en` |
| `minSearchLength` | Characters before suggestions appear |
| `inputPlaceholder` | Placeholder text in the header search field |

**Not wired yet.** Ported from an earlier client site so a later header search has its
config block ready; `blocks/header/header.js` does not read it today and the
nav does not link to search. Authoring it now is harmless.
