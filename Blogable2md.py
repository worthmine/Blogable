#!/usr/bin/env python3
"""
Blogable2md.py – Convert Blogable v1.1-alpha markup to platform Markdown.

Usage:
  python Blogable2md.py --Zenn input.txt            # writes <slug>.md (from front-matter) or input.md
  python Blogable2md.py --Qiita input.txt output.md # writes output.md
  python Blogable2md.py --gh input.txt output.md    # writes GitHub-flavored Markdown
  python Blogable2md.py --obsidian input.txt output.md # writes Obsidian-flavored Markdown
  python Blogable2md.py --Zenn -                    # reads stdin, writes stdout
"""

import sys
import re
import argparse
from pathlib import Path

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

IMAGE_EXTS = re.compile(r'\.(jpe?g|png|gif|webp)(\?.*)?$', re.IGNORECASE)

SHEBANG_LANG_MAP = {
    'python': 'python', 'python3': 'python', 'python2': 'python',
    'node': 'javascript', 'nodejs': 'javascript',
    'ruby': 'ruby', 'perl': 'perl',
    'bash': 'bash', 'sh': 'bash', 'zsh': 'bash',
    'php': 'php', 'lua': 'lua',
    'rust': 'rust', 'go': 'go', 'swift': 'swift',
    'blogable': 'blogable',
    'ebnf': 'ebnf',
}


class FrontMatterValidationError(ValueError):
    """Raised when front-matter values are syntactically valid but unsupported."""

# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

def slugify(text):
    """Convert text to a URL slug (matches Blogable's slugify logic)."""
    s = text.strip().lower()
    s = re.sub(r'\s+', '-', s)
    s = re.sub(r'[^\w\u3000-\u9fff\u3040-\u309f\u30a0-\u30ff\uff00-\uffef-]', '', s)
    s = re.sub(r'-+', '-', s)
    return s.strip('-')


def plain_text(blogable_inline):
    """Reduce Blogable inline markup to its visible plain text.

    Used to derive heading anchor slugs and link labels from raw heading
    source, so that:
    - the slug matches what Zenn generates from the rendered heading text, and
    - the Markdown link label contains no nested ``[...]`` constructs
      (which would produce invalid Markdown).
    """
    s = blogable_inline
    # [https://... label] → label
    s = re.sub(r'\[https?://[^ \]\n]+ ([^\]\n]+)\]', r'\1', s)
    # [https://...] (bare URL) → URL
    s = re.sub(r'\[https?://([^\]\n]+)\]', r'\1', s)
    # [^...] footnote → (remove; no visible inline text)
    s = re.sub(r'\[\^[^\]\n]*\]', '', s)
    # **bold** → bold
    s = re.sub(r'\*\*([^*\n]+)\*\*', r'\1', s)
    # *em* → em
    s = re.sub(r'\*([^*\n]+)\*', r'\1', s)
    # ~~del~~ → del
    s = re.sub(r'~~([^~\n]+)~~', r'\1', s)
    # ++ins++ → ins
    s = re.sub(r'\+\+([^+\n]+)\+\+', r'\1', s)
    # `code` → code
    s = re.sub(r'`([^`\n]*)`', r'\1', s)
    return s.strip()


def is_image_url(url):
    path = url.split('?')[0]
    return bool(IMAGE_EXTS.search(path))


def extract_slug(src):
    """Return the slug value from Blogable front-matter (@@...@@), or None."""
    lines = src.splitlines()
    in_fm = False
    for line in lines:
        stripped = line.strip()
        if stripped == '@@':
            if not in_fm:
                in_fm = True
            else:
                break
        elif in_fm:
            m = re.match(r'^slug: (.*)$', stripped)
            if m:
                value = re.sub(r'\s+#.*$', '', m.group(1)).strip()
                return value if value else None
    return None


