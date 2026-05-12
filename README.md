---
title: Blogable Bootstrap EBNF
author: worthmine(Yuki Yoshida)
description: Bootstrap EBNF grammar and parser constraint reference for Blogable v1.1-alpha
slug: blogable-bootstrap-ebnf
---

# Blogable Bootstrap EBNF

**Blogable**

Blogable is a deterministic, single-pass markup language with semantic output and strict diagnostics.
Blogable prioritizes deterministic parsing, semantic structure, and secure rendering over maximal syntax flexibility.

---

## Scope

**Scope**

This document defines the bootstrap EBNF for Blogable v1.1-alpha.

---

## Goals

**Goals**

For v1.0-frozen, the core priorities are fixed in this order:

- Deterministic parsing
- Single-pass processing
- Secure rendering

Convenience features MUST NOT take precedence over these core goals.

---

## Non-Goals

**Non-Goals**

The core specification excludes behavior that depends on external state or the network.

In particular, the following are non-goals for v1.0-frozen core:

- OGP fetching
- link unfurling
- outbound URL validation
- HEAD/GET metadata retrieval
- preview card generation
- external content embedding

Such behavior MAY exist only as an optional implementation extension.

---

## Lexical Elements

```ebnf
NL        = "\n" ;
WS        = " " | "\t" ;
SP        = " " ;
INDENT    = SP , SP ;
DIGIT     = "0"…"9" ;
LOWER     = "a"…"z" ;
UPPER     = "A"…"Z" ;
ALNUM     = LOWER | UPPER | DIGIT ;
TEXT      = { ANY - NL } ;
HTTPS_URL = "https://" , { ANY - WS - NL } ;
ID        = { ALNUM | "-" } ;
```

---

## Document Structure

```ebnf
Document = [ FrontMatterBlock ] , { Block } ;

Block = Heading
      | Paragraph
      | ParaBlock
      | ListBlock
      | CodeBlock
      | BlogableBlock
      | EbnfBlock
      | QuoteBlock
      | MathBlock
      | UrlBlock
      | HorizontalRule
      | InternalAnchorBlock
      | DefinitionBlock ;
```

---

## Front Matter

```ebnf
FrontMatterBlock =
  "@@" , NL ,
  { FrontMetaLine } ,
  "@@" , NL ;

FrontMetaLine =
  ( FrontKey , ":" , SP , TEXT
  | YAMLCommentLine ) , NL ;

YAMLCommentLine = "#" , TEXT ;

FrontKey =
    "title"
  | "author"
  | "date"
  | "updated"
  | "description"
  | "tags"
  | "slug"
  | "lang"
  | "x-" , { LOWER | DIGIT | "-" } ;
```

**FrontMatter**

Front matter is parsed and preserved as metadata, but it does not alter core body rendering.
Front matter follows a commentable YAML-style line format (`# ...` comment lines are allowed).

---

## Headings

```ebnf
Heading = "::" , { ":" } , SP , InlineText , NL ;
```

**Heading**

Heading levels are determined by the number of leading colons.
The level range is h2 through h6.

---

## Paragraphs

```ebnf
Paragraph = InlineLine , { InlineLine } , NL ;
InlineLine = InlineText , NL ;
```

**Paragraph**

Paragraphs are separated by blank lines or by the start of a recognized block.
Plain paragraphs do not accept metadata modifiers.

---

## Explicit Paragraphs

```ebnf
ParaBlock = ":" , SP , InlineText , NL , { Meta } ;
```

**ParaBlock**

An explicit paragraph begins with `: ` (colon + space) and accepts trailing metadata modifiers.
The `: ` prefix is stripped from output.

---

## Horizontal Rule

```ebnf
HorizontalRule = "---" , { "-" } , NL ;
```

---

## Code Blocks

```ebnf
CodeBlock =
  "#!" , LangTag , NL ,
  { CodeLine , NL } ,
  "!#" , NL ,
  { Meta } ;

LangTag    = LangName | ShebangPath ;
LangName   = WORD ;
ShebangPath = "/" , PATH ;
CodeLine = TEXT ;
```

**CodeBlock**

