"""
spec/test_Blogable2md.py
Unit tests for Blogable2md.py

Run with:
  python -m unittest discover -s spec -p 'test_*.py' -v
  # or (if pytest is installed)
  pytest spec/test_Blogable2md.py -v
"""

import sys
import os
import unittest
import textwrap
import subprocess
import tempfile

# Make sure the root of the repo is on sys.path so we can import the module.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from Blogable2md import (
    slugify,
    is_image_url,
    detect_lang,
    convert_inline,
    convert_front_matter,
    convert,
    extract_slug,
)


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def dedent(text):
    """Strip leading newline + common indentation added by triple-quoted strings."""
    return textwrap.dedent(text).lstrip('\n')


# ---------------------------------------------------------------------------
# slugify
# ---------------------------------------------------------------------------

class TestSlugify(unittest.TestCase):

    def test_simple(self):
        self.assertEqual(slugify('Hello World'), 'hello-world')

    def test_extra_spaces(self):
        self.assertEqual(slugify('  foo   bar  '), 'foo-bar')

    def test_special_chars_stripped(self):
        self.assertEqual(slugify('foo!@#bar'), 'foobar')

    def test_multiple_dashes_collapsed(self):
        self.assertEqual(slugify('a -- b'), 'a-b')

    def test_japanese_preserved(self):
        slug = slugify('テスト heading')
        self.assertIn('テスト', slug)

    def test_already_slug(self):
        self.assertEqual(slugify('my-slug'), 'my-slug')


# ---------------------------------------------------------------------------
# is_image_url
# ---------------------------------------------------------------------------

class TestIsImageUrl(unittest.TestCase):

    def test_png(self):
        self.assertTrue(is_image_url('https://example.com/img.png'))

    def test_jpg(self):
        self.assertTrue(is_image_url('https://example.com/photo.jpg'))

    def test_jpeg(self):
        self.assertTrue(is_image_url('https://example.com/photo.jpeg'))

    def test_gif(self):
        self.assertTrue(is_image_url('https://example.com/anim.gif'))

    def test_webp(self):
        self.assertTrue(is_image_url('https://example.com/img.webp'))

    def test_with_query_string(self):
        self.assertTrue(is_image_url('https://cdn.example.com/img.png?v=1'))

    def test_non_image(self):
        self.assertFalse(is_image_url('https://example.com/page.html'))

    def test_plain_url(self):
        self.assertFalse(is_image_url('https://example.com/'))


# ---------------------------------------------------------------------------
# detect_lang
# ---------------------------------------------------------------------------

class TestDetectLang(unittest.TestCase):

    def test_python(self):
        self.assertEqual(detect_lang('#!python'), 'python')

    def test_python3(self):
        self.assertEqual(detect_lang('#!python3'), 'python')

    def test_node(self):
        self.assertEqual(detect_lang('#!node'), 'javascript')

    def test_bash(self):
        self.assertEqual(detect_lang('#!bash'), 'bash')

    def test_sh(self):
        self.assertEqual(detect_lang('#!sh'), 'bash')

    def test_shebang_path(self):
        self.assertEqual(detect_lang('#!/usr/bin/python3'), 'python')

    def test_env_shebang(self):
        self.assertEqual(detect_lang('#!/usr/bin/env ruby'), 'ruby')

    def test_unknown_lang_passthrough(self):
        self.assertEqual(detect_lang('#!kotlin'), 'kotlin')

    def test_no_shebang(self):
        self.assertEqual(detect_lang('regular line'), '')


# ---------------------------------------------------------------------------
# convert_inline
# ---------------------------------------------------------------------------

