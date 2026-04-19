/**
 * Tag Browser Block
 * Displays all pages from the site index matching a given tag query parameter.
 * Usage: Place this block on a page, then navigate to that page with ?tag=your+tag
 * Tag matching is case-insensitive to handle free-form taxonomy variations.
 * @param {HTMLElement} block The block element
 */

import { getConfig } from '../../scripts/nx.js';
import createPicture from '../../scripts/utils/picture.js';
import { getLanguageIndex } from '../../scripts/lang.js';

const CARDS_PER_PAGE = 12;
const CARDS_PER_LOAD = 6;

function formatDate(dateString) {
  if (!dateString) return null;
  const estDateString = `${dateString}T12:00:00-05:00`;
  const date = new Date(estDateString);
  if (Number.isNaN(date.getTime())) {
    const fallback = new Date(dateString);
    if (Number.isNaN(fallback.getTime())) return null;
    return fallback.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getTagFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const tag = params.get('tag');
  return tag ? tag.trim() : null;
}

function filterByTag(tag, data) {
  const tagLower = tag.toLowerCase();
  return data.filter((item) => {
    if (!item.tags || !Array.isArray(item.tags)) return false;
    return item.tags.some((t) => t.toLowerCase() === tagLower);
  });
}

function sortByDate(data) {
  return data.sort((a, b) => {
    if (a.date && b.date) {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      if (!Number.isNaN(dateA.getTime()) && !Number.isNaN(dateB.getTime())) {
        return dateB - dateA;
      }
    }
    if (a.lastModified && b.lastModified) {
      return b.lastModified - a.lastModified;
    }
    return 0;
  });
}

function createArticleCard(item) {
  const card = document.createElement('article');
  card.className = 'tag-browser-card';

  if (item.image) {
    const imageLink = document.createElement('a');
    imageLink.href = item.path;
    imageLink.className = 'tag-browser-card-image';
    imageLink.title = item.title;
    const pic = createPicture({ src: item.image, breakpoints: [{ width: '750' }] });
    imageLink.append(pic);
    card.append(imageLink);
  }

  const content = document.createElement('div');
  content.className = 'tag-browser-card-content';

  if (item.category) {
    const category = document.createElement('span');
    category.className = 'tag-browser-card-category';
    category.textContent = item.category;
    content.append(category);
  }

  const titleEl = document.createElement('h3');
  titleEl.className = 'tag-browser-card-title';
  const titleLink = document.createElement('a');
  titleLink.href = item.path;
  titleLink.title = item.title;
  titleLink.textContent = item.title || 'Untitled';
  titleEl.append(titleLink);
  content.append(titleEl);

  if (item.description) {
    const desc = document.createElement('p');
    desc.className = 'tag-browser-card-description';
    desc.textContent = item.description;
    content.append(desc);
  }

  const meta = document.createElement('div');
  meta.className = 'tag-browser-card-meta';

  if (item.author) {
    const author = document.createElement('span');
    author.className = 'tag-browser-card-author';
    author.textContent = item.author;
    meta.append(author);
  }

  if (item.date) {
    const date = document.createElement('span');
    date.className = 'tag-browser-card-date';
    date.textContent = formatDate(item.date);
    meta.append(date);
  }

  content.append(meta);

  if (item.tags && Array.isArray(item.tags)) {
    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'tag-browser-card-tags';
    const limitedTags = item.tags
      .sort((a, b) => a.length - b.length || a.localeCompare(b))
      .slice(0, 5);
    limitedTags.forEach((tagText) => {
      if (tagText) {
        const tagEl = document.createElement('a');
        tagEl.className = 'tag-browser-tag';
        tagEl.textContent = tagText;
        const tagParam = encodeURIComponent(tagText);
        tagEl.href = `${window.location.pathname}?tag=${tagParam}`;
        tagsContainer.append(tagEl);
      }
    });
    content.append(tagsContainer);
  }

  card.append(content);
  return card;
}

function renderCards(container, items, startIndex, count) {
  const end = Math.min(startIndex + count, items.length);
  const batch = items.slice(startIndex, end);

  batch.forEach((item, index) => {
    const card = createArticleCard(item);
    card.style.opacity = '0';
    container.append(card);

    // eslint-disable-next-line no-unused-expressions
    card.offsetWidth;

    setTimeout(() => {
      card.classList.add('fade-in');
      card.style.animationDelay = `${0.05 * index}s`;
    }, 10);
  });

  return end;
}

export default async function decorate(block) {
  const { locale } = getConfig();
  const tag = getTagFromUrl();

  block.textContent = '';

  if (!tag) {
    const noTag = document.createElement('div');
    noTag.className = 'tag-browser-empty';
    noTag.textContent = 'No tag specified. Add a ?tag= parameter to the URL to browse articles by tag.';
    block.append(noTag);
    return;
  }

  // Header with tag name
  const header = document.createElement('div');
  header.className = 'tag-browser-header';

  const heading = document.createElement('h2');
  heading.className = 'tag-browser-heading';
  heading.textContent = `Articles tagged: "${tag}"`;
  header.append(heading);
  block.append(header);

  // Loading indicator
  const loading = document.createElement('div');
  loading.className = 'tag-browser-loading';
  loading.textContent = 'Loading articles…';
  block.append(loading);

  try {
    const indexPath = getLanguageIndex();
    const resp = await fetch(`${locale.base}${indexPath}`);
    if (!resp.ok) throw new Error(`Failed to fetch index: ${indexPath}`);

    const { data } = await resp.json();

    // Filter by tag (case-insensitive)
    let filtered = filterByTag(tag, data);

    // Remove duplicates and exclude current page
    const uniquePaths = new Set();
    const currentPath = window.location.pathname;
    filtered = filtered.filter((item) => {
      if (!item.path || uniquePaths.has(item.path)) return false;
      if (item.path === currentPath) return false;
      uniquePaths.add(item.path);
      return true;
    });

    filtered = sortByDate(filtered);

    // Remove loading indicator
    loading.remove();

    // Result count
    const countEl = document.createElement('p');
    countEl.className = 'tag-browser-count';
    countEl.textContent = `${filtered.length} article${filtered.length !== 1 ? 's' : ''} found`;
    header.append(countEl);

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'tag-browser-empty';
      empty.textContent = `No articles found with the tag "${tag}".`;
      block.append(empty);
      return;
    }

    // Card grid
    const grid = document.createElement('div');
    grid.className = 'tag-browser-grid';
    block.append(grid);

    // Render initial batch
    let shown = renderCards(grid, filtered, 0, CARDS_PER_PAGE);

    // Load more button
    if (filtered.length > shown) {
      const loadMoreContainer = document.createElement('div');
      loadMoreContainer.className = 'tag-browser-load-more';

      const loadMoreBtn = document.createElement('button');
      loadMoreBtn.className = 'tag-browser-load-more-button';
      loadMoreBtn.textContent = 'Load More';

      loadMoreBtn.addEventListener('click', () => {
        shown = renderCards(grid, filtered, shown, CARDS_PER_LOAD);
        if (shown >= filtered.length) {
          loadMoreContainer.style.display = 'none';
        }
      });

      loadMoreContainer.append(loadMoreBtn);
      block.append(loadMoreContainer);
    }
  } catch (error) {
    loading.remove();
    const errorEl = document.createElement('div');
    errorEl.className = 'tag-browser-error';
    errorEl.textContent = 'Unable to load articles. Please try again later.';
    block.append(errorEl);
  }
}
