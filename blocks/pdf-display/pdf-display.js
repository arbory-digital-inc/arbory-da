/**
 * PDF Display Block
 * Fetches PDF metadata from the DAM servlet and renders a styled card grid.
 * Content model: single row with a filepath value (e.g. /content/dam/meetup/pdf)
 * @param {HTMLElement} block The block element
 */

const SERVLET_PATH = '/services/damservlet?path=';
const RENDITION_NAME = 'cq5dam.web.1280.1280.jpeg';

// When running locally, proxy servlet calls to the dev environment
const DEV_ORIGIN = 'https://blog-dev.arborydigital.com';

/**
 * Build the full servlet URL. On localhost the request is routed
 * to the dev CDN so the backend servlet is reachable.
 * @param {string} filepath DAM path (e.g. /content/dam/meetup/pdf)
 * @returns {string}
 */
function getServletUrl(filepath) {
  const isLocal = window.location.hostname === 'localhost'
    || window.location.hostname === '127.0.0.1';
  const origin = isLocal ? DEV_ORIGIN : '';
  return `${origin}${SERVLET_PATH}${encodeURIComponent(filepath)}`;
}

/**
 * Extract the filepath value from the authored block content.
 * The block table has a single row: | filepath | /content/dam/... |
 * @param {HTMLElement} block
 * @returns {string|null}
 */
function getFilepath(block) {
  const rows = [...block.children];
  for (const row of rows) {
    const cells = [...row.children];
    if (cells.length >= 2) {
      const key = cells[0].textContent.trim().toLowerCase();
      if (key === 'filepath') {
        return cells[1].textContent.trim();
      }
    }
  }
  return null;
}

/**
 * Find the web rendition image path from a PDF's renditions array.
 * @param {Array} renditions
 * @returns {string|null}
 */
function getImagePath(renditions) {
  if (!renditions || !Array.isArray(renditions)) return null;
  const rendition = renditions.find((r) => r.name === RENDITION_NAME);
  return rendition ? rendition.path : null;
}

/**
 * Format file size in bytes to megabytes with single-digit precision.
 * @param {string|number} bytes - File size in bytes
 * @returns {string} Formatted size (e.g., "19.7 MB")
 */
function formatSizeInMB(bytes) {
  const numBytes = Number(bytes);
  if (Number.isNaN(numBytes) || numBytes <= 0) return '';
  const mb = numBytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

/**
 * Create a single PDF card element.
 * @param {Object} pdf - PDF metadata object from the servlet
 * @returns {HTMLElement}
 */
function createPdfCard(pdf) {
  const li = document.createElement('li');
  li.className = 'pdf-display-item';

  const card = document.createElement('article');
  card.className = 'pdf-display-card';

  // Image / thumbnail
  const imagePath = getImagePath(pdf.renditions);
  if (imagePath) {
    const imageLink = document.createElement('a');
    imageLink.className = 'pdf-display-image-link';
    imageLink.href = pdf.path;
    imageLink.target = '_blank';
    imageLink.rel = 'noopener noreferrer';
    imageLink.title = pdf.title || 'Download PDF';

    const img = document.createElement('img');
    img.src = imagePath;
    img.alt = pdf.title || 'PDF preview';
    img.loading = 'lazy';
    imageLink.append(img);
    card.append(imageLink);
  }

  // Content container
  const content = document.createElement('div');
  content.className = 'pdf-display-content';

  // Title
  if (pdf.title) {
    const titleLink = document.createElement('a');
    titleLink.className = 'pdf-display-title-link';
    titleLink.href = pdf.path;
    titleLink.target = '_blank';
    titleLink.rel = 'noopener noreferrer';

    const title = document.createElement('h3');
    title.className = 'pdf-display-title';
    title.textContent = pdf.title;
    titleLink.append(title);
    content.append(titleLink);
  }

  // Description
  const description = pdf['dc:description'];
  if (description) {
    const desc = document.createElement('p');
    desc.className = 'pdf-display-description';
    desc.textContent = description;
    content.append(desc);
  }

  // PDF badge
  const badge = document.createElement('span');
  badge.className = 'pdf-display-badge';
  const sizeStr = formatSizeInMB(pdf['dam:size']);
  badge.textContent = sizeStr ? `PDF | ${sizeStr}` : 'PDF';
  content.append(badge);

  card.append(content);
  li.append(card);
  return li;
}

/**
 * Render error state.
 * @param {HTMLElement} block
 * @param {string} message
 */
function renderError(block, message) {
  const errorEl = document.createElement('div');
  errorEl.className = 'pdf-display-error';
  errorEl.textContent = message;
  block.replaceChildren(errorEl);
}

/**
 * Render empty state.
 * @param {HTMLElement} block
 */
function renderEmpty(block) {
  const emptyEl = document.createElement('div');
  emptyEl.className = 'pdf-display-empty';
  emptyEl.textContent = 'No PDF files found.';
  block.replaceChildren(emptyEl);
}

/**
 * Main decoration function.
 * @param {HTMLElement} block
 */
export default async function decorate(block) {
  const filepath = getFilepath(block);

  if (!filepath) {
    renderError(block, 'No filepath configured for PDF display.');
    return;
  }

  // Build the servlet URL (routes to dev origin on localhost)
  const servletUrl = getServletUrl(filepath);

  // Clear authored content
  block.textContent = '';

  // Loading state
  const loader = document.createElement('div');
  loader.className = 'pdf-display-loading';
  loader.textContent = 'Loading PDFs…';
  block.append(loader);

  try {
    const response = await fetch(servletUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDFs (${response.status})`);
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      renderEmpty(block);
      return;
    }

    // Build card grid
    const ul = document.createElement('ul');
    ul.className = 'pdf-display-list';

    data.forEach((pdf) => {
      ul.append(createPdfCard(pdf));
    });

    block.replaceChildren(ul);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('PDF Display block error:', error);
    renderError(block, 'Unable to load PDF files. Please try again later.');
  }
}
