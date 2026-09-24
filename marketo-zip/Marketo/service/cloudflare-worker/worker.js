/*
 * Marketo Forms Service — reference implementation (Cloudflare Worker)
 *
 * A read-only proxy in front of the Marketo Asset REST API. It exists for one
 * reason: the DA authoring dialog cannot call Marketo directly, because
 *   (a) the Asset API requires an OAuth client secret, which must never reach
 *       a browser, and
 *   (b) Marketo sends no CORS headers, so the request would be blocked anyway.
 *
 * This worker holds the credentials, adds a strict CORS allowlist, and exposes
 * exactly two GET endpoints. See ../README.md for the full contract — any
 * backend that honours it works with the plugin (this happens to be a Worker
 * because it is the shortest path to a deploy; an AEM servlet, a Lambda, or an
 * Express route are equally valid).
 *
 * Zero dependencies. Deploy:
 *
 *   npm install -g wrangler
 *   wrangler secret put MARKETO_CLIENT_SECRET
 *   wrangler deploy
 *
 * Then paste the deployed URL into tools/marketo/marketo-config.js →
 * `formsServiceUrl`.
 */

/* ── configuration (wrangler.toml vars + secrets) ──────────────────────────
 * MARKETO_REST_URL       e.g. https://123-ABC-456.mktorest.com   (Admin → Web Services)
 * MARKETO_CLIENT_ID      LaunchPoint service client id           (Admin → LaunchPoint)
 * MARKETO_CLIENT_SECRET  LaunchPoint service client secret       (SECRET — never a var)
 * ALLOWED_ORIGINS        comma-separated exact origins and/or *-wildcard patterns
 * FORMS_STATUS           optional, default "approved"
 * MAX_RETURN             optional, default 200 (Marketo caps at 200)
 */

/* ── CORS ──────────────────────────────────────────────────────── */

/**
 * Match an origin against one allowlist entry. Entries are exact origins, or
 * patterns where `*` matches any run of characters except `/`
 * (e.g. `https://*--site--org.aem.page`).
 * @param {string} origin
 * @param {string} pattern
 * @returns {boolean}
 */
function originMatches(origin, pattern) {
  if (pattern === origin) return true;
  if (!pattern.includes('*')) return false;
  const re = new RegExp(`^${pattern.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')}$`);
  return re.test(origin);
}

/**
 * Build the CORS headers for a request, echoing the origin only when allowed.
 * An origin that is not on the list simply gets no CORS headers, and the
 * browser blocks the response — the standard, safe failure mode.
 * @param {Request} request
 * @param {object} env
 * @returns {Record<string, string>}
 */
function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return {};
  const allowed = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!allowed.some((pattern) => originMatches(origin, pattern))) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'accept, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/**
 * JSON response helper.
 * @param {object} body
 * @param {number} status
 * @param {Record<string,string>} headers
 * @returns {Response}
 */
function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Authoring traffic is low-volume and the catalog changes as marketers
      // work — a short cache keeps the dialog snappy without going stale.
      'cache-control': 'private, max-age=60',
      ...headers,
    },
  });
}

/**
 * Error envelope, matching the documented contract.
 * @param {string} code
 * @param {string} message
 * @param {number} status
 * @param {Record<string,string>} headers
 * @returns {Response}
 */
function fail(code, message, status, headers) {
  return json({ error: { code, message } }, status, headers);
}

/* ── OAuth token (cached per isolate) ──────────────────────────── */

let tokenCache = { value: '', expiresAt: 0 };

/**
 * Fetch (or reuse) a Marketo access token. Cached in-isolate until 60s before
 * expiry — Marketo bills token requests against a daily quota, and authoring
 * volume never justifies minting one per request.
 * @param {object} env
 * @param {boolean} [force] - bypass the cache after a token-invalid response
 * @returns {Promise<string>}
 */
async function getToken(env, force = false) {
  const now = Date.now();
  if (!force && tokenCache.value && tokenCache.expiresAt > now) return tokenCache.value;

  const url = new URL('/identity/oauth/token', env.MARKETO_REST_URL);
  url.searchParams.set('grant_type', 'client_credentials');
  url.searchParams.set('client_id', env.MARKETO_CLIENT_ID);
  url.searchParams.set('client_secret', env.MARKETO_CLIENT_SECRET);

  const resp = await fetch(url.toString());
  if (!resp.ok) throw Object.assign(new Error('auth_failed'), { code: 'auth_failed' });

  const data = await resp.json();
  if (!data.access_token) throw Object.assign(new Error('auth_malformed'), { code: 'auth_malformed' });

  tokenCache = {
    value: data.access_token,
    // 60s safety skew so a token never expires mid-flight.
    expiresAt: now + Math.max(0, (Number(data.expires_in) || 3600) - 60) * 1000,
  };
  return tokenCache.value;
}

