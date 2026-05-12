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
  FrontKey , ":" , SP , TEXT , NL ;

FrontKey =
    "title"
  | "author"
  | "date"
  | "updated"
  | "description"
  | "tags"
  | "slug"
  | "draft"
  | "lang"
  | "x-" , { LOWER | DIGIT | "-" } ;
```

**FrontMatter**

Front matter is parsed and preserved as metadata, but it does not alter core body rendering.

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
ParaBlock = ": " , InlineText , NL , { Meta } ;
```

**ParaBlock**

An explicit paragraph begins with `: ` (colon + space) and accepts trailing metadata modifiers.
The `: ` prefix is stripped from output.

---

## Horizontal Rule

```ebnf
HorizontalRule = "---" , NL ;
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

**ImageURL**

An ImageURL is a UrlBlock whose path ends with one of the allowed image extensions.

Allowed extensions:
- png
- jpg
- jpeg
- gif
- webp

SVG MUST NOT be treated as an image.

---

## Lists

```ebnf
ListBlock = { ListItem } , { Meta } ;

ListItem = IndentLevel , ( ULItem | OLItem | TaskItem | DLItem ) ;

IndentLevel = { INDENT } ;

ULItem   = "- " , InlineText , NL ;
OLItem   = "# " , InlineText , NL ;
TaskItem = "[" , ( " " | "x" ) , "]" , SP , InlineText , NL ;

DLItem   = ":=" , SP , Term , NL , DD ;

Term = InlineText ;
DD   = Paragraph , { Paragraph } ;
```

**ListBlock**

A ListBlock contains one item type at a time.
Indentation must use spaces only and must advance in multiples of two spaces.
List blocks split when the item type changes, a blank line appears, or a non-list block appears.
Definition-list terms are unique across the document.

---

## Inline Syntax

```ebnf
InlineText = { Inline } ;

Inline = Code
       | Link
       | Footnote
       | AnchorRef
       | Strong
       | Emphasis
       | Delete
       | Insert
       | Plain ;

Code      = "`" , { CodeChar } , "`" ;
CodeChar  = ? any character except "`" and NL ? ;

Link      = "[" , HTTPS_URL , SP , TEXT , "]" ;
Footnote  = "[^" , TEXT , "]" ;
AnchorRef = "[#" , ID , "]" ;

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
Code, Link, Footnote, AnchorRef, Strong, Emphasis, Delete, Insert.
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

| Code | Kind | Trigger and Guidance |
|------|------|----------------------|
| E201 | Error | A front matter key is not in the allowed list and is not an `x-*` custom key. Allowed keys: `title`, `author`, `date`, `updated`, `description`, `tags`, `slug`, `draft`, `lang`. For custom metadata use the `x-*` prefix, e.g. `x-series: Getting Started`. |
| E202 | Error | A modifier key is not one of the built-in keys (`class`, `id`, `title`, `cite`, `author`, `alt`) and does not match `x-*`. For custom data attributes write `x-<name>` (e.g. `@[x-role: note]`), which renders as `data-<name>="…"`. Modifier syntax: `@[key: value]` on the line immediately after the block, with no blank line between them. |
| E401 | Error | A list item's leading spaces are not a multiple of two. Use 0 spaces for a top-level item, 2 for one level of nesting, 4 for two levels, and so on. Example: `- top`, `  - nested`, `    - deeper`. |
| E402 | Error | More than 6 colons were used for a heading. HTML only supports h1–h6, so the maximum is 6 colons. Use 2–6 colons: `:: h2`, `::: h3`, `:::: h4`, `::::: h5`, `:::::: h6`. |
| E403 | Error | A `:=` term has no following body paragraph. A DefinitionBlock requires at least one paragraph (DD) on the line(s) immediately after the `:= Term` line. Example: `:= Term` followed by `The explanation goes here.` |
| W601 | Warning | `[#id]` references an anchor that does not exist earlier in the document. Add a standalone `[#id]` anchor block on its own line to create the target, or ensure the heading text slugifies to the expected id. |
| W201 | Warning | A line inside `@@ … @@` does not match `key: value` format. Keys must start with a lowercase letter and contain only lowercase letters, digits, and hyphens. Example: `title: My Blog Post`. |
| W202 | Warning | A `@@` front matter block was opened but the document ended before the closing `@@`. The correct form is `@@` / one or more `key: value` lines / `@@`. |
| W001 | Warning | A code block was opened with `#!lang` but no closing `!#` line was found before EOF. Every code block must end with `!#` on its own line. Replace `lang` with the language name (e.g. `bash`, `python`, `javascript`). |
| W002 | Warning | A block quote was opened with `\|>` but no closing `<\|` line was found before EOF. Every block quote must end with `<\|` on its own line. Optionally follow the closing `<\|` with `@[author: Name]` or `@[cite: https://…]`. |
| W003 | Warning | A math block was opened with `$$` but no second `$$` line was found before EOF. Every math block must end with `$$` on its own line. |
| W401 | Warning | The same `:= term` appears more than once in the document (comparison is case-insensitive). Merge the two definitions or rename one term to make them distinct. |
| W801 | Warning | A `@[key: value]` modifier was not directly attached to a block. Modifiers must appear on the line immediately after a heading, `: ` paragraph, list, blockquote, code block, math block, definition block, or image — with no blank line between them. Plain text paragraphs need the `: ` prefix to accept a modifier. |

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
