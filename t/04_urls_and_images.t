use strict;
use warnings;
use utf8;
use open ':std', ':utf8';
use Test::More;
use lib 'lib';
use Text::Blogable;

sub p { Text::Blogable->new->parse(@_) }

# §URLs

# standalone https:// URL → autolink paragraph
my $html = p('https://example.com');
like   $html, qr{<a href="https://example\.com"}, 'standalone URL → autolink';
like   $html, qr/rel="noopener noreferrer"/, 'autolink has rel="noopener noreferrer"';

# autolink label is derived from the URL itself (hostname only)
$html = p('https://example.com/path/to/post');
like   $html, qr/>example\.com<\/a>/, 'autolink label is hostname';

# http:// URL is NOT auto-linked (security requirement)
$html = p('http://example.com');
unlike $html, qr{<a href="http://}, 'http:// URL is not auto-linked';

# image URL (.png) → autolink, not <figure>
$html = p('https://example.com/photo.png');
unlike $html, qr/<figure/, 'standalone image URL (.png) produces no <figure>';
unlike $html, qr/<img /,   'standalone image URL (.png) produces no <img>';
like   $html, qr{<a href="https://example\.com/photo\.png"}, 'standalone image URL (.png) is an autolink';

# image URLs of various extensions → autolink not <img>
for my $ext (qw(jpg jpeg gif webp)) {
    $html = p("https://example.com/img.$ext");
    unlike $html, qr/<img /, "image URL (.$ext) produces no <img>";
    like   $html, qr/<a /,   "image URL (.$ext) is an autolink";
}

# .svg external URL is just an autolink
$html = p('https://example.com/graphic.svg');
unlike $html, qr/<img /, 'external .svg URL produces no <img>';
like   $html, qr/<a /,   'external .svg URL is an autolink';

# §ObsidianEmbed

# ![[image.png]] → <figure> with <img src="image.png">
$html = p('![[image.png]]');
like $html, qr/<figure/, '![[image.png]] renders <figure>';
like $html, qr/<img /,   '![[image.png]] renders <img>';
like $html, qr/src="image\.png"/, '![[image.png]] sets src';

# ![[image.png|alt text]] → <img alt="alt text">
$html = p('![[image.png|alt text]]');
like $html, qr/alt="alt text"/, '![[image|alt]] sets alt attribute';
like $html, qr/src="image\.png"/, '![[image|alt]] sets src';

# ![[path/to/photo.jpg]] — nested path used as src
$html = p('![[path/to/photo.jpg]]');
like $html, qr{src="path/to/photo\.jpg"}, '![[nested/path.jpg]] sets full src';

# ![[image.png]] has loading="lazy" and decoding="async"
$html = p('![[image.png]]');
like $html, qr/loading="lazy"/,   '![[image.png]] has loading="lazy"';
like $html, qr/decoding="async"/, '![[image.png]] has decoding="async"';

# ![[<evil>.png]] — path is HTML-escaped
$html = p('![[<evil>.png]]');
unlike $html, qr/<evil>/, '![[<evil>.png]] path is HTML-escaped';
like   $html, qr/&lt;evil&gt;/, '![[<evil>.png]] path escaping correct';

# ![[img.png|<b>bold</b>]] — alt text is HTML-escaped
$html = p('![[img.png|<b>bold</b>]]');
unlike $html, qr/<b>/, 'alt text in ![[...]] is HTML-escaped';
like   $html, qr/&lt;b&gt;/, 'alt text escaping correct';

# ![[image with spaces.png]] — spaces in filename supported
$html = p('![[image with spaces.png]]');
like $html, qr/src="image with spaces\.png"/, 'spaces in ![[...]] filename are preserved';

# ![[日本語画像.png]] — Japanese filename
$html = p('![[日本語画像.png]]');
like $html, qr/src="日本語画像\.png"/, 'Japanese filename in ![[...]] is preserved';

# ![[image.svg]] — SVG is supported
$html = p('![[image.svg]]');
like $html, qr/<figure/, '![[image.svg]] renders <figure>';
like $html, qr/<img /,   '![[image.svg]] renders <img>';
like $html, qr/src="image\.svg"/, '![[image.svg]] sets src';

# §ExternalEmbed (block)

# !!URL!! → external link paragraph
$html = p('!!https://example.com!!');
like $html, qr{<a href="https://example\.com"}, '!!URL!! renders external link';
like $html, qr/rel="noopener noreferrer"/, '!!URL!! has rel="noopener noreferrer"';
like $html, qr/target="_blank"/, '!!URL!! has target="_blank"';

# !!image.png!! → <figure><img>
$html = p('!!https://example.com/photo.png!!');
like $html, qr/<figure class="blogable-figure">/, '!!image!! renders <figure>';
like $html, qr{<img src="https://example\.com/photo\.png"}, '!!image!! renders <img>';

# !!url|label!! → link with label
$html = p('!!https://example.com|Visit Example!!');
like $html, qr{<a href="https://example\.com"}, '!!url|label!! renders link';
like $html, qr/Visit Example/, '!!url|label!! shows label text';

# !!video.mp4!! → <figure><video>
$html = p('!!https://example.com/video.mp4!!');
like $html, qr/<figure class="blogable-figure">/, '!!video!! renders <figure>';
like $html, qr{<video src="https://example\.com/video\.mp4"}, '!!video!! renders <video>';

# !!http:// is rejected (https only)
$html = p('!!http://example.com!!');
unlike $html, qr{<a href="http://}, '!!http://!! is not auto-linked';

done_testing;
