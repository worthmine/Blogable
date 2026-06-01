use strict;
use warnings;
use utf8;
use Test::More;
use lib 'lib';
use Text::Blogable;

# §FrontMatter

my $b;

sub new_parser { Text::Blogable->new }

# renders a valid front matter block as <dl class="front-matter">
$b = new_parser();
my $html = $b->parse("@@\ntitle: Hello World\nauthor: Alice\n@@");
like $html, qr/<dl class="front-matter">/, 'front matter renders <dl class="front-matter">';
like $html, qr/<dt>title<\/dt><dd>Hello World<\/dd>/, 'front matter renders title entry';
like $html, qr/<dt>author<\/dt><dd>Alice<\/dd>/, 'front matter renders author entry';

# accepts all spec-defined front matter keys
for my $k (qw(title author date updated description tags slug lang)) {
    $b = new_parser();
    $html = $b->parse("@@\n$k: value\n@@");
    like $html, qr/<dt>$k<\/dt>/, "front matter accepts key: $k";
}

# accepts x-* extension keys
$b = new_parser();
$html = $b->parse("@@\nx-version: 1.2.3\n@@");
like $html, qr/<dt>x-version<\/dt>/, 'front matter accepts x-* extension key';

# rejects an invalid front matter key with E201 and omits it
$b = new_parser();
$html = $b->parse("@@\nbadkey: value\n@@");
ok scalar(grep { $_->{code} eq 'E201' } @{ $b->diagnostics() }), 'E201 emitted for invalid FM key';
unlike $html, qr/<dt>badkey<\/dt>/, 'invalid FM key is omitted from output';

# emits W202 for a malformed front matter line
$b = new_parser();
$b->parse("@@\nnot a key value line\n@@");
ok scalar(grep { $_->{code} eq 'W202' } @{ $b->diagnostics() }), 'W202 emitted for malformed FM line';

# front matter key regex is case-sensitive (uppercase key emits W202)
$b = new_parser();
$b->parse("@@\nTitle: Hello\n@@");
ok scalar(grep { $_->{code} eq 'W202' } @{ $b->diagnostics() }), 'uppercase FM key emits W202';

# empty front matter block produces no <dt>
$b = new_parser();
$html = $b->parse("@@\n@@");
unlike $html, qr/<dt>/, 'empty front matter produces no <dt>';

# strips inline YAML comments from front matter values
$b = new_parser();
$html = $b->parse("@@\ntitle: My Doc # this is a comment\n@@");
like   $html, qr/<dt>title<\/dt><dd>My Doc<\/dd>/, 'YAML comment stripped from FM value';
unlike $html, qr/this is a comment/, 'YAML comment not in output';

# strips inline YAML comment, preserving value before marker
$b = new_parser();
$html = $b->parse("@@\nx-version: 1.1-alpha # Blogable version\n@@");
like   $html, qr/<dt>x-version<\/dt><dd>1.1-alpha<\/dd>/, 'value before YAML comment preserved';
unlike $html, qr/Blogable version/, 'YAML inline comment not in output';

# accepts YAML comment-only lines in front matter (no W202)
$b = new_parser();
$html = $b->parse("@@\n# this is a YAML comment\ntitle: My Doc\n@@");
like $html, qr/<dt>title<\/dt><dd>My Doc<\/dd>/, 'YAML comment-only line does not break FM';
ok !scalar(grep { $_->{code} eq 'W202' } @{ $b->diagnostics() }),
    'YAML comment-only line does not emit W202';

done_testing;
