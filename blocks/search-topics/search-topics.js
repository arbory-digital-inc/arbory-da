/* eslint-disable no-underscore-dangle -- `_id` and `_source` are OpenSearch's field names */
/*
 * Search Topics
 *
 * A row of topic pills for an article: the product and technology names it
 * stands out for, each a link into the site search. OpenSearch picks them
 * (template `arbory-topics`, arbory-streamx
 * mesh/sources/templates/arbory-topics.mustache.json): the article and its
 * nearest neighbours are compared, by significant_text, against every page in
 * the same language, and only names from GLOSSARY (./glossary.js) are ranked.
 * A name is shown only if the article itself mentions it. The article's
 * curated technology tags fill the row out, each linking to the search page
 * filtered to that tag.
 *
 * Every row is optional:
 *
 *   | Search Topics |                            |
 *   | count         | 8                          |
 *   | searchApiUrl  | /search/arbory-topics/body |
 *
 * With fewer than two pills to show, the block removes itself.
 */
import { GLOSSARY } from './glossary.js';
import { SEARCH_LANGUAGES, facetValueLabel, searchLanguage } from '../search-results-panel/search-i18n.js';

const DEFAULTS = {
  searchApiUrl: '/search/arbory-topics/body',
  count: 8,
};
const MAX_COUNT = 16;
const MIN_PILLS = 2;
/* Slots kept for the article's curated technology tags when names would fill the row. */
const TAG_ROOM = 2;
/* Enough of the article for an unindexed page; the index has the rest. */
const TEXT_LIMIT = 2000;
/* Where the article's copy is not: other feeds, furniture, this block. */
const NOT_ARTICLE = '.search-topics, .search-mlt-suggestions, .article-feed, .metadata, nav, header, footer';

const HEADING = {
  en: 'Topics',
  de: 'Themen',
  es: 'Temas',
  fr: 'Sujets',
  it: 'Argomenti',
  pl: 'Tematy',
  pt: 'Tópicos',
  ja: 'トピック',
  ko: '주제',
  'zh-cn': '主题',
  'zh-tw': '主題',
};

/** The search page's facet key for a technology tag. */
const TECHNOLOGY_FACET = 'technology_level0';

/**
 * The authored rows, keyed by a normalised name.
 *
 * @param {HTMLElement} block
 * @returns {Object<string,string>}
 */
export function readConfig(block) {
  const config = {};
  [...block.children].forEach((row) => {
    const [key, value] = row.children;
    if (!key || !value) return;
    const name = key.textContent.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (name) config[name] = value.textContent.trim();
  });
  return config;
}

/**
 * The page's index namespace and document id: `<lang>:<path>`, `<lang>` being
 * the locale folder, a folder's index page by its document name.
 *
 * @param {string} pathname
 * @returns {{ namespace: string, id: string }}
 */
export function pageKey(pathname) {
  let path = pathname || '/';
  if (path.endsWith('/')) path = `${path}index`;
  path = path.replace(/\.html$/, '');
  const folder = path.split('/')[1]?.toLowerCase() || '';
  const namespace = SEARCH_LANGUAGES.includes(folder) ? folder : searchLanguage();
  return { namespace, id: `${namespace}:${path}` };
}

/**
 * The article's copy as plain text: headings, paragraphs, list items and code,
 * wherever they sit, outside other feeds and the page furniture.
 *
 * @param {Document} [doc]
 * @returns {string}
 */
export function articleText(doc = document) {
  const parts = [];
  doc.querySelectorAll('main h1, main h2, main h3, main h4, main h5, main p, main li, main pre, main td')
    .forEach((el) => {
      if (el.closest(NOT_ARTICLE)) return;
      if (el.parentElement?.closest('main p, main li, main pre, main td')) return;
      const text = el.textContent.replace(/\s+/g, ' ').trim();
      if (text) parts.push(text);
    });
  return parts.join('\n');
}

/**
 * Whether `text` mentions a glossary key as a word of its own. Only Latin
 * letters and digits count as the edge of a word, so a name inside Japanese or
 * Chinese text ("AEMとSling") is found.
 *
 * @param {string} text
 * @param {string} key A GLOSSARY key, [a-z0-9]
 * @returns {boolean}
 */
export function mentions(text, key) {
  return new RegExp(`(?<![A-Za-z0-9])${key}(?![A-Za-z0-9])`, 'i').test(text);
}

/**
 * Plain text for an HTML-escaped index value.
 *
 * @param {string} value
 * @returns {string}
 */
export function unescapeHtml(value) {
  return value
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    // Ampersand last, so "&amp;lt;" does not become "<".
    .replace(/&amp;/g, '&');
}

/**
 * The request body for `/search/<anything>/body`. The glossary goes as the
 * template's include regex.
 *
 * @param {{ namespace: string, id: string, text: string }} page
 * @param {Object<string,string>} [glossary]
 */
export function requestBody({ namespace, id, text }, glossary = GLOSSARY) {
  return {
    id: 'arbory-topics',
    params: {
      namespace, id, text, terms: Object.keys(glossary).join('|'),
    },
  };
}

