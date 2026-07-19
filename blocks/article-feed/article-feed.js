/**
 * Decorates the article-feed block
 * @param {HTMLElement} block The block element
 * Updated: Fixed filterByAuthors duplicate declaration issue
 */

import { getConfig } from '../../scripts/nx.js';
import createPicture from '../../scripts/utils/picture.js';
import { getLanguage, getLanguageIndex } from '../../scripts/lang.js';

// CONFIGURATION
// Set to true to use test JSON file, false to use live index
const USE_TEST_FILE = false;

// Get language code from the localization system

// Define paths for data using the proper localization functions
const QUERY_PATH = getLanguageIndex();
const TEST_PATH = '/en-index-test.json'; // Always use en-index-test.json for testing
const AUTHOR_PATH = USE_TEST_FILE ? TEST_PATH : getLanguageIndex();



// Map category input to metadata values
const CATEGORY_METADATA_MAP = {
  podcast: 'Podcast',
  podcasts: 'Podcast',
  'aem technical help': 'Technical',
  'aem news': 'News',
  'arbory digital news': 'Arbory News',
  'customer stories': 'Customer Story',
};

let fetchingAuthors;

/**
 * Parses a date string into a Date object, handling multiple formats.
 * Supported formats include:
 *   - ISO / numeric: "2026-04-26", "2026/04/26"
 *   - Day Month Year: "1 July 2026", "26 April 2026"
 *   - Month Day, Year: "July 1, 2026", "Apr 4, 2023"
 * Dates are interpreted at noon Eastern to avoid timezone-related day shifting.
 * @param {string} dateString The raw date value from the index
 * @returns {Date|null} A valid Date, or null if it cannot be parsed
 */
