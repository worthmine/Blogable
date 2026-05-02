# Blogable

Blogable Language Specification — **v1.1-alpha**

## Table of Contents

1. [Introduction](#1-introduction)
2. [Design Principles](#2-design-principles)
3. [Document Structure](#3-document-structure)
4. [Front Matter](#4-front-matter)
5. [Body Blocks](#5-body-blocks)
6. [Inline Formatting](#6-inline-formatting)
7. [List Handling](#7-list-handling)
8. [Anchor Handling](#8-anchor-handling)
9. [Self-Description Blocks](#9-self-description-blocks)
10. [Diagnostics and Error Handling](#10-diagnostics-and-error-handling)
11. [Reserved Features](#11-reserved-features)

---

## 1. Introduction

Blogable is a deterministic, single-pass markup language for blog content.
This specification merges the core body-rendering rules, front matter rules,
anchor handling, list handling, and the v1.1-alpha self-description blocks.

Core rendering is **body-only**.  Front matter is parsed and preserved, but it
does not change core body rendering unless explicitly stated in this document.

---

## 2. Design Principles

1. **Parsing is single-pass and deterministic.**  The parser reads each line
   exactly once, top-to-bottom.  No backtracking or lookahead beyond the current
   block is permitted.  Given identical input, every conforming implementation
   must produce identical output.

2. **Network access is forbidden during parsing.**  The parser must not resolve
   URLs, fetch external resources, or perform DNS lookups at any point during a
   parsing run.

3. **Raw HTML is not recognized.**  Content that looks like HTML tags is treated
   as literal text and must be emitted in escaped form (e.g., `&lt;`, `&gt;`).

4. **Inline nesting is forbidden.**  Inline spans (bold, italic, code) may not
   contain other inline spans.  The first recognized opening delimiter opens the
   span; the next matching delimiter closes it.  Any delimiter characters that
   would open a nested span are treated as literals.

5. **Block-local metadata applies only to the immediately preceding block.**  A
   metadata annotation placed after a block modifies that block and no others.

6. **URLs must be HTTPS unless a warning-only compatibility rule says otherwise.**
   An `http://` URL produces a `URL_NOT_HTTPS` warning but is still rendered.
   Any other non-HTTPS scheme produces an `INVALID_URL_SCHEME` error and the
   anchor is replaced by its link-text as plain text.

7. **Invalid syntax produces diagnostics and safe fallback output.**  The parser
   never halts on malformed input.  Each error or warning is recorded as a
   structured diagnostic (see §10) and rendering continues with a safe fallback.

8. **Unspecified behavior is reserved for v2.0.**  Any construct not described
   in this specification must be treated as an error with a `RESERVED_SYNTAX`
   diagnostic and rendered using the plain-text fallback.

---

## 3. Document Structure

A Blogable document consists of an optional **front matter** section followed by
the **body**.

```
document     = [ front-matter ] body
front-matter = "---" LF 1*( fm-field LF ) "---" LF
body         = *block
```

Line endings MUST be LF (`U+000A`).  CRLF sequences (`U+000D U+000A`) are
normalized to LF before parsing begins.  Bare CR (`U+000D`) is likewise
normalized to LF.  A document with no front matter delimiter begins directly
with the body.

---

## 4. Front Matter

Front matter is a YAML-lite key/value section delimited by lines containing
exactly three hyphens (`---`).

### 4.1 Grammar

```
front-matter = "---" LF 1*( fm-field LF ) "---" LF
fm-field     = fm-key ":" SP fm-value
fm-key       = 1*( ALPHA / DIGIT / "_" / "-" )
fm-value     = *( VCHAR / SP )   ; stripped of leading/trailing whitespace
```

### 4.2 Rules

- **Keys** are case-insensitive ASCII identifiers composed of letters, digits,
  underscores, and hyphens.  Implementations must normalize keys to lowercase.
- **Values** are the remainder of the line after the colon and a single space.
  Leading and trailing whitespace is stripped from the value.
- **Duplicate keys** produce a `DUPLICATE_FM_KEY` warning.  The last occurrence
  of the key wins.
- **Malformed lines** (no colon, empty key, missing space after colon, etc.)
  produce a `MALFORMED_FM_LINE` error.  The line is skipped.
- Front matter fields do **not** affect body rendering in this version unless a
  specific field is documented in §4.3.

### 4.3 Standard Fields

| Key       | Type           | Description                                                  |
|-----------|----------------|--------------------------------------------------------------|
| `title`   | string         | Document title.  Renderers may use this as an implicit h1.  |
| `date`    | ISO 8601 date  | Publication date, **date only** (`YYYY-MM-DD`).  Time components are not permitted. |
| `author`  | string         | Author name.                                                 |
| `lang`    | BCP 47 tag     | Language tag (e.g., `en`, `ja`).  Defaults to `en`.         |
| `version` | string         | Spec version this document targets (e.g., `1.1-alpha`).     |

---

## 5. Body Blocks

The body is a sequence of **blocks** separated by one or more blank lines.
Each block is rendered independently in the order it appears.

### 5.1 Block-Type Summary

| Block type                          | Opening token                         |
|-------------------------------------|---------------------------------------|
| Heading                             | `#` through `######` followed by SP  |
| Paragraph                           | Any other non-blank line              |
| Fenced code block                   | ` ``` ` (three back-ticks)           |
| Blockquote                          | `> ` (greater-than + space)           |
| Ordered list                        | `<digit>.` followed by SP             |
| Unordered list                      | `-`, `*`, or `+` followed by SP       |
| Self-description block (v1.1-alpha) | `:::` optionally followed by SD-type  |
| Thematic break                      | Exactly `---` with no other content   |

### 5.2 Headings

```
heading = 1*6"#" SP 1*VCHAR
```

- The number of `#` characters determines the heading level (`#` = h1,
  `##` = h2, …, `######` = h6).
- There must be exactly **one** space between the `#` sequence and the heading
  text.
- Heading text is rendered as plain text; inline formatting is **not** applied
  inside headings.
- A line beginning with seven or more `#` characters is treated as a paragraph
  with a `HEADING_LEVEL_EXCEEDED` warning.

### 5.3 Paragraphs

A paragraph is one or more consecutive non-blank lines that do not open another
block type.  Consecutive lines within a paragraph are joined with a single
space.  Inline formatting (§6) is applied to the concatenated text.

### 5.4 Fenced Code Blocks

```
fenced-code = fence-open *code-line fence-close
fence-open  = "```" [ info-string ] LF
fence-close = "```" LF
info-string = *VCHAR            ; typically a language identifier
code-line   = *( VCHAR / SP ) LF
```

- Content inside a fenced code block is **literal text**.  No inline formatting
  or block-type detection is performed inside the fence.
- The optional info-string on the opening fence is a language hint for syntax
  highlighters; it is not interpreted further by the parser.
- An unclosed fence at end-of-input produces an `UNCLOSED_CODE_FENCE` error.
  The accumulated content is still emitted as a code block.
- Code fences **cannot** be nested.

### 5.5 Blockquotes

```
blockquote = 1*bq-line
bq-line    = "> " *( VCHAR / SP ) LF
```

- Every line of a blockquote must begin with `"> "` (greater-than sign followed
  by a single space).
- Lines are stripped of the `"> "` prefix and the resulting text is joined as
  a single paragraph with inline formatting applied.
- Nested blockquotes are **not** supported.  A line beginning with `> > ` (two
  or more `> ` prefixes) produces a `NESTED_BLOCKQUOTE` warning; the extra
  `> ` sequences are treated as literal text after the first prefix is stripped.

### 5.6 Thematic Breaks

A line whose trimmed content is exactly `---` (three hyphens, nothing else) is
a thematic break and renders as a horizontal rule.  This token is distinct from
the front matter delimiter, which only appears before the body begins.

---

## 6. Inline Formatting

Inline formatting is applied within paragraphs and blockquotes.  Inline spans
may **not** nest (Design Principle 4).

| Delimiter    | Span type       |
|--------------|-----------------|
| `**text**`   | Bold (strong)   |
| `*text*`     | Italic (emphasis)|
| `` `code` `` | Inline code     |

### 6.1 Rules

- A span opens at the first recognized delimiter and closes at the next
  identical closing delimiter **on the same line**.
- If no closing delimiter is found before the end of the line, the opening
  delimiter is emitted as a literal character and an `UNCLOSED_INLINE_SPAN`
  warning is recorded.
- Inline formatting does **not** apply inside fenced code blocks or inline code
  spans.
- Inline nesting is **forbidden**: a second opening delimiter encountered while
  a span is already open produces a `NESTED_INLINE_SPAN` error; the inner
  delimiter is emitted as a literal character.

---

## 7. List Handling

### 7.1 Unordered Lists

```
ul-block  = 1*ul-item
ul-item   = ul-marker SP 1*( VCHAR / SP ) LF
ul-marker = "-" / "*" / "+"
```

- All items in a single list block must use the **same** marker character.
  Mixing marker characters within one block produces a `MIXED_LIST_MARKERS`
  warning; the first marker encountered in the block is canonical.
- Inline formatting applies to each item's text.
- Nested lists are **not** supported.  A line whose list marker is preceded by
  at least one space or tab character produces a `NESTED_LIST` warning; the
  line is treated as a continuation of the previous item's text.

### 7.2 Ordered Lists

```
ol-block = 1*ol-item
ol-item  = DIGIT "." SP 1*( VCHAR / SP ) LF
```

- The digit before the period is a **display hint** only; a renderer may ignore
  it and substitute a sequential counter.
- Inline formatting applies to each item's text.
- Mixing ordered (`DIGIT "."`) and unordered (§7.1) markers in the same block
  produces a `MIXED_LIST_TYPES` error; the block is rendered as a sequence of
  plain paragraphs.

### 7.3 Block-Local Metadata

A metadata line may follow any block to annotate it:

```
block-meta = "{" meta-key ":" SP meta-value "}"
meta-key   = 1*( ALPHA / DIGIT / "_" / "-" )
meta-value = *( VCHAR / SP )
```

- Block-local metadata applies **only** to the immediately preceding block
  (Design Principle 5).
- A metadata line that is not preceded by a block produces a
  `ORPHAN_BLOCK_META` warning and is ignored.
- Unrecognized meta-keys produce an `UNKNOWN_META_KEY` warning; the annotation
  is accepted but has no rendering effect.

---

## 8. Anchor Handling

Hyperlinks use the following inline syntax:

```
anchor    = "[" link-text "]" "(" url ")"
link-text = 1*( VCHAR / SP )   ; must not contain "]"
url       = scheme "://" host path
```

### 8.1 URL Rules

1. **HTTPS preferred.**  A URL beginning with `https://` is valid without
   warning.
2. **HTTP compatibility.**  A URL beginning with `http://` produces a
   `URL_NOT_HTTPS` warning.  The link is still rendered.
3. **Other schemes.**  Any other scheme produces an `INVALID_URL_SCHEME` error.
   The anchor is replaced by its `link-text` rendered as plain text.
4. **No network access.**  The parser must not resolve or validate the host or
   path.  URL validation is purely lexical.
5. **Empty link-text.**  An anchor whose `link-text` is empty produces an
   `EMPTY_LINK_TEXT` warning; the URL string is used as the display text
   instead.
6. **Malformed anchors.**  Missing closing `)`, mismatched brackets, or other
   structural errors produce a `MALFORMED_ANCHOR` error; the entire anchor
   source text is emitted as escaped plain text.

---

## 9. Self-Description Blocks

A self-description block is a metadata-carrying fence, new in v1.1-alpha.

```
self-desc    = sd-open *sd-meta-line sd-close
sd-open      = ":::" [ SD-type ] LF
sd-close     = ":::" LF
SD-type      = 1*( ALPHA / DIGIT / "_" / "-" )
sd-meta-line = fm-key ":" SP fm-value LF
```

### 9.1 Semantics

- The optional **SD-type** on the opening `:::` names the kind of block (e.g.,
  `note`, `warning`, `aside`).  If omitted the block has no type.
- Each `sd-meta-line` inside the fence sets a key/value pair local to this
  block.  The same key and value rules as front matter (§4.2) apply.
- Metadata inside a self-description block is **block-local** and does not
  affect any other block (Design Principle 5).
- An unclosed self-description fence at end-of-input produces an
  `UNCLOSED_SELF_DESC` error; any accumulated metadata is discarded.
- An unknown SD-type produces an `UNKNOWN_SD_TYPE` warning; the block is still
  rendered.

### 9.2 Standard SD-Types

| Type      | Rendering hint         |
|-----------|------------------------|
| `note`    | Informational aside    |
| `warning` | Cautionary content     |
| `tip`     | Helpful suggestion     |
| `aside`   | Supplemental content   |

---

## 10. Diagnostics and Error Handling

Every diagnostic produced by the parser has the following structure:

| Field      | Type                    | Description                                               |
|------------|-------------------------|-----------------------------------------------------------|
| `code`     | string                  | Machine-readable error code (e.g., `URL_NOT_HTTPS`).     |
| `severity` | `"error"` / `"warning"` | Errors and warnings both allow parsing to continue.       |
| `line`     | integer                 | 1-based line number where the issue was detected.         |
| `column`   | integer                 | 1-based column (character offset within the line).        |
| `message`  | string                  | Human-readable description of the problem.                |

The parser **never halts** on a diagnostic.  All errors and warnings produce
a safe fallback in the rendered output and are collected for the caller.

### 10.1 Diagnostic Code Reference

| Code                      | Severity  | Trigger                                                                          |
|---------------------------|-----------|----------------------------------------------------------------------------------|
| `MALFORMED_FM_LINE`       | error     | Front matter line without valid `key: value` format.                             |
| `DUPLICATE_FM_KEY`        | warning   | The same key appears more than once in front matter.                             |
| `HEADING_LEVEL_EXCEEDED`  | warning   | Heading marker has more than six `#` characters.                                 |
| `UNCLOSED_CODE_FENCE`     | error     | A code fence was open at end-of-input.                                           |
| `NESTED_BLOCKQUOTE`       | warning   | `"> "` found inside an already-open blockquote.                                  |
| `UNCLOSED_INLINE_SPAN`    | warning   | Inline span delimiter was not closed before end of line.                         |
| `NESTED_INLINE_SPAN`      | error     | An inline span was opened while another span was already open.                   |
| `MIXED_LIST_MARKERS`      | warning   | Unordered list items use different marker characters.                            |
| `MIXED_LIST_TYPES`        | error     | Ordered and unordered items were mixed in the same list block.                   |
| `NESTED_LIST`             | warning   | An indented list marker was found inside a list block.                           |
| `ORPHAN_BLOCK_META`       | warning   | A block-local metadata line is not preceded by a block.                          |
| `UNKNOWN_META_KEY`        | warning   | A block-local metadata key is not recognized.                                    |
| `URL_NOT_HTTPS`           | warning   | Link URL uses `http://` scheme.                                                  |
| `INVALID_URL_SCHEME`      | error     | Link URL uses a scheme other than `https://` or `http://`.                       |
| `EMPTY_LINK_TEXT`         | warning   | Anchor has empty link-text.                                                      |
| `MALFORMED_ANCHOR`        | error     | Anchor syntax is structurally malformed.                                         |
| `UNCLOSED_SELF_DESC`      | error     | A self-description block was open at end-of-input.                               |
| `UNKNOWN_SD_TYPE`         | warning   | SD-type is not in the standard list (§9.2).                                      |
| `RESERVED_SYNTAX`         | error     | Construct is not defined in this specification (reserved for v2.0).              |

---

## 11. Reserved Features

The following constructs are explicitly **reserved for v2.0**.  Encountering
them produces a `RESERVED_SYNTAX` error; the fallback is to emit the offending
source text as escaped plain text.

- HTML blocks and inline HTML tags
- Nested inline formatting
- Nested lists
- Table syntax
- Definition lists
- Footnotes and reference-style links
- Extended front matter types (arrays, nested objects, multi-line values)
- Custom inline extensions
