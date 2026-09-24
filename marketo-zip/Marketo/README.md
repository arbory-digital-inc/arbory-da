# Marketo Forms for AEM Edge Delivery Services

A drop-in block and DA authoring dialog for embedding Marketo forms in Edge
Delivery Services pages. Portable across projects: every client-specific value
lives in one config file, and the styling resolves through neutral tokens you can
map to your own design system.

**New here? → [INSTALL.md](INSTALL.md) gets a form on a page in about ten minutes.**

---

## Contents

1. [What you get](#what-you-get)
2. [Files](#files)
3. [Configuration](#configuration)
4. [Authoring model](#authoring-model)
5. [The DA Library dialog](#the-da-library-dialog)
6. [Theming](#theming)
7. [Security](#security)
8. [Accessibility](#accessibility)
9. [Testing](#testing)
10. [Troubleshooting](#troubleshooting)

---

## What you get

- **A block** authors configure with a plain key/value table — no JSON, no code.
- **A DA Library dialog** that builds that table for them, with a searchable form
  picker when a catalog service is available and direct Form ID entry when it is not.
- **Form-quality guardrails** the stock Marketo embed does not give you: every
  empty required field is marked at once (Marketo marks only the first), pasted
  spam links are defanged, and email/phone values are sanity-checked before submit.
- **Themeable styling** that overrides Marketo's default form CSS to match your
  site — labels above fields, full-width reflow, branded controls and buttons.

### Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  Document Authoring (DA)                  │
│  Author inserts a "Marketo Form" table  ── or uses ──►    │
│  the Library dialog, which builds that same table         │
└──────────────┬───────────────────────────────────────────┘
               │  .plain.html
               ▼
┌──────────────────────────────────────────────────────────┐
│                     EDS Block System                      │
│  Loads blocks/marketo-form/marketo-form.{js,css}          │
└──────────────┬───────────────────────────────────────────┘
               │  delegates
               ▼
┌──────────────────────────────────────────────────────────┐
│                tools/marketo/marketo.js                   │
│                                                           │
│  1. parseConfig()     — read the authored rows            │
│  2. resolveSettings() — inline config + optional sheet    │
│  3. validate Form ID and Redirect URL                     │
│  4. build accessible DOM container                        │
│  5. loadMarketoSDK()  — MktoForms2, once, deduped         │
│  6. MktoForms2.loadForm() — embed the form                │
│  7. addHiddenFields() — inject prefills                   │
│  8. onSubmit()        — sanitize visible user input       │
│  9. onSuccess()       — inline message or redirect        │
│ 10. initMunchkin()    — page tracking (optional)          │
└──────────────┬───────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────┐
│                      Marketo Cloud                        │
│  MktoForms2 serves the form definition + validation       │
│  Submissions go straight to the Marketo lead database     │
└──────────────────────────────────────────────────────────┘
```

Form submissions go **directly** from the browser to Marketo. There is no proxy
in that path, so nothing is added to submit latency and no backend can drop a
lead. The optional service in `service/` is used only by the authoring dialog, at
authoring time.

### Design decisions

| Decision | Rationale |
| --- | --- |
| Block delegates to `tools/marketo/` | Keeps the integration logic reusable and the block a thin wrapper — a second block (say, a modal form) can share it. |
| All client values in one config file | The whole package is portable. Installing it in a new project means editing two lines, not grepping for hostnames. |
| SDK loaded once via promise dedupe | Multiple forms on one page load one script. |
| Config from table rows, not JSON | Standard EDS content model — authors stay in the document. |
| Hidden fields via `addHiddenFields()` | Official MktoForms2 API; injected at submit time, invisible to the user. |
| Catalog service optional | The plugin is fully usable with zero backend; the service only upgrades "type an ID" to "search by name". |
| Neutral CSS tokens | Restyling for a new brand is one small block of overrides, not a fork of the stylesheet. |

---

## Files

```
blocks/marketo-form/
├── marketo-form.js        Block entry point — delegates to tools/marketo/
├── marketo-form.css       Imports the shared stylesheet
└── marketo-form.md        Authoring model / block contract

tools/marketo/
├── marketo-config.js      ← THE ONLY FILE YOU MUST EDIT
├── marketo.js             Runtime renderer
├── marketo.css            Form styling (themeable tokens)
├── marketo-plugin.html    DA Library dialog shell
├── marketo-plugin.js      DA Library dialog logic
├── marketo-plugin.css     DA Library dialog styling
└── marketo-icon.svg       Library palette icon

service/                   Optional backend for the form picker
├── README.md              Endpoint contract — implement on any stack
└── cloudflare-worker/     Deployable reference implementation

test/blocks/marketo-form/  Web-test-runner tests for required-field marking
examples/                  Sample per-site config sheet
```

---

## Configuration

Everything lives in `tools/marketo/marketo-config.js`. The two required values:

```js
baseUrl: '//123-ABC-456.mktoweb.com',   // or a branded CNAME: '//engage.example.com'
munchkinId: '123-ABC-456',
```

**Where to find them in Marketo**

| Value | Location |
| --- | --- |
| `baseUrl` | Admin → Landing Pages → the domain shown there. Or copy it from any Design Studio → Forms → **Embed Code** dialog. |
| `munchkinId` | Admin → Munchkin → Munchkin Account ID. Format `123-ABC-456`. |
| A form's ID | Design Studio → Forms → open the form. The URL ends `.../FM1234A1` → the ID is `1234`. |

Everything else is optional and documented inline in the config file:
Munchkin on/off and its init options, the per-site override sheet, the forms
service URL, field-name suggestions, input-sanitization switches, and every
user-facing string (for translation or rewording).

### Per-site overrides (multi-site setups)

Skip this unless one codebase serves several sites or locales that need different
Marketo instances. If so, publish a two-column DA sheet and point `sheet.path` at
it; values found there override the inline ones **per site, with no deploy**:

| key | value |
| --- | --- |
| `marketo-base-url` | `//123-ABC-456.mktoweb.com` |
| `marketo-munchkin-id` | `123-ABC-456` |
| `marketo-munchkin-id-sandbox` | `789-XYZ-012` |

See [examples/marketo-config.json](examples/marketo-config.json) for the exact
served shape. Set `sheet.path: ''` to disable the lookup and save a fetch.

---

## Authoring model

A two-column table. Row 1 names the block; every other row is `Key | Value`.

```
| Marketo Form                                  |
| --------------- | --------------------------- |
| Form ID         | 1234                        |
| Title           | Contact Us                  |
| Description     | Complete the form and we'll be in touch |
| Success Message | Thank you! We'll respond within 24h     |
| Redirect URL    | /contact/thank-you          |
| Field Mapping   | LeadSource=Website          |
| Field Mapping   | MktoPersonNotes=General     |
```

| Key | Required | Description |
| --- | --- | --- |
| `Form ID` | **Yes** | Numeric Marketo form ID. This exact key — `Id`/`ID` alone matches nothing and the form silently never loads. |
| `Title` | No | Heading (h2) above the form. |
| `Description` | No | Subtext (h3) below the title. |
| `Success Message` | No | Inline message shown in place of the form after a successful submit. |
| `Redirect URL` | No | Where to send the user after submit. **Takes precedence** over `Success Message`. |
| `Submit Button Text` | No | Overrides the submit button label. |
| `Sandbox` | No | `true` selects the sandbox Munchkin ID. Defaults to `false`. |
| `Field Mapping` | No | Hidden field prefill as `fieldName=value`. Repeatable — one row per field. `Hidden Fields` is an accepted alias. |

Unrecognised keys are ignored. See
[blocks/marketo-form/marketo-form.md](blocks/marketo-form/marketo-form.md) for
the machine-readable contract.

---

## The DA Library dialog

Registering the dialog lets authors insert a form from the Library palette rather
than building the table by hand. It produces exactly the same table, so the two
paths are interchangeable.

**Register it** — add a row to the **library** tab of your DA config sheet at
`https://da.live/config#/{org}/{site}/`:

| title | path | format | ref | icon | experience |
| --- | --- | --- | --- | --- | --- |
| Marketo Form | `https://main--{site}--{org}.aem.live/tools/marketo/marketo-plugin.html` | | | `https://main--{site}--{org}.aem.live/tools/marketo/marketo-icon.svg` | dialog |

Publish the config sheet, then reopen the Library in any document.

Notes:
- `experience: dialog` opens the plugin as a dialog inside the Library.
- Some DA setups want a raster icon — export `marketo-icon.svg` to PNG and point
  the column at that instead. The `icon` column is optional either way.
- For local development, set `ref=local` in the config and run `aem up`, or open
  the plugin directly at `http://localhost:3000/tools/marketo/marketo-plugin.html`.

### Two modes

The dialog adapts to whether `formsServiceUrl` is configured:

| | **Manual mode** (no service) | **Catalog mode** (service configured) |
| --- | --- | --- |
| Choosing a form | Author types the numeric Form ID | Author searches live forms by name |
| Field Name suggestions | `fallbackFieldNames` from the config | Real fields of the selected form |
| Backend needed | None | The service in `service/` |

Catalog mode degrades to manual automatically if the service is unreachable, and
a typed numeric ID is always accepted even when the catalog is loaded — so a form
missing from the catalog is never a dead end.

**Author flow:** open the Library → **Marketo Form** → pick or type the form →
optionally set title, description, button label, and either a Success URL or a
Success Message → add hidden-field values on the **Values** tab → **Insert**.

---

## Theming

Every colour, font, radius and width in `tools/marketo/marketo.css` resolves
through a `--mkto-*` custom property. Defaults are brand-neutral, so the block
looks correct before you touch anything.

To brand it, map the tokens once, anywhere in your site CSS:

```css
.marketo-form {
  --mkto-accent:       var(--color-brand);
  --mkto-accent-hover: var(--color-brand-dark);
  --mkto-font-family:  var(--body-font-family);
  --mkto-max-width:    var(--grid-container-width);
  --mkto-radius:       4px;
}
```

| Token | Controls | Default |
| --- | --- | --- |
| `--mkto-font-size` | Type size for all labels, inputs and options | `18px` |
| `--mkto-font-family` | Form typeface | `inherit` |
| `--mkto-max-width` | Outer width of the block | `1280px` |
| `--mkto-accent` | Focus states, checked controls, submit button | `#1473e6` |
| `--mkto-accent-hover` | Hover state of the above | `#0d66d0` |
| `--mkto-accent-tint` / `--mkto-accent-ring` | Hover tint and focus ring | derived from `--mkto-accent` |
| `--mkto-text` / `--mkto-label-color` | Body and label text | `#16181d` |
| `--mkto-surface` | Input and control background | `#fff` |
| `--mkto-border` | Input and control borders | `#cacaca` |
| `--mkto-error` / `--mkto-error-dark` / `--mkto-error-bg` | Validation states | red scale |
| `--mkto-radius` | Corner radius on inputs, buttons, controls | `0` |
| `--mkto-transition` | Transition timing | `0.2s ease` |

`--mkto-accent-tint` and `--mkto-accent-ring` derive from `--mkto-accent` via
`color-mix()`, so setting the accent alone gets you consistent hover and focus
treatments.

### Why the stylesheet fights Marketo so hard

Marketo emits inline pixel widths and injects its own `<style>` block inside the
form, which is why `!important` appears throughout `marketo.css`. Those overrides
do three things: force labels above fields and everything to full width so the
form reflows responsively (Marketo's fixed pixel columns otherwise cause
horizontal scroll on tablet), restyle the checkbox/radio controls (the Marketo
theme hides the real input and draws the visible control on the label's
`::before`, so styling the input does nothing), and brand the submit button.

Layout stays Marketo's job — this is a cosmetic layer, not a replacement
renderer. Section-level concerns like full-bleed backgrounds and narrower
containers belong in Section Metadata, not here.

---

## Security

**Credentials.** No Marketo credential ever reaches the browser. The Munchkin ID
is a public identifier, present in every Marketo embed. The Asset API client
secret exists only if you deploy the optional service, and it stays there.

**Submitted input.** Before submission, visible user-entered fields are cleaned:
HTML tags stripped, values clamped to `maxFieldLength`, and pasted URLs defanged
(`https://spam.example` → `hxxps://spam[.]example`) so form-spam links stop being
clickable in Marketo, your CRM, and notification emails — while a legitimate URL
a lead types stays readable. Fields whose name contains `email` or `phone`/`mobile`
are format-checked and block submission with an inline message when malformed.

Hidden and system fields are **never** touched, so tracking parameters, referrer
data and your injected field mappings arrive intact and attribution stays
correct. Each step is switchable in `marketo-config.js` → `sanitize`.

This is defence in depth, not a substitute for Marketo-side protection — enable
reCAPTCHA on high-value forms.

**Content-Security-Policy.** If your site sends a CSP, allow your Marketo host:

```
script-src  {your-marketo-host}
style-src   {your-marketo-host}
connect-src {your-marketo-host}
frame-src   {your-marketo-host}
img-src     {your-marketo-host}
```

For example, in an EDS `helix-config` or your CDN's header rules:

```json
{
  "headers": {
    "Content-Security-Policy": "script-src 'self' engage.example.com; style-src 'self' 'unsafe-inline' engage.example.com; connect-src 'self' engage.example.com; frame-src engage.example.com; img-src 'self' data: engage.example.com"
  }
}
```

Marketo injects inline styles into its own form markup, so `style-src` needs
`'unsafe-inline'`.

**Redirect URLs.** `Redirect URL` accepts relative paths and absolute `http`/`https`
URLs only; anything else is dropped with a console warning, so an author cannot
introduce a `javascript:` redirect.

**Privacy.** Munchkin sets a first-party tracking cookie. If your consent
framework must gate that, set `enableMunchkin: false` and initialise Munchkin
from your consent manager instead — forms keep working either way.

---

## Accessibility

- Title and description render as real `h2`/`h3` headings.
- The form carries an `aria-label` from the title.
- Inputs without a `<label>` get an `aria-label` from their field name.
- Success messages use `role="status"` + `aria-live="polite"`; errors use
  `role="alert"`.
- The Library dialog's form picker is a proper `role="combobox"` with arrow-key
  navigation, `aria-activedescendant`, and Escape to close.
- **Required-field marking:** Marketo's own validation stops at the first invalid
  field, so a user with three empty required fields sees one red box, fills it,
  submits, and meets the next. This package marks all of them in one pass, and
  clears each mark as soon as that field is filled. Marking is gated behind the
  first submit press, so nothing turns red while the user is still typing.

---

## Testing

Tests cover the required-field marking logic and run under
[@web/test-runner](https://modern-web.dev/docs/test-runner/overview) — the
standard EDS test setup.

```bash
npm test
```

If your project has no test runner yet:

```bash
npm i -D @web/test-runner @esm-bundle/chai
npx web-test-runner "test/**/*.test.js" --node-resolve
```

`markEmptyRequiredFields`, `isFieldEmpty`, `wireInvalidClearing`,
`sanitizeFieldValue` and `parseConfig` are exported from `tools/marketo/marketo.js`
specifically so they can be tested without a live Marketo instance.

---

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| Nothing renders, console says *"not configured"* | `baseUrl` or `munchkinId` is empty. Set both in `marketo-config.js` (or in the config sheet). |
| Nothing renders, console says *"missing Form ID"* | The block table has no `Form ID` row, or it is keyed `ID`. Use exactly `Form ID`. |
| *"Unable to load the form"* on the page | The Form ID does not exist in **this** Marketo instance, or the form is unapproved. Sandbox IDs do not resolve against production — check the `Sandbox` row. |
| Form renders unstyled or oddly wide | `marketo.css` isn't loading. Check the `@import` path in `blocks/marketo-form/marketo-form.css` matches where you put `tools/marketo/`. |
| Console CSP violations mentioning your Marketo host | Add the host to `script-src`, `style-src`, `connect-src`, `frame-src`, `img-src`. |
| Library dialog is blank | The plugin is served from your EDS host and must be published. Confirm the `path` in the DA library config resolves in a browser. |
| Dialog says *"Unable to load the form catalog"* | The service is down, or its CORS allowlist is missing `https://da.live`. Authors can still type a Form ID; fix the allowlist in `wrangler.toml` → `ALLOWED_ORIGINS`. |
| Picker shows no forms but no error | `FORMS_STATUS` is `approved` and your forms are drafts. Approve them, or relax the setting. |
| Submitted values look mangled | The sanitizer defangs URLs by design. If a field legitimately carries URLs, set `defangUrls: false` in `marketo-config.js` → `sanitize`. |
| Redirect ignored after submit | `Redirect URL` failed validation (must be a relative path or an `http`/`https` URL) — check the console warning. |
| Tracking doesn't fire | `enableMunchkin` is `false`, or another Munchkin instance already loaded on the page (the block defers to it). |
