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

const { parse, tokenize, buildAST, getDiagnostics } = require('./setup.js');

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
    const keys = ['title','author','date','updated','description','tags','slug','lang'];
    for (const k of keys) {
      const html = parse(`@@\n${k}: value\n@@`);
      expect(html).toMatch(new RegExp(`<dt>${k}</dt>`));
    }
  });

  it('accepts x-* extension keys', () => {
    const html = parse('@@\nx-version: 1.2.3\n@@');
    expect(html).toMatch(/<dt>x-version<\/dt>/);
  });

  it('rejects an invalid front matter key with [E201] and omits it from output', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const html = parse('@@\nbadkey: value\n@@');
      expect(warnSpy.mock.calls.some(a => a.join(' ').includes('[E201]'))).toBe(true);
      expect(html).not.toMatch(/<dt>badkey<\/dt>/);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('emits [W201] for a malformed front matter line', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      parse('@@\nnot a key value line\n@@');
      expect(warnSpy.mock.calls.some(a => a.join(' ').includes('[W201]'))).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('front matter key regex is case-sensitive (uppercase key is treated as malformed, emits [W201])', () => {
    // FrontKey = LOWER , { LOWER | DIGIT | "-" } — uppercase never matches the key
    // pattern, so the line is rejected as malformed and [W201] is emitted.
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      parse('@@\nTitle: Hello\n@@');
      expect(warnSpy.mock.calls.some(a => a.join(' ').includes('[W201]'))).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('empty front matter block produces an empty dl or omits output', () => {
    const html = parse('@@\n@@');
    // Either empty dl or no output — must not crash
    expect(html).not.toMatch(/<dt>/);
  });

  it('strips inline YAML comments from front matter values', () => {
    const html = parse('@@\ntitle: My Doc # this is a comment\n@@');
    expect(html).toMatch(/<dt>title<\/dt><dd>My Doc<\/dd>/);
    expect(html).not.toMatch(/this is a comment/);
  });

  it('strips inline YAML comment, preserving the value before the comment marker', () => {
    const html = parse('@@\nx-version: 1.1-alpha # Blogable version\n@@');
    expect(html).toMatch(/<dt>x-version<\/dt><dd>1.1-alpha<\/dd>/);
    expect(html).not.toMatch(/Blogable version/);
  });

  it('accepts YAML comment-only lines in front matter', () => {
    const html = parse('@@\n# this is a YAML comment\ntitle: My Doc\n@@');
    expect(html).toMatch(/<dt>title<\/dt><dd>My Doc<\/dd>/);
    expect(getDiagnostics().some(d => d.code === 'W201')).toBe(false);
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

  it('heading contains a self-referential anchor link', () => {
    const html = parse(':: My Section');
    expect(html).toMatch(/<h2 id="my-section"[^>]*><a href="#my-section">My Section<\/a><\/h2>/);
  });

  it('numbered heading contains a self-referential anchor link', () => {
    const html = parse('::# Section One');
    expect(html).toMatch(/<h2 [^>]*><a href="#section-one">Section One<\/a><\/h2>/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §HorizontalRule
// ─────────────────────────────────────────────────────────────────────────────

describe('§HorizontalRule', () => {
  it('--- → <hr>', () => {
    expect(parse('---').replace(/\s+/g, ' ').trim()).toBe('<hr>');
  });

  it('---- (4 dashes) is a horizontal rule', () => {
    expect(parse('----').replace(/\s+/g, ' ').trim()).toBe('<hr>');
  });

  it('-- (2 dashes) is NOT a horizontal rule', () => {
    expect(parse('--')).not.toMatch(/<hr>/);
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

  it('#!perl block is rendered as a code block with lang="perl"', () => {
    const src = '#!perl\nprint "Hello, World!\\n";\n!#';
    const html = parse(src);
    expect(html).toMatch(/language-perl/);
    expect(html).toMatch(/Hello, World!/);
  });

  it('#!/usr/bin/perl shebang opens a perl code block', () => {
    const src = '#!/usr/bin/perl\nuse strict;\n!#';
    const html = parse(src);
    expect(html).toMatch(/language-perl/);
    expect(html).toMatch(/use strict/);
  });

  it('#!/usr/bin/env perl shebang opens a perl code block', () => {
    const src = '#!/usr/bin/env perl\nuse warnings;\n!#';
    const html = parse(src);
    expect(html).toMatch(/language-perl/);
  });

  it('perl code block: $# is treated as literal code (no block close)', () => {
    const src = '#!perl\nmy @arr = (1, 2, 3);\nprint $#arr;\n!#';
    const html = parse(src);
    expect(html).toMatch(/language-perl/);
    expect(html).toMatch(/\$#arr/);
  });

  it('#!python block is rendered as a code block with lang="python"', () => {
    const src = '#!python\nprint("hello")\n!#';
    const html = parse(src);
    expect(html).toMatch(/language-python/);
    expect(html).toMatch(/print/);
  });

  it('#!/usr/bin/python3 shebang opens a python code block', () => {
    const src = '#!/usr/bin/python3\nimport sys\n!#';
    const html = parse(src);
    expect(html).toMatch(/language-python/);
    expect(html).toMatch(/import sys/);
  });

  it('#!/usr/bin/env python3 shebang opens a python code block', () => {
    const src = '#!/usr/bin/env python3\nx = 1\n!#';
    const html = parse(src);
    expect(html).toMatch(/language-python/);
  });

  it('#!rust block is rendered as a code block with lang="rust"', () => {
    const src = '#!rust\nfn main() {}\n!#';
    const html = parse(src);
    expect(html).toMatch(/language-rust/);
    expect(html).toMatch(/fn main/);
  });

  it('#!go block is rendered as a code block with lang="go"', () => {
    const src = '#!go\npackage main\n!#';
    const html = parse(src);
    expect(html).toMatch(/language-go/);
    expect(html).toMatch(/package main/);
  });

  it('#!swift block is rendered as a code block with lang="swift"', () => {
    const src = '#!swift\nprint("hi")\n!#';
    const html = parse(src);
    expect(html).toMatch(/language-swift/);
  });

  it('#!/usr/bin/swift shebang opens a swift code block', () => {
    const src = '#!/usr/bin/swift\nlet x = 1\n!#';
    const html = parse(src);
    expect(html).toMatch(/language-swift/);
    expect(html).toMatch(/let x/);
  });

  it('#!/usr/bin/env swift shebang opens a swift code block', () => {
    const src = '#!/usr/bin/env swift\nvar y = 2\n!#';
    const html = parse(src);
    expect(html).toMatch(/language-swift/);
  });

  it('#!bash block is rendered as a code block with lang="bash"', () => {
    const src = '#!bash\necho "hello"\n!#';
    const html = parse(src);
    expect(html).toMatch(/language-bash/);
    expect(html).toMatch(/echo/);
  });

  it('#!sh block normalises to lang="bash"', () => {
    const src = '#!sh\necho "hi"\n!#';
    const html = parse(src);
    expect(html).toMatch(/language-bash/);
  });

  it('#!zsh block normalises to lang="bash"', () => {
    const src = '#!zsh\necho "zsh"\n!#';
    const html = parse(src);
    expect(html).toMatch(/language-bash/);
  });

  it('#!/bin/bash shebang opens a bash code block', () => {
    const src = '#!/bin/bash\nset -e\n!#';
    const html = parse(src);
    expect(html).toMatch(/language-bash/);
    expect(html).toMatch(/set -e/);
  });

  it('#!/usr/bin/env bash shebang opens a bash code block', () => {
    const src = '#!/usr/bin/env bash\necho ok\n!#';
    const html = parse(src);
    expect(html).toMatch(/language-bash/);
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
  it('$$ … $$ → <pre class="math-block"><code>…</code></pre>', () => {
    const src = '$$\nE = mc^2\n$$';
    const html = parse(src);
    expect(html).toMatch(/<pre class="math-block"><code>/);
    expect(html).toMatch(/E = mc\^2/);
    expect(html).toMatch(/<\/code><\/pre>/);
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

  it('autolink label is derived from the URL itself', () => {
    const html = parse('https://example.com/path/to/post');
    expect(html).toMatch(/>example\.com<\/a>/);
    expect(html).not.toMatch(/>example\.com \/ post<\/a>/);
  });

  it('http:// URL (non-https) is NOT auto-linked (security requirement)', () => {
    const html = parse('http://example.com');
    expect(html).not.toMatch(/<a href="http:\/\//);
  });

  it('image URL (.png) → autolink (not a figure)', () => {
    const html = parse('https://example.com/photo.png');
    expect(html).not.toMatch(/<figure/);
    expect(html).not.toMatch(/<img /);
    expect(html).toMatch(/<a href="https:\/\/example\.com\/photo\.png"/);
  });

  it('image URL (.jpg) → autolink (not <img>)', () => {
    expect(parse('https://example.com/img.jpg')).not.toMatch(/<img /);
    expect(parse('https://example.com/img.jpg')).toMatch(/<a /);
  });

  it('image URL (.jpeg) → autolink (not <img>)', () => {
    expect(parse('https://example.com/img.jpeg')).not.toMatch(/<img /);
  });

  it('image URL (.gif) → autolink (not <img>)', () => {
    expect(parse('https://example.com/img.gif')).not.toMatch(/<img /);
  });

  it('image URL (.webp) → autolink (not <img>)', () => {
    expect(parse('https://example.com/img.webp')).not.toMatch(/<img /);
  });

  it('.svg external URL is just an autolink (image embedding is ObsidianEmbed-only)', () => {
    const html = parse('https://example.com/graphic.svg');
    expect(html).not.toMatch(/<img /);
    expect(html).toMatch(/<a /);
  });

  it('external image URL with @[alt: …] modifier — modifier is consumed but produces no <img>', () => {
    const html = parse('https://example.com/photo.png\n@[alt: A photo]');
    expect(html).not.toMatch(/<img /);
  });

  it('multiple image URLs in a row → separate autolink paragraphs, no <figure>', () => {
    const src = 'https://example.com/a.png\nhttps://example.com/b.png';
    const html = parse(src);
    expect(html).not.toMatch(/<figure/);
    expect(html).not.toMatch(/<img /);
    expect((html.match(/<a /g) || []).length).toBeGreaterThanOrEqual(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §ObsidianEmbed
// ─────────────────────────────────────────────────────────────────────────────

describe('§ObsidianEmbed', () => {
  it('![[image.png]] → <figure> with <img src="image.png">', () => {
    const html = parse('![[image.png]]');
    expect(html).toMatch(/<figure/);
    expect(html).toMatch(/<img /);
    expect(html).toMatch(/src="image\.png"/);
  });

  it('![[image.png|alt text]] → <img alt="alt text">', () => {
    const html = parse('![[image.png|alt text]]');
    expect(html).toMatch(/alt="alt text"/);
    expect(html).toMatch(/src="image\.png"/);
  });

  it('![[image.png]] with @[alt: description] modifier → <img alt="description"> (and emits W802)', () => {
    const html = parse('![[image.png]]\n@[alt: description]');
    expect(html).toMatch(/alt="description"/);
    expect(html).toMatch(/src="image\.png"/);
    expect(getDiagnostics().some(d => d.code === 'W802')).toBe(true);
  });

  it('![[path/to/photo.jpg]] — nested path is used as src', () => {
    const html = parse('![[path/to/photo.jpg]]');
    expect(html).toMatch(/src="path\/to\/photo\.jpg"/);
  });

  it('![[image.png]] has loading="lazy" and decoding="async"', () => {
    const html = parse('![[image.png]]');
    expect(html).toMatch(/loading="lazy"/);
    expect(html).toMatch(/decoding="async"/);
  });

  it('![[<evil>.png]] — path is HTML-escaped', () => {
    const html = parse('![[<evil>.png]]');
    expect(html).not.toMatch(/<evil>/);
    expect(html).toMatch(/&lt;evil&gt;/);
  });

  it('![[img.png|<b>bold</b>]] — alt text is HTML-escaped', () => {
    const html = parse('![[img.png|<b>bold</b>]]');
    expect(html).not.toMatch(/<b>/);
    expect(html).toMatch(/&lt;b&gt;/);
  });

  it('![[image with spaces.png]] — spaces in filename supported', () => {
    const html = parse('![[image with spaces.png]]');
    expect(html).toMatch(/src="image with spaces\.png"/);
  });

  it('![[日本語画像.png]] — Japanese filename supported', () => {
    const html = parse('![[日本語画像.png]]');
    expect(html).toMatch(/src="日本語画像\.png"/);
  });

  it('![[image.svg]] — SVG is supported in ObsidianEmbed', () => {
    const html = parse('![[image.svg]]');
    expect(html).toMatch(/<figure/);
    expect(html).toMatch(/<img /);
    expect(html).toMatch(/src="image\.svg"/);
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
    const src = '# First\n# Second\n# Third';
    const html = parse(src);
    expect(html).toMatch(/<ol>/);
    expect(html).toMatch(/<li>First<\/li>/);
    expect(html).toMatch(/<li>Second<\/li>/);
    expect(html).toMatch(/<li>Third<\/li>/);
  });

  it('casual DL item (? dt + = dd) → <dl><dt>…</dt><dd>…</dd></dl>', () => {
    const html = parse('? Term\n= Definition line');
    expect(html).toMatch(/<dl>/);
    expect(html).toMatch(/<dt>Term<\/dt><dd>Definition line<\/dd>/);
  });

  it('casual DL allows duplicate terms without [W401] (separate from := definition blocks)', () => {
    parse('? Term\n= First\n? Term\n= Second');
    expect(getDiagnostics().some(d => d.code === 'W401')).toBe(false);
  });

  it('casual DL term without following = line does not render <dl> and emits [E403]', () => {
    const html = parse('? TermOnly');
    expect(html).not.toMatch(/<dl>/);
    expect(getDiagnostics().some(d => d.code === 'E403')).toBe(true);
  });

  it('casual DL description without preceding ? term falls back to paragraph and emits [E403]', () => {
    const html = parse('= orphan description');
    expect(html).toMatch(/<p>orphan description<\/p>/);
    expect(getDiagnostics().some(d => d.code === 'E403')).toBe(true);
  });

  it('casual DL cannot be nested under lists (indented ?/= stay plain text)', () => {
    const html = parse('- Parent\n  ? Term\n  = Desc');
    expect(html).not.toMatch(/<dl>/);
    expect(html).toMatch(/\? Term/);
    expect(getDiagnostics().some(d => d.code === 'E403')).toBe(true);
  });

  it(':= definition cannot be nested under lists (indented := stays plain text)', () => {
    const html = parse('- Parent\n  := NestedTerm\n  Body');
    expect(html).not.toMatch(/<dl class="def-block">/);
    expect(html).toMatch(/:= NestedTerm/);
    expect(getDiagnostics().some(d => d.code === 'E403')).toBe(true);
  });

  it('nested ordered list (2-space indent) → nested <ol>', () => {
    const src = '# Parent\n  # Child';
    const html = parse(src);
    expect(html).toMatch(/<ol>/);
    expect(html).toMatch(/<li>Parent[\s\S]*<ol>[\s\S]*<li>Child<\/li>/);
  });

  it('ordered list items support inline parsing (**bold**)', () => {
    const html = parse('# **bold item**');
    expect(html).toMatch(/<strong>bold item<\/strong>/);
  });

  it('digit-dot syntax (1. item) is NOT an ordered list', () => {
    const toks = tokenize('1. item');
    expect(toks[0].type).not.toBe('ol');
  });

  it('odd-indent ol (3 spaces) → falls back to text, not list', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const html = parse('   # odd indent');
      expect(html).not.toMatch(/<ol>/);
      expect(html).not.toMatch(/<li>/);
    } finally {
      jest.restoreAllMocks();
    }
  });

  it('odd-indent ul (1 space) → falls back to text, not list', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const html = parse(' - odd indent');
      expect(html).not.toMatch(/<ul>/);
      expect(html).not.toMatch(/<li>/);
    } finally {
      jest.restoreAllMocks();
    }
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

  it('mixed list (ul then ol, no blank line) → still two separate list blocks (type splits)', () => {
    const src = '- Alpha\n- Beta\n# First\n# Second';
    const html = parse(src);
    // The type change causes a split; both tags must be present but in separate blocks
    expect(html).toMatch(/<ul>/);
    expect(html).toMatch(/<ol>/);
    expect(html).toMatch(/<\/ul>[\s\S]*<ol>/);
    expect(html).toMatch(/<li>Alpha<\/li>/);
    expect(html).toMatch(/<li>First<\/li>/);
  });

  it('ol parent with ul nested children → <ol><li>…<ul>…</ul></li></ol>', () => {
    const src = '# Step 1\n  - Note A\n  - Note B\n# Step 2';
    const html = parse(src);
    expect(html).toMatch(/<ol>/);
    expect(html).toMatch(/<li>Step 1[\s\S]*<ul>[\s\S]*<li>Note A<\/li>/);
    expect(html).toMatch(/<li>Step 2<\/li>/);
  });

  it('mixed nested children (ul parent, ol+ul children) → correct nesting', () => {
    const src = '- Parent\n  # Child OL\n  - Child UL';
    const html = parse(src);
    expect(html).toMatch(/<ul>/);
    expect(html).toMatch(/<li>Parent[\s\S]*<ol>[\s\S]*<li>Child OL<\/li>/);
    expect(html).toMatch(/<li>Parent[\s\S]*<ul>[\s\S]*<li>Child UL<\/li>/);
  });

  it('@[class: steps] after a ul-with-ol-children list adds class to outer <ul>', () => {
    const html = parse('- Parent\n  # Child OL\n@[class: steps]');
    expect(html).toMatch(/<ul class="steps">/);
    expect(html).toMatch(/<ol>/);
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

  it('Link: [label](https://url) → <a href="…">label</a>', () => {
    const html = parse('[Visit Example](https://example.com)');
    expect(html).toMatch(/<a href="https:\/\/example\.com"/);
    expect(html).toMatch(/Visit Example/);
    expect(html).toMatch(/rel="noopener noreferrer"/);
    expect(html).toMatch(/target="_blank"/);
  });

  it('Link: label text may contain spaces', () => {
    // Label is everything between [ and ]; URL is inside the parens.
    const html = parse('[label text](https://example.com/path)');
    expect(html).toMatch(/href="https:\/\/example\.com\/path"/);
    expect(html).toMatch(/>label text</);
  });

  it('Link: http:// is rejected (https only)', () => {
    const html = parse('[label](http://example.com)');
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

  it('ObsidianAnchor: [[#heading-id]] resolves to an in-page link when heading exists', () => {
    // ObsidianAnchor is an inline construct; it must appear inside paragraph text,
    // not as a standalone line (which would be tokenised as anchor_block instead).
    const src = ':: My Section\n\nSee [[#My Section]] for details.';
    const html = parse(src);
    expect(html).toMatch(/<a href="#my-section" class="obsidian-anchor"/);
  });

  it('ObsidianAnchor: [[#unknown]] emits [W601] and renders plain text', () => {
    // ObsidianAnchor is inline-only; use it inside paragraph text so it is not
    // tokenised as a standalone anchor_block.
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const html = parse('Read [[#nonexistent]] for more.');
      expect(warnSpy.mock.calls.some(a => a.join(' ').includes('[W601]'))).toBe(true);
      expect(html).not.toMatch(/<a /);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('ObsidianLink: [[path]] → <a href="path" class="obsidian-link">path</a>', () => {
    const html = parse('See [[other-page]] here.');
    expect(html).toMatch(/<a href="other-page" class="obsidian-link">other-page<\/a>/);
  });

  it('ObsidianLink: [[path|display text]] → <a href="path">display text</a>', () => {
    const html = parse('See [[other-page|display text]] here.');
    expect(html).toMatch(/<a href="other-page" class="obsidian-link">display text<\/a>/);
  });

  it('ObsidianLink: leading/trailing whitespace in display text is trimmed', () => {
    const html = parse('See [[path| display text ]] here.');
    expect(html).toMatch(/<a href="path" class="obsidian-link">display text<\/a>/);
  });

  it('ObsidianLink: path with Japanese characters is supported', () => {
    const html = parse('[[相対パス|表示テキスト]]');
    expect(html).toMatch(/class="obsidian-link"/);
    expect(html).toMatch(/相対パス/);
    expect(html).toMatch(/表示テキスト/);
  });

  it('ObsidianLink: path and display text with HTML chars are escaped', () => {
    const html = parse('[[<evil>|<b>click</b>]]');
    expect(html).not.toMatch(/<evil>/);
    expect(html).not.toMatch(/<b>/);
    expect(html).toMatch(/&lt;evil&gt;/);
    expect(html).toMatch(/&lt;b&gt;/);
  });

  it('ObsidianLink does NOT match [[#ID]] (ObsidianAnchor takes precedence)', () => {
    // [[#heading]] must still be handled by ObsidianAnchor, not ObsidianLink.
    const src = ':: Section\n\nSee [[#Section]] here.';
    const html = parse(src);
    expect(html).toMatch(/class="obsidian-anchor"/);
    expect(html).not.toMatch(/class="obsidian-link"/);
  });

  it('ObsidianLink: [[path#heading]] renders as href="path#heading"', () => {
    const html = parse('See [[other-page#Introduction]] here.');
    expect(html).toMatch(/<a href="other-page#Introduction" class="obsidian-link">other-page#Introduction<\/a>/);
  });

  it('ObsidianLink: [[path#heading|display]] renders display text with href="path#heading"', () => {
    const html = parse('See [[other-page#Introduction|Introduction]] here.');
    expect(html).toMatch(/<a href="other-page#Introduction" class="obsidian-link">Introduction<\/a>/);
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

  // ── evaluation order (Code > Link > Footnote > ObsidianAnchor > ObsidianLink > Strong > Emphasis > Delete > Insert) ──

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

  it('@[class: lead] after a paragraph adds class to <p>', () => {
    const html = parse(': Hello world\n@[class: lead]');
    expect(html).toMatch(/<p class="lead">/);
  });

  it('@[id: intro] after a paragraph sets id on <p>', () => {
    const html = parse(': Intro text\n@[id: intro]');
    expect(html).toMatch(/<p id="intro">/);
  });

  it('@[x-role: note] after a paragraph adds data-role on <p>', () => {
    const html = parse(': A note\n@[x-role: note]');
    expect(html).toMatch(/data-role="note"/);
  });

  it('plain paragraph (no `: ` prefix) does NOT accept modifiers', () => {
    // @[class: lead] after a plain paragraph must NOT be applied
    const html = parse('Hello world\n@[class: lead]');
    expect(html).not.toMatch(/<p class="lead">/);
  });

  it('multi-line plain paragraph joins lines with <br>', () => {
    const html = parse('line one\nline two\nline three');
    expect(html).toMatch(/<p>line one<br>\nline two<br>\nline three<\/p>/);
  });

  it('multi-line `: ` paragraph joins lines with <br>', () => {
    const html = parse(': line one\n: line two\n: line three');
    expect(html).toMatch(/<p>line one<br>\nline two<br>\nline three<\/p>/);
  });

  it('multi-line `: ` paragraph with modifier applies modifier to single <p>', () => {
    const html = parse(': line one\n: line two\n@[class: lead]');
    expect(html).toMatch(/<p class="lead">line one<br>\nline two<\/p>/);
  });

  it('@[class: items] after an unordered list adds class to <ul>', () => {
    const html = parse('- item one\n- item two\n@[class: items]');
    expect(html).toMatch(/<ul class="items">/);
  });

  it('@[class: steps] after an ordered list adds class to <ol>', () => {
    const html = parse('# step one\n# step two\n@[class: steps]');
    expect(html).toMatch(/<ol class="steps">/);
  });

  it('@[class: callout] after an inline blockquote adds class to <blockquote>', () => {
    const html = parse('> A quote\n@[class: callout]');
    expect(html).toMatch(/<blockquote class="callout">/);
  });

  it('@[class: callout] after a block blockquote adds class to <blockquote>', () => {
    const html = parse('|>\nA quoted paragraph\n<|\n@[class: callout]');
    expect(html).toMatch(/<blockquote class="callout">/);
  });

  it('@[class: equation] after a math block adds class to the math wrapper', () => {
    const html = parse('$$\nx = 1\n$$\n@[class: equation]');
    expect(html).toMatch(/<pre class="math-block equation"><code>x = 1<\/code><\/pre>/);
  });

  it('@[class: glossary] after a definition block adds class to <dl>', () => {
    const html = parse(':= Term\nBody text\n@[class: glossary]');
    expect(html).toMatch(/<dl[^>]*class="[^"]*glossary[^"]*">/);
  });

  it('@[class: highlight] after a code block adds class to <figure>', () => {
    const html = parse('#!bash\necho hi\n!#\n@[class: highlight]');
    expect(html).toMatch(/<figure[^>]*class="[^"]*highlight[^"]*">/);
  });

  it('unknown MetaKey emits [E202] and falls back to literal text', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const html = parse('@[badkey: value]');
      expect(warnSpy.mock.calls.some(a => a.join(' ').includes('[E202]'))).toBe(true);
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
  // Suppress console.warn output in this section; the structured diagnostics
  // array is the primary API under test.
  beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it('[E201] is emitted for an invalid front matter key', () => {
    // A key that matches the FrontKey regex pattern [a-z][a-z0-9-]* but is not
    // in the spec-defined allowed list triggers [E201].
    parse('@@\nbadkey: value\n@@');
    expect(getDiagnostics().some(d => d.code === 'E201')).toBe(true);
  });

  it('[E201] diagnostic carries the invalid key in its message', () => {
    parse('@@\nbadkey: value\n@@');
    expect(getDiagnostics().find(d => d.code === 'E201')?.message).toMatch(/badkey/);
  });

  it('[E202] is emitted for an unknown MetaKey', () => {
    parse('@[unknownkey: v]');
    expect(getDiagnostics().some(d => d.code === 'E202')).toBe(true);
  });

  it('[E202] diagnostic carries the unknown key in its message', () => {
    parse('@[unknownkey: v]');
    expect(getDiagnostics().find(d => d.code === 'E202')?.message).toMatch(/unknownkey/);
  });

  it('[W601] is emitted for an unresolved anchor reference', () => {
    // ObsidianAnchor is inline-only; use it inside paragraph text.
    parse('See [[#ghost-anchor]] for details.');
    expect(getDiagnostics().some(d => d.code === 'W601')).toBe(true);
  });

  it('[W601] diagnostic carries the anchor id in its message', () => {
    parse('See [[#ghost-anchor]] for details.');
    expect(getDiagnostics().find(d => d.code === 'W601')?.message).toMatch(/ghost-anchor/);
  });

  it('[W201] is emitted for a malformed front matter line', () => {
    parse('@@\nmalformed line without colon\n@@');
    expect(getDiagnostics().some(d => d.code === 'W201')).toBe(true);
  });

  it('[W201] diagnostic carries the malformed line in its message', () => {
    parse('@@\nmalformed line without colon\n@@');
    expect(getDiagnostics().find(d => d.code === 'W201')?.message).toMatch(/malformed line without colon/);
  });

  it('getDiagnostics() is reset on each parse call', () => {
    parse('@@\nbadkey: v\n@@');
    expect(getDiagnostics().some(d => d.code === 'E201')).toBe(true);
    // Clean parse — previous diagnostics must not bleed through
    parse(':: Clean heading');
    expect(getDiagnostics()).toHaveLength(0);
  });

  it('[E201] error does not crash the parser (fall back safely)', () => {
    expect(() => parse('@@\nbadkey: v\n@@')).not.toThrow();
  });

  it('[W601] warning does not stop rendering', () => {
    const html = parse(':: Section\n\n[#ghost]');
    // The heading must still be rendered
    expect(html).toMatch(/<h2/);
  });

  it('[E401] is emitted for an odd-length list indent (ol)', () => {
    parse('   # three-space indent');
    expect(getDiagnostics().some(d => d.code === 'E401')).toBe(true);
  });

  it('[E401] is emitted for an odd-length list indent (ul)', () => {
    parse(' - one-space indent');
    expect(getDiagnostics().some(d => d.code === 'E401')).toBe(true);
  });

  it('[E401] error does not crash the parser (falls back to text)', () => {
    expect(() => parse('     # five-space indent')).not.toThrow();
  });

  // ── E402: heading level out of range ─────────────────────────────────────

  it('[E402] is emitted for a heading with 7 colons', () => {
    parse(':::::::: Heading Seven');
    expect(getDiagnostics().some(d => d.code === 'E402')).toBe(true);
  });

  it('[E402] is emitted for a numbered heading with 7 colons', () => {
    parse(':::::::# Numbered Heading Seven');
    expect(getDiagnostics().some(d => d.code === 'E402')).toBe(true);
  });

  it('[E402] diagnostic message mentions the colon count and the h6 maximum', () => {
    parse(':::::::: Too Deep');
    const msg = getDiagnostics().find(d => d.code === 'E402')?.message || '';
    expect(msg).toMatch(/6/);
  });

  it('[E402] falls back to plain text (does not emit a heading element)', () => {
    const html = parse(':::::::: Too Deep');
    expect(html).not.toMatch(/<h[0-9]/);
    expect(html).toMatch(/Too Deep/);
  });

  it('exactly 6 colons (h6) does NOT emit [E402]', () => {
    parse(':::::: Valid h6');
    expect(getDiagnostics().some(d => d.code === 'E402')).toBe(false);
  });

  // ── E403: definition block with no body ──────────────────────────────────

  it('[E403] is emitted for a definition block with no body', () => {
    parse(':= TermOnly');
    expect(getDiagnostics().some(d => d.code === 'E403')).toBe(true);
  });

  it('[E403] is emitted for casual DL term with no = description line', () => {
    parse('? TermOnly');
    expect(getDiagnostics().some(d => d.code === 'E403')).toBe(true);
  });

  it('[E403] diagnostic carries the term name in its message', () => {
    parse(':= TermOnly');
    expect(getDiagnostics().find(d => d.code === 'E403')?.message).toMatch(/TermOnly/);
  });

  it('[E403] does not crash the parser (falls back safely)', () => {
    expect(() => parse(':= TermOnly')).not.toThrow();
  });

  it('[E403] renders the term even when body is absent', () => {
    const html = parse(':= TermOnly');
    expect(html).toMatch(/TermOnly/);
  });

  it('definition block WITH body does NOT emit [E403]', () => {
    parse(':= MyTerm\nThe body text.');
    expect(getDiagnostics().some(d => d.code === 'E403')).toBe(false);
  });

  // ── W202: unterminated front matter ──────────────────────────────────────

  it('[W202] is emitted when front matter has no closing @@', () => {
    parse('@@\ntitle: No Close');
    expect(getDiagnostics().some(d => d.code === 'W202')).toBe(true);
  });

  it('[W202] diagnostic message mentions the closing delimiter @@', () => {
    parse('@@\ntitle: No Close');
    const msg = getDiagnostics().find(d => d.code === 'W202')?.message || '';
    expect(msg).toMatch(/@@/);
  });

  it('[W202] does not crash the parser', () => {
    expect(() => parse('@@\ntitle: No Close')).not.toThrow();
  });

  it('properly closed front matter does NOT emit [W202]', () => {
    parse('@@\ntitle: OK\n@@');
    expect(getDiagnostics().some(d => d.code === 'W202')).toBe(false);
  });

  // ── W001: unterminated code block ─────────────────────────────────────────

  it('[W001] is emitted when a code block has no closing !#', () => {
    parse('#!bash\necho hi');
    expect(getDiagnostics().some(d => d.code === 'W001')).toBe(true);
  });

  it('[W001] diagnostic message mentions the closing delimiter !#', () => {
    parse('#!bash\necho hi');
    const msg = getDiagnostics().find(d => d.code === 'W001')?.message || '';
    expect(msg).toMatch(/!#/);
  });

  it('[W001] does not crash the parser', () => {
    expect(() => parse('#!bash\necho hi')).not.toThrow();
  });

  it('properly closed code block does NOT emit [W001]', () => {
    parse('#!bash\necho hi\n!#');
    expect(getDiagnostics().some(d => d.code === 'W001')).toBe(false);
  });

  // ── W002: unterminated quote block ────────────────────────────────────────

  it('[W002] is emitted when a block quote has no closing <|', () => {
    parse('|>\nSome quoted text');
    expect(getDiagnostics().some(d => d.code === 'W002')).toBe(true);
  });

  it('[W002] diagnostic message mentions the closing delimiter <|', () => {
    parse('|>\nSome quoted text');
    const msg = getDiagnostics().find(d => d.code === 'W002')?.message || '';
    expect(msg).toMatch(/<\|/);
  });

  it('[W002] does not crash the parser', () => {
    expect(() => parse('|>\nSome quoted text')).not.toThrow();
  });

  it('properly closed quote block does NOT emit [W002]', () => {
    parse('|>\nSome text.\n<|');
    expect(getDiagnostics().some(d => d.code === 'W002')).toBe(false);
  });

  // ── W003: unterminated math block ─────────────────────────────────────────

  it('[W003] is emitted when a math block has no closing $$', () => {
    parse('$$\nx = 1');
    expect(getDiagnostics().some(d => d.code === 'W003')).toBe(true);
  });

  it('[W003] diagnostic message mentions the closing delimiter $$', () => {
    parse('$$\nx = 1');
    const msg = getDiagnostics().find(d => d.code === 'W003')?.message || '';
    expect(msg).toMatch(/\$\$/);
  });

  it('[W003] does not crash the parser', () => {
    expect(() => parse('$$\nx = 1')).not.toThrow();
  });

  it('properly closed math block does NOT emit [W003]', () => {
    parse('$$\nx = 1\n$$');
    expect(getDiagnostics().some(d => d.code === 'W003')).toBe(false);
  });

  // ── W401: duplicate definition term ──────────────────────────────────────

  it('[W401] is emitted when a definition term is defined more than once', () => {
    parse(':= MyTerm\nFirst body.\n\n:= MyTerm\nSecond body.');
    expect(getDiagnostics().some(d => d.code === 'W401')).toBe(true);
  });

  it('[W401] diagnostic carries the duplicate term in its message', () => {
    parse(':= MyTerm\nFirst body.\n\n:= MyTerm\nSecond body.');
    expect(getDiagnostics().find(d => d.code === 'W401')?.message).toMatch(/MyTerm/);
  });

  it('[W401] is case-insensitive (same term in different cases is a duplicate)', () => {
    parse(':= myterm\nFirst.\n\n:= MYTERM\nSecond.');
    expect(getDiagnostics().some(d => d.code === 'W401')).toBe(true);
  });

  it('[W401] does not crash the parser (both definitions still render)', () => {
    expect(() => parse(':= Alpha\nBody one.\n\n:= Alpha\nBody two.')).not.toThrow();
    const html = parse(':= Alpha\nBody one.\n\n:= Alpha\nBody two.');
    expect(html).toMatch(/Alpha/);
  });

  it('two distinct definition terms do NOT emit [W401]', () => {
    parse(':= TermA\nBody A.\n\n:= TermB\nBody B.');
    expect(getDiagnostics().some(d => d.code === 'W401')).toBe(false);
  });

  it('[W401] is reset between parse() calls (second parse is independent)', () => {
    parse(':= Alpha\nBody.\n\n:= Alpha\nBody again.');
    parse(':= Alpha\nFresh body.');
    // Second parse is a clean document — only one definition, no duplicate
    expect(getDiagnostics().some(d => d.code === 'W401')).toBe(false);
  });

  // ── W801: orphaned modifier ───────────────────────────────────────────────

  it('[W801] is emitted for a modifier following a plain text paragraph', () => {
    // Plain paragraphs do not accept modifiers; the @[...] is not consumed.
    parse('Plain text line.\n@[class: lead]');
    expect(getDiagnostics().some(d => d.code === 'W801')).toBe(true);
  });

  it('[W801] is emitted for a modifier after a blank line (metadata crosses blank lines)', () => {
    // Modifiers must immediately follow their block with no intervening blank lines.
    parse(':: Heading\n\n@[class: highlight]');
    expect(getDiagnostics().some(d => d.code === 'W801')).toBe(true);
  });

  it('[W801] is emitted for a modifier after a horizontal rule (--- accepts no modifiers)', () => {
    parse('---\n@[class: decorative]');
    expect(getDiagnostics().some(d => d.code === 'W801')).toBe(true);
  });

  it('[W801] diagnostic message carries the modifier key and value', () => {
    parse('Plain text.\n@[class: my-class]');
    const msg = getDiagnostics().find(d => d.code === 'W801')?.message || '';
    expect(msg).toMatch(/class/);
    expect(msg).toMatch(/my-class/);
  });

  it('[W801] does not crash the parser', () => {
    expect(() => parse('Plain.\n@[id: orphan]')).not.toThrow();
  });

  it('a modifier immediately after a heading (no blank line) does NOT emit [W801]', () => {
    parse(':: My Heading\n@[class: highlight]');
    expect(getDiagnostics().some(d => d.code === 'W801')).toBe(false);
  });

  it('a modifier immediately after a `: ` para block does NOT emit [W801]', () => {
    parse(': Explicit para\n@[class: lead]');
    expect(getDiagnostics().some(d => d.code === 'W801')).toBe(false);
  });

  it('every diagnostic emits console.warn with [CODE] prefix format', () => {
    // All diagnostic codes must log [CODE] so users see the code in browser console.
    // Also verifies the code appears in getDiagnostics() so both channels are covered.
    const codes = [
      { src: '@@\nbadkey: v\n@@',          code: 'E201' },
      { src: '@[badmetakey: v]',            code: 'E202' },
      { src: 'See [[#ghost]] for details.',  code: 'W601' },
      { src: '@@\nno colon here\n@@',       code: 'W201' },
      { src: ' - odd-indent item',          code: 'E401' },
      { src: ':::::::: Too Deep',            code: 'E402' },
      { src: ':= TermOnly',                  code: 'E403' },
      { src: '@@\ntitle: Unterminated',      code: 'W202' },
      { src: '#!bash\nno close',             code: 'W001' },
      { src: '|>\nno close',                 code: 'W002' },
      { src: '$$\nno close',                 code: 'W003' },
      { src: ':= T\nB.\n\n:= T\nB2.',       code: 'W401' },
      { src: 'Plain.\n@[class: orphan]',     code: 'W801' },
      { src: '![[img.png]]\n@[alt: desc]',   code: 'W802' },
    ];
    for (const { src, code } of codes) {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        parse(src);
        const logged = warnSpy.mock.calls.some(call => call[0]?.startsWith(`[${code}]`));
        expect(logged).toBe(true);
        expect(getDiagnostics().some(d => d.code === code)).toBe(true);
      } finally {
        warnSpy.mockRestore();
      }
    }
  });

  it('[E202] diagnostic message lists the allowed MetaKeys', () => {
    // The message must tell users which keys ARE valid so they can fix the input.
    parse('@[badmetakey: v]');
    const msg = getDiagnostics().find(d => d.code === 'E202')?.message || '';
    // At least one well-known allowed key (e.g. 'class') should appear in the message.
    expect(msg).toMatch(/class/);
  });

  it('[E401] diagnostic message mentions "multiple" or "two" to guide the user', () => {
    parse(' - odd-indent item');
    const msg = getDiagnostics().find(d => d.code === 'E401')?.message || '';
    expect(msg).toMatch(/two|multiple/i);
  });

  it('[W802] diagnostic message mentions pipe syntax ![[path|alt]]', () => {
    parse('![[img.png]]\n@[alt: desc]');
    const msg = getDiagnostics().find(d => d.code === 'W802')?.message || '';
    expect(msg).toMatch(/\!\[\[.*\|/);
  });

  it('every diagnostic object has both a string code and a string message', () => {
    // Consumers of getDiagnostics() rely on both fields being non-empty strings.
    const cases = [
      '@@\nbadkey: v\n@@',
      '@[badmetakey: v]',
      'See [[#ghost]] for details.',
      '@@\nno colon here\n@@',
      ' - odd-indent',
      ':::::::: Too Deep',
      ':= TermOnly',
      '@@\ntitle: Unterminated',
      '#!bash\nno close',
      '|>\nno close',
      '$$\nno close',
      ':= T\nB.\n\n:= T\nB2.',
      'Plain.\n@[class: orphan]',
      '![[img.png]]\n@[alt: desc]',
    ];
    for (const src of cases) {
      parse(src);
      for (const d of getDiagnostics()) {
        expect(typeof d.code).toBe('string');
        expect(d.code.length).toBeGreaterThan(0);
        expect(typeof d.message).toBe('string');
        expect(d.message.length).toBeGreaterThan(0);
      }
    }
  });

  it('multiple diagnostics in one parse all appear in getDiagnostics()', () => {
    // A document with both an invalid front matter key AND an unresolved anchor ref
    // must accumulate both diagnostics in a single parse call.
    parse('@@\nbadkey: v\n@@\n\nSee [[#ghost]] for details.');
    const codes = getDiagnostics().map(d => d.code);
    expect(codes).toContain('E201');
    expect(codes).toContain('W601');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §SecureFallback
// ─────────────────────────────────────────────────────────────────────────────

describe('§SecureFallback', () => {
  // In this section every test verifies two things simultaneously:
  //   1. The parser does NOT crash on bad input.
  //   2. The correct output is still produced for the non-erroneous parts.

  beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  // ── [E201] invalid front matter key ─────────────────────────────────────

  it('[E201] valid front matter entries still render when an invalid key is present', () => {
    const html = parse('@@\ntitle: My Post\nbadkey: ignored\nauthor: Alice\n@@');
    // Valid entries must appear; the bad key must be silently dropped.
    expect(html).toMatch(/<dt>title<\/dt><dd>My Post<\/dd>/);
    expect(html).toMatch(/<dt>author<\/dt><dd>Alice<\/dd>/);
    expect(html).not.toMatch(/<dt>badkey<\/dt>/);
  });

  it('[E201] content after the front matter block still renders', () => {
    const html = parse('@@\nbadkey: v\n@@\n\n:: My Heading');
    expect(html).toMatch(/<h2 /);
    expect(html).toMatch(/My Heading/);
  });

  // ── [E202] unknown MetaKey ───────────────────────────────────────────────

  it('[E202] surrounding content still renders when an unknown MetaKey appears', () => {
    const html = parse(':: Before\n@[badmetakey: v]\n:: After');
    expect(html).toMatch(/Before/);
    expect(html).toMatch(/After/);
  });

  it('[E202] unknown MetaKey modifier falls back to literal text (not injected as attribute)', () => {
    const html = parse('@[badmetakey: value]');
    // Must not appear as an attribute in any tag
    expect(html).not.toMatch(/badmetakey="value"/);
    expect(html).not.toMatch(/data-badmetakey/);
    // The literal text should be present in the output as escaped content
    expect(html).toMatch(/badmetakey/);
  });

  it('[E202] modifier value with HTML chars is escaped in the fallback text', () => {
    const html = parse('@[badmetakey: <script>xss</script>]');
    expect(html).not.toMatch(/<script>/i);
    expect(html).toMatch(/&lt;script&gt;/);
  });

  // ── [W601] unresolved anchor reference ──────────────────────────────────

  it('[W601] surrounding paragraph content still renders after an unresolved anchor ref', () => {
    const html = parse('Before [[#ghost]] after.');
    expect(html).toMatch(/Before/);
    expect(html).toMatch(/after\./);
  });

  it('[W601] unresolved anchor renders the inner text as plain escaped text (not a link)', () => {
    const html = parse('Read [[#nowhere]] here.');
    expect(html).not.toMatch(/<a /);
    // Inner text "nowhere" must still appear verbatim
    expect(html).toMatch(/nowhere/);
  });

  it('[W601] unresolved anchor with HTML chars in the id is escaped in fallback text', () => {
    // The inner text of [[#<evil>]] must be escaped, never injected as markup.
    const html = parse('Text [[#<evil>]] text.');
    expect(html).not.toMatch(/<evil>/);
    expect(html).toMatch(/&lt;evil&gt;/);
  });

  // ── [W201] malformed front matter line ──────────────────────────────────

  it('[W201] valid front matter entries still render despite a malformed line', () => {
    const html = parse('@@\ntitle: Good Title\nthis line has no colon\nauthor: Bob\n@@');
    expect(html).toMatch(/<dt>title<\/dt><dd>Good Title<\/dd>/);
    expect(html).toMatch(/<dt>author<\/dt><dd>Bob<\/dd>/);
  });

  it('[W201] content after the front matter block still renders despite malformed line', () => {
    const html = parse('@@\nmalformed\n@@\n\n:: Heading Still Renders');
    expect(html).toMatch(/<h2 /);
    expect(html).toMatch(/Heading Still Renders/);
  });

  // ── [E401] invalid list indentation ─────────────────────────────────────

  it('[E401] bad-indent ordered list item content is still visible as plain text', () => {
    const html = parse('   # three-space item');
    // Content must appear; just not inside an <ol>/<li>
    expect(html).toMatch(/three-space item/);
    expect(html).not.toMatch(/<ol>/);
  });

  it('[E401] bad-indent unordered list item content is still visible as plain text', () => {
    const html = parse(' - one-space item');
    expect(html).toMatch(/one-space item/);
    expect(html).not.toMatch(/<ul>/);
  });

  it('[E401] valid list items before and after bad-indent item still render', () => {
    const html = parse('# good item\n   # bad indent\n# another good');
    expect(html).toMatch(/<ol>/);
    expect(html).toMatch(/good item/);
    expect(html).toMatch(/another good/);
  });

  // ── Unterminated block constructs ────────────────────────────────────────

  it('unterminated shebang block (no !#) does not crash and produces code output', () => {
    let html;
    expect(() => { html = parse('#!bash\necho hi'); }).not.toThrow();
    expect(html).toMatch(/echo hi/);
  });

  it('unterminated front matter block (no closing @@) does not crash', () => {
    expect(() => parse('@@\ntitle: Unterminated')).not.toThrow();
  });

  it('unterminated math block (no closing $$) does not crash', () => {
    expect(() => parse('$$\nx = 1')).not.toThrow();
  });

  it('unterminated block quote (no closing <|) does not crash', () => {
    expect(() => parse('|>\nSome quoted text')).not.toThrow();
  });

  it('document with multiple error types still renders all safe blocks', () => {
    // E201 (bad fm key) + W201 (malformed fm line) + W601 (unresolved anchor ref) + E401 (odd indent)
    const src = [
      '@@',
      'badkey: v',
      'no colon here',
      'title: OK',
      '@@',
      '',
      ':: Safe Heading',
      '',
      ' - odd-indent item',
      '',
      'See [[#ghost]] for details.',
    ].join('\n');
    expect(() => parse(src)).not.toThrow();
    const html = parse(src);
    // The heading and the front matter title must appear
    expect(html).toMatch(/<h2 /);
    expect(html).toMatch(/Safe Heading/);
    expect(html).toMatch(/OK/);
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
    const html = parse('[click me](javascript:alert(1))');
    expect(html).not.toMatch(/href="javascript:/);
  });

  it('inline link with non-https scheme is not linked', () => {
    const html = parse('[label](ftp://example.com)');
    expect(html).not.toMatch(/href="ftp:\/\//);
  });

  it('auto-linked URL href attribute value is HTML-escaped (& → &amp;)', () => {
    // Auto-linked URL query strings containing & must be escaped to &amp; in href attributes.
    const html = parse('https://example.com/path?a=1&b=2');
    expect(html).toMatch(/href="https:\/\/example\.com\/path\?a=1&amp;b=2"/);
  });

  // ── HTML escaping in every output context ─────────────────────────────────

  it('front matter value with <script> is escaped in output', () => {
    const html = parse('@@\ntitle: <script>alert(1)</script>\n@@');
    expect(html).not.toMatch(/<script>/i);
    expect(html).toMatch(/&lt;script&gt;/);
  });

  it('front matter key is HTML-escaped in output', () => {
    // x-* extension keys go through esc() when rendered
    const html = parse('@@\nx-desc: a & b\n@@');
    expect(html).toMatch(/a &amp; b/);
  });

  it('inline link label with HTML chars is escaped', () => {
    const html = parse('[<b>click</b>](https://example.com)');
    expect(html).not.toMatch(/<b>/);
    expect(html).toMatch(/&lt;b&gt;/);
  });

  it('list item text with <script> is escaped', () => {
    const html = parse('- <script>xss</script>');
    expect(html).not.toMatch(/<script>/i);
    expect(html).toMatch(/&lt;script&gt;/);
  });

  it('ordered list item text with HTML is escaped', () => {
    const html = parse('# <b>bold</b>');
    expect(html).not.toMatch(/<b>/);
    expect(html).toMatch(/&lt;b&gt;/);
  });

  it('inline blockquote content with <script> is escaped', () => {
    const html = parse('> <script>xss</script>');
    expect(html).not.toMatch(/<script>/i);
    expect(html).toMatch(/&lt;script&gt;/);
  });

  it('block blockquote content with <script> is escaped', () => {
    const html = parse('|>\n<script>xss</script>\n<|');
    expect(html).not.toMatch(/<script>/i);
    expect(html).toMatch(/&lt;script&gt;/);
  });

  it('definition term with HTML is escaped', () => {
    const html = parse(':= <script>xss</script>\nBody text.');
    expect(html).not.toMatch(/<script>/i);
    expect(html).toMatch(/&lt;script&gt;/);
  });

  it('definition body with HTML is escaped', () => {
    const html = parse(':= Term\n<script>xss</script>');
    expect(html).not.toMatch(/<script>/i);
    expect(html).toMatch(/&lt;script&gt;/);
  });

  it('math block content with < and > is escaped', () => {
    const html = parse('$$\nx < y > z\n$$');
    expect(html).not.toMatch(/<y>/);
    expect(html).toMatch(/x &lt; y &gt; z/);
  });

  it('code block content with <script> is escaped', () => {
    const html = parse('#!text\n<script>alert(1)</script>\n!#');
    expect(html).not.toMatch(/<script>/i);
    expect(html).toMatch(/&lt;script&gt;/);
  });

  it('anchor block label with HTML chars is escaped', () => {
    const html = parse('[#<evil> section]');
    // The label text must be escaped in the span output
    expect(html).not.toMatch(/<evil>/);
    expect(html).toMatch(/&lt;evil&gt;/);
  });

  it('footnote text with HTML chars is escaped', () => {
    const html = parse('See[^<script>xss</script>] this.');
    expect(html).not.toMatch(/<script>/i);
  });

  it('http:// standalone line is rendered as plain escaped text (not an auto-link)', () => {
    const html = parse('http://insecure.example.com/path');
    // Must not produce an <a> element
    expect(html).not.toMatch(/<a /);
    // Content must still appear in the output
    expect(html).toMatch(/http:\/\/insecure\.example\.com\/path/);
  });

  it('URL with " in it is escaped in href attribute to prevent attribute injection', () => {
    // esc() must prevent attribute boundary breakout in href.
    // The " is escaped to &quot; so no real attribute injection occurs.
    const url = 'https://example.com/path?x=1"onmouseover="alert(1)';
    const html = parse(url);
    // Must not contain a literal unescaped " that would break out of the href attribute.
    expect(html).not.toMatch(/href="[^"]*"onmouseover/);
    // The " must be escaped to &quot;
    expect(html).toMatch(/&quot;/);
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

  it('---- → hr token', () => {
    const toks = tokenize('----');
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

  it('# item → ol token', () => {
    const toks = tokenize('# item text');
    expect(toks[0].type).toBe('ol');
    expect(toks[0].text).toBe('item text');
    expect(toks[0].indent).toBe(0);
  });

  it('  # item → ol token with indent 2', () => {
    const toks = tokenize('  # indented item');
    expect(toks[0].type).toBe('ol');
    expect(toks[0].indent).toBe(2);
  });

  it('   # item (3-space indent) → text token with [E401]', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const toks = tokenize('   # three-space indent');
      expect(toks[0].type).toBe('text');
      expect(warnSpy.mock.calls.some(a => /\[E401\]/.test(a.join(' ')))).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it(' - item (1-space indent) → text token with [E401]', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const toks = tokenize(' - one-space indent');
      expect(toks[0].type).toBe('text');
      expect(warnSpy.mock.calls.some(a => /\[E401\]/.test(a.join(' ')))).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
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

  it('? term / = dd lines → dl_dt / dl_dd tokens', () => {
    const toks = tokenize('? My Term\n= My Definition');
    expect(toks[0].type).toBe('dl_dt');
    expect(toks[1].type).toBe('dl_dd');
  });

  it('indented ? term is not a dl_dt token (top-level only)', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const toks = tokenize('  ? Nested Term');
      expect(toks[0].type).toBe('text');
    } finally {
      jest.restoreAllMocks();
    }
  });

  it('indented := term is not a def_term token (top-level only)', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const toks = tokenize('  := Nested Term');
      expect(toks[0].type).toBe('text');
    } finally {
      jest.restoreAllMocks();
    }
  });
});
