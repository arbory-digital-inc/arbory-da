/* eslint-disable no-underscore-dangle */
/* OpenSearch names its envelope fields `_id`, `_score`, `_source`. This file
   reproduces that envelope verbatim, so the prefixes are the contract. */
/*
 * Mock StreamX search — a local stand-in for the Arbory search API.
 *
 * WHY THIS EXISTS
 * ---------------
 * The search page's front end is built ahead of (and in parallel with) the
 * `arbory-pages` StreamX backend. This module answers the search requests the
 * block makes out of a small fixture (arbory-search-fixture.json: fifteen real
 * arborydigital.com pages with hand-assigned facets), in the response shape
 * OpenSearch returns — so every visual state can be built and reviewed before
 * the backend is live: facets, highlights, no description, no results, page 2.
 *
 * IT IS NOT A SEARCH ENGINE. Scoring is a term count, not BM25, so result ORDER
 * will not match production. Everything the UI consumes — the envelope, the
 * facet aggregations, the highlight fragments, the totals that drive pagination
 * — does match the `arbory-pages` contract.
 *
 * OFF UNLESS ASKED FOR
 * --------------------
 * It installs nothing unless a page opts in, so it cannot reach production by
 * accident. Two ways in, both explicit:
 *
 *   - author `mockData` = `true` on the search block (a design/review page), or
 *   - append `?stx-mock=1` to any page carrying a search block.
 *
 * The interceptor only answers URLs the page's own block was configured with
 * (`searchApiUrl` / `dataSources`). Every other request goes to the network
 * untouched.
 *
 * Ported from an earlier client site's mock (which runs on a 72-page corpus); delete
 * this directory once the Arbory backend is live and the design is settled.
 */

/** Authored row that turns the mock on. */
const MOCK_ROW = 'mockData';

/** URL param that turns the mock on for one page view. */
const MOCK_PARAM = 'stx-mock';

/** Where the fixture lives, relative to this module. */
const CORPUS_URL = new URL('./arbory-search-fixture.json', import.meta.url).href;

/** Suffix marking a facet family field on a document. */
const FAMILY_SUFFIX = '_level0';

/** The field the panel sends its selections under (the library's default). */
const FILTER_FIELD = 'category_hierarchy';

/** Characters of context either side of a match in a content fragment. */
const HIGHLIGHT_PAD = 90;

/** Content fragments returned per hit, as the real highlighter caps them. */
const MAX_FRAGMENTS = 5;

let corpusPromise = null;
let installed = false;

/** `origin + pathname` of every endpoint the page's search block points at. */
const endpoints = new Set();

/**
 * The values a document can be filtered by: its own `category_hierarchy` when
 * the fixture carries one, else every `<family>_level0` value it has. The panel
 * sends top-level selections as bare values ("Article", "2025"), so for a flat
 * facet tree the two are the same list.
 */
function filterValuesOf(doc) {
  const facets = doc._source.payload.facets || {};
  if (Array.isArray(facets[FILTER_FIELD])) return facets[FILTER_FIELD];
  return Object.keys(facets)
    .filter((field) => field.endsWith(FAMILY_SUFFIX))
    .flatMap((field) => facets[field] || []);
}

/** Loads (and memoises) the fixture. */
function loadCorpus() {
  if (!corpusPromise) {
    corpusPromise = fetch(CORPUS_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`fixture ${response.status}`);
        return response.json();
      })
      .then((data) => data.documents || [])
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error('[search-mock] could not load the fixture', error);
        corpusPromise = null;
        return [];
      });
  }
  return corpusPromise;
}

