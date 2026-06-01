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

# §Definitions

# := Term followed by text → <dl class="def-block"><dt id="...">...
my $html = p(":= MyTerm\nThe definition body.");
like $html, qr/<dl class="def-block">/,  ':= renders <dl class="def-block">';
like $html, qr{<dt id="myterm"><a href="#myterm">MyTerm</a></dt>}, ':= dt has id and self-link';
like $html, qr/The definition body\./, ':= body text is present';

# definition term supports inline parsing (**bold**)
$html = p(":= **Bold** Term\nBody text.");
like $html, qr/<strong>Bold<\/strong>/, ':= term supports **bold** inline';

# definition body supports inline parsing (*italic*)
$html = p(":= Term\n*italic body*");
like $html, qr/<em>italic body<\/em>/, ':= body supports *italic* inline';

# duplicate := terms keep the same id and emit E404 + E405
my ($h, $diags) = pb(":= Glossary\nBody A.\n\n:= Glossary\nBody B.");
my @matches = ($h =~ m{<dt id="glossary"><a href="#glossary">Glossary</a></dt>}g);
is scalar(@matches), 2, 'duplicate := terms both render with same id';
ok scalar(grep { $_->{code} eq 'E404' } @$diags), 'duplicate := terms emit E404';
ok scalar(grep { $_->{code} eq 'E405' } @$diags), 'duplicate := terms emit E405 (duplicate anchor id)';

# := definition block creates an anchor id resolvable by [[#...]]
$html = p(":= MyTerm\nBody.\n\nSee [[#myterm]] for details.");
like $html, qr{<a href="#myterm" class="obsidian-anchor"}, ':= definition id resolves [[#myterm]]';

# := term without body emits E403
($h, $diags) = pb(':= TermOnly');
ok scalar(grep { $_->{code} eq 'E403' } @$diags), ':= without body emits E403';
like $h, qr/TermOnly/, ':= without body still renders the term text';

# := definition block WITH body does NOT emit E403
($h, $diags) = pb(":= MyTerm\nThe body text.");
ok !scalar(grep { $_->{code} eq 'E403' } @$diags), ':= with body does not emit E403';

# two distinct terms do NOT emit E404
($h, $diags) = pb(":= TermA\nBody A.\n\n:= TermB\nBody B.");
ok !scalar(grep { $_->{code} eq 'E404' } @$diags), 'distinct := terms do not emit E404';

# E404 is case-insensitive (myterm and MYTERM are duplicates)
($h, $diags) = pb(":= myterm\nFirst.\n\n:= MYTERM\nSecond.");
ok scalar(grep { $_->{code} eq 'E404' } @$diags), 'E404 is case-insensitive for duplicate terms';

# @[class: glossary] after a definition block adds class to <dl>
$html = p(":= Term\nBody text\n\@[class: glossary]");
like $html, qr/<dl[^>]*class="[^"]*glossary[^"]*">/, '@[class:] after := adds class to <dl>';

# definition term with multi-paragraph body (blank line separating paragraphs)
$html = p(":= Term\nParagraph one.\n\nParagraph two.");
like $html, qr/<p>Paragraph one\.<\/p>/, ':= multi-para body: first paragraph';
like $html, qr/<p>Paragraph two\.<\/p>/, ':= multi-para body: second paragraph';

done_testing;
