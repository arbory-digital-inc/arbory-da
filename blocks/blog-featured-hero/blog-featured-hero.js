// Configuration constants
const CONFIG = {
  AUTO_ADVANCE_DELAY: 5000,
  RESTART_DELAY: 100,
  HIGH_RES_WIDTHS: ['width=2000', 'width=1920'],
  DEFAULT_WIDTH_REPLACEMENT: { from: 'width=750', to: 'width=2000' },
  // Responsive image sizes for carousel (based on actual CSS layout)
  // Mobile: 100vw minus padding, Tablet: ~50vw, Desktop: ~940px (actual rendered size)
  CAROUSEL_SIZES: '(max-width: 768px) calc(100vw - 2rem), (max-width: 1200px) 50vw, 940px',
};

/**
 * Extracts high-resolution image URL from picture element
 * @param {HTMLElement} picture Picture element
 * @returns {string|null} High-resolution image URL
 */
function extractHighResImage(picture) {
  if (!picture) return null;

  // Try to get highest resolution source
  const sources = picture.querySelectorAll('source');
  for (const source of sources) {
    const srcset = source.getAttribute('srcset');
    if (srcset && CONFIG.HIGH_RES_WIDTHS.some(width => srcset.includes(width))) {
      return srcset.split(' ')[0];
    }
  }

  // Fallback to img src with resolution upgrade
  const img = picture.querySelector('img');
  if (img?.src) {
    return img.src.replace(
      CONFIG.DEFAULT_WIDTH_REPLACEMENT.from,
      CONFIG.DEFAULT_WIDTH_REPLACEMENT.to
    );
  }

  return null;
}

/**
 * Extracts title and link from row element
 * @param {HTMLElement} row Row element
 * @returns {Object} Object with title and titleLink properties
 */
function extractTitleAndLink(row) {
  if (!row) return { title: '', titleLink: '' };

  const titleElement = row.querySelector('a, h1, h2, h3, h4, h5, h6');
  
  if (!titleElement) {
    return { title: row.textContent.trim(), titleLink: '' };
  }

  const title = titleElement.textContent.trim();
  
  if (titleElement.tagName === 'A') {
    return { title, titleLink: titleElement.href };
  }

  const link = titleElement.querySelector('a');
  return { title, titleLink: link?.href || '' };
}

/**
 * Creates a DOM element with class name and optional text content
 * @param {string} tag HTML tag name
 * @param {string} className CSS class name
 * @param {string} textContent Optional text content
 * @returns {HTMLElement} Created element
 */
function createElement(tag, className, textContent = '') {
  const element = document.createElement(tag);
  element.className = className;
  if (textContent) element.textContent = textContent;
  return element;
}

/**
 * Decorates the blog-featured-hero block
 * Transforms EDS table structure into hero layout with background image and carousel
 */