def detect_lang(line):
    """Extract the language name from a Blogable shebang line (#!lang or #!/path)."""
    m = re.match(r'^#!(.+)$', line)
    if not m:
        return ''
    rest = m.group(1).strip()
    if not rest:
        return ''
    if rest.startswith('/'):
        path_m = re.match(r'^/\S+/(?:env\s+)?(\S+)', rest)
        if not path_m:
            return ''
        raw_cmd = path_m.group(1)
    else:
        raw_cmd = rest
    cmd = re.sub(r'[0-9.]+$', '', raw_cmd)
    return SHEBANG_LANG_MAP.get(cmd, cmd)


# ---------------------------------------------------------------------------
# Inline conversion
# ---------------------------------------------------------------------------

def convert_inline(text, footnotes):
    """
    Convert Blogable inline markup to Markdown inline markup.

    Evaluation order (mirrors Blogable spec):
    Code > Link > Footnote > Strong > Emphasis > Delete > Insert > Plain
    """
    result = ''
    idx = 0
    length = len(text)

    while idx < length:
        rest = text[idx:]

        # ── Code `...` ────────────────────────────────────────────────────
        m = re.match(r'^`([^`\n]*)`', rest)
        if m:
            result += f'`{m.group(1)}`'
            idx += len(m.group(0))
            continue

        # ── Link [https://... label] ───────────────────────────────────────
        m = re.match(r'^\[(https://[^ \]\n]+) ([^\]\n]+)\]', rest)
        if m:
            result += f'[{m.group(2)}]({m.group(1)})'
            idx += len(m.group(0))
            continue

        # ── Footnote [^text] or [^url text] ───────────────────────────────
        m = re.match(r'^\[\^([^\]\n]*)\]', rest)
        if m:
            inner = m.group(1)
            fn_num = len(footnotes) + 1
            url_m = re.match(r'^(https://\S+) (.+)$', inner)
            if url_m:
                footnotes.append({'n': fn_num, 'url': url_m.group(1), 'text': url_m.group(2)})
            else:
                footnotes.append({'n': fn_num, 'url': None, 'text': inner})
            result += f'[^{fn_num}]'
            idx += len(m.group(0))
            continue

        # ── Strong **...** ────────────────────────────────────────────────
        m = re.match(r'^\*\*([^*\n]+)\*\*', rest)
        if m:
            result += f'**{m.group(1)}**'
            idx += len(m.group(0))
            continue

        # ── Emphasis *...* ────────────────────────────────────────────────
        m = re.match(r'^\*([^*\n]+)\*', rest)
        if m:
            result += f'*{m.group(1)}*'
            idx += len(m.group(0))
            continue

        # ── Delete ~~...~~ ────────────────────────────────────────────────
        m = re.match(r'^~~([^~\n]+)~~', rest)
        if m:
            result += f'~~{m.group(1)}~~'
            idx += len(m.group(0))
            continue

        # ── Insert ++...++ (no native Markdown; use <ins>) ────────────────
        m = re.match(r'^\+\+([^+\n]+)\+\+', rest)
        if m:
            result += f'<ins>{m.group(1)}</ins>'
            idx += len(m.group(0))
            continue

        # ── Plain character ───────────────────────────────────────────────
        result += text[idx]
        idx += 1

    return result


# ---------------------------------------------------------------------------
# Front matter conversion
# ---------------------------------------------------------------------------

