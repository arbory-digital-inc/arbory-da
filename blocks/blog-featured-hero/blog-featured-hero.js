/**
 * Decorates the blog-featured-hero block
 * Featured blog hero with background image, carousel, and content overlay
 */
export default function decorate(block) {
  // Parse the rows from EDS structure
  const rows = Array.from(block.children);
  
  // Row 1: Background image
  const backgroundRow = rows[0];
  // Row 2: Carousel images (contains h3 with link and multiple p tags with pictures)
  const carouselRow = rows[1];
  // Row 3: Title with link
  const titleRow = rows[2];
  // Row 4: Subtitle
  const subtitleRow = rows[3];
  // Row 5: Description
  const descriptionRow = rows[4];

  // Clear the block
  block.innerHTML = '';

  // Set background image
  if (backgroundRow) {
    const bgPicture = backgroundRow.querySelector('picture');
    if (bgPicture) {
      const bgImg = bgPicture.querySelector('img');
      if (bgImg) {
        // Set as CSS background using the largest source
        const sources = bgPicture.querySelectorAll('source');
        let bgUrl = bgImg.src;
        
        // Try to get the highest quality source
        if (sources.length > 0) {
          const webpSource = Array.from(sources).find(s => 
            s.getAttribute('media') === '(min-width: 600px)' && 
            s.type === 'image/webp'
          );
          if (webpSource) {
            bgUrl = webpSource.srcset.split(' ')[0];
          }
        }
        
        block.style.backgroundImage = `url('${bgUrl}')`;
        bgImg.loading = 'eager';
      }
    }
  }

  // Create overlay container
  const overlay = document.createElement('div');
  overlay.className = 'hero-overlay';

  // Create content container (grid layout)
  const contentContainer = document.createElement('div');
  contentContainer.className = 'hero-content-container';

  // LEFT COLUMN: Carousel
  const carouselColumn = document.createElement('div');
  carouselColumn.className = 'hero-carousel-column';

  if (carouselRow) {
    const carouselContent = carouselRow.querySelector('div');
    
    // Extract all images from the carousel row
    const carouselImages = [];
    
    // Get link from h3
    let carouselLink = '#';
    const h3 = carouselContent?.querySelector('h3');
    if (h3) {
      const linkEl = h3.querySelector('a');
      if (linkEl) {
        carouselLink = linkEl.href;
        // Get image from h3 link
        const h3Picture = linkEl.querySelector('picture');
        if (h3Picture) {
          carouselImages.push(h3Picture.cloneNode(true));
        }
      }
    }
    
    // Get images from p tags
    const paragraphs = carouselContent?.querySelectorAll('p');
    if (paragraphs) {
      paragraphs.forEach(p => {
        const picture = p.querySelector('picture');
        if (picture) {
          carouselImages.push(picture.cloneNode(true));
        }
      });
    }

    // Create carousel
    if (carouselImages.length > 0) {
      const carousel = document.createElement('div');
      carousel.className = 'hero-carousel';

      const carouselTrack = document.createElement('div');
      carouselTrack.className = 'carousel-track';

      carouselImages.forEach((picture, index) => {
        const slide = document.createElement('div');
        slide.className = 'carousel-slide';
        if (index === 0) slide.classList.add('active');
        
        // Make images eager loading
        const img = picture.querySelector('img');
        if (img) {
          img.loading = 'eager';
        }
        
        // Wrap in link
        const slideLink = document.createElement('a');
        slideLink.href = carouselLink;
        slideLink.appendChild(picture);
        slide.appendChild(slideLink);
        
        carouselTrack.appendChild(slide);
      });

      carousel.appendChild(carouselTrack);

      // Add navigation if more than one image
      if (carouselImages.length > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.className = 'carousel-btn carousel-prev';
        prevBtn.innerHTML = '‹';
        prevBtn.setAttribute('aria-label', 'Previous slide');

        const nextBtn = document.createElement('button');
        nextBtn.className = 'carousel-btn carousel-next';
        nextBtn.innerHTML = '›';
        nextBtn.setAttribute('aria-label', 'Next slide');

        carousel.appendChild(prevBtn);
        carousel.appendChild(nextBtn);

        // Carousel functionality
        let currentSlide = 0;
        const slides = carouselTrack.querySelectorAll('.carousel-slide');

        function showSlide(index) {
          slides.forEach(s => s.classList.remove('active'));
          slides[index].classList.add('active');
        }

        function nextSlide() {
          currentSlide = (currentSlide + 1) % slides.length;
          showSlide(currentSlide);
        }

        function prevSlide() {
          currentSlide = (currentSlide - 1 + slides.length) % slides.length;
          showSlide(currentSlide);
        }

        nextBtn.addEventListener('click', nextSlide);
        prevBtn.addEventListener('click', prevSlide);

        // Auto-advance every 5 seconds
        setInterval(nextSlide, 5000);
      }

      carouselColumn.appendChild(carousel);
    }
  }

  // RIGHT COLUMN: Content card
  const contentColumn = document.createElement('div');
  contentColumn.className = 'hero-content-column';

  const contentCard = document.createElement('div');
  contentCard.className = 'hero-content-card';

  // Title
  if (titleRow) {
    const titleContent = titleRow.querySelector('div');
    const h3 = titleContent?.querySelector('h3');
    if (h3) {
      const title = document.createElement('h2');
      title.className = 'hero-title';
      
      const link = h3.querySelector('a');
      if (link) {
        const titleLink = document.createElement('a');
        titleLink.href = link.href;
        titleLink.title = link.title || '';
        titleLink.textContent = link.textContent;
        title.appendChild(titleLink);
      } else {
        title.textContent = h3.textContent;
      }
      
      contentCard.appendChild(title);
    }
  }

  // Subtitle
  if (subtitleRow) {
    const subtitleContent = subtitleRow.querySelector('div');
    const p = subtitleContent?.querySelector('p');
    if (p) {
      const subtitle = document.createElement('div');
      subtitle.className = 'hero-subtitle';
      subtitle.textContent = p.textContent;
      contentCard.appendChild(subtitle);
    }
  }

  // Description
  if (descriptionRow) {
    const descContent = descriptionRow.querySelector('div');
    const p = descContent?.querySelector('p');
    if (p) {
      const description = document.createElement('div');
      description.className = 'hero-description';
      description.innerHTML = p.innerHTML;
      contentCard.appendChild(description);
    }
  }

  // Read More button
  if (titleRow) {
    const titleContent = titleRow.querySelector('div');
    const h3 = titleContent?.querySelector('h3');
    const link = h3?.querySelector('a');
    
    if (link) {
      const readMoreBtn = document.createElement('a');
      readMoreBtn.href = link.href;
      readMoreBtn.className = 'hero-read-more';
      readMoreBtn.textContent = 'Read More';
      contentCard.appendChild(readMoreBtn);
    }
  }

  contentColumn.appendChild(contentCard);

  // Assemble the layout
  contentContainer.appendChild(carouselColumn);
  contentContainer.appendChild(contentColumn);
  overlay.appendChild(contentContainer);
  block.appendChild(overlay);

  // Make all images load eagerly
  const images = block.querySelectorAll('img[loading="lazy"]');
  images.forEach((img) => {
    img.setAttribute('loading', 'eager');
  });
}
