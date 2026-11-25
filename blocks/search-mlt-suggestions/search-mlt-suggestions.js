/* eslint-disable no-underscore-dangle -- `_id` and `_source` are OpenSearch's field names */
/*
 * Search MLT Suggestions
 *
 * "More like this" cards for the bottom of an article: the articles whose
 * title, description and body text are most like this one's, found by
 * OpenSearch's more_like_this query over the StreamX search index (template
 * `arbory-mlt`, arbory-streamx mesh/sources/templates/arbory-mlt.mustache.json).
 * Suggestions are always in the article's language: the index namespace is the
 * page's locale folder, and the template matches it exactly.
 *
 * Every row is optional:
 *
 *   | Search MLT Suggestions |                            |
 *   | count                  | 3                          |
 *   | content type           | Article                    |
 *   | searchApiUrl           | /search/arbory-mlt/body    |
 *
 * `content type` keeps one indexed type (Article, Podcast, Customer story,
 * Event, Page); without it any page in the language can be suggested, including
 * the apex site's (arborydigital.com), which share the index.
 *
 * The request names the article's own index document, so the index compares
 * the full indexed text, and also sends the page's own title, description and
 * opening text, so a page the index has not seen yet (a draft, a page published
 * minutes ago) still gets suggestions. The article itself is never suggested.
 *
 * With nothing to suggest (no index answer, no match) the block removes itself,
 * and its section when the section holds nothing but headings.
 */
import { resultUrl, onBlog } from '../search-results-panel/search-links.js';
import {
  SEARCH_LANGUAGES, facetValueLabel, searchLanguage, searchLocale,
} from '../search-results-panel/search-i18n.js';

const DEFAULTS = {
  searchApiUrl: '/search/arbory-mlt/body',
  count: 3,
};
const MAX_COUNT = 12;
/* Enough of the article to characterise it; the index has the rest. */
const TEXT_LIMIT = 2000;
/* Asked for beyond `count`, to make up for hits dropped as duplicates. */
const SPARE = 3;

/**
 * The authored rows, keyed by a normalised name: `content type` and
 * `contentType` both read as `contenttype`.
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
 * The page's index namespace and document id.
 *
 * A blog page is indexed as `<lang>:<path>`, where `<lang>` is the locale folder
 * the path starts with, and a folder's index page by its document name
 * (`/en/blog/` is `en:/en/blog/index`).
 *
 * @param {string} pathname e.g. location.pathname
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
 * A title without the section prefix some pages carry ("Blog | …"), for
 * display and for spotting the same article twice.
 *
 * @param {string} title
 * @returns {string}
 */
export function cleanTitle(title) {
  return String(title || '').replace(/^\s*(blog|podcast|news)\s*\|\s*/i, '').trim();
}

const sameTitle = (a, b) => cleanTitle(a).toLowerCase() === cleanTitle(b).toLowerCase();

/**
 * What this page is about, as plain text: title, description, then the
 * article's text up to TEXT_LIMIT. Only copy above the block counts (what
 * follows it is the page's furniture), and only article copy: no other feed,
 * no metadata, no navigation.
 *
 * @param {HTMLElement} block
 * @param {Document} [doc]
 * @returns {string}
 */
export function pageText(block, doc = document) {
  const title = doc.querySelector('meta[property="og:title"]')?.content
    || doc.querySelector('h1')?.textContent || doc.title;
  const description = doc.querySelector('meta[name="description"]')?.content || '';
  const parts = [];
  let length = 0;
  doc.querySelectorAll('main h1, main h2, main h3, main h4, main p, main li').forEach((el) => {
    if (length >= TEXT_LIMIT || block.contains(el)) return;
    // eslint-disable-next-line no-bitwise
    if (block.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) return;
    if (el.closest('.article-feed, .search-mlt-suggestions, .metadata, nav, header, footer')) return;
    const text = el.textContent.replace(/\s+/g, ' ').trim();
    if (text.length < 3) return;
    parts.push(text);
    length += text.length + 1;
  });
  return [cleanTitle(title), description, parts.join(' ')].join('\n').trim().slice(0, TEXT_LIMIT);
}