class TestConvertInline(unittest.TestCase):

    def _ci(self, text):
        footnotes = []
        return convert_inline(text, footnotes), footnotes

    def test_plain_text(self):
        result, _ = self._ci('hello world')
        self.assertEqual(result, 'hello world')

    def test_code_span(self):
        result, _ = self._ci('use `foo()` here')
        self.assertEqual(result, 'use `foo()` here')

    def test_link(self):
        result, _ = self._ci('[https://example.com click here]')
        self.assertEqual(result, '[click here](https://example.com)')

    def test_footnote_text_only(self):
        result, fns = self._ci('see [^note]')
        self.assertEqual(result, 'see [^1]')
        self.assertEqual(fns[0]['text'], 'note')
        self.assertIsNone(fns[0]['url'])

    def test_footnote_with_url(self):
        result, fns = self._ci('[^https://example.com label]')
        self.assertEqual(result, '[^1]')
        self.assertEqual(fns[0]['url'], 'https://example.com')
        self.assertEqual(fns[0]['text'], 'label')

    def test_multiple_footnotes_numbered(self):
        footnotes = []
        text = convert_inline('[^one] and [^two]', footnotes)
        self.assertEqual(text, '[^1] and [^2]')
        self.assertEqual(len(footnotes), 2)

    def test_deprecated_anchor_ref_is_plain_text(self):
        result, _ = self._ci('[#My Section]')
        self.assertEqual(result, '[#My Section]')

    def test_strong(self):
        result, _ = self._ci('**bold text**')
        self.assertEqual(result, '**bold text**')

    def test_emphasis(self):
        result, _ = self._ci('*italic*')
        self.assertEqual(result, '*italic*')

    def test_strikethrough(self):
        result, _ = self._ci('~~del~~')
        self.assertEqual(result, '~~del~~')

    def test_insert(self):
        result, _ = self._ci('++added++')
        self.assertEqual(result, '<ins>added</ins>')

    def test_mixed_inline(self):
        result, _ = self._ci('**bold** and *em* and `code`')
        self.assertEqual(result, '**bold** and *em* and `code`')


# ---------------------------------------------------------------------------
# extract_slug
# ---------------------------------------------------------------------------

class TestExtractSlug(unittest.TestCase):

    def test_slug_present(self):
        src = '@@\ntitle: My Article\nslug: my-article\n@@\n'
        self.assertEqual(extract_slug(src), 'my-article')

    def test_slug_absent(self):
        src = '@@\ntitle: My Article\n@@\n'
        self.assertIsNone(extract_slug(src))

    def test_no_front_matter(self):
        src = 'Just some text.\n'
        self.assertIsNone(extract_slug(src))

    def test_slug_with_inline_comment(self):
        src = '@@\nslug: my-slug # ignore\n@@\n'
        self.assertEqual(extract_slug(src), 'my-slug')

    def test_slug_empty_value(self):
        src = '@@\nslug: \n@@\n'
        self.assertIsNone(extract_slug(src))


# ---------------------------------------------------------------------------
# convert_front_matter
# ---------------------------------------------------------------------------

