/**
 * Blog Featured Hero Block
 * Displays a featured blog post with background image, carousel, and content overlay
 */

import { fetchPlaceholders } from '../../scripts/aem.js';

const AUTOPLAY_DELAY = 5000;

/**
 * Updates the active slide in the carousel
 * @param {HTMLElement} carousel
 * @param {number} slideIndex
 * @returns {number} normalized index
 */
function updateActiveSlide(carousel, slideIndex) {
  const slides = carousel.querySelectorAll('.featured-carousel-slide');
  const totalSlides = slides.length;
  
  if (totalSlides === 0) return 0;
  
  const normalizedIndex = ((slideIndex % totalSlides) + totalSlides) % totalSlides;
  
  carousel.dataset.activeSlide = normalizedIndex;
  
  slides.forEach((slide, idx) => {
    slide.setAttribute('aria-hidden', String(idx !== normalizedIndex));
  });
  
  const liveRegion = carousel.querySelector('.featured-carousel-live');
  if (liveRegion) {
    liveRegion.textContent = `Slide ${normalizedIndex + 1} of ${totalSlides}`;
  }
  
  return normalizedIndex;
}

/**
 * Shows a specific slide in the carousel
 */
function showSlide(carousel, slideIndex) {
  const slides = carousel.querySelectorAll('.featured-carousel-slide');
  const slidesContainer = carousel.querySelector('.featured-carousel-slides');
  
  if (!slidesContainer || slides.length === 0) return;
  
  const normalizedIndex = updateActiveSlide(carousel, slideIndex);
  const activeSlide = slides[normalizedIndex];
  
  if (activeSlide) {
    slidesContainer.scrollTo({
      top: 0,
      left: activeSlide.offsetLeft,
      behavior: 'smooth',
    });
  }
}

/**
 * Binds navigation events to the carousel
 * @returns {Function} cleanup function
 */
function bindCarouselEvents(carousel) {
  const prevBtn = carousel.querySelector('.featured-slide-prev');
  const nextBtn = carousel.querySelector('.featured-slide-next');
  const slides = carousel.querySelectorAll('.featured-carousel-slide');
  
  const cleanupFns = [];
  
  if (slides.length <= 1) return () => {};
  
  let autoplayInterval = null;
  
  const startAutoplay = () => {
    if (autoplayInterval) return;
    
    autoplayInterval = setInterval(() => {
      const currentSlide = parseInt(carousel.dataset.activeSlide || '0', 10);
      showSlide(carousel, currentSlide + 1);
    }, AUTOPLAY_DELAY);
  };
  
  const stopAutoplay = () => {
    if (autoplayInterval) {
      clearInterval(autoplayInterval);
      autoplayInterval = null;
    }
  };
  
  const handlePrev = () => {
    stopAutoplay();
    const currentSlide = parseInt(carousel.dataset.activeSlide || '0', 10);
    showSlide(carousel, currentSlide - 1);
    startAutoplay();
  };
  
  const handleNext = () => {
    stopAutoplay();
    const currentSlide = parseInt(carousel.dataset.activeSlide || '0', 10);
    showSlide(carousel, currentSlide + 1);
    startAutoplay();
  };
  
  if (prevBtn) {
    prevBtn.addEventListener('click', handlePrev);
    cleanupFns.push(() => prevBtn.removeEventListener('click', handlePrev));
  }
  
  if (nextBtn) {
    nextBtn.addEventListener('click', handleNext);
    cleanupFns.push(() => nextBtn.removeEventListener('click', handleNext));
  }
  
  const handleKeydown = (e) => {
    if (e.key === 'ArrowLeft') {
      handlePrev();
    } else if (e.key === 'ArrowRight') {
      handleNext();
    }
  };
  
  carousel.addEventListener('keydown', handleKeydown);
  cleanupFns.push(() => carousel.removeEventListener('keydown', handleKeydown));
  
  carousel.addEventListener('mouseenter', stopAutoplay);
  carousel.addEventListener('mouseleave', startAutoplay);
  carousel.addEventListener('focusin', stopAutoplay);
  carousel.addEventListener('focusout', startAutoplay);
  
  cleanupFns.push(
    () => carousel.removeEventListener('mouseenter', stopAutoplay),
    () => carousel.removeEventListener('mouseleave', startAutoplay),
    () => carousel.removeEventListener('focusin', stopAutoplay),
    () => carousel.removeEventListener('focusout', startAutoplay),
  );
  
  const slideObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          const slideIndex = parseInt(entry.target.dataset.slideIndex, 10);
          if (!Number.isNaN(slideIndex)) {
            updateActiveSlide(carousel, slideIndex);
          }
        }
      });
    },
    { threshold: 0.5 },
  );
  
  slides.forEach((slide) => slideObserver.observe(slide));
  cleanupFns.push(() => slideObserver.disconnect());
  
  startAutoplay();
  cleanupFns.push(() => stopAutoplay());
  
  return () => cleanupFns.forEach((fn) => fn());
}

/**
 * Creates the carousel from row 2 images
 */
