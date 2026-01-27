function escapeHTML(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function tokenize(code, patterns) {
  let result = code;
  const tokens = [];
  patterns.forEach(({ regex, type, handler }) => {
    result = result.replace(regex, (match, ...args) => {
      const placeholder = `__${type.toUpperCase()}_${tokens.length}__`;
      const content = handler ? handler(match, args) : match;
      tokens.push({ type, content, placeholder });
      return placeholder;
    });
  });
  tokens.reverse().forEach(({ placeholder, content, type }) => {
    result = result.replace(placeholder, `<span class="token ${type}">${escapeHTML(content)}</span>`);
  });
  return result;
}

const patterns = {
  js: [
    { regex: /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm, type: 'comment' },
    { regex: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, type: 'string' },
    { regex: /(`(?:[^`\\$]|\\.|\$(?!\{))*(?:\$\{[^}]*\}(?:[^`\\$]|\\.|\$(?!\{))*)*`)/g, type: 'string' },
    { regex: /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|new|class|extends|import|export|default|async|await|yield|typeof|instanceof|delete|void|this|super|static|get|set|in|of)\b/g, type: 'keyword' },
    { regex: /\b(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?\b/g, type: 'number' },
    { regex: /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g, type: 'function' },
    { regex: /([+\-*/%=<>!&|^~?:])/g, type: 'operator' },
    { regex: /([{}[\]();,.])/g, type: 'punctuation' },
  ],
  py: [
    { regex: /(#.*$)/gm, type: 'comment' },
    { regex: /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|f"(?:[^"\\]|\\.)*"|f'(?:[^'\\]|\\.)*')/g, type: 'string' },
    { regex: /(@[a-zA-Z_][a-zA-Z0-9_]*)/g, type: 'decorator' },
    { regex: /\b(def|class|if|elif|else|for|while|return|import|from|as|try|except|finally|raise|with|lambda|yield|pass|break|continue|and|or|not|in|is|None|True|False|async|await|global|nonlocal)\b/g, type: 'keyword' },
    { regex: /\b(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?\b/g, type: 'number' },
    { regex: /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=\()/g, type: 'function' },
    { regex: /([+\-*/%=<>!&|^~])/g, type: 'operator' },
    { regex: /([{}[\]();:,.])/g, type: 'punctuation' },
  ],
  css: [
    { regex: /(\/\*[\s\S]*?\*\/)/g, type: 'comment' },
    { regex: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, type: 'string' },
    { regex: /(^|\n)([.#]?[a-zA-Z][a-zA-Z0-9-_]*(?:\s*[>+~]\s*[.#]?[a-zA-Z][a-zA-Z0-9-_]*)*|\*|::?[a-zA-Z-]+|\[[^\]]+\])(?=\s*\{)/gm, type: 'selector', handler: (m, args) => args[1] },
    { regex: /(!important)/g, type: 'important' },
    { regex: /(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))/g, type: 'color' },
    { regex: /\b(\d+\.?\d*(?:px|em|rem|%|vh|vw|pt|cm|mm|in|pc|ex|ch|vmin|vmax|deg|rad|turn|s|ms)?)\b/g, type: 'number' },
    { regex: /([a-zA-Z-]+)(?=\s*:)/g, type: 'property' },
    { regex: /([{}:;,])/g, type: 'punctuation' },
  ],
  json: [
    { regex: /("(?:[^"\\]|\\.)*")/g, type: 'string' },
    { regex: /\b(true|false|null)\b/g, type: 'boolean' },
    { regex: /\b(-?\d+\.?\d*([eE][+-]?\d+)?)\b/g, type: 'number' },
    { regex: /([{}[\]:,])/g, type: 'punctuation' },
  ],
  bash: [
    { regex: /(#.*$)/gm, type: 'comment' },
    { regex: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, type: 'string' },
    { regex: /(\$\{?[a-zA-Z_][a-zA-Z0-9_]*\}?|\$\d+|\$[@*#?$!-])/g, type: 'variable' },
    { regex: /\b(if|then|else|elif|fi|case|esac|for|while|do|done|function|return|exit|break|continue|in|select|until)\b/g, type: 'keyword' },
    { regex: /([|&;<>()$`\\])/g, type: 'operator' },
  ],
  sql: [
    { regex: /(--.*$|\/\*[\s\S]*?\*\/)/gm, type: 'comment' },
    { regex: /('(?:[^'\\]|\\.)*')/g, type: 'string' },
    { regex: /\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TABLE|INDEX|VIEW|JOIN|INNER|LEFT|RIGHT|OUTER|ON|AS|AND|OR|NOT|IN|LIKE|BETWEEN|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|UNION|ALL|DISTINCT|COUNT|SUM|AVG|MAX|MIN|NULL|IS|EXISTS|CASE|WHEN|THEN|ELSE|END|PRIMARY|KEY|FOREIGN|REFERENCES|CONSTRAINT|DEFAULT|AUTO_INCREMENT|VARCHAR|INT|INTEGER|TEXT|DATE|DATETIME|TIMESTAMP|BOOLEAN|FLOAT|DOUBLE|DECIMAL)\b/gi, type: 'keyword' },
    { regex: /\b(\d+\.?\d*)\b/g, type: 'number' },
    { regex: /([=<>!+\-*/%])/g, type: 'operator' },
    { regex: /([();,.])/g, type: 'punctuation' },
  ],
  java: [
    { regex: /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm, type: 'comment' },
    { regex: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, type: 'string' },
    { regex: /(@[a-zA-Z_][a-zA-Z0-9_]*)/g, type: 'decorator' },
    { regex: /\b(abstract|assert|boolean|break|byte|case|catch|char|class|const|continue|default|do|double|else|enum|extends|final|finally|float|for|goto|if|implements|import|instanceof|int|interface|long|native|new|package|private|protected|public|return|short|static|strictfp|super|switch|synchronized|this|throw|throws|transient|try|void|volatile|while|true|false|null)\b/g, type: 'keyword' },
    { regex: /\b(\d+\.?\d*[fFdDlL]?|\.\d+[fFdD]?|0x[0-9a-fA-F]+[lL]?)\b/g, type: 'number' },
    { regex: /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=\()/g, type: 'function' },
    { regex: /([+\-*/%=<>!&|^~?:])/g, type: 'operator' },
    { regex: /([{}[\]();,.])/g, type: 'punctuation' },
  ],
  yaml: [
    { regex: /(#.*$)/gm, type: 'comment' },
    { regex: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, type: 'string' },
    { regex: /([&*][a-zA-Z0-9_-]+)/g, type: 'variable' },
    { regex: /^(\s*)([a-zA-Z0-9_-]+)(?=\s*:)/gm, type: 'property', handler: (m, args) => `${args[0]}${args[1]}` },
    { regex: /\b(true|false|yes|no|on|off|null|~)\b/gi, type: 'boolean' },
    { regex: /\b(-?\d+\.?\d*)\b/g, type: 'number' },
  ],
};

function highlightHTML(code) {
  let result = escapeHTML(code);
  const tokens = [];
  const comments = /(&lt;!--[\s\S]*?--&gt;)/g;
  const doctype = /(&lt;!DOCTYPE[^&]*?&gt;)/gi;
  const tags = /(&lt;\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s+[a-zA-Z][a-zA-Z0-9-]*(?:=(?:&quot;[^&]*?&quot;|&#039;[^&]*?&#039;|[^\s&gt;]+))?)*\s*\/?&gt;)/g;

  result = result.replace(comments, (m) => {
    const p = `__C_${tokens.length}__`;
    tokens.push({ type: 'comment', content: m, placeholder: p });
    return p;
  });
  result = result.replace(doctype, (m) => {
    const p = `__D_${tokens.length}__`;
    tokens.push({ type: 'doctype', content: m, placeholder: p });
    return p;
  });
  result = result.replace(tags, (m) => {
    const p = `__T_${tokens.length}__`;
    let h = m.replace(/\s+([a-zA-Z][a-zA-Z0-9-]*)=(&quot;[^&]*?&quot;|&#039;[^&]*?&#039;|[^\s&gt;]+)/g, (am, n, v) => {
      const p2 = `__A_${tokens.length}__`;
      tokens.push({ type: 'attr', content: ` <span class="token attr-name">${n}</span>=<span class="token attr-value">${v}</span>`, placeholder: p2 });
      return p2;
    });
    h = h.replace(/(&lt;\/?[a-zA-Z][a-zA-Z0-9-]*)/g, '<span class="token tag">$1</span>');
    h = h.replace(/(\s*\/?&gt;)/g, '<span class="token tag">$1</span>');
    tokens.push({ type: 'tag', content: h, placeholder: p });
    return p;
  });
  tokens.reverse().forEach(({ placeholder, content, type }) => {
    result = result.replace(placeholder, type === 'attr' ? content : `<span class="token ${type}">${content}</span>`);
  });
  return result;
}

function highlight(code, lang) {
  const normalized = lang.toLowerCase().trim();
  const aliases = {
    javascript: 'js', python: 'py', shell: 'bash', xml: 'html', yml: 'yaml',
  };
  const language = aliases[normalized] || normalized;

  if (language === 'html') return highlightHTML(code);
  if (patterns[language]) return tokenize(code, patterns[language]);
  return escapeHTML(code);
}

/**
 * Decorate the code highlighter block with syntax highlighting
 * @param {Element} block the block element
 */
export default function decorate(block) {
  const language = [...block.classList].find((cls) => cls !== 'code-highlighter') || 'plaintext';
  const codeText = block.textContent.trim();

  block.innerHTML = '';
  const pre = document.createElement('pre');
  pre.className = `language-${language}`;
  const code = document.createElement('code');
  code.className = `language-${language}`;

  const highlighted = highlight(codeText, language);
  const temp = document.createElement('div');
  temp.innerHTML = highlighted;
  while (temp.firstChild) code.appendChild(temp.firstChild);

  pre.appendChild(code);
  block.appendChild(pre);
}