class TestConvertFrontMatter(unittest.TestCase):

    def _fm(self, lines):
        return convert_front_matter(lines)

    # title
    def test_title(self):
        out = self._fm(['title: My Article'])
        self.assertIn('title: "My Article"', out)

    def test_empty_title(self):
        out = self._fm([])
        self.assertIn('title: ""', out)

    # topics / tags
    def test_tags_to_topics(self):
        out = self._fm(['tags: python, javascript'])
        self.assertIn('topics: ["python", "javascript"]', out)

    def test_tags_single(self):
        out = self._fm(['tags: ruby'])
        self.assertIn('topics: ["ruby"]', out)

    def test_no_tags(self):
        out = self._fm([])
        self.assertIn('topics: []', out)

    # published
    def test_published_is_always_false(self):
        """published: false is always emitted regardless of front-matter content."""
        self.assertIn('published: false', self._fm([]))
        self.assertIn('published: false', self._fm(['draft: false']))
        self.assertIn('published: false', self._fm(['draft: true']))

    # slug
    def test_slug_included(self):
        out = self._fm(['slug: my-article'])
        self.assertIn('slug: "my-article"', out)

    def test_no_slug_omitted(self):
        out = self._fm(['title: Test'])
        self.assertFalse(any(line.startswith('slug:') for line in out))

    # delimiters
    def test_starts_and_ends_with_dashes(self):
        out = self._fm([])
        self.assertEqual(out[0], '---')
        self.assertEqual(out[-1], '---')

    # inline comment stripping
    def test_inline_comment_stripped(self):
        out = self._fm(['title: My Title # ignore me'])
        self.assertIn('title: "My Title"', out)

    def test_zenn_x_type_and_x_emoji_override_defaults(self):
        out = self._fm(['x-type: idea', 'x-emoji: 💡'])
        self.assertIn('type: "idea"', out)
        self.assertIn('emoji: "💡"', out)

    def test_invalid_x_type_raises(self):
        with self.assertRaisesRegex(ValueError, 'Invalid x-type'):
            self._fm(['x-type: invalid'])

    def test_empty_x_type_raises(self):
        with self.assertRaisesRegex(ValueError, 'Invalid x-type'):
            self._fm(['x-type: '])

    def test_invalid_x_emoji_raises(self):
        with self.assertRaisesRegex(ValueError, 'Invalid x-emoji'):
            self._fm(['x-emoji: bad value'])

    def test_empty_x_emoji_raises(self):
        with self.assertRaisesRegex(ValueError, 'Invalid x-emoji'):
            self._fm(['x-emoji: '])

    # Qiita mode
    def test_qiita_tags(self):
        out = convert_front_matter(['tags: python, javascript'], mode='qiita')
        self.assertIn('tags: ["python", "javascript"]', out)

    def test_qiita_private_false(self):
        out = convert_front_matter([], mode='qiita')
        self.assertIn('private: false', out)

    def test_qiita_omits_zenn_only_fields(self):
        out = convert_front_matter(['slug: my-article', 'tags: x'], mode='qiita')
        self.assertFalse(any(line.startswith('emoji:') for line in out))
        self.assertFalse(any(line.startswith('type:') for line in out))
        self.assertFalse(any(line.startswith('topics:') for line in out))
        self.assertFalse(any(line.startswith('published:') for line in out))
        self.assertFalse(any(line.startswith('slug:') for line in out))

    # GitHub mode
    def test_gh_tags(self):
        out = convert_front_matter(['tags: python, markdown'], mode='gh')
        self.assertIn('tags: ["python", "markdown"]', out)

    def test_gh_omits_platform_specific_fields(self):
        out = convert_front_matter(['slug: keep-out', 'tags: x'], mode='gh')
        self.assertFalse(any(line.startswith('emoji:') for line in out))
        self.assertFalse(any(line.startswith('type:') for line in out))
        self.assertFalse(any(line.startswith('topics:') for line in out))
        self.assertFalse(any(line.startswith('published:') for line in out))
        self.assertFalse(any(line.startswith('private:') for line in out))
        self.assertFalse(any(line.startswith('slug:') for line in out))

    # Obsidian mode
    def test_obsidian_tags(self):
        out = convert_front_matter(['tags: notes, blogable'], mode='obsidian')
        self.assertIn('tags: ["notes", "blogable"]', out)

    def test_obsidian_omits_platform_specific_fields(self):
        out = convert_front_matter(['slug: keep-out', 'tags: x'], mode='obsidian')
        self.assertFalse(any(line.startswith('emoji:') for line in out))
        self.assertFalse(any(line.startswith('type:') for line in out))
        self.assertFalse(any(line.startswith('topics:') for line in out))
        self.assertFalse(any(line.startswith('published:') for line in out))
        self.assertFalse(any(line.startswith('private:') for line in out))
        self.assertFalse(any(line.startswith('slug:') for line in out))


# ---------------------------------------------------------------------------
# convert  (full document)
# ---------------------------------------------------------------------------

