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

  // Dynamically match page background color
  function updateSidebarBackground() {
    const mainElement = document.querySelector('main');
    if (mainElement) {
      const bgColor = window.getComputedStyle(mainElement).backgroundColor;
      sidebar.style.backgroundColor = bgColor;
    }
  }
  updateSidebarBackground();
  window.addEventListener('resize', updateSidebarBackground);

  // Show/hide sidebar based on hero visibility
  function updateSidebarVisibility() {
    const hero = document.querySelector('main .hero, main .arbory-blog-hero, main .blog-post-hero');
    if (hero) {
      const rect = hero.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        sidebar.classList.remove('visible');
      } else {
        sidebar.classList.add('visible');
      }
    } else {
      sidebar.classList.remove('visible');
    }
  }
  updateSidebarVisibility();
  window.addEventListener('scroll', updateSidebarVisibility);
  window.addEventListener('resize', updateSidebarVisibility);

  // Menu list
  const menuList = document.createElement('ul');
  menuList.className = 'anchor-menu-list';

  const headings = Array.from(document.querySelectorAll('main h2, main h3'))
    .filter((heading) => {
      const text = heading.textContent.trim();
      return text !== 'About the Authors' && text !== 'Podcast Episodes & Blog Posts';
    });
  if (headings.length === 0) return;

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