/**
 * The request body for `/search/<anything>/body`: `id` names the template and
 * `params` reach it with their types intact.
 */
export function requestBody({
  namespace, id, text, count, contentType,
}) {
  const params = {
    namespace, id, text, size: String(count + SPARE),
  };
  if (contentType) params.content_type = contentType;
  return { id: 'arbory-mlt', params };
}

/**
 * The hits worth showing: not this article (by URL or by title, which is how a
 * copy or a second URL for the same article shows up), no title twice, at most
 * `count`.
 *
 * @param {Object[]} hits OpenSearch hits
 * @param {{ count: number, title: string, path: string }} page
 * @returns {Object[]}
 */
export function pickHits(hits, { count, title, path }) {
  const seen = [];
  return (hits || []).filter((hit) => {
    const hitTitle = hit?._source?.payload?.title;
    if (!hitTitle) return false;
    const url = resultUrl(hit);
    if (url === path || (title && sameTitle(hitTitle, title))) return false;
    if (seen.some((t) => sameTitle(t, hitTitle))) return false;
    seen.push(hitTitle);
    return true;
  }).slice(0, count);
}

/**
 * The image URL for a hit at a given width. The index keeps an image on the
 * page's own site as a path (EDS serves media at the same path on every host of
 * a site), so it is put on the hit's host: root-relative for a blog hit (the
 * blog's origin elsewhere), `//arborydigital.com` for an apex-site hit. An
 * image elsewhere is used as indexed.
 *
 * @param {Object} hit
 * @param {number} width
 * @param {string} format e.g. 'webply', 'pjpg'
 * @returns {string|null}
 */
export function imageUrl(hit, width, format) {
  const image = hit?._source?.payload?.image;
  if (!image || typeof image !== 'string') return null;
  if (!image.startsWith('/') || image.startsWith('//')) return image;
  const pathOnly = image.split('?')[0];
  const sized = `${pathOnly}?width=${width}&format=${format}&optimize=medium`;
  const link = resultUrl(hit);
  const host = link.startsWith('//') ? link.slice(0, link.indexOf('/', 2)) : '';
  return host ? `${host}${sized}` : onBlog(sized);
}

function picture(hit) {
  const fallback = imageUrl(hit, 750, 'pjpg');
  if (!fallback) return null;
  const pic = document.createElement('picture');
  if (fallback.includes('format=pjpg')) {
    const webp = document.createElement('source');
    webp.type = 'image/webp';
    webp.srcset = imageUrl(hit, 750, 'webply');
    pic.append(webp);
  }
  const img = document.createElement('img');
  img.src = fallback;
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.width = 750;
  img.height = 422;
  img.addEventListener('error', () => pic.classList.add('search-mlt-suggestions-image-missing'), { once: true });
  pic.append(img);
  return pic;
}

/**
 * A date the page's way: "March 4, 2025", "4. März 2025".
 *
 * @param {string} iso yyyy-MM-dd
 * @param {string} lang
 * @returns {string}
 */
export function formatDate(iso, lang) {
  const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(iso || '');
  if (!m) return '';
  const date = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
  return date.toLocaleDateString(searchLocale(lang), {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  });
}

/**
 * One suggestion card. Every index value is set as text or a property, so no
 * markup from the index reaches the page.
 *
 * @param {Object} hit
 * @param {string} lang
 * @returns {HTMLLIElement}
 */