def convert_front_matter(fm_lines, mode='zenn'):
    """
    Convert Blogable front-matter lines to platform YAML front-matter.

    mode='zenn':
      title -> title
      tags  -> topics
      slug  -> slug

    mode='qiita':
      title -> title
      tags  -> tags
      private -> private
      id/organization_url_name/slide are omitted

    mode='gh':
      title -> title
      tags  -> tags
      platform-specific keys are omitted

    mode='obsidian':
      title -> title
      tags  -> tags
      platform-specific keys are omitted
    """
    meta = {}
    for line in fm_lines:
        m = re.match(r'^([a-z][a-z0-9-]*): (.*)$', line)
        if not m:
            continue
        key, value = m.group(1), m.group(2)
        # Strip inline comments (e.g. "1.1-alpha # comment" -> "1.1-alpha")
        value = re.sub(r'\s+#.*$', '', value).strip()
        meta[key] = value

    out = ['---']

    # title
    title = meta.get('title', '')
    out.append(f'title: "{title}"')

    tags = [t.strip() for t in meta.get('tags', '').split(',') if t.strip()]
    if mode == 'qiita':
        if tags:
            out.append('tags: [' + ', '.join(f'"{t}"' for t in tags) + ']')
        else:
            out.append('tags: []')
        out.append('private: false')
    elif mode in ('gh', 'obsidian'):
        if tags:
            out.append('tags: [' + ', '.join(f'"{t}"' for t in tags) + ']')
        else:
            out.append('tags: []')
    else:
        if 'x-emoji' in meta:
            emoji = meta['x-emoji']
            if not emoji:
                raise FrontMatterValidationError('Invalid x-emoji: use a non-empty value')
            if re.search(r'\s', emoji):
                raise FrontMatterValidationError('Invalid x-emoji: do not include whitespace')
        else:
            emoji = '🚀'
        out.append(f'emoji: "{emoji}"')

        if 'x-type' in meta:
            article_type = meta['x-type']
            if not article_type:
                raise FrontMatterValidationError('Invalid x-type: use a non-empty value ("tech" or "idea")')
            if article_type not in ('tech', 'idea'):
                raise FrontMatterValidationError('Invalid x-type: expected "tech" or "idea"')
        else:
            article_type = 'tech'
        out.append(f'type: "{article_type}"')

        # topics (from tags)
        if tags:
            out.append('topics: [' + ', '.join(f'"{t}"' for t in tags) + ']')
        else:
            out.append('topics: []')

        # published: always false by default for safety
        out.append('published: false')

        # slug
        if 'slug' in meta:
            out.append(f'slug: "{meta["slug"]}"')

    out.append('---')
    return out


# ---------------------------------------------------------------------------
# Modifier helpers
# ---------------------------------------------------------------------------

def collect_modifiers(lines, pos):
    """
    Consume zero or more @[key: value] lines starting at `pos`.
    Returns (mods_dict, new_pos).
    """
    mods = {}
    while pos < len(lines):
        mod_m = re.match(r'^@\[([a-z][a-z0-9-]*): (.*)\]$', lines[pos].strip())
        if mod_m:
            mods[mod_m.group(1)] = mod_m.group(2)
            pos += 1
        else:
            break
    return mods, pos


# ---------------------------------------------------------------------------
# List rendering helpers
# ---------------------------------------------------------------------------

