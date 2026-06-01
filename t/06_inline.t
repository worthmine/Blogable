use strict;
use warnings;
use utf8;
use open ':std', ':utf8';
use Test::More;
use lib 'lib';
use Text::Blogable;

sub p { Text::Blogable->new->parse(@_) }
sub pb {
    my $b = Text::Blogable->new;
    my $h = $b->parse($_[0]);
    return ($h, $b->diagnostics);
}

# §InlineSyntax

# Code
like p('`hello`'), qr/<code>hello<\/code>/, 'backtick → <code>';
like p('``'),      qr/<code><\/code>/,       'empty backtick → <code></code>';

my $html = p('`<b>`');
like   $html, qr/&lt;b&gt;/, 'backtick content is HTML-escaped';
unlike $html, qr/<b>/,       'backtick content: raw <b> not in output';

# Newline inside backtick does NOT form a code span
$html = p("`line1\nline2`");
unlike $html, qr{<code>line1\nline2</code>}, 'newline inside backtick does not form code span';
like   $html, qr/`line1/, 'unclosed backtick rendered as plain text';

# ExternalEmbed inline (!!URL!!)
$html = p('!!https://example.com!!');
like $html, qr{<a href="https://example\.com"}, '!!URL!! → external link';
like $html, qr/rel="noopener noreferrer"/, '!!URL!! has rel attribute';
like $html, qr/target="_blank"/, '!!URL!! has target="_blank"';

# ExternalEmbed with label (!!url|label!!)
$html = p('!!https://example.com|Visit Example!!');
like $html, qr{<a href="https://example\.com"}, '!!url|label!! → link';
like $html, qr/Visit Example/, '!!url|label!! shows label';
like $html, qr/rel="noopener noreferrer"/, '!!url|label!! has rel attribute';

# ExternalEmbed http:// rejected
$html = p('!!http://example.com!!');
unlike $html, qr{<a href="http://}, '!!http://!! is not linked';

# Footnote
$html = p('^[ See note 1]');
like $html, qr/<sup>/, 'footnote renders <sup>';
like $html, qr/fn-1/,  'footnote has fn-1 id';

# Footnote URL
$html = p('^[https://example.com Example]');
like $html, qr/<sup>/,        'URL footnote renders <sup>';
like $html, qr/example\.com/, 'URL footnote includes hostname in output';

# Footnote URL hostname is HTML-escaped
$html = p('^[https://<img-src=x-onerror=alert(1)> Example]');
unlike $html, qr{<img-src=x-onerror=alert\(1\)>}, 'URL footnote hostname is not rendered as raw HTML';
like   $html, qr{&lt;img-src=x-onerror=alert\(1\)&gt;</a>}, 'URL footnote hostname is escaped in link text';

# Multiple footnotes numbered sequentially
$html = p('^[ First note] and ^[ Second note]');
like $html, qr/fn-1/, 'first footnote is fn-1';
like $html, qr/fn-2/, 'second footnote is fn-2';

# ObsidianAnchor: [[#heading-id]] resolves to in-page link when heading exists
$html = p(":: My Section\n\nSee [[#My Section]] for details.");
like $html, qr{<a href="#my-section" class="obsidian-anchor"}, 'ObsidianAnchor resolves known heading';

# ObsidianAnchor: [[#unknown]] emits W601 and renders plain text
my ($h, $diags) = pb('Read [[#nonexistent]] for more.');
ok scalar(grep { $_->{code} eq 'W601' } @$diags), 'unresolved ObsidianAnchor emits W601';
unlike $h, qr/<a /, 'unresolved ObsidianAnchor renders no link';

# ObsidianLink: [[path]]
$html = p('See [[other-page]] here.');
like $html, qr{<a href="other-page" class="obsidian-link">other-page</a>}, 'ObsidianLink renders link';

# ObsidianLink: [[path|display text]]
$html = p('See [[other-page|display text]] here.');
like $html, qr{<a href="other-page" class="obsidian-link">display text</a>}, 'ObsidianLink with display text';

# ObsidianLink: leading/trailing whitespace in display text is trimmed
$html = p('See [[path| display text ]] here.');
like $html, qr{<a href="path" class="obsidian-link">display text</a>}, 'ObsidianLink display text is trimmed';

# ObsidianLink: Japanese characters
$html = p('[[相対パス|表示テキスト]]');
like $html, qr/class="obsidian-link"/, 'ObsidianLink with Japanese chars has class';
like $html, qr/相対パス/,              'ObsidianLink with Japanese chars: path present';
like $html, qr/表示テキスト/,          'ObsidianLink with Japanese chars: display text present';

# ObsidianLink: path and display text with HTML chars are escaped
$html = p('[[<evil>|<b>click</b>]]');
unlike $html, qr/<evil>/, 'ObsidianLink path is HTML-escaped';
unlike $html, qr/<b>/,    'ObsidianLink display is HTML-escaped';
like   $html, qr/&lt;evil&gt;/, 'ObsidianLink escaped path in output';

# ObsidianLink: unsafe scheme is NOT rendered as a link
$html = p('Click [[javascript:alert(1)|x]] here.');
unlike $html, qr/href="javascript:/i, 'ObsidianLink: javascript: scheme rejected';
unlike $html, qr/<a /,               'ObsidianLink: javascript: scheme produces no link';
like   $html, qr/\[\[javascript:/,   'ObsidianLink: javascript: raw text escaped';

# ObsidianLink does NOT match [[#ID]] (ObsidianAnchor takes precedence)
$html = p(":: Section\n\nSee [[#Section]] here.");
like   $html, qr/class="obsidian-anchor"/, 'ObsidianAnchor takes precedence over ObsidianLink';
unlike $html, qr/class="obsidian-link"/,  '[[#ID]] does not become obsidian-link';

# Strong
like   p('**bold**'),      qr/<strong>bold<\/strong>/, '** → <strong>';
unlike p("**line1\nline2**"), qr/<strong>/,            'newline inside ** prevents strong';

# Emphasis
like   p('*italic*'),        qr/<em>italic<\/em>/, '* → <em>';
unlike p("*line1\nline2*"),  qr/<em>/,             'newline inside * prevents em';

# Delete
like   p('~~deleted~~'),       qr/<del>deleted<\/del>/, '~~ → <del>';
unlike p("~~line1\nline2~~"),  qr/<del>/,               'newline inside ~~ prevents del';

# Insert
like   p('++inserted++'),      qr/<ins>inserted<\/ins>/, '++ → <ins>';
unlike p("++line1\nline2++"),  qr/<ins>/,                'newline inside ++ prevents ins';

# Code wins over Strong
$html = p('`**text**`');
like   $html, qr{<code>\*\*text\*\*</code>}, 'code wins over strong: ** inside backtick is literal';
unlike $html, qr/<strong>/, 'code wins over strong: no <strong>';

# Code wins over Emphasis
$html = p('`*text*`');
like   $html, qr{<code>\*text\*</code>}, 'code wins over emphasis: * inside backtick is literal';
unlike $html, qr/<em>/, 'code wins over emphasis: no <em>';

# No nesting: del + strong
$html = p('~~del **strong** text~~');
like   $html, qr/<del>/, 'del renders for ~~...~~';
unlike $html, qr/<strong>/, 'strong does not nest inside del';

# HTML escaping
$html = p('<script>alert(1)</script>');
unlike $html, qr/<script>/i,   'plain text <script> is escaped';
like   $html, qr/&lt;script&gt;/, 'plain text: &lt;script&gt; in output';

$html = p('A & B');
like $html, qr/A &amp; B/, '& in plain text is escaped to &amp;';

# Deprecated [#id] is treated as plain text
$html = p('[#my-anchor]');
like $html, qr{<p>\[#my-anchor\]</p>}, '[#id] standalone line is plain text';

done_testing;
