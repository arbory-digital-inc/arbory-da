// eslint-disable-next-line import/no-cycle
import { sampleRUM } from './aem.js';

// Core Web Vitals RUM collection
sampleRUM('cwv');

function loadScript(src) {
	if (document.querySelector(`script[src="${src}"]`)) return;

	const script = document.createElement('script');
	script.src = src;
	script.async = true;
	document.head.append(script);
}

loadScript('/scripts/newrelic.js');

// add more delayed functionality here
/* Add in ALI ARMS RUM CODE */

/* END ALI ARMS RUM CODE */