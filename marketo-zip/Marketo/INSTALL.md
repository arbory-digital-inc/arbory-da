# Install — 10 minute quick start

Full detail lives in [README.md](README.md). This is the shortest path to a
working form.

## 1. Copy the files into your EDS project

```
blocks/marketo-form/     →  your-project/blocks/marketo-form/
tools/marketo/           →  your-project/tools/marketo/
test/blocks/marketo-form/→  your-project/test/blocks/marketo-form/   (optional)
```

Keep the two directories as siblings — the block imports `../../tools/marketo/`.
If your project uses a different layout, adjust the two import paths in
`blocks/marketo-form/marketo-form.js` and `marketo-form.css`.

## 2. Fill in two values

In `tools/marketo/marketo-config.js`:

```js
baseUrl: '//123-ABC-456.mktoweb.com',   // Marketo → Admin → Landing Pages
munchkinId: '123-ABC-456',              // Marketo → Admin → Munchkin
```

That is the entire required configuration. Everything else in that file has a
working default.

## 3. Allow Marketo in your CSP

If your site sends a Content-Security-Policy, add your Marketo host to
`script-src`, `style-src`, `connect-src`, `frame-src` and `img-src`. Skip this
step if you don't set a CSP.

## 4. Author a form

Add a `Marketo Form` block to a page with one row:

```
| Marketo Form |      |
| ------------ | ---- |
| Form ID      | 1234 |
```

Preview the page. The form renders.

## 5. (Optional) Turn on the authoring dialog

So authors insert forms from the DA Library instead of typing tables. Add a row
to the **library** tab of your DA config sheet
(`https://da.live/config#/{org}/{site}/`):

| title | path | icon | experience |
| --- | --- | --- | --- |
| Marketo Form | `https://main--{site}--{org}.aem.live/tools/marketo/marketo-plugin.html` | `https://main--{site}--{org}.aem.live/tools/marketo/marketo-icon.svg` | dialog |

Publish the config sheet and reopen the Library in any document.

## 6. (Optional) Let authors search forms by name

Deploy the service in [service/](service/README.md) and paste its URL into
`formsServiceUrl` in `marketo-config.js`. Without it the dialog asks for a
numeric Form ID, which is perfectly usable — this step is a convenience for
marketers who don't know form IDs.

## Checklist

- [ ] Files copied, sibling directories preserved
- [ ] `baseUrl` and `munchkinId` set
- [ ] CSP updated (if you send one)
- [ ] Test form renders on a preview page
- [ ] Brand tokens mapped (see *Theming* in the README) — optional but quick
- [ ] Library dialog registered — optional
- [ ] Forms service deployed — optional
