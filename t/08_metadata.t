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

# §Metadata (block modifiers @[...])

# @[class: value] after a heading adds class attribute
my $html = p(":: My Heading\n\@[class: highlight]");
like $html, qr/class="[^"]*highlight[^"]*"/, '@[class:] after heading adds class';

# multiple @[class: ...] append classes in order
$html = p(":: My Heading\n\@[class: alpha]\n\@[class: beta]");
like $html, qr{<h2[^>]*class="[^"]*\balpha\b[^"]*\bbeta\b[^"]*"}, 'multiple @[class:] append in order';

# @[id: value] after a heading sets custom id (and emits W802)
my ($h, $diags) = pb(":: Section\n\@[id: custom-id]");
my ($heading_tag) = ($h =~ /(<h2[^>]*>)/);
$heading_tag //= '';
like   $heading_tag, qr/id="custom-id"/, '@[id:] after heading sets custom id';
is     scalar(() = $heading_tag =~ /\bid="/g), 1, 'only one id attribute on heading after @[id:]';
like   $h, qr{<a href="#custom-id">Section</a>}, 'self-link uses custom id after @[id:]';
ok scalar(grep { $_->{code} eq 'W802' } @$diags), '@[id:] after heading emits W802';

# multiple @[id: ...] → last one wins, emits E205
($h, $diags) = pb(":: Section\n\@[id: first-id]\n\@[id: final-id]");
($heading_tag) = ($h =~ /(<h2[^>]*>)/);
$heading_tag //= '';
like   $heading_tag, qr/id="final-id"/, 'multiple @[id:]: last id wins';
unlike $heading_tag, qr/id="first-id"/, 'multiple @[id:]: first id not used';
like   $h, qr{<a href="#final-id">Section</a>}, 'multiple @[id:]: self-link uses last id';
ok scalar(grep { $_->{code} eq 'E205' } @$diags), 'multiple @[id:] emits E205';

# @[x-foo: bar] adds data-foo="bar"
$html = p(":: Section\n\@[x-foo: bar]");
like $html, qr/data-foo="bar"/, '@[x-foo:] after heading adds data-foo attribute';

# @[class: lead] after a `: ` paragraph adds class to <p>
$html = p(": Hello world\n\@[class: lead]");
like $html, qr/<p class="lead">/, '@[class:] after : paragraph adds class to <p>';

# @[id: intro] after a `: ` paragraph sets id on <p>
$html = p(": Intro text\n\@[id: intro]");
like $html, qr/<p id="intro">/, '@[id:] after : paragraph sets id on <p>';

# @[x-role: note] after a `: ` paragraph adds data-role on <p>
$html = p(": A note\n\@[x-role: note]");
like $html, qr/data-role="note"/, '@[x-role:] after : paragraph adds data attribute';

# plain paragraph does NOT accept modifiers
$html = p("Hello world\n\@[class: lead]");
unlike $html, qr/<p class="lead">/, 'plain paragraph does not accept @[class:] modifier';

# multi-line plain paragraph joins lines with <br>
$html = p("line one\nline two\nline three");
like $html, qr{<p>line one<br>\nline two<br>\nline three</p>},
    'multi-line plain paragraph joins with <br>';

# multi-line `: ` paragraph joins lines with <br>
$html = p(": line one\n: line two\n: line three");
like $html, qr{<p>line one<br>\nline two<br>\nline three</p>},
    'multi-line : paragraph joins with <br>';

# @[class: callout] after inline blockquote
$html = p("> A quote\n\@[class: callout]");
like $html, qr/<blockquote class="callout">/, '@[class:] after inline blockquote adds class';

# @[class: callout] after block blockquote
$html = p("|>\nA quoted paragraph\n<|\n\@[class: callout]");
like $html, qr/<blockquote class="callout">/, '@[class:] after block blockquote adds class';

# @[class: equation] after math block
$html = p("\$\$\nx = 1\n\$\$\n\@[class: equation]");
like $html, qr{<pre class="math-block equation"><code>x = 1</code></pre>},
    '@[class:] after math block adds class';

# @[class: highlight] after code block
$html = p("#!bash\necho hi\n!#\n\@[class: highlight]");
like $html, qr{<figure[^>]*class="[^"]*highlight[^"]*">}, '@[class:] after code block adds class to <figure>';

# @[class: glossary] after a definition block
$html = p(":= Term\nBody text\n\@[class: glossary]");
like $html, qr{<dl[^>]*class="[^"]*glossary[^"]*">}, '@[class:] after := block adds class to <dl>';

# unknown MetaKey emits E204
($h, $diags) = pb('@[badkey: value]');
ok scalar(grep { $_->{code} eq 'E204' } @$diags), 'unknown MetaKey emits E204';
unlike $h, qr/badkey="value"/, 'unknown MetaKey not added as attribute';

# metadata does not cross blank lines (modifier after blank is a new block)
$html = p(":: Heading\n\n\@[class: late]");
unlike $html, qr{<h2[^>]*class="[^"]*late[^"]*"}, 'modifier after blank line not applied to heading';

# single @[id: ...] on non-heading does NOT emit W802
($h, $diags) = pb(": Intro text\n\@[id: intro]");
ok !scalar(grep { $_->{code} eq 'W802' } @$diags), 'single @[id:] on non-heading does not emit W802';

# non-heading @[id: ...] creates a resolvable [[#...]] anchor target
($h, $diags) = pb(": Intro text\n\@[id: My Intro!]\n\nSee [[#my-intro]] for details.");
like $h, qr/<p id="my-intro">Intro text<\/p>/, 'non-heading @[id:] is normalized and applied to block id';
like $h, qr{<a href="#my-intro" class="obsidian-anchor">my-intro</a>}, 'non-heading @[id:] target resolves in [[#...]]';
ok !scalar(grep { $_->{code} eq 'W601' } @$diags), 'resolved non-heading @[id:] does not emit W601';

# heading @[id: ...] DOES emit W802
($h, $diags) = pb(":: Intro\n\@[id: custom-id]");
ok scalar(grep { $_->{code} eq 'W802' } @$diags), 'heading @[id:] emits W802';

done_testing;
