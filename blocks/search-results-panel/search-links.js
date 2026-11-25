/*
 * Where a search hit links to, and the type-ahead option that links there.
 *
 * Shared by the search page (search-results-panel.js) and the header search
 * (blocks/header/nav-search.js), so a suggestion opens the same URL from either.
 * Kept free of the results panel's imports: the header loads it on first use and
 * should not pull the panel bundle in with it.
 *
 * The index holds two sites. A blog page is keyed `<lang>:/<lang>/<path>` and
 * links root-relative, to the host the reader is on; an apex-site page is keyed
 * `<lang>://arborydigital.com/<path>` and links protocol-relative, to its own host.
 */
/* eslint-disable no-underscore-dangle -- `_id` and `_source` are OpenSearch's field names */
import { getHitUrl } from '../../scripts/search/streamx-search-inline.js';

/**
 * Turns one highlight fragment into DOM nodes, keeping only its `<em>` marks.
 *
 * OpenSearch returns highlights as a string with matched terms wrapped in
 * `<em>`. Everything else in the fragment is page text and is emitted as a text
 * node, so no other markup — from the index or from a page — can reach the DOM.
 *
 * @param {string} fragment One entry from `highlight['payload.content']`
 * @returns {Node[]} Text nodes interleaved with `<em>` elements
 */
export function highlightNodes(fragment) {
  const nodes = [];
  const pattern = /<em>([\s\S]*?)<\/em>/g;
  let cursor = 0;
  let match = pattern.exec(fragment);
  const unescape = (value) => value
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    // Ampersand last, so "&amp;lt;" does not become "<".
    .replace(/&amp;/g, '&');

  while (match) {
    if (match.index > cursor) {
      nodes.push(document.createTextNode(unescape(fragment.slice(cursor, match.index))));
    }
    const mark = document.createElement('em');
    mark.textContent = unescape(match[1]);
    nodes.push(mark);
    cursor = match.index + match[0].length;
    match = pattern.exec(fragment);
  }
  if (cursor < fragment.length) {
    nodes.push(document.createTextNode(unescape(fragment.slice(cursor))));
  }
  return nodes;
}

/**
 * The public path of a page, from the path its index document is named by.
 *
 * The index names a FOLDER's index page after its DA document (`en:/en/index`,
 * `en:/en/blog/index`), but EDS serves it at the folder, `/en/` and
 * `/en/blog/`. The trailing slash is kept (`/about` and `/about/` can be
 * different pages), and only a final segment of exactly `index` counts:
 * `/en/blog/search-index` is unchanged.
 *
 * A page from the apex site (arborydigital.com, indexed alongside this one) is
 * keyed by its protocol-relative URL, `en://arborydigital.com/en/…`, so its
 * hit path is `//arborydigital.com/en/…`; the same rule applies to it.
 *
 * @param {string} path A hit path, e.g. from `getHitUrl`
 * @returns {string} The path the page is served at
 */
export function publicPath(path) {
  if (typeof path !== 'string') return path;
  if (path === '/index') return '/';
  return path.endsWith('/index') ? path.slice(0, -'index'.length) : path;
}

/**
 * The URL a hit links to: `getHitUrl` (the bundle's, copy-in-only) with folder
 * index pages mapped by publicPath. Result rows and suggestions both use it.
 *
 * @param {Object} item Search hit
 * @returns {string} Root-relative URL of the page, or protocol-relative
 *   (`//arborydigital.com/…`) for a page of another site
 */
export const resultUrl = (item) => publicPath(getHitUrl(item));

/* The class the library's combobox finds its options by. */
export const SUGGESTION_CLASS = 'stx-suggestion__item';
let suggestionSeq = 0;

/**
 * Renders one type-ahead suggestion as a link to the page it names.
 *
 * Replaces the library's default `suggestionItem`, whose href is the raw
 * `getHitUrl` (so the home page linked to `/index`) and is interpolated into
 * innerHTML unescaped. Here the href goes through `resultUrl` and every index
 * value is applied as a property or a text node. It shows the same text: the
 * first highlight fragment, else the plain title.
 *
 * The library's class and an id are kept: the combobox finds its options by
 * that class and points `aria-activedescendant` at that id.
 *
 * @param {Object} item Suggestion hit
 * @returns {HTMLElement} The option's link
 */
export function renderSuggestion(item) {
  const link = document.createElement('a');
  link.className = SUGGESTION_CLASS;
  suggestionSeq += 1;
  link.id = `search-suggestion-${suggestionSeq}`;
  link.href = resultUrl(item);

  const text = document.createElement('span');
  const fragment = item?.highlight?.['payload.title']?.[0] ?? item?.highlight?.['payload.content']?.[0];
  if (fragment) text.append(...highlightNodes(fragment));
  else text.textContent = item?._source?.payload?.title || link.getAttribute('href');
  link.append(text);
  return link;
}