Code blocks are literal regions.
Inline parsing is disabled inside code blocks.
A line beginning with `\!#` MUST be treated as a literal `!#`.

The opener `#!<lang>` sets the `language-<lang>` class on the rendered block.
A native shebang line (`#!/path/to/interpreter` or `#!/usr/bin/env <cmd>`) is also accepted as a block opener; the interpreter name is mapped to a canonical language class via the shebang map.
`copy` (copy-all) excludes the shebang opener by default.
Clicking a line number copies that exact line, including the shebang line when clicked.

Recognised language tags and shebang aliases:

| Language class | `#!` tags | Accepted shebang commands |
|---|---|---|
| `javascript` | `javascript`, `node`, `nodejs` | — |
| `python` | `python`, `python2`, `python3` | `python3`, `python`, `env python`, `env python3` |
| `ruby` | `ruby` | — |
| `perl` | `perl` | `perl`, `env perl` |
| `bash` | `bash`, `sh`, `zsh` | `bash`, `sh`, `zsh`, `env bash`, `env zsh` |
| `php` | `php` | — |
| `lua` | `lua` | — |
| `rust` | `rust` | — |
| `go` | `go` | — |
| `swift` | `swift` | `swift`, `env swift` |
| `text` | `text` | — |
| *(any)* | any other tag | — |

---

## Blogable Blocks

```ebnf
BlogableBlock =
  "#!blogable" , NL ,
  { CodeLine , NL } ,
  "!#" , NL ,
  { Meta } ;
```

**BlogableBlock**

Blogable blocks present Blogable syntax literally.
No re-parse is performed inside the block.
BlogableBlock uses the same opener/closer, literal-content, and copy behavior as CodeBlock, with fixed language tag `blogable`.

---

## EBNF Blocks

```ebnf
EbnfBlock =
  "#!ebnf" , NL ,
  { CodeLine , NL } ,
  "!#" , NL ,
  { Meta } ;
```

**EbnfBlock**

Ebnf blocks present grammar definitions literally.
No re-parse is performed inside the block.
EbnfBlock uses the same opener/closer, literal-content, and copy behavior as CodeBlock, with fixed language tag `ebnf`.

---

## Quote Blocks

```ebnf
QuoteBlock =
  "|>" , NL ,
  { QuoteLine , NL } ,
  "<|" , NL ,
  { Meta } ;

QuoteLine = TEXT ;
```

**QuoteBlock**

Quote blocks render as blockquote structures.
Internal text is parsed as paragraphs.
Inline parsing is enabled inside quote text.

---

## Math Blocks

```ebnf
MathBlock =
  "$$" , NL ,
  { MathLine , NL } ,
  "$$" , NL ,
  { Meta } ;

MathLine = TEXT ;
```

**MathBlock**

Math blocks are opaque to the core parser.
Inline parsing is disabled inside math blocks.

---

## URLs

```ebnf
UrlBlock = HTTPS_URL , NL , { Meta } ;
```

**UrlBlock**

A UrlBlock is a standalone body line that begins with an HTTPS URL.
Inline URLs MUST NOT auto-link.

For non-image UrlBlock rendering, the visible link label MUST be derived only from the URL itself.
The reference renderer uses the hostname as the deterministic core label.
Fetched metadata or application-supplied replacement labels are outside the core specification.

---

## Images

Images MUST be embedded using ObsidianEmbed syntax only.
Standalone external image URLs are NOT rendered as images; they are treated as regular autolinks.

---

## ObsidianEmbed

```ebnf
ObsidianEmbed = "![[" , PATH , [ "|" , TEXT ] , "]]" , NL , { Meta } ;
```

**ObsidianEmbed**

An ObsidianEmbed is a standalone block line beginning with `![[`.
It embeds a local image file referenced by PATH.
An optional display alt text follows the path after `|`.
It renders as a `<figure>` with an `<img>` element.
SVG files are supported.

---

## ExternalEmbed

```ebnf
ExternalEmbedBlock = ExternalEmbed , NL , { Meta } ;
ExternalEmbed      = "!!" , HTTPS_URL , [ ( "|" | SP ) , TEXT ] , "!!" ;
```

**ExternalEmbed**