class TestConvert(unittest.TestCase):

    # ── front matter ────────────────────────────────────────────────────────

    def test_front_matter_block(self):
        src = dedent("""\
            @@
            title: Hello Zenn
            tags: python
            @@
        """)
        out = convert(src)
        self.assertIn('title: "Hello Zenn"', out)
        self.assertIn('topics: ["python"]', out)
        self.assertIn('published: false', out)

    # ── headings ────────────────────────────────────────────────────────────

    def test_h2(self):
        self.assertIn('## [My Heading](#my-heading)', convert(':: My Heading\n'))

    def test_h3(self):
        self.assertIn('### [Sub](#sub)', convert('::: Sub\n'))

    def test_h4(self):
        self.assertIn('#### [Deep](#deep)', convert(':::: Deep\n'))

    def test_numbered_h2(self):
        out = convert('::# First\n::# Second\n')
        self.assertIn('## [1. First](#1-first)', out)
        self.assertIn('## [2. Second](#2-second)', out)

    def test_numbered_h3_counter_reset_on_h2(self):
        src = '::# Parent\n:::# Child\n::# Another\n:::# Child2\n'
        out = convert(src)
        # Second :::# should restart at 1 after the h2 counter advances
        self.assertIn('### [1. Child](#1-child)', out)
        self.assertIn('### [1. Child2](#1-child2)', out)

    def test_plain_h2_resets_numbered_h3_counter(self):
        """Plain :: heading must also reset deeper numbered-heading counters."""
        src = ':: Chapter One\n:::# Section\n:: Chapter Two\n:::# Section\n'
        out = convert(src)
        self.assertIn('### [1. Section](#1-section)', out)
        # Both occurrences should be '### [1. Section](#1-section)', not '### [2. Section]...'
        self.assertNotIn('### [2. Section]', out)

    def test_heading_with_inline_link_no_nested_link(self):
        """Heading containing a Blogable link must not produce nested Markdown links."""
        src = ':: See [https://example.com the site]\n'
        out = convert(src)
        # The visible label should contain no nested [...](...) inside the outer [...]
        self.assertIn('## [See the site](#see-the-site)', out)

    def test_heading_with_strong_plain_text(self):
        """Heading containing **bold** emits plain text in the link label."""
        src = ':: **Important** Notice\n'
        out = convert(src)
        self.assertIn('## [Important Notice](#important-notice)', out)

    def test_heading_with_code_plain_text(self):
        """Heading containing `code` emits plain text in the link label."""
        src = ':: Use `nil` carefully\n'
        out = convert(src)
        self.assertIn('## [Use nil carefully](#use-nil-carefully)', out)

    def test_heading_slug_from_plain_text(self):
        """The anchor slug is derived from plain text, not raw Blogable source."""
        src = ':: **Bold** Title\n'
        out = convert(src)
        # The full auto-link should use plain text for both label and anchor
        self.assertIn('## [Bold Title](#bold-title)', out)

    # ── code blocks ─────────────────────────────────────────────────────────

    def test_code_block_lang(self):
        src = '#!python\nprint("hi")\n!#\n'
        out = convert(src)
        self.assertIn('```python', out)
        self.assertIn('print("hi")', out)
        self.assertIn('```', out)

    def test_code_block_with_title(self):
        src = '#!python\npass\n!#\n@[title: example.py]\n'
        out = convert(src)
        self.assertIn('```python:example.py', out)

    def test_code_block_unescape(self):
        src = '#!text\n\\!# not end\n!#\n'
        out = convert(src)
        self.assertIn('!# not end', out)

    # ── quote blocks ────────────────────────────────────────────────────────

    def test_multiline_quote(self):
        src = '|>\nline one\nline two\n<|\n'
        out = convert(src)
        self.assertIn('> line one', out)
        self.assertIn('> line two', out)

    def test_quote_with_attribution(self):
        src = '|>\nquoted\n<|\n@[author: Alice]\n@[cite: Book Title]\n'
        out = convert(src)
        self.assertIn('> — **Alice**, *Book Title*', out)

    def test_single_line_blockquote(self):
        src = '> inline quote\n'
        self.assertIn('> inline quote', convert(src))

    # ── lists ────────────────────────────────────────────────────────────────

    def test_ul_items(self):
        src = '- apple\n- banana\n'
        out = convert(src)
        self.assertIn('- apple', out)
        self.assertIn('- banana', out)

    def test_ol_items(self):
        src = '# first\n# second\n'
        out = convert(src)
        self.assertIn('1. first', out)
        self.assertIn('1. second', out)

    def test_nested_ul(self):
        src = '- parent\n  - child\n'
        out = convert(src)
        self.assertIn('- parent', out)
        self.assertIn('  - child', out)

    def test_nested_ol(self):
        src = '# top\n  # nested\n'
        out = convert(src)
        self.assertIn('1. top', out)
        self.assertIn('  1. nested', out)

    # ── definition blocks ────────────────────────────────────────────────────

    def test_definition_block(self):
        src = ':= Term\nThe definition body.\n'
        out = convert(src)
        self.assertIn('**Term**', out)
        self.assertIn('The definition body.', out)

    def test_definition_block_stops_at_horizontal_rule(self):
        """A horizontal rule after a definition body must not be consumed."""
        src = ':= Term\nDefinition text.\n---\n'
        out = convert(src)
        self.assertIn('**Term**', out)
        self.assertIn('Definition text.', out)
        self.assertIn('---', out)

    def test_definition_block_stops_at_math_block(self):
        src = ':= Term\nDefinition text.\n$$\nE = mc^2\n$$\n'
        out = convert(src)
        self.assertIn('**Term**', out)
        self.assertIn('$$', out)
        self.assertIn('E = mc^2', out)

    def test_definition_block_stops_at_quote_block(self):
        src = ':= Term\nDefinition text.\n|>\nquoted\n<|\n'
        out = convert(src)
        self.assertIn('**Term**', out)
        self.assertIn('> quoted', out)

    # ── para blocks ──────────────────────────────────────────────────────────

    def test_para_block_single(self):
        src = ': Hello world\n'
        out = convert(src)
        self.assertIn('Hello world', out)

    def test_para_block_multiline(self):
        src = ': Line one\n: Line two\n'
        out = convert(src)
        self.assertIn('Line one', out)
        self.assertIn('Line two', out)

    # ── task list ────────────────────────────────────────────────────────────

    def test_task_checked(self):
        src = '[x] done\n'
        out = convert(src)
        self.assertIn('- [x] done', out)

    def test_task_unchecked(self):
        src = '[ ] todo\n'
        out = convert(src)
        self.assertIn('- [ ] todo', out)

    # ── images ───────────────────────────────────────────────────────────────

    def test_image_url_bare(self):
        src = 'https://example.com/photo.png\n'
        out = convert(src)
        self.assertIn('![](https://example.com/photo.png)', out)

    def test_image_url_with_modifiers(self):
        src = 'https://example.com/photo.png\n@[alt: a photo]\n@[title: Caption]\n'
        out = convert(src)
        self.assertIn('![a photo](https://example.com/photo.png "Caption")', out)

    def test_plain_url_not_image(self):
        src = 'https://example.com/page\n'
        out = convert(src)
        self.assertIn('https://example.com/page', out)
        self.assertNotIn('![', out)

    # ── math blocks ──────────────────────────────────────────────────────────

    def test_math_block(self):
        src = '$$\nE = mc^2\n$$\n'
        out = convert(src)
        self.assertIn('$$', out)
        self.assertIn('E = mc^2', out)

    # ── horizontal rule ──────────────────────────────────────────────────────

    def test_horizontal_rule(self):
        src = '---\n'
        out = convert(src)
        self.assertIn('---', out)

    # ── plain paragraphs ─────────────────────────────────────────────────────

    def test_plain_paragraph(self):
        src = 'Hello, world.\n'
        out = convert(src)
        self.assertIn('Hello, world.', out)

    def test_multiline_plain_paragraph(self):
        src = 'Line one.\nLine two.\n'
        out = convert(src)
        # Both lines in the same paragraph block
        self.assertIn('Line one.', out)
        self.assertIn('Line two.', out)

    # ── footnotes ────────────────────────────────────────────────────────────

    def test_footnote_appendix(self):
        src = 'See [^a note].\n'
        out = convert(src)
        self.assertIn('[^1]', out)
        self.assertIn('[^1]: a note', out)

    def test_footnote_with_url_appendix(self):
        src = 'See [^https://example.com link text].\n'
        out = convert(src)
        self.assertIn('[^1]: [link text](https://example.com)', out)

    def test_multiple_footnotes(self):
        src = 'First [^alpha] and second [^beta].\n'
        out = convert(src)
        self.assertIn('[^1]: alpha', out)
        self.assertIn('[^2]: beta', out)

    # ── inline markup in body text ───────────────────────────────────────────

    def test_insert_in_paragraph(self):
        src = 'This is ++new text++.\n'
        out = convert(src)
        self.assertIn('<ins>new text</ins>', out)

    def test_link_in_paragraph(self):
        src = 'Visit [https://example.com Example Site].\n'
        out = convert(src)
        self.assertIn('[Example Site](https://example.com)', out)

    # ── trailing newline normalisation ───────────────────────────────────────

    def test_output_ends_with_single_newline(self):
        out = convert('hello\n')
        self.assertTrue(out.endswith('\n'))
        self.assertFalse(out.endswith('\n\n'))

    def test_no_triple_blank_lines(self):
        src = 'a\n\n\n\nb\n'
        out = convert(src)
        self.assertNotIn('\n\n\n', out)



