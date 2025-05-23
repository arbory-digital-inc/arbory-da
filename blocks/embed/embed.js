/*
 * Embed Block
 * Show videos and social posts directly on your page
 * https://www.hlx.live/developer/block-collection/embed
 */

const loadScript = (url, callback, type) => {
    const head = document.querySelector('head');
    const script = document.createElement('script');
    script.src = url;
    if (type) {
      script.setAttribute('type', type);
    }
    script.onload = callback;
    head.append(script);
    return script;
  };
  
  const getDefaultEmbed = (url) => `<div style="left: 0; width: 100%; height: 0; position: relative; padding-bottom: 56.25%;">
      <iframe src="${url.href}" style="border: 0; top: 0; left: 0; width: 100%; height: 100%; position: absolute;" allowfullscreen=""
        scrolling="no" allow="encrypted-media" title="Content from ${url.hostname}" loading="lazy">
      </iframe>
    </div>`;
  
  const embedYoutube = (url, autoplay) => {
    const usp = new URLSearchParams(url.search);
    const suffix = autoplay ? '&muted=1&autoplay=1' : '';
    let vid = usp.get('v') ? encodeURIComponent(usp.get('v')) : '';
    const embed = url.pathname;
    if (url.origin.includes('youtu.be')) {
      [, vid] = url.pathname.split('/');
    }
    const embedHTML = `<div style="left: 0; width: 100%; height: 0; position: relative; padding-bottom: 56.25%;">
        <iframe src="https://www.youtube.com${vid ? `/embed/${vid}?rel=0&v=${vid}${suffix}` : embed}" style="border: 0; top: 0; left: 0; width: 100%; height: 100%; position: absolute;" 
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope; picture-in-picture" allowfullscreen="" scrolling="no" title="Content from Youtube" loading="lazy"></iframe>
      </div>`;
    return embedHTML;
  };
  
  const embedVimeo = (url, autoplay) => {
    const [, video] = url.pathname.split('/');
    const suffix = autoplay ? '?muted=1&autoplay=1' : '';
    const embedHTML = `<div style="left: 0; width: 100%; height: 0; position: relative; padding-bottom: 56.25%;">
        <iframe src="https://player.vimeo.com/video/${video}${suffix}" 
        style="border: 0; top: 0; left: 0; width: 100%; height: 100%; position: absolute;" 
        frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen  
        title="Content from Vimeo" loading="lazy"></iframe>
      </div>`;
    return embedHTML;
  };
  
  const embedTwitter = (url) => {
    console.log(url.href);
    const embedHTML = `<blockquote class="twitter-tweet"><p lang="en" dir="ltr"><a href="${url.href}"></a></p></blockquote>`;
    loadScript('https://platform.twitter.com/widgets.js');
    return embedHTML;
  };


  // vidyard videos
const embedVidyard = (url) => {
  const video = url.pathname.split('/').pop(); // breaks out UUID of vidyard URL
  const script = document.createElement('script'); // creates and appends vidyard player script to header
  script.type = 'text/javascript';
  script.src = 'https://play.vidyard.com/embed/v4.js';
  document.head.appendChild(script);
  // HTML code for placing the vidyard player on the page. Note that this code only places a preview
  // thumbnail on the page that the above script replaces on loading
  const embedHTML = `<div> 
      <img class="vidyard-player-embed"
      src="https://play.vidyard.com/${video}.jpg"
      data-uuid="${video}"
      data-v="4"
      data-type="inline"/>
    </div>`;
  return embedHTML;
};
  
  const loadEmbed = (block, link, autoplay) => {
    if (block.classList.contains('embed-is-loaded')) {
      return;
    }
  
    const EMBEDS_CONFIG = [
      {
        match: ['youtube', 'youtu.be'],
        embed: embedYoutube,
      },
      {
        match: ['vimeo'],
        embed: embedVimeo,
      },
      {
        match: ['twitter'],
        embed: embedTwitter,
      },
      {
        match: ['vidyard'],
        embed: embedVidyard,
      },
    ];
  
    const config = EMBEDS_CONFIG.find((e) => e.match.some((match) => link.includes(match)));
    const url = new URL(link);
    if (config) {
      block.innerHTML = config.embed(url, autoplay);
      block.classList = `block embed embed-${config.match[0]}`;
    } else {
      block.innerHTML = getDefaultEmbed(url);
      block.classList = 'block embed';
    }
    block.classList.add('embed-is-loaded');
  };
  
  export default function decorate(block) {
    const placeholder = block.querySelector('picture');
    const link = block.querySelector('a').href;
    block.textContent = '';
  
    if (placeholder) {
      const wrapper = document.createElement('div');
      wrapper.className = 'embed-placeholder';
      wrapper.innerHTML = '<div class="embed-placeholder-play"><button title="Play"></button></div>';
      wrapper.prepend(placeholder);
      wrapper.addEventListener('click', () => {
        loadEmbed(block, link, true);
      });
      block.append(wrapper);
    } else {
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          loadEmbed(block, link);
        }
      });
      observer.observe(block);
    }
  }