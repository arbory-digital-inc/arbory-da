/*
 * Decorates the small-navbar block
 * made with rare earth metals by ur boy frank
*/

export default function decorate(block) {
  // Add a CSS class to the block for styling
  block.classList.add('small-navbar');

  // Get all button containers in the navbar
  const buttonContainers = block.querySelectorAll('.button-container');

  // Add click event listeners to each button that has an anchor link (href starts with #)
  buttonContainers.forEach((container) => {
    const button = container.querySelector('a.button');
    if (button && button.getAttribute('href').startsWith('#')) {
      button.addEventListener('click', (e) => {
        // Prevent default anchor behavior
        e.preventDefault();

        // Extract the target ID from the href attribute
        const targetId = button.getAttribute('href').slice(1);
        const targetElement = document.getElementById(targetId);

        // If the target element exists, scroll to it smoothly
        if (targetElement) {
          targetElement.scrollIntoView({
            behavior: 'smooth', // Enables smooth scrolling
            block: 'start', // Aligns the top of the element with the top of the viewport
          });

          // Update URL with the anchor without page reload
          window.history.pushState(null, '', `#${targetId}`);
        }
      });
    }
  });

  /**
   * Updates the active state of navbar buttons based on the current URL hash
   */
  function updateActiveButton() {
    // Get the current URL hash
    const { hash } = window.location;

    // Check each button to see if it matches the current hash
    buttonContainers.forEach((container) => {
      const button = container.querySelector('a.button');
      if (button) {
        // Add or remove 'active' class based on whether the button's href matches current hash
        if (button.getAttribute('href') === hash) {
          button.classList.add('active');
        } else {
          button.classList.remove('active');
        }
      }
    });
  }

  // Add event listeners to update active button state on page load and hash changes
  window.addEventListener('load', updateActiveButton);
  window.addEventListener('hashchange', updateActiveButton);
}