# ---------------------------------------------------------------------------
# End-to-end fixture test
# ---------------------------------------------------------------------------

class TestFixtureArticle(unittest.TestCase):
    """Run the full converter against spec/fixture_article.txt and verify
    that key structural elements appear in the output."""

    FIXTURE = os.path.join(os.path.dirname(__file__), 'fixture_article.txt')
    FIXTURE_MD = os.path.join(os.path.dirname(__file__), 'fixture_article.md')
    SCRIPT = os.path.join(os.path.dirname(__file__), '..', 'Blogable2md.py')

    @classmethod
    def setUpClass(cls):
        with open(cls.FIXTURE, encoding='utf-8') as fh:
            cls.src = fh.read()
        cls.out = convert(cls.src)

    # front matter
    def test_fixture_title(self):
        self.assertIn('title: "Blogable Feature Sampler"', self.out)

    def test_fixture_topics(self):
        self.assertIn('topics: ["blogable", "markdown"]', self.out)

    def test_fixture_published(self):
        self.assertIn('published: false', self.out)

    def test_fixture_slug(self):
        self.assertIn('slug: "blogable-feature-sampler"', self.out)

    # headings
    def test_fixture_h2(self):
        self.assertIn('## [Introduction](#introduction)', self.out)

    def test_fixture_h3(self):
        self.assertIn('### [Level Three](#level-three)', self.out)

    def test_fixture_h4(self):
        self.assertIn('#### [Level Four](#level-four)', self.out)

    def test_fixture_numbered_headings(self):
        self.assertIn('## [1. Numbered One](#1-numbered-one)', self.out)
        self.assertIn('## [2. Numbered Two](#2-numbered-two)', self.out)

    # inline markup
    def test_fixture_bold(self):
        self.assertIn('**bold**', self.out)

    def test_fixture_italic(self):
        self.assertIn('*italic*', self.out)

    def test_fixture_strikethrough(self):
        self.assertIn('~~strikethrough~~', self.out)

    def test_fixture_insert(self):
        self.assertIn('<ins>inserted</ins>', self.out)

    def test_fixture_link(self):
        self.assertIn('[link label](https://example.com)', self.out)

    def test_fixture_image(self):
        self.assertIn('![sample photo](https://example.com/photo.png', self.out)

    # code block
    def test_fixture_code_block(self):
        self.assertIn('```python:hello.py', self.out)
        self.assertIn('def hello(name):', self.out)

    # quote block
    def test_fixture_quote(self):
        self.assertIn('> First line of the quote.', self.out)
        self.assertIn('Famous Author', self.out)

    # ordered list
    def test_fixture_ordered_list(self):
        self.assertIn('1. First ordered item', self.out)

    # definition block
    def test_fixture_definition(self):
        self.assertIn('**Term**', self.out)

    # math block
    def test_fixture_math(self):
        self.assertIn('$$', self.out)

    def test_fixture_file_matches_generated_slug_output(self):
        slug = extract_slug(self.src)
        self.assertIsNotNone(slug)

        with tempfile.TemporaryDirectory() as tmpdir:
            subprocess.run(
                [sys.executable, self.SCRIPT, self.FIXTURE],
                cwd=tmpdir,
                check=True,
                capture_output=True,
                text=True,
            )

            generated = os.path.join(tmpdir, slug + '.md')
            self.assertTrue(os.path.exists(generated))

            with open(generated, encoding='utf-8') as fh:
                generated_md = fh.read()
            with open(self.FIXTURE_MD, encoding='utf-8') as fh:
                fixture_md = fh.read()

            self.assertEqual(generated_md, fixture_md)


