"""
spec/test_Blogable2ZennMd.py
Unit tests for Blogable2ZennMd.py

Run with:
  python -m unittest discover -s spec -p 'test_*.py' -v
  # or (if pytest is installed)
  pytest spec/test_Blogable2ZennMd.py -v
"""

import sys
import os
import unittest
import textwrap

# Make sure the root of the repo is on sys.path so we can import the module.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from Blogable2ZennMd import (
    slugify,
    is_image_url,
    detect_lang,
    convert_inline,
    convert_front_matter,
    convert,
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

    def test_anchor_ref(self):
        result, _ = self._ci('[#My Section]')
        self.assertEqual(result, '[My Section](#my-section)')

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

    # published / draft
    def test_published_default_is_false(self):
        """No draft key -> published: false (safe default)."""
        out = self._fm(['title: Test'])
        self.assertIn('published: false', out)

    def test_draft_true_yields_published_false(self):
        out = self._fm(['draft: true'])
        self.assertIn('published: false', out)

    def test_draft_1_yields_published_false(self):
        out = self._fm(['draft: 1'])
        self.assertIn('published: false', out)

    def test_draft_yes_yields_published_false(self):
        out = self._fm(['draft: yes'])
        self.assertIn('published: false', out)

    def test_draft_false_yields_published_true(self):
        out = self._fm(['draft: false'])
        self.assertIn('published: true', out)

    def test_draft_0_yields_published_true(self):
        out = self._fm(['draft: 0'])
        self.assertIn('published: true', out)

    def test_draft_no_yields_published_true(self):
        out = self._fm(['draft: no'])
        self.assertIn('published: true', out)

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
        self.assertIn('## My Heading', convert(':: My Heading\n'))

    def test_h3(self):
        self.assertIn('### Sub', convert('::: Sub\n'))

    def test_h4(self):
        self.assertIn('#### Deep', convert(':::: Deep\n'))

    def test_numbered_h2(self):
        out = convert('::# First\n::# Second\n')
        self.assertIn('## 1. First', out)
        self.assertIn('## 2. Second', out)

    def test_numbered_h3_counter_reset_on_h2(self):
        src = '::# Parent\n:::# Child\n::# Another\n:::# Child2\n'
        out = convert(src)
        # Second :::# should restart at 1 after the h2 counter advances
        self.assertIn('### 1. Child', out)
        self.assertIn('### 1. Child2', out)

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

    # ── anchor blocks ────────────────────────────────────────────────────────

    def test_anchor_block(self):
        src = '[#My Section]\n'
        out = convert(src)
        self.assertIn('<a id="my-section"></a>', out)

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


if __name__ == '__main__':
    unittest.main()