/** Marketo error codes that mean "your token is no longer valid, re-auth". */
const TOKEN_INVALID_CODES = new Set(['601', '602', '603']);

/**
 * Call a Marketo Asset API path with the cached token, retrying once with a
 * fresh token if Marketo reports the token is invalid.
 * @param {object} env
 * @param {string} path - e.g. '/rest/asset/v1/forms.json?maxReturn=200'
 * @returns {Promise<object>}
 */
async function marketoGet(env, path) {
  const call = async (token) => {
    const resp = await fetch(new URL(path, env.MARKETO_REST_URL).toString(), {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!resp.ok) throw Object.assign(new Error('upstream_error'), { code: 'upstream_error' });
    return resp.json();
  };

  let data = await call(await getToken(env));

  if (data.success === false) {
    const codes = (data.errors || []).map((e) => String(e.code));
    if (codes.some((c) => TOKEN_INVALID_CODES.has(c))) {
      data = await call(await getToken(env, true));
    }
  }

  if (data.success === false) {
    throw Object.assign(new Error('upstream_error'), {
      code: 'upstream_error',
      detail: (data.errors || []).map((e) => e.message).join('; '),
    });
  }

  return data;
}

/* ── endpoints ─────────────────────────────────────────────────── */

/**
 * GET / — the full catalog of forms, flattened across Marketo's offset paging.
 * @param {object} env
 * @returns {Promise<object>}
 */
async function listForms(env) {
  const maxReturn = Math.min(Number(env.MAX_RETURN) || 200, 200);
  const status = env.FORMS_STATUS || 'approved';
  const forms = [];
  let offset = 0;

  // Marketo returns at most `maxReturn` per call; page until a short page.
  // The 50-page ceiling is a runaway guard, not an expected limit.
  for (let page = 0; page < 50; page += 1) {
    const path = `/rest/asset/v1/forms.json?maxReturn=${maxReturn}&offset=${offset}&status=${encodeURIComponent(status)}`;
    // Sequential by necessity: the next offset depends on this page's size.
    // eslint-disable-next-line no-await-in-loop
    const data = await marketoGet(env, path);
    const batch = data.result || [];
    batch.forEach((f) => {
      forms.push({
        id: f.id,
        name: f.name,
        locale: f.locale || '',
        status: f.status || '',
        url: f.url || '',
      });
    });
    if (batch.length < maxReturn) break;
    offset += maxReturn;
  }

  forms.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return { forms, count: forms.length, fetchedAt: new Date().toISOString() };
}

/**
 * GET /fields?formId=<id> — the fields of one form, for Field Name suggestions.
 * @param {object} env
 * @param {string} formId
 * @returns {Promise<object>}
 */
async function listFields(env, formId) {
  const data = await marketoGet(env, `/rest/asset/v1/form/${encodeURIComponent(formId)}/fields.json`);
  const fields = (data.result || []).map((f) => ({
    name: f.name,
    label: (f.label || '').replace(/<[^>]*>/g, '').trim(),
    type: f.dataType || f.fieldType || '',
    required: Boolean(f.required),
  })).filter((f) => f.name);

  return { formId: String(formId), fields, fetchedAt: new Date().toISOString() };
}

/* ── worker entry ──────────────────────────────────────────────── */

export default {
  /**
   * @param {Request} request
   * @param {object} env
   * @returns {Promise<Response>}
   */
  async fetch(request, env) {
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== 'GET') {
      return fail('method_not_allowed', 'Only GET is supported.', 405, cors);
    }
    if (!env.MARKETO_REST_URL || !env.MARKETO_CLIENT_ID || !env.MARKETO_CLIENT_SECRET) {
      return fail('not_configured', 'Marketo credentials are not set on this service.', 503, cors);
    }

    const url = new URL(request.url);
    // Tolerate the worker being mounted on a sub-path (e.g. /marketo/fields).
    const isFields = url.pathname.replace(/\/+$/, '').endsWith('/fields');

    try {
      if (isFields) {
        const formId = url.searchParams.get('formId') || '';
        if (!/^\d+$/.test(formId)) {
          return fail('invalid_form_id', 'formId is missing or non-numeric.', 400, cors);
        }
        return json(await listFields(env, formId), 200, cors);
      }
      return json(await listForms(env), 200, cors);
    } catch (err) {
      const code = err.code || 'upstream_error';
      // Detail goes to the log, not to the browser.
      // eslint-disable-next-line no-console
      console.error('marketo-service', code, err.detail || err.message);
      return fail(code, 'Unable to reach Marketo. Please try again.', 502, cors);
    }
  },
};
