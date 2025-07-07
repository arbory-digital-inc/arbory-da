import { getConfig } from '../../scripts/nx.js';
import createPicture from '../../scripts/utils/picture.js';

// CONFIGURATION
// Set to true to use test JSON file, false to use live index
const USE_TEST_FILE = false;

// Get language code from URL
const url = window.location.href;
const bits = url.split("/");
const langcode = bits[3] || 'en'; // Default to 'en' if not found

// Define paths for data
const QUERY_PATH = `/${langcode}-index.json`;
const TEST_PATH = '/en-index-test.json'; // Always use en-index-test.json for testing
const AUTHOR_PATH = USE_TEST_FILE ? TEST_PATH : `/${langcode}-index.json`;

// Define available categories and their paths
const CATEGORIES = {
  'AEM Technical Help': '/blog',
  'AEM News': '/blog',
  'Arbory Digital News': '/blog',
  'Customer Stories': '/customer-stories',
  'Podcasts': '/podcast'
};

// Map category input to metadata values
const CATEGORY_METADATA_MAP = {
  'podcast': 'Podcast',
  'podcasts': 'Podcast',
  'aem technical help': 'Technical',
  'aem news': 'News',
  'arbory digital news': 'Arbory News',
  'customer stories': 'Customer Story'
};

let fetchingAuthors;

