use strict;
use warnings;
use utf8;
use open ':std', ':utf8';
use Test::More;
use lib 'lib';
use Text::Blogable;

sub pb {
    my $b = Text::Blogable->new;
    my $h = $b->parse($_[0]);
    return ($h, $b->diagnostics);
}

# §Diagnostics

my ($h, $diags);

# E201: invalid front matter key
($h, $diags) = pb("@@\nbadkey: value\n@@");
ok scalar(grep { $_->{code} eq 'E201' } @$diags), '[E201] emitted for invalid FM key';
ok scalar(grep { $_->{code} eq 'E201' && $_->{message} =~ /badkey/ } @$diags),
    '[E201] message carries the invalid key';

# E204: unknown MetaKey
($h, $diags) = pb('@[unknownkey: v]');
ok scalar(grep { $_->{code} eq 'E204' } @$diags), '[E204] emitted for unknown MetaKey';
ok scalar(grep { $_->{code} eq 'E204' && $_->{message} =~ /unknownkey/ } @$diags),
    '[E204] message carries the unknown key';

# W601: unresolved anchor reference
($h, $diags) = pb('See [[#ghost-anchor]] for details.');
ok scalar(grep { $_->{code} eq 'W601' } @$diags), '[W601] emitted for unresolved anchor';
ok scalar(grep { $_->{code} eq 'W601' && $_->{message} =~ /ghost-anchor/ } @$diags),
    '[W601] message carries the anchor id';

# W202: malformed front matter line
($h, $diags) = pb("@@\nmalformed line without colon\n@@");
ok scalar(grep { $_->{code} eq 'W202' } @$diags), '[W202] emitted for malformed FM line';
ok scalar(grep { $_->{code} eq 'W202' && $_->{message} =~ /malformed line without colon/ } @$diags),
    '[W202] message carries the malformed line';

# diagnostics are reset on each parse call
{
    my $b = Text::Blogable->new;
    $b->parse("@@\nbadkey: v\n@@");
    ok scalar(grep { $_->{code} eq 'E201' } @{ $b->diagnostics }),
        'E201 emitted on first parse';
    $b->parse(':: Clean heading');
    is scalar(@{ $b->diagnostics }), 0,
        'diagnostics reset to 0 on clean second parse';
}

# E201 does not crash the parser
eval { pb("@@\nbadkey: v\n@@") };
ok !$@, '[E201] does not crash the parser';

# W601 does not stop rendering
($h, $diags) = pb(":: Section\n\nSee [[#ghost]]");
like $h, qr/<h2/, '[W601] heading still renders despite unresolved anchor';

# E401: odd-length list indent
($h, $diags) = pb('   # three-space indent');
ok scalar(grep { $_->{code} eq 'E401' } @$diags), '[E401] emitted for 3-space ol indent';

($h, $diags) = pb(' - one-space indent');
ok scalar(grep { $_->{code} eq 'E401' } @$diags), '[E401] emitted for 1-space ul indent';

eval { pb('     # five-space indent') };
ok !$@, '[E401] does not crash the parser';

# E402: heading with 7+ colons
($h, $diags) = pb(':::::::: Heading Seven');
ok scalar(grep { $_->{code} eq 'E402' } @$diags), '[E402] emitted for 7-colon heading';

($h, $diags) = pb(':::::::# Numbered Seven');
ok scalar(grep { $_->{code} eq 'E402' } @$diags), '[E402] emitted for 7-colon numbered heading';

# E402 message mentions h6 maximum
($h, $diags) = pb(':::::::: Too Deep');
ok scalar(grep { $_->{code} eq 'E402' && $_->{message} =~ /6/ } @$diags),
    '[E402] message mentions h6 maximum (6)';

# E402 falls back to plain text (no heading element)
($h, $diags) = pb(':::::::: Too Deep');
unlike $h, qr/<h[0-9]/, '[E402] falls back to plain text (no <h?> element)';
like   $h, qr/Too Deep/, '[E402] plain text content is still rendered';

