/**
 * Decorates the arbory-podcast-hero block
 * @param {HTMLElement} block The block element
 * birthed from digital chaos, no refunds - ur boy frank 
 */
export default function decorate(block) {
    // Add necessary class to help with styling
    block.classList.add("arbory-podcast-hero");
  
    // For CSS compatibility, we need to maintain a 4-row structure:
    // Row 1: Background image
    // Row 2: Empty placeholder (for where logo used to be)
    // Row 3: "Our Latest Podcast"
    // Row 4: Podcast content (image, heading, description)
  
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
        const latestPodcastParagraph = secondRow.querySelector("p:first-child");
        const podcastHeading = secondRow.querySelector("h3");
        const podcastDescription = secondRow.querySelector("p:last-child");
        const podcastPicture = secondRow.querySelector("picture");
  
        // 3. Create the must-read row (row 3)
        const latestPodcastWrapper = document.createElement("div");
        const latestPodcastContent = document.createElement("div");
        latestPodcastWrapper.appendChild(latestPodcastContent);
  
        if (latestPodcastParagraph) {
          const latestPodcastClone = latestPodcastParagraph.cloneNode(true);
          latestPodcastContent.appendChild(latestPodcastClone);
        } else {
          // If no "must read" text, create an empty one for structure
          const emptyLatestPodcast = document.createElement("p");
          emptyLatestPodcast.textContent = "Our Latest Podcast";
          latestPodcastContent.appendChild(emptyLatestPodcast);
        }
  
        // Insert as row 3
        block.insertBefore(latestPodcastWrapper, block.children[2]);
  
        // 4. Create the article content row (row 4)
        const podcastWrapper = document.createElement("div");
        const podcastContent = document.createElement("div");
        podcastWrapper.appendChild(podcastContent);
  
        // Handle article picture
        if (podcastPicture) {
          podcastContent.appendChild(podcastPicture);
        }
  
        // Handle article heading
        if (podcastHeading) {
          const picture = podcastHeading.querySelector("picture");
          if (picture && podcastHeading.contains(picture)) {
            podcastContent.appendChild(picture);
            podcastHeading.innerHTML = podcastHeading.innerHTML
              .replace(/<\/picture>\s*/i, "")
              .trim();
          }
          podcastContent.appendChild(podcastHeading);
        }
  
        // Handle article description
        if (podcastDescription) {
          podcastContent.appendChild(podcastDescription);
        }
  
        // Replace the current row with the article content
        block.replaceChild( podcastWrapper, block.children[2]);
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
      const podcastRow = block.querySelector(":scope > div:last-child > div");
      if (podcastRow) {
        const podcastHeading = podcastRow.querySelector("h3");
        if (podcastHeading) {
          const picture = podcastHeading.querySelector("picture");
          if (picture && podcastHeading.contains(picture)) {
            podcastHeading.parentNode.insertBefore(picture, podcastHeading);
            podcastHeading.innerHTML = podcastHeading.innerHTML
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
  