function parseArticleDate(dateString) {
  if (!dateString) return null;

  const raw = String(dateString).trim();
  if (!raw) return null;

  // ISO-style dates (YYYY-MM-DD or YYYY/MM/DD): pin to noon EST to avoid
  // the date shifting a day backwards in western timezones.
  const isoMatch = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T12:00:00-05:00`;
    const date = new Date(iso);
    if (!Number.isNaN(date.getTime())) return date;
  }

  // Fall back to the native parser, which handles the textual month formats
  // like "1 July 2026" and "July 1, 2026". Appending noon local time keeps
  // these away from midnight boundaries.
  let date = new Date(`${raw} 12:00:00`);
  if (Number.isNaN(date.getTime())) {
    date = new Date(raw);
  }

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(dateString) {
  const date = parseArticleDate(dateString);
  if (!date) return null;

  // Format the date as "April 4, 2023"
  const options = { month: 'long', day: 'numeric', year: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

function fetchAuthors() {
  const { locale } = getConfig();
  fetchingAuthors = new Promise((resolve) => {
    fetch(`${locale.base}${AUTHOR_PATH}`).then(async (resp) => {
      if (resp.ok) {
        const json = await resp.json();
        resolve(json.data);
      } else {
        // console.log(`Could not fetch authors from: ${locale.base}${AUTHOR_PATH}`);
        resolve([]);
      }
    });
  });
}

async function getAuthorLink(el) {
  const authors = await fetchingAuthors;
  const found = authors.find(
    (author) => author.title.replace('Author: ', '') === el.innerText,
  );
  if (!found) return;
  el.href = found.path;
}

function createArticleLink(item, className, child) {
  const link = document.createElement('a');
  link.className = className;
  link.href = item.path;
  link.title = item.title;
  link.append(child);
  return link;
}

function createAuthorEl(item) {
  const wrapper = document.createElement('div');
  wrapper.className = 'article-feed-article-author-wrapper';
  const authors = item.author.split(' | ');
  authors.forEach((author) => {
    const authorEl = document.createElement('span');
    authorEl.className = 'article-feed-article-author';
    authorEl.innerText = author;
    wrapper.append(authorEl);
  });
  return wrapper;
}

function decorateFeed(data, opts) {
  const ul = document.createElement('ul');
  ul.className = 'article-feed-list';

  if (!data || data.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'article-feed-empty';
    emptyMessage.textContent = 'No articles found matching the selected criteria.';
    ul.appendChild(emptyMessage);
    return ul;
  }

  // Check if we're using a card variant layout (variants are applied as additional classes)
  // We need to check the block parameter, not el which isn't defined in this scope
  const block = opts.block || {};
  const isCardVariant = block.classList && (
    block.classList.contains('card-2')
    || block.classList.contains('card-3')
    || block.classList.contains('card-4')
  );

  data.forEach((item) => {
    const li = document.createElement('li');
    const article = document.createElement('article');

    li.className = 'article-feed-article';

    // Always show image in list layout
    if (item.image) {
      const pic = createPicture({ src: item.image, breakpoints: [{ width: '1000' }] });
      const imageLink = createArticleLink(item, 'article-feed-article-image-link', pic);
      article.append(imageLink);
    }

    // Create a container for the content
    const contentContainer = document.createElement('div');
    contentContainer.className = 'article-feed-content-container';

    if (isCardVariant) {
      // For card variants, use a single column layout
      const contentColumn = document.createElement('div');
      contentColumn.className = 'article-feed-content-column';

      // Create title element and its link
      const title = document.createElement('h3');
      title.className = 'article-feed-article-title';
      title.innerText = item.title || 'Untitled';
      const titleLink = createArticleLink(item, 'article-feed-article-title-link', title);

      // Add title to the content column
      contentColumn.append(titleLink);

      // Create separate containers for author and date
      const metadataContainer = document.createElement('div');
      metadataContainer.className = 'article-feed-metadata-container';

      // Create author container and add to metadata container
      if (item.author) {
        const authorContainer = document.createElement('div');
        authorContainer.className = 'article-feed-author-container';

        const author = createAuthorEl(item);
        author.className = 'article-feed-article-author-wrapper';
        authorContainer.append(author);

        metadataContainer.append(authorContainer);
      }

      // Create date container and add to metadata container
      if (item.date) {
        const dateContainer = document.createElement('div');
        dateContainer.className = 'article-feed-date-container';

        const date = document.createElement('span');
        date.className = 'article-feed-article-date';
        date.innerText = formatDate(item.date);
        dateContainer.append(date);

        metadataContainer.append(dateContainer);
      }

      // Add the metadata container to the content column
      contentColumn.append(metadataContainer);

      // Create tags container if tags exist and add below author-date
      if (item.tags) {
        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'article-feed-tags';

        const { tags } = item;
        // Sort tags by length and limit to 5
        const limitedTags = tags
          .sort((a, b) => a.length - b.length || a.localeCompare(b))
          .slice(0, 5);

        limitedTags.forEach((tag) => {
          if (tag) {
            const tagEl = document.createElement('a');
            tagEl.className = 'article-feed-tag';
            tagEl.textContent = tag;
            tagEl.href = `/${getLanguage()}/taglist?tag=${encodeURIComponent(tag)}`;
            tagsContainer.appendChild(tagEl);
          }
        });

        // Add tags below author-date if they exist
        if (tagsContainer.children.length > 0) {
          contentColumn.append(tagsContainer);
        }
      }

      // Add the content column to the container
      contentContainer.append(contentColumn);
    } else {
      // For standard list/grid layout, use the two-column layout
      // Create the left column (80% width)
      const leftColumn = document.createElement('div');
      leftColumn.className = 'article-feed-left-column';

      // Create the right column (20% width)
      const rightColumn = document.createElement('div');
      rightColumn.className = 'article-feed-right-column';

      // Create title element and its link - this will be added to the left column
      const title = document.createElement('h3');
      title.className = 'article-feed-article-title';
      title.innerText = item.title || 'Untitled';
      const titleLink = createArticleLink(item, 'article-feed-article-title-link', title);

      // Add title to the left column
      leftColumn.append(titleLink);

      // Create separate containers for author and date
      const metadataContainer = document.createElement('div');
      metadataContainer.className = 'article-feed-metadata-container';

      // Create author container and add to metadata container
      if (item.author) {
        const authorContainer = document.createElement('div');
        authorContainer.className = 'article-feed-author-container';

        const author = createAuthorEl(item);
        author.className = 'article-feed-article-author-wrapper';
        authorContainer.append(author);

        metadataContainer.append(authorContainer);
      }

      // Create date container and add to metadata container
      if (item.date) {
        const dateContainer = document.createElement('div');
        dateContainer.className = 'article-feed-date-container';

        const date = document.createElement('span');
        date.className = 'article-feed-article-date';
        date.innerText = formatDate(item.date);
        dateContainer.append(date);

        metadataContainer.append(dateContainer);
      }

      // Add the metadata container to the left column
      leftColumn.append(metadataContainer);

      // Create tags container if tags exist and add to right column
      if (item.tags) {
        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'article-feed-tags';

        const { tags } = item;
        // Sort tags by length and limit to 5
        const limitedTags = tags
          .sort((a, b) => a.length - b.length || a.localeCompare(b))
          .slice(0, 5);

        limitedTags.forEach((tag) => {
          if (tag) {
            const tagEl = document.createElement('a');
            tagEl.className = 'article-feed-tag';
            tagEl.textContent = tag;
            tagEl.href = `/${getLanguage()}/taglist?tag=${encodeURIComponent(tag)}`;
            tagsContainer.appendChild(tagEl);
          }
        });

        // Add tags to the right column if they exist
        if (tagsContainer.children.length > 0) {
          rightColumn.append(tagsContainer);
        }
      }

      // Add both columns to the content container
      contentContainer.append(leftColumn, rightColumn);
    }

    // Add the content container after the image
    article.append(contentContainer);

    // Add the completed article to the list item
    li.append(article);
    ul.append(li);
  });
  return ul;
}

function filterByAuthors(authorString, data) {
  if (!authorString) return data;

  // Split authors by comma and trim whitespace
  const authors = authorString.split(',').map((author) => author.trim().toLowerCase()).filter((author) => author !== '');
  if (authors.length === 0) {
    return data;
  }

  const filtered = data.filter((article) => {
    // Skip articles without authors
    if (!article.author) {
      return false;
    }

    // Convert article authors to array
    const articleAuthors = article.author.split(',').map((author) => author.trim().toLowerCase()).filter((author) => author !== '');

    // Check if any of the article authors match any of the filter authors
    return authors.some((author) => articleAuthors.includes(author));
  });

  return filtered;
}

function filterByCategories(categoryString, data) {
  // Define allowed paths
  const allowedPaths = ['/blog/', '/podcast/', '/customer-stories/'];

  // First filter by allowed paths - this happens regardless of category
  let filtered = data.filter((article) => {
    if (!article.path) return false;
    // Check if the article path starts with any of the allowed paths
    return allowedPaths.some((allowedPath) => {
      const lang = getLanguage();
      // Handle both with and without language prefix
      return article.path.startsWith(allowedPath)
             || article.path.startsWith(`/${lang}${allowedPath}`);
    });
  });

  // If no category specified, return path-filtered data
  if (!categoryString) return filtered;

  // Convert to lowercase for case-insensitive comparison
  const categoryStringLower = categoryString.toLowerCase();

  // Split categories by comma and trim whitespace
  const categories = categoryStringLower.split(',').map((cat) => cat.trim());

  filtered = filtered.filter((article) => {
    // Only use the article's explicit category field for matching
    if (!article.category) return false;

    // An article can list multiple categories in one comma-separated field,
    // e.g. "AEM News, Arbory Digital News". Split it so each is matched
    // individually — otherwise the whole string never equals a single category.
    const articleCategories = article.category
      .toLowerCase()
      .split(',')
      .map((cat) => cat.trim())
      .filter((cat) => cat !== '');

    // Check if any of our selected categories match any of the article's categories
    return categories.some((category) => {
      const mappedCategory = CATEGORY_METADATA_MAP[category];
      return articleCategories.some((articleCategory) => (
        // Direct match with the category
        articleCategory === category
        // Match via the category mapping (e.g. "podcasts" -> "Podcast")
        || (mappedCategory && articleCategory === mappedCategory.toLowerCase())
      ));
    });
  });

  return filtered;
}

function filterByTags(tagString, data) {
  if (!tagString) return data;

  // Split tags by comma and trim whitespace
  const tags = tagString.split(',').map((tag) => tag.trim().toLowerCase()).filter((tag) => tag !== '');
  if (tags.length === 0) {
    return data;
  }

  const filtered = data.filter((article) => {
    // Skip articles without tags
    if (!article.tags) {
      return false;
    }

    // Convert article tags to array
    const articleTags = article.tags.map((v) => v.toLowerCase());
    // console.log(articleTags);
    // console.log(article.title);
    // console.log(articleTags.includes("eds"))

    // Check if any of the article tags match any of the filter tags
    return tags.some((tag) => articleTags.includes(tag));
  });

  return filtered;
}

function sortFeed(data) {
  return data.sort((a, b) => {
    // First compare by date (descending)
    const dateA = parseArticleDate(a.date);
    const dateB = parseArticleDate(b.date);

    // Only compare when BOTH dates parsed successfully. Comparing against an
    // unparseable date would yield NaN and corrupt the overall sort order.
    if (dateA && dateB) {
      return dateB.getTime() - dateA.getTime(); // Descending order (newer first)
    }

    // A parseable date should always rank ahead of an unparseable one.
    if (dateA && !dateB) return -1;
    if (!dateA && dateB) return 1;

    // If dates are missing or equal, compare by lastModified if available
    if (a.lastModified && b.lastModified) {
      return b.lastModified - a.lastModified;
    }

    // If no valid comparison can be made, maintain original order
    return 0;
  });
}

const getBlockMeta = (el) => [...el.childNodes].reduce((rdx, row) => {
  if (row.children) {
    const key = row.children[0].textContent.trim();
    const content = row.children[1];
    if (content) {
      const text = content.textContent.trim();
      if (key && content) rdx[key] = { text };
    }
  }
  return rdx;
}, {});

export default async function init(el) {
  const { locale } = getConfig();
  const blockMeta = getBlockMeta(el);

  // Process block metadata

  // Apply card background color if specified
  if (blockMeta['card-background-color'] && blockMeta['card-background-color'].text) {
    const bgColor = blockMeta['card-background-color'].text.trim();
    // Only apply if it's a valid hex color
    if (/^#([0-9A-F]{3}){1,2}$/i.test(bgColor)) {
      el.style.setProperty('--card-background-color', bgColor);
    }
  }

  try {
    // Determine which JSON file to use based on configuration
    const jsonPath = USE_TEST_FILE ? TEST_PATH : QUERY_PATH;

    // Fetch the appropriate JSON file
    const resp = await fetch(`${locale.base}${jsonPath}`);

    if (!resp.ok) {
      throw new Error(`Could not fetch ${USE_TEST_FILE ? 'test' : 'live'} index: ${jsonPath}`);
    }

    // Kick off the author request
    fetchAuthors();

    const { data } = await resp.json();

    // const sorted = sortFeed(data);

    // Apply filters based on block metadata
    let filtered = data;

    // Filter by category if specified
    if (blockMeta.category) {
      filtered = filterByCategories(blockMeta.category.text, filtered);
    }

    // Filter by tags if specified
    if (blockMeta.tags) {
      filtered = filterByTags(blockMeta.tags.text, filtered);
    }

    if (blockMeta.authors) {
      filtered = filterByAuthors(blockMeta.authors.text, filtered);
    }

    // Remove any duplicate articles that might have been introduced during filtering
    const uniquePaths = new Set();
    const currentPath = window.location.pathname;
    filtered = filtered.filter((item) => {
      if (uniquePaths.has(item.path)) {
        return false;
      }
      if (item.path === currentPath) {
        return false;
      }
      uniquePaths.add(item.path);
      return true;
    });

    filtered = sortFeed(filtered);

    // Limit number of cards if specified
    let numCards = blockMeta['number of cards']
      ? parseInt(blockMeta['number of cards'].text, 10)
      : filtered.length;

    // Make sure we don't request more cards than we have available
    if (numCards > filtered.length) {
      numCards = filtered.length;
    }

    if (!Number.isNaN(numCards) && numCards > 0) {
      filtered = filtered.slice(0, numCards);
    }

    // Clear existing content
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }

    // We don't need to add back the metadata rows since they're only used for configuration
    // and shouldn't be displayed in the final rendered block

    // Get the number of cards per row based on the variant
    let cardsPerRow = 1; // Default for list layout
    if (el.classList.contains('card-2')) {
      cardsPerRow = 2;
    } else if (el.classList.contains('card-3')) {
      cardsPerRow = 3;
    } else if (el.classList.contains('card-4')) {
      cardsPerRow = 4;
    } else if (el.classList.contains('grid')) {
      cardsPerRow = 3; // Default grid is 3 columns
    }

    // Default to 1 row initially
    let initialRows = 1;

    // For 4-card variant, always use 2 rows initially
    if (el.classList.contains('card-4')) {
      initialRows = 2;
    } else if (blockMeta && blockMeta['number of rows'] && blockMeta['number of rows'].text) {
      // For other variants, check metadata
      const rowValue = parseInt(blockMeta['number of rows'].text, 10);
      if (!Number.isNaN(rowValue) && rowValue > 0) {
        initialRows = rowValue;
      }
    }

    // Calculate initial articles based on rows
    let initialArticles = initialRows * cardsPerRow;

    // Make sure we don't try to show more articles than available
    initialArticles = Math.min(initialArticles, filtered.length);

    // Store article data in a closure instead of in the DOM
    // This keeps the HTML clean and reduces page size
    const articleFeedState = {
      allArticles: filtered,
      currentShown: initialArticles,
      cardsPerRow,
    };

    // Store the state reference in a WeakMap for garbage collection friendliness
    if (!window.articleFeedStates) {
      window.articleFeedStates = new WeakMap();
    }
    window.articleFeedStates.set(el, articleFeedState);

    // Create a subset of articles for initial display
    const initialFiltered = filtered.slice(0, initialArticles);

    // Create and append the feed
    const opts = { block: el };
    const list = decorateFeed(initialFiltered, opts);
    el.append(list);

    // Add fade-in animation to initial articles
    const initialArticleElements = list.querySelectorAll('.article-feed-article');
    initialArticleElements.forEach((article, index) => {
      // Set initial opacity to 0 to prevent flash
      article.style.opacity = '0';

      // Force a reflow before adding the animation class
      // eslint-disable-next-line no-unused-expressions
      article.offsetWidth;

      // Add the fade-in class with staggered delay
      setTimeout(() => {
        article.classList.add('fade-in');

        // Stagger the animations for a cascade effect
        const delay = 0.1 * index; // 0.1s delay between each card
        article.style.animationDelay = `${delay}s`;
      }, 10);
    });

    // Show the load more button if there are more articles available than what's initially shown
    if (filtered.length > initialArticles) {
      const loadMoreContainer = document.createElement('div');
      loadMoreContainer.className = 'article-feed-load-more-container';

      const loadMoreButton = document.createElement('button');
      loadMoreButton.className = 'article-feed-load-more-button';

      // Support for localization
      const loadMoreText = window.placeholders?.default?.loadMore || 'Load More';
      loadMoreButton.textContent = loadMoreText;

      loadMoreButton.addEventListener('click', () => {
        try {
          // Get article feed state from WeakMap
          const state = window.articleFeedStates.get(el);

          if (!state) {
            return;
          }

          // Calculate how many more articles to show (one more row)
          const nextBatch = state.allArticles.slice(
            state.currentShown,
            state.currentShown + state.cardsPerRow,
          );

          if (nextBatch.length > 0) {
            // Create a new list with just the next batch of articles
            const newList = decorateFeed(nextBatch, { block: el });

            // Get the existing list to append to
            const existingList = el.querySelector('.article-feed-list');

            if (existingList && newList) {
              // Append each new article to the existing list with fade-in animation
              Array.from(newList.children).forEach((child, index) => {
                // Set initial opacity to 0 to prevent flash
                child.style.opacity = '0';
                existingList.appendChild(child);

                // Force a reflow before adding the animation class
                // eslint-disable-next-line no-unused-expressions
                child.offsetWidth;

                // Add the fade-in class after a small delay to ensure proper sequencing
                setTimeout(() => {
                  child.classList.add('fade-in');

                  // Stagger the animations for a cascade effect
                  const delay = 0.1 * index; // 0.1s delay between each card
                  child.style.animationDelay = `${delay}s`;
                }, 10);
              });

              // Update current shown count in our state object
              state.currentShown += nextBatch.length;

              // Hide load more button if we've shown all articles
              if (state.currentShown >= state.allArticles.length) {
                loadMoreContainer.style.display = 'none';
              }
            }
          } else {
            // No more articles to show, hide the button
            loadMoreContainer.style.display = 'none';
          }
        } catch (error) {
          // console.error('Error in load more button click handler:', error);
        }
      });

      loadMoreContainer.appendChild(loadMoreButton);
      el.appendChild(loadMoreContainer);
    }
  } catch (error) {
    // Keep error logging for critical errors
    // console.error('Error in article-feed block:', error);
    el.innerHTML = '<div class="article-feed-error">Unable to load articles</div>';
  }
}
