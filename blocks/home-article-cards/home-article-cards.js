/**
 * Decorates the home-article-cards block
 * made with moon energy crystals by ur boy frank
 */

export default function decorate(block) {
  // Constants for controlling how many cards are shown initially and per click
  const CARDS_PER_LOAD = 6; // Number of cards to show when page first loads
  const CARDS_PER_CLICK = 2; // Number of cards to show when "Load More" is clicked
  let visibleCards = 0; // Tracks how many cards are currently visible
  const allRows = [...block.children]; // Convert block's children to array for easier handling

  /**
   * Transforms rows into article cards and makes them visible
   * @param {number} startIndex - Index to start showing cards from
   * @param {number} count - Number of cards to show
   * @returns {number} - The index after the last shown card
   */
  function showCards(startIndex, count) {
    // Calculate how many cards we can show without exceeding total
    const endIndex = Math.min(startIndex + count, allRows.length);
    // Get the subset of rows we want to show
    const rowsToShow = allRows.slice(startIndex, endIndex);

    rowsToShow.forEach((row) => {
      // Each row should have two columns: image and content
      const [imageCol, contentCol] = row.children;
      // Find link in content column if it exists
      const link = contentCol.querySelector('a');
      const href = link?.href;

      if (href) {
        // Create the main card link element
        const cardLink = document.createElement('a');
        cardLink.href = href;
        cardLink.className = 'article-card';

        // Create wrapper for the image section
        const imgWrapper = document.createElement('div');
        imgWrapper.className = 'article-card-image';
        imgWrapper.append(...imageCol.children); // Move all images to wrapper

        // Create wrapper for the content section
        const content = document.createElement('div');
        content.className = 'article-card-content';
        // Find the heading (any level) and description
        const heading = contentCol.querySelector('h1, h2, h3, h4, h5, h6');
        const description = contentCol.querySelector('p');

        // If heading exists, preserve its text content
        if (heading) {
          const headingText = heading.textContent;
          heading.textContent = headingText;
        }

        // Assemble the content section
        content.append(heading, description);
        // Put everything together in the card
        cardLink.append(imgWrapper, content);
        // Clear the original row and replace with our card
        row.textContent = '';
        row.append(cardLink);
        row.style.display = 'block'; // Make the row visible
      }
    });

    return endIndex; // Return the index after the last card we processed
  }

  // Initially hide all rows
  allRows.forEach((row) => {
    row.style.display = 'none';
  });

  // Show initial set of cards
  visibleCards = showCards(0, CARDS_PER_LOAD);

  // Create "Load More" button and its wrapper
  const buttonWrapper = document.createElement('div');
  buttonWrapper.className = 'load-more-wrapper';

  const loadMoreBtn = document.createElement('button');
  loadMoreBtn.className = 'load-more-button';
  loadMoreBtn.textContent = 'Load More Articles 🗎';

  // Add click handler for load more button
  loadMoreBtn.addEventListener('click', () => {
    visibleCards = showCards(visibleCards, CARDS_PER_CLICK);

    // Hide the button if we've shown all cards
    if (visibleCards >= allRows.length) {
      buttonWrapper.style.display = 'none';
    }
  });

  // Only show the "Load More" button if there are more cards to load
  if (visibleCards < allRows.length) {
    buttonWrapper.append(loadMoreBtn);
    block.append(buttonWrapper);
  }

  // Add main class to the block
  block.className = 'article-cards';
}
