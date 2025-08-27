/*
 * Column Embed Block
 * Show multiple embeds arranged in columns
 */

import decorateEmbed from '../embed/embed.js';

export default function decorate(block) {
  // Get all links from the block
  const links = [...block.querySelectorAll('a')];
  const columnCount = 3;
  block.textContent = '';

  // Create array of column indices and map them to columns
  Array.from({ length: columnCount }).forEach((_, columnIndex) => {
    const column = document.createElement('div');

    // Get all links for this column (every 3rd link)
    const columnLinks = links.filter((link, index) => index % columnCount === columnIndex);

    // Create embed blocks for each link in the column
    columnLinks.forEach((link) => {
      const cell = document.createElement('div');
      const embedBlock = document.createElement('div');
      embedBlock.className = 'block embed';

      // Create link element
      const newLink = document.createElement('a');
      newLink.href = link.href;
      newLink.textContent = link.href;
      embedBlock.appendChild(newLink);

      // Decorate the embed block using the original embed block's logic
      decorateEmbed(embedBlock);
      cell.appendChild(embedBlock);
      column.appendChild(cell);
    });

    block.appendChild(column);
  });
}