def _list_item_prefix(indent_spaces, item_type):
    """Return the Markdown prefix for a list item."""
    md_indent = '  ' * (indent_spaces // 2)
    if item_type == 'ol':
        return f'{md_indent}1. '
    return f'{md_indent}- '


def _is_list_line(raw_line):
    """Return True if the raw line is a UL or OL list item."""
    return bool(re.match(r'^((?:  )*)[#-]\s+', raw_line))


# ---------------------------------------------------------------------------
# Main converter
# ---------------------------------------------------------------------------

def convert(src, mode='zenn'):
    lines = src.splitlines()
    out = []
    footnotes = []

    total = len(lines)
    i = 0

    # Per-level numbered-heading counters.
    # Index 0 = h2, index 1 = h3, …, index 4 = h6.
    h_counters = [0, 0, 0, 0, 0]

    while i < total:
        line = lines[i]
        stripped = line.strip()

        # ── Front matter  @@...@@  ────────────────────────────────────────
        if stripped == '@@':
            i += 1
            fm_lines = []
            while i < total and lines[i].strip() != '@@':
                fm_lines.append(lines[i].strip())
                i += 1
            i += 1  # skip closing @@
            out.extend(convert_front_matter(fm_lines, mode=mode))
            out.append('')
            continue

        # ── Blank line ────────────────────────────────────────────────────
        if stripped == '':
            out.append('')
            i += 1
            continue

        # ── Horizontal rule  --- ──────────────────────────────────────────
        if stripped == '---':
            out.append('---')
            i += 1
            continue

        # ── Math block  $$...$$  ──────────────────────────────────────────
        if stripped == '$$':
            out.append('$$')
            i += 1
            while i < total and lines[i].strip() != '$$':
                out.append(lines[i])
                i += 1
            out.append('$$')
            i += 1
            _, i = collect_modifiers(lines, i)  # modifiers ignored for math
            continue

        # ── Multi-line quote block  |>...<|  ─────────────────────────────
        if stripped == '|>':
            i += 1
            quote_lines = []
            while i < total and lines[i].strip() != '<|':
                quote_lines.append(lines[i])
                i += 1
            i += 1  # skip <|
            mods, i = collect_modifiers(lines, i)
            for ql in quote_lines:
                qs = ql.strip()
                if qs == '':
                    out.append('>')
                else:
                    out.append('> ' + convert_inline(qs, footnotes))
            # Attribution line from @[author:] / @[cite:]
            attr_parts = []
            if 'author' in mods:
                attr_parts.append(f'**{mods["author"]}**')
            if 'cite' in mods:
                attr_parts.append(f'*{mods["cite"]}*')
            if attr_parts:
                out.append('>')
                out.append('> — ' + ', '.join(attr_parts))
            out.append('')
            continue

        # ── Single-line blockquote  > text  ──────────────────────────────
        if stripped.startswith('> '):
            out.append('> ' + convert_inline(stripped[2:], footnotes))
            i += 1
            continue

        # ── Code block  #!lang...!#  ──────────────────────────────────────
        if stripped.startswith('#!'):
            lang = detect_lang(stripped)
            i += 1
            code_lines = []
            while i < total and lines[i].strip() != '!#':
                raw = lines[i]
                # unescape \!# → !# inside code content
                raw = re.sub(r'^(\s*)\\(!#.*)$', r'\1\2', raw)
                code_lines.append(raw)
                i += 1
            i += 1  # skip !#
            mods, i = collect_modifiers(lines, i)
            title = mods.get('title', '')
            fence_open = f'```{lang}' + (f':{title}' if title else '')
            out.append(fence_open)
            out.extend(code_lines)
            out.append('```')
            out.append('')
            continue

        # ── Numbered heading  ::# :::# ...  ──────────────────────────────
        num_h = re.match(r'^(:{2,6})#\s+(.*)', stripped)
        if num_h:
            level = len(num_h.group(1))   # 2–6
            text = num_h.group(2)
            h_counters[level - 2] += 1
            # Reset all deeper levels (indices level-1 through 4).
            # level-2 is the current level's index; level-1 is one step deeper.
            for j in range(level - 1, 5):
                h_counters[j] = 0
            prefix = '#' * level
            num = h_counters[level - 2]
            plain_label = f'{num}. {plain_text(text)}'
            anchor = slugify(plain_label)
            out.append(f'{prefix} [{plain_label}](#{anchor})')
            i += 1
            continue

        # ── Regular heading  :: ::: ...  ─────────────────────────────────
        pln_h = re.match(r'^(:{2,6})\s+(.*)', stripped)
        if pln_h:
            level = len(pln_h.group(1))   # 2–6
            text = pln_h.group(2)
            # Reset deeper numbered-heading counters, same as numbered headings.
            for j in range(level - 1, 5):
                h_counters[j] = 0
            prefix = '#' * level
            plain_label = plain_text(text)
            anchor = slugify(plain_label)
            out.append(f'{prefix} [{plain_label}](#{anchor})')
            i += 1
            continue

        # ── Casual definition list  ? term / = desc / : desc  ─────────────
        dl_term_m = re.match(r'^\?\s+(.*)', line)
        if dl_term_m:
            entries = []
            while i < total:
                term_m = re.match(r'^\?\s+(.*)', lines[i])
                if not term_m:
                    break
                term = term_m.group(1).strip()
                i += 1

                dd_lines = []
                while i < total:
                    dd_m = re.match(r'^[=:]\s+(.*)', lines[i])
                    if not dd_m:
                        break
                    dd_lines.append(dd_m.group(1).strip())
                    i += 1

                # Require at least one dd line; otherwise fall back to plain text.
                if not dd_lines:
                    out.append('? ' + convert_inline(term, footnotes))
                    out.append('')
                    break

                entries.append((term, dd_lines))

            if entries:
                out.append('<dl>')
                for term, dd_lines in entries:
                    out.append(f'<dt>{convert_inline(term, footnotes)}</dt>')
                    for dd in dd_lines:
                        out.append(f'<dd>{convert_inline(dd, footnotes)}</dd>')
                out.append('</dl>')
                out.append('')
            continue

        # ── Definition block  := Term  ────────────────────────────────────
        def_m = re.match(r'^:=\s+(.*)', line)
        if def_m:
            term = def_m.group(1).strip()
            i += 1
            body_lines = []
            while i < total:
                ns = lines[i].strip()
                if (ns == ''
                        or ns in ('---', '$$', '|>', '<|')
                        or ns.startswith(':=')
                    or ns.startswith('? ')
                    or ns.startswith('= ')
                    or ns.startswith(': ')
                        or ns.startswith('::')
                        or ns.startswith('#!')
                        or ns.startswith('> ')):
                    break
                if re.match(r'^@\[', ns):
                    break
                body_lines.append(ns)
                i += 1
            mods, i = collect_modifiers(lines, i)

            term_id = slugify(plain_text(term))
            classes = ['def-block']
            if 'class' in mods and mods['class'].strip():
                classes.append(mods['class'].strip())
            class_attr = ' '.join(classes)
            id_attr = f' id="{mods["id"]}"' if 'id' in mods and mods['id'].strip() else ''

            out.append(f'<dl class="{class_attr}"{id_attr}>')
            out.append(f'<dt id="{term_id}"><a href="#{term_id}">{convert_inline(term, footnotes)}</a></dt>')
            if body_lines:
                body_text = convert_inline(' '.join(body_lines), footnotes)
                out.append(f'<dd>{body_text}</dd>')
            else:
                out.append('<dd></dd>')
            out.append('</dl>')
            out.append('')
            continue

        # ── Para block  `: text`  ─────────────────────────────────────────
        para_m = re.match(r'^: (.+)', stripped)
        if para_m:
            para_lines = [para_m.group(1)]
            i += 1
            while i < total:
                next_m = re.match(r'^: (.+)', lines[i].strip())
                if next_m:
                    para_lines.append(next_m.group(1))
                    i += 1
                else:
                    break
            _, i = collect_modifiers(lines, i)  # modifiers noted but not output
            # Join with backslash line-break (hard break in Markdown/Zenn)
            out.append('\\\n'.join(convert_inline(pl, footnotes) for pl in para_lines))
            out.append('')
            continue

        # ── Task list item  [x] / [ ]  ───────────────────────────────────
        task_m = re.match(r'^(\s*)\[([ x])\]\s+(.*)', line, re.IGNORECASE)
        if task_m:
            indent_spaces = len(task_m.group(1))
            checked = task_m.group(2).lower() == 'x'
            text = task_m.group(3)
            md_indent = '  ' * (indent_spaces // 2)
            check_mark = 'x' if checked else ' '
            out.append(f'{md_indent}- [{check_mark}] {convert_inline(text, footnotes)}')
            i += 1
            continue

        # ── UL item  - text  (possibly indented) ──────────────────────────
        ul_m = re.match(r'^((?:  )*)-\s+(.*)', line)
        if ul_m and not line.strip().startswith('-['):
            indent_spaces = len(ul_m.group(1))
            text = ul_m.group(2)
            md_indent = '  ' * (indent_spaces // 2)
            out.append(f'{md_indent}- {convert_inline(text, footnotes)}')
            i += 1
            continue

        # ── OL item  # text  (possibly indented) ──────────────────────────
        ol_m = re.match(r'^((?:  )*)#\s+(.*)', line)
        if ol_m:
            indent_spaces = len(ol_m.group(1))
            text = ol_m.group(2)
            md_indent = '  ' * (indent_spaces // 2)
            out.append(f'{md_indent}1. {convert_inline(text, footnotes)}')
            i += 1
            continue

        # ── URL block  https://...  ───────────────────────────────────────
        if re.match(r'^https://\S+$', stripped):
            url = stripped
            i += 1
            mods, i = collect_modifiers(lines, i)
            if is_image_url(url):
                alt = mods.get('alt', '')
                title_attr = mods.get('title', '')
                if title_attr:
                    out.append(f'![{alt}]({url} "{title_attr}")')
                else:
                    out.append(f'![{alt}]({url})')
            else:
                out.append(url)
            out.append('')
            continue

        # ── Orphaned modifier  @[key: value]  ─────────────────────────────
        if re.match(r'^@\[[a-z][a-z0-9-]*: .*\]$', stripped):
            i += 1
            continue

        # ── Plain paragraph  ──────────────────────────────────────────────
        # Collect consecutive text lines until a blank line or a recognized
        # block opener appears.
        para_lines = [stripped]
        i += 1
        while i < total:
            next_raw = lines[i]
            ns = next_raw.strip()
            if ns == '':
                break
            # Stop at any recognized block starter
            if (ns in ('@@', '---', '$$', '|>', '<|')
                    or ns.startswith('#!')
                    or ns.startswith('::')
                    or re.match(r'^:=\s', ns)
                    or re.match(r'^\?\s', ns)
                    or re.match(r'^[=:]\s', ns)
                    or re.match(r'^: .', ns)
                    or re.match(r'^https://', ns)
                    or re.match(r'^@\[', ns)
                    or ns.startswith('> ')
                    or re.match(r'^\s*\[([ x])\]\s+', next_raw, re.IGNORECASE)
                    or re.match(r'^((?:  )*)-\s+', next_raw)
                    or re.match(r'^((?:  )*)#\s+', next_raw)):
                break
            para_lines.append(ns)
            i += 1

        out.append('\n'.join(convert_inline(pl, footnotes) for pl in para_lines))
        out.append('')

    # ── Footnote appendix  ────────────────────────────────────────────────
    if footnotes:
        out.append('')
        for fn in footnotes:
            if fn['url']:
                out.append(f'[^{fn["n"]}]: [{fn["text"]}]({fn["url"]})')
            else:
                out.append(f'[^{fn["n"]}]: {fn["text"]}')

    # Normalise trailing newlines: single newline at EOF
    result = '\n'.join(out)
    result = re.sub(r'\n{3,}', '\n\n', result)
    return result.rstrip('\n') + '\n'


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description='Convert Blogable v1.1-alpha markup to platform Markdown (Zenn, Qiita, GitHub, Obsidian).'
    )
    mode_group = parser.add_mutually_exclusive_group()
    mode_group.add_argument(
        '--Zenn',
        dest='mode',
        action='store_const',
        const='zenn',
        help='Output Zenn-oriented Markdown (default)'
    )
    mode_group.add_argument(
        '--Qiita',
        dest='mode',
        action='store_const',
        const='qiita',
        help='Output Qiita-oriented Markdown'
    )
    mode_group.add_argument(
        '--gh',
        dest='mode',
        action='store_const',
        const='gh',
        help='Output GitHub-flavored Markdown'
    )
    mode_group.add_argument(
        '--obsidian',
        dest='mode',
        action='store_const',
        const='obsidian',
        help='Output Obsidian-flavored Markdown'
    )
    parser.set_defaults(mode='zenn')
    parser.add_argument(
        'input', nargs='?', default='-',
        help='Input Blogable file (default: stdin when omitted or "-")'
    )
    parser.add_argument(
        'output', nargs='?', default=None,
        help='Output Markdown file (default: <slug>.md from front-matter, or <input>.md, or stdout for stdin)'
    )
    args = parser.parse_args()

    if args.input == '-':
        src = sys.stdin.read()
        out_path = None
    else:
        in_path = Path(args.input)
        src = in_path.read_text(encoding='utf-8')
        if args.output:
            out_path = Path(args.output)
        else:
            slug = extract_slug(src)
            out_path = Path(slug + '.md') if slug else in_path.with_suffix('.md')

    try:
        result = convert(src, mode=args.mode)
    except FrontMatterValidationError as e:
        print(str(e), file=sys.stderr)
        sys.exit(2)

    if out_path:
        out_path.write_text(result, encoding='utf-8')
        print(f'Written to {out_path}', file=sys.stderr)
    else:
        sys.stdout.write(result)


if __name__ == '__main__':
    main()
