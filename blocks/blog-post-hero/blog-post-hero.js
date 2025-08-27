// cryptid energy channeled directly into code by ur boy frank
import { getMetadata } from '../../scripts/aem.js';

export default function decorate(block) {
  // Get the background image from the first picture element in the section
  const section = block.closest('.section');
  const backgroundPicture = section.querySelector('.default-content-wrapper picture');
  
  // Get metadata
  const title = getMetadata('og:title') || document.querySelector('h1')?.textContent || '';
  const category = getMetadata('category') || '';
  const tags = getMetadata('article:tag') || getMetadata('tags') || '';
  const author = getMetadata('author') || '';
  const publishDate = getMetadata('date') || getMetadata('article:date');
  const metaImage = getMetadata('image') || getMetadata('og:image') || '';
  // Hardcoded background image URL - replace with your desired image
  const backgroundImageUrl = '/assets/media_1336129fc41ff30065a3355734cf22c9fe42cb690.jpg';
  
  // Debug logging
  console.log('Blog Hero Metadata:', {
    title,
    category,
    tags,
    author,
    publishDate,
    metaImage,
    backgroundImageUrl
  });
  
  // Clear the block content
  block.innerHTML = '';
  
  // Set background image - prioritize URL from metadata, fallback to picture element
  let backgroundImageSrc = '';
  
  if (backgroundImageUrl) {
    // Use URL from metadata
    backgroundImageSrc = backgroundImageUrl;
  } else if (backgroundPicture) {
    // Fallback to picture element
    const bgImg = backgroundPicture.querySelector('img');
    if (bgImg) {
      backgroundImageSrc = bgImg.src;
    }
  }
  
  if (backgroundImageSrc && window.innerWidth >= 1100) {
    section.style.backgroundImage = `url(${backgroundImageSrc})`;
    section.style.backgroundSize = 'cover';
    section.style.backgroundPosition = 'center bottom'; // Start from bottom for upward parallax
    section.style.backgroundRepeat = 'no-repeat';
    
    // Add parallax effect for desktop only
    const isDesktop = window.matchMedia('(min-width: 900px)');
    const isLargeScreen = window.matchMedia('(min-width: 1100px)');
    
    function updateBackgroundVisibility() {
      if (isLargeScreen.matches) {
        section.style.backgroundImage = `url(${backgroundImageSrc})`;
        section.style.backgroundSize = 'cover';
        section.style.backgroundPosition = 'center bottom';
        section.style.backgroundRepeat = 'no-repeat';
      } else {
        section.style.backgroundImage = 'none';
      }
    }
    
    function updateParallax() {
      const scrolled = window.pageYOffset;
      const rect = section.getBoundingClientRect();
      
      if (isDesktop.matches) {
        const speed = 0.5; // Parallax speed (0.5 = half speed)
        
        // Only apply parallax when section is in viewport
        if (rect.bottom >= 0 && rect.top <= window.innerHeight) {
          const yPos = scrolled * speed; // Positive value moves background up when scrolling down
          section.style.backgroundPosition = `center calc(100% + ${yPos}px)`;
        }
      } else {
        // Reset to normal position on mobile
        section.style.backgroundPosition = 'center bottom';
      }
      
      // Color transition based on scroll
      const heroContentCol = section.querySelector('.hero-content-col');
      if (heroContentCol) {
        // Calculate scroll progress based on section position
        const sectionTop = rect.top;
        const sectionHeight = rect.height;
        const windowHeight = window.innerHeight;
        
        // Calculate progress (0 to 1) based on how much the section has scrolled
        let progress = 0;
        if (sectionTop <= 0) {
          // Section has started scrolling past the top
          progress = Math.min(Math.abs(sectionTop) / (sectionHeight * 0.5), 1);
        }
        
        // Interpolate between bg-color-1 and bg-color-2
        // Using CSS custom properties for smooth transition
        heroContentCol.style.setProperty('--scroll-progress', progress);
        heroContentCol.style.background = `color-mix(in srgb, var(--bg-color-2) ${progress * 100}%, var(--bg-color-1) ${(1 - progress) * 100}%)`;
      }
    }
    
    // Initial setup
    updateBackgroundVisibility();
    updateParallax();
    
    // Add scroll listener for parallax effect
    window.addEventListener('scroll', updateParallax, { passive: true });
    
    // Update on resize
    isDesktop.addEventListener('change', updateParallax);
    isLargeScreen.addEventListener('change', updateBackgroundVisibility);
    
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
    img.style.height = 'auto';
    img.style.boxSizing = 'border-box';
    imageCol.appendChild(img);
  }
  
  // Create content column
  const contentCol = document.createElement('div');
  contentCol.className = 'hero-content-col';
  contentCol.style.maxWidth = '100%';
  contentCol.style.boxSizing = 'border-box';
  
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
      if (isNaN(date.getTime())) {
        // If date is invalid, just show the raw value
        formattedDate = publishDate;
      } else {
        formattedDate = date.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
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
    
    tags.split(',').forEach(tag => {
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