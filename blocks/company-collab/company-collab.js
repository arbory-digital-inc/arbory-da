/*
 * Column Embed Block
 * Show multiple embeds arranged in columns
 * forged in the fires of mount doom by your boy frank
 */

export default function decorate(block) {
  // Get all rows
  const rows = [...block.children];

  // First row contains the logos and plus sign
  const logoRow = rows[0];
  logoRow.className = 'company-collab-row';

  // Add classes to the logo containers
  [...logoRow.children].forEach((col, index) => {
    if (index === 1) {
      col.className = 'company-collab-plus';
    } else {
      col.className = 'company-collab-logo';
    }
  });

  // Second row contains the glow colors
  if (rows[1]) {
    const colorRow = rows[1];
    const partnerGlowColor = colorRow.children[0]?.textContent?.trim() || '#f5f5f5';
    const ourGlowColor = colorRow.children[1]?.textContent?.trim() || '#406E0C';

    // Create and inject the dynamic glow animations
    const style = document.createElement('style');
    style.textContent = `
      @keyframes glowPartner {
        0% { box-shadow: 0 0 2px ${partnerGlowColor}, 0 0 4px ${partnerGlowColor}, 0 0 6px ${partnerGlowColor}; }
        25% { box-shadow: 0 0 4px ${partnerGlowColor}, 0 0 8px ${partnerGlowColor}, 0 0 12px ${partnerGlowColor}; }
        50% { box-shadow: none; }
        75% { box-shadow: 0 0 4px ${partnerGlowColor}, 0 0 8px ${partnerGlowColor}, 0 0 12px ${partnerGlowColor}; }
        100% { box-shadow: 0 0 2px ${partnerGlowColor}, 0 0 4px ${partnerGlowColor}, 0 0 6px ${partnerGlowColor}; }
      }
      @keyframes glowOur {
        0% { box-shadow: 0 0 2px ${ourGlowColor}, 0 0 4px ${ourGlowColor}, 0 0 6px ${ourGlowColor}; }
        25% { box-shadow: 0 0 4px ${ourGlowColor}, 0 0 8px ${ourGlowColor}, 0 0 12px ${ourGlowColor}; }
        50% { box-shadow: none; }
        75% { box-shadow: 0 0 4px ${ourGlowColor}, 0 0 8px ${ourGlowColor}, 0 0 12px ${ourGlowColor}; }
        100% { box-shadow: 0 0 2px ${ourGlowColor}, 0 0 4px ${ourGlowColor}, 0 0 6px ${ourGlowColor}; }
      }
    `;
    document.head.appendChild(style);

    // Remove the color row since we don't need to display it
    colorRow.remove();
  }
}