export default function decorate(block) {
  const rows = [...block.children];
  
  // Extract content from rows
  const backgroundImage = extractHighResImage(rows[0]?.querySelector('picture'));
  const carouselImages = [];
  
  // Row 2: Carousel images
  rows[1]?.querySelectorAll('picture').forEach(picture => {
    const img = picture.querySelector('img');
    if (img) {
      carouselImages.push({
        picture: picture.cloneNode(true),
        alt: img.alt || '',
      });
    }
  });

  // Row 3: Title with link
  const { title, titleLink } = extractTitleAndLink(rows[2]);
  
  // Row 4: Subtitle
  const subtitle = rows[3]?.textContent.trim() || '';
  
  // Row 5: Description
  const description = rows[4]?.textContent.trim() || '';

  // Clear and set background
  block.innerHTML = '';
  if (backgroundImage) {
    Object.assign(block.style, {
      backgroundImage: `url("${backgroundImage}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center center',
      backgroundRepeat: 'no-repeat',
    });
  }

  // Build DOM structure
  const overlay = createElement('div', 'hero-overlay');
  const container = createElement('div', 'hero-container');
  const leftCol = createElement('div', 'hero-left-col');
  const rightCol = createElement('div', 'hero-right-col');
  const contentCard = createElement('div', 'hero-content-card');

  // Add carousel
  if (carouselImages.length > 0) {
    leftCol.appendChild(createCarousel(carouselImages));
  }

  // Add title
  if (title) {
    const titleEl = createElement('h2', 'hero-title');
    if (titleLink) {
      const titleLinkEl = document.createElement('a');
      Object.assign(titleLinkEl, { href: titleLink, textContent: title, title });
      titleEl.appendChild(titleLinkEl);
    } else {
      titleEl.textContent = title;
    }
    contentCard.appendChild(titleEl);
  }

  // Add subtitle and description
  if (subtitle) contentCard.appendChild(createElement('p', 'hero-subtitle', subtitle));
  if (description) contentCard.appendChild(createElement('p', 'hero-description', description));

  // Add "Read More" button
  if (titleLink) {
    const readMoreBtn = document.createElement('a');
    Object.assign(readMoreBtn, {
      href: titleLink,
      className: 'hero-read-more-btn',
      textContent: 'Read More »',
    });
    contentCard.appendChild(readMoreBtn);
  }

  // Assemble structure
  rightCol.appendChild(contentCard);
  container.append(leftCol, rightCol);
  overlay.appendChild(container);
  block.appendChild(overlay);

  // Optimize all hero images for performance
  block.querySelectorAll('img').forEach((img, index) => {
    // First image gets highest priority for LCP
    if (index === 0) {
      img.loading = 'eager';
      img.fetchPriority = 'high';
      img.decoding = 'async';
    } else {
      img.loading = 'eager';
      img.decoding = 'async';
    }
    
    // Ensure sizes attribute exists for responsive images
    if (!img.sizes && img.srcset) {
      img.sizes = CONFIG.CAROUSEL_SIZES;
    }
  });
}

/**
 * Creates a carousel component with navigation controls
 * @param {Array} images Array of image objects with picture elements
 * @returns {HTMLElement} Carousel container
 */
function createCarousel(images) {
  const carousel = createElement('div', 'hero-carousel');
  const slidesContainer = createElement('div', 'carousel-slides');

  // Create slides with responsive image optimization
  images.forEach((imageObj, index) => {
    const slide = createElement('div', index === 0 ? 'carousel-slide active' : 'carousel-slide');
    const picture = imageObj.picture.cloneNode(true);
    const img = picture.querySelector('img');
    
    if (img) {
      // Optimize first image for LCP (Largest Contentful Paint)
      if (index === 0) {
        img.loading = 'eager';
        img.fetchPriority = 'high';
        img.decoding = 'async';
      } else {
        img.loading = 'eager';
        img.decoding = 'async';
      }
      
      // Add responsive sizes attribute if not present
      if (!img.sizes) {
        img.sizes = CONFIG.CAROUSEL_SIZES;
      }
      
      // Ensure srcset is preserved for responsive loading
      const sources = picture.querySelectorAll('source');
      sources.forEach(source => {
        if (!source.sizes) {
          source.sizes = CONFIG.CAROUSEL_SIZES;
        }
      });
    }
    
    slide.appendChild(picture);
    slidesContainer.appendChild(slide);
  });

  carousel.appendChild(slidesContainer);

  // Add navigation for multiple images
  if (images.length > 1) {
    const prevBtn = createElement('button', 'carousel-btn carousel-prev', '‹');
    const nextBtn = createElement('button', 'carousel-btn carousel-next', '›');
    prevBtn.setAttribute('aria-label', 'Previous image');
    nextBtn.setAttribute('aria-label', 'Next image');

    carousel.append(prevBtn, nextBtn);
    initializeCarousel(carousel, images.length);
  }

  return carousel;
}

/**
 * Initializes carousel functionality with navigation and auto-advance
 * @param {HTMLElement} carousel The carousel container
 * @param {number} slideCount Number of slides
 */
function initializeCarousel(carousel, slideCount) {
  const slides = carousel.querySelectorAll('.carousel-slide');
  const prevBtn = carousel.querySelector('.carousel-prev');
  const nextBtn = carousel.querySelector('.carousel-next');
  
  let currentSlide = 0;
  let autoAdvanceInterval = null;
  let restartTimeout = null;

  const showSlide = (index) => {
    slides[currentSlide].classList.remove('active');
    slides[index].classList.add('active');
    currentSlide = index;
  };

  const nextSlide = () => showSlide((currentSlide + 1) % slideCount);
  const prevSlide = () => showSlide((currentSlide - 1 + slideCount) % slideCount);

  const stopAutoAdvance = () => {
    clearInterval(autoAdvanceInterval);
    clearTimeout(restartTimeout);
    autoAdvanceInterval = null;
    restartTimeout = null;
  };

  const startAutoAdvance = () => {
    stopAutoAdvance();
    autoAdvanceInterval = setInterval(nextSlide, CONFIG.AUTO_ADVANCE_DELAY);
  };

  const handleNavClick = (slideFunction) => {
    stopAutoAdvance();
    slideFunction();
    restartTimeout = setTimeout(startAutoAdvance, CONFIG.RESTART_DELAY);
  };

  // Event listeners
  nextBtn.addEventListener('click', () => handleNavClick(nextSlide));
  prevBtn.addEventListener('click', () => handleNavClick(prevSlide));
  carousel.addEventListener('mouseenter', stopAutoAdvance);
  carousel.addEventListener('mouseleave', startAutoAdvance);

  // Start auto-advance
  startAutoAdvance();
}