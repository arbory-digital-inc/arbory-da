---
block: marketo-form
summary: Embeds a Marketo form by its numeric Form ID, with optional title/description, post-submit behavior, prefilled hidden fields, and a sandbox toggle. Delegates rendering to the shared Marketo initializer (tools/marketo/marketo.js).
model: key-value
keys:
  form id: { domain: number, required: true }
  title: { domain: rich }
  description: { domain: rich }
  success message: { domain: rich }
  redirect url: { domain: text }
  submit button text: { domain: text }
  sandbox: { values: [true, false] }
  field mapping: { domain: text }
  hidden fields: { domain: text }
variants: { classes: [] }
rules:
  - "Key/value block (canonical model: Configuration). Each row is `Key | Value`. Keys match case-insensitively; tools/marketo/marketo.js `parseConfig` normalizes each label to lowercase-hyphenated (`Form ID`→`form-id`) and dispatches on that."
  - "`Form ID` (REQUIRED) is the numeric Marketo form id to load (e.g. 1234). It is the ONLY identifier key the block reads — a bare `Id`/`ID` matches nothing (`parseConfig` has no `id` case), so the form silently never loads. Always author `Form ID`."
  - "`Title` / `Description` render above the form. `Success Message` and `Redirect URL` control post-submit behavior (redirect wins if both set). `Submit Button Text` overrides the button label."
  - "`Sandbox` (`true`/`false`, default false) selects the sandbox Munchkin id configured in tools/marketo/marketo-config.js instead of the production one."
  - "`Field Mapping` (repeatable; alias `Hidden Fields`) prefills a hidden field, one row each, as `fieldName=value` (e.g. `LeadSource=Website`)."
  - "No class variants. The block delegates all rendering/validation/tracking to the shared initializer; a migration only needs to guarantee a form is PRESENT with the source form id (the styling is the block's, not the author's)."
---

# Marketo Form

**Canonical model: Configuration** — a two-column `Key | Value` table that drives dynamic behavior (loading and configuring a Marketo form via the MktoForms2 SDK). Not static content forced into key/value rows: the keys genuinely parameterize an SDK call, so Configuration is the correct model.

## Purpose

Embed a Marketo lead/contact form on a page or fragment by its numeric **Form ID**, optionally styled with a title/description and wired to post-submit behavior and hidden-field prefills.

## DA block table

Verbatim expected layout (from `tools/marketo/marketo.js` → `parseConfig`):

```
| Marketo Form                                  |
| --------------- | --------------------------- |
| Form ID         | 1234                        |
| Title           | Contact Us                  |
| Description     | Fill out the form below...  |
| Success Message | Thank you for contacting us |
| Redirect URL    | /contact/thank-you          |
| Field Mapping   | LeadSource=Website          |
| Field Mapping   | MktoPersonNotes=General     |
```

## Structure

- Row 1 (header) names the block: `Marketo Form`.
- Every subsequent row is `Key | Value`. The key cell must be short plain text (no headings/lists/media). Unknown keys are ignored by the block, so keep to the field reference below.

## Field reference

| Key | Domain | Required | Notes |
| --- | --- | --- | --- |
| `Form ID` | number | ✅ | Marketo form id to load (e.g. `1234`). The only id key — not `Id`/`ID`. |
| `Title` | rich | – | Heading rendered above the form. |
| `Description` | rich | – | Copy rendered above the form. |
| `Success Message` | rich | – | Message shown on successful submit (if no redirect). |
| `Redirect URL` | text | – | Path to redirect to after submit (wins over Success Message). |
| `Submit Button Text` | text | – | Overrides the submit button label. |
| `Sandbox` | `true`\|`false` | – | Use the sandbox Munchkin id. Default `false` (production). |
| `Field Mapping` | text | – | Repeatable. Prefills a hidden field: `fieldName=value`. |
| `Hidden Fields` | text | – | Alias of `Field Mapping`. |

## Authoring guide

The DA Library dialog (`tools/marketo/marketo-plugin.html`) builds this table for you. To author it by hand:

1. Insert the `Marketo Form` block.
2. Add a `Form ID` row with the numeric form id — this is required; without it no form loads.
3. Add any optional rows (`Title`, `Description`, `Success Message`, `Redirect URL`, `Submit Button Text`).
4. For prefilled hidden fields, add one `Field Mapping` row per field as `fieldName=value`.
5. Leave `Sandbox` off (or omit) for production; set `true` only when pointing at a Marketo sandbox.

## Examples

**Minimum** (required field only):

```
| Marketo Form |      |
| ------------ | ---- |
| Form ID      | 1234 |
```

**Full**:

```
| Marketo Form                                  |
| --------------- | --------------------------- |
| Form ID         | 1234                        |
| Title           | Contact our team            |
| Description     | A representative will be in touch. |
| Redirect URL    | /contact/thank-you          |
| Field Mapping   | LeadSource=Website          |
```

## Implementation notes

- Block wrapper: `blocks/marketo-form/marketo-form.js` (delegates to the shared initializer).
- Shared logic: `tools/marketo/marketo.js` — `parseConfig` (key parsing), form load via the MktoForms2 SDK, Munchkin tracking, field prefill, success/redirect handling.
- Instance settings (host, Munchkin ID, copy, behaviour toggles): `tools/marketo/marketo-config.js`.
- No class variants are consumed.
