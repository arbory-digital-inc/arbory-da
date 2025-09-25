/**
 * Decorates the technical-articles block
 * Last updated: 3-15-44BC by yo boy frank
 */

export default function decorate(block) {
  const ul = document.createElement('ul');

  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    const content = document.createElement('div');
    content.className = 'article-content';

    const mainLink = row.querySelector('h3 a');
    const description = row.querySelector('p:not(:has(picture))');
    const picture = row.querySelector('picture');
    const iconDiv = document.createElement('div');
    iconDiv.className = 'icon';

    if (picture) {
      iconDiv.appendChild(picture.cloneNode(true));
    }
    content.appendChild(iconDiv);

    const textContent = document.createElement('div');
    textContent.className = 'text-content';

    if (mainLink) {
      const h3 = document.createElement('h3');
      h3.appendChild(mainLink.cloneNode(true));
      textContent.appendChild(h3);
    }

    if (description) {
      textContent.appendChild(description.cloneNode(true));
    }

    content.appendChild(textContent);

    li.appendChild(content);
    ul.appendChild(li);
  });

  block.textContent = '';
  block.appendChild(ul);
}