function formatDate(dateString) {
  if (!dateString) return null;
  
  // Parse the date string and force Eastern Standard Time interpretation
  // Add 'T12:00:00-05:00' to ensure it's interpreted as noon EST
  // This prevents timezone-related date shifting
  const estDateString = dateString + 'T12:00:00-05:00';
  const date = new Date(estDateString);
  
  // Check if the date is valid
  if (isNaN(date.getTime())) {
    // Fallback to original parsing if our EST approach fails
    const fallbackDate = new Date(dateString);
    if (isNaN(fallbackDate.getTime())) {
      return null;
    }
    // Format the fallback date
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return fallbackDate.toLocaleDateString('en-US', options);
  }
  
  // Format the date as "Apr 4, 2023"
  const options = { month: 'short', day: 'numeric', year: 'numeric' };
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
        console.log(`Could not fetch authors from: ${locale.base}${AUTHOR_PATH}`);
        resolve([]);
      }
    }).catch(err => {
      console.error('Error fetching authors:', err);
      resolve([]);
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
    block.classList.contains('card-2') || 
    block.classList.contains('card-3') || 
    block.classList.contains('card-4')
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
      
      // Create author-date container
      const authorDateContainer = document.createElement('div');
      authorDateContainer.className = 'article-feed-author-date-container';
      
      // Create author element and add to container
      if (item.author) {
        const author = createAuthorEl(item);
        author.className = 'article-feed-article-author-wrapper';
        authorDateContainer.append(author);
      }
      
      // Create date element and add to container
      if (item.date) {
        // Add separator if author exists
        if (item.author) {
          const separator = document.createElement('span');
          separator.className = 'article-feed-separator';
          separator.innerHTML = '|';
          authorDateContainer.append(separator);
        }
        
        const date = document.createElement('span');
        date.className = 'article-feed-article-date';
        date.innerText = formatDate(item.date);
        authorDateContainer.append(date);
      }
      
      // Add the author-date container to the content column
      contentColumn.append(authorDateContainer);
      
      // Create tags container if tags exist and add below author-date
      if (item.tags) {
        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'article-feed-tags';
        
        const tags = item.tags.split(',').map(tag => tag.trim());
        tags.forEach(tag => {
          if (tag) {
            const tagEl = document.createElement('span');
            tagEl.className = 'article-feed-tag';
            tagEl.textContent = tag;
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
      
      // Create author-date container for the row
      const authorDateContainer = document.createElement('div');
      authorDateContainer.className = 'article-feed-author-date-container';
      
      // Create author element and add to container
      if (item.author) {
        const author = createAuthorEl(item);
        author.className = 'article-feed-article-author-wrapper';
        authorDateContainer.append(author);
      }
      
      // Create date element and add to container
      if (item.date) {
        // Add separator if author exists
        if (item.author) {
          const separator = document.createElement('span');
          separator.className = 'article-feed-separator';
          separator.innerHTML = '|';
          authorDateContainer.append(separator);
        }
        
        const date = document.createElement('span');
        date.className = 'article-feed-article-date';
        date.innerText = formatDate(item.date);
        authorDateContainer.append(date);
      }
      
      // Add the author-date container to the left column
      leftColumn.append(authorDateContainer);
      
      // Create tags container if tags exist and add to right column
      if (item.tags) {
        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'article-feed-tags';
        
        const tags = item.tags.split(',').map(tag => tag.trim());
        tags.forEach(tag => {
          if (tag) {
            const tagEl = document.createElement('span');
            tagEl.className = 'article-feed-tag';
            tagEl.textContent = tag;
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

function filterFeed(filter, data) {
  if (!filter) return data;
  
  // Check if filter is a string or an object
  let key, search;
  
  if (typeof filter === 'string') {
    const split = filter.split(' = ');
    key = split[0];
    search = split[1] === 'no' ? '' : split[1];
  } else if (typeof filter === 'object') {
    key = filter.key;
    search = filter.text;
  } else {
    return data;
  }

  // Handle category filtering
  if (key === 'category') {
    return filterByCategories(search, data);
  }
  
  // Handle tags filtering
  if (key === 'tags') {
    return filterByTags(search, data);
  }
  
  return data.reduce((acc, article) => {
    // featured must be an exact match
    if (key === 'featured' && article[key] === search) {
      acc.push(article);
    } else if (key === 'author' && article[key].includes(search)) {
      acc.push(article);
    }
    return acc;
  }, []);
}

function filterByCategories(categoryString, data) {
  if (!categoryString) return data;
  
  // Convert to lowercase for case-insensitive comparison
  const categoryStringLower = categoryString.toLowerCase();
  
  // Split categories by comma and trim whitespace
  const categories = categoryStringLower.split(',').map(cat => cat.trim());
  
  const filtered = data.filter(article => {
    // Only use the article's explicit category field for matching
    if (!article.category) return false;
    
    const articleCategory = article.category.toLowerCase();
    
    // Check if any of our selected categories match this article's category
    for (const category of categories) {
      // Direct match with the category
      if (articleCategory === category) {
        return true;
      }
      
      // Check using the category mapping
      const mappedCategory = CATEGORY_METADATA_MAP[category];
      if (mappedCategory && articleCategory === mappedCategory.toLowerCase()) {
        return true;
      }
      
      // Check if the category is a substring of the article category (for broader categories)
      if (category === 'aem technical help' && articleCategory === 'aem technical help') {
        return true;
      }
      
      if (category === 'aem news' && articleCategory === 'aem news') {
        return true;
      }
      
      if (category === 'arbory digital news' && articleCategory === 'arbory digital news') {
        return true;
      }
      
      if (category === 'podcasts' && articleCategory === 'podcasts') {
        return true;
      }
    }
    
    // If we get here, no category matched
    return false;
  });
  
  return filtered;
}

function filterByTags(tagString, data) {
  if (!tagString) return data;
  
  // Split tags by comma and trim whitespace
  const tags = tagString.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag !== '');
  
  if (tags.length === 0) {
    return data;
  }
  
  const filtered = data.filter(article => {
    // Skip articles without tags
    if (!article.tags) {
      return false;
    }
    
    // Convert article tags to array
    const articleTags = article.tags.split(',').map(tag => tag.trim().toLowerCase());
    
    // Check if any of the article tags match any of the filter tags
    return tags.some(tag => articleTags.includes(tag));
  });
  
  return filtered;
}

function sortFeed(data) {
  return data.sort((a, b) => {
    // First compare by date (descending)
    if (a.date && b.date) {
      // Convert string dates to Date objects for comparison
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      
      // Check if dates are valid before comparing
      if (!isNaN(dateA) && !isNaN(dateB)) {
        return dateB - dateA; // Descending order (newer first)
      }
    }
    
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
  
  try {
    // Determine which JSON file to use based on configuration
    const jsonPath = USE_TEST_FILE ? TEST_PATH : QUERY_PATH;
    
    // Fetch the appropriate JSON file
    const resp = await fetch(`${locale.base}${jsonPath}`);
    
    if (!resp.ok) {
      throw new Error(`Could not fetch ${USE_TEST_FILE ? 'test' : 'live'} index: ${jsonPath}`);
    }
    
    console.log(`Successfully loaded JSON from: ${locale.base}${jsonPath}`);

    // Kick off the author request
    fetchAuthors();

    const { data } = await resp.json();
    
    const sorted = sortFeed(data);
    
    // Apply filters based on block metadata
    let filtered = sorted;
    
    // Filter by category if specified
    if (blockMeta.category) {
      filtered = filterByCategories(blockMeta.category.text, filtered);
    }
    
    // Filter by tags if specified
    if (blockMeta.tags) {
      filtered = filterByTags(blockMeta.tags.text, filtered);
    }
    
    // Remove any duplicate articles that might have been introduced during filtering
    const uniquePaths = new Set();
    filtered = filtered.filter(item => {
      if (uniquePaths.has(item.path)) {
        return false;
      }
      uniquePaths.add(item.path);
      return true;
    });
    
    // Limit number of cards if specified
    let numCards = blockMeta['number of cards'] ? 
      parseInt(blockMeta['number of cards'].text, 10) : 
      filtered.length;
    
    // Make sure we don't request more cards than we have available
    if (numCards > filtered.length) {
      numCards = filtered.length;
    }
    
    if (!isNaN(numCards) && numCards > 0) {
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

    // Check for 'number of rows' in the block's metadata
    if (blockMeta && blockMeta['number of rows'] && blockMeta['number of rows'].text) {
      const rowValue = parseInt(blockMeta['number of rows'].text, 10);
      if (!isNaN(rowValue) && rowValue > 0) {
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
      cardsPerRow: cardsPerRow
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
            state.currentShown + state.cardsPerRow
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
                void child.offsetWidth;
                
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
          console.error('Error in load more button click handler:', error);
        }
      });
      
      loadMoreContainer.appendChild(loadMoreButton);
      el.appendChild(loadMoreContainer);
    }
    

    
  } catch (error) {
    // Keep error logging for critical errors
    console.error('Error in article-feed block:', error);
    el.innerHTML = `<div class="article-feed-error">Unable to load articles</div>`;
  }
}