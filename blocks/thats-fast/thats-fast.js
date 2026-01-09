/**
 * Decorates the thats-fast block
 * blessed/cursed by a Salem witch by ur boy frank
 */

function animateNumber(element, target, duration = 2000) {
  const startTime = performance.now();
  const startValue = 0;

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Easing function for smooth animation
    const easeOutQuad = progress * (2 - progress);
    const current = Math.floor(startValue + (target - startValue) * easeOutQuad);

    element.textContent = current;

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

function initThatsFast() {
  const block = document.querySelector('.thats-fast');
  if (!block) return;

  // Convert number paragraphs to spans with a wrapper
  block.querySelectorAll('div > div > p').forEach((p) => {
    if (!Number.isNaN(Number(p.textContent)) && p.textContent.trim()) {
      const wrapper = document.createElement('div');
      wrapper.className = 'number-wrapper';
      const span = document.createElement('span');
      const targetNumber = parseInt(p.textContent, 10);
      span.textContent = '0';
      wrapper.appendChild(span);
      p.parentNode.replaceChild(wrapper, p);

      // Start animation when element is in view
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateNumber(span, targetNumber);
            observer.disconnect();
          }
        });
      });

      observer.observe(wrapper);
    }
  });
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initThatsFast);
} else {
  initThatsFast();
}