ExternalEmbed embeds or links an external resource identified by an HTTPS URL.
It may appear inline within a paragraph, or as a standalone block line.
The resource type is inferred from the URL:

- **Image** (`.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.svg`) — renders as `<figure><img>`.
- **Video** (`.mp4`, `.webm`, `.ogg`, `.ogv`, `.mov`) — renders as `<figure><video>`.
- **Other** — renders as an external link `<a rel="noopener noreferrer" target="_blank">`.

The optional TEXT after `|` or a space (SP) is used as alt text (for images/video) or link label.
Both `!!URL|alt text!!` and `!!URL alt text!!` are equivalent.
Since valid URLs cannot contain spaces, a space is unambiguous as a separator.
When inline, ExternalEmbed always renders as an external link regardless of media type.
Only `https://` URLs are accepted; other schemes are output as escaped plain text.

The three resource types are strictly partitioned:

| Construct | Syntax | Scope |
|-----------|--------|-------|
| ObsidianLink | `[[path\|display]]` | Local links |
| ObsidianEmbed | `![[path\|alt]]` | Local image/video embeds |
| ExternalEmbed | `!!URL\|alt!!` or `!!URL alt!!` | External links, images, and videos |

---

## Lists

```ebnf
ListBlock = { ListItem } , { Meta } ;

ListItem = IndentLevel , ( ULItem | OLItem | TaskItem | DLItem ) ;

IndentLevel = { INDENT } ;

ULItem   = "- " , InlineText , NL ;
OLItem   = "# " , InlineText , NL ;
TaskItem = "[" , ( " " | "x" ) , "]" , SP , InlineText , NL ;

DLItem   = "?" , SP , Term , NL , DDItem , { DDItem } ;
DDItem   = "=" , SP , InlineText , NL ;

Term = InlineText ;
```

**ListBlock**

A ListBlock contains one item type at a time.
Indentation must use spaces only and must advance in multiples of two spaces.
List blocks split when the item type changes, a blank line appears, or a non-list block appears.
`?` / `=` DLItem is casual definition-list markup for list usage and is distinct from `:=` DefinitionBlock grammar.
Each `? term` MUST be immediately paired with one or more following `= ` lines.
Casual DL (`?` / `=`) is top-level only and MUST NOT be nested inside other lists.

---

## Inline Syntax

```ebnf
InlineText = { Inline } ;

Inline = Code
       | ExternalEmbed
       | Footnote
       | ObsidianAnchor
       | ObsidianLink
       | Strong
       | Emphasis
       | Delete
       | Insert
       | Plain ;

Code         = "`" , { CodeChar } , "`" ;
CodeChar     = ? any character except "`" and NL ? ;

ExternalEmbed = "!!" , HTTPS_URL , [ "|" , TEXT ] , "!!" ;
Footnote  = "[^" , TEXT , "]" ;
ObsidianAnchor = "[[" , "#" , HEADING , "]]" ;
ObsidianLink   = "[[" , PATH , [ "#" , HEADING ] , [ "|" , TEXT ] , "]]" ;

Strong    = "**" , { StrongChar } , "**" ;
StrongChar = ? any character except "*" and NL ? ;

Emphasis    = "*" , { EmphasisChar } , "*" ;
EmphasisChar = ? any character except "*" and NL ? ;

Delete    = "~~" , { DeleteChar } , "~~" ;
DeleteChar = ? any character except "~" and NL ? ;

Insert    = "++" , { InsertChar } , "++" ;
InsertChar = ? any character except "+" and NL ? ;

Plain = { ANY - NL } ;
```

**InlineSyntax**

Inline elements MUST NOT nest.
Inline evaluation order is:
Code, ExternalEmbed, Footnote, ObsidianAnchor, ObsidianLink, Strong, Emphasis, Delete, Insert.
Inline code has no escape syntax.

---

## Internal Anchors

```ebnf
InternalAnchorBlock = "[#" , TEXT , "]" , NL ;
```

**InternalAnchor**

Internal anchors reference headings by label.
Unresolved references produce a warning.

---

## Definitions

```ebnf
DefinitionBlock = ":=" , SP , Term , NL , DD , { Meta } ;
```

**DefinitionBlock**

Definition blocks behave as list items in the DL system.
The definition body is one or more paragraphs.
Definition-list terms are unique across the document.
Each `:= term` generates a unique slug id and keeps it on the rendered term heading (`<dt id="..."><a href="#...">…</a></dt>`).
DefinitionBlock (`:=`) is top-level only and MUST NOT be nested inside lists.

---

## Metadata

```ebnf
Meta = "@[" , MetaKey , ":" , SP , TEXT , "]" , NL ;