/**
 * The pills, best first: glossary names the index ranked and the article
 * mentions, then the article's own technology tags. No label twice.
 *
 * @param {Object} json The template's response
 * @param {{ id: string, text: string, count: number, lang: string }} page
 * @param {Object<string,string>} [glossary]
 * @returns {{ label: string, kind: 'term'|'tag', value: string }[]}
 */
export function pickPills(json, {
  id, text, count, lang,
}, glossary = GLOSSARY) {
  const words = (label) => label.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  /* The same label, or one whose words another already covers ("CLI", "AIO CLI"). */
  const covered = (label, pills) => pills.some((p) => {
    const [a, b] = [words(label), words(p.label)];
    const [short, long] = a.length <= b.length ? [a, b] : [b, a];
    return short.every((w) => long.includes(w));
  });

  const terms = [];
  const buckets = json?.aggregations?.neighbourhood?.topics?.buckets || [];
  buckets.forEach(({ key }) => {
    const label = glossary[key];
    if (!label || covered(label, terms) || !mentions(text, key)) return;
    terms.push({ label, kind: 'term', value: label });
  });

  const self = json?.hits?.hits?.[0];
  const tagged = self?._id === id ? self._source?.payload?.facets?.technology_level0 || [] : [];
  const tags = [];
  tagged.forEach((raw) => {
    /* `_source` keeps tags HTML-escaped ("CDN &amp; Dispatcher"); the facet
       filter and the translations want the plain text. */
    const tag = unescapeHtml(raw);
    const label = facetValueLabel(tag, lang);
    const pill = { label, kind: 'tag', value: tag };
    const same = (p) => [label, tag].some((l) => p.label.toLowerCase() === l.toLowerCase());
    if (![...terms, ...tags].some(same)) tags.push(pill);
  });

  /* Names first, but keep room for up to TAG_ROOM of the article's own tags. */
  const room = Math.min(tags.length, TAG_ROOM, count);
  return [...terms.slice(0, count - room), ...tags].slice(0, count);
}

/**
 * Where a pill leads: the language's search page, searching for a name, or
 * filtered to a technology tag.
 *
 * @param {{ kind: string, value: string }} pill
 * @param {string} namespace
 * @returns {string}
 */
export function pillHref(pill, namespace) {
  const page = `/${namespace}/search`;
  if (pill.kind === 'tag') {
    const facets = JSON.stringify({ [TECHNOLOGY_FACET]: [pill.value] });
    return `${page}?stx-facets=${encodeURIComponent(facets)}`;
  }
  const query = pill.value.replace(/[()]/g, '').trim();
  return `${page}?query=${encodeURIComponent(query)}`;
}

/**
 * The pills as a list of links. Labels are set as text.
 *
 * @param {Object[]} pills
 * @param {string} namespace
 * @returns {HTMLUListElement}
 */
export function renderPills(pills, namespace) {
  const list = document.createElement('ul');
  list.className = 'search-topics-list';
  pills.forEach((pill) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.className = `search-topics-pill search-topics-${pill.kind}`;
    a.href = pillHref(pill, namespace);
    a.textContent = pill.label;
    li.append(a);
    list.append(li);
  });
  return list;
}

function placeholders() {
  const list = document.createElement('ul');
  list.className = 'search-topics-list';
  list.setAttribute('aria-busy', 'true');
  [72, 96, 60, 84].forEach((width) => {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.className = 'search-topics-pill search-topics-placeholder';
    span.style.width = `${width}px`;
    li.append(span);
    list.append(li);
  });
  return list;
}

function withdraw(block) {
  const wrapper = block.parentElement?.classList.contains('search-topics-wrapper')
    ? block.parentElement : block;
  const section = wrapper.closest('.section');
  wrapper.remove();
  if (section && !section.querySelector(':scope > *')) section.remove();
}

async function fetchTopics(url, body) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`topics: ${resp.status}`);
  return resp.json();
}

export default function decorate(block) {
  const config = readConfig(block);
  const parsed = parseInt(config.count, 10);
  const wanted = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULTS.count;
  const count = Math.min(wanted, MAX_COUNT);
  const url = config.searchapiurl || DEFAULTS.searchApiUrl;

  const { namespace, id } = pageKey(window.location.pathname);
  const lang = searchLanguage(namespace);
  const description = document.querySelector('meta[name="description"]')?.content || '';
  const text = articleText();

  const heading = document.createElement('p');
  heading.className = 'search-topics-heading';
  heading.id = 'search-topics-heading';
  heading.textContent = HEADING[lang] || HEADING.en;

  block.textContent = '';
  block.lang = lang;
  block.setAttribute('role', 'navigation');
  block.setAttribute('aria-labelledby', heading.id);
  block.append(heading, placeholders());

  /* Not awaited: EDS shows a section only once its blocks have decorated. */
  fetchTopics(url, requestBody({ namespace, id, text: `${description}\n${text}`.slice(0, TEXT_LIMIT) }))
    .then((json) => pickPills(json, {
      id, text, count, lang,
    }))
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.warn(e);
      return [];
    })
    .then((pills) => {
      if (pills.length < MIN_PILLS) {
        withdraw(block);
        return;
      }
      block.querySelector('.search-topics-list').replaceWith(renderPills(pills, namespace));
    });
}
