/**
 * Blogable.spec.js
 *
 * Strict spec tests for Blogable v1.1-alpha.
 * Normative reference: README.md (Blogable Bootstrap EBNF).
 *
 * Sections covered:
 *   §FrontMatter  §Headings  §HorizontalRule  §CodeBlocks
 *   §BlogableBlock  §EbnfBlock  §QuoteBlocks  §MathBlocks
 *   §URLs  §Images  §Lists  §InlineSyntax  §InternalAnchors
 *   §Definitions  §Metadata  §Diagnostics  §Security
 */

'use strict';

const { parse, tokenize, buildAST } = require('./setup.js');

// ─────────────────────────────────────────────────────────────────────────────
// §FrontMatter
// ─────────────────────────────────────────────────────────────────────────────

describe('§FrontMatter', () => {
  it('renders a valid front matter block as <dl class="front-matter">', () => {
    const src = '@@\ntitle: Hello World\nauthor: Alice\n@@';
    const html = parse(src);
    expect(html).toMatch(/<dl class="front-matter">/);
    expect(html).toMatch(/<dt>title<\/dt><dd>Hello World<\/dd>/);
    expect(html).toMatch(/<dt>author<\/dt><dd>Alice<\/dd>/);
  });

  it('accepts all spec-defined front matter keys', () => {
    const keys = ['title','author','date','updated','description','tags','slug','draft','lang'];
    for (const k of keys) {
      const html = parse(`@@\n${k}: value\n@@`);
      expect(html).toMatch(new RegExp(`<dt>${k}</dt>`));
    }
  });

  it('accepts x-* extension keys', () => {
    const html = parse('@@\nx-version: 1.2.3\n@@');
    expect(html).toMatch(/<dt>x-version<\/dt>/);
  });

  it('rejects an invalid front matter key with [E001] and omits it from output', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const html = parse('@@\nbadkey: value\n@@');
      expect(warnSpy.mock.calls.some(a => a.join(' ').includes('[E001]'))).toBe(true);
      expect(html).not.toMatch(/<dt>badkey<\/dt>/);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('emits [W002] for a malformed front matter line', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      parse('@@\nnot a key value line\n@@');
      expect(warnSpy.mock.calls.some(a => a.join(' ').includes('[W002]'))).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('front matter key regex is case-sensitive (uppercase key is treated as malformed, emits [W002])', () => {
    // FrontKey = LOWER , { LOWER | DIGIT | "-" } — uppercase never matches the key
    // pattern, so the line is rejected as malformed and [W002] is emitted.
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      parse('@@\nTitle: Hello\n@@');
      expect(warnSpy.mock.calls.some(a => a.join(' ').includes('[W002]'))).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('empty front matter block produces an empty dl or omits output', () => {
    const html = parse('@@\n@@');
    // Either empty dl or no output — must not crash
    expect(html).not.toMatch(/<dt>/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §Headings
// ─────────────────────────────────────────────────────────────────────────────

describe('§Headings', () => {
  it(':: (2 colons) → <h2>', () => {
    expect(parse(':: Heading Two')).toMatch(/^<h2 /);
  });

  it('::: (3 colons) → <h3>', () => {
    expect(parse('::: Heading Three')).toMatch(/^<h3 /);
  });

  it(':::: (4 colons) → <h4>', () => {
    expect(parse(':::: Heading Four')).toMatch(/^<h4 /);
  });

  it('::::: (5 colons) → <h5>', () => {
    expect(parse('::::: Heading Five')).toMatch(/^<h5 /);
  });

  it(':::::: (6 colons) → <h6>', () => {
    expect(parse(':::::: Heading Six')).toMatch(/^<h6 /);
  });

  it('heading carries an id derived from its text', () => {
    const html = parse(':: My Section');
    expect(html).toMatch(/id="my-section"/);
  });

  it('numbered heading (::# text) adds class="numbered"', () => {
    const html = parse('::# Section One');
    expect(html).toMatch(/class="numbered"/);
    expect(html).toMatch(/<h2 /);
  });

  it('plain heading does NOT get class="numbered"', () => {
    const html = parse(':: Plain');
    expect(html).not.toMatch(/class="numbered"/);
  });

  it('heading text is HTML-escaped', () => {
    const html = parse(':: <script>alert(1)</script>');
    expect(html).not.toMatch(/<script>/i);
    expect(html).toMatch(/&lt;script&gt;/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §HorizontalRule
// ─────────────────────────────────────────────────────────────────────────────

describe('§HorizontalRule', () => {
  it('--- → <hr>', () => {
    expect(parse('---').replace(/\s+/g, ' ').trim()).toBe('<hr>');
  });

  it('---- (4 dashes) is NOT a horizontal rule', () => {
    expect(parse('----')).not.toMatch(/<hr>/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §CodeBlocks
// ─────────────────────────────────────────────────────────────────────────────

describe('§CodeBlocks', () => {
  it('renders a code block with the detected language class', () => {
    const src = '#!javascript\nconsole.log("hi");\n!#';
    const html = parse(src);
    expect(html).toMatch(/class="language-javascript"/);
    expect(html).toMatch(/console\.log/);
  });

  it('code block has no inline parsing (** is literal)', () => {
    const src = '#!text\n**not bold**\n!#';
    const html = parse(src);
    expect(html).not.toMatch(/<strong>/);
    expect(html).toMatch(/\*\*not bold\*\*/);
  });

  it('\\!# inside a code block renders as literal !#', () => {
    const src = '#!text\n\\!#\n!#';
    const html = parse(src);
    // The escaped line must appear as !# in the output, not close the block
    expect(html).toMatch(/!#/);
  });

  it('code block with @[title: ...] shows the title in figcaption', () => {
    const src = '#!python\npass\n!#\n@[title: My Script]';
    const html = parse(src);
    expect(html).toMatch(/My Script/);
  });

  it('code block with @[cite: https://...] renders a cite link', () => {
    const src = '#!bash\necho hi\n!#\n@[cite: https://example.com]';
    const html = parse(src);
    expect(html).toMatch(/<cite>/);
    expect(html).toMatch(/example\.com/);
  });

  it('#!blogable block is rendered as a code block with lang="blogable"', () => {
    const src = '#!blogable\n:: heading\n!#';
    const html = parse(src);
    expect(html).toMatch(/language-blogable/);
  });

  it('#!ebnf block is rendered as a code block with lang="ebnf"', () => {
    const src = '#!ebnf\nRule = "x" ;\n!#';
    const html = parse(src);
    expect(html).toMatch(/language-ebnf/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §QuoteBlocks
// ─────────────────────────────────────────────────────────────────────────────

describe('§QuoteBlocks', () => {
  it('> text → inline blockquote <blockquote><p>…</p></blockquote>', () => {
    const html = parse('> This is a quote.');
    expect(html).toMatch(/<blockquote><p>/);
    expect(html).toMatch(/This is a quote\./);
  });

  it('|> … <| → block blockquote', () => {
    const src = '|>\nLine one.\nLine two.\n<|';
    const html = parse(src);
    expect(html).toMatch(/<blockquote>/);
    expect(html).toMatch(/Line one\./);
  });

  it('block quote with @[author: …] renders author in footer', () => {
    const src = '|>\nSome text.\n<|\n@[author: Alice]';
    const html = parse(src);
    expect(html).toMatch(/Alice/);
    expect(html).toMatch(/<footer>/);
  });

  it('block quote with @[cite: https://…] renders cite in footer', () => {
    const src = '|>\nSome text.\n<|\n@[cite: https://example.com]';
    const html = parse(src);
    expect(html).toMatch(/<cite>/);
    expect(html).toMatch(/example\.com/);
  });

  it('inline parsing is enabled inside quote blocks (**bold**)', () => {
    const src = '|>\n**bold text**\n<|';
    const html = parse(src);
    expect(html).toMatch(/<strong>bold text<\/strong>/);
  });

  it('blank line inside |>…<| separates paragraphs', () => {
    const src = '|>\nFirst para.\n\nSecond para.\n<|';
    const html = parse(src);
    // Should have two <p> elements
    const ps = html.match(/<p>/g) || [];
    expect(ps.length).toBeGreaterThanOrEqual(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §MathBlocks
// ─────────────────────────────────────────────────────────────────────────────

describe('§MathBlocks', () => {
  it('$$ … $$ → <div class="math-block">', () => {
    const src = '$$\nE = mc^2\n$$';
    const html = parse(src);
    expect(html).toMatch(/<div class="math-block">/);
    expect(html).toMatch(/E = mc\^2/);
  });

  it('math block content is HTML-escaped', () => {
    const src = '$$\n<script>alert(1)</script>\n$$';
    const html = parse(src);
    expect(html).not.toMatch(/<script>/i);
    expect(html).toMatch(/&lt;script&gt;/);
  });

  it('inline parsing is disabled inside math blocks (** is literal)', () => {
    const src = '$$\n**not bold**\n$$';
    const html = parse(src);
    expect(html).not.toMatch(/<strong>/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §URLs — UrlBlock and ImageURL
// ─────────────────────────────────────────────────────────────────────────────

describe('§URLs', () => {
  it('standalone https:// URL → autolink paragraph', () => {
    const html = parse('https://example.com');
    expect(html).toMatch(/<a href="https:\/\/example\.com"/);
    expect(html).toMatch(/rel="noopener noreferrer"/);
  });

  it('http:// URL (non-https) is NOT auto-linked (security requirement)', () => {
    const html = parse('http://example.com');
    expect(html).not.toMatch(/<a href="http:\/\//);
  });

  it('image URL (.png) → <figure> with <img>', () => {
    const html = parse('https://example.com/photo.png');
    expect(html).toMatch(/<figure/);
    expect(html).toMatch(/<img /);
    expect(html).toMatch(/src="https:\/\/example\.com\/photo\.png"/);
  });

  it('image URL (.jpg) → <img>', () => {
    expect(parse('https://example.com/img.jpg')).toMatch(/<img /);
  });

  it('image URL (.jpeg) → <img>', () => {
    expect(parse('https://example.com/img.jpeg')).toMatch(/<img /);
  });

  it('image URL (.gif) → <img>', () => {
    expect(parse('https://example.com/img.gif')).toMatch(/<img /);
  });

  it('image URL (.webp) → <img>', () => {
    expect(parse('https://example.com/img.webp')).toMatch(/<img /);
  });

  it('.svg URL is NOT treated as an image (spec: SVG MUST NOT be treated as an image)', () => {
    const html = parse('https://example.com/graphic.svg');
    expect(html).not.toMatch(/<img /);
  });

  it('image block with @[alt: …] sets alt attribute', () => {
    const src = 'https://example.com/photo.png\n@[alt: A photo]';
    const html = parse(src);
    expect(html).toMatch(/alt="A photo"/);
  });

  it('multiple image URLs in a row → single <figure> with multiple <img>', () => {
    const src = 'https://example.com/a.png\nhttps://example.com/b.png';
    const html = parse(src);
    expect((html.match(/<img /g) || []).length).toBe(2);
    expect((html.match(/<figure/g) || []).length).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §Lists
// ─────────────────────────────────────────────────────────────────────────────

describe('§Lists', () => {
  it('unordered list items → <ul><li>…</li></ul>', () => {
    const src = '- Alpha\n- Beta\n- Gamma';
    const html = parse(src);
    expect(html).toMatch(/<ul>/);
    expect(html).toMatch(/<li>Alpha<\/li>/);
    expect(html).toMatch(/<li>Beta<\/li>/);
  });

  it('ordered list items → <ol><li>…</li></ol>', () => {
    const src = '1. First\n2. Second';
    const html = parse(src);
    expect(html).toMatch(/<ol>/);
    expect(html).toMatch(/<li>First<\/li>/);
  });

  it('nested list (2-space indent) → nested <ul>', () => {
    const src = '- Parent\n  - Child';
    const html = parse(src);
    expect(html).toMatch(/<ul>/);
    // Nested list must appear inside the outer list
    expect(html).toMatch(/<li>Parent[\s\S]*<ul>[\s\S]*<li>Child<\/li>/);
  });

  it('task list [x] → checked checkbox', () => {
    const html = parse('[x] Done task');
    expect(html).toMatch(/type="checkbox"/);
    expect(html).toMatch(/checked/);
  });

  it('task list [ ] → unchecked checkbox', () => {
    const html = parse('[ ] Open task');
    expect(html).toMatch(/type="checkbox"/);
    expect(html).not.toMatch(/ checked/);
  });

  it('task list checkbox is disabled (read-only)', () => {
    const html = parse('[x] Done');
    expect(html).toMatch(/disabled/);
  });

  it('list items support inline parsing (**bold**)', () => {
    const html = parse('- **bold item**');
    expect(html).toMatch(/<strong>bold item<\/strong>/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §InlineSyntax
// ─────────────────────────────────────────────────────────────────────────────

describe('§InlineSyntax', () => {
  // ── individual span types ─────────────────────────────────────────────────

  it('Code: `text` → <code>text</code>', () => {
    expect(parse('`hello`')).toMatch(/<code>hello<\/code>/);
  });

  it('Code: content may be empty (`` → <code></code>)', () => {
    expect(parse('``')).toMatch(/<code><\/code>/);
  });

  it('Code: backtick content is HTML-escaped', () => {
    const html = parse('`<b>`');
    expect(html).toMatch(/&lt;b&gt;/);
    expect(html).not.toMatch(/<b>/);
  });

  it('Code: newline inside backticks does NOT form a code span', () => {
    // CodeChar = any except ` and NL; the two lines are separate tokens
    const html = parse('`line1\nline2`');
    expect(html).not.toMatch(/<code>line1\nline2<\/code>/);
    // Each fragment is rendered as plain text (escaped)
    expect(html).toMatch(/`line1/);
  });

  it('Link: [https://url label] → <a href="…">label</a>', () => {
    const html = parse('[https://example.com Visit Example]');
    expect(html).toMatch(/<a href="https:\/\/example\.com"/);
    expect(html).toMatch(/Visit Example/);
    expect(html).toMatch(/rel="noopener noreferrer"/);
    expect(html).toMatch(/target="_blank"/);
  });

  it('Link: URL must end at the first space (no space in URL portion)', () => {
    // The HTTPS_URL token class is [^ \]\n]+ — it stops at the first space.
    // A raw URL with a space is not a valid Link; the rest becomes part of the label.
    const html = parse('[https://example.com/path label text]');
    expect(html).toMatch(/href="https:\/\/example\.com\/path"/);
    expect(html).toMatch(/>label text</);
  });

  it('Link: http:// is rejected (https only)', () => {
    const html = parse('[http://example.com label]');
    expect(html).not.toMatch(/<a href="http:\/\//);
  });

  it('Footnote: [^text] → superscript footnote reference', () => {
    const html = parse('[^See note 1]');
    expect(html).toMatch(/<sup>/);
    expect(html).toMatch(/fn-1/);
  });

  it('Footnote: [^https://url label] → URL footnote', () => {
    const html = parse('[^https://example.com Example]');
    expect(html).toMatch(/<sup>/);
    // footnote list rendered at end
    expect(html).toMatch(/example\.com/);
  });

  it('Footnote: multiple footnotes are numbered sequentially', () => {
    const html = parse('[^First note] and [^Second note]');
    expect(html).toMatch(/fn-1/);
    expect(html).toMatch(/fn-2/);
  });

  it('AnchorRef: [#heading-id] resolves to an in-page link when heading exists', () => {
    // AnchorRef is an inline construct; it must appear inside paragraph text,
    // not as a standalone line (which would be tokenised as anchor_block instead).
    const src = ':: My Section\n\nSee [#My Section] for details.';
    const html = parse(src);
    expect(html).toMatch(/<a href="#my-section" class="anchor-ref"/);
  });

  it('AnchorRef: [#unknown] emits [W001] and renders plain text', () => {
    // AnchorRef is inline-only; use it inside paragraph text so it is not
    // tokenised as a standalone anchor_block.
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const html = parse('Read [#nonexistent] for more.');
      expect(warnSpy.mock.calls.some(a => a.join(' ').includes('[W001]'))).toBe(true);
      expect(html).not.toMatch(/<a /);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('Strong: **text** → <strong>text</strong>', () => {
    expect(parse('**bold**')).toMatch(/<strong>bold<\/strong>/);
  });

  it('Strong: newline inside ** does NOT form a strong span', () => {
    const html = parse('**line1\nline2**');
    expect(html).not.toMatch(/<strong>/);
  });

  it('Emphasis: *text* → <em>text</em>', () => {
    expect(parse('*italic*')).toMatch(/<em>italic<\/em>/);
  });

  it('Emphasis: newline inside * does NOT form an emphasis span', () => {
    const html = parse('*line1\nline2*');
    expect(html).not.toMatch(/<em>/);
  });

  it('Delete: ~~text~~ → <del>text</del>', () => {
    expect(parse('~~deleted~~')).toMatch(/<del>deleted<\/del>/);
  });

  it('Delete: newline inside ~~ does NOT form a del span', () => {
    const html = parse('~~line1\nline2~~');
    expect(html).not.toMatch(/<del>/);
  });

  it('Insert: ++text++ → <ins>text</ins>', () => {
    expect(parse('++inserted++')).toMatch(/<ins>inserted<\/ins>/);
  });

  it('Insert: newline inside ++ does NOT form an ins span', () => {
    const html = parse('++line1\nline2++');
    expect(html).not.toMatch(/<ins>/);
  });

  // ── evaluation order (Code > Link > Footnote > AnchorRef > Strong > Emphasis > Delete > Insert) ──

  it('Code wins over Strong: `**text**` → <code>**text**</code>', () => {
    const html = parse('`**text**`');
    expect(html).toMatch(/<code>\*\*text\*\*<\/code>/);
    expect(html).not.toMatch(/<strong>/);
  });

  it('Code wins over Emphasis: `*text*` → <code>*text*</code>', () => {
    const html = parse('`*text*`');
    expect(html).toMatch(/<code>\*text\*<\/code>/);
    expect(html).not.toMatch(/<em>/);
  });

  it('Strong: StrongChar excludes * so **a*b*c** does not match as strong', () => {
    // StrongChar = ? any character except "*" and NL ? — an asterisk inside the
    // content means the Strong pattern fails to match and the text is rendered
    // character-by-character (the * chars are plain, inner *a* / *c* become <em>).
    const html = parse('**a*b*c**');
    expect(html).not.toMatch(/<strong>/);
  });

  // ── no nesting ────────────────────────────────────────────────────────────

  it('Inline elements MUST NOT nest: **bold *em* content** does not form strong (StrongChar excludes *)', () => {
    // Because StrongChar = ? any except "*" and NL ?, the Strong pattern does not
    // match when inner content contains "*".  The scanner falls to plain chars and
    // inner *…* spans may be parsed as Emphasis instead — but never as nested spans.
    const html = parse('**bold *em* content**');
    // Strong must not match (inner * breaks StrongChar constraint)
    expect(html).not.toMatch(/<strong>/);
  });

  it('Inline elements MUST NOT nest: ~~del **strong** text~~ renders del only', () => {
    const html = parse('~~del **strong** text~~');
    expect(html).toMatch(/<del>/);
    expect(html).not.toMatch(/<strong>/);
  });

  // ── HTML escaping ─────────────────────────────────────────────────────────

  it('plain text is HTML-escaped', () => {
    const html = parse('<script>alert(1)</script>');
    expect(html).not.toMatch(/<script>/i);
    expect(html).toMatch(/&lt;script&gt;/);
  });

  it('inline text with & is HTML-escaped to &amp;', () => {
    const html = parse('A & B');
    expect(html).toMatch(/A &amp; B/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §InternalAnchors
// ─────────────────────────────────────────────────────────────────────────────

describe('§InternalAnchors', () => {
  it('[#text] standalone block → <span class="anchor-block" id="…">', () => {
    const html = parse('[#my-anchor]');
    expect(html).toMatch(/<span class="anchor-block"/);
    expect(html).toMatch(/id="my-anchor"/);
  });

  it('anchor block id is derived via slugify', () => {
    const html = parse('[#My Anchor]');
    expect(html).toMatch(/id="my-anchor"/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §Definitions
// ─────────────────────────────────────────────────────────────────────────────

describe('§Definitions', () => {
  it(':= Term followed by text → <dl class="def-block"><dt>Term</dt><dd>…</dd>', () => {
    const src = ':= MyTerm\nThe definition body.';
    const html = parse(src);
    expect(html).toMatch(/<dl class="def-block">/);
    expect(html).toMatch(/<dt>MyTerm<\/dt>/);
    expect(html).toMatch(/The definition body\./);
  });

  it('definition term supports inline parsing (**bold**)', () => {
    const src = ':= **Bold** Term\nBody text.';
    const html = parse(src);
    expect(html).toMatch(/<strong>Bold<\/strong>/);
  });

  it('definition body supports inline parsing (*italic*)', () => {
    const src = ':= Term\n*italic body*';
    const html = parse(src);
    expect(html).toMatch(/<em>italic body<\/em>/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §Metadata
// ─────────────────────────────────────────────────────────────────────────────

describe('§Metadata', () => {
  it('@[class: value] after a heading adds class attribute', () => {
    const src = ':: My Heading\n@[class: highlight]';
    const html = parse(src);
    expect(html).toMatch(/class="[^"]*highlight[^"]*"/);
  });

  it('@[id: value] after a block sets id attribute', () => {
    const src = ':: Section\n@[id: custom-id]';
    const html = parse(src);
    expect(html).toMatch(/id="custom-id"/);
  });

  it('@[x-foo: bar] after a block adds data-foo="bar"', () => {
    const src = ':: Section\n@[x-foo: bar]';
    const html = parse(src);
    expect(html).toMatch(/data-foo="bar"/);
  });

  it('unknown MetaKey emits [E002] and falls back to literal text', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const html = parse('@[badkey: value]');
      expect(warnSpy.mock.calls.some(a => a.join(' ').includes('[E002]'))).toBe(true);
      expect(html).not.toMatch(/badkey="value"/);
      expect(html).not.toMatch(/data-badkey/);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('MetaKey modifier uses SP (single space) after colon', () => {
    // @[key:  value] — two spaces → not a valid modifier (falls back to text)
    // The strictness guarantee is just that the double-space line is NOT treated
    // as a valid modifier.
    const html = parse('@[class:  double-space]');
    expect(html).not.toMatch(/class="double-space"/);
  });

  it('metadata does not cross blank lines (modifier after blank is a new block)', () => {
    const src = ':: Heading\n\n@[class: late]';
    const html = parse(src);
    // The class should NOT be applied to the heading since there's a blank line
    expect(html).not.toMatch(/<h2[^>]*class="[^"]*late[^"]*"/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §Diagnostics
// ─────────────────────────────────────────────────────────────────────────────

describe('§Diagnostics', () => {
  it('[E001] is emitted for an invalid front matter key', () => {
    // A key that matches the FrontKey regex pattern [a-z][a-z0-9-]* but is not
    // in the spec-defined allowed list triggers [E001].
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      parse('@@\nbadkey: value\n@@');
      expect(warnSpy.mock.calls.some(a => /\[E001\]/.test(a.join(' ')))).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('[E002] is emitted for an unknown MetaKey', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      parse('@[unknownkey: v]');
      expect(warnSpy.mock.calls.some(a => /\[E002\]/.test(a.join(' ')))).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('[W001] is emitted for an unresolved anchor reference', () => {
    // AnchorRef is inline-only; use it inside paragraph text.
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      parse('See [#ghost-anchor] for details.');
      expect(warnSpy.mock.calls.some(a => /\[W001\]/.test(a.join(' ')))).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('[W002] is emitted for a malformed front matter line', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      parse('@@\nmalformed line without colon\n@@');
      expect(warnSpy.mock.calls.some(a => /\[W002\]/.test(a.join(' ')))).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('[E001] error does not crash the parser (fall back safely)', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(() => parse('@@\nbadkey: v\n@@')).not.toThrow();
    } finally {
      jest.restoreAllMocks();
    }
  });

  it('[W001] warning does not stop rendering', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const html = parse(':: Section\n\n[#ghost]');
      // The heading must still be rendered
      expect(html).toMatch(/<h2/);
    } finally {
      jest.restoreAllMocks();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §Security
// ─────────────────────────────────────────────────────────────────────────────

describe('§Security', () => {
  it('raw HTML in paragraph is escaped, not rendered', () => {
    const html = parse('<b>bold</b>');
    expect(html).not.toMatch(/<b>/);
    expect(html).toMatch(/&lt;b&gt;/);
  });

  it('raw <script> tag is escaped', () => {
    const html = parse('<script>alert("xss")</script>');
    expect(html).not.toMatch(/<script>/i);
    expect(html).toMatch(/&lt;script&gt;/);
  });

  it('raw HTML in heading is escaped', () => {
    const html = parse(':: <img src=x onerror=alert(1)>');
    expect(html).not.toMatch(/<img /);
    expect(html).toMatch(/&lt;img /);
  });

  it('only https:// URLs are auto-linked (http:// is not)', () => {
    const html = parse('http://insecure.example.com');
    expect(html).not.toMatch(/<a href="http:\/\//);
  });

  it('javascript: URL is not linked', () => {
    const html = parse('[javascript:alert(1) click me]');
    expect(html).not.toMatch(/href="javascript:/);
  });

  it('inline link with non-https scheme is not linked', () => {
    const html = parse('[ftp://example.com label]');
    expect(html).not.toMatch(/href="ftp:\/\//);
  });

  it('image src attribute value is HTML-escaped (& → &amp;)', () => {
    // URL query strings containing & must be escaped to &amp; in HTML attributes.
    const html = parse('https://example.com/path?a=1&b=2');
    expect(html).toMatch(/href="https:\/\/example\.com\/path\?a=1&amp;b=2"/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §Tokenizer (low-level)
// ─────────────────────────────────────────────────────────────────────────────

describe('§Tokenizer', () => {
  it('empty line → {type:"empty"} token', () => {
    const toks = tokenize('');
    expect(toks[0].type).toBe('empty');
  });

  it('@@ → front_open token', () => {
    const toks = tokenize('@@');
    expect(toks[0].type).toBe('front_open');
  });

  it('--- → hr token', () => {
    const toks = tokenize('---');
    expect(toks[0].type).toBe('hr');
  });

  it('|> → quote_open token', () => {
    const toks = tokenize('|>');
    expect(toks[0].type).toBe('quote_open');
  });

  it('$$ → math_open token', () => {
    const toks = tokenize('$$');
    expect(toks[0].type).toBe('math_open');
  });

  it('#!lang → shebang_open token with lang', () => {
    const toks = tokenize('#!python');
    expect(toks[0].type).toBe('shebang_open');
    expect(toks[0].lang).toBe('python');
  });

  it(':: heading → heading token with colons=2', () => {
    const toks = tokenize(':: My Title');
    expect(toks[0].type).toBe('heading');
    expect(toks[0].colons).toBe(2);
  });

  it('valid @[class: v] → modifier token', () => {
    const toks = tokenize('@[class: v]');
    expect(toks[0].type).toBe('modifier');
    expect(toks[0].key).toBe('class');
    expect(toks[0].value).toBe('v');
  });

  it('invalid @[bad: v] → text token (not modifier)', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const toks = tokenize('@[bad: v]');
      expect(toks[0].type).toBe('text');
    } finally {
      jest.restoreAllMocks();
    }
  });

  it('- item → ul token', () => {
    const toks = tokenize('- item text');
    expect(toks[0].type).toBe('ul');
  });

  it('1. item → ol token', () => {
    const toks = tokenize('1. item text');
    expect(toks[0].type).toBe('ol');
  });

  it('[x] item → task token (checked)', () => {
    const toks = tokenize('[x] done');
    expect(toks[0].type).toBe('task');
    expect(toks[0].checked).toBe(true);
  });

  it('[ ] item → task token (unchecked)', () => {
    const toks = tokenize('[ ] open');
    expect(toks[0].type).toBe('task');
    expect(toks[0].checked).toBe(false);
  });

  it('https://... URL line → url token', () => {
    const toks = tokenize('https://example.com');
    expect(toks[0].type).toBe('url');
  });

  it('[#anchor] standalone → anchor_block token', () => {
    const toks = tokenize('[#my-anchor]');
    expect(toks[0].type).toBe('anchor_block');
  });

  it(':= term → def_term token', () => {
    const toks = tokenize(':= My Term');
    expect(toks[0].type).toBe('def_term');
  });
});

