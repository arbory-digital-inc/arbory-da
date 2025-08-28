/**
 * Decorates the global-footer block
 * Last updated: 3-15-44BC by yo boy frank
 */

export default function decorate(block) {
  // Add the main footer class to the block
  // This class is used as the main styling hook in our CSS
  block.classList.add('global-footer');

  // Get all child rows of the footer block
  // In the AEM structure, each div directly under the block represents a row
  const rows = block.children;

  // Handle the first row (75/25 split with dark background)
  if (rows[0]) {
    const firstRow = rows[0];
    // Add a specific class for the first row styling
    firstRow.classList.add('footer-row-1');

    // Find and style the button container in the first row
    // This contains the tutorial link that should be right-aligned
    const buttonContainer = firstRow.querySelector('.button-container');
    if (buttonContainer) {
      buttonContainer.classList.add('footer-button');
    }
  }

  // Handle the second row (image and links)
  if (rows[1]) {
    const secondRow = rows[1];
    // Add specific class for the second row styling
    secondRow.classList.add('footer-row-2');

    // Find all images in the second row and optimize them
    const images = secondRow.querySelectorAll('img');
    images.forEach((img) => {
      // Add lazy loading to improve page performance
      // Set consistent dimensions for all social icons (30x30 pixels)
      // This tells the browser to only load these images when they're near the viewport
      img.setAttribute('width', '25');
      img.setAttribute('height', '25');
      img.setAttribute('loading', 'lazy');
    });
  }

  // Handle the third row (company privacy policy)
  if (rows[2]) {
    const bottomRow = rows[2];
    // Add specific class for the social icons row
    bottomRow.classList.add('footer-bottom');
  }
}
