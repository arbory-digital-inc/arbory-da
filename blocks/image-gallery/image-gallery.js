/**
 * Decorates the image-gallery block
 * i am merely a vessel to this energy - ur boy frank
 */

export default function decorate(block) {
  // Get all rows from the block
  const rows = Array.from(block.children);
  
  // Create array to hold image data with captions
  const imageData = [];
  
  // Extract images and captions from rows
  rows.forEach((row) => {
    const cells = Array.from(row.children);
    if (cells.length > 0) {
      const imageCell = cells[0];
      const captionCell = cells.length > 1 ? cells[1] : null;
      
      const picture = imageCell.querySelector('picture');
      if (picture) {
        const captionText = captionCell ? captionCell.textContent.trim() : '';
        imageData.push({
          picture: picture.cloneNode(true),
          caption: captionText
        });
      }
    }
  });

  // Clear existing structure
  block.innerHTML = '';

  // Create single row for all image containers
  const row = document.createElement('div');
  imageData.forEach((data) => {
    const imageContainer = document.createElement('div');
    imageContainer.className = 'image-gallery-item';
    
    imageContainer.appendChild(data.picture);
    
    // Only add caption if it has text
    if (data.caption) {
      const captionElement = document.createElement('div');
      captionElement.className = 'image-gallery-caption';
      captionElement.textContent = data.caption;
      imageContainer.appendChild(captionElement);
    }
    
    row.appendChild(imageContainer);
  });
  block.appendChild(row);

  // Create lightbox elements
  const lightbox = document.createElement('div');
  lightbox.className = 'lightbox';
  const lightboxImg = document.createElement('img');
  lightbox.appendChild(lightboxImg);

  // Add navigation buttons
  const closeBtn = document.createElement('button');
  closeBtn.className = 'lightbox-close';
  closeBtn.innerHTML = '×';
  lightbox.appendChild(closeBtn);

  const prevBtn = document.createElement('button');
  prevBtn.className = 'lightbox-nav lightbox-prev';
  prevBtn.innerHTML = '‹';
  lightbox.appendChild(prevBtn);

  const nextBtn = document.createElement('button');
  nextBtn.className = 'lightbox-nav lightbox-next';
  nextBtn.innerHTML = '›';
  lightbox.appendChild(nextBtn);

  document.body.appendChild(lightbox);

  // Get all images and set up lightbox functionality
  const images = block.querySelectorAll('img');
  let currentImageIndex = 0;

  // Lightbox navigation function
  function showImage(index) {
    currentImageIndex = index;
    const img = images[index];
    const source = img.closest('picture').querySelector('source[media="(min-width: 600px)"]');
    const fullSizeUrl = source ? source.srcset : img.src;
    lightboxImg.src = fullSizeUrl;
    lightboxImg.alt = img.alt;

    // Update navigation visibility
    prevBtn.style.display = index > 0 ? 'flex' : 'none';
    nextBtn.style.display = index < images.length - 1 ? 'flex' : 'none';
  }

  // Initialize images
  images.forEach((img, index) => {
    if (!img.getAttribute('alt')) {
      img.setAttribute('alt', ''); // Ensure alt attribute exists for accessibility
    }
    img.style.opacity = '0';
    img.addEventListener('load', () => {
      img.style.transition = 'opacity 0.3s ease';
      img.style.opacity = '1';
    });

    // Add click event for lightbox
    img.addEventListener('click', (e) => {
      e.preventDefault();
      currentImageIndex = index;
      showImage(currentImageIndex);
      lightbox.classList.add('active');
    });
  });

  // Close lightbox
  closeBtn.addEventListener('click', () => {
    lightbox.classList.remove('active');
  });

  // Previous image
  prevBtn.addEventListener('click', () => {
    if (currentImageIndex > 0) {
      showImage(currentImageIndex - 1);
    }
  });

  // Next image
  nextBtn.addEventListener('click', () => {
    if (currentImageIndex < images.length - 1) {
      showImage(currentImageIndex + 1);
    }
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('active')) return;

    if (e.key === 'Escape') {
      lightbox.classList.remove('active');
    } else if (e.key === 'ArrowLeft' && currentImageIndex > 0) {
      showImage(currentImageIndex - 1);
    } else if (e.key === 'ArrowRight' && currentImageIndex < images.length - 1) {
      showImage(currentImageIndex + 1);
    }
  });

  // Close lightbox when clicking outside the image
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) {
      lightbox.classList.remove('active');
    }
  });

  // Add loading="lazy" to images not in the first viewport
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const img = entry.target;
        if (!img.hasAttribute('loading')) {
          img.setAttribute('loading', 'lazy');
        }
        observer.unobserve(img);
      }
    });
  });

  images.forEach((img, index) => {
    if (index > 0) { // Skip first image as it should load eagerly
      observer.observe(img);
    }
  });
}