# ---------------------------------------------------------------------------
# End-to-end fixture test (Japanese)
# ---------------------------------------------------------------------------

class TestFixtureArticleJa(unittest.TestCase):
    """Run the full converter against spec/fixture_article_ja.txt and verify
    that key structural elements appear in the Japanese output."""

    FIXTURE = os.path.join(os.path.dirname(__file__), 'fixture_article_ja.txt')
    FIXTURE_MD = os.path.join(os.path.dirname(__file__), 'fixture_article_ja.md')
    SCRIPT = os.path.join(os.path.dirname(__file__), '..', 'Blogable2md.py')

    @classmethod
    def setUpClass(cls):
        with open(cls.FIXTURE, encoding='utf-8') as fh:
            cls.src = fh.read()
        cls.out = convert(cls.src)

    # front matter
    def test_fixture_ja_title(self):
        self.assertIn('title: "Blogable 機能サンプラー"', self.out)

    def test_fixture_ja_topics(self):
        self.assertIn('topics: ["blogable", "markdown"]', self.out)

    def test_fixture_ja_published(self):
        self.assertIn('published: false', self.out)

    def test_fixture_ja_slug(self):
        self.assertIn('slug: "blogable-feature-sampler-ja"', self.out)

    # headings
    def test_fixture_ja_h2(self):
        self.assertIn('## [はじめに](#はじめに)', self.out)

    def test_fixture_ja_h3(self):
        self.assertIn('### [レベル 3](#レベル-3)', self.out)

    def test_fixture_ja_h4(self):
        self.assertIn('#### [レベル 4](#レベル-4)', self.out)

    def test_fixture_ja_numbered_headings(self):
        self.assertIn('## [1. 番号付き 1](#1-番号付き-1)', self.out)
        self.assertIn('## [2. 番号付き 2](#2-番号付き-2)', self.out)

    # inline markup
    def test_fixture_ja_bold(self):
        self.assertIn('**太字**', self.out)

    def test_fixture_ja_italic(self):
        self.assertIn('*イタリック*', self.out)

    def test_fixture_ja_strikethrough(self):
        self.assertIn('~~取り消し線~~', self.out)

    def test_fixture_ja_insert(self):
        self.assertIn('<ins>挿入</ins>', self.out)

    def test_fixture_ja_link(self):
        self.assertIn('[リンクラベル](https://example.com)', self.out)

    def test_fixture_ja_image(self):
        self.assertIn('![サンプル写真](https://picsum.photos/seed/blogable1/600/200.jpg', self.out)

    # code block
    def test_fixture_ja_code_block(self):
        self.assertIn('```python:hello.py', self.out)
        self.assertIn('こんにちは', self.out)

    # quote block
    def test_fixture_ja_quote(self):
        self.assertIn('> 引用の 1 行目。', self.out)
        self.assertIn('著名な著者', self.out)

    # ordered list
    def test_fixture_ja_ordered_list(self):
        self.assertIn('1. 1 番目の順序付きアイテム', self.out)

    # definition block
    def test_fixture_ja_definition(self):
        self.assertIn('**用語**', self.out)

    # math block
    def test_fixture_ja_math(self):
        self.assertIn('$$', self.out)

    def test_fixture_ja_file_matches_generated_slug_output(self):
        slug = extract_slug(self.src)
        self.assertIsNotNone(slug)

        with tempfile.TemporaryDirectory() as tmpdir:
            subprocess.run(
                [sys.executable, self.SCRIPT, self.FIXTURE],
                cwd=tmpdir,
                check=True,
                capture_output=True,
                text=True,
            )

            generated = os.path.join(tmpdir, slug + '.md')
            self.assertTrue(os.path.exists(generated))

            with open(generated, encoding='utf-8') as fh:
                generated_md = fh.read()
            with open(self.FIXTURE_MD, encoding='utf-8') as fh:
                fixture_md = fh.read()

            self.assertEqual(generated_md, fixture_md)


