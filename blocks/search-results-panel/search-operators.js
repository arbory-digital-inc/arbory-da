/*
 * SEARCH OPERATORS — `AND`, `OR` and "quoted phrases" in the query box.
 *
 * Before this, all three were ordinary text. The index uses the `standard`
 * analyzer with no stop words, and nearly every page contains "and" or "or", so
 * typing an operator WIDENED the search instead of narrowing it. Measured on the
 * dev index this was built against (`hits.total`, 2026-11-04):
 * `cybersecurity tariff` matched 897 pages and `cybersecurity AND tariff` 4,683
 * of the site's 4,697. Quotes never made a phrase: `"private equity"` and
 * `private equity` both matched 1,359.
 *
 * THE RULES
 *
 *   - Only UPPERCASE `AND` and `OR`, standing alone, are operators. Lowercase is
 *     a word, so "mergers and acquisitions" means what it always meant.
 *   - An OPERAND is the run of words and phrases between two operators. Its loose
 *     words match the way a whole query did before (any of them, the last as a
 *     prefix); each of its phrases is REQUIRED. So `private equity AND tax` is
 *     (private equity) AND (tax), and `"annual report" tax` needs the phrase and
 *     the word.
 *   - A PHRASE is text between double quotes, straight or curly. Its words must
 *     appear together and in order; case and punctuation do not count, and there
 *     is no prefix match ("annual report" does not find "annual reporting").
 *     Inside quotes `AND` and `OR` are words. Quotes delimit with or without
 *     spaces around them.
 *   - `AND` binds tighter than `OR`: `a OR b AND c` is a OR (b AND c).
 *   - No parentheses. A bracket is a character in a word, which the analyzer
 *     drops, exactly as before.
 *   - A query with no operator and no phrase is sent untouched, so nothing about
 *     it changes.
 *   - Malformed input never errors. Quotes pair left to right and an unpaired
 *     last quote is ignored, as is an empty `""`. A leading or trailing operator
 *     is dropped, and a run of adjacent operators counts once: as `OR` if it
 *     holds one, otherwise `AND`. A query that is ONLY operators is searched as
 *     words.
 *
 * WHERE THE MATCHING HAPPENS
 *
 * Here we only parse. The parse goes to the search template as `params.operators`
 * (OR'd groups of AND'd operands), and the template turns each operand's words
 * into the same four-field recall clause a plain query gets, and each phrase into
 * a four-field `match_phrase` (the StreamX pages search template; the same
 * `params.operators` contract as the earlier site's). `params.query` becomes the
 * plain words with the operators and quotes removed, because the template also
 * ranks and highlights on it, and an `AND` in there would boost every page with "and" in its title.
 *
 * `&`, `<`, `>` and `"` are replaced with spaces in what we send. The analyzer
 * splits words on all four anyway, so that changes no match, and it means no
 * escaping the template engine applies to them can change one either.
 *
 * Parsing in the block rather than handing the template `query_string` keeps
 * malformed input harmless: `query_string` answers a stray `"` with a 400 for the
 * whole search, where this sends nothing but words.
 */

/** The operator tokens. Case-sensitive on purpose: see THE RULES. */
const AND = 'AND';
const OR = 'OR';