# exactly 6 colons (h6) does NOT emit E402
($h, $diags) = pb(':::::: Valid h6');
ok !scalar(grep { $_->{code} eq 'E402' } @$diags), '6 colons (h6) does not emit E402';

# E403: definition block with no body
($h, $diags) = pb(':= TermOnly');
ok scalar(grep { $_->{code} eq 'E403' } @$diags), '[E403] emitted for := without body';

($h, $diags) = pb('? TermOnly');
ok scalar(grep { $_->{code} eq 'E403' } @$diags), '[E403] emitted for casual DL ? without =';

($h, $diags) = pb(':= TermOnly');
ok scalar(grep { $_->{code} eq 'E403' && $_->{message} =~ /TermOnly/ } @$diags),
    '[E403] message carries the term name';

eval { pb(':= TermOnly') };
ok !$@, '[E403] does not crash the parser';

# E403 renders the term text even when body is absent
($h, $diags) = pb(':= TermOnly');
like $h, qr/TermOnly/, '[E403] term text is still present in output';

# := with body does NOT emit E403
($h, $diags) = pb(":= MyTerm\nThe body text.");
ok !scalar(grep { $_->{code} eq 'E403' } @$diags), ':= with body does not emit E403';

# W203: unterminated front matter
($h, $diags) = pb("@@\ntitle: No Close");
ok scalar(grep { $_->{code} eq 'W203' } @$diags), '[W203] emitted for unterminated FM';
ok scalar(grep { $_->{code} eq 'W203' && $_->{message} =~ /@@/ } @$diags),
    '[W203] message mentions @@ delimiter';
eval { pb("@@\ntitle: No Close") };
ok !$@, '[W203] does not crash the parser';

# properly closed FM does NOT emit W203
($h, $diags) = pb("@@\ntitle: OK\n@@");
ok !scalar(grep { $_->{code} eq 'W203' } @$diags), 'closed FM does not emit W203';

