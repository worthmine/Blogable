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
| E001 | Error | Invalid front matter key (not in allowed list, not `x-*`) |
| E002 | Error | Unknown MetaKey in a modifier `@[key: value]` |
| E003 | Error | Invalid list indentation (odd number of leading spaces) |
| E004 | Error | Heading level out of range (more than 6 colons; maximum is h6) |
| E005 | Error | Definition block has no body text (DD is required by spec) |
| W001 | Warning | Unresolved internal anchor reference `[#id]` |
| W002 | Warning | Malformed front matter line (does not match `key: value` format) |
| W003 | Warning | Unterminated front matter block (EOF reached without closing `@@`) |
| W004 | Warning | Unterminated code block (EOF reached without closing `!#`) |
| W005 | Warning | Unterminated quote block (EOF reached without closing `<|`) |
| W006 | Warning | Unterminated math block (EOF reached without closing `$$`) |
| W007 | Warning | Duplicate definition term (same term defined more than once) |
| W008 | Warning | Orphaned modifier (not consumed by any block) |

---

## Security

**Security**

The core parser MUST not access the network.
The core parser MUST not accept raw HTML.
The core parser MUST not execute scripts.
Only HTTPS URLs are accepted by the strict core parser.

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

