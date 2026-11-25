/*
 * Search Config
 *
 * A headless configuration block for a HEADER search — a search control in the
 * site header, as opposed to the results page (`search-results-panel`).
 *
 * Authored inside the nav fragment as a key/value table:
 *
 *   | Search Config    |                                |
 *   | searchApiUrl     | /search/pages                  |
 *   | searchPageUrl    | /search                        |
 *   | namespace        | en                             |
 *   | minSearchLength  | 3                              |
 *   | inputPlaceholder | Search Arbory Digital          |
 *
 * It renders nothing. Its whole job is to carry those values from the document
 * into the DOM, where the code that mounts a header search input reads them —
 * keeping the endpoint authored rather than hardcoded in a block.
 *
 * NO CONSUMER YET. Ported from an earlier client site ahead of an Arbory header search;
 * `blocks/header/header.js` does not read it today, and search is not linked
 * from the nav. When a header search lands, it can either read the
 * `data-search-config` attribute below or — if it fetches the nav fragment raw,
 * without running block decorators, as the earlier site's header does — call
 * `parseSearchConfigRows` on the block itself.
 */

/** Attribute the parsed config is published under, as JSON. */
const CONFIG_ATTR = 'data-search-config';

/**
 * Reads the nav search config published by the `search-config` block.
 *
 * Returns an empty object when the block is absent or its value will not parse,
 * so a caller can treat "not authored" and "authored wrong" the same way — as
 * "no header search", which is the current state of the site anyway.
 *
 * @param {Element} [root] Where to look for the block; defaults to the document
 * @returns {Object} Authored keys mapped to their values
 */
export function readSearchConfig(root = document) {
  const el = root.querySelector(`[${CONFIG_ATTR}]`);
  if (!el) return {};
  try {
    return JSON.parse(el.getAttribute(CONFIG_ATTR)) || {};
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Could not parse the authored header search config', error);
    return {};
  }
}

/**
 * Parses the block's authored key/value rows.
 *
 * @param {Element} block The search-config block, still holding its rows
 * @returns {Object} Authored keys mapped to their values
 */
export function parseSearchConfigRows(block) {
  const config = {};
  block.querySelectorAll(':scope > div').forEach((row) => {
    const [keyEl, valueEl] = row.querySelectorAll(':scope > div');
    const key = keyEl?.textContent?.trim();
    // A link cell: DA stores a URL as an anchor, so read the href when there is
    // one and fall back to the text for a plain value.
    const value = (valueEl?.querySelector('a')?.href || valueEl?.textContent || '').trim();
    if (key && value) config[key] = value;
  });
  return config;
}

export default function decorate(block) {
  const config = parseSearchConfigRows(block);

  // Published on the block itself rather than on a nav element: this block may
  // be authored anywhere in the nav fragment, and the consumer looks it up by
  // attribute, not by position.
  block.setAttribute(CONFIG_ATTR, JSON.stringify(config));
  block.replaceChildren();
}