MetaKey =
    "class"
  | "id"
  | "title"
  | "cite"
  | "author"
  | "alt"
  | "x-" , { LOWER | DIGIT | "-" } ;
```

**Meta**

Block-local metadata applies only to the immediately preceding block.
Metadata does not cross blank lines.

---

## Extension Points

**Extension Points**

`x-*` keys are the standardized extension slot for front matter and block metadata.

Extensions MUST preserve the core parse rules, diagnostics, and security guarantees for the same input.
Extensions MAY add UI enhancements, label completion, or preview generation, but they are not part of core conformance.

---

## Parsing Model

**Parsing**

Parsing proceeds in three stages:
1. Block recognition
2. Inline parsing
3. Post-processing for anchors and diagnostics

---

## Diagnostics

**Diagnostics**

The parser produces diagnostics with fixed codes.
Errors invalidate the construct and fall back safely.
Warnings notify without stopping rendering.

| Code | Kind | Trigger |
|------|------|---------|
| E201 | Error | Unknown front matter key. Allowed: `title`, `author`, `date`, `updated`, `description`, `tags`, `slug`, `lang`; or `x-*` for custom metadata. |
| E202 | Error | Unknown modifier key. Built-in keys: `class`, `id`, `title`, `cite`, `author`, `alt`; or `x-<name>` for custom data attributes. |
| E401 | Error | List indentation is not a multiple of two. Use 0, 2, 4, … spaces for each nesting level. |
| E402 | Error | Heading depth exceeds h6. Use 2–6 colons: `:: h2` … `:::::: h6`. |
| E403 | Error | Definition term has no body. Add at least one paragraph after the `:= term` line. |
| W601 | Warning | `[#id]` — no heading or anchor with that id found. Add `[#id]` on its own line to create the target. |
| W201 | Warning | Malformed front matter line. Expected format: `key: value`. |
| W202 | Warning | Unterminated front matter: `@@` opened but closing `@@` not found before EOF. |
| W001 | Warning | Unterminated code block: `#!lang` opened but closing `!#` not found before EOF. |
| W002 | Warning | Unterminated block quote: `\|>` opened but closing `<\|` not found before EOF. |
| W003 | Warning | Unterminated math block: `$$` opened but closing `$$` not found before EOF. |
| W401 | Warning | Duplicate definition term. Terms must be unique (case-insensitive). |
| W801 | Warning | Orphaned modifier: not placed on the line immediately after a supported block. |

---

## Conformance Levels

**Conformance Levels**

**Core Conformant**

A Core Conformant implementation MUST produce the same AST, HTML, and diagnostics for the same input without external I/O.

**Optional Extension**

An Optional Extension MAY add implementation-defined behavior, but it MUST NOT override or weaken the core semantics, diagnostics, or security model.

**Demo / App Behavior**

Demo or application behavior is non-normative and is excluded from language conformance requirements.

---

## Security

**Security**

The core parser MUST not access the network.
The core parser MUST not accept raw HTML.
The core parser MUST not execute scripts.
Only HTTPS URLs are accepted by the strict core parser.
New core features SHOULD be accepted only when they avoid external state, preserve single-pass evaluation, and do not increase implementation divergence.

---

## Non-Normative Demo Behaviors

**Non-Normative Demo Behaviors**

The live demo MAY enhance URL labels for preview convenience.
Such behavior is informative only and MUST NOT redefine the core AST/HTML contract.

---

## Self-Hosting

```blogable
:: Blogable Bootstrap EBNF
:= Blogable
Blogable is a deterministic, single-pass markup language with semantic output and strict diagnostics.
```

---

## Conclusion

Blogable v1.1-alpha is deterministic, self-describing, and semantically stable.