/** Lowercased query words, punctuation and quotes dropped. */
const termsOf = (query) => (query || '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .split(/\s+/)
  .filter(Boolean);

/** The text a document is matched against, lowercased once per document. */
function searchableText(doc) {
  const { payload } = doc._source;
  return `${payload.title} ${payload.description || ''} ${payload.content || ''}`.toLowerCase();
}

/**
 * Escapes a string for use in HTML text, the way OpenSearch's highlighter does
 * before wrapping matches in `<em>`. The block reverses this when it rebuilds a
 * fragment as DOM nodes, so the two have to agree on the entity set.
 */
const escapeHtml = (value) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

/**
 * Builds highlight fragments for one field, in OpenSearch's format: an excerpt
 * around each run of matches with the matched terms wrapped in `<em>`.
 *
 * @param {string} text The field's value
 * @param {string[]} terms Lowercased query terms
 * @param {boolean} whole Emit the whole field rather than an excerpt (titles)
 * @returns {string[]} Fragments, or empty when nothing matched
 */
function buildHighlights(text, terms, whole) {
  if (!text || !terms.length) return [];
  const lower = text.toLowerCase();

  const spans = [];
  terms.forEach((term) => {
    let at = lower.indexOf(term);
    while (at !== -1) {
      spans.push([at, at + term.length]);
      at = lower.indexOf(term, at + term.length);
    }
  });
  if (!spans.length) return [];
  spans.sort((a, b) => a[0] - b[0]);

  const mark = (from, to) => {
    let out = '';
    let cursor = from;
    spans.forEach(([start, end]) => {
      if (end <= cursor || start >= to) return;
      if (start > cursor) out += escapeHtml(text.slice(cursor, start));
      out += `<em>${escapeHtml(text.slice(start, end))}</em>`;
      cursor = end;
    });
    return out + escapeHtml(text.slice(cursor, to));
  };

  if (whole) return [mark(0, text.length)];

  // One fragment per run of nearby matches, clipped to word boundaries.
  const fragments = [];
  let windowStart = null;
  let windowEnd = null;
  const flush = () => {
    if (windowStart === null) return;
    let from = Math.max(0, windowStart - HIGHLIGHT_PAD);
    let to = Math.min(text.length, windowEnd + HIGHLIGHT_PAD);
    if (from > 0) {
      const space = text.indexOf(' ', from);
      if (space !== -1 && space < windowStart) from = space + 1;
    }
    if (to < text.length) {
      const space = text.lastIndexOf(' ', to);
      if (space !== -1 && space > windowEnd) to = space;
    }
    fragments.push(mark(from, to));
    windowStart = null;
  };

  spans.forEach(([start, end]) => {
    if (windowStart === null) {
      windowStart = start;
      windowEnd = end;
      return;
    }
    if (start - windowEnd <= HIGHLIGHT_PAD * 2) {
      windowEnd = Math.max(windowEnd, end);
      return;
    }
    flush();
    windowStart = start;
    windowEnd = end;
  });
  flush();

  return fragments.slice(0, MAX_FRAGMENTS);
}

/**
 * Scores one document against the query terms: a term count, weighted so a
 * title match outranks a body match. Every term must match (AND), which keeps a
 * fifteen-document fixture from returning everything for a two-word query.
 *
 * @returns {number} The score, or 0 when the document does not match every term
 */
function scoreDoc(doc, terms) {
  if (!terms.length) return 1;
  const { payload } = doc._source;
  const title = payload.title.toLowerCase();
  const body = searchableText(doc);

  let score = 0;
  const everyTermMatches = terms.every((term) => {
    if (!body.includes(term)) return false;
    score += title.includes(term) ? 3 : 1;
    return true;
  });
  return everyTermMatches ? score : 0;
}

/**
 * Scores one document against `params.operators` (see
 * blocks/search-results-panel/search-operators.js): OR'd groups of AND'd
 * operands, each its loose words plus any quoted phrases. An operand matches
 * when ANY of its loose words does (or it has none) and EVERY phrase does.
 *
 * @returns {number} The score, or 0 when no group has every operand matching
 */
function scoreOperators(doc, operators) {
  const { payload } = doc._source;
  const title = payload.title.toLowerCase();
  const body = searchableText(doc);
  const words = ` ${termsOf(body).join(' ')} `;
  const hits = (text) => termsOf(text).filter((term) => body.includes(term));
  const hasPhrase = ({ phrase }) => words.includes(` ${termsOf(phrase).join(' ')} `);

  const operands = (operators.any_of || []).map((group) => group.all_of || []);
  const matches = operands.some((group) => group.every((operand) => (
    (!operand.text || hits(operand.text).length) && (operand.phrases || []).every(hasPhrase)
  )));
  if (!matches) return 0;
  const terms = operands.flat().flatMap((operand) => [
    ...hits(operand.text),
    ...(operand.phrases || []).flatMap(({ phrase }) => termsOf(phrase)),
  ]);
  return Math.max(1, terms.reduce((score, term) => score + (title.includes(term) ? 3 : 1), 0));
}

/**
 * Applies the panel's facet selection: values inside one `filter_query` entry
 * are OR-ed, entries are AND-ed.
 *
 * @param {Object} doc A fixture document
 * @param {Array} fields `params.filter_query.fields` from the request
 * @returns {boolean} Whether the document survives the filter
 */
function passesFilters(doc, fields) {
  if (!fields?.length) return true;
  const owned = filterValuesOf(doc);
  return fields.every((field) => {
    const values = field.values || [];
    if (!values.length) return true;
    return values.some((value) => owned.includes(value));
  });
}

/**
 * Counts facet values across a result set, in OpenSearch's aggregation shape:
 * flat `aggregations.<family>_level0.buckets[{ key, doc_count }]`, count
 * descending then alphabetical (the terms-agg default).
 *
 * The families are emitted ALPHABETICALLY by field name, deliberately not in
 * the block's FACET_ORDER: the real backend's order is arbitrary, and a mock
 * that answered in the right order would hide a broken sort in the block. Year
 * buckets likewise arrive by count; the block re-sorts them newest first.
 *
 * @param {Object[]} docs The matching documents
 * @returns {Object} `aggregations`, keyed by field name
 */
function aggregate(docs) {
  const counts = new Map();
  docs.forEach((doc) => {
    const facets = doc._source.payload.facets || {};
    Object.keys(facets).forEach((field) => {
      if (!field.endsWith(FAMILY_SUFFIX)) return;
      if (!counts.has(field)) counts.set(field, new Map());
      const bucket = counts.get(field);
      (facets[field] || []).forEach((value) => bucket.set(value, (bucket.get(value) || 0) + 1));
    });
  });

  const aggregations = {};
  [...counts.keys()].sort().forEach((field) => {
    aggregations[field] = {
      doc_count_error_upper_bound: 0,
      sum_other_doc_count: 0,
      buckets: [...counts.get(field).entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([key, count]) => ({ key, doc_count: count })),
    };
  });
  return aggregations;
}

/**
 * The comparator for one `params.sort` value. Relevance is the default and the
 * fallback; `date:desc` / `date:asc` order by `payload.date`, with undated
 * documents last in both directions. Ties break on title so a given request
 * always answers in the same order.
 *
 * @param {string} [sort] `field:direction`, e.g. `date:desc`
 * @returns {Function} An Array#sort comparator over `{ doc, score }` entries
 */
function orderBy(sort) {
  const titleOf = (entry) => entry.doc._source.payload.title;
  const byRelevance = (a, b) => b.score - a.score || titleOf(a).localeCompare(titleOf(b));

  const [field, direction] = String(sort || '').split(':');
  if (field !== 'date') return byRelevance;

  const sign = direction === 'asc' ? 1 : -1;
  const msOf = (entry) => {
    const ms = Date.parse(entry.doc._source.payload.date || '');
    return Number.isNaN(ms) ? null : ms;
  };
  return (a, b) => {
    const left = msOf(a);
    const right = msOf(b);
    if (left === null && right === null) return byRelevance(a, b);
    if (left === null) return 1;
    if (right === null) return -1;
    return sign * (left - right) || byRelevance(a, b);
  };
}

/**
 * Answers one search request out of the fixture.
 *
 * @param {Object[]} corpus Every document
 * @param {Object} params The request's `params` (POST) or query string (GET)
 * @param {boolean} withAggregations Whether to include facet aggregations
 * @returns {Object} An OpenSearch-shaped response body
 */
function runSearch(corpus, params, withAggregations) {
  const terms = termsOf(params.query);
  const from = Number(params.from) || 0;
  const size = Number(params.size) || 10;
  const { namespace } = params;

  const scored = corpus
    .filter((doc) => !namespace || doc._source.namespace === namespace)
    .filter((doc) => passesFilters(doc, params.filter_query?.fields))
    .map((doc) => ({
      doc,
      score: params.operators ? scoreOperators(doc, params.operators) : scoreDoc(doc, terms),
    }))
    .filter((entry) => entry.score > 0)
    .sort(orderBy(params.sort));

  const page = scored.slice(from, from + size).map(({ doc, score }) => {
    const { payload } = doc._source;
    const highlight = {};
    const title = buildHighlights(payload.title, terms, true);
    const content = buildHighlights(payload.content || '', terms, false);
    if (title.length) highlight['payload.title'] = title;
    if (content.length) highlight['payload.content'] = content;

    return {
      _id: doc._id,
      _score: score,
      _source: {
        // Only the fields the arbory-pages template returns in `_source`, so
        // the renderers cannot come to depend on something production withholds.
        payload: {
          title: payload.title,
          facets: payload.facets,
          ...(payload.date ? { date: payload.date } : {}),
          ...(payload.description ? { description: payload.description } : {}),
          ...(payload.ingested ? { ingested: payload.ingested } : {}),
        },
        namespace: doc._source.namespace,
        type: doc._source.type,
      },
      ...(Object.keys(highlight).length ? { highlight } : {}),
    };
  });

  const body = {
    took: 1,
    timed_out: false,
    hits: {
      total: { value: scored.length, relation: 'eq' },
      max_score: scored.length ? scored[0].score : null,
      hits: page,
    },
  };
  if (withAggregations) body.aggregations = aggregate(scored.map((entry) => entry.doc));
  return body;
}

/** Whether this page asked for the mock. */
function mockRequested(rows) {
  if (new URLSearchParams(window.location.search).get(MOCK_PARAM) === '1') return true;
  return rows?.[MOCK_ROW]?.trim().toLowerCase() === 'true';
}

/** Records one configured endpoint, ignoring a value that is not a URL. */
function addEndpoint(raw) {
  if (!raw) return;
  try {
    const url = new URL(raw.trim(), window.location.href);
    endpoints.add(`${url.origin}${url.pathname}`);
  } catch {
    // Not a URL; nothing to intercept for it.
  }
}

/** Every endpoint the page's search blocks point at. */
function collectEndpoints(rows) {
  const keys = ['searchApiUrl', 'dataSources'];
  keys.forEach((key) => addEndpoint(rows?.[key]));
  document.querySelectorAll('.search-results-panel').forEach((block) => {
    block.querySelectorAll(':scope > div').forEach((row) => {
      const [keyEl, valueEl] = row.querySelectorAll(':scope > div');
      if (!keys.includes(keyEl?.textContent?.trim())) return;
      addEndpoint(valueEl?.querySelector('a')?.href || valueEl?.textContent);
    });
  });
}

/**
 * Installs the mock when the page asked for it; does nothing otherwise.
 *
 * Wraps `window.fetch` so requests to the block's configured endpoints are
 * answered from the fixture: a POST (results) with aggregations, a GET
 * (suggestions) without. Call it BEFORE the panel mounts, and before any other
 * fetch wrapper the block installs, so those wrap this and it sees their
 * changes to the request.
 *
 * @param {Object} rows The block's authored rows
 * @returns {Promise<boolean>} Whether the mock is on
 */
// Named, not default: the block imports it by name, as on the earlier site.
// eslint-disable-next-line import/prefer-default-export
export async function installMockSearch(rows) {
  if (!mockRequested(rows)) return false;
  collectEndpoints(rows);
  if (installed) return true;
  installed = true;

  const corpus = await loadCorpus();
  const realFetch = window.fetch.bind(window);

  // eslint-disable-next-line no-console
  console.info(
    `[search-mock] ON — ${corpus.length} documents standing in for `
    + `${[...endpoints].join(', ') || '(no configured endpoint found)'}`,
  );

  window.fetch = async (input, init) => {
    let url;
    try {
      url = new URL(typeof input === 'string' ? input : input.url, window.location.href);
    } catch {
      return realFetch(input, init);
    }
    if (!endpoints.has(`${url.origin}${url.pathname}`)) return realFetch(input, init);

    let params;
    let withAggregations;
    if ((init?.method || 'GET').toUpperCase() === 'POST') {
      try {
        params = JSON.parse(init.body).params || {};
      } catch {
        params = {};
      }
      withAggregations = true;
    } else {
      params = Object.fromEntries(url.searchParams.entries());
      withAggregations = false;
    }

    const body = runSearch(corpus, params, withAggregations);
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  return true;
}
