/**
 * Decorates the customer-spotlight-cta block
 * @param {HTMLElement} block The block element
 */
export default function decorate(block) {
  // Add necessary class to help with styling
  block.classList.add("customer-spotlight-cta");

  // For CSS compatibility, we need to maintain a 4-row structure:
  // Row 1: Background image
  // Row 2: Empty placeholder (for where logo used to be)
  // Row 3: "Our Must Read Article"
  // Row 4: Article content (image, heading, description)

  if (block.children.length === 2) {
    // We have background image and content, but need to restructure
    const secondRow = block.querySelector(":scope > div:nth-child(2) > div");

    if (secondRow) {
      // 1. Add empty placeholder row where logo used to be
      const placeholderWrapper = document.createElement("div");
      const placeholderContent = document.createElement("div");
      placeholderWrapper.appendChild(placeholderContent);

      // Insert the placeholder as row 2
      block.insertBefore(placeholderWrapper, block.children[1]);

      // 2. Handle must-read paragraph and article content
      const mustReadParagraph = secondRow.querySelector("p:first-child");
      const articleHeading = secondRow.querySelector("h3");
      const articleDescription = secondRow.querySelector("p:last-child");
      const articlePicture = secondRow.querySelector("picture");

      // 3. Create the must-read row (row 3)
      const mustReadWrapper = document.createElement("div");
      const mustReadContent = document.createElement("div");
      mustReadWrapper.appendChild(mustReadContent);

      if (mustReadParagraph) {
        const mustReadClone = mustReadParagraph.cloneNode(true);
        mustReadContent.appendChild(mustReadClone);
      } else {
        // If no "must read" text, create an empty one for structure
        const emptyMustRead = document.createElement("p");
        emptyMustRead.textContent = "Customer Spotlight";
        mustReadContent.appendChild(emptyMustRead);
      }

      // Insert as row 3
      block.insertBefore(mustReadWrapper, block.children[2]);

      // 4. Create the article content row (row 4)
      const articleWrapper = document.createElement("div");
      const articleContent = document.createElement("div");
      articleWrapper.appendChild(articleContent);

      // Handle article picture
      if (articlePicture) {
        articleContent.appendChild(articlePicture);
      }

      // Handle article heading
      if (articleHeading) {
        const picture = articleHeading.querySelector("picture");
        if (picture && articleHeading.contains(picture)) {
          articleContent.appendChild(picture);
          articleHeading.innerHTML = articleHeading.innerHTML
            .replace(/<\/picture>\s*/i, "")
            .trim();
        }
        articleContent.appendChild(articleHeading);
      }

      // Handle article description
      if (articleDescription) {
        articleContent.appendChild(articleDescription);
      }

      // Replace the current row with the article content
      block.replaceChild(articleWrapper, block.children[2]);
    }
  } else if (block.children.length === 3) {
    // We have 3 rows but need 4 for CSS compatibility
    // Insert an empty row 2 for where logo used to be
    const placeholderWrapper = document.createElement("div");
    const placeholderContent = document.createElement("div");
    placeholderWrapper.appendChild(placeholderContent);

    // Insert after the first row
    block.insertBefore(placeholderWrapper, block.children[1]);

    // Now handle any article image inside heading
    const articleRow = block.querySelector(":scope > div:last-child > div");
    if (articleRow) {
      const articleHeading = articleRow.querySelector("h3");
      if (articleHeading) {
        const picture = articleHeading.querySelector("picture");
        if (picture && articleHeading.contains(picture)) {
          articleHeading.parentNode.insertBefore(picture, articleHeading);
          articleHeading.innerHTML = articleHeading.innerHTML
            .replace(/<\/picture>\s*/i, "")
            .trim();
        }
      }
    }
  }

  // Make all images load eagerly for better performance
  const images = block.querySelectorAll('img[loading="lazy"]');
  images.forEach((img) => {
    img.setAttribute("loading", "eager");
  });
}
