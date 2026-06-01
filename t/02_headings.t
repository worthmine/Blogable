use strict;
use warnings;
use utf8;
use open ':std', ':utf8';
use Test::More;
use lib 'lib';
use Text::Blogable;

sub p { Text::Blogable->new->parse(@_) }

# §Headings

like p(':: Heading Two'),    qr/^<h2 /, ':: (2 colons) → <h2>';
like p('::: Heading Three'),  qr/^<h3 /, '::: (3 colons) → <h3>';
like p(':::: Heading Four'),  qr/^<h4 /, ':::: (4 colons) → <h4>';
like p('::::: Heading Five'), qr/^<h5 /, '::::: (5 colons) → <h5>';
like p(':::::: Heading Six'), qr/^<h6 /, ':::::: (6 colons) → <h6>';

# heading carries an id derived from its text
like p(':: My Section'), qr/id="my-section"/, 'heading carries id derived from text';

# numbered heading (::# text) adds class="numbered"
my $html = p('::# Section One');
like   $html, qr/class="numbered"/, 'numbered heading adds class="numbered"';
like   $html, qr/<h2 /, 'numbered heading is h2';

# plain heading does NOT get class="numbered"
unlike p(':: Plain'), qr/class="numbered"/, 'plain heading has no class="numbered"';

# heading text is HTML-escaped
$html = p(':: <script>alert(1)</script>');
unlike $html, qr/<script>/i, 'heading text: <script> is escaped';
like   $html, qr/&lt;script&gt;/, 'heading text: & escaped to &lt;';

# heading contains a self-referential anchor link
like p(':: My Section'),
    qr{<h2 id="my-section"[^>]*><a href="#my-section">My Section</a></h2>},
    'heading contains self-referential anchor link';

# @[id: custom-id] overrides auto id without duplicating id attributes
$html = p(":: My Section\n\@[id: custom-id]");
my ($heading_tag) = ($html =~ /(<h2[^>]*>)/);
$heading_tag //= '';
like   $heading_tag, qr/id="custom-id"/, 'custom @[id:] overrides auto id';
is   scalar(() = $heading_tag =~ /\bid="/g), 1, 'only one id attribute on heading';
like $html, qr{<a href="#custom-id">My Section</a>}, 'self-link uses custom id';

# numbered heading contains a self-referential anchor link
like p('::# Section One'),
    qr{<h2 [^>]*><a href="#section-one">Section One</a></h2>},
    'numbered heading contains self-referential anchor link';

# §HorizontalRule

is   (p('---')   =~ s/\s+/ /gr =~ s/^\s|\s$//gr, '<hr>', '--- → <hr>');
is   (p('----')  =~ s/\s+/ /gr =~ s/^\s|\s$//gr, '<hr>', '---- → <hr>');
unlike p('--'), qr/<hr>/, '-- (2 dashes) is NOT a horizontal rule';

done_testing;
