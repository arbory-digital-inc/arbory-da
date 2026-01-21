/**
 * Decorates the anchor-menu block
 * @param {HTMLElement} block The block element
 */
export default function decorate(block) {
  block.classList.add('anchor-menu');
  block.innerHTML = '';

  // Sidebar container
  const sidebar = document.createElement('nav');
  sidebar.className = 'anchor-menu-sidebar';
  sidebar.setAttribute('aria-label', 'Section Navigation');

  // Helper: Set sidebar top based on hero height
  function setSidebarTop(forceStickyHeaderOffset = false) {
    if (forceStickyHeaderOffset) {
      // Offset for sticky header (adjust as needed, e.g., 64px)
      sidebar.style.top = '80px';
      return;
    }
    // Try to find the hero block (by class or tag)
    const hero = document.querySelector('main .hero, main .arbory-blog-hero, main .blog-post-hero');
    let top = 80; // fallback default
    if (hero) {
      top = hero.offsetTop + hero.offsetHeight;
    }
    sidebar.style.top = `${top}px`;
  }
  setSidebarTop();
  window.addEventListener('resize', () => setSidebarTop());
  window.addEventListener('load', () => setSidebarTop());

  // Show/hide sidebar based on hero visibility
  function updateSidebarVisibility() {
    const hero = document.querySelector('main .hero, main .arbory-blog-hero, main .blog-post-hero');
    if (hero) {
      const rect = hero.getBoundingClientRect();
      // If hero bottom is above the top of the viewport, show sidebar at top
      if (rect.bottom <= 0) {
        sidebar.style.display = 'block';
        setSidebarTop(true); // forceStickyHeaderOffset: true
      } else {
        sidebar.style.display = 'none';
        setSidebarTop(); // reset top
      }
    } else {
      // If no hero, always show at top
      sidebar.style.display = 'block';
      setSidebarTop(true);
    }
  }
  updateSidebarVisibility();
  window.addEventListener('scroll', updateSidebarVisibility);
  window.addEventListener('resize', updateSidebarVisibility);

  // Menu list
  const menuList = document.createElement('ul');
  menuList.className = 'anchor-menu-list';

  // Find all h2 elements in the main content
  const headings = document.querySelectorAll('main h2');
  if (headings.length === 0) return;

  // Create menu items from h2s
  headings.forEach((heading, index) => {
    const headingId = heading.id || `section-${index}`;
    if (!heading.id) heading.id = headingId;

    const li = document.createElement('li');
    li.className = 'anchor-menu-item';

    const link = document.createElement('a');
    link.href = `#${headingId}`;
    link.textContent = heading.textContent;
    link.className = 'anchor-menu-link';
    link.setAttribute('tabindex', '0');
    link.setAttribute('aria-label', `Jump to section: ${heading.textContent}`);

    li.appendChild(link);
    menuList.appendChild(li);

    // Smooth scroll and focus
    link.addEventListener('click', (e) => {
      e.preventDefault();
      heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
      updateActiveMenuItem(headingId);
      link.blur();
    });
    link.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
        updateActiveMenuItem(headingId);
        link.blur();
      }
    });
  });

  sidebar.appendChild(menuList);
  block.appendChild(sidebar);

  // Sticky/fixed behavior is handled by CSS, but top is set dynamically

  // Update active menu item on scroll
  window.addEventListener('scroll', () => {
    let currentHeading = null;
    headings.forEach((heading) => {
      const rect = heading.getBoundingClientRect();
      if (rect.top <= 120 && rect.bottom > 60) {
        currentHeading = heading;
      }
    });
    if (currentHeading) {
      updateActiveMenuItem(currentHeading.id);
    }
  });

  function updateActiveMenuItem(headingId) {
    menuList.querySelectorAll('.anchor-menu-item').forEach((item) => {
      item.classList.remove('active');
    });
    const activeLink = menuList.querySelector(`a[href="#${headingId}"]`);
    if (activeLink) {
      activeLink.parentElement.classList.add('active');
    }
  }
}
