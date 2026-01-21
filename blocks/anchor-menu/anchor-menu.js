/**
 * Decorates the anchor-menu block
 * @param {HTMLElement} block The block element
 */
export default function decorate(block) {
  block.classList.add('anchor-menu');
  
  // Hide the block itself - the menu is fixed to the side
  block.style.display = 'none';

  // Create the menu container
  const menuContainer = document.createElement('nav');
  menuContainer.classList.add('anchor-menu-container');

  // Create the menu list
  const menuList = document.createElement('ul');
  menuList.classList.add('anchor-menu-list');

  // Find all h2 elements in the main content
  const headings = document.querySelectorAll('main h2');
  
  if (headings.length === 0) {
    // If no h2s found, don't create the menu
    return;
  }

  // Create menu items from h2s
  headings.forEach((heading, index) => {
    // Generate an ID if the heading doesn't have one
    const headingId = heading.id || `section-${index}`;
    if (!heading.id) {
      heading.id = headingId;
    }

    // Create menu item
    const li = document.createElement('li');
    li.classList.add('anchor-menu-item');

    const link = document.createElement('a');
    link.href = `#${headingId}`;
    link.textContent = heading.textContent;
    link.classList.add('anchor-menu-link');

    li.appendChild(link);
    menuList.appendChild(li);

    // Add click handler for smooth scrolling
    link.addEventListener('click', (e) => {
      e.preventDefault();
      heading.scrollIntoView({ behavior: 'smooth' });
      
      // Update active state
      updateActiveMenuItem(headingId);
    });
  });

  menuContainer.appendChild(menuList);
  document.body.appendChild(menuContainer);

  // Update active menu item on scroll
  window.addEventListener('scroll', () => {
    let currentHeading = null;
    headings.forEach((heading) => {
      const rect = heading.getBoundingClientRect();
      if (rect.top <= window.innerHeight / 2 && rect.bottom >= 0) {
        currentHeading = heading;
      }
    });

    if (currentHeading) {
      updateActiveMenuItem(currentHeading.id);
    }
  });

  function updateActiveMenuItem(headingId) {
    // Remove active class from all items
    menuList.querySelectorAll('.anchor-menu-item').forEach((item) => {
      item.classList.remove('active');
    });

    // Add active class to the current item
    const activeLink = menuList.querySelector(`a[href="#${headingId}"]`);
    if (activeLink) {
      activeLink.parentElement.classList.add('active');
    }
  }
}