# W001: unterminated code block
($h, $diags) = pb("#!bash\necho hi");
ok scalar(grep { $_->{code} eq 'W001' } @$diags), '[W001] emitted for unterminated code block';
ok scalar(grep { $_->{code} eq 'W001' && $_->{message} =~ /!#/ } @$diags),
    '[W001] message mentions !# delimiter';
eval { pb("#!bash\necho hi") };
ok !$@, '[W001] does not crash the parser';

# properly closed code block does NOT emit W001
($h, $diags) = pb("#!bash\necho hi\n!#");
ok !scalar(grep { $_->{code} eq 'W001' } @$diags), 'closed code block does not emit W001';

# W002: unterminated quote block
($h, $diags) = pb("|>\nSome quoted text");
ok scalar(grep { $_->{code} eq 'W002' } @$diags), '[W002] emitted for unterminated quote block';
ok scalar(grep { $_->{code} eq 'W002' && $_->{message} =~ /<\|/ } @$diags),
    '[W002] message mentions <| delimiter';
eval { pb("|>\nSome quoted text") };
ok !$@, '[W002] does not crash the parser';

# properly closed quote block does NOT emit W002
($h, $diags) = pb("|>\nSome text.\n<|");
ok !scalar(grep { $_->{code} eq 'W002' } @$diags), 'closed quote block does not emit W002';

# W003: unterminated math block
($h, $diags) = pb("\$\$\nx = 1");
ok scalar(grep { $_->{code} eq 'W003' } @$diags), '[W003] emitted for unterminated math block';
ok scalar(grep { $_->{code} eq 'W003' && $_->{message} =~ /\$\$/ } @$diags),
    '[W003] message mentions $$ delimiter';
eval { pb("\$\$\nx = 1") };
ok !$@, '[W003] does not crash the parser';

# properly closed math block does NOT emit W003
($h, $diags) = pb("\$\$\nx = 1\n\$\$");
ok !scalar(grep { $_->{code} eq 'W003' } @$diags), 'closed math block does not emit W003';

# E404: duplicate definition term
($h, $diags) = pb(":= MyTerm\nFirst body.\n\n:= MyTerm\nSecond body.");
ok scalar(grep { $_->{code} eq 'E404' } @$diags), '[E404] emitted for duplicate := term';
ok scalar(grep { $_->{code} eq 'E404' && $_->{message} =~ /MyTerm/ } @$diags),
    '[E404] message carries the duplicate term';

# E404 is case-insensitive
($h, $diags) = pb(":= myterm\nFirst.\n\n:= MYTERM\nSecond.");
ok scalar(grep { $_->{code} eq 'E404' } @$diags), '[E404] is case-insensitive';

eval { pb(":= Alpha\nBody one.\n\n:= Alpha\nBody two.") };
ok !$@, '[E404] does not crash the parser';

# two distinct terms do NOT emit E404
($h, $diags) = pb(":= TermA\nBody A.\n\n:= TermB\nBody B.");
ok !scalar(grep { $_->{code} eq 'E404' } @$diags), 'distinct := terms do not emit E404';

# E404 is reset between parse() calls
{
    my $b = Text::Blogable->new;
    $b->parse(":= Alpha\nBody.\n\n:= Alpha\nBody again.");
    $b->parse(":= Alpha\nFresh body.");
    ok !scalar(grep { $_->{code} eq 'E404' } @{ $b->diagnostics }),
        '[E404] is reset between parse() calls';
}

# E405: duplicate document ids
($h, $diags) = pb(":: Section\n\n:: Section");
ok scalar(grep { $_->{code} eq 'E405' } @$diags), '[E405] emitted for duplicate heading ids';

# E405: duplicate ids are not auto-renamed; both keep the same id
my @e405_matches = ($h =~ m{<h2 id="section"[^>]*><a href="#section">Section</a></h2>}g);
is scalar(@e405_matches), 2, '[E405] duplicate headings both keep the same id';

# E405: heading @[id] collision with existing id
($h, $diags) = pb(":: Intro\n\n:: Another\n\@[id: intro]");
ok scalar(grep { $_->{code} eq 'E405' } @$diags), '[E405] emitted when @[id:] collides with existing id';

# E405 is reset between parse() calls
{
    my $b = Text::Blogable->new;
    $b->parse(":: Intro\n\n:: Intro");
    $b->parse(":: Intro");
    ok !scalar(grep { $_->{code} eq 'E405' } @{ $b->diagnostics }),
        '[E405] is reset between parse() calls';
}

# W801: orphaned modifier (plain paragraph + modifier)
($h, $diags) = pb("Plain text line.\n\@[class: lead]");
ok scalar(grep { $_->{code} eq 'W801' } @$diags),
    '[W801] emitted for modifier after plain paragraph';

# W801: modifier after blank line
($h, $diags) = pb(":: Heading\n\n\@[class: highlight]");
ok scalar(grep { $_->{code} eq 'W801' } @$diags),
    '[W801] emitted for modifier after blank line';

# W801: modifier after horizontal rule
($h, $diags) = pb("---\n\@[class: decorative]");
ok scalar(grep { $_->{code} eq 'W801' } @$diags),
    '[W801] emitted for modifier after horizontal rule';

# W801 message carries the modifier key and value
($h, $diags) = pb("Plain text.\n\@[class: my-class]");
ok scalar(grep {
    $_->{code} eq 'W801'
    && $_->{message} =~ /class/
    && $_->{message} =~ /my-class/
} @$diags), '[W801] message carries modifier key and value';

eval { pb("Plain.\n\@[id: orphan]") };
ok !$@, '[W801] does not crash the parser';

# W801 NOT emitted for modifier immediately after heading
($h, $diags) = pb(":: My Heading\n\@[class: highlight]");
ok !scalar(grep { $_->{code} eq 'W801' } @$diags),
    'modifier immediately after heading does NOT emit W801';

# W801 NOT emitted for modifier immediately after `: ` paragraph
($h, $diags) = pb(": Explicit para\n\@[class: lead]");
ok !scalar(grep { $_->{code} eq 'W801' } @$diags),
    'modifier immediately after : para does NOT emit W801';

done_testing;
