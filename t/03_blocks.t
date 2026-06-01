use strict;
use warnings;
use utf8;
use open ':std', ':utf8';
use Test::More;
use lib 'lib';
use Text::Blogable;

sub p { Text::Blogable->new->parse(@_) }
sub b { Text::Blogable->new }

# §CodeBlocks

my $html = p("#!javascript\nconsole.log(\"hi\");\n!#");
like $html, qr/class="language-javascript"/, 'code block has detected language class';
like $html, qr/console\.log/,               'code block contains source text';

# code block has no inline parsing (** is literal)
$html = p("#!text\n**not bold**\n!#");
unlike $html, qr/<strong>/, 'code block: ** is literal, not bold';
like   $html, qr/\*\*not bold\*\*/, 'code block: ** appears verbatim';

# \!# inside a code block renders as literal !#
$html = p("#!text\n\\!#\n!#");
like $html, qr/!#/, 'escaped \\!# renders as literal !#';

# code block with @[title: ...] shows title in figcaption
$html = p("#!python\npass\n!#\n\@[title: My Script]");
like $html, qr/My Script/, 'code block @[title:] appears in figcaption';

# code block with @[cite: https://...] renders cite link
$html = p("#!bash\necho hi\n!#\n\@[cite: https://example.com]");
like $html, qr/<cite>/, 'code block @[cite:] renders <cite>';
like $html, qr/example\.com/, 'code block @[cite:] shows hostname';

# #!blogable block
like p("#!blogable\n:: heading\n!#"), qr/language-blogable/, '#!blogable renders with lang="blogable"';

# #!ebnf block
like p("#!ebnf\nRule = \"x\" ;\n!#"), qr/language-ebnf/, '#!ebnf renders with lang="ebnf"';

# #!perl block
$html = p("#!perl\nprint \"Hello, World!\\n\";\n!#");
like $html, qr/language-perl/,  '#!perl has language-perl class';
like $html, qr/Hello, World!/,  '#!perl contains code text';

# #!/usr/bin/perl shebang
$html = p("#!/usr/bin/perl\nuse strict;\n!#");
like $html, qr/language-perl/, '#!/usr/bin/perl shebang → perl';
like $html, qr/use strict/,    '#!/usr/bin/perl shebang: code text present';

# #!/usr/bin/env perl shebang
like p("#!/usr/bin/env perl\nuse warnings;\n!#"), qr/language-perl/, '#!/usr/bin/env perl shebang → perl';

# $# inside perl code block is literal (not block close)
$html = p("#!perl\nmy \@arr = (1, 2, 3);\nprint \$#arr;\n!#");
like $html, qr/language-perl/, 'perl code block: $# is literal code, not a close';
like $html, qr/\$#arr/,        'perl code block: $#arr appears verbatim';

# #!python block
$html = p("#!python\nprint(\"hello\")\n!#");
like $html, qr/language-python/, '#!python has language-python class';
like $html, qr/print/,           '#!python contains code text';

# #!/usr/bin/python3 shebang
$html = p("#!/usr/bin/python3\nimport sys\n!#");
like $html, qr/language-python/, '#!/usr/bin/python3 shebang → python';
like $html, qr/import sys/,      '#!/usr/bin/python3 shebang: code text present';

# #!bash block
$html = p("#!bash\necho \"hello\"\n!#");
like $html, qr/language-bash/, '#!bash has language-bash class';
like $html, qr/echo/,          '#!bash contains code text';

# #!sh normalises to bash
like p("#!sh\necho \"hi\"\n!#"), qr/language-bash/, '#!sh normalises to lang="bash"';

# #!zsh normalises to bash
like p("#!zsh\necho \"zsh\"\n!#"), qr/language-bash/, '#!zsh normalises to lang="bash"';

# #!/bin/bash shebang
$html = p("#!/bin/bash\nset -e\n!#");
like $html, qr/language-bash/, '#!/bin/bash shebang → bash';
like $html, qr/set -e/,        '#!/bin/bash shebang: code text present';

# #!go block
$html = p("#!go\npackage main\n!#");
like $html, qr/language-go/,   '#!go has language-go class';
like $html, qr/package main/,  '#!go contains code text';

# §QuoteBlocks

# inline blockquote
$html = p('> This is a quote.');
like $html, qr/<blockquote><p>/, 'inline blockquote renders <blockquote><p>';
like $html, qr/This is a quote\./, 'inline blockquote contains text';

# block blockquote
$html = p("|>\nLine one.\nLine two.\n<|");
like $html, qr/<blockquote>/, 'block blockquote renders <blockquote>';
like $html, qr/Line one\./,   'block blockquote contains text';

# block quote with @[author: ...] renders author in footer
$html = p("|>\nSome text.\n<|\n\@[author: Alice]");
like $html, qr/Alice/, 'block quote @[author:] renders author';
like $html, qr/<footer>/, 'block quote @[author:] adds <footer>';

# block quote with @[cite: https://...]
$html = p("|>\nSome text.\n<|\n\@[cite: https://example.com]");
like $html, qr/<cite>/,       'block quote @[cite:] renders <cite>';
like $html, qr/example\.com/, 'block quote @[cite:] shows hostname';

# inline parsing enabled inside quote blocks
$html = p("|>\n**bold text**\n<|");
like $html, qr/<strong>bold text<\/strong>/, 'quote block supports inline **bold**';

# blank line inside |>…<| separates paragraphs
$html = p("|>\nFirst para.\n\nSecond para.\n<|");
my @ps = ($html =~ /(<p>)/g);
ok scalar(@ps) >= 2, 'blank line inside quote block creates separate paragraphs';

# §MathBlocks

$html = p("\$\$\nE = mc^2\n\$\$");
like   $html, qr/<pre class="math-block"><code>/, 'math block renders <pre class="math-block"><code>';
like   $html, qr/E = mc\^2/,                      'math block contains formula';
like   $html, qr/<\/code><\/pre>/,                 'math block ends with </code></pre>';

# math block content is HTML-escaped
$html = p("\$\$\n<script>alert(1)</script>\n\$\$");
unlike $html, qr/<script>/i, 'math block: <script> is escaped';
like   $html, qr/&lt;script&gt;/, 'math block: & escaped';

# inline parsing disabled inside math blocks
$html = p("\$\$\n**not bold**\n\$\$");
unlike $html, qr/<strong>/, 'math block: ** is not parsed as bold';

done_testing;
