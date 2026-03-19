const PRODUCTION_HOSTNAME = 'blog.arborydigital.com';
const GA_ID = 'G-9RTBV1LRPP';

if (window.location.hostname === PRODUCTION_HOSTNAME) {
  const gtagScript = document.createElement('script');
  gtagScript.async = true;
  gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(gtagScript);

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA_ID);
  window.dispatchEvent(new Event('gtaginit'));
}