export function renderCard(hit, lang) {
  const payload = hit._source?.payload || {};
  const li = document.createElement('li');
  li.className = 'search-mlt-suggestions-card';

  const link = document.createElement('a');
  link.className = 'search-mlt-suggestions-link';
  link.href = resultUrl(hit);

  const media = document.createElement('div');
  media.className = 'search-mlt-suggestions-media';
  const pic = picture(hit);
  if (pic) media.append(pic);
  else media.classList.add('search-mlt-suggestions-media-empty');

  const body = document.createElement('div');
  body.className = 'search-mlt-suggestions-body';

  const meta = document.createElement('p');
  meta.className = 'search-mlt-suggestions-meta';
  const type = payload.facets?.content_type_level0?.[0];
  if (type) {
    const label = document.createElement('span');
    label.className = 'search-mlt-suggestions-type';
    label.textContent = facetValueLabel(type, lang);
    meta.append(label);
  }
  const date = formatDate(payload.date, lang);
  if (date) {
    const time = document.createElement('time');
    time.dateTime = payload.date;
    time.textContent = date;
    meta.append(time);
  }

  const title = document.createElement('h3');
  title.className = 'search-mlt-suggestions-title';
  title.textContent = cleanTitle(payload.title);

  body.append(meta, title);
  if (payload.description) {
    const description = document.createElement('p');
    description.className = 'search-mlt-suggestions-description';
    description.textContent = payload.description;
    body.append(description);
  }
  const authors = payload.facets?.author_level0;
  if (authors?.length) {
    const by = document.createElement('p');
    by.className = 'search-mlt-suggestions-author';
    by.textContent = authors.join(', ');
    body.append(by);
  }

  link.append(media, body);
  li.append(link);
  return li;
}

function placeholders(count) {
  const list = document.createElement('ul');
  list.className = 'search-mlt-suggestions-list';
  list.setAttribute('aria-busy', 'true');
  for (let i = 0; i < count; i += 1) {
    const li = document.createElement('li');
    li.className = 'search-mlt-suggestions-card search-mlt-suggestions-placeholder';
    li.innerHTML = '<div class="search-mlt-suggestions-media"></div><div class="search-mlt-suggestions-body"><span></span><span></span><span></span></div>';
    list.append(li);
  }
  return list;
}

/*
 * Nothing to show: take the block out, with the heading that introduces it
 * ("More articles you might like"), and the section if that leaves it empty.
 */
function withdraw(block) {
  const section = block.closest('.section');
  const wrapper = block.parentElement?.classList.contains('search-mlt-suggestions-wrapper')
    ? block.parentElement : block;
  const before = wrapper.previousElementSibling;
  wrapper.remove();
  const heading = before?.lastElementChild;
  if (heading && /^H[1-6]$/.test(heading.tagName)) heading.remove();
  if (before && !before.children.length) before.remove();
  if (section && !section.querySelector(':scope > *')) section.remove();
}

function whenNear(el) {
  if (!('IntersectionObserver' in window)) return Promise.resolve();
  return new Promise((resolve) => {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        resolve();
      }
    }, { rootMargin: '600px 0px' });
    io.observe(el);
  });
}

async function fetchHits(url, body) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`more like this: ${resp.status}`);
  const json = await resp.json();
  return json?.hits?.hits || [];
}

export default function decorate(block) {
  const config = readConfig(block);
  const parsed = parseInt(config.count || config.numberofresults, 10);
  const wanted = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULTS.count;
  const count = Math.min(wanted, MAX_COUNT);
  const contentType = config.contenttype || '';
  const url = config.searchapiurl || DEFAULTS.searchApiUrl;

  const { namespace, id } = pageKey(window.location.pathname);
  const lang = searchLanguage(namespace);
  const title = document.querySelector('meta[property="og:title"]')?.content
    || document.querySelector('h1')?.textContent || document.title;
  const text = pageText(block);

  block.textContent = '';
  block.lang = lang;
  block.append(placeholders(count));
  block.style.setProperty('--search-mlt-count', Math.min(count, 3));

  /*
   * Not awaited: EDS keeps a section hidden until its blocks have decorated, so
   * waiting here for the block to scroll into view would never end.
   */
  whenNear(block).then(async () => {
    let hits = [];
    try {
      hits = await fetchHits(url, requestBody({
        namespace, id, text, count, contentType,
      }));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(e);
    }
    const picked = pickHits(hits, { count, title, path: window.location.pathname });
    if (!picked.length) {
      withdraw(block);
      return;
    }
    const list = document.createElement('ul');
    list.className = 'search-mlt-suggestions-list';
    picked.forEach((hit) => list.append(renderCard(hit, lang)));
    block.replaceChildren(list);
  });
}
