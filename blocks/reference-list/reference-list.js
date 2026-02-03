// CONFIGURATION
// Set to true to use local test JSON file, false to use live URL
const USE_LOCAL_JSON = false;
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

  if (item.description) {
    const description = document.createElement('p');
    description.className = 'reference-description';
    description.textContent = item.description;
    contentWrapper.appendChild(description);
  }

  if (item.tag) {
    const tags = item.tag.split('|').map((t) => t.trim()).filter((t) => t !== '');
    const tagContainer = document.createElement('div');
    tagContainer.className = 'reference-tags';

    tags.forEach((tagText) => {
      const tag = document.createElement('span');
      tag.className = 'reference-tag';
      tag.textContent = tagText;
      tagContainer.appendChild(tag);
    });

    contentWrapper.appendChild(tagContainer);
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

    const categoryGroup = document.createElement('div');
    categoryGroup.className = 'filter-group';

    const filterLabel = document.createElement('span');
    filterLabel.className = 'filter-label';
    filterLabel.textContent = 'Category';
    categoryGroup.appendChild(filterLabel);

    let selectedCategory = 'all';

    const categorySelect = document.createElement('select');
    categorySelect.className = 'category-select';

    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'All Categories';
    categorySelect.appendChild(allOption);

    selectedCategories.forEach((cat) => {
      const categoryName = cat.Category;
      const categoryRefs = filteredReferences.filter(
        (ref) => ref.category === categoryName,
      );

      if (categoryRefs.length === 0) return;

      const option = document.createElement('option');
      option.value = categoryName;
      option.textContent = categoryName;

      if (cat.Description) {
        option.setAttribute('title', cat.Description);
      }

      categorySelect.appendChild(option);
    });

    const referencesContainer = document.createElement('div');
    referencesContainer.className = 'reference-grid';

    const activeTags = new Set();

    let updateReferenceDisplay = () => {
      const cards = referencesContainer.querySelectorAll('.reference-card');
      cards.forEach((card) => {
        const cardCategory = card.getAttribute('data-category');
        const cardTagsStr = card.getAttribute('data-tags');
        const cardTags = cardTagsStr ? JSON.parse(cardTagsStr) : [];

        const categoryMatch = selectedCategory === 'all' || cardCategory === selectedCategory;
        const tagMatch = cardTags.length === 0 || cardTags.some((tag) => activeTags.has(tag));

        if (categoryMatch && tagMatch) {
          card.style.display = '';
        } else {
          card.style.display = 'none';
        }
      });
    };

    categorySelect.addEventListener('change', (e) => {
      selectedCategory = e.target.value;
      updateReferenceDisplay();
    });

    categoryGroup.appendChild(categorySelect);
    filterContainer.appendChild(categoryGroup);

    // Extract unique tags from all references
    const allTags = new Set();
    filteredReferences.forEach((ref) => {
      if (ref.tag) {
        ref.tag.split('|').forEach((tag) => {
          const trimmedTag = tag.trim();
          if (trimmedTag) {
            allTags.add(trimmedTag);
            activeTags.add(trimmedTag);
          }
        });
      }
    });

    // Create tag filters if there are tags
    if (allTags.size > 0) {
      const tagGroup = document.createElement('div');
      tagGroup.className = 'filter-group';

      const tagFilterLabel = document.createElement('span');
      tagFilterLabel.className = 'filter-label';
      tagFilterLabel.textContent = 'Tags';
      tagGroup.appendChild(tagFilterLabel);

      const tagButtonContainer = document.createElement('div');
      tagButtonContainer.className = 'filter-buttons';

      Array.from(allTags).sort().forEach((tagName) => {
        const button = document.createElement('button');
        button.className = 'category-filter-button active';
        button.setAttribute('data-tag', tagName);
        button.setAttribute('type', 'button');

        const icon = document.createElement('span');
        icon.className = 'filter-icon';
        icon.textContent = '−';
        button.appendChild(icon);

        const text = document.createElement('span');
        text.textContent = tagName;
        button.appendChild(text);

        button.addEventListener('click', () => {
          if (button.classList.contains('active')) {
            button.classList.remove('active');
            icon.textContent = '+';
            activeTags.delete(tagName);
          } else {
            button.classList.add('active');
            icon.textContent = '−';
            activeTags.add(tagName);
          }
          updateReferenceDisplay();
        });

        tagButtonContainer.appendChild(button);
      });

      tagGroup.appendChild(tagButtonContainer);
      filterContainer.appendChild(tagGroup);
    }

    const INITIAL_ITEMS = 15;
    const LOAD_MORE_ITEMS = 10;
    let currentlyShowing = 0;
    const allCards = [];

    filteredReferences.forEach((ref) => {
      const card = createReferenceCard(ref);
      card.setAttribute('data-category', ref.category);

      const cardTags = ref.tag ? ref.tag.split('|').map((t) => t.trim()) : [];
      card.setAttribute('data-tags', JSON.stringify(cardTags));

      card.style.display = 'none';
      referencesContainer.appendChild(card);
      allCards.push(card);
    });

    const showMoreContainer = document.createElement('div');
    showMoreContainer.className = 'show-more-container';

    const showMoreButton = document.createElement('button');
    showMoreButton.className = 'show-more-button';
    showMoreButton.textContent = 'Show More';
    showMoreButton.setAttribute('type', 'button');

    const showMoreItems = () => {
      const itemsToShow = currentlyShowing === 0 ? INITIAL_ITEMS : LOAD_MORE_ITEMS;
      const endIndex = Math.min(currentlyShowing + itemsToShow, allCards.length);
      let animationIndex = 0;

      for (let i = currentlyShowing; i < endIndex; i += 1) {
        const card = allCards[i];
        const cardCategory = card.getAttribute('data-category');
        const cardTagsStr = card.getAttribute('data-tags');
        const cardTags = cardTagsStr ? JSON.parse(cardTagsStr) : [];

        const categoryMatch = selectedCategory === 'all' || cardCategory === selectedCategory;
        const tagMatch = cardTags.length === 0 || cardTags.some((tag) => activeTags.has(tag));

        if (categoryMatch && tagMatch) {
          card.style.display = '';
          card.classList.remove('fade-in');

          setTimeout(() => {
            card.classList.add('fade-in');
          }, animationIndex * 50);

          animationIndex += 1;
        }
      }

      currentlyShowing = endIndex;

      if (currentlyShowing >= allCards.length) {
        showMoreButton.style.display = 'none';
      }
    };

    showMoreButton.addEventListener('click', showMoreItems);
    showMoreContainer.appendChild(showMoreButton);

    updateReferenceDisplay = () => {
      let visibleCount = 0;
      allCards.forEach((card) => {
        const cardCategory = card.getAttribute('data-category');
        const cardTagsStr = card.getAttribute('data-tags');
        const cardTags = cardTagsStr ? JSON.parse(cardTagsStr) : [];

        const categoryMatch = selectedCategory === 'all' || cardCategory === selectedCategory;
        const tagMatch = cardTags.length === 0 || cardTags.some((tag) => activeTags.has(tag));

        if (categoryMatch && tagMatch && visibleCount < currentlyShowing) {
          card.style.display = '';
          card.classList.add('fade-in');
          visibleCount += 1;
        } else {
          card.style.display = 'none';
        }
      });

      // Show/hide the "Show More" button based on filtered results
      const totalMatchingCards = allCards.filter((card) => {
        const cardCategory = card.getAttribute('data-category');
        const cardTagsStr = card.getAttribute('data-tags');
        const cardTags = cardTagsStr ? JSON.parse(cardTagsStr) : [];
        const categoryMatch = selectedCategory === 'all' || cardCategory === selectedCategory;
        const tagMatch = cardTags.length === 0 || cardTags.some((tag) => activeTags.has(tag));
        return categoryMatch && tagMatch;
      }).length;

      if (visibleCount >= totalMatchingCards) {
        showMoreButton.style.display = 'none';
      } else {
        showMoreButton.style.display = '';
      }
    };

    showMoreItems();

    block.appendChild(filterContainer);
    block.appendChild(referencesContainer);
    block.appendChild(showMoreContainer);
  } catch (error) {
    block.innerHTML = `<div class="reference-list-error">Unable to load references: ${error.message}</div>`;
  }
}