class TestCliModes(unittest.TestCase):

    SCRIPT = os.path.join(os.path.dirname(__file__), '..', 'Blogable2md.py')
    EXECUTABLE = os.path.join(os.path.dirname(__file__), '..', 'Blogable2md')

    def test_cli_executable_entrypoint(self):
        proc = subprocess.run(
            [self.EXECUTABLE, '--help'],
            check=True,
            capture_output=True,
            text=True,
        )
        self.assertIn('--obsidian', proc.stdout)

    def test_cli_qiita_mode(self):
        src = dedent("""\
            @@
            title: My Qiita Article
            tags: python, blogable
            slug: keep-for-zenn-only
            @@
            :: Heading
        """)
        with tempfile.TemporaryDirectory() as tmpdir:
            in_path = os.path.join(tmpdir, 'in.txt')
            out_path = os.path.join(tmpdir, 'out.md')
            with open(in_path, 'w', encoding='utf-8') as fh:
                fh.write(src)

            subprocess.run(
                [sys.executable, self.SCRIPT, '--Qiita', in_path, out_path],
                check=True,
                capture_output=True,
                text=True,
            )

            with open(out_path, encoding='utf-8') as fh:
                out = fh.read()
            self.assertIn('title: "My Qiita Article"', out)
            self.assertIn('tags: ["python", "blogable"]', out)
            self.assertIn('private: false', out)
            self.assertNotIn('emoji: "🚀"', out)
            self.assertNotIn('topics:', out)
            self.assertNotIn('published:', out)
            self.assertNotIn('slug:', out)

    def test_cli_zenn_mode_explicit_flag(self):
        src = dedent("""\
            @@
            title: My Zenn Article
            tags: python
            slug: zenn-slug
            @@
        """)
        with tempfile.TemporaryDirectory() as tmpdir:
            in_path = os.path.join(tmpdir, 'in.txt')
            out_path = os.path.join(tmpdir, 'out.md')
            with open(in_path, 'w', encoding='utf-8') as fh:
                fh.write(src)

            subprocess.run(
                [sys.executable, self.SCRIPT, '--Zenn', in_path, out_path],
                check=True,
                capture_output=True,
                text=True,
            )

            with open(out_path, encoding='utf-8') as fh:
                out = fh.read()
            self.assertIn('emoji: "🚀"', out)
            self.assertIn('topics: ["python"]', out)
            self.assertIn('published: false', out)
            self.assertIn('slug: "zenn-slug"', out)

    def test_cli_gh_mode(self):
        src = dedent("""\
            @@
            title: My GitHub Article
            tags: python, docs
            slug: no-slug-for-gh
            @@
        """)
        with tempfile.TemporaryDirectory() as tmpdir:
            in_path = os.path.join(tmpdir, 'in.txt')
            out_path = os.path.join(tmpdir, 'out.md')
            with open(in_path, 'w', encoding='utf-8') as fh:
                fh.write(src)

            subprocess.run(
                [sys.executable, self.SCRIPT, '--gh', in_path, out_path],
                check=True,
                capture_output=True,
                text=True,
            )

            with open(out_path, encoding='utf-8') as fh:
                out = fh.read()
            self.assertIn('title: "My GitHub Article"', out)
            self.assertIn('tags: ["python", "docs"]', out)
            self.assertNotIn('emoji: "🚀"', out)
            self.assertNotIn('type: "tech"', out)
            self.assertNotIn('topics:', out)
            self.assertNotIn('published:', out)
            self.assertNotIn('private:', out)
            self.assertNotIn('slug:', out)

    def test_cli_obsidian_mode(self):
        src = dedent("""\
            @@
            title: My Obsidian Note
            tags: notes, wiki
            slug: no-slug-for-obsidian
            @@
        """)
        with tempfile.TemporaryDirectory() as tmpdir:
            in_path = os.path.join(tmpdir, 'in.txt')
            out_path = os.path.join(tmpdir, 'out.md')
            with open(in_path, 'w', encoding='utf-8') as fh:
                fh.write(src)

            subprocess.run(
                [sys.executable, self.SCRIPT, '--obsidian', in_path, out_path],
                check=True,
                capture_output=True,
                text=True,
            )

            with open(out_path, encoding='utf-8') as fh:
                out = fh.read()
            self.assertIn('title: "My Obsidian Note"', out)
            self.assertIn('tags: ["notes", "wiki"]', out)
            self.assertNotIn('emoji: "🚀"', out)
            self.assertNotIn('type: "tech"', out)
            self.assertNotIn('topics:', out)
            self.assertNotIn('published:', out)
            self.assertNotIn('private:', out)
            self.assertNotIn('slug:', out)

    def test_cli_invalid_x_type_exits_with_error(self):
        src = dedent("""\
            @@
            title: Invalid
            x-type: invalid
            @@
        """)
        with tempfile.TemporaryDirectory() as tmpdir:
            in_path = os.path.join(tmpdir, 'in.txt')
            out_path = os.path.join(tmpdir, 'out.md')
            with open(in_path, 'w', encoding='utf-8') as fh:
                fh.write(src)

            proc = subprocess.run(
                [sys.executable, self.SCRIPT, '--Zenn', in_path, out_path],
                check=False,
                capture_output=True,
                text=True,
            )
            self.assertNotEqual(proc.returncode, 0)
            self.assertIn('Invalid x-type', proc.stderr)


if __name__ == '__main__':
    unittest.main()
