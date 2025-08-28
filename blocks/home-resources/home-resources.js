/**
 * Decorates the home-resources block
 * made with mars water crystals by ur boy frank
 */

export default function decorate(block) {
  // Check if the block exists and has child elements
  if (!block || !block.children || !block.children.length) {
    // console.warn('No content found in frank-resources block');
    return;
  }

  // Create a wrapper div for the resources grid
  const wrapper = document.createElement('div');
  wrapper.className = 'resources-grid';

  // Process each row in the block
  Array.from(block.children).forEach((row) => {
    // Skip rows that don't have at least two columns
    if (!row.children || row.children.length < 2) return;

    // Create a card element that will be a clickable link
    const card = document.createElement('a');
    const imgCol = row.children[0]; // First column contains the image
    const contentCol = row.children[1]; // Second column contains the content

    // Find the link in the content column and use its href for the card
    const link = contentCol.querySelector('a');
    if (!link) return; // Skip this row if no link is found
    card.href = link.href;

    // Create image wrapper and add the image if it exists
    const imgWrapper = document.createElement('div');
    imgWrapper.className = 'card-image';
    const img = imgCol.querySelector('img');
    if (img) {
      imgWrapper.appendChild(img.cloneNode(true)); // Clone to avoid moving the original
    }

    // Create content wrapper and populate with title and description
    const content = document.createElement('div');
    content.className = 'card-content';

    // Use link text as the card title
    const title = document.createElement('h3');
    title.textContent = link.textContent;

    // Use paragraph text as the card description
    const desc = document.createElement('p');
    const paragraph = contentCol.querySelector('p');
    if (paragraph) {
      desc.textContent = paragraph.textContent;
    }

    // Assemble the content section
    content.appendChild(title);
    content.appendChild(desc);

    // Assemble the complete card and add to the grid
    card.className = 'resource-card';
    card.appendChild(imgWrapper);
    card.appendChild(content);

    wrapper.appendChild(card);
  });

  // Replace the block's content with the new grid
  block.textContent = '';
  block.appendChild(wrapper);
}
