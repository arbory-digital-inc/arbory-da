const KITS = { en: 'cks7hcz.css' };

// Local implementation to avoid dependency cycle
function getConfig() {
  return window.nx?.config || {};
}

function loadStyle(href) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

// A gently modified version of the dynamic subsetting loader from Adobe Fonts
function dynamicTypekit(kitId, d = document) {
  const config = { kitId, scriptTimeout: 3000, async: true };
  const h = d.documentElement;
  const t = setTimeout(() => {
    h.className = `${h.className.replace(/\bwf-loading\b/g, '')} wf-inactive`;
  }, config.scriptTimeout);
  const tk = d.createElement('script');
  let f = false;
  const s = d.getElementsByTagName('script')[0];
  let a;

  h.className += ' wf-loading';
  tk.src = `https://use.typekit.net/${config.kitId}.js`;
  tk.async = true;

  tk.onload = function onTypekitLoad() {
    a = this.readyState;
    if (f || (a && a !== 'complete' && a !== 'loaded')) return;
    f = true;
    clearTimeout(t);
    try {
      // eslint-disable-next-line no-undef
      Typekit.load(config);
    } catch (e) {
      // Typekit loading failed, but we continue silently
    }
  };

  tk.onreadystatechange = tk.onload;
  s.parentNode.insertBefore(tk, s);
  return h;
}

(async function loadFonts() {
  // Attempt to get the consumer preference
  let tk = getConfig().locale?.tk;
  // Fallback to default
  if (!tk) tk = KITS[document.documentElement.lang || 'en'];
  const tkSplit = tk.split('.');
  if (tkSplit[1] === 'css') {
    loadStyle(`https://use.typekit.net/${tk}`);
    return;
  }
  dynamicTypekit(tk);
}());