/** Opening and closing double quotes, as keyboards and phones type them. */
const QUOTES = /["“”„‟«»]/g;

/** Text the analyzer splits on, which we send as a space instead. */
const clean = (text) => text.replace(/[&<>"]/g, ' ').split(/\s+/).filter(Boolean).join(' ');

/**
 * Splits a query into words, operators and phrases.
 *
 * @param {string} query The query as typed
 * @returns {{type: string, value: string}[]} `word`, `op` or `phrase` tokens
 */
function tokenize(query) {
  const parts = query.replace(QUOTES, '"').split('"');
  // An odd number of quotes leaves an even part count; the last quote has no
  // partner, so its two sides are one unquoted stretch.
  if (parts.length % 2 === 0) parts.splice(-2, 2, `${parts.at(-2)} ${parts.at(-1)}`);

  return parts.flatMap((part, i) => {
    if (i % 2) {
      const phrase = clean(part);
      return phrase ? [{ type: 'phrase', value: phrase }] : [];
    }
    return part.split(/\s+/).filter(Boolean).flatMap((token) => {
      if (token === AND || token === OR) return [{ type: 'op', value: token }];
      const word = clean(token);
      return word ? [{ type: 'word', value: word }] : [];
    });
  });
}

/**
 * Parses a query's `AND`, `OR` and quoted phrases.
 *
 * @param {string} query The query as typed
 * @returns {{query: string, groups: {text: string, phrases: string[]}[][]}|null}
 *   The plain words, and the OR'd groups of AND'd operands; or null when the
 *   query holds no operator and no phrase (or nothing but operators) and should
 *   be sent as is
 */
export function parseOperators(query) {
  const tokens = tokenize(typeof query === 'string' ? query : '');
  if (!tokens.some((token) => token.type !== 'word')) return null;

  const groups = [];
  let group = [];
  let words = [];
  let phrases = [];

  const endOperand = () => {
    if (words.length || phrases.length) group.push({ text: words.join(' '), phrases });
    words = [];
    phrases = [];
  };
  const endGroup = () => {
    endOperand();
    if (group.length) groups.push(group);
    group = [];
  };

  tokens.forEach(({ type, value }) => {
    if (type === 'phrase') phrases.push(value);
    else if (type === 'word') words.push(value);
    else if (value === OR) endGroup();
    else endOperand();
  });
  endGroup();

  if (!groups.length) return null;
  const plain = groups.flat().flatMap((o) => [...o.phrases, o.text]).filter(Boolean).join(' ');
  return { query: plain, groups };
}

/**
 * The `operators` request parameter for `groups`.
 *
 * Every element carries its flags, true OR false. The template writes its
 * separators as `{{^last_term}},{{/last_term}}` and `{{#has_phrases}},{{/has_phrases}}`,
 * and mustache looks a name that is missing from an element up in the enclosing
 * scope, so a missing flag renders a stray comma (or drops one) and the request
 * fails.
 *
 * @param {{text: string, phrases: string[]}[][]} groups OR'd groups of AND'd operands
 * @returns {Object} The parameter, in the shape the template reads
 */
export function operatorsParam(groups) {
  return {
    any_of: groups.map((group, i) => ({
      all_of: group.map(({ text, phrases }, j) => ({
        text,
        has_phrases: phrases.length > 0,
        phrases: phrases.map((phrase, k) => ({ phrase, last_phrase: k === phrases.length - 1 })),
        last_term: j === group.length - 1,
      })),
      last_group: i === groups.length - 1,
    })),
  };
}

/**
 * A search request's `params` with its operators and phrases parsed.
 *
 * Only a query that forms a real expression (two or more operands, or any
 * phrase) gains `operators`. `tax AND` is just `tax`, so it is sent as `tax`: a
 * plain query, with the stray operator dropped rather than searched as a word.
 *
 * @param {Object} params The request's `params`
 * @returns {Object|null} The new params, or null to send the request unchanged
 */
export function withOperators(params) {
  const parsed = parseOperators(params?.query);
  if (!parsed) return null;
  const operands = parsed.groups.flat();
  return operands.length > 1 || operands.some((o) => o.phrases.length)
    ? { ...params, query: parsed.query, operators: operatorsParam(parsed.groups) }
    : { ...params, query: parsed.query };
}

let operatorHookInstalled = false;

/**
 * Adds `params.operators` (AND, OR and phrases) to the panel's search requests.
 *
 * A `fetch` wrapper for the same reason as the date sort's
 * (installSortRequestHook in search-results-panel.js): the vendored bundle
 * builds the request in a function that is not exported. It is matched by the
 * same SHAPE (a POST whose JSON body carries a `params` object), so the
 * suggestion dropdown's GETs pass through untouched, and so does every request
 * whose query has no operator.
 *
 * Install it after installMockSearch, so the mock receives the parsed request.
 * It is idempotent, so a page carrying two panels installs it once.
 */
export function installOperatorRequestHook() {
  if (operatorHookInstalled) return;
  operatorHookInstalled = true;
  const inner = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    if ((init?.method || 'GET').toUpperCase() !== 'POST') return inner(input, init);
    if (typeof init.body !== 'string') return inner(input, init);

    let payload;
    try {
      payload = JSON.parse(init.body);
    } catch {
      return inner(input, init);
    }
    if (!payload?.params || typeof payload.params !== 'object') return inner(input, init);

    const params = withOperators(payload.params);
    if (!params) return inner(input, init);
    return inner(input, { ...init, body: JSON.stringify({ ...payload, params }) });
  };
}
