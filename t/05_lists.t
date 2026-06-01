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

# §Lists

# unordered list
my $html = p("- Alpha\n- Beta\n- Gamma");
like $html, qr/<ul>/, 'unordered list renders <ul>';
like $html, qr/<li>Alpha<\/li>/, 'ul: Alpha item';
like $html, qr/<li>Beta<\/li>/, 'ul: Beta item';

# ordered list
$html = p("# First\n# Second\n# Third");
like $html, qr/<ol>/, 'ordered list renders <ol>';
like $html, qr/<li>First<\/li>/,  'ol: First item';
like $html, qr/<li>Second<\/li>/, 'ol: Second item';
like $html, qr/<li>Third<\/li>/,  'ol: Third item';

# casual DL (? / =)
$html = p("? Term\n= Definition line");
like $html, qr/<dl>/, 'casual DL renders <dl>';
like $html, qr/<dt>Term<\/dt><dd>Definition line<\/dd>/, 'casual DL: dt/dd rendered';

# casual DL term without following = emits E403 and no <dl>
my ($h, $diags) = pb('? TermOnly');
unlike $h, qr/<dl>/, 'casual DL term without = produces no <dl>';
ok scalar(grep { $_->{code} eq 'E403' } @$diags), 'casual DL term without = emits E403';

# casual DL description without preceding ? → paragraph + E403
($h, $diags) = pb('= orphan description');
like   $h, qr/<p>orphan description<\/p>/, 'orphan = falls back to paragraph';
ok scalar(grep { $_->{code} eq 'E403' } @$diags), 'orphan = emits E403';

# casual DL cannot be nested (indented ?/=)
($h, $diags) = pb("- Parent\n  ? Term\n  = Desc");
unlike $h, qr/<dl>/, 'indented casual DL does not render <dl>';
like   $h, qr/\? Term/, 'indented ? stays as plain text';
ok scalar(grep { $_->{code} eq 'E403' } @$diags), 'indented casual DL emits E403';

# := definition cannot be nested (indented :=)
($h, $diags) = pb("- Parent\n  := NestedTerm\n  Body");
unlike $h, qr/<dl class="def-block">/, 'indented := does not render def-block <dl>';
like   $h, qr/:= NestedTerm/, 'indented := stays as plain text';
ok scalar(grep { $_->{code} eq 'E403' } @$diags), 'indented := emits E403';

# nested ordered list (2-space indent)
$html = p("# Parent\n  # Child");
like $html, qr/<ol>/, 'nested ol renders <ol>';
like $html, qr{<li>Parent[\s\S]*<ol>[\s\S]*<li>Child</li>}, 'nested ol: Child inside Parent';

# ordered list items support inline parsing
like p('# **bold item**'), qr/<strong>bold item<\/strong>/, 'ol items support **bold**';

# digit-dot syntax (1. item) is NOT an ordered list
unlike p('1. item'), qr/<ol>/, '1. digit-dot syntax is not an ordered list';

# odd-indent ol (3 spaces) → falls back to text
($h, $diags) = pb('   # odd indent');
unlike $h, qr/<ol>/, 'odd-indent ol produces no <ol>';
unlike $h, qr/<li>/, 'odd-indent ol produces no <li>';

# odd-indent ul (1 space) → falls back to text
($h, $diags) = pb(' - odd indent');
unlike $h, qr/<ul>/, 'odd-indent ul produces no <ul>';
unlike $h, qr/<li>/, 'odd-indent ul produces no <li>';

# nested list (2-space indent)
$html = p("- Parent\n  - Child");
like $html, qr/<ul>/, 'nested ul renders <ul>';
like $html, qr{<li>Parent[\s\S]*<ul>[\s\S]*<li>Child</li>}, 'nested ul: Child inside Parent';

# task list [x] → checked checkbox
$html = p('[x] Done task');
like $html, qr/type="checkbox"/, 'task list [x] has checkbox input';
like $html, qr/checked/,         'task list [x] is checked';

# task list [ ] → unchecked checkbox
$html = p('[ ] Open task');
like   $html, qr/type="checkbox"/, 'task list [ ] has checkbox input';
unlike $html, qr/ checked/,        'task list [ ] is not checked';

# task list checkbox is disabled (read-only)
like p('[x] Done'), qr/disabled/, 'task list checkbox is disabled';

# list items support inline parsing
like p('- **bold item**'), qr/<strong>bold item<\/strong>/, 'ul items support **bold**';

# mixed list (ul then ol without blank line) → two separate list blocks
$html = p("- Alpha\n- Beta\n# First\n# Second");
like $html, qr/<ul>/, 'mixed list: ul is present';
like $html, qr/<ol>/, 'mixed list: ol is present';
like $html, qr{</ul>[\s\S]*<ol>}, 'mixed list: ul comes before ol';
like $html, qr/<li>Alpha<\/li>/, 'mixed list: Alpha present';
like $html, qr/<li>First<\/li>/,  'mixed list: First present';

# ol parent with ul nested children
$html = p("# Step 1\n  - Note A\n  - Note B\n# Step 2");
like $html, qr/<ol>/, 'ol+nested ul: outer <ol> present';
like $html, qr{<li>Step 1[\s\S]*<ul>[\s\S]*<li>Note A</li>}, 'ol+nested ul: Note A inside Step 1';
like $html, qr/<li>Step 2<\/li>/, 'ol+nested ul: Step 2 present';

# @[class: items] after ul adds class to <ul>
$html = p("- item one\n- item two\n\@[class: items]");
like $html, qr/<ul class="items">/, '@[class:] after ul adds class to <ul>';

# @[class: steps] after ol adds class to <ol>
$html = p("# step one\n# step two\n\@[class: steps]");
like $html, qr/<ol class="steps">/, '@[class:] after ol adds class to <ol>';

done_testing;
