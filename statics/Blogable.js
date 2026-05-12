// ============================================================
// Prism: blogable カスタム言語
// ============================================================
Prism.languages.blogable = {
  'shebang':       { pattern:/^#!.+$/m,            alias:'comment' },
  'shebang-close': { pattern:/^!#$/m,               alias:'keyword' },
  'front-fence':   { pattern:/^@@$/m,               alias:'keyword' },
  'math-fence':    { pattern:/^\$\$$/m,             alias:'keyword' },
  'hr':            { pattern:/^---$/m,              alias:'punctuation' },
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
  'anchor-block':  { pattern:/^\[#[^\]]+\]$/m,       alias:'symbol' },
  'url-block':     { pattern:/^https:\/\/\S+$/m,     alias:'url' },
  'inline-link':   { pattern:/\[[^\[\]\n]+\]\(https:\/\/[^\)\n]+\)/, alias:'url' },
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

// ============================================================
// Blogable Parser v1.1-alpha
// ============================================================

// ---- 定数 ----
const IMAGE_EXTS = /\.(jpe?g|png|gif|webp|svg)(\?.*)?$/i; // ObsidianEmbed では SVG も許容

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
function getHostname(url) { try { return new URL(url).hostname; } catch { return url; } }
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
  return SHEBANG_LANG_MAP[cmd] || cmd;
}

function buildAttrs(mods) {
  const attrs={}, da=[];
  for (const {key,value} of mods) {
    if (key==='class') attrs.class=esc(value);
    if (key==='id')    attrs.id=esc(value);
    if (/^x-[a-z0-9-]+$/.test(key)) da.push(`data-${esc(key.slice(2))}="${esc(value)}"`);
  }
  return Object.entries(attrs).map(([k,v])=>` ${k}="${v}"`).join('')+(da.length?' '+da.join(' '):'');
}

// Like buildAttrs but merges any `class` modifier value into an existing baseClass.
function mergeAttrs(baseClass, mods) {
  const extra=(mods||[]).find(m=>m.key==='class')?.value;
  const cls=extra?`${baseClass} ${esc(extra)}`:baseClass;
  return ` class="${cls}"`+buildAttrs((mods||[]).filter(m=>m.key!=='class'));
}

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
  el.textContent=`URLラベル: ${count}件生成済`;
  return updated;
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
// ヘッドのIDマップ（内部アンカー解決用）
let headingIds={};
// 定義用語の重複チェック
let definitionTerms=new Set();

function parseInline(text) {
  // Single-pass inline parser; implements spec evaluation order:
  // Code > Link > Footnote > ObsidianAnchor > ObsidianLink > Strong > Emphasis > Delete > Insert > Plain
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

    // ── Link  [TEXT](HTTPS_URL)  ────────────────────────────────────
    if ((m = rest.match(/^\[([^\[\]\n]+)\]\((https:\/\/[^\)\n]+)\)/))) {
      const label = m[1], url = m[2];
      out += isSafeUrl(url) ? extLink(url, esc(label)) : esc(m[0]);
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
      if (Object.hasOwn(headingIds, slug)) {
        out += `<a href="#${esc(slug)}" class="obsidian-anchor">${esc(id)}</a>`;
      } else {
        pushDiag('W001',`Unresolved internal anchor reference: [#${id}]`);
        out += esc(id);
      }
      i += m[0].length; continue;
    }

    // ── ObsidianLink  [[PATH]] or [[PATH|DISPLAY]] or [[PATH#HEADING]] or [[PATH#HEADING|DISPLAY]]  ─────────────────────
    if ((m = rest.match(/^\[\[([^#\]\|\n][^\]\|\n]*)(?:\|([^\]\n]*))?\]\]/))) {
      const path = m[1].trim(), display = m[2] !== undefined ? m[2].trim() : m[1].trim();
      out += `<a href="${esc(path)}" class="obsidian-link">${esc(display)}</a>`;
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
    if (t==='---') { tokens.push({type:'hr'}); continue; }
    if (t==='|>')  { tokens.push({type:'quote_open'}); mode='quote'; continue; }
    if (t==='$$')  { tokens.push({type:'math_open'}); mode='math'; continue; }

    // 修飾キー @[key: value]  — SP は単一スペース（spec: SP = " "）
    const modM=t.match(/^@\[([a-z][a-z0-9-]*): (.*)\]$/);
    if (modM) {
      const mk=modM[1];
      if (!ALLOWED_META_KEYS.has(mk) && !/^x-[a-z0-9-]+$/.test(mk)) {
        // [E002] Unknown MetaKey: fall back to literal text (spec: errors fall back safely)
        pushDiag('E002',`Unknown MetaKey: ${mk}. Allowed keys: ${[...ALLOWED_META_KEYS].join(', ')}, or x-* custom keys`);
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

    // 見出しレベル超過（7コロン以上） — [E004]: fall back to text
    const overH=t.match(/^(:{7,})(?:\s|#\s)/);
    if (overH) {
      pushDiag('E004',`Heading level out of range: ${overH[1].length} colons. The maximum heading level is h6 (6 colons).`);
      tokens.push({type:'text', text:t}); continue;
    }

    // 1行引用
    if (t.startsWith('> ')) { tokens.push({type:'bq_inline', text:t.slice(2)}); continue; }

    // := 定義ブロック（行頭）
    const defM=t.match(/^:=\s+(.*)/);
    if (defM) { tokens.push({type:'def_term', text:defM[1]}); continue; }

    // `: ` 段落ブロック（明示的な段落 — モディファイア使用可）
    const paraM=t.match(/^: (.+)/);
    if (paraM) { tokens.push({type:'para_block', text:paraM[1]}); continue; }

    // 内部アンカーブロック [#text]
    const anchorM=t.match(/^\[#([^\]]+)\]$/);
    if (anchorM) { tokens.push({type:'anchor_block', id:slugify(anchorM[1]), label:anchorM[1]}); continue; }

    // タスクリスト
    const taskM=raw.match(/^(\s*)\[([ x])\]\s+(.*)/);
    if (taskM) { tokens.push({type:'task', indent:taskM[1].length, checked:taskM[2].toLowerCase()==='x', text:taskM[3]}); continue; }

    // odd-indent list items — [E003] invalid list indentation, fall back to text
    const oddIndentM=raw.match(/^( +)(#|-)\s+/);
    if (oddIndentM && oddIndentM[1].length % 2 !== 0) {
      pushDiag('E003',`Invalid list indentation: ${oddIndentM[1].length} space(s). Indentation must be a multiple of two.`);
      tokens.push({type:'text', text:t}); continue;
    }

    // ul: - item（インデントはスペースのみ・2個単位）
    const ulM=raw.match(/^((?:  )*)-\s+(.*)/);
    if (ulM && !raw.trim().startsWith('-[')) {
      tokens.push({type:'ul', indent:ulM[1].length, text:ulM[2]}); continue;
    }

    // ol: # item（インデントはスペースのみ・2個単位）
    const olM=raw.match(/^((?:  )*)#\s+(.*)/);
    if (olM) { tokens.push({type:'ol', indent:olM[1].length, text:olM[2]}); continue; }

    // URL単独行（buildAST で安全に扱える HTTPS のみを URL ブロック化する）
    if (/^https:\/\/\S+$/.test(t)) { tokens.push({type:'url', url:t}); continue; }

    // ObsidianEmbed ![[path]] or ![[path|alt]] — ローカル画像埋め込み
    const embedM=t.match(/^!\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]$/);
    if (embedM) { tokens.push({type:'obsidian_embed', path:embedM[1].trim(), alt:embedM[2]!==undefined?embedM[2].trim():null}); continue; }

    // 通常テキスト
    tokens.push({type:'text', text:t});
  }
  // 未閉鎖ブロックの検知 — EOF 時点でブロックが閉じていない場合に警告を発する
  if (mode==='front')   pushDiag('W003','Unterminated front matter block: missing closing @@');
  if (mode==='shebang') pushDiag('W004','Unterminated code block: missing closing !#');
  if (mode==='quote')   pushDiag('W005','Unterminated quote block: missing closing <|');
  if (mode==='math')    pushDiag('W006','Unterminated math block: missing closing $$');
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
    const items=[];
    while (i<tokens.length) {
      const tok=tokens[i];
      const typeOk=!listType||tok.type===listType;
      if ((tok.type==='ul'||tok.type==='ol') && tok.indent===baseIndent && typeOk) {
        i++;
        const item={listType:tok.type, text:tok.text, children:null};
        if (i<tokens.length) {
          const next=tokens[i];
          // Nested children may be a different type — recurse without listType constraint
          if ((next.type==='ul'||next.type==='ol') && next.indent===baseIndent+2)
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
    'draft',
    'lang'
  ]);

  function isAllowedFrontMatterKey(key) {
    return ALLOWED_FRONT_MATTER_KEYS.has(key) || /^x-[a-z0-9-]+$/.test(key);
  }

  function parseFrontLines(lines) {
    const meta={};
    for (const line of lines) {
      const m=line.match(/^([a-z][a-z0-9-]*): (.*)$/);
      if (!m) {
        // [W002] Non-empty lines that do not match FrontMetaLine syntax are invalid
        if (line !== '') pushDiag('W002',`Malformed front matter line: ${line}`);
        continue;
      }

      const key=m[1];
      if (!isAllowedFrontMatterKey(key)) {
        // [E001] Invalid key: invalidate this construct and continue (spec: errors fall back safely)
        pushDiag('E001',`Invalid front matter key: ${key}`);
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
      const id=slugify(tok.text);
      headingIds[id]=true;
      nodes.push({type:'heading', level:tok.colons, id, label:tok.text, numbered:tok.numbered, attrs:buildAttrs(mods)});
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
      // [E005] 定義本文（DD）が空の場合 — spec: DefinitionBlock requires at least one paragraph (DD)
      if (ddLines.length===0) {
        pushDiag('E005',`Definition block for "${term}" has no body text. A DefinitionBlock requires at least one paragraph (DD).`);
      }
      // [W007] 定義用語の重複 — spec: Definition-list terms are unique across the document
      const termKey=term.trim().toLowerCase();
      if (definitionTerms.has(termKey)) {
        pushDiag('W007',`Duplicate definition term: "${term}" is already defined in this document.`);
      } else {
        definitionTerms.add(termKey);
      }
      const mods=cm();
      const termHtml=parseInline(term);
      const ddHtml=ddLines.map(l=>`<p>${parseInline(l)}</p>`).join('\n');
      nodes.push({type:'def_block', term, termHtml, ddLines, ddHtml, mods});
      continue;
    }

    // 内部アンカーブロック
    if (tok.type==='anchor_block') { i++; nodes.push({type:'anchor_block', id:tok.id, label:tok.label}); continue; }

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

    // ul / ol
    if (tok.type==='ul'||tok.type==='ol') {
      const items=parseListItems(tok.indent, tok.type);
      const mods=cm();
      nodes.push({type:'list', html:renderListItems(items), mods});
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
          nodes.push({type:'autolink', url, label:ogpMap[url]||getHostname(url)});
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
      // [W009] @[alt: ...] modifier on an image block is deprecated — use ![[path|alt text]]
      if (mods.some(m=>m.key==='alt')) {
        pushDiag('W009','@[alt: ...] is deprecated for image blocks. Use the inline pipe syntax ![[path|alt text]] to set the alt attribute instead.');
      }
      nodes.push({type:'figure', images:[{url:tok.path, mods:[...altMod,...mods]}]});
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

    // [W008] 孤立したモディファイア — どのブロックにも消費されなかった修飾キー
    if (tok.type==='modifier') {
      pushDiag('W008',`Orphaned modifier @[${tok.key}: ${tok.value}]: not associated with any block. Modifiers must immediately follow a block that accepts them, with no intervening blank lines.`);
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
        return `<dl${mergeAttrs('def-block', node.mods)}><dt>${node.termHtml}</dt><dd>${node.ddHtml}</dd></dl>`;
      }

      case 'anchor_block': {
        return `<span class="anchor-block" id="${esc(node.id)}">[#${esc(node.label)}]</span>`;
      }

      case 'list': {
        const attrs=buildAttrs(node.mods);
        if (!attrs) return node.html;
        return node.html.replace(/^<(ul|ol)/, `<$1${attrs}`);
      }

      case 'codeblock': {
        const figAttrs=mergeAttrs('blogable-code', node.mods);
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
    const label=ogpMap[node.url]||node.label;
    return `<p>${extLink(node.url, esc(label))}</p>`;
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
headingIds={};
footnotes=[];
diagnostics=[];
definitionTerms=new Set();
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
  if (!window.katex) return;
  container.querySelectorAll('pre.math-block').forEach(pre => {
    const code = pre.querySelector('code');
    if (!code) return;
    const lines = code.textContent.split('\n').filter(line => line.trim());
    code.innerHTML = lines.map(line => {
      try {
        return katex.renderToString(line, { displayMode: true, throwOnError: false });
      } catch(e) {
        return `<span class="katex-error">${esc(line)}</span>`;
      }
    }).join('');
  });
}
function render(){
cbCounter=0; window._cb={}; footnotes=[];
const src=document.getElementById('source').value;
const ast=parseToAST(src);
const diags=getBlogableDiagnostics();
updateDiagnosticsPanel(diags);
if (currentTab==='preview') {
document.getElementById('preview-out').innerHTML=astToHtml(ast,true);
if (window.Prism) highlightCodeTables(document.getElementById('preview-out'));
if (window.katex) renderKaTeXBlocks(document.getElementById('preview-out'));
} else if (currentTab==='html') {
document.getElementById('html-out').textContent=astToHtml(ast,false);
}
}
let renderTimer=null;
document.getElementById('source').addEventListener('input',()=>{
clearTimeout(renderTimer);
renderTimer=setTimeout(async()=>{render();const updated=await fetchNewOgps(document.getElementById('source').value);if(updated)render();},150);
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

[#blogable-v11-alpha-demo]

見出し参照: [#インライン記法]
`;

render();
fetchNewOgps(document.getElementById('source').value).then(u=>{if(u)render();});
