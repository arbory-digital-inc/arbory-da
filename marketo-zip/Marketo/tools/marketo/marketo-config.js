/*
 * Marketo Forms — Configuration
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  THIS IS THE ONLY FILE YOU MUST EDIT TO INSTALL THE PLUGIN.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Everything client-specific lives here. `marketo.js` (the runtime renderer) and
 * `marketo-plugin.js` (the DA authoring dialog) both read from it, so no other
 * file contains a hostname, an account ID, or a service URL.
 *
 * Minimum viable setup: fill in `baseUrl` and `munchkinId`. Everything else is
 * optional and has a working default.
 *
 * Two ways to supply values — they compose:
 *
 *   1. INLINE (here). Simplest. Right when one codebase serves one Marketo
 *      instance.
 *   2. DA CONFIG SHEET (`sheet.path` below). Right when one codebase serves
 *      several sites/locales that each need their own Munchkin ID. Values found
 *      in the sheet OVERRIDE the inline values below, per site, with no code
 *      change and no deploy.
 *
 * If you use neither, the block logs a clear console error and renders a
 * generic "configuration error" message rather than failing silently.
 */

const MARKETO_CONFIG = {
  /* ── Marketo instance ────────────────────────────────────────────────────
   * Your Marketo Forms/Munchkin host, protocol-relative. This is where the
   * MktoForms2 SDK, Munchkin tracker and form definitions are served from.
   *
   * Use whichever of these applies:
   *   - Default Marketo host:  '//123-ABC-456.mktoweb.com'
   *   - Branded CNAME:         '//engage.example.com'
   *
   * Find it in Marketo: Admin → Landing Pages → the domain shown there, or
   * copy it out of any "Embed Code" dialog under Design Studio → Forms.
   */
  baseUrl: '',

  /* ── Munchkin account ID ─────────────────────────────────────────────────
   * Your Marketo account ID, in the form '123-ABC-456'.
   * Find it in Marketo: Admin → Munchkin → Munchkin Account ID.
   *
   * `munchkinIdSandbox` is optional. It is used only when an author sets the
   * block's `Sandbox` row to `true`, which is handy for testing forms against a
   * sandbox subscription without touching production content.
   */
  munchkinId: '',
  munchkinIdSandbox: '',

  /* ── Munchkin page tracking ──────────────────────────────────────────────
   * Whether to load munchkin.js for page-level visitor tracking alongside the
   * form. The form itself works either way; turn this OFF if your site already
   * loads Munchkin elsewhere (e.g. via a tag manager) or if your consent
   * framework must gate it.
   *
   * `munchkinOptions` is passed straight to `Munchkin.init()`.
   */
  enableMunchkin: true,
  munchkinOptions: { asyncOnly: true, domainLevel: 2 },

  /* ── Per-site overrides via a DA config sheet ────────────────────────────
   * Optional. Point `path` at a published DA sheet with a `key` / `value`
   * column pair; any key listed under `keys` that is present in the sheet wins
   * over the inline value above. Set `path` to '' to disable the lookup
   * entirely (one less fetch per page).
   *
   * See examples/marketo-config.json for the exact shape expected.
   */
  sheet: {
    path: '/data/marketo-config.json',
    keys: {
      baseUrl: 'marketo-base-url',
      munchkinId: 'marketo-munchkin-id',
      munchkinIdSandbox: 'marketo-munchkin-id-sandbox',
    },
  },

  /* ── Form catalog service (DA authoring dialog only) ─────────────────────
   * Optional. URL of a server-side proxy that brokers the Marketo Asset REST
   * API, so authors can pick a form BY NAME instead of hunting for its numeric
   * ID. Marketo's REST API sends no CORS headers and requires an OAuth secret,
   * so this cannot be called from the browser directly — hence the proxy.
   *
   * Leave it EMPTY and everything still works: the dialog falls back to a
   * "type the numeric Form ID" input, and the runtime block is unaffected
   * (it never calls this service at all).
   *
   * A ready-to-deploy reference implementation and the endpoint contract are in
   * service/ — deploy it, paste the URL here, done.
   */
  formsServiceUrl: '',

  /* Field-name suggestions offered in the dialog's Values tab when no service
   * is configured, or when the per-form field lookup fails. These are standard
   * Marketo field names; add your own custom fields here so authors do not have
   * to remember them. Purely a convenience — authors can always type any name. */
  fallbackFieldNames: [
    'LeadSource',
    'Campaign',
    'MktoPersonNotes',
    'utm_campaign',
    'utm_medium',
    'utm_source',
  ],

  /* ── Submitted-value hygiene ─────────────────────────────────────────────
   * Applied to VISIBLE, user-entered fields only, before submission. Hidden and
   * system fields (tracking params, injected field mappings) are never touched,
   * so marketing attribution data is preserved exactly.
   *
   * `maxFieldLength` truncates over-long values.
   * `defangUrls` neutralises links pasted by form spammers — the text survives
   *   but stops being clickable in Marketo/CRM/email views.
   * `validateEmailFields` / `validatePhoneFields` block submission with an
   *   inline message when a field whose NAME contains "email" / "phone" or
   *   "mobile" holds an obviously malformed value.
   */
  sanitize: {
    maxFieldLength: 500,
    defangUrls: true,
    validateEmailFields: true,
    validatePhoneFields: true,
  },

  /* ── Author-facing copy ──────────────────────────────────────────────────
   * Every string the block can put on screen. Translate or reword freely.
   */
  messages: {
    defaultSuccess: 'Thank you. Your submission has been received.',
    successHeading: 'Success',
    loadError: 'Unable to load the form. Please try again later.',
    configError: 'Form configuration error. Please contact the site administrator.',
    invalidEmail: 'Please enter a valid email address.',
    invalidPhone: 'Please enter a valid phone number.',
  },
};

export default MARKETO_CONFIG;
