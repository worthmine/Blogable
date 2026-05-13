// ============================================================
// Prism: blogable カスタム言語
// ============================================================
Prism.languages.blogable = {
  'shebang':       { pattern:/^#!.+$/m,            alias:'comment' },
  'shebang-close': { pattern:/^!#$/m,               alias:'keyword' },
  'front-fence':   { pattern:/^@@$/m,               alias:'keyword' },
  'math-fence':    { pattern:/^\$\$$/m,             alias:'keyword' },
  'hr':            { pattern:/^-{3,}$/m,            alias:'punctuation' },
  'quote-fence':   { pattern:/^\|>$|^<\|$/m,        alias:'string' },
  'modifier': {
    pattern:/^@\[[a-z][a-z0-9-]*:.*\]$/m,
    inside:{
      'modifier-bracket':{ pattern:/^@\[|\]$/,                  alias:'punctuation' },
      'modifier-key':    { pattern:/(?<=^@\[)[a-z][a-z0-9-]*/, alias:'attr-name' },
      'modifier-sep':    { pattern:/:\s*/,                      alias:'punctuation' },
      'modifier-value':  { pattern:/.+(?=\]$)/,                 alias:'attr-value' },
    }
  },
  'def-block':     { pattern:/^:=\s+.+$/m,          alias:'variable' },
  'para-block':    { pattern:/^: .+$/m, inside:{ 'para-marker':{ pattern:/^: /, alias:'punctuation' } } },
  'heading-numbered':{ pattern:/^:{2,6}#.+$/m, inside:{ 'hm':{ pattern:/^:{2,6}#/, alias:'punctuation' }, 'ht':{ pattern:/.+/, alias:'bold' } } },
  'heading':         { pattern:/^:{2,6} .+$/m, inside:{ 'hm':{ pattern:/^:{2,6}/, alias:'punctuation' }, 'ht':{ pattern:/.+/, alias:'bold' } } },
  'bq-inline':     { pattern:/^> .+$/m,             alias:'string' },
  'task-done':     { pattern:/^\[x\] .+$/mi,          alias:'inserted' },
  'task-open':     { pattern:/^\[ \] .+$/m,          alias:'punctuation' },
  'url-block':     { pattern:/^https:\/\/\S+$/m,     alias:'url' },
  'external-embed': { pattern:/!!https:\/\/[^!\n]+!!/,               alias:'url' },
  'footnote':      { pattern:/\[\^[^\]]+\]/,         alias:'symbol' },
  'obsidian-embed':  { pattern:/^!\[\[[^\]\n]+\]\]$/m,   alias:'url' },
  'obsidian-anchor': { pattern:/\[\[#[^\]\n]+\]\]/,     alias:'symbol' },
  'obsidian-link':   { pattern:/\[\[[^#\]\|\n][^\]\|\n]*(?:#[^\]\|\n]+)?(?:\|[^\]\n]*)?\]\]/, alias:'url' },
  'bold':    { pattern:/\*\*[^*\n]+\*\*/ },
  'italic':  { pattern:/\*[^*\n]+\*/ },
  'ins':     { pattern:/\+\+[^+\n]+\+\+/, alias:'inserted' },
  'del':     { pattern:/~~[^~\n]+~~/,     alias:'deleted' },
  'code-inline': { pattern:/`[^`\n]*`/,   alias:'code' },
  'ol': { pattern:/^\s*# .+$/m, inside:{ 'ol-marker':{ pattern:/^\s*# /, alias:'punctuation' } } },
  'ul': { pattern:/^\s*- .+$/m,        inside:{ 'ul-marker':{ pattern:/^\s*- /, alias:'punctuation' } } },
};

Prism.languages.ebnf = {
  'comment': /\(\*[\s\S]*?\*\)/,
  'string': { pattern:/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/, greedy:true },
  'definition': { pattern:/^\s*[A-Za-z_][A-Za-z0-9_-]*(?=\s*=)/m },
  'rule': /\b[A-Za-z_][A-Za-z0-9_-]*\b/,
  'operator': /[=|;,()[\]{}]/,
};

// ============================================================
// Blogable Parser v1.1-alpha
// ============================================================

// ---- 定数 ----
const IMAGE_EXTS = /\.(jpe?g|png|gif|webp|svg)(\?.*)?$/i; // ObsidianEmbed では SVG も許容
const VIDEO_EXTS = /\.(mp4|webm|ogg|ogv|mov)(\?.*)?$/i;

const SHEBANG_LANG_MAP = {
  python:'python', python3:'python', python2:'python',
  node:'javascript', nodejs:'javascript',
  ruby:'ruby', perl:'perl',
  bash:'bash', sh:'bash', zsh:'bash',
  php:'php', lua:'lua',
  rust:'rust', go:'go', swift:'swift',
  blogable:'blogable',
  ebnf:'ebnf',
};

// MetaKey の許可リスト（spec §Metadata）
const ALLOWED_META_KEYS = new Set(['class','id','title','cite','author','alt']);

// ---- ユーティリティ ----
function slugify(text) {
  return text.trim().toLowerCase()
    .replace(/\s+/g,'-')
    .replace(/[^\w\u3000-\u9fff\u3040-\u309f\u30a0-\u30ff\uff00-\uffef-]/g,'')
    .replace(/-+/g,'-').replace(/^-|-$/g,'');
}
function isImageUrl(url) { try { return IMAGE_EXTS.test(new URL(url).pathname); } catch { return IMAGE_EXTS.test(url); } }
function isVideoUrl(url) { try { return VIDEO_EXTS.test(new URL(url).pathname); } catch { return VIDEO_EXTS.test(url); } }
function getHostname(url) {
  try {
    if (typeof URL==='function') return new URL(url).hostname;
  } catch {}
  // Test and VM harnesses may not provide the URL constructor; keep a deterministic fallback.
  const m=String(url).match(/^https:\/\/([^\/?#]+)/);
  return m ? m[1] : url;
}
function isSafeUrl(url) { return /^https:\/\//.test(url); }
function esc(t) { return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function extLink(href,text) { return `<a href="${esc(href)}" rel="noopener noreferrer" target="_blank">${text}</a>`; }
function detectLang(line) {
  const m = line.match(/^#!(.+)$/);
  if (!m) return '';
  const rest = m[1].trim();
  if (!rest) return '';

  let rawCmd = '';
  if (rest.startsWith('/')) {
    const pathMatch = rest.match(/^\/\S+\/(?:env\s+)?(\S+)/);
    if (!pathMatch) return '';
    rawCmd = pathMatch[1];
  } else {
    rawCmd = rest;
  }

  const cmd = rawCmd.replace(/[0-9.]+$/,'');
  const mapped = SHEBANG_LANG_MAP[cmd] || cmd;
  return mapped.replace(/[^A-Za-z0-9_+.-]/g, '');
}

function buildAttrs(mods) {
  const attrs={}, da=[], classes=[], ids=[];
  for (const {key,value} of mods) {
    if (key==='class') classes.push(value);
    if (key==='id') {
      ids.push(value);
      attrs.id=esc(value);
    }
    if (/^x-[a-z0-9-]+$/.test(key)) da.push(`data-${esc(key.slice(2))}="${esc(value)}"`);
  }
  if (ids.length>1) {
    const finalId=ids[ids.length-1];
    pushDiag('W802',`Multiple @[id: ...] modifiers were provided; using the last id "${finalId}".`);
  }
  if (classes.length) attrs.class=classes.map(c=>esc(c)).join(' ');
  return Object.entries(attrs).map(([k,v])=>` ${k}="${v}"`).join('')+(da.length?' '+da.join(' '):'');
}

// Like buildAttrs but merges any `class` modifier value into an existing baseClass.
function mergeAttrs(baseClass, mods) {
  const extras=(mods||[]).filter(m=>m.key==='class').map(m=>m.value);
  const extraClass=extras.map(c=>esc(c)).join(' ');
  const cls=extraClass?`${baseClass} ${extraClass}`:baseClass;
  return ` class="${cls}"`+buildAttrs((mods||[]).filter(m=>m.key!=='class'));
}

// ---- Demo URL label extension (non-normative) ----
const demoUrlLabelMap={}, demoLabeledUrls=new Set();
/*
// ---- OGP ----
const ogpMap={}, fetchedUrls=new Set();
function buildOfflineTitle(url) {
  try {
    const parsed=new URL(url);
    const host=parsed.hostname.replace(/^www\./,'');
    const parts=parsed.pathname.split('/').filter(Boolean).map(p=>decodeURIComponent(p));
    const tail=parts.length?` / ${parts[parts.length-1]}`:'';
    return `${host}${tail}`;
  } catch {
    return null;
  }
}
async function fetchNewOgps(src) {
  const urls=[...new Set(src.split('\n').map(l=>l.trim()).filter(l=>/^https:\/\/\S+$/.test(l)&&!isImageUrl(l)))].filter(u=>!fetchedUrls.has(u));
  if (!urls.length) return false;
  urls.forEach(u=>fetchedUrls.add(u));
  let updated=false;
  for (const u of urls) {
    const t=buildOfflineTitle(u);
    if (t) { ogpMap[u]=t; updated=true; }
  }
  const el=document.getElementById('ogp-status');
  const count=Object.keys(ogpMap).length;
  el.style.display=count>0?'inline':'none';
  // "URLラベル: ${count}件生成済" = "URL labels: ${count} items generated"
  el.textContent=`URLラベル: ${count}件生成済`;
  return updated;
}
*/
function buildDemoUrlLabel(url) {
  try {
    const parsed=new URL(url);
    const host=parsed.hostname.replace(/^www\./,'');
    const parts=parsed.pathname.split('/').filter(Boolean).map(p=>decodeURIComponent(p));
    const tail=parts.length?` / ${parts[parts.length-1]}`:'';
    return `${host}${tail}`;
  } catch {
    return null;
  }
}
function updateDemoUrlLabelsFromSource(src) {
  const urls=[...new Set(src.split('\n').map(l=>l.trim()).filter(l=>/^https:\/\/\S+$/.test(l)&&!isImageUrl(l)))].filter(u=>!demoLabeledUrls.has(u));
  if (!urls.length) return false;
  urls.forEach(u=>demoLabeledUrls.add(u));
  let updated=false;
  for (const u of urls) {
    const t=buildDemoUrlLabel(u);
    if (t) { demoUrlLabelMap[u]=t; updated=true; }
  }
  const el=document.getElementById('url-label-status');
  if (el) {
    const count=Object.keys(demoUrlLabelMap).length;
    el.style.display=count>0?'inline':'none';
    el.textContent=`URL labels: ${count} generated`;
  }
  return updated;
}
function applyDemoUrlLabelExtension(nodes) {
  return nodes.map(node=>{
    if (node.type!=='autolink') return node;
    const label=demoUrlLabelMap[node.url];
    return label ? {...node, label} : node;
  });
}

// ---- diagnostics ----
let diagnostics=[];
function pushDiag(code,msg){
  diagnostics.push({code,message:msg});
  console.warn(`[${code}] ${msg}`);
}
function getBlogableDiagnostics(){ return diagnostics.slice(); }

// ---- インライン ----
let footnotes=[];
// 内部アンカー解決用のIDマップ（見出し・定義用語）
let anchorIds={};
// ドキュメント内IDの使用回数（重複ID検出用）
let idCounts=new Map();
// 定義用語の重複チェック
let definitionTerms=new Set();

function reserveAnchorId(rawId, sourceLabel='block') {
  const baseId=slugify(rawId)||'section';
  const seenCount=idCounts.get(baseId)||0;
  idCounts.set(baseId, seenCount+1);
  anchorIds[baseId]=true;
  if (seenCount>0) {
    pushDiag('E405',`${sourceLabel} ID "${baseId}" is already in use. Duplicate IDs are not allowed in this document.`);
  }
  return baseId;
}

function parseInline(text) {
  // Single-pass inline parser; implements spec evaluation order:
  // Code > ExternalEmbed > Footnote > ObsidianAnchor > ObsidianLink > Strong > Emphasis > Delete > Insert > Plain
  // Inline elements MUST NOT nest (spec §InlineSyntax).
  // The interior of every matched span is plain-escaped text only — never re-parsed.
  let out = '';
  let i = 0;
  const len = text.length;

  while (i < len) {
    let m;
    const rest = text.slice(i);

    // ── Code  `[^`\n]*`  (CodeChar ≠ ` or NL) ─────────────────
    if ((m = rest.match(/^`([^`\n]*)`/))) {
      out += '<code>' + esc(m[1]) + '</code>';
      i += m[0].length; continue;
    }

    // ── ExternalEmbed  !!HTTPS_URL!! or !!HTTPS_URL|TEXT!! or !!HTTPS_URL TEXT!! ──────────────
    // Inline form: always renders as an external link (block form auto-detects image/video).
    // Separator between URL and alt/label may be "|" or a single space (SP).
    // URLs cannot contain spaces, so SP is unambiguous as a separator.
    if ((m = rest.match(/^!!(https:\/\/[^ |!\n]+)(?:[| ]([^!\n]*))?!!/))) {
      const url = m[1].trim(), label = m[2] ? m[2].trim() : null;
      const display = label || getHostname(url);
      out += isSafeUrl(url) ? extLink(url, esc(display)) : esc(m[0]);
      i += m[0].length; continue;
    }

    // ── Footnote  [^TEXT] ───────────────────────────────────────
    if ((m = rest.match(/^\[\^([^\]\n]*)\]/))) {
      const inner = m[1];
      const urlM = inner.match(/^(https:\/\/\S+) (.+)$/);
      const n = footnotes.length + 1;
      if (urlM && isSafeUrl(urlM[1])) {
        footnotes.push({n, url: urlM[1], text: urlM[2]});
      } else {
        footnotes.push({n, url: null, text: inner});
      }
      out += `<sup><a href="#fn-${n}" id="fnref-${n}">[${n}]</a></sup>`;
      i += m[0].length; continue;
    }

    // ── ObsidianAnchor  [[#ID]] ──────────────────────────────────────────
    if ((m = rest.match(/^\[\[#([^\]\n]+)\]\]/))) {
      const id = m[1], slug = slugify(id);
      if (Object.hasOwn(anchorIds, slug)) {
        out += `<a href="#${esc(slug)}" class="obsidian-anchor">${esc(id)}</a>`;
      } else {
        pushDiag('W601',`[[#${id}]] — target id not found. Define a matching id via heading, definition term, or @[id].`);
        out += esc(id);
      }
      i += m[0].length; continue;
    }

    // ── ObsidianLink  [[PATH]] or [[PATH|DISPLAY]] or [[PATH#HEADING]] or [[PATH#HEADING|DISPLAY]]  ─────────────────────
    if ((m = rest.match(/^\[\[([^#\]\|\n][^\]\|\n]*)(?:\|([^\]\n]*))?\]\]/))) {
      const path = m[1].trim(), display = m[2] !== undefined ? m[2].trim() : m[1].trim();
      // ObsidianLink paths are local/relative only; reject any URL-scheme (e.g. javascript:, data:, https://)
      // path is already trim()ed so no leading whitespace; we reject anything matching scheme syntax at position 0.
      const isSafe = !/^[a-zA-Z][a-zA-Z0-9+\-.]*:/.test(path);
      out += isSafe
        ? `<a href="${esc(path)}" class="obsidian-link">${esc(display)}</a>`
        : esc(m[0]);
      i += m[0].length; continue;
    }

    // ── Strong  **[^*\n]+**  (StrongChar ≠ * or NL) ────────────
    if ((m = rest.match(/^\*\*([^*\n]+)\*\*/))) {
      out += '<strong>' + esc(m[1]) + '</strong>';
      i += m[0].length; continue;
    }

    // ── Emphasis  *[^*\n]+*  (EmphasisChar ≠ * or NL) ──────────
    if ((m = rest.match(/^\*([^*\n]+)\*/))) {
      out += '<em>' + esc(m[1]) + '</em>';
      i += m[0].length; continue;
    }

    // ── Delete  ~~[^~\n]+~~  (DeleteChar ≠ ~ or NL) ────────────
    if ((m = rest.match(/^~~([^~\n]+)~~/))) {
      out += '<del>' + esc(m[1]) + '</del>';
      i += m[0].length; continue;
    }

    // ── Insert  ++[^+\n]++  (InsertChar ≠ + or NL) ────────────
    if ((m = rest.match(/^\+\+([^+\n]+)\+\+/))) {
      out += '<ins>' + esc(m[1]) + '</ins>';
      i += m[0].length; continue;
    }

    // ── Plain: single character ─────────────────────────────────
    out += esc(text[i]);
    i++;
  }

  return out;
}

// ============================================================
// tokenize
// ============================================================
function tokenize(lines) {
  const tokens=[];
  let mode=null; // null | 'shebang' | 'quote' | 'math' | 'front'

  for (const raw of lines) {
    const t=raw.trim();

    // フロントマター
    if (mode==='front') {
      if (t==='@@') { tokens.push({type:'front_close'}); mode=null; }
      else           { tokens.push({type:'front_line', text:t}); }
      continue;
    }
    // シバン内
    if (mode==='shebang') {
      if (t.startsWith('\\!#')) {
        tokens.push({type:'code_line', text:raw.replace(/^(\s*)\\(!#.*)$/, '$1$2')});
      }
      else if (t==='!#') { tokens.push({type:'shebang_close'}); mode=null; }
      else               { tokens.push({type:'code_line', text:raw}); }
      continue;
    }
    // 引用ブロック内
    if (mode==='quote') {
      if (t==='<|') { tokens.push({type:'quote_close'}); mode=null; }
      else           { tokens.push({type:'quote_line', text:t, empty:t===''}); }
      continue;
    }
    // 数式ブロック内
    if (mode==='math') {
      if (t==='$$') { tokens.push({type:'math_close'}); mode=null; }
      else           { tokens.push({type:'math_line', text:raw}); }
      continue;
    }

    // ---- トップレベル ----
    if (t==='')    { tokens.push({type:'empty'}); continue; }
    if (t==='@@')  { tokens.push({type:'front_open'}); mode='front'; continue; }
    if (/^-{3,}$/.test(t)) { tokens.push({type:'hr'}); continue; }
    if (t==='|>')  { tokens.push({type:'quote_open'}); mode='quote'; continue; }
    if (t==='$$')  { tokens.push({type:'math_open'}); mode='math'; continue; }

    // 修飾キー @[key: value]  — SP は単一スペース（spec: SP = " "）
    const modM=t.match(/^@\[([a-z][a-z0-9-]*): (.*)\]$/);
    if (modM) {
      const mk=modM[1];
      if (!ALLOWED_META_KEYS.has(mk) && !/^x-[a-z0-9-]+$/.test(mk)) {
        // [E204] Unknown MetaKey: fall back to literal text (spec: errors fall back safely)
        pushDiag('E204',`"${mk}" is not a recognised modifier key. Use: ${[...ALLOWED_META_KEYS].join(', ')}; or x-<name> for custom data attributes (e.g. @[x-role: note]).`);
        tokens.push({type:'text', text:t}); continue;
      }
      tokens.push({type:'modifier', key:mk, value:modM[2]}); continue;
    }

    // シバン開始
    if (t.startsWith('#!')) {
      const lang=detectLang(t);
      tokens.push({type:'shebang_open', lang, shebangLine:t});
      mode='shebang'; continue;
    }

    // 連番見出し ::# :::# ...
    const numH=t.match(/^(:{2,6})#\s+(.*)/);
    if (numH) { tokens.push({type:'heading', colons:numH[1].length, numbered:true,  text:numH[2]}); continue; }

    // 通常見出し :: ::: ...
    const plnH=t.match(/^(:{2,6})\s+(.*)/);
    if (plnH) { tokens.push({type:'heading', colons:plnH[1].length, numbered:false, text:plnH[2]}); continue; }

    // 見出しレベル超過（7コロン以上） — [E402]: fall back to text
    const overH=t.match(/^(:{7,})(?:\s|#\s)/);
    if (overH) {
      pushDiag('E402',`${overH[1].length} colons exceed h6 (the deepest heading in HTML). Use 2–6 colons: ":: h2" … ":::::: h6". Line kept as plain text.`);
      tokens.push({type:'text', text:t}); continue;
    }

    // 1行引用
    if (t.startsWith('> ')) { tokens.push({type:'bq_inline', text:t.slice(2)}); continue; }

    // := 定義ブロック（行頭のみ。ネスト不可）
    const defM=raw.match(/^:=\s+(.*)/);
    if (defM) { tokens.push({type:'def_term', text:defM[1]}); continue; }
    const nestedDefM=raw.match(/^( +):=\s+(.*)/);
    if (nestedDefM) {
      pushDiag('E403',`Definition syntax ":= ${nestedDefM[2]}" is top-level only. Remove indentation and place it outside lists.`);
      tokens.push({type:'text', text:t}); continue;
    }

    // `: ` 段落ブロック（明示的な段落 — モディファイア使用可）
    const paraM=t.match(/^: (.+)/);
    if (paraM) { tokens.push({type:'para_block', text:paraM[1]}); continue; }

    // タスクリスト
    const taskM=raw.match(/^(\s*)\[([ x])\]\s+(.*)/);
    if (taskM) { tokens.push({type:'task', indent:taskM[1].length, checked:taskM[2].toLowerCase()==='x', text:taskM[3]}); continue; }

    // odd-indent list items — [E401] invalid list indentation, fall back to text
    const oddIndentM=raw.match(/^( +)(#|-|\?|=)\s+/);
    if (oddIndentM && oddIndentM[1].length % 2 !== 0) {
      pushDiag('E401',`List item has ${oddIndentM[1].length} leading space(s); nesting uses two-space steps (0, 2, 4, …). Item kept as plain text.`);
      tokens.push({type:'text', text:t}); continue;
    }

    // ul: - item（インデントはスペースのみ・2個単位）
    const ulM=raw.match(/^((?:  )*)-\s+(.*)/);
    if (ulM && !raw.trim().startsWith('-[')) {
      tokens.push({type:'ul', indent:ulM[1].length, text:ulM[2]}); continue;
    }

    // dl: ? term / = description（インデントはスペースのみ・2個単位）
    const dlTermM=raw.match(/^((?:  )*)\?\s+(.*)/);
    if (dlTermM) {
      if (dlTermM[1].length>0) {
        pushDiag('E403',`Casual DL term "? ${dlTermM[2]}" is top-level only. Remove indentation and place it outside lists.`);
        tokens.push({type:'text', text:t}); continue;
      }
      tokens.push({type:'dl_dt', indent:dlTermM[1].length, text:dlTermM[2]}); continue;
    }

    const dlDescM=raw.match(/^((?:  )*)=\s+(.*)/);
    if (dlDescM) {
      if (dlDescM[1].length>0) {
        pushDiag('E403',`Casual DL description "= ${dlDescM[2]}" is top-level only. Remove indentation and place it outside lists.`);
        tokens.push({type:'text', text:t}); continue;
      }
      tokens.push({type:'dl_dd', indent:dlDescM[1].length, text:dlDescM[2]}); continue;
    }

    // ol: # item（インデントはスペースのみ・2個単位）
    const olM=raw.match(/^((?:  )*)#\s+(.*)/);
    if (olM) { tokens.push({type:'ol', indent:olM[1].length, text:olM[2]}); continue; }

    // ExternalEmbed !!URL!! or !!URL|alt!! or !!URL alt!! (block) — 外部リソース（リンク・画像・動画）
    // "|" or SP may be used as the separator before alt text; URLs cannot contain spaces.
    const extEmbedM=t.match(/^!!(https:\/\/[^ |!\n]+)(?:[| ]([^!\n]*))?!!$/);
    if (extEmbedM) {
      tokens.push({type:'external_embed', url:extEmbedM[1].trim(), alt:extEmbedM[2]?extEmbedM[2].trim():null});
      continue;
    }

    // URL単独行（buildAST で安全に扱える HTTPS のみを URL ブロック化する）
    if (/^https:\/\/\S+$/.test(t)) { tokens.push({type:'url', url:t}); continue; }

    // ObsidianEmbed ![[path]] or ![[path|alt]] — ローカル画像埋め込み
    const embedM=t.match(/^!\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]$/);
    if (embedM) { tokens.push({type:'obsidian_embed', path:embedM[1].trim(), alt:embedM[2]!==undefined?embedM[2].trim():null}); continue; }

    // 通常テキスト
    tokens.push({type:'text', text:t});
  }
  // 未閉鎖ブロックの検知 — EOF 時点でブロックが閉じていない場合に警告を発する
  if (mode==='front')   pushDiag('W203','Unterminated front matter: @@ was opened but the closing @@ was not found before EOF.');
  if (mode==='shebang') pushDiag('W001','Unterminated code block: #!lang was opened but the closing !# was not found before EOF.');
  if (mode==='quote')   pushDiag('W002','Unterminated block quote: |> was opened but the closing <| was not found before EOF.');
  if (mode==='math')    pushDiag('W003','Unterminated math block: $$ was opened but the closing $$ was not found before EOF.');
  return tokens;
}

// ============================================================
// buildAST
// ============================================================
function buildAST(tokens) {
  const nodes=[]; let i=0;

  function cm() { const mods=[]; while(i<tokens.length&&tokens[i].type==='modifier') mods.push(tokens[i++]); return mods; }

  function parseListItems(baseIndent, listType) {
    // listType: enforced at this level (same-level items must share a type).
    //           Omit (undefined) to allow mixed types — used when recursing for children.
    const isListToken=t=>t==='ul'||t==='ol';
    const normType=t=>t;
    const levelType=normType(listType);
    const items=[];
    while (i<tokens.length) {
      const tok=tokens[i];
      const tokType=normType(tok.type);
      const typeOk=!levelType||tokType===levelType;
      if (isListToken(tok.type) && tok.indent===baseIndent && typeOk) {
        i++;
        const item={listType:tokType, text:tok.text, children:null};
        if (i<tokens.length) {
          const next=tokens[i];
          // Nested children may be a different type — recurse without listType constraint
          if (isListToken(next.type) && next.indent===baseIndent+2)
            item.children=parseListItems(next.indent);
        }
        items.push(item);
      } else break;
    }
    return items;
  }

  function renderListItems(items) {
    if (!items?.length) return '';
    const groups=[];
    let cur=null;
    for (const item of items) {
      if (!cur||cur.type!==item.listType) { cur={type:item.listType,items:[]}; groups.push(cur); }
      cur.items.push(item);
    }
    let html='';
      for (const group of groups) {
        const isTask=group.type==='task';
        const tag=group.type==='ol'?'ol':'ul';
        if (html) html+='\n';
        html+=`<${tag}>\n`;
        for (const item of group.items) {
          if (isTask) {
            html+=`  <li class="task-item"><input type="checkbox" disabled${item.checked?' checked':''}> ${parseInline(item.text)}</li>\n`;
          } else {
            html+=`  <li>${parseInline(item.text)}`;
            if (item.children) html+='\n'+renderListItems(item.children).split('\n').map(l=>'  '+l).join('\n')+'\n  ';
            html+=`</li>\n`;
          }
        }
        html+=`</${tag}>`;
      }
      return html;
  }

  // フロントマターパース
  const ALLOWED_FRONT_MATTER_KEYS=new Set([
    'title',
    'author',
    'date',
    'updated',
    'description',
    'tags',
    'slug',
    'lang'
  ]);

  function isAllowedFrontMatterKey(key) {
    return ALLOWED_FRONT_MATTER_KEYS.has(key) || /^x-[a-z0-9-]+$/.test(key);
  }

  function parseFrontLines(lines) {
    const meta={};
    for (const line of lines) {
      if (/^\s*#/.test(line)) continue;
      const m=line.match(/^([a-z][a-z0-9-]*): (.*)$/);
      if (!m) {
        // [W202] Non-empty lines that do not match FrontMetaLine syntax are invalid
        if (line !== '') pushDiag('W202',`Malformed front matter line: "${line}". Expected format: "key: value".`);
        continue;
      }

      const key=m[1];
      if (!isAllowedFrontMatterKey(key)) {
        // [E201] Invalid key: invalidate this construct and continue (spec: errors fall back safely)
        pushDiag('E201',`"${key}" is not a recognised front matter key. Allowed: title, author, date, updated, description, tags, slug, lang; or x-* for custom metadata.`);
        continue;
      }

      // Strip inline YAML comment: per YAML spec, comments start after whitespace before '#'
      meta[key]=m[2].replace(/\s+#.*$/, '');
    }
    return meta;
  }

  while (i<tokens.length) {
    const tok=tokens[i];
    if (tok.type==='empty') { i++; continue; }

    // フロントマター
    if (tok.type==='front_open') {
      i++;
      const lines=[];
      while (i<tokens.length && tokens[i].type!=='front_close') lines.push(tokens[i++].text||'');
      if (tokens[i]?.type==='front_close') i++;
      nodes.push({type:'frontmatter', meta:parseFrontLines(lines)});
      continue;
    }

    if (tok.type==='hr') { i++; nodes.push({type:'hr'}); continue; }

    // 見出し
    if (tok.type==='heading') {
      i++;
      const mods=cm();
      const idMods=mods.filter(m=>m.key==='id').map(m=>m.value);
      if (idMods.length>1) {
        pushDiag('W802',`Multiple @[id: ...] modifiers were provided; using the last id "${idMods[idMods.length-1]}".`);
      }
      let customId;
      for (let idx=mods.length-1; idx>=0; idx--) {
        if (mods[idx].key==='id') { customId=mods[idx].value; break; }
      }
      const otherMods=mods.filter(m=>m.key!=='id');
      const id=reserveAnchorId(customId||tok.text, customId?'heading @[id]':'heading');
      nodes.push({type:'heading', level:tok.colons, id, label:tok.text, numbered:tok.numbered, attrs:buildAttrs(otherMods)});
      continue;
    }

    // 1行引用
    if (tok.type==='bq_inline') {
      i++;
      const mods=cm();
      nodes.push({type:'blockquote_inline', html:parseInline(tok.text), mods});
      continue;
    }

    // 引用ブロック
    if (tok.type==='quote_open') {
      i++;
      const lineGroups=[[]];
      while (i<tokens.length && tokens[i].type!=='quote_close') {
        const t=tokens[i++];
        if (t.type==='quote_line') {
          if (t.empty) lineGroups.push([]);
          else lineGroups[lineGroups.length-1].push(t.text);
        }
      }
      if (tokens[i]?.type==='quote_close') i++;
      const mods=cm();
      nodes.push({
        type:'blockquote_block',
        paragraphs:lineGroups.filter(g=>g.length>0).map(g=>g.map(l=>parseInline(l)).join('<br>')),
        cite:mods.find(m=>m.key==='cite')?.value||'',
        author:mods.find(m=>m.key==='author')?.value||'',
        mods
      });
      continue;
    }

    // 数式ブロック
    if (tok.type==='math_open') {
      i++;
      const lines=[];
      while (i<tokens.length && tokens[i].type!=='math_close') lines.push(tokens[i++].text||'');
      if (tokens[i]?.type==='math_close') i++;
      const mods=cm();
      nodes.push({type:'math', lines, mods});
      continue;
    }

    // := 定義ブロック（term + 後続テキスト行がDD）
    if (tok.type==='def_term') {
      i++;
      const term=tok.text;
      // 後続のテキスト行と段落区切りの空行を定義本文（DD）として収集
      const ddLines=[];
      let pendingParagraphBreak=false;
      while (i<tokens.length) {
        const t=tokens[i];
        if (t.type==='empty') {
          if (ddLines.length>0) pendingParagraphBreak=true;
          i++;
          continue;
        }
        if (t.type==='text') {
          if (pendingParagraphBreak) {
            ddLines.push('');
            pendingParagraphBreak=false;
          }
          ddLines.push(t.text);
          i++;
          continue;
        }
        break;
      }
      // [E403] 定義本文（DD）が空の場合 — spec: DefinitionBlock requires at least one paragraph (DD)
      if (ddLines.length===0) {
        pushDiag('E403',`Definition term "${term}" has no body text. Add at least one paragraph after the := line.`);
      }
      // [E404] 定義用語の重複 — spec: Definition-list terms are unique across the document
      const termKey=term.trim().toLowerCase();
      if (definitionTerms.has(termKey)) {
        pushDiag('E404',`Definition term "${term}" is defined more than once. Terms must be unique (case-insensitive).`);
      } else {
        definitionTerms.add(termKey);
      }
      const mods=cm();
      const termHtml=parseInline(term);
      const termId=reserveAnchorId(term,'definition term');
      const ddHtml=ddLines.map(l=>`<p>${parseInline(l)}</p>`).join('\n');
      nodes.push({type:'def_block', term, termId, termHtml, ddLines, ddHtml, mods});
      continue;
    }

    // コードブロック
    if (tok.type==='shebang_open') {
      const {lang, shebangLine}=tok; i++;
      const codeLines=[];
      while (i<tokens.length && tokens[i].type!=='shebang_close')
        codeLines.push(tokens[i++].type==='code_line'?tokens[i-1].text:'');
      if (tokens[i]?.type==='shebang_close') i++;
      const mods=cm();
      nodes.push({type:'codeblock', shebangLine, lang, lines:codeLines,
        title:mods.find(m=>m.key==='title')?.value||'',
        cite:mods.find(m=>m.key==='cite')?.value||'',
        mods});
      continue;
    }

    // タスクリスト
    if (tok.type==='task') {
      const items=[];
      while (i<tokens.length && tokens[i].type==='task') {
        items.push({listType:'task', checked:tokens[i].checked, text:tokens[i].text}); i++;
      }
      const mods=cm();
      nodes.push({type:'list', html:renderListItems(items), mods});
      continue;
    }

    // casual DL block (? term + one-or-more = desc) — top-level only
    if (tok.type==='dl_dt' && tok.indent===0) {
      const entries=[];
      while (i<tokens.length && tokens[i].type==='dl_dt' && tokens[i].indent===0) {
        const term=tokens[i++].text;
        const ddLines=[];
        while (i<tokens.length && tokens[i].type==='dl_dd' && tokens[i].indent===0) ddLines.push(tokens[i++].text);
        if (ddLines.length===0) {
          pushDiag('E403',`Definition term "${term}" has no body text. Add at least one "= " line after the "? " line.`);
          nodes.push({type:'paragraph', html:parseInline(`? ${term}`)});
        } else {
          entries.push({term, ddLines});
        }
      }
      if (entries.length>0) {
        const html='<dl>\n'+entries.map(e=>`  <dt>${parseInline(e.term)}</dt><dd>${e.ddLines.map(l=>parseInline(l)).join('<br>\n')}</dd>`).join('\n')+'\n</dl>';
        const mods=cm();
        nodes.push({type:'list', html, mods});
      }
      continue;
    }

    // ul / ol
    if (tok.type==='ul'||tok.type==='ol') {
      const items=parseListItems(tok.indent, tok.type);
      const mods=cm();
      nodes.push({type:'list', html:renderListItems(items), mods});
      continue;
    }

    if (tok.type==='dl_dd') {
      pushDiag('E403',`Casual DL description "${tok.text}" has no matching "? term" above it. Add a "? term" line immediately before it.`);
      i++;
      nodes.push({type:'paragraph', html:parseInline(tok.text)});
      continue;
    }

    // URL
    if (tok.type==='url') {
      const group=[];
      while (i<tokens.length && tokens[i].type==='url') {
        const url=tokens[i++].url; cm(); // モディファイアは消費するが URL ブロックでは無視
        group.push(url);
      }
      const escapeHtmlText=s=>s
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;')
        .replace(/'/g,'&#39;');
      for (const url of group) {
        if (isSafeUrl(url)) {
          nodes.push({type:'autolink', url, label:getHostname(url)});
        } else {
          nodes.push({type:'paragraph', html:escapeHtmlText(url)});
        }
      }
      continue;
    }

    // ObsidianEmbed ![[path]] or ![[path|alt]] — ローカル画像埋め込み
    if (tok.type==='obsidian_embed') {
      i++;
      const mods=cm();
      const altMod=tok.alt!==null?[{key:'alt',value:tok.alt}]:[];
      // @[alt: ...] modifier is ignored on ObsidianEmbed; alt text must be set inline: ![[path|alt text]]
      const safeMods=mods.filter(m=>m.key!=='alt');
      nodes.push({type:'figure', images:[{url:tok.path, mods:[...altMod,...safeMods]}]});
      continue;
    }

    // ExternalEmbed !!URL!! or !!URL|alt!! — 外部リソース（リンク・画像・動画）
    if (tok.type==='external_embed') {
      i++;
      const mods=cm();
      nodes.push({type:'external_embed', url:tok.url, alt:tok.alt, mods});
      continue;
    }

    // `: ` 段落ブロック（明示的な段落 — モディファイア使用可）
    if (tok.type==='para_block') {
      const lines=[tok.text];
      i++;
      while (i<tokens.length && tokens[i].type==='para_block') {
        lines.push(tokens[i].text);
        i++;
      }
      const mods=cm();
      nodes.push({type:'paragraph', html:lines.map(l=>parseInline(l)).join('<br>\n'), mods});
      continue;
    }

    // 通常テキスト（モディファイア不可）
    if (tok.type==='text') {
      const lines=[tok.text];
      i++;
      while (i<tokens.length && tokens[i].type==='text') {
        lines.push(tokens[i].text);
        i++;
      }
      nodes.push({type:'paragraph', html:lines.map(l=>parseInline(l)).join('<br>\n')});
      continue;
    }

    // [W801] 孤立したモディファイア — どのブロックにも消費されなかった修飾キー
    if (tok.type==='modifier') {
      pushDiag('W801',`@[${tok.key}: ${tok.value}] was not applied to any block. Place it on the line immediately after a supported block with no blank line in between.`);
    }
    i++;
  }
  return nodes;
}

// ============================================================
// astToHtml
// ============================================================
let cbCounter=0;

function astToHtml(nodes, forDisplay=false) {
  let html=nodes.map(node=>{
    switch(node.type) {

      case 'frontmatter': {
        const entries=Object.entries(node.meta);
        if (!entries.length) return '';
        let h='<dl class="front-matter">\n';
        for (const [k,v] of entries) h+=`  <dt>${esc(k)}</dt><dd>${esc(v)}</dd>\n`;
        return h+'</dl>';
      }

      case 'hr': return '<hr>';

      case 'heading': {
        let attrs=node.attrs;
        if (node.numbered) {
          if (/\sclass="[^"]*"/.test(attrs)) {
            attrs=attrs.replace(/\sclass="([^"]*)"/, (m, classes)=>` class="numbered${classes ? ' '+classes : ''}"`);
          } else {
            attrs=' class="numbered"'+attrs;
          }
        }
        return `<h${node.level} id="${esc(node.id)}"${attrs}><a href="#${esc(node.id)}">${esc(node.label)}</a></h${node.level}>`;
      }

      case 'blockquote_inline': return `<blockquote${buildAttrs(node.mods)}><p>${node.html}</p></blockquote>`;

      case 'blockquote_block': {
        const cu=isSafeUrl(node.cite);
        let h=`<blockquote${buildAttrs(node.mods)}>\n`;
        for (const p of node.paragraphs) h+=`  <p>${p}</p>\n`;
        if (node.cite||node.author) {
          h+='  <footer>\n';
          if (node.cite)   h+=`    <cite>${cu?extLink(node.cite,getHostname(node.cite)):esc(node.cite)}</cite>\n`;
          if (node.author) h+=`    <span class="author"> — ${esc(node.author)}</span>\n`;
          h+='  </footer>\n';
        }
        return h+'</blockquote>';
      }

      case 'math': {
        return `<pre${mergeAttrs('math-block', node.mods)}><code>${node.lines.map(l=>esc(l)).join('\n')}</code></pre>`;
      }

      case 'def_block': {
        return `<dl${mergeAttrs('def-block', node.mods)}><dt id="${esc(node.termId)}"><a href="#${esc(node.termId)}">${node.termHtml}</a></dt><dd>${node.ddHtml}</dd></dl>`;
      }

      case 'list': {
        const attrs=buildAttrs(node.mods);
        if (!attrs) return node.html;
        return node.html.replace(/^<(ul|ol|dl)/, `<$1${attrs}`);
      }

      case 'codeblock': {
        const baseClass=node.lang?`blogable-code language-${node.lang}`:'blogable-code';
        const figAttrs=mergeAttrs(baseClass, node.mods);
        if (!forDisplay) {
          const allLines=[node.shebangLine,...node.lines];
          let h=`<figure${figAttrs}>\n`;
          if (node.title||node.lang) h+=`  <figcaption>${esc(node.title)}${node.lang?` <span class="lang-badge">${esc(node.lang)}</span>`:''}</figcaption>\n`;
          h+=`  <pre><code${node.lang?` class="language-${esc(node.lang)}"`:''}>${allLines.map(l=>esc(l)).join('\n')}</code></pre>\n`;

          if (node.cite) h+=`  <cite>${isSafeUrl(node.cite)?extLink(node.cite,getHostname(node.cite)):esc(node.cite)}</cite>\n`;
          return h+'</figure>';
        }
    const id=`cb-${++cbCounter}`;
    const allRows=[
      ...(node.shebangLine?[{text:node.shebangLine,isShebang:true}]:[]),
      ...node.lines.map(text=>({text,isShebang:false}))
    ];
    const rows=allRows.map((row,idx)=>{
      const nc='line-num'+(row.isShebang?' shebang':'');
      const cc='code-cell'+(row.isShebang?' shebang':'');
      return `<tr class="code-row" onclick="copyLine('${id}',${idx})"><td class="${nc}" id="${id}-ln-${idx}">${idx+1}</td><td class="${cc}" id="${id}-lc-${idx}">${esc(row.text)}</td></tr>`;
    }).join('\n');
    let h=`<figure${figAttrs} id="${id}">`;
    if (node.title||node.lang) h+=`<figcaption><span>${esc(node.title)}</span>${node.lang?`<span class="lang-badge">${esc(node.lang)}</span>`:''}</figcaption>`;
    h+=`<div class="code-area"><button class="copy-all-btn" onclick="copyAll('${id}')">copy</button><table class="code-table"><tbody>${rows}</tbody></table></div>`;
    if (node.cite) h+=`<cite>${isSafeUrl(node.cite)?extLink(node.cite,getHostname(node.cite)):esc(node.cite)}</cite>`;
    h+='</figure>';
    window._cb=window._cb||{}; window._cb[id]=node;
    return h;
  }

  case 'figure': {
    const rev=[...node.images].reverse();
    const lt=rev.find(g=>g.mods.find(m=>m.key==='title'))?.mods.find(m=>m.key==='title')?.value;
    const lc=rev.find(g=>g.mods.find(m=>m.key==='cite'))?.mods.find(m=>m.key==='cite')?.value;
    let h='<figure class="blogable-figure">\n';
    for (const img of node.images) {
      const alt=img.mods.find(m=>m.key==='alt')?.value||'';
      const title=img.mods.find(m=>m.key==='title')?.value||'';
      const xAttrs=img.mods.filter(m=>/^x-[a-z0-9-]+$/.test(m.key)).map(m=>`data-${esc(m.key.slice(2))}="${esc(m.value)}"`).join(' ');
      h+=`  <img src="${esc(img.url)}" alt="${esc(alt)}"${title?` title="${esc(title)}"`:''} loading="lazy" decoding="async"${xAttrs?' '+xAttrs:''}>\n`;
    }
    if (lt) h+=`  <figcaption>${esc(lt)}</figcaption>\n`;
    if (lc) h+=`  <cite>${isSafeUrl(lc)?extLink(lc,getHostname(lc)):esc(lc)}</cite>\n`;
    return h+'</figure>';
  }

  case 'autolink': {
    return `<p>${extLink(node.url, esc(node.label))}</p>`;
  }

  case 'external_embed': {
    const url = node.url;
    if (!isSafeUrl(url)) return `<p>${esc(url)}</p>`;
    const alt = node.alt || node.mods.find(m=>m.key==='alt')?.value || '';
    const title = node.mods.find(m=>m.key==='title')?.value || '';
    if (isImageUrl(url)) {
      return `<figure class="blogable-figure">\n  <img src="${esc(url)}" alt="${esc(alt)}"${title?` title="${esc(title)}"`:''} loading="lazy" decoding="async">\n</figure>`;
    }
    if (isVideoUrl(url)) {
      return `<figure class="blogable-figure">\n  <video src="${esc(url)}" controls loading="lazy">${alt?esc(alt):''}</video>\n${title?`  <figcaption>${esc(title)}</figcaption>\n`:''}</figure>`;
    }
    const label = alt || getHostname(url);
    return `<p>${extLink(url, esc(label))}</p>`;
  }

  case 'paragraph': return `<p${node.mods?buildAttrs(node.mods):''}>${node.html}</p>`;
  default: return '';
}

  }).join('\n');

// 脚注
if (footnotes.length>0) {
let fn='<footer class="blogable-footnotes">\n<ol>\n';
for (const f of footnotes) {
const body=f.url?`${extLink(f.url,getHostname(f.url))} <span class="fn-alt">${esc(f.text)}</span>`:esc(f.text);
fn+=`  <li id="fn-${f.n}">${body} <a href="#fnref-${f.n}" class="fn-back">↩</a></li>\n`;
}
fn+='</ol>\n</footer>';
html+='\n'+fn;
}
return html;
}

function parseToAST(src) {
anchorIds={};
footnotes=[];
diagnostics=[];
definitionTerms=new Set();
idCounts=new Map();
return buildAST(tokenize(src.split('\n')));
}

// –– コピー操作 ––
async function copyAll(id){const node=window._cb?.[id];if(!node)return;const allLines=[...node.lines];await navigator.clipboard.writeText(allLines.join('\n'));const btn=document.querySelector(`#${id} .copy-all-btn`);if(!btn)return;btn.textContent='copied!';btn.classList.add('copied');setTimeout(()=>{btn.textContent='copy';btn.classList.remove('copied');},1500);}
async function copyLine(id,idx){const node=window._cb?.[id];if(!node)return;const allRows=[...(node.shebangLine?[{text:node.shebangLine}]:[]),...node.lines.map(text=>({text}))];await navigator.clipboard.writeText(allRows[idx]?.text??'');const ln=document.getElementById(`${id}-ln-${idx}`);const lc=document.getElementById(`${id}-lc-${idx}`);if(ln){ln.classList.add('copied');setTimeout(()=>ln.classList.remove('copied'),1500);}if(lc){lc.classList.add('copied');setTimeout(()=>lc.classList.remove('copied'),1500);}}

// –– UI ––
let currentTab='preview';
function updateDiagnosticsPanel(diags){
  const diagOut=document.getElementById('diag-out');
  if(!diagOut) return;
  if(!diags.length){
    diagOut.innerHTML='';
    diagOut.style.display='none';
  }else{
    diagOut.innerHTML=diags.map(d=>`<div class="diag-item diag-${d.code[0]==='E'?'error':'warn'}"><span class="diag-code">[${d.code}]</span> ${esc(d.message)}</div>`).join('');
    diagOut.style.display='';
  }
}
function switchTab(tab,btn){currentTab=tab;document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');document.getElementById('preview-out').style.display=tab==='preview'?'':'none';document.getElementById('html-out').style.display=tab==='html'?'':'none';render();}
function highlightCodeTables(container) {
  if (!window.Prism) return;
  container.querySelectorAll('figure.blogable-code').forEach(fig => {
    const badge = fig.querySelector('.lang-badge');
    if (!badge) return;
    const lang = badge.textContent.trim().toLowerCase();
    const grammar = Prism.languages[lang];
    if (!grammar) return;
    const cells = fig.querySelectorAll('td.code-cell:not(.shebang)');
    if (!cells.length) return;
    const lines = Array.from(cells).map(td => td.textContent);
    const highlighted = Prism.highlight(lines.join('\n'), grammar, lang);
    const highlightedLines = highlighted.split('\n');
    cells.forEach((td, i) => {
      if (highlightedLines[i] !== undefined) td.innerHTML = highlightedLines[i];
    });
  });
}
function renderKaTeXBlocks(container) {
  const katexApi = window.katex || globalThis.katex;
  if (!katexApi) return;
  container.querySelectorAll('pre.math-block').forEach(pre => {
    const code = pre.querySelector('code');
    if (!code) return;
    const tex = code.textContent.trim();
    try {
      code.innerHTML = katexApi.renderToString(tex, { displayMode: true, throwOnError: false });
    } catch(e) {
      code.innerHTML = `<span class="katex-error">${esc(tex)}</span>`;
    }
  });
}
function render(){
cbCounter=0; window._cb={}; footnotes=[];
const src=document.getElementById('source').value;
const ast=parseToAST(src);
const diags=getBlogableDiagnostics();
updateDiagnosticsPanel(diags);
if (currentTab==='preview') {
document.getElementById('preview-out').innerHTML=astToHtml(applyDemoUrlLabelExtension(ast),true);
if (window.Prism) highlightCodeTables(document.getElementById('preview-out'));
if (window.katex) renderKaTeXBlocks(document.getElementById('preview-out'));
} else if (currentTab==='html') {
document.getElementById('html-out').textContent=astToHtml(ast,false);
}
}
let renderTimer=null;
document.getElementById('source').addEventListener('input',()=>{
clearTimeout(renderTimer);
renderTimer=setTimeout(()=>{updateDemoUrlLabelsFromSource(document.getElementById('source').value);render();},150);
});

// –– デモソース ––
document.getElementById('source').value = `@@
title: Blogable v1.1-alpha デモ
author: worthmine(Yuki Yoshida)
x-version: 1.1-alpha
@@

:: Blogable v1.1-alpha デモ

---

:: フロントマター

上記の \`@@\` ブロックがフロントマターです。パースされてドキュメント先頭のメタデータ一覧として表示されます。

---

:: 見出し

:: h2 見出し
::: h3 見出し
:::: h4 見出し

::# 連番 h2
:::# 連番 h3
:::# 連番 h3（カウント継続）

---

:: 段落

通常のテキスト行は段落になります。

これは強調用クラスを付けた段落です。
@[class: lead]

---

:: 用語リスト

- Deterministic: A parser is deterministic when the same input always produces the same output with no ambiguity in rule application.
- Single-pass: Processing proceeds line by line in one forward pass. No lookahead or backtracking is performed.

---

:: 用語リスト

- tokenize: 行をトークン列に変換する第1段階
- buildAST: トークン列からASTノード配列を生成する第3段階

---

:: 水平線

---

:: リスト

- ul アイテム A
- ul アイテム B
  - ネスト B-1
  - ネスト B-2
- ul アイテム C

# ol アイテム 1
# ol アイテム 2
# ol アイテム 3

[x] 完了タスク
[ ] 未完了タスク
[x] 完了タスク 2

---

:: 引用ブロック

> これは1行の引用です。

|>
複数行の引用ブロックです。
**インライン記法**も使えます。

空行で段落が分かれます。
<|
@[author: 著者名]
@[cite: 出典書籍]

---

:: 数式ブロック

$$
E = mc^2
F = ma
$$

---

:: インライン記法

**strong** *emphasis* \`inline code\` ++inserted++ ~~deleted~~

リンク: [https://example.com リンクテキスト]

脚注: [^https://example.com 参考リンク] [^ URLなしの補足]

---

:: URL・画像

https://www.wikipedia.org/

https://picsum.photos/seed/blogable1/600/200.jpg
@[alt: サンプル画像]
@[title: 画像キャプション]

---

:: #!blogable ブロック（ハイライトデモ）

#!blogable
:: 見出し h2
::: 見出し h3
:= Term
Definition body paragraph.

[x] タスク完了
[ ] タスク未完了
  **bold** *italic* \`code\` ++ins++ ~~del~~
  [https://example.com リンク]
  @[class: lead]
  @[cite: https://example.com]
  !#
  @[title: Blogable 記法ハイライト]

---

:: #!ebnf ブロック（ハイライトデモ）

#!ebnf
Document = [ FrontMatterBlock ] , { Block } ;
Block    = Heading | Paragraph | CodeBlock | QuoteBlock ;
Heading  = "::" , { ":" } , SP , InlineText , NL ;
!#
@[title: EBNF 記法ハイライト]

---

:: 内部アンカー

:: Blogable v1.1-alpha デモ用アンカーターゲット
@[id: blogable-v11-alpha-demo]

見出し参照: [[#インライン記法]]
`;

updateDemoUrlLabelsFromSource(document.getElementById('source').value);
render();
