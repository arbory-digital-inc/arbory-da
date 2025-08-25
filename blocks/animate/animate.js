// Import anime.js v4 with named exports
let animateFunc = null;

async function loadAnime() {
  if (animateFunc) {
    return animateFunc;
  }
  
  try {
    const animeModule = await import('/scripts/anime.esm.min.js');
    animateFunc = animeModule.animate;
    console.log('Anime.js v4 loaded successfully');
    return animateFunc;
  } catch (error) {
    console.error('Failed to load anime.js:', error);
    throw error;
  }
}

export default async function decorate(block) {
  const h1 = block.querySelector('h1');
  const subheading = block.querySelector('p');
  if (!h1) return;
  
  // Load anime.js if not already loaded
  let animate;
  try {
    animate = await loadAnime();
  } catch (error) {
    console.error('Failed to load anime.js:', error);
    return;
  }

  // Split text into spans for each letter
  const text = h1.textContent;
  h1.innerHTML = '';
  h1.style.perspective = '1000px'; // Add perspective for 3D rotation
  
  // Create a span for each letter
  text.split('').forEach(char => {
    const span = document.createElement('span');
    span.textContent = char === ' ' ? '\u00A0' : char; // Use non-breaking space
    span.style.display = 'inline-block';
    span.style.opacity = '0';
    span.style.transformStyle = 'preserve-3d';
    span.style.transform = 'scale(1.25) translateY(-40px) rotateY(45deg)';
    h1.appendChild(span);
  });
  
  // Ensure block has proper layout
  block.style.display = 'flex';
  block.style.flexDirection = 'column';
  block.style.alignItems = 'center';
  block.style.textAlign = 'center';
  
  // Hide subheading initially
  if (subheading) {
    subheading.style.opacity = '0';
    subheading.style.transform = 'translateY(20px)';
    subheading.style.display = 'block';
    subheading.style.width = '100%';
  }
  
  // Get all the spans
  const spans = h1.querySelectorAll('span');
  
  // Animation function
  async function animateIn() {
    // Animate title letters
    await animate(spans, {
      scale: { to: 1, duration: 400, ease: 'outQuad' },
      translateY: { to: 0, duration: 400, ease: 'outQuad' },
      rotateY: { to: 0, duration: 400, ease: 'outQuad' },
      opacity: { to: 1, duration: 400, ease: 'outQuad' },
      delay: (el, index) => index * 50 // Reduced from 175ms to 50ms for faster animation
    });
    
    // After title completes, fade in subheading
    if (subheading) {
      await animate(subheading, {
        opacity: { to: 1, duration: 500, ease: 'outQuad' },
        translateY: { to: 0, duration: 500, ease: 'outQuad' }
      });
    }
  }
  
  // Set up IntersectionObserver to trigger immediately when element comes into view
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateIn(); // Start immediately when element is visible
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1 // Trigger as soon as 10% of the element is visible
    });
    
    observer.observe(block);
  } else {
    // Fallback: Check if element is in viewport on scroll
    function checkVisibility() {
      const rect = block.getBoundingClientRect();
      const inView = rect.top < window.innerHeight && rect.bottom > 0;
      
      if (inView) {
        animateIn();
        window.removeEventListener('scroll', checkVisibility);
      }
    }
    
    window.addEventListener('scroll', checkVisibility);
    checkVisibility(); // Check immediately in case already in view
  }
}