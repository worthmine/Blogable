package Text::Blogable;

# ============================================================
# Text::Blogable  –  Blogable v1.1-alpha → HTML converter
# ============================================================
# Implements the Blogable v1.1-alpha specification.
# Parsing proceeds in three stages:
#   1. Tokenise
#   2. Build AST
#   3. Render AST → HTML
# ============================================================

use strict;
use warnings;
use utf8;

our $VERSION = '1.1.0';

# ---- constants ----
my $IMAGE_EXTS = qr/\.(jpe?g|png|gif|webp|svg)(\?.*)?$/i;
my $VIDEO_EXTS = qr/\.(mp4|webm|ogg|ogv|mov)(\?.*)?$/i;

my %SHEBANG_LANG_MAP = (
    python     => 'python', python3    => 'python', python2 => 'python',
    node       => 'javascript', nodejs => 'javascript',
    ruby       => 'ruby',
    perl       => 'perl',
    bash       => 'bash', sh => 'bash', zsh => 'bash',
    php        => 'php',
    lua        => 'lua',
    rust       => 'rust',
    go         => 'go',
    swift      => 'swift',
    blogable   => 'blogable',
    ebnf       => 'ebnf',
);

my %ALLOWED_META_KEYS = map { $_ => 1 } qw(class id title cite author alt);

my %ALLOWED_FRONT_MATTER_KEYS = map { $_ => 1 }
    qw(title author date updated description tags slug lang);

# ============================================================
# Constructor
# ============================================================
sub new {
    my ($class) = @_;
    return bless {
        _diagnostics    => [],
        _footnotes      => [],
        _anchor_ids     => {},
        _id_counts      => {},
        _def_terms      => {},
    }, $class;
}

# ============================================================
# Public API
# ============================================================

# parse($text) → $html_string
sub parse {
    my ($self, $src) = @_;
    $self->_reset();
    my @lines = split /\n/, $src, -1;
    my @tokens = $self->_tokenize(\@lines);
    my @nodes  = $self->_build_ast(\@tokens);
    return $self->_ast_to_html(\@nodes);
}

# diagnostics() → \@array_of_hashes  (each: { code => '...', message => '...' })
sub diagnostics {
    my ($self) = @_;
    return [ @{ $self->{_diagnostics} } ];
}

# ============================================================
# Private helpers
# ============================================================

sub _reset {
    my ($self) = @_;
    $self->{_diagnostics} = [];
    $self->{_footnotes}   = [];
    $self->{_anchor_ids}  = {};
    $self->{_id_counts}   = {};
    $self->{_def_terms}   = {};
}

sub _push_diag {
    my ($self, $code, $msg) = @_;
    push @{ $self->{_diagnostics} }, { code => $code, message => $msg };
}

# HTML escape
sub _esc {
    my ($t) = @_;
    $t = defined $t ? "$t" : '';
    $t =~ s/&/&amp;/g;
    $t =~ s/</&lt;/g;
    $t =~ s/>/&gt;/g;
    $t =~ s/"/&quot;/g;
    return $t;
}

sub _ext_link {
    my ($href, $text) = @_;
    return '<a href="' . _esc($href) . '" rel="noopener noreferrer" target="_blank">' . $text . '</a>';
}

sub _is_image_url { return $_[0] =~ $IMAGE_EXTS }
sub _is_video_url { return $_[0] =~ $VIDEO_EXTS }
sub _is_safe_url  { return $_[0] =~ m{^https://} }

sub _get_hostname {
    my ($url) = @_;
    if ($url =~ m{^https://([^/?#]+)}) { return $1 }
    return $url;
}

sub _slugify {
    my ($text) = @_;
    $text =~ s/^\s+|\s+$//g;
    $text = lc $text;
    $text =~ s/\s+/-/g;
    # Keep word chars, CJK, and hyphens
    $text =~ s/[^\w\x{3000}-\x{9fff}\x{3040}-\x{309f}\x{30a0}-\x{30ff}\x{ff00}-\x{ffef}-]//g;
    $text =~ s/-+/-/g;
    $text =~ s/^-|-$//g;
    return $text;
}

sub _detect_lang {
    my ($self, $line) = @_;
    my ($rest) = ($line =~ /^#!(.+)$/);
    return '' unless defined $rest;
    $rest =~ s/^\s+|\s+$//g;
    return '' unless length $rest;

    my $raw_cmd;
    if ($rest =~ m{^/}) {
        my ($cmd) = ($rest =~ m{^/\S+/(?:env\s+)?(\S+)});
        return '' unless defined $cmd;
        $raw_cmd = $cmd;
    } else {
        $raw_cmd = $rest;
    }

    $raw_cmd =~ s/[0-9.]+$//;
    my $mapped = $SHEBANG_LANG_MAP{$raw_cmd} // $raw_cmd;
    $mapped =~ s/[^A-Za-z0-9_+.-]//g;
    return $mapped;
}

sub _reserve_anchor_id {
    my ($self, $raw_id, $source_label) = @_;
    $source_label //= 'block';
    my $base_id = _slugify($raw_id) || 'section';
    my $seen = $self->{_id_counts}{$base_id} // 0;
    $self->{_id_counts}{$base_id} = $seen + 1;
    $self->{_anchor_ids}{$base_id} = 1;
    if ($seen > 0) {
        $self->_push_diag('E405',
            qq{$source_label ID "$base_id" is already in use. Duplicate IDs are not allowed in this document.});
    }
    return $base_id;
}

sub _build_attrs {
    my ($self, $mods) = @_;
    $mods //= [];
    my (@classes, @ids, @data_attrs);
    for my $m (@$mods) {
        my ($key, $val) = ($m->{key}, $m->{value});
        push @classes, $val if $key eq 'class';
        if ($key eq 'id') {
            push @ids, $val;
        }
        if ($key =~ /^x-[a-z0-9-]+$/) {
            my $dk = substr($key, 2);
            push @data_attrs, 'data-' . _esc($dk) . '="' . _esc($val) . '"';
        }
    }
    if (@ids > 1) {
        my $final = $ids[-1];
        $self->_push_diag('E205',
            qq{Multiple \@[id: ...] modifiers were provided on one block. Use only one id modifier; rendering uses the last id "$final".});
    }
    my $out = '';
    if (@ids) { $out .= ' id="' . _esc($ids[-1]) . '"' }
    if (@classes) { $out .= ' class="' . join(' ', map { _esc($_) } @classes) . '"' }
    if (@data_attrs) { $out .= ' ' . join(' ', @data_attrs) }
    return $out;
}

sub _find_mod_value {
    my ($mods, $key) = @_;
    for my $m (@$mods) { return $m->{value} if $m->{key} eq $key }
    return undef;
}

sub _merge_attrs {
    my ($self, $base_class, $mods) = @_;
    $mods //= [];
    my @extras = map { $_->{value} } grep { $_->{key} eq 'class' } @$mods;
    my $extra_class = join(' ', map { _esc($_) } @extras);
    my $cls = $extra_class ? "$base_class $extra_class" : $base_class;
    my @rest = grep { $_->{key} ne 'class' } @$mods;
    return ' class="' . $cls . '"' . $self->_build_attrs(\@rest);
}

# ============================================================
# Inline parser
# ============================================================
sub _parse_inline {
    my ($self, $text) = @_;
    my $out = '';
    my $i = 0;
    my $len = length $text;

    while ($i < $len) {
        my $rest = substr($text, $i);

        # ── Code  `[^`\n]*` ─────────────────────────────────
        if ($rest =~ /^(`([^`\n]*)`)/) {
            $out .= '<code>' . _esc($2) . '</code>';
            $i += length $1; next;
        }

        # ── ExternalEmbed  !!URL!! inline ────────────────────
        if ($rest =~ /^(!!(https:\/\/[^ |!\n]+)(?:[| ]([^!\n]*))?!!)/) {
            my ($full, $url, $label_raw) = ($1, $2, $3);
            $url =~ s/^\s+|\s+$//g;
            if (defined $label_raw) { $label_raw =~ s/^\s+|\s+$//g }
            my $display = (defined $label_raw && $label_raw =~ /\S/) ? $label_raw : _get_hostname($url);
            $out .= _is_safe_url($url) ? _ext_link($url, _esc($display)) : _esc($full);
            $i += length $full; next;
        }

        # ── Footnote  ^[TEXT] ────────────────────────────────
        if ($rest =~ /^(\^\[([^\]\n]*)\])/) {
            my ($full, $inner) = ($1, $2);
            my $n = scalar(@{ $self->{_footnotes} }) + 1;
            if ($inner =~ /^(https:\/\/\S+) (.+)$/ && _is_safe_url($1)) {
                push @{ $self->{_footnotes} }, { n => $n, url => $1, text => $2 };
            } else {
                my $t = $inner;
                $t =~ s/^ //;
                push @{ $self->{_footnotes} }, { n => $n, url => undef, text => $t };
            }
            $out .= qq{<sup><a href="#fn-$n" id="fnref-$n">[$n]</a></sup>};
            $i += length $full; next;
        }

        # ── ObsidianAnchor  [[#ID]] ──────────────────────────
        if ($rest =~ /^(\[\[#([^\]\n]+)\]\])/) {
            my ($full, $id) = ($1, $2);
            my $slug = _slugify($id);
            if ($self->{_anchor_ids}{$slug}) {
                $out .= '<a href="#' . _esc($slug) . '" class="obsidian-anchor">' . _esc($id) . '</a>';
            } else {
                $self->_push_diag('W601',
                    qq{$full — target id not found. Define a matching id via heading, definition term, or \@[id].});
                $out .= _esc($id);
            }
            $i += length $full; next;
        }

        # ── ObsidianLink  [[PATH]] or [[PATH|DISPLAY]] ───────
        if ($rest =~ /^(\[\[([^#\]\|\n][^\]\|\n]*)(?:\|([^\]\n]*))?\]\])/) {
            my ($full, $path, $display_raw) = ($1, $2, $3);
            $path =~ s/^\s+|\s+$//g;
            if (defined $display_raw) { $display_raw =~ s/^\s+|\s+$//g }
            my $display = defined $display_raw ? $display_raw : $path;
            my $is_safe = $path !~ /^[a-zA-Z][a-zA-Z0-9+\-.]*:/;
            $out .= $is_safe
                ? '<a href="' . _esc($path) . '" class="obsidian-link">' . _esc($display) . '</a>'
                : _esc($full);
            $i += length $full; next;
        }

        # ── Strong  **...**  ─────────────────────────────────
        if ($rest =~ /^(\*\*([^*\n]+)\*\*)/) {
            $out .= '<strong>' . _esc($2) . '</strong>';
            $i += length $1; next;
        }

        # ── Emphasis  *...*  ─────────────────────────────────
        if ($rest =~ /^(\*([^*\n]+)\*)/) {
            $out .= '<em>' . _esc($2) . '</em>';
            $i += length $1; next;
        }

        # ── Delete  ~~...~~  ─────────────────────────────────
        if ($rest =~ /^(~~([^~\n]+)~~)/) {
            $out .= '<del>' . _esc($2) . '</del>';
            $i += length $1; next;
        }

        # ── Insert  ++...++  ─────────────────────────────────
        if ($rest =~ /^(\+\+([^+\n]+)\+\+)/) {
            $out .= '<ins>' . _esc($2) . '</ins>';
            $i += length $1; next;
        }

        # ── Plain: one character ─────────────────────────────
        $out .= _esc(substr($text, $i, 1));
        $i++;
    }

    return $out;
}

# ============================================================
# Tokenizer
# ============================================================
sub _tokenize {
    my ($self, $lines) = @_;
    my @tokens;
    my $mode = undef;  # undef | 'front' | 'shebang' | 'quote' | 'math'

    for my $raw (@$lines) {
        my $t = $raw;
        $t =~ s/^\s+|\s+$//g;

        # ── inside front matter ──────────────────────────────
        if (defined $mode && $mode eq 'front') {
            if ($t eq '@@') { push @tokens, { type => 'front_close' }; $mode = undef; }
            else             { push @tokens, { type => 'front_line', text => $t }; }
            next;
        }

        # ── inside code block ────────────────────────────────
        if (defined $mode && $mode eq 'shebang') {
            if ($t =~ /^\\!#/) {
                (my $unesc = $raw) =~ s/^(\s*)\\(!#.*)$/$1$2/;
                push @tokens, { type => 'code_line', text => $unesc };
            } elsif ($t eq '!#') {
                push @tokens, { type => 'shebang_close' }; $mode = undef;
            } else {
                push @tokens, { type => 'code_line', text => $raw };
            }
            next;
        }

        # ── inside quote block ───────────────────────────────
        if (defined $mode && $mode eq 'quote') {
            if ($t eq '<|') { push @tokens, { type => 'quote_close' }; $mode = undef; }
            else             { push @tokens, { type => 'quote_line', text => $t, empty => ($t eq '') }; }
            next;
        }

        # ── inside math block ────────────────────────────────
        if (defined $mode && $mode eq 'math') {
            if ($t eq '$$') { push @tokens, { type => 'math_close' }; $mode = undef; }
            else             { push @tokens, { type => 'math_line', text => $raw }; }
            next;
        }

        # ── top-level ────────────────────────────────────────
        if ($t eq '')   { push @tokens, { type => 'empty' }; next; }
        if ($t eq '@@') { push @tokens, { type => 'front_open' }; $mode = 'front'; next; }
        if ($t =~ /^-{3,}$/) { push @tokens, { type => 'hr' }; next; }
        if ($t eq '|>') { push @tokens, { type => 'quote_open' }; $mode = 'quote'; next; }
        if ($t eq '$$') { push @tokens, { type => 'math_open'  }; $mode = 'math';  next; }

        # modifier @[key: value]
        if ($t =~ /^\@\[([a-z][a-z0-9-]*): (.*)\]$/) {
            my ($mk, $mv) = ($1, $2);
            if (!$ALLOWED_META_KEYS{$mk} && $mk !~ /^x-[a-z0-9-]+$/) {
                my $allowed = join(', ', sort keys %ALLOWED_META_KEYS);
                $self->_push_diag('E204',
                    qq{"$mk" is not a recognised modifier key. Use: $allowed; or x-<name> for custom data attributes (e.g. \@[x-role: note]).});
                push @tokens, { type => 'text', text => $t }; next;
            }
            push @tokens, { type => 'modifier', key => $mk, value => $mv }; next;
        }

        # shebang / code block open
        if ($t =~ /^#!/) {
            my $lang = $self->_detect_lang($t);
            push @tokens, { type => 'shebang_open', lang => $lang, shebang_line => $t };
            $mode = 'shebang'; next;
        }

        # numbered heading  ::# :::# ...
        if ($t =~ /^(:{2,6})#\s+(.*)/) {
            push @tokens, { type => 'heading', colons => length($1), numbered => 1, text => $2 }; next;
        }

        # plain heading  :: ::: ...
        if ($t =~ /^(:{2,6})\s+(.*)/) {
            push @tokens, { type => 'heading', colons => length($1), numbered => 0, text => $2 }; next;
        }

        # heading overflow (7+ colons) → E402
        if ($t =~ /^(:{7,})(?:\s|#\s)/) {
            my $n = length $1;
            $self->_push_diag('E402',
                "$n colons exceed h6 (the deepest heading in HTML). Use 2–6 colons: \":: h2\" … \":::::: h6\". Line kept as plain text.");
            push @tokens, { type => 'text', text => $t }; next;
        }

        # inline blockquote  > ...
        if ($t =~ /^> (.+)/) {
            push @tokens, { type => 'bq_inline', text => $1 }; next;
        }

        # := definition block (top-level only)
        if ($raw =~ /^:=\s+(.*)/) {
            push @tokens, { type => 'def_term', text => $1 }; next;
        }
        if ($raw =~ /^( +):=\s+(.*)/) {
            my ($ind, $term) = ($1, $2);
            $self->_push_diag('E403',
                qq{Definition syntax ":= $term" is top-level only. Remove indentation and place it outside lists.});
            push @tokens, { type => 'text', text => $t }; next;
        }

        # `: ` para block
        if ($t =~ /^: (.+)/) {
            push @tokens, { type => 'para_block', text => $1 }; next;
        }

        # task list  [ ] / [x]
        if ($raw =~ /^(\s*)\[([ x])\]\s+(.*)/) {
            push @tokens, { type => 'task', indent => length($1), checked => (lc($2) eq 'x'), text => $3 }; next;
        }

        # odd-indent list items → E401
        if ($raw =~ /^( +)([#\-\?=])\s+/) {
            my $ind = length $1;
            if ($ind % 2 != 0) {
                $self->_push_diag('E401',
                    "List item has $ind leading space(s); nesting uses two-space steps (0, 2, 4, …). Item kept as plain text.");
                push @tokens, { type => 'text', text => $t }; next;
            }
        }

        # ul: - item
        if ($raw =~ /^((?:  )*)-\s+(.*)/ && $t !~ /^-\[/) {
            push @tokens, { type => 'ul', indent => length($1), text => $2 }; next;
        }

        # casual DL: ? term (top-level only)
        if ($raw =~ /^((?:  )*)\?\s+(.*)/) {
            my ($ind, $term) = ($1, $2);
            if (length $ind > 0) {
                $self->_push_diag('E403',
                    qq{Casual DL term "? $term" is top-level only. Remove indentation and place it outside lists.});
                push @tokens, { type => 'text', text => $t }; next;
            }
            push @tokens, { type => 'dl_dt', indent => 0, text => $term }; next;
        }

        # casual DL: = desc (top-level only)
        if ($raw =~ /^((?:  )*)=\s+(.*)/) {
            my ($ind, $desc) = ($1, $2);
            if (length $ind > 0) {
                $self->_push_diag('E403',
                    qq{Casual DL description "= $desc" is top-level only. Remove indentation and place it outside lists.});
                push @tokens, { type => 'text', text => $t }; next;
            }
            push @tokens, { type => 'dl_dd', indent => 0, text => $desc }; next;
        }

        # ol: # item
        if ($raw =~ /^((?:  )*)#\s+(.*)/) {
            push @tokens, { type => 'ol', indent => length($1), text => $2 }; next;
        }

        # ExternalEmbed block  !!URL!! or !!URL|alt!!
        if ($t =~ /^!!(https:\/\/[^ |!\n]+)(?:[| ]([^!\n]*))?!!$/) {
            my ($url, $alt) = ($1, $2);
            $url =~ s/^\s+|\s+$//g;
            $alt =~ s/^\s+|\s+$//g if defined $alt;
            push @tokens, { type => 'external_embed', url => $url, alt => (defined $alt && length $alt ? $alt : undef) }; next;
        }

        # URL standalone line
        if ($t =~ m{^https://\S+$}) {
            push @tokens, { type => 'url', url => $t }; next;
        }

        # ObsidianEmbed ![[path]] or ![[path|alt]]
        if ($t =~ /^!\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]$/) {
            my ($path, $alt) = ($1, $2);
            $path =~ s/^\s+|\s+$//g;
            $alt  =~ s/^\s+|\s+$//g if defined $alt;
            push @tokens, { type => 'obsidian_embed', path => $path, alt => $alt }; next;
        }

        # plain text
        push @tokens, { type => 'text', text => $t };
    }

    # unterminated block warnings
    if (defined $mode) {
        if ($mode eq 'front')   { $self->_push_diag('W203', 'Unterminated front matter: @@ was opened but the closing @@ was not found before EOF.') }
        if ($mode eq 'shebang') { $self->_push_diag('W001', 'Unterminated code block: #!lang was opened but the closing !# was not found before EOF.') }
        if ($mode eq 'quote')   { $self->_push_diag('W002', 'Unterminated block quote: |> was opened but the closing <| was not found before EOF.') }
        if ($mode eq 'math')    { $self->_push_diag('W003', 'Unterminated math block: $$ was opened but the closing $$ was not found before EOF.') }
    }

    return @tokens;
}

# ============================================================
# AST builder
# ============================================================
sub _build_ast {
    my ($self, $tokens) = @_;
    my @nodes;
    my $i = 0;
    my $n = scalar @$tokens;

    # collect trailing modifier tokens
    my $cm = sub {
        my @mods;
        while ($i < $n && $tokens->[$i]{type} eq 'modifier') {
            push @mods, $tokens->[$i++];
        }
        return \@mods;
    };
    my $reserve_non_heading_mod_id = sub {
        my ($mods) = @_;
        my @id_indexes = grep { $mods->[$_]{key} eq 'id' } 0 .. $#$mods;
        return $mods unless @id_indexes;
        my $last = $id_indexes[-1];
        $mods->[$last]{value} = $self->_reserve_anchor_id($mods->[$last]{value}, '@[id]');
        return $mods;
    };

    # recursive list parser
    my $parse_list_items; # forward declare
    $parse_list_items = sub {
        my ($base_indent, $list_type) = @_;
        my @items;
        while ($i < $n) {
            my $tok = $tokens->[$i];
            my $tok_type = $tok->{type};
            my $type_ok  = !defined($list_type) || $tok_type eq $list_type;
            my $is_list  = ($tok_type eq 'ul' || $tok_type eq 'ol');
            if ($is_list && $tok->{indent} == $base_indent && $type_ok) {
                $i++;
                my $item = { list_type => $tok_type, text => $tok->{text}, children => undef };
                if ($i < $n) {
                    my $next = $tokens->[$i];
                    if (($next->{type} eq 'ul' || $next->{type} eq 'ol')
                        && $next->{indent} == $base_indent + 2) {
                        $item->{children} = $parse_list_items->($next->{indent});
                    }
                }
                push @items, $item;
            } else {
                last;
            }
        }
        return \@items;
    };

    # front matter key validation
    my $is_allowed_fm_key = sub {
        my ($k) = @_;
        return $ALLOWED_FRONT_MATTER_KEYS{$k} || $k =~ /^x-[a-z0-9-]+$/;
    };

    my $parse_front_lines = sub {
        my ($lines) = @_;
        my %meta;
        for my $line (@$lines) {
            next if $line =~ /^\s*#/;
            if ($line =~ /^([a-z][a-z0-9-]*): (.*)$/) {
                my ($key, $val) = ($1, $2);
                if (!$is_allowed_fm_key->($key)) {
                    $self->_push_diag('E201',
                        qq{"$key" is not a recognised front matter key. Allowed: title, author, date, updated, description, tags, slug, lang; or x-* for custom metadata.});
                    next;
                }
                $val =~ s/\s+#.*$//;
                $meta{$key} = $val;
            } else {
                if ($line ne '') {
                    $self->_push_diag('W202',
                        qq{Malformed front matter line: "$line". Expected format: "key: value".});
                }
            }
        }
        return \%meta;
    };

    while ($i < $n) {
        my $tok = $tokens->[$i];

        if ($tok->{type} eq 'empty') { $i++; next; }

        # ── front matter ─────────────────────────────────────
        if ($tok->{type} eq 'front_open') {
            $i++;
            my @lines;
            while ($i < $n && $tokens->[$i]{type} ne 'front_close') {
                push @lines, $tokens->[$i++]{text} // '';
            }
            $i++ if $i < $n && $tokens->[$i]{type} eq 'front_close';
            push @nodes, { type => 'frontmatter', meta => $parse_front_lines->(\@lines) };
            next;
        }

        # ── hr ───────────────────────────────────────────────
        if ($tok->{type} eq 'hr') { $i++; push @nodes, { type => 'hr' }; next; }

        # ── heading ──────────────────────────────────────────
        if ($tok->{type} eq 'heading') {
            $i++;
            my $mods = $cm->();
            my @id_mods = map { $_->{value} } grep { $_->{key} eq 'id' } @$mods;
            if    (@id_mods == 1) {
                $self->_push_diag('W802',
                    qq{\@[id: ...] on heading overrides the auto-generated heading id. Using "$id_mods[0]".});
            } elsif (@id_mods > 1) {
                my $last = $id_mods[-1];
                $self->_push_diag('E205',
                    qq{Multiple \@[id: ...] modifiers were provided on one heading. Use only one id modifier; rendering uses the last id "$last".});
            }
            my $custom_id = @id_mods ? $id_mods[-1] : undef;
            my @other_mods = grep { $_->{key} ne 'id' } @$mods;
            my $id = $self->_reserve_anchor_id($custom_id // $tok->{text},
                                               defined $custom_id ? 'heading @[id]' : 'heading');
            push @nodes, {
                type    => 'heading',
                level   => $tok->{colons},
                id      => $id,
                label   => $tok->{text},
                numbered=> $tok->{numbered},
                attrs   => $self->_build_attrs(\@other_mods),
            };
            next;
        }

        # ── inline blockquote ─────────────────────────────────
        if ($tok->{type} eq 'bq_inline') {
            $i++;
            my $mods = $reserve_non_heading_mod_id->($cm->());
            push @nodes, { type => 'blockquote_inline', html => $self->_parse_inline($tok->{text}), mods => $mods };
            next;
        }

        # ── quote block ──────────────────────────────────────
        if ($tok->{type} eq 'quote_open') {
            $i++;
            my @line_groups = ([]);
            while ($i < $n && $tokens->[$i]{type} ne 'quote_close') {
                my $qt = $tokens->[$i++];
                if ($qt->{type} eq 'quote_line') {
                    if ($qt->{empty}) { push @line_groups, [] }
                    else              { push @{ $line_groups[-1] }, $qt->{text} }
                }
            }
            $i++ if $i < $n && $tokens->[$i]{type} eq 'quote_close';
            my $mods = $reserve_non_heading_mod_id->($cm->());
            my @paragraphs = map { join('<br>', map { $self->_parse_inline($_) } @$_) }
                             grep { @$_ > 0 } @line_groups;
            my $cite   = _find_mod_value($mods, 'cite')   // '';
            my $author = _find_mod_value($mods, 'author') // '';
            push @nodes, { type => 'blockquote_block', paragraphs => \@paragraphs,
                           cite => $cite, author => $author, mods => $mods };
            next;
        }

        # ── math block ───────────────────────────────────────
        if ($tok->{type} eq 'math_open') {
            $i++;
            my @lines;
            while ($i < $n && $tokens->[$i]{type} ne 'math_close') {
                push @lines, $tokens->[$i++]{text} // '';
            }
            $i++ if $i < $n && $tokens->[$i]{type} eq 'math_close';
            my $mods = $reserve_non_heading_mod_id->($cm->());
            push @nodes, { type => 'math', lines => \@lines, mods => $mods };
            next;
        }

        # ── := definition block ───────────────────────────────
        if ($tok->{type} eq 'def_term') {
            $i++;
            my $term = $tok->{text};
            my @dd_lines;
            my $pending_break = 0;
            while ($i < $n) {
                my $dt = $tokens->[$i];
                if ($dt->{type} eq 'empty') {
                    $pending_break = 1 if @dd_lines;
                    $i++; next;
                }
                if ($dt->{type} eq 'text') {
                    push @dd_lines, '' if $pending_break;
                    $pending_break = 0;
                    push @dd_lines, $dt->{text};
                    $i++; next;
                }
                last;
            }
            if (!@dd_lines) {
                $self->_push_diag('E403',
                    qq{Definition term "$term" has no body text. Add at least one paragraph after the := line.});
            }
            my $term_key = lc($term);
            $term_key =~ s/^\s+|\s+$//g;
            if ($self->{_def_terms}{$term_key}) {
                $self->_push_diag('E404',
                    qq{Definition term "$term" is defined more than once. Terms must be unique (case-insensitive).});
            } else {
                $self->{_def_terms}{$term_key} = 1;
            }
            my $mods     = $reserve_non_heading_mod_id->($cm->());
            my $term_html = $self->_parse_inline($term);
            my $term_id   = $self->_reserve_anchor_id($term, 'definition term');
            my $dd_html   = join("\n", map { '<p>' . $self->_parse_inline($_) . '</p>' } @dd_lines);
            push @nodes, { type => 'def_block', term => $term, term_id => $term_id,
                           term_html => $term_html, dd_lines => \@dd_lines,
                           dd_html => $dd_html, mods => $mods };
            next;
        }

        # ── code block ───────────────────────────────────────
        if ($tok->{type} eq 'shebang_open') {
            my ($lang, $shebang_line) = ($tok->{lang}, $tok->{shebang_line});
            $i++;
            my @code_lines;
            while ($i < $n && $tokens->[$i]{type} ne 'shebang_close') {
                push @code_lines, $tokens->[$i]{type} eq 'code_line' ? $tokens->[$i]{text} : '';
                $i++;
            }
            $i++ if $i < $n && $tokens->[$i]{type} eq 'shebang_close';
            my $mods  = $reserve_non_heading_mod_id->($cm->());
            my $title = _find_mod_value($mods, 'title') // '';
            my $cite  = _find_mod_value($mods, 'cite')  // '';
            push @nodes, { type => 'codeblock', shebang_line => $shebang_line, lang => $lang,
                           lines => \@code_lines, title => $title, cite => $cite, mods => $mods };
            next;
        }

        # ── task list ─────────────────────────────────────────
        if ($tok->{type} eq 'task') {
            my @items;
            while ($i < $n && $tokens->[$i]{type} eq 'task') {
                push @items, { list_type => 'task', checked => $tokens->[$i]{checked}, text => $tokens->[$i]{text} };
                $i++;
            }
            my $mods = $reserve_non_heading_mod_id->($cm->());
            push @nodes, { type => 'list', html => $self->_render_list_items(\@items), mods => $mods };
            next;
        }

        # ── casual DL  ? term + = desc  ──────────────────────
        if ($tok->{type} eq 'dl_dt' && $tok->{indent} == 0) {
            my @entries;
            while ($i < $n && $tokens->[$i]{type} eq 'dl_dt' && $tokens->[$i]{indent} == 0) {
                my $term = $tokens->[$i++]{text};
                my @dd;
                while ($i < $n && $tokens->[$i]{type} eq 'dl_dd' && $tokens->[$i]{indent} == 0) {
                    push @dd, $tokens->[$i++]{text};
                }
                if (!@dd) {
                    $self->_push_diag('E403',
                        qq{Definition term "$term" has no body text. Add at least one "= " line after the "? " line.});
                    push @nodes, { type => 'paragraph', html => $self->_parse_inline("? $term") };
                } else {
                    push @entries, { term => $term, dd_lines => \@dd };
                }
            }
            if (@entries) {
                my $html = "<dl>\n" .
                    join("\n", map {
                        '  <dt>' . $self->_parse_inline($_->{term}) . '</dt>' .
                        '<dd>' . join('<br>' . "\n", map { $self->_parse_inline($_) } @{ $_->{dd_lines} }) . '</dd>'
                    } @entries) .
                    "\n</dl>";
                my $mods = $reserve_non_heading_mod_id->($cm->());
                push @nodes, { type => 'list', html => $html, mods => $mods };
            }
            next;
        }

        # ── ul / ol ───────────────────────────────────────────
        if ($tok->{type} eq 'ul' || $tok->{type} eq 'ol') {
            my $items = $parse_list_items->($tok->{indent}, $tok->{type});
            my $mods  = $reserve_non_heading_mod_id->($cm->());
            push @nodes, { type => 'list', html => $self->_render_list_items($items), mods => $mods };
            next;
        }

        # ── orphan dl_dd ─────────────────────────────────────
        if ($tok->{type} eq 'dl_dd') {
            $self->_push_diag('E403',
                qq{Casual DL description "$tok->{text}" has no matching "? term" above it. Add a "? term" line immediately before it.});
            $i++;
            push @nodes, { type => 'paragraph', html => $self->_parse_inline($tok->{text}) };
            next;
        }

        # ── URL standalone ───────────────────────────────────
        if ($tok->{type} eq 'url') {
            my @group;
            while ($i < $n && $tokens->[$i]{type} eq 'url') {
                push @group, $tokens->[$i++]{url};
                $cm->(); # consume modifiers (ignored for URL blocks per spec)
            }
            for my $url (@group) {
                if (_is_safe_url($url)) {
                    push @nodes, { type => 'autolink', url => $url, label => _get_hostname($url) };
                } else {
                    push @nodes, { type => 'paragraph', html => _esc($url) };
                }
            }
            next;
        }

        # ── ObsidianEmbed ![[...]] ────────────────────────────
        if ($tok->{type} eq 'obsidian_embed') {
            $i++;
            my $mods = $cm->();
            my @alt_mod = defined $tok->{alt} ? ({ key => 'alt', value => $tok->{alt} }) : ();
            my @safe_mods = grep { $_->{key} ne 'alt' } @$mods;
            push @nodes, { type => 'figure', images => [{ url => $tok->{path}, mods => [@alt_mod, @safe_mods] }] };
            next;
        }

        # ── ExternalEmbed block !!URL!! ───────────────────────
        if ($tok->{type} eq 'external_embed') {
            $i++;
            my $mods = $cm->();
            push @nodes, { type => 'external_embed', url => $tok->{url}, alt => $tok->{alt}, mods => $mods };
            next;
        }

        # ── `: ` para_block ───────────────────────────────────
        if ($tok->{type} eq 'para_block') {
            my @lines = ($tok->{text});
            $i++;
            while ($i < $n && $tokens->[$i]{type} eq 'para_block') {
                push @lines, $tokens->[$i++]{text};
            }
            my $mods = $reserve_non_heading_mod_id->($cm->());
            push @nodes, { type => 'paragraph',
                           html => join("<br>\n", map { $self->_parse_inline($_) } @lines),
                           mods => $mods };
            next;
        }

        # ── plain text paragraph ─────────────────────────────
        if ($tok->{type} eq 'text') {
            my @lines = ($tok->{text});
            $i++;
            while ($i < $n && $tokens->[$i]{type} eq 'text') {
                push @lines, $tokens->[$i++]{text};
            }
            push @nodes, { type => 'paragraph',
                           html => join("<br>\n", map { $self->_parse_inline($_) } @lines) };
            next;
        }

        # ── orphan modifier → W801 ────────────────────────────
        if ($tok->{type} eq 'modifier') {
            $self->_push_diag('W801',
                "\@[$tok->{key}: $tok->{value}] was not applied to any block. Place it on the line immediately after a supported block with no blank line in between.");
        }
        $i++;
    }

    return @nodes;
}

# ============================================================
# List renderer (recursive)
# ============================================================
sub _render_list_items {
    my ($self, $items) = @_;
    return '' unless $items && @$items;

    # group consecutive items by list_type
    my @groups;
    my $cur;
    for my $item (@$items) {
        if (!$cur || $cur->{type} ne $item->{list_type}) {
            $cur = { type => $item->{list_type}, items => [] };
            push @groups, $cur;
        }
        push @{ $cur->{items} }, $item;
    }

    my $html = '';
    for my $group (@groups) {
        my $is_task = $group->{type} eq 'task';
        my $tag     = $group->{type} eq 'ol' ? 'ol' : 'ul';
        $html .= "\n" if $html;
        $html .= "<$tag>\n";
        for my $item (@{ $group->{items} }) {
            if ($is_task) {
                my $chk = $item->{checked} ? ' checked' : '';
                $html .= "  <li class=\"task-item\"><input type=\"checkbox\" disabled$chk> "
                       . $self->_parse_inline($item->{text}) . "</li>\n";
            } else {
                $html .= "  <li>" . $self->_parse_inline($item->{text});
                if ($item->{children}) {
                    my $child_html = $self->_render_list_items($item->{children});
                    $child_html =~ s/^/  /mg;
                    $html .= "\n$child_html\n  ";
                }
                $html .= "</li>\n";
            }
        }
        $html .= "</$tag>";
    }
    return $html;
}

# ============================================================
# HTML renderer
# ============================================================
sub _ast_to_html {
    my ($self, $nodes) = @_;

    my @parts;
    for my $node (@$nodes) {
        my $type = $node->{type};

        if ($type eq 'frontmatter') {
            my @entries = %{ $node->{meta} };
            next unless @entries;
            my $h = "<dl class=\"front-matter\">\n";
            my %m = %{ $node->{meta} };
            for my $k (sort keys %m) {
                $h .= "  <dt>" . _esc($k) . "</dt><dd>" . _esc($m{$k}) . "</dd>\n";
            }
            $h .= "</dl>";
            push @parts, $h; next;
        }

        if ($type eq 'hr') { push @parts, '<hr>'; next; }

        if ($type eq 'heading') {
            my $attrs = $node->{attrs} // '';
            if ($node->{numbered}) {
                if ($attrs =~ /\sclass="([^"]*)"/) {
                    (my $new = $attrs) =~ s/\sclass="([^"]*)"/ class="numbered $1"/;
                    $attrs = $new;
                } else {
                    $attrs = ' class="numbered"' . $attrs;
                }
            }
            my $lv  = $node->{level};
            my $id  = _esc($node->{id});
            my $lbl = _esc($node->{label});
            push @parts, "<h$lv id=\"$id\"$attrs><a href=\"#$id\">$lbl</a></h$lv>"; next;
        }

        if ($type eq 'blockquote_inline') {
            my $attrs = $self->_build_attrs($node->{mods});
            push @parts, "<blockquote$attrs><p>$node->{html}</p></blockquote>"; next;
        }

        if ($type eq 'blockquote_block') {
            my $attrs = $self->_build_attrs($node->{mods});
            my $h = "<blockquote$attrs>\n";
            for my $p (@{ $node->{paragraphs} }) { $h .= "  <p>$p</p>\n" }
            if ($node->{cite} || $node->{author}) {
                $h .= "  <footer>\n";
                if ($node->{cite}) {
                    my $cu = _is_safe_url($node->{cite});
                    my $c  = $cu ? _ext_link($node->{cite}, _esc(_get_hostname($node->{cite}))) : _esc($node->{cite});
                    $h .= "    <cite>$c</cite>\n";
                }
                if ($node->{author}) {
                    $h .= "    <span class=\"author\"> — " . _esc($node->{author}) . "</span>\n";
                }
                $h .= "  </footer>\n";
            }
            $h .= "</blockquote>";
            push @parts, $h; next;
        }

        if ($type eq 'math') {
            my $attrs = $self->_merge_attrs('math-block', $node->{mods});
            my $code  = join("\n", map { _esc($_) } @{ $node->{lines} });
            push @parts, "<pre$attrs><code>$code</code></pre>"; next;
        }

        if ($type eq 'def_block') {
            my $attrs = $self->_merge_attrs('def-block', $node->{mods});
            my $tid   = _esc($node->{term_id});
            push @parts, "<dl$attrs><dt id=\"$tid\"><a href=\"#$tid\">$node->{term_html}</a></dt><dd>$node->{dd_html}</dd></dl>"; next;
        }

        if ($type eq 'list') {
            my $attrs = $self->_build_attrs($node->{mods});
            if (!$attrs) { push @parts, $node->{html}; next; }
            (my $html = $node->{html}) =~ s/^<(ul|ol|dl)/<$1$attrs/;
            push @parts, $html; next;
        }

        if ($type eq 'codeblock') {
            my $base  = $node->{lang} ? "blogable-code language-$node->{lang}" : 'blogable-code';
            my $attrs = $self->_merge_attrs($base, $node->{mods});
            my $all_lines = [$node->{shebang_line}, @{ $node->{lines} }];
            my $h = "<figure$attrs>\n";
            if ($node->{title} || $node->{lang}) {
                my $t = _esc($node->{title});
                my $l = $node->{lang} ? " <span class=\"lang-badge\">" . _esc($node->{lang}) . "</span>" : '';
                $h .= "  <figcaption>$t$l</figcaption>\n";
            }
            my $lang_attr = $node->{lang} ? ' class="language-' . _esc($node->{lang}) . '"' : '';
            my $code_content = join("\n", map { _esc($_) } @$all_lines);
            $h .= "  <pre><code$lang_attr>$code_content</code></pre>\n";
            if ($node->{cite}) {
                my $cu = _is_safe_url($node->{cite});
                my $c  = $cu ? _ext_link($node->{cite}, _esc(_get_hostname($node->{cite}))) : _esc($node->{cite});
                $h .= "  <cite>$c</cite>\n";
            }
            $h .= "</figure>";
            push @parts, $h; next;
        }

        if ($type eq 'figure') {
            my @images = @{ $node->{images} };
            # find title/cite from last image that has them
            my $lt = do {
                my ($found) = reverse grep { _find_mod_value($_->{mods}, 'title') } @images;
                $found ? _find_mod_value($found->{mods}, 'title') : undef;
            };
            my $lc = do {
                my ($found) = reverse grep { _find_mod_value($_->{mods}, 'cite') } @images;
                $found ? _find_mod_value($found->{mods}, 'cite') : undef;
            };
            my $h = "<figure class=\"blogable-figure\">\n";
            for my $img (@images) {
                my $alt   = _find_mod_value($img->{mods}, 'alt')   // '';
                my $title = _find_mod_value($img->{mods}, 'title') // '';
                my @x_attrs = map { 'data-' . _esc(substr($_->{key},2)) . '="' . _esc($_->{value}) . '"' }
                              grep { $_->{key} =~ /^x-[a-z0-9-]+$/ } @{ $img->{mods} };
                my $x = @x_attrs ? ' ' . join(' ', @x_attrs) : '';
                my $t_attr = $title ? ' title="' . _esc($title) . '"' : '';
                $h .= "  <img src=\"" . _esc($img->{url}) . "\" alt=\"" . _esc($alt) . "\"$t_attr loading=\"lazy\" decoding=\"async\"$x>\n";
            }
            $h .= "  <figcaption>" . _esc($lt) . "</figcaption>\n" if defined $lt;
            if (defined $lc) {
                my $cu = _is_safe_url($lc);
                $h .= "  <cite>" . ($cu ? _ext_link($lc, _esc(_get_hostname($lc))) : _esc($lc)) . "</cite>\n";
            }
            $h .= "</figure>";
            push @parts, $h; next;
        }

        if ($type eq 'autolink') {
            push @parts, "<p>" . _ext_link($node->{url}, _esc($node->{label})) . "</p>"; next;
        }

        if ($type eq 'external_embed') {
            my $url = $node->{url};
            if (!_is_safe_url($url)) { push @parts, "<p>" . _esc($url) . "</p>"; next; }
            my $alt   = $node->{alt} // _find_mod_value($node->{mods}, 'alt')   // '';
            my $title = _find_mod_value($node->{mods}, 'title') // '';
            if (_is_image_url($url)) {
                my $t_attr = $title ? ' title="' . _esc($title) . '"' : '';
                push @parts, "<figure class=\"blogable-figure\">\n  <img src=\"" . _esc($url) . "\" alt=\"" . _esc($alt) . "\"$t_attr loading=\"lazy\" decoding=\"async\">\n</figure>"; next;
            }
            if (_is_video_url($url)) {
                my $fc = $title ? "  <figcaption>" . _esc($title) . "</figcaption>\n" : '';
                push @parts, "<figure class=\"blogable-figure\">\n  <video src=\"" . _esc($url) . "\" controls loading=\"lazy\">" . ($alt ? _esc($alt) : '') . "</video>\n$fc</figure>"; next;
            }
            my $label = $alt || _get_hostname($url);
            push @parts, "<p>" . _ext_link($url, _esc($label)) . "</p>"; next;
        }

        if ($type eq 'paragraph') {
            my $attrs = $node->{mods} ? $self->_build_attrs($node->{mods}) : '';
            push @parts, "<p$attrs>$node->{html}</p>"; next;
        }
    }

    my $html = join("\n", @parts);

    # ── footnotes ─────────────────────────────────────────────
    if (@{ $self->{_footnotes} }) {
        my $fn = "<footer class=\"blogable-footnotes\">\n<ol>\n";
        for my $f (@{ $self->{_footnotes} }) {
            my $body;
            if ($f->{url}) {
                $body = _ext_link($f->{url}, _esc(_get_hostname($f->{url})))
                      . " <span class=\"fn-alt\">" . _esc($f->{text}) . "</span>";
            } else {
                $body = _esc($f->{text});
            }
            $fn .= "  <li id=\"fn-$f->{n}\">$body <a href=\"#fnref-$f->{n}\" class=\"fn-back\">↩</a></li>\n";
        }
        $fn .= "</ol>\n</footer>";
        $html .= "\n$fn";
    }

    return $html;
}

1;
__END__

=encoding utf-8

=head1 NAME

Text::Blogable - Blogable v1.1-alpha markup to HTML converter

=head1 SYNOPSIS

    use Text::Blogable;

    my $b    = Text::Blogable->new();
    my $html = $b->parse($blogable_source);
    my $diags = $b->diagnostics();   # arrayref of { code => '...', message => '...' }

=head1 DESCRIPTION

C<Text::Blogable> converts Blogable v1.1-alpha markup to HTML.
Blogable is a deterministic, single-pass markup language with semantic
output and strict diagnostics.

Parsing proceeds in three stages:

=over 4

=item 1. Tokenise

=item 2. Build AST

=item 3. Render AST → HTML

=back

=head1 METHODS

=head2 new

    my $b = Text::Blogable->new();

Creates a new converter instance.

=head2 parse

    my $html = $b->parse($source);

Parses the given Blogable source text and returns the corresponding HTML
string.  Each call resets internal state (diagnostics, footnotes, anchor
IDs) so the same instance may be reused for multiple documents.

=head2 diagnostics

    my $diags = $b->diagnostics();

Returns an array-reference of diagnostic hashes produced by the most
recent C<parse()> call.  Each hash contains:

    { code => 'W001', message => 'Unterminated code block …' }

Diagnostic codes follow the spec numbering policy defined in
F<V1.1-alpha_spec_Blogable.txt>.

=head1 SUPPORTED SYNTAX

=over 4

=item Front matter  C<@@ … @@>

=item Headings  C<:: h2> through C<:::::: h6> (plain and numbered with C<#>)

=item Horizontal rules  C<--->

=item Code blocks  C<#!lang … !#>

=item Quote blocks  C<|> … <|>

=item Math blocks  C<$$ … $$>

=item Definition blocks  C<:= Term>

=item Casual definition lists  C<? Term> / C<= Desc>

=item Unordered lists  C<- item>

=item Ordered lists  C<# item>

=item Task lists  C<[ ] item> / C<[x] item>

=item URL auto-links  C<https://…>

=item ObsidianEmbed  C<![[path|alt]]>

=item ExternalEmbed  C<!!URL|alt!!>

=item Inline: bold, italic, delete, insert, inline code, footnotes, ObsidianAnchor, ObsidianLink

=item Block modifiers  C<@[key: value]>

=back

=head1 DIAGNOSTICS

All diagnostic codes from the Blogable v1.1-alpha specification are
implemented: W001–W003, E201, W202–W203, E204–E205, E401–E405,
W601, W801–W802.

=head1 AUTHOR

Port of the JavaScript Blogable v1.1-alpha parser by worthmine (Yuki Yoshida).

=head1 LICENSE

Same as the parent repository.

=cut