function createCarousel(row2, placeholders) {
  const pictures = row2?.querySelectorAll('picture');
  
  if (!pictures || pictures.length === 0) return null;
  
  const carousel = document.createElement('div');
  carousel.className = 'featured-carousel';
  carousel.dataset.activeSlide = '0';
  carousel.setAttribute('role', 'region');
  carousel.setAttribute('aria-roledescription', 'carousel');
  carousel.setAttribute('aria-label', placeholders.featuredCarousel || 'Featured content carousel');
  carousel.setAttribute('tabindex', '0');
  
  const slidesContainer = document.createElement('div');
  slidesContainer.className = 'featured-carousel-slides';
  slidesContainer.setAttribute('aria-live', 'off');
  
  pictures.forEach((picture, idx) => {
    const slide = document.createElement('div');
    slide.className = 'featured-carousel-slide';
    slide.dataset.slideIndex = idx;
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-roledescription', 'slide');
    slide.setAttribute('aria-label', `${idx + 1} of ${pictures.length}`);
    slide.setAttribute('aria-hidden', String(idx !== 0));
    
    const link = picture.closest('a');
    const sourceElement = link ? link.cloneNode(true) : picture.cloneNode(true);
    
    const img = sourceElement.querySelector('img');
    if (img) {
      img.removeAttribute('width');
      img.removeAttribute('height');
      img.setAttribute('loading', idx === 0 ? 'eager' : 'lazy');
    }
    
    slide.appendChild(sourceElement);
    slidesContainer.appendChild(slide);
  });
  
  carousel.appendChild(slidesContainer);
  
  const liveRegion = document.createElement('div');
  liveRegion.className = 'featured-carousel-live sr-only';
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');
  carousel.appendChild(liveRegion);
  
  if (pictures.length > 1) {
    const navButtons = document.createElement('div');
    navButtons.className = 'featured-carousel-nav';
    navButtons.innerHTML = `
      <button type="button" class="featured-slide-prev" aria-label="${placeholders.previousSlide || 'Previous Slide'}">
        <span class="sr-only">${placeholders.previousSlide || 'Previous'}</span>
      </button>
      <button type="button" class="featured-slide-next" aria-label="${placeholders.nextSlide || 'Next Slide'}">
        <span class="sr-only">${placeholders.nextSlide || 'Next'}</span>
      </button>
    `;
    carousel.appendChild(navButtons);
  }
  
  return carousel;
}

/**
 * Creates the content card from rows 3, 4, and 5
 */
function createContentCard(row3, row4, row5, placeholders) {
  const card = document.createElement('div');
  card.className = 'featured-content-card';
  
  const titleLink = row3?.querySelector('a');
  
  if (titleLink) {
    const titleEl = document.createElement('h2');
    titleEl.className = 'featured-title';
    
    const link = document.createElement('a');
    link.href = titleLink.href;
    if (titleLink.title) link.title = titleLink.title;
    link.textContent = titleLink.textContent;
    
    titleEl.appendChild(link);
    card.appendChild(titleEl);
  }
  
  const subtitle = row4?.querySelector('p');
  if (subtitle?.textContent) {
    const subtitleEl = document.createElement('p');
    subtitleEl.className = 'featured-subtitle';
    subtitleEl.textContent = subtitle.textContent;
    card.appendChild(subtitleEl);
  }
  
  const description = row5?.querySelector('p');
  if (description?.innerHTML) {
    const descEl = document.createElement('div');
    descEl.className = 'featured-description';
    descEl.innerHTML = description.innerHTML;
    card.appendChild(descEl);
  }
  
  if (titleLink) {
    const readMoreBtn = document.createElement('a');
    readMoreBtn.href = titleLink.href;
    readMoreBtn.className = 'featured-read-more';
    readMoreBtn.textContent = placeholders.readMore || 'Read More';
    readMoreBtn.setAttribute('aria-label', `${placeholders.readMore || 'Read More'}: ${titleLink.textContent}`);
    card.appendChild(readMoreBtn);
  }
  
  return card;
}

/**
 * Main decoration function
 */
export default async function decorate(block) {
  let cleanupCarousel = null;
  
  try {
    const placeholders = await fetchPlaceholders();
    const rows = [...block.children];
    
    const [row1, row2, row3, row4, row5] = rows;
    
    // Get reference to background image BEFORE clearing innerHTML
    const bgPicture = row1?.querySelector('picture');
    
    // Clear the block
    block.innerHTML = '';
    
    // Background - preserve the original picture element, don't clone
    const backgroundContainer = document.createElement('div');
    backgroundContainer.className = 'featured-background';
    
    if (bgPicture) {
      // Set high priority attributes on the original image
      const bgImg = bgPicture.querySelector('img');
      if (bgImg) {
        bgImg.setAttribute('fetchpriority', 'high');
        bgImg.setAttribute('loading', 'eager');
      }
      backgroundContainer.appendChild(bgPicture);
    }
    
    // Overlay
    const overlayContainer = document.createElement('div');
    overlayContainer.className = 'featured-overlay';
    
    // Left column (carousel)
    const leftColumn = document.createElement('div');
    leftColumn.className = 'featured-left-column';
    
    if (row2) {
      const carousel = createCarousel(row2, placeholders);
      if (carousel) {
        leftColumn.appendChild(carousel);
        requestAnimationFrame(() => {
          cleanupCarousel = bindCarouselEvents(carousel);
        });
      }
    }
    
    // Right column (content)
    const rightColumn = document.createElement('div');
    rightColumn.className = 'featured-right-column';
    rightColumn.appendChild(createContentCard(row3, row4, row5, placeholders));
    
    overlayContainer.appendChild(leftColumn);
    overlayContainer.appendChild(rightColumn);
    
    block.appendChild(backgroundContainer);
    block.appendChild(overlayContainer);
    block.classList.add('initialized');
    
    block.cleanup = () => {
      if (cleanupCarousel) cleanupCarousel();
    };
    
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to initialize featured hero block:', error);
    block.classList.add('error');
  }
}