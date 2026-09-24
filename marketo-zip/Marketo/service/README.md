# Forms Service — optional backend for the form picker

**You do not need this to use the plugin.** Without it, authors type a numeric
Form ID into the DA dialog and everything works. Deploy it when you want authors
to search live Marketo forms **by name** instead.

## Why a backend is required at all

The plugin cannot call Marketo's Asset REST API from the browser:

1. The API authenticates with an OAuth **client secret**, which must never be
   shipped to a browser.
2. Marketo sends no CORS headers, so the request would be blocked regardless.

So a small server-side proxy holds the credentials and re-exposes two read-only
endpoints to the authoring dialog:

```
DA plugin ──GET──► your service ──OAuth──► Marketo Asset REST API
```

The browser never sees a credential. The service is read-only — it cannot create,
modify, or submit anything in Marketo.

## Contract

Implement these two endpoints on any stack. `formsServiceUrl` in
`tools/marketo/marketo-config.js` points at the base URL; the plugin appends
nothing for the catalog and `/fields` for the field lookup.

### `GET {base}` — form catalog

```json
{
  "forms": [
    { "id": 1234, "name": "Contact Us", "locale": "en_US", "status": "approved", "url": "..." }
  ],
  "count": 1,
  "fetchedAt": "2026-01-01T00:00:00.000Z"
}
```

Only `id` and `name` are required per entry. `locale` is shown next to the name
in the picker when present. Anything else is ignored.

### `GET {base}/fields?formId=<id>` — field-name suggestions

```json
{
  "formId": "1234",
  "fields": [
    { "name": "LeadSource", "label": "Lead Source", "type": "string", "required": false }
  ],
  "fetchedAt": "2026-01-01T00:00:00.000Z"
}
```

Only `name` is required. These populate the autocomplete on the Values tab; a
failure here is non-fatal — the plugin falls back to `fallbackFieldNames` from
the config file.

### Errors

```json
{ "error": { "code": "upstream_error", "message": "Unable to reach Marketo. Please try again." } }
```

| Status | `code` | Meaning |
| --- | --- | --- |
| 400 | `invalid_form_id` | `formId` missing or non-numeric |
| 405 | `method_not_allowed` | Non-GET request |
| 502 | `auth_failed` / `auth_malformed` | OAuth token request failed |
| 502 | `upstream_error` | Marketo API error (after one token retry) |
| 503 | `not_configured` | Credentials not set on the service |

The plugin does not parse the envelope — any non-2xx response makes it fall back
to manual Form ID entry, and it says so in the dialog. The codes exist for your
logs.

### CORS

The service must allow the origins the dialog runs on. At minimum `https://da.live`
and `https://content.da.live`; add your EDS preview/live hosts and
`http://localhost:3000` for local development. Keep the list to exact origins and
narrow wildcards — this endpoint exposes your form catalog.

## Reference implementation

`cloudflare-worker/` is a complete, dependency-free implementation: OAuth with a
cached token, offset pagination over the full catalog, retry on token expiry, and
a strict CORS allowlist. About 250 lines, deployable in a few minutes.

```bash
cd cloudflare-worker
npm install -g wrangler          # if you don't have it
# fill in MARKETO_REST_URL, MARKETO_CLIENT_ID and ALLOWED_ORIGINS in wrangler.toml
wrangler secret put MARKETO_CLIENT_SECRET
wrangler deploy
```

Then paste the deployed URL into `tools/marketo/marketo-config.js`:

```js
formsServiceUrl: 'https://marketo-forms-service.<your-subdomain>.workers.dev',
```

### Getting the Marketo credentials

1. **Admin → Users & Roles → Roles** — create a role with `Access API → Read-Only Assets`.
2. **Admin → Users & Roles → Users → Invite New User** — create an API-Only user with that role.
3. **Admin → LaunchPoint → New Service** — service type `Custom`, assign that user.
   **View Details** gives you the Client Id and Client Secret.
4. **Admin → Web Services** — copy the REST **Endpoint**; `MARKETO_REST_URL` is
   that URL minus the trailing `/rest`.

### Deploying somewhere else

Nothing about the plugin is Cloudflare-specific. The same ~250 lines port
directly to a Lambda + Function URL, a Vercel/Netlify function, an Express
route, or an AEM Sling servlet. Match the two endpoints and the CORS behaviour
above and the plugin cannot tell the difference.

Whatever you choose, keep two properties: the client secret stays server-side,
and the token is cached rather than minted per request (Marketo enforces a daily
quota on token requests).
