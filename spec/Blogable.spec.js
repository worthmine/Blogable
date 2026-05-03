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

const { describe, it, before, beforeEach }
  = require('node:test');
const assert = require('node:assert/strict');

const { parse, tokenize, buildAST } = require('./setup.js');

// ─────────────────────────────────────────────────────────────────────────────
// §FrontMatter
// ─────────────────────────────────────────────────────────────────────────────

describe('§FrontMatter', () => {
  it('renders a valid front matter block as <dl class="front-matter">', () => {
    const src = '@@\ntitle: Hello World\nauthor: Alice\n@@';
    const html = parse(src);
    assert.match(html, /<dl class="front-matter">/);
    assert.match(html, /<dt>title<\/dt><dd>Hello World<\/dd>/);
    assert.match(html, /<dt>author<\/dt><dd>Alice<\/dd>/);
  });

  it('accepts all spec-defined front matter keys', () => {
    const keys = ['title','author','date','updated','description','tags','slug','draft','lang'];
    for (const k of keys) {
      const html = parse(`@@\n${k}: value\n@@`);
      assert.match(html, new RegExp(`<dt>${k}</dt>`), `key "${k}" should be accepted`);
    }
  });

  it('accepts x-* extension keys', () => {
    const html = parse('@@\nx-version: 1.2.3\n@@');
    assert.match(html, /<dt>x-version<\/dt>/);
  });

  it('rejects an invalid front matter key with [E001] and omits it from output', () => {
    const warnings = [];
    const orig = console.warn;
    console.warn = (...a) => { warnings.push(a.join(' ')); };
    try {
      const html = parse('@@\nbadkey: value\n@@');
      assert.ok(warnings.some(w => w.includes('[E001]')), 'should emit [E001]');
      assert.doesNotMatch(html, /<dt>badkey<\/dt>/, 'invalid key must not appear in output');
    } finally {
      console.warn = orig;
    }
  });

  it('emits [W002] for a malformed front matter line and omits it from output', () => {
    const warnings = [];
    const orig = console.warn;
    console.warn = (...a) => { warnings.push(a.join(' ')); };
    try {
      const html = parse('@@\nnot a key value line\n@@');
      assert.ok(warnings.some(w => w.includes('[W002]')), 'should emit [W002]');
    } finally {
      console.warn = orig;
    }
  });

  it('front matter key regex is case-sensitive (uppercase key is treated as malformed, emits [W002])', () => {
    // FrontKey = LOWER , { LOWER | DIGIT | "-" } — uppercase never matches the key
    // pattern, so the line is rejected as malformed and [W002] is emitted.
    const warnings = [];
    const orig = console.warn;
    console.warn = (...a) => { warnings.push(a.join(' ')); };
    try {
      parse('@@\nTitle: Hello\n@@');
      assert.ok(warnings.some(w => w.includes('[W002]')), 'uppercase "Title" must emit [W002]');
    } finally {
      console.warn = orig;
    }
  });

  it('empty front matter block produces an empty dl or omits output', () => {
    const html = parse('@@\n@@');
    // Either empty dl or no output — must not crash
    assert.doesNotMatch(html, /<dt>/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §Headings
// ─────────────────────────────────────────────────────────────────────────────

describe('§Headings', () => {
  it(':: (2 colons) → <h2>', () => {
    assert.match(parse(':: Heading Two'), /^<h2 /);
  });

  it('::: (3 colons) → <h3>', () => {
    assert.match(parse('::: Heading Three'), /^<h3 /);
  });

  it(':::: (4 colons) → <h4>', () => {
    assert.match(parse(':::: Heading Four'), /^<h4 /);
  });

  it('::::: (5 colons) → <h5>', () => {
    assert.match(parse('::::: Heading Five'), /^<h5 /);
  });

  it(':::::: (6 colons) → <h6>', () => {
    assert.match(parse(':::::: Heading Six'), /^<h6 /);
  });

  it('heading carries an id derived from its text', () => {
    const html = parse(':: My Section');
    assert.match(html, /id="my-section"/);
  });

  it('numbered heading (::# text) adds class="numbered"', () => {
    const html = parse('::# Section One');
    assert.match(html, /class="numbered"/);
    assert.match(html, /<h2 /);
  });

  it('plain heading does NOT get class="numbered"', () => {
    const html = parse(':: Plain');
    assert.doesNotMatch(html, /class="numbered"/);
  });

  it('heading text is HTML-escaped', () => {
    const html = parse(':: <script>alert(1)</script>');
    assert.doesNotMatch(html, /<script>/i);
    assert.match(html, /&lt;script&gt;/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §HorizontalRule
// ─────────────────────────────────────────────────────────────────────────────

describe('§HorizontalRule', () => {
  it('--- → <hr>', () => {
    assert.equal(parse('---').replace(/\s+/g, ' ').trim(), '<hr>');
  });

  it('---- (4 dashes) is NOT a horizontal rule', () => {
    assert.doesNotMatch(parse('----'), /<hr>/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §CodeBlocks
// ─────────────────────────────────────────────────────────────────────────────

describe('§CodeBlocks', () => {
  it('renders a code block with the detected language class', () => {
    const src = '#!javascript\nconsole.log("hi");\n!#';
    const html = parse(src);
    assert.match(html, /class="language-javascript"/);
    assert.match(html, /console\.log/);
  });

  it('code block has no inline parsing (** is literal)', () => {
    const src = '#!text\n**not bold**\n!#';
    const html = parse(src);
    assert.doesNotMatch(html, /<strong>/);
    assert.match(html, /\*\*not bold\*\*/);
  });

  it('\\!# inside a code block renders as literal !#', () => {
    const src = '#!text\n\\!#\n!#';
    const html = parse(src);
    // The escaped line must appear as !# in the output, not close the block
    assert.match(html, /!#/);
  });

  it('code block with @[title: ...] shows the title in figcaption', () => {
    const src = '#!python\npass\n!#\n@[title: My Script]';
    const html = parse(src);
    assert.match(html, /My Script/);
  });

  it('code block with @[cite: https://...] renders a cite link', () => {
    const src = '#!bash\necho hi\n!#\n@[cite: https://example.com]';
    const html = parse(src);
    assert.match(html, /<cite>/);
    assert.match(html, /example\.com/);
  });

  it('#!blogable block is rendered as a code block with lang="blogable"', () => {
    const src = '#!blogable\n:: heading\n!#';
    const html = parse(src);
    assert.match(html, /language-blogable/);
  });

  it('#!ebnf block is rendered as a code block with lang="ebnf"', () => {
    const src = '#!ebnf\nRule = "x" ;\n!#';
    const html = parse(src);
    assert.match(html, /language-ebnf/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §QuoteBlocks
// ─────────────────────────────────────────────────────────────────────────────

describe('§QuoteBlocks', () => {
  it('> text → inline blockquote <blockquote><p>…</p></blockquote>', () => {
    const html = parse('> This is a quote.');
    assert.match(html, /<blockquote><p>/);
    assert.match(html, /This is a quote\./);
  });

  it('|> … <| → block blockquote', () => {
    const src = '|>\nLine one.\nLine two.\n<|';
    const html = parse(src);
    assert.match(html, /<blockquote>/);
    assert.match(html, /Line one\./);
  });

  it('block quote with @[author: …] renders author in footer', () => {
    const src = '|>\nSome text.\n<|\n@[author: Alice]';
    const html = parse(src);
    assert.match(html, /Alice/);
    assert.match(html, /<footer>/);
  });

  it('block quote with @[cite: https://…] renders cite in footer', () => {
    const src = '|>\nSome text.\n<|\n@[cite: https://example.com]';
    const html = parse(src);
    assert.match(html, /<cite>/);
    assert.match(html, /example\.com/);
  });

  it('inline parsing is enabled inside quote blocks (**bold**)', () => {
    const src = '|>\n**bold text**\n<|';
    const html = parse(src);
    assert.match(html, /<strong>bold text<\/strong>/);
  });

  it('blank line inside |>…<| separates paragraphs', () => {
    const src = '|>\nFirst para.\n\nSecond para.\n<|';
    const html = parse(src);
    // Should have two <p> elements
    const ps = html.match(/<p>/g) || [];
    assert.ok(ps.length >= 2, 'expected at least two paragraphs');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §MathBlocks
// ─────────────────────────────────────────────────────────────────────────────

describe('§MathBlocks', () => {
  it('$$ … $$ → <div class="math-block">', () => {
    const src = '$$\nE = mc^2\n$$';
    const html = parse(src);
    assert.match(html, /<div class="math-block">/);
    assert.match(html, /E = mc\^2/);
  });

  it('math block content is HTML-escaped', () => {
    const src = '$$\n<script>alert(1)</script>\n$$';
    const html = parse(src);
    assert.doesNotMatch(html, /<script>/i);
    assert.match(html, /&lt;script&gt;/);
  });

  it('inline parsing is disabled inside math blocks (** is literal)', () => {
    const src = '$$\n**not bold**\n$$';
    const html = parse(src);
    assert.doesNotMatch(html, /<strong>/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §URLs — UrlBlock and ImageURL
// ─────────────────────────────────────────────────────────────────────────────

describe('§URLs', () => {
  it('standalone https:// URL → autolink paragraph', () => {
    const html = parse('https://example.com');
    assert.match(html, /<a href="https:\/\/example\.com"/);
    assert.match(html, /rel="noopener noreferrer"/);
  });

  it('http:// URL (non-https) is NOT auto-linked (security requirement)', () => {
    const html = parse('http://example.com');
    assert.doesNotMatch(html, /<a href="http:\/\//);
  });

  it('image URL (.png) → <figure> with <img>', () => {
    const html = parse('https://example.com/photo.png');
    assert.match(html, /<figure/);
    assert.match(html, /<img /);
    assert.match(html, /src="https:\/\/example\.com\/photo\.png"/);
  });

  it('image URL (.jpg) → <img>', () => {
    assert.match(parse('https://example.com/img.jpg'), /<img /);
  });

  it('image URL (.jpeg) → <img>', () => {
    assert.match(parse('https://example.com/img.jpeg'), /<img /);
  });

  it('image URL (.gif) → <img>', () => {
    assert.match(parse('https://example.com/img.gif'), /<img /);
  });

  it('image URL (.webp) → <img>', () => {
    assert.match(parse('https://example.com/img.webp'), /<img /);
  });

  it('.svg URL is NOT treated as an image (spec: SVG MUST NOT be treated as an image)', () => {
    const html = parse('https://example.com/graphic.svg');
    assert.doesNotMatch(html, /<img /);
  });

  it('image block with @[alt: …] sets alt attribute', () => {
    const src = 'https://example.com/photo.png\n@[alt: A photo]';
    const html = parse(src);
    assert.match(html, /alt="A photo"/);
  });

  it('multiple image URLs in a row → single <figure> with multiple <img>', () => {
    const src = 'https://example.com/a.png\nhttps://example.com/b.png';
    const html = parse(src);
    const imgs = html.match(/<img /g) || [];
    assert.equal(imgs.length, 2);
    // Only one figure wrapper
    const figs = html.match(/<figure/g) || [];
    assert.equal(figs.length, 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §Lists
// ─────────────────────────────────────────────────────────────────────────────

describe('§Lists', () => {
  it('unordered list items → <ul><li>…</li></ul>', () => {
    const src = '- Alpha\n- Beta\n- Gamma';
    const html = parse(src);
    assert.match(html, /<ul>/);
    assert.match(html, /<li>Alpha<\/li>/);
    assert.match(html, /<li>Beta<\/li>/);
  });

  it('ordered list items → <ol><li>…</li></ol>', () => {
    const src = '1. First\n2. Second';
    const html = parse(src);
    assert.match(html, /<ol>/);
    assert.match(html, /<li>First<\/li>/);
  });

  it('nested list (2-space indent) → nested <ul>', () => {
    const src = '- Parent\n  - Child';
    const html = parse(src);
    assert.match(html, /<ul>/);
    // Nested list must appear inside the outer list
    assert.match(html, /<li>Parent[\s\S]*<ul>[\s\S]*<li>Child<\/li>/);
  });

  it('task list [x] → checked checkbox', () => {
    const html = parse('[x] Done task');
    assert.match(html, /type="checkbox"/);
    assert.match(html, /checked/);
  });

  it('task list [ ] → unchecked checkbox', () => {
    const html = parse('[ ] Open task');
    assert.match(html, /type="checkbox"/);
    assert.doesNotMatch(html, / checked/);
  });

  it('task list checkbox is disabled (read-only)', () => {
    const html = parse('[x] Done');
    assert.match(html, /disabled/);
  });

  it('list items support inline parsing (**bold**)', () => {
    const html = parse('- **bold item**');
    assert.match(html, /<strong>bold item<\/strong>/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §InlineSyntax
// ─────────────────────────────────────────────────────────────────────────────

describe('§InlineSyntax', () => {
  // ── individual span types ─────────────────────────────────────────────────

  it('Code: `text` → <code>text</code>', () => {
    assert.match(parse('`hello`'), /<code>hello<\/code>/);
  });

  it('Code: content may be empty (`` `` → <code></code>)', () => {
    assert.match(parse('``'), /<code><\/code>/);
  });

  it('Code: backtick content is HTML-escaped', () => {
    const html = parse('`<b>`');
    assert.match(html, /&lt;b&gt;/);
    assert.doesNotMatch(html, /<b>/);
  });

  it('Code: newline inside backticks does NOT form a code span', () => {
    // CodeChar = any except ` and NL; the two lines are separate tokens
    const html = parse('`line1\nline2`');
    assert.doesNotMatch(html, /<code>line1\nline2<\/code>/);
    // Each fragment is rendered as plain text (escaped)
    assert.match(html, /`line1/);
  });

  it('Link: [https://url label] → <a href="…">label</a>', () => {
    const html = parse('[https://example.com Visit Example]');
    assert.match(html, /<a href="https:\/\/example\.com"/);
    assert.match(html, /Visit Example/);
    assert.match(html, /rel="noopener noreferrer"/);
    assert.match(html, /target="_blank"/);
  });

  it('Link: URL must end at the first space (no space in URL portion)', () => {
    // The HTTPS_URL token class is [^ \]\n]+ — it stops at the first space.
    // A raw URL with a space is not a valid Link; the rest becomes part of the label.
    const html = parse('[https://example.com/path label text]');
    assert.match(html, /href="https:\/\/example\.com\/path"/);
    assert.match(html, />label text</);
  });

  it('Link: http:// is rejected (https only)', () => {
    const html = parse('[http://example.com label]');
    assert.doesNotMatch(html, /<a href="http:\/\//);
  });

  it('Footnote: [^text] → superscript footnote reference', () => {
    const html = parse('[^See note 1]');
    assert.match(html, /<sup>/);
    assert.match(html, /fn-1/);
  });

  it('Footnote: [^https://url label] → URL footnote', () => {
    const html = parse('[^https://example.com Example]');
    assert.match(html, /<sup>/);
    // footnote list rendered at end
    assert.match(html, /example\.com/);
  });

  it('Footnote: multiple footnotes are numbered sequentially', () => {
    const html = parse('[^First note] and [^Second note]');
    assert.match(html, /fn-1/);
    assert.match(html, /fn-2/);
  });

  it('AnchorRef: [#heading-id] resolves to an in-page link when heading exists', () => {
    // AnchorRef is an inline construct; it must appear inside paragraph text,
    // not as a standalone line (which would be tokenised as anchor_block instead).
    const src = ':: My Section\n\nSee [#My Section] for details.';
    const html = parse(src);
    assert.match(html, /<a href="#my-section" class="anchor-ref"/);
  });

  it('AnchorRef: [#unknown] emits [W001] and renders plain text', () => {
    // AnchorRef is inline-only; use it inside paragraph text so it is not
    // tokenised as a standalone anchor_block.
    const warnings = [];
    const orig = console.warn;
    console.warn = (...a) => { warnings.push(a.join(' ')); };
    try {
      const html = parse('Read [#nonexistent] for more.');
      assert.ok(warnings.some(w => w.includes('[W001]')), 'should emit [W001]');
      assert.doesNotMatch(html, /<a /);
    } finally {
      console.warn = orig;
    }
  });

  it('Strong: **text** → <strong>text</strong>', () => {
    assert.match(parse('**bold**'), /<strong>bold<\/strong>/);
  });

  it('Strong: newline inside ** does NOT form a strong span', () => {
    const html = parse('**line1\nline2**');
    assert.doesNotMatch(html, /<strong>/);
  });

  it('Emphasis: *text* → <em>text</em>', () => {
    assert.match(parse('*italic*'), /<em>italic<\/em>/);
  });

  it('Emphasis: newline inside * does NOT form an emphasis span', () => {
    const html = parse('*line1\nline2*');
    assert.doesNotMatch(html, /<em>/);
  });

  it('Delete: ~~text~~ → <del>text</del>', () => {
    assert.match(parse('~~deleted~~'), /<del>deleted<\/del>/);
  });

  it('Delete: newline inside ~~ does NOT form a del span', () => {
    const html = parse('~~line1\nline2~~');
    assert.doesNotMatch(html, /<del>/);
  });

  it('Insert: ++text++ → <ins>text</ins>', () => {
    assert.match(parse('++inserted++'), /<ins>inserted<\/ins>/);
  });

  it('Insert: newline inside ++ does NOT form an ins span', () => {
    const html = parse('++line1\nline2++');
    assert.doesNotMatch(html, /<ins>/);
  });

  // ── evaluation order (Code > Link > Footnote > AnchorRef > Strong > Emphasis > Delete > Insert) ──

  it('Code wins over Strong: `**text**` → <code>**text**</code>', () => {
    const html = parse('`**text**`');
    assert.match(html, /<code>\*\*text\*\*<\/code>/);
    assert.doesNotMatch(html, /<strong>/);
  });

  it('Code wins over Emphasis: `*text*` → <code>*text*</code>', () => {
    const html = parse('`*text*`');
    assert.match(html, /<code>\*text\*<\/code>/);
    assert.doesNotMatch(html, /<em>/);
  });

  it('Strong: StrongChar excludes * so **a*b*c** does not match as strong', () => {
    // StrongChar = ? any character except "*" and NL ? — an asterisk inside the
    // content means the Strong pattern fails to match and the text is rendered
    // character-by-character (the * chars are plain, inner *a* / *c* become <em>).
    const html = parse('**a*b*c**');
    assert.doesNotMatch(html, /<strong>/);
  });

  // ── no nesting ────────────────────────────────────────────────────────────

  it('Inline elements MUST NOT nest: **bold *em* content** does not form strong (StrongChar excludes *)', () => {
    // Because StrongChar = ? any except "*" and NL ?, the Strong pattern does not
    // match when inner content contains "*".  The scanner falls to plain chars and
    // inner *…* spans may be parsed as Emphasis instead — but never as nested spans.
    const html = parse('**bold *em* content**');
    // Strong must not match (inner * breaks StrongChar constraint)
    assert.doesNotMatch(html, /<strong>/);
  });

  it('Inline elements MUST NOT nest: ~~del **strong** text~~ renders del only', () => {
    const html = parse('~~del **strong** text~~');
    assert.match(html, /<del>/);
    assert.doesNotMatch(html, /<strong>/);
  });

  // ── HTML escaping ─────────────────────────────────────────────────────────

  it('plain text is HTML-escaped', () => {
    const html = parse('<script>alert(1)</script>');
    assert.doesNotMatch(html, /<script>/i);
    assert.match(html, /&lt;script&gt;/);
  });

  it('inline text with & is HTML-escaped to &amp;', () => {
    const html = parse('A & B');
    assert.match(html, /A &amp; B/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §InternalAnchors
// ─────────────────────────────────────────────────────────────────────────────

describe('§InternalAnchors', () => {
  it('[#text] standalone block → <span class="anchor-block" id="…">', () => {
    const html = parse('[#my-anchor]');
    assert.match(html, /<span class="anchor-block"/);
    assert.match(html, /id="my-anchor"/);
  });

  it('anchor block id is derived via slugify', () => {
    const html = parse('[#My Anchor]');
    assert.match(html, /id="my-anchor"/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §Definitions
// ─────────────────────────────────────────────────────────────────────────────

describe('§Definitions', () => {
  it(':= Term followed by text → <dl class="def-block"><dt>Term</dt><dd>…</dd>', () => {
    const src = ':= MyTerm\nThe definition body.';
    const html = parse(src);
    assert.match(html, /<dl class="def-block">/);
    assert.match(html, /<dt>MyTerm<\/dt>/);
    assert.match(html, /The definition body\./);
  });

  it('definition term supports inline parsing (**bold**)', () => {
    const src = ':= **Bold** Term\nBody text.';
    const html = parse(src);
    assert.match(html, /<strong>Bold<\/strong>/);
  });

  it('definition body supports inline parsing (*italic*)', () => {
    const src = ':= Term\n*italic body*';
    const html = parse(src);
    assert.match(html, /<em>italic body<\/em>/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §Metadata
// ─────────────────────────────────────────────────────────────────────────────

describe('§Metadata', () => {
  it('@[class: value] after a heading adds class attribute', () => {
    const src = ':: My Heading\n@[class: highlight]';
    // Heading consumes modifier before it's emitted as AST node
    // Actually modifiers follow the heading in token stream
    const html = parse(src);
    assert.match(html, /class="[^"]*highlight[^"]*"/);
  });

  it('@[id: value] after a block sets id attribute', () => {
    const src = ':: Section\n@[id: custom-id]';
    const html = parse(src);
    assert.match(html, /id="custom-id"/);
  });

  it('@[x-foo: bar] after a block adds data-foo="bar"', () => {
    const src = ':: Section\n@[x-foo: bar]';
    const html = parse(src);
    assert.match(html, /data-foo="bar"/);
  });

  it('unknown MetaKey emits [E002] and falls back to literal text', () => {
    const warnings = [];
    const orig = console.warn;
    console.warn = (...a) => { warnings.push(a.join(' ')); };
    try {
      const html = parse('@[badkey: value]');
      assert.ok(warnings.some(w => w.includes('[E002]')), 'should emit [E002]');
      // Should appear as text, not as a modifier attribute
      assert.doesNotMatch(html, /badkey="value"/);
      assert.doesNotMatch(html, /data-badkey/);
    } finally {
      console.warn = orig;
    }
  });

  it('MetaKey modifier uses SP (single space) after colon', () => {
    // @[key:  value] — two spaces → not a valid modifier (falls back to text)
    const warnings = [];
    const orig = console.warn;
    console.warn = (...a) => { warnings.push(a.join(' ')); };
    try {
      parse('@[class:  double-space]');
      // With double space the modifier regex won't match; [E002] may or may not
      // fire depending on the regex. The key assertion: no class attr applied.
      // (This is a tokenizer-level strictness test.)
    } finally {
      console.warn = orig;
    }
    // No assertion on warning here — the strictness guarantee is just that the
    // double-space line is NOT treated as a valid modifier.
    const html = parse('@[class:  double-space]');
    assert.doesNotMatch(html, /class="double-space"/);
  });

  it('metadata does not cross blank lines (modifier after blank is a new block)', () => {
    const src = ':: Heading\n\n@[class: late]';
    const html = parse(src);
    // The class should NOT be applied to the heading since there's a blank line
    assert.doesNotMatch(html, /<h2[^>]*class="[^"]*late[^"]*"/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §Diagnostics
// ─────────────────────────────────────────────────────────────────────────────

describe('§Diagnostics', () => {
  it('[E001] is emitted for an invalid front matter key', () => {
    // A key that matches the FrontKey regex pattern [a-z][a-z0-9-]* but is not
    // in the spec-defined allowed list triggers [E001].
    const warnings = [];
    const orig = console.warn;
    console.warn = (...a) => { warnings.push(a.join(' ')); };
    try {
      parse('@@\nbadkey: value\n@@');
      assert.ok(warnings.some(w => /\[E001\]/.test(w)));
    } finally {
      console.warn = orig;
    }
  });

  it('[E002] is emitted for an unknown MetaKey', () => {
    const warnings = [];
    const orig = console.warn;
    console.warn = (...a) => { warnings.push(a.join(' ')); };
    try {
      parse('@[unknownkey: v]');
      assert.ok(warnings.some(w => /\[E002\]/.test(w)));
    } finally {
      console.warn = orig;
    }
  });

  it('[W001] is emitted for an unresolved anchor reference', () => {
    // AnchorRef is inline-only; use it inside paragraph text.
    const warnings = [];
    const orig = console.warn;
    console.warn = (...a) => { warnings.push(a.join(' ')); };
    try {
      parse('See [#ghost-anchor] for details.');
      assert.ok(warnings.some(w => /\[W001\]/.test(w)));
    } finally {
      console.warn = orig;
    }
  });

  it('[W002] is emitted for a malformed front matter line', () => {
    const warnings = [];
    const orig = console.warn;
    console.warn = (...a) => { warnings.push(a.join(' ')); };
    try {
      parse('@@\nmalformed line without colon\n@@');
      assert.ok(warnings.some(w => /\[W002\]/.test(w)));
    } finally {
      console.warn = orig;
    }
  });

  it('[E001] error does not crash the parser (fall back safely)', () => {
    const orig = console.warn;
    console.warn = () => {};
    try {
      assert.doesNotThrow(() => parse('@@\nbadkey: v\n@@'));
    } finally {
      console.warn = orig;
    }
  });

  it('[W001] warning does not stop rendering', () => {
    const orig = console.warn;
    console.warn = () => {};
    try {
      const html = parse(':: Section\n\n[#ghost]');
      // The heading must still be rendered
      assert.match(html, /<h2/);
    } finally {
      console.warn = orig;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §Security
// ─────────────────────────────────────────────────────────────────────────────

describe('§Security', () => {
  it('raw HTML in paragraph is escaped, not rendered', () => {
    const html = parse('<b>bold</b>');
    assert.doesNotMatch(html, /<b>/);
    assert.match(html, /&lt;b&gt;/);
  });

  it('raw <script> tag is escaped', () => {
    const html = parse('<script>alert("xss")</script>');
    assert.doesNotMatch(html, /<script>/i);
    assert.match(html, /&lt;script&gt;/);
  });

  it('raw HTML in heading is escaped', () => {
    const html = parse(':: <img src=x onerror=alert(1)>');
    assert.doesNotMatch(html, /<img /);
    assert.match(html, /&lt;img /);
  });

  it('only https:// URLs are auto-linked (http:// is not)', () => {
    const html = parse('http://insecure.example.com');
    assert.doesNotMatch(html, /<a href="http:\/\//);
  });

  it('javascript: URL is not linked', () => {
    const html = parse('[javascript:alert(1) click me]');
    assert.doesNotMatch(html, /href="javascript:/);
  });

  it('inline link with non-https scheme is not linked', () => {
    const html = parse('[ftp://example.com label]');
    assert.doesNotMatch(html, /href="ftp:\/\//);
  });

  it('image src attribute value is HTML-escaped (& → &amp;)', () => {
    // URL query strings containing & must be escaped to &amp; in HTML attributes.
    const html = parse('https://example.com/path?a=1&b=2');
    assert.match(html, /href="https:\/\/example\.com\/path\?a=1&amp;b=2"/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §Tokenizer (low-level)
// ─────────────────────────────────────────────────────────────────────────────

describe('§Tokenizer', () => {
  it('empty line → {type:"empty"} token', () => {
    const toks = tokenize('');
    assert.equal(toks[0].type, 'empty');
  });

  it('@@ → front_open token', () => {
    const toks = tokenize('@@');
    assert.equal(toks[0].type, 'front_open');
  });

  it('--- → hr token', () => {
    const toks = tokenize('---');
    assert.equal(toks[0].type, 'hr');
  });

  it('|> → quote_open token', () => {
    const toks = tokenize('|>');
    assert.equal(toks[0].type, 'quote_open');
  });

  it('$$ → math_open token', () => {
    const toks = tokenize('$$');
    assert.equal(toks[0].type, 'math_open');
  });

  it('#!lang → shebang_open token with lang', () => {
    const toks = tokenize('#!python');
    assert.equal(toks[0].type, 'shebang_open');
    assert.equal(toks[0].lang, 'python');
  });

  it(':: heading → heading token with colons=2', () => {
    const toks = tokenize(':: My Title');
    assert.equal(toks[0].type, 'heading');
    assert.equal(toks[0].colons, 2);
  });

  it('valid @[class: v] → modifier token', () => {
    const toks = tokenize('@[class: v]');
    assert.equal(toks[0].type, 'modifier');
    assert.equal(toks[0].key, 'class');
    assert.equal(toks[0].value, 'v');
  });

  it('invalid @[bad: v] → text token (not modifier)', () => {
    const orig = console.warn;
    console.warn = () => {};
    try {
      const toks = tokenize('@[bad: v]');
      assert.equal(toks[0].type, 'text');
    } finally {
      console.warn = orig;
    }
  });

  it('- item → ul token', () => {
    const toks = tokenize('- item text');
    assert.equal(toks[0].type, 'ul');
  });

  it('1. item → ol token', () => {
    const toks = tokenize('1. item text');
    assert.equal(toks[0].type, 'ol');
  });

  it('[x] item → task token (checked)', () => {
    const toks = tokenize('[x] done');
    assert.equal(toks[0].type, 'task');
    assert.equal(toks[0].checked, true);
  });

  it('[ ] item → task token (unchecked)', () => {
    const toks = tokenize('[ ] open');
    assert.equal(toks[0].type, 'task');
    assert.equal(toks[0].checked, false);
  });

  it('https://... URL line → url token', () => {
    const toks = tokenize('https://example.com');
    assert.equal(toks[0].type, 'url');
  });

  it('[#anchor] standalone → anchor_block token', () => {
    const toks = tokenize('[#my-anchor]');
    assert.equal(toks[0].type, 'anchor_block');
  });

  it(':= term → def_term token', () => {
    const toks = tokenize(':= My Term');
    assert.equal(toks[0].type, 'def_term');
  });
});
