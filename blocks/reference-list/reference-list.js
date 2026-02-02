// CONFIGURATION
// Set to true to use local test JSON file, false to use live URL
const USE_LOCAL_JSON = true;
const LOCAL_JSON_PATH = '/tools/json/reference-list.json';
const LIVE_JSON_URL = '/en/reference-links.json';

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

  const imageUrl = item['image-url'] || item.image;
  if (imageUrl && imageUrl.trim() !== '') {
    const imageWrapper = document.createElement('div');
    imageWrapper.className = 'reference-image-wrapper';

    const image = document.createElement('img');
    image.className = 'reference-image';
    image.src = imageUrl;
    image.alt = item.title;
    image.loading = 'lazy';

    imageWrapper.appendChild(image);
    link.appendChild(imageWrapper);
  }

  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'reference-content';

  const title = document.createElement('h3');
  title.className = 'reference-title';
  title.textContent = item.title;
  contentWrapper.appendChild(title);

  if (item.tag) {
    const tag = document.createElement('span');
    tag.className = 'reference-tag';
    tag.textContent = item.tag;
    contentWrapper.appendChild(tag);
  }

  if (item.description) {
    const description = document.createElement('p');
    description.className = 'reference-description';
    description.textContent = item.description;
    contentWrapper.appendChild(description);
  }

  link.appendChild(contentWrapper);

  card.appendChild(link);
  return card;
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

    const filterContainer = document.createElement('div');
    filterContainer.className = 'reference-list-filters';

    const filterLabel = document.createElement('span');
    filterLabel.className = 'filter-label';
    filterLabel.textContent = 'Category';
    filterContainer.appendChild(filterLabel);

    const activeCategories = new Set();
    selectedCategories.forEach((cat) => activeCategories.add(cat.Category));

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'filter-buttons';

    const referencesContainer = document.createElement('div');
    referencesContainer.className = 'reference-grid';

    const updateReferenceDisplay = () => {
      const cards = referencesContainer.querySelectorAll('.reference-card');
      cards.forEach((card) => {
        const cardCategory = card.getAttribute('data-category');
        if (activeCategories.has(cardCategory)) {
          card.style.display = '';
        } else {
          card.style.display = 'none';
        }
      });
    };

    selectedCategories.forEach((cat) => {
      const categoryName = cat.Category;
      const categoryRefs = filteredReferences.filter(
        (ref) => ref.category === categoryName,
      );

      if (categoryRefs.length === 0) return;

      const button = document.createElement('button');
      button.className = 'category-filter-button active';
      button.setAttribute('data-category', categoryName);
      button.setAttribute('type', 'button');

      const icon = document.createElement('span');
      icon.className = 'filter-icon';
      icon.textContent = '−';
      button.appendChild(icon);

      const text = document.createElement('span');
      text.textContent = categoryName;
      button.appendChild(text);

      if (cat.Description) {
        button.setAttribute('title', cat.Description);
      }

      button.addEventListener('click', () => {
        if (button.classList.contains('active')) {
          button.classList.remove('active');
          icon.textContent = '+';
          activeCategories.delete(categoryName);
        } else {
          button.classList.add('active');
          icon.textContent = '−';
          activeCategories.add(categoryName);
        }
        updateReferenceDisplay();
      });

      buttonContainer.appendChild(button);
    });

    filterContainer.appendChild(buttonContainer);

    filteredReferences.forEach((ref) => {
      const card = createReferenceCard(ref);
      card.setAttribute('data-category', ref.category);
      referencesContainer.appendChild(card);
    });

    block.appendChild(filterContainer);
    block.appendChild(referencesContainer);
  } catch (error) {
    block.innerHTML = `<div class="reference-list-error">Unable to load references: ${error.message}</div>`;
  }
}
