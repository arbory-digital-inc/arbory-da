import { toClassName } from '../../scripts/aem.js';

// CONFIGURATION
// Set to true to use local test JSON file, false to use live URL
const USE_LOCAL_JSON = true;
const LOCAL_JSON_PATH = '/reference-list.json';
const LIVE_JSON_URL = 'https://main--arbory-da--arbory-digital-inc.aem.page/en/reference-links.json';

/**
 * Creates a reference card element
 * @param {Object} item - The reference item data
 * @returns {HTMLElement} The created card element
 */
function createReferenceCard(item) {
  const card = document.createElement('div');
  card.className = 'reference-card';

  const link = document.createElement('a');
  link.href = item.url;
  link.className = 'reference-link';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';

  const header = document.createElement('div');
  header.className = 'reference-header';

  const title = document.createElement('h3');
  title.className = 'reference-title';
  title.textContent = item.title;
  header.appendChild(title);

  if (item.tag) {
    const tag = document.createElement('span');
    tag.className = 'reference-tag';
    tag.textContent = item.tag;
    header.appendChild(tag);
  }

  link.appendChild(header);

  if (item.description) {
    const description = document.createElement('p');
    description.className = 'reference-description';
    description.textContent = item.description;
    link.appendChild(description);
  }

  card.appendChild(link);
  return card;
}

function createTabPanel(category, references) {
  const panel = document.createElement('div');
  panel.className = 'reference-list-panel';
  panel.setAttribute('role', 'tabpanel');

  const grid = document.createElement('div');
  grid.className = 'reference-grid';

  references.forEach((ref) => {
    const card = createReferenceCard(ref);
    grid.appendChild(card);
  });

  panel.appendChild(grid);
  return panel;
}

function getBlockMeta(block) {
  const meta = {};
  const rows = [...block.children];

  rows.forEach((row) => {
    if (row.children && row.children.length >= 2) {
      const key = row.children[0].textContent.trim().toLowerCase();
      const value = row.children[1].textContent.trim();
      if (key && value) {
        meta[key] = value;
      }
    }
  });

  return meta;
}

/**
 * Decorates the reference-list block
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  try {
    const blockMeta = getBlockMeta(block);
    const jsonUrl = USE_LOCAL_JSON ? LOCAL_JSON_PATH : LIVE_JSON_URL;

    const resp = await fetch(jsonUrl);
    if (!resp.ok) {
      throw new Error(`Failed to fetch data: ${resp.status}`);
    }

    const json = await resp.json();
    const { data, categories } = json;

    if (!data || !data.data || !categories || !categories.data) {
      throw new Error('Invalid JSON structure');
    }

    const references = data.data;
    const allCategories = categories.data;

    let selectedCategories = allCategories;
    if (blockMeta.categories) {
      const categoryNames = blockMeta.categories
        .split('|')
        .map((cat) => cat.trim())
        .filter((cat) => cat !== '');

      selectedCategories = allCategories.filter((cat) => categoryNames.includes(cat.Category));
    }

    let filteredReferences = references;
    if (blockMeta.tags) {
      const tags = blockMeta.tags
        .split('|')
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag !== '');

      if (tags.length > 0) {
        filteredReferences = references.filter((ref) => {
          if (!ref.tag) return false;
          const refTags = ref.tag.split('|').map((t) => t.trim().toLowerCase());
          return tags.some((tag) => refTags.includes(tag));
        });
      }
    }

    block.innerHTML = '';

    const tablist = document.createElement('div');
    tablist.className = 'reference-list-tabs';
    tablist.setAttribute('role', 'tablist');

    const panelsContainer = document.createElement('div');
    panelsContainer.className = 'reference-list-panels';

    selectedCategories.forEach((cat, index) => {
      const categoryName = cat.Category;
      const categoryId = toClassName(categoryName);

      const categoryRefs = filteredReferences.filter(
        (ref) => ref.category === categoryName,
      );

      if (categoryRefs.length === 0) return;

      const button = document.createElement('button');
      button.className = 'reference-list-tab';
      button.id = `tab-${categoryId}`;
      button.setAttribute('aria-controls', `panel-${categoryId}`);
      button.setAttribute('aria-selected', index === 0);
      button.setAttribute('role', 'tab');
      button.setAttribute('type', 'button');

      const tabTitle = document.createElement('span');
      tabTitle.className = 'tab-title';
      tabTitle.textContent = categoryName;
      button.appendChild(tabTitle);

      const tabCount = document.createElement('span');
      tabCount.className = 'tab-count';
      tabCount.textContent = categoryRefs.length;
      button.appendChild(tabCount);

      if (cat.Description) {
        button.setAttribute('title', cat.Description);
      }

      const panel = createTabPanel(categoryName, categoryRefs);
      panel.id = `panel-${categoryId}`;
      panel.setAttribute('aria-labelledby', `tab-${categoryId}`);
      panel.setAttribute('aria-hidden', index !== 0);

      button.addEventListener('click', () => {
        tablist.querySelectorAll('button').forEach((btn) => {
          btn.setAttribute('aria-selected', false);
        });
        button.setAttribute('aria-selected', true);

        panelsContainer.querySelectorAll('.reference-list-panel').forEach((p) => {
          p.setAttribute('aria-hidden', true);
        });
        panel.setAttribute('aria-hidden', false);
      });

      tablist.appendChild(button);
      panelsContainer.appendChild(panel);
    });

    block.appendChild(tablist);
    block.appendChild(panelsContainer);
  } catch (error) {
    block.innerHTML = `<div class="reference-list-error">Unable to load references: ${error.message}</div>`;
  }
}
