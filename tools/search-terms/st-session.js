/* --------------------------------------------------------------------------
 * Search Terms Manager — the DA session
 *
 * ONE MODULE, and one line of real content, so that the rest of the tool stays
 * importable outside DA. `DA_SDK` resolves a top-level await against da.live:
 * importing it anywhere else would make that module unloadable in the test
 * runner and unreadable from a plain page, which is why the sheet model, the
 * validation and the site list all live in st-config.js instead.
 *
 * The token here is the SHORT-LIVED DA IMS bearer. It expires. Nothing refreshes
 * it — the tool is reloaded from DA, which mints a new one. It is emphatically
 * not the static per-site preview-host protection header, which never expires
 * and is not usable here.
 * ------------------------------------------------------------------------ */

// eslint-disable-next-line import/no-unresolved -- served by da.live at runtime
import DA_SDK from 'https://da.live/nx/utils/sdk.js';

/* `email` is who DA signed in, so a notice can tell "you, in another tab" from
   somebody else. The shell sends it when it has it; it can be absent. */
export const { context, token, email } = await DA_SDK;

/*
 * The org of whatever context the tool was opened from. One session token writes
 * to every site under it — the same assumption the Icon Manager runs on, and
 * verified there across these repos. The fallback matters because a DA app can
 * be opened with no context, and a tool that renders nothing at all is harder to
 * diagnose than one that says which site it is looking at.
 */
export const ORG = context?.org || 'arbory-digital-inc';
