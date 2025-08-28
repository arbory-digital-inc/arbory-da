/**
 * Decorates the blog-post-hero block
 * cryptid energy channeled directly into code by ur boy frank
 */

import { getMetadata } from '../../scripts/aem.js';

// Helper function for animated radial gradient background
function setupAnimatedBackground(section, isLargeScreen) {
  if (isLargeScreen.matches) {
    // Add CSS keyframes and pseudo-element styles if not already added
    if (!document.querySelector('#hero-pulse-animation')) {
      const style = document.createElement('style');
      style.id = 'hero-pulse-animation';
      style.textContent = `
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        
        .hero-animated-bg::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(
            circle at 20% 80%, 
            rgba(98, 168, 20, 0.3) 0%, 
            transparent 50%
          ),
          radial-gradient(
            circle at 80% 20%, 
            rgba(64, 110, 12, 0.4) 0%, 
            transparent 50%
          );
          animation: pulse 8s ease-in-out infinite;
          z-index: -1;
        }
      `;
      document.head.appendChild(style);
    }

    // Add the animated background class and ensure relative positioning
    section.classList.add('hero-animated-bg');
    section.style.position = 'relative';
  } else {
    section.classList.remove('hero-animated-bg');
    section.style.position = '';
  }
}

export default function decorate(block) {
  // Get the background image from the first picture element in the section
  const section = block.closest('.section');
  const backgroundPicture = section.querySelector('.default-content-wrapper picture');

  // Get metadata
  const title = getMetadata('og:title') || document.querySelector('h1')?.textContent || '';
  const tags = getMetadata('article:tag') || getMetadata('tags') || '';
  const author = getMetadata('author') || '';
  const publishDate = getMetadata('date') || getMetadata('article:date');
  const metaImage = getMetadata('image') || getMetadata('og:image') || '';

  // Clear the block content
  block.innerHTML = '';

  // Set animated radial gradient background for large screens
  if (window.innerWidth >= 1100) {
    const isLargeScreen = window.matchMedia('(min-width: 1100px)');

    const setupBackgroundBound = () => setupAnimatedBackground(section, isLargeScreen);

    // Initial setup
    setupBackgroundBound();

    // Update on resize
    isLargeScreen.addEventListener('change', setupBackgroundBound);

    // Hide the original picture element if it exists
    if (backgroundPicture) {
      backgroundPicture.style.display = 'none';
    }
  }

  // Create the main container
  const container = document.createElement('div');
  container.className = 'blog-post-hero-content';
  container.style.maxWidth = '100%';
  container.style.width = '100%';
  container.style.boxSizing = 'border-box';

  // Create content column first (needed for image onload handler)
  const contentCol = document.createElement('div');
  contentCol.className = 'hero-content-col';
  contentCol.style.maxWidth = '100%';
  contentCol.style.boxSizing = 'border-box';

  // Create image column (80% width)
  const imageCol = document.createElement('div');
  imageCol.className = 'hero-image-col';
  imageCol.style.maxWidth = '100%';
  imageCol.style.boxSizing = 'border-box';

  if (metaImage) {
    const img = document.createElement('img');
    img.src = metaImage;
    img.alt = title;
    img.loading = 'eager';
    img.style.maxWidth = '100%';
    img.style.width = '100%';
    img.style.boxSizing = 'border-box';

    // Detect aspect ratio when image loads
    img.onload = function handleImageLoad() {
      const aspectRatio = this.naturalWidth / this.naturalHeight;

      // Determine if image is closer to 16:9 (1.78) or 1:1 (1.0)
      if (Math.abs(aspectRatio - 1) < Math.abs(aspectRatio - 1.78)) {
        // Image is closer to square (1:1)
        imageCol.classList.add('aspect-1-1');
        contentCol.classList.add('with-square-image');
      } else {
        // Image is closer to 16:9
        imageCol.classList.add('aspect-16-9');
      }
    };

    imageCol.appendChild(img);
  } else {
    // Default to 16:9 if no image
    imageCol.classList.add('aspect-16-9');
  }

  // Store reference for aspect ratio detection
  window.heroContentCol = contentCol;

  // Add title
  if (title) {
    const titleEl = document.createElement('h1');
    titleEl.textContent = title;
    contentCol.appendChild(titleEl);
  }

  // Add date in place of category
  if (publishDate) {
    const dateEl = document.createElement('div');
    dateEl.className = 'hero-category'; // Use category styling for the date

    // Try to parse the date, with fallback for different formats
    let formattedDate;
    try {
      const date = new Date(publishDate);
      if (Number.isNaN(date.getTime())) {
        // If date is invalid, just show the raw value
        formattedDate = publishDate;
      } else {
        formattedDate = date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      }
    } catch (error) {
      formattedDate = publishDate;
    }

    dateEl.textContent = formattedDate;
    contentCol.appendChild(dateEl);
  }

  // Add author and date
  const metaInfo = document.createElement('div');
  metaInfo.className = 'hero-meta-info';

  if (author) {
    const authorEl = document.createElement('span');
    authorEl.className = 'hero-author';
    authorEl.textContent = `By ${author}`;
    metaInfo.appendChild(authorEl);
  }

  if (metaInfo.children.length > 0) {
    contentCol.appendChild(metaInfo);
  }

  // Add tags
  if (tags) {
    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'hero-tags';
    const tagList = document.createElement('ul');

    tags.split(',').forEach((tag) => {
      const tagItem = document.createElement('li');
      tagItem.textContent = tag.trim();
      tagList.appendChild(tagItem);
    });

    tagsContainer.appendChild(tagList);
    contentCol.appendChild(tagsContainer);
  }

  // Append columns to container
  container.appendChild(imageCol);
  container.appendChild(contentCol);

  // Append container to block
  block.appendChild(container);

  block.classList.add('initialized');
}
