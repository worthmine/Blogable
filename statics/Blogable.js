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
  'heading-numbered':{ pattern:/^:{2,6}#.+$/m, inside:{ 'hm':{ pattern:/^:{2,6}#/, alias:'punctuation' }, 'ht':{ pattern:/.+/, alias:'bold' } } },
  'heading':         { pattern:/^:{2,6} .+$/m, inside:{ 'hm':{ pattern:/^:{2,6}/, alias:'punctuation' }, 'ht':{ pattern:/.+/, alias:'bold' } } },
  'bq-inline':     { pattern:/^> .+$/m,             alias:'string' },
  'task-done':     { pattern:/^\[x\] .+$/mi,          alias:'inserted' },
  'task-open':     { pattern:/^\[ \] .+$/m,          alias:'punctuation' },
  'anchor-block':  { pattern:/^\[#[^\]]+\]$/m,       alias:'symbol' },
  'url-block':     { pattern:/^https?:\/\/\S+$/m,    alias:'url' },
  'inline-link':   { pattern:/\[https?:\/\/[^\s\]]+\s[^\]]+\]/, alias:'url' },
  'footnote':      { pattern:/\[\^[^\]]+\]/,         alias:'symbol' },
  'anchor-ref':    { pattern:/\[#[^\]]+\]/,          alias:'symbol' },
  'bold':    { pattern:/\*\*[^*]+\*\*/ },
  'italic':  { pattern:/\*[^*]+\*/ },
  'ins':     { pattern:/\+\+[^+]+\+\+/, alias:'inserted' },
  'del':     { pattern:/~~[^~]+~~/,     alias:'deleted' },
  'code-inline': { pattern:/`[^`]+`/,   alias:'code' },
  'ol': { pattern:/^\s*\d+\.\s+.+$/m, inside:{ 'ol-marker':{ pattern:/^\s*\d+\.\s+/, alias:'punctuation' } } },
  'ul': { pattern:/^\s*- .+$/m,        inside:{ 'ul-marker':{ pattern:/^\s*- /, alias:'punctuation' } } },
};

// ============================================================
// Blogable Parser v1.1-alpha
// ============================================================

// ---- 定数 ----
const IMAGE_EXTS = /\.(jpe?g|png|gif|webp)(\?.*)?$/i; // SVG除外

const SHEBANG_LANG_MAP = {
  python:'python', python3:'python', python2:'python',
  node:'javascript', nodejs:'javascript',
  ruby:'ruby', perl:'perl',
  bash:'bash', sh:'bash', zsh:'bash',
  php:'php', lua:'lua',
  blogable:'blogable',
  ebnf:'ebnf',
};

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

// ---- インライン ----
let footnotes=[];
// ヘッドのIDマップ（内部アンカー解決用）
let headingIds={};

function parseInline(text) {
  // コードスパンを最優先で分割し、内部に他のインライン置換が走らないよう保護する
  // split の捕捉グループにより奇数インデックスがコードスパン、偶数が通常テキスト
  const parts = text.split(/(`[^`]*`)/g);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      // コードスパン内: HTMLエスケープのみ、インライン置換なし
      const inner = part.length >= 2 ? part.slice(1, -1) : '';
      return '<code>' + esc(inner) + '</code>';
    }
    // コードスパン外: 通常のインライン処理
    return esc(part)
      // リンク
      .replace(/\[(https?:\/\/[^\s\]]+)\s+([^\]]+)\]/g, (match,url,label)=>{
        if (!isSafeUrl(url)) return match;
        return extLink(url, label);
      })
      // 脚注
      .replace(/\[\^(https?:\/\/[^\s\]]+)\s+([^\]]+)\]/g, (match,url,alt)=>{
        if (!isSafeUrl(url)) return match;
        const n=footnotes.length+1; footnotes.push({n,url,text:alt});
        return `<sup><a href="#fn-${n}" id="fnref-${n}">[${n}]</a></sup>`;
      })
      .replace(/\[\^\s*([^\]]+)\]/g, (_,text)=>{
        const n=footnotes.length+1; footnotes.push({n,url:null,text});
        return `<sup><a href="#fn-${n}" id="fnref-${n}">[${n}]</a></sup>`;
      })
      // 内部アンカー参照
      .replace(/\[#([^\]]+)\]/g, (_,id)=>{
        const slug=slugify(id);
        const hasHeadingTarget =
          typeof headingIds !== 'undefined' &&
          headingIds &&
          typeof headingIds.has === 'function' &&
          headingIds.has(slug);
        if (!hasHeadingTarget) {
          console.warn(`Unresolved internal anchor reference: [#${id}]`);
          return esc(id);
        }
        return `<a href="#${esc(slug)}" class="anchor-ref">${esc(id)}</a>`;
      })
      // strong / em
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      // del
      .replace(/~~([^~]+)~~/g, '<del>$1</del>')
      // ins
      .replace(/\+\+([^+]+)\+\+/g, '<ins>$1</ins>');
  }).join('');
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

    // 修飾キー @[key: value]
    const modM=t.match(/^@\[([a-z][a-z0-9-]*):\s+(.*)\]$/);
    if (modM) { tokens.push({type:'modifier', key:modM[1], value:modM[2]}); continue; }

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

    // 1行引用
    if (t.startsWith('> ')) { tokens.push({type:'bq_inline', text:t.slice(2)}); continue; }

    // := 定義ブロック（行頭）
    const defM=t.match(/^:=\s+(.*)/);
    if (defM) { tokens.push({type:'def_term', text:defM[1]}); continue; }

    // 内部アンカーブロック [#text]
    const anchorM=t.match(/^\[#([^\]]+)\]$/);
    if (anchorM) { tokens.push({type:'anchor_block', id:slugify(anchorM[1]), label:anchorM[1]}); continue; }

    // タスクリスト
    const taskM=raw.match(/^(\s*)\[([ x])\]\s+(.*)/);
    if (taskM) { tokens.push({type:'task', indent:taskM[1].length, checked:taskM[2].toLowerCase()==='x', text:taskM[3]}); continue; }

    // ul: - item（インデントはスペースのみ・2個単位）
    const ulM=raw.match(/^((?:  )*)-\s+(.*)/);
    if (ulM && !raw.trim().startsWith('-[')) {
      tokens.push({type:'ul', indent:ulM[1].length, text:ulM[2]}); continue;
    }

    // ol: 1. item  2. item など（インデントはスペースのみ・2個単位）
    const olM=raw.match(/^((?:  )*)(\d+)\.\s+(.*)/);
    if (olM) { tokens.push({type:'ol', indent:olM[1].length, text:olM[3]}); continue; }

    // URL単独行（buildAST で安全に扱える HTTPS のみを URL ブロック化する）
    if (/^https:\/\/\S+$/.test(t)) { tokens.push({type:'url', url:t}); continue; }

    // 通常テキスト
    tokens.push({type:'text', text:t});
  }
  return tokens;
}

// ============================================================
// buildAST
// ============================================================
function buildAST(tokens) {
  const nodes=[]; let i=0;

  function cm() { const mods=[]; while(i<tokens.length&&tokens[i].type==='modifier') mods.push(tokens[i++]); return mods; }

  function parseListItems(baseIndent, listType) {
    const items=[];
    while (i<tokens.length) {
      const tok=tokens[i];
      if (tok.type==='task' && listType==='task') {
        i++;
        items.push({listType:'task', checked:tok.checked, text:tok.text, children:null});
      } else if ((tok.type==='ul'||tok.type==='ol') && tok.type===listType && tok.indent===baseIndent) {
        i++;
        const item={listType, text:tok.text, children:null};
        if (i<tokens.length) {
          const next=tokens[i];
          if ((next.type==='ul'||next.type==='ol') && next.indent===baseIndent+2)
            item.children=parseListItems(next.indent, next.type);
        }
        items.push(item);
      } else break;
    }
    return items;
  }

  function renderListItems(items) {
    if (!items?.length) return '';
    const isTask=items[0].listType==='task';
    const isOl=items[0].listType==='ol';
    const tag=isOl?'ol':'ul';
    let h=`<${tag}>\n`;
    for (const item of items) {
      if (isTask) {
        h+=`  <li class="task-item"><input type="checkbox" disabled${item.checked?' checked':''}> ${parseInline(item.text)}</li>\n`;
      } else {
        h+=`  <li>${parseInline(item.text)}`;
        if (item.children) h+='\n'+renderListItems(item.children).split('\n').map(l=>'  '+l).join('\n')+'\n  ';
        h+=`</li>\n`;
      }
    }
    return h+`</${tag}>`;
  }

  // フロントマターパース
  const ALLOWED_FRONT_MATTER_KEYS=new Set([
    'title',
    'slug',
    'date',
    'author',
    'tags',
    'category',
    'summary',
    'cover',
    'layout'
  ]);

  function isAllowedFrontMatterKey(key) {
    return ALLOWED_FRONT_MATTER_KEYS.has(key) || key.startsWith('x-');
  }

  function parseFrontLines(lines) {
    const meta={};
    for (const line of lines) {
      const m=line.match(/^([a-z][a-z0-9-]*): (.*)$/i);
      if (!m) continue;

      const rawKey=m[1];
      const normalizedKey=rawKey.toLowerCase();
      if (!isAllowedFrontMatterKey(normalizedKey)) {
        throw new Error(`Invalid front matter key: ${rawKey}`);
      }

      meta[rawKey]=m[2];
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
    if (tok.type==='bq_inline') { i++; nodes.push({type:'blockquote_inline', html:parseInline(tok.text)}); continue; }

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
        author:mods.find(m=>m.key==='author')?.value||''
      });
      continue;
    }

    // 数式ブロック
    if (tok.type==='math_open') {
      i++;
      const lines=[];
      while (i<tokens.length && tokens[i].type!=='math_close') lines.push(tokens[i++].text||'');
      if (tokens[i]?.type==='math_close') i++;
      nodes.push({type:'math', lines});
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
      nodes.push({type:'def_block', term, ddLines});
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
        cite:mods.find(m=>m.key==='cite')?.value||''});
      continue;
    }

    // タスクリスト
    if (tok.type==='task') {
      const items=[];
      while (i<tokens.length && tokens[i].type==='task') {
        items.push({listType:'task', checked:tokens[i].checked, text:tokens[i].text}); i++;
      }
      nodes.push({type:'list', html:renderListItems(items)});
      continue;
    }

    // ul / ol
    if (tok.type==='ul'||tok.type==='ol') {
      const items=parseListItems(tok.indent, tok.type);
      nodes.push({type:'list', html:renderListItems(items)});
      continue;
    }

    // URL
    if (tok.type==='url') {
      const group=[];
      while (i<tokens.length && tokens[i].type==='url') {
        const url=tokens[i++].url; const mods=cm();
        group.push({url, mods});
      }
      const escapeHtmlText=s=>s
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;')
        .replace(/'/g,'&#39;');
      const allSafe=group.every(g=>isSafeUrl(g.url));
      if (allSafe) {
        if (group.length>0 && group.every(g=>isImageUrl(g.url))) {
          nodes.push({type:'figure', images:group});
        } else {
          for (const g of group) nodes.push({type:'autolink', url:g.url, label:ogpMap[g.url]||getHostname(g.url)});
        }
      } else {
        let images=[];
        const flushImages=()=>{
          if (images.length>0) {
            nodes.push({type:'figure', images});
            images=[];
          }
        };
        for (const g of group) {
          if (isSafeUrl(g.url)) {
            if (isImageUrl(g.url)) {
              images.push(g);
            } else {
              flushImages();
              nodes.push({type:'autolink', url:g.url, label:ogpMap[g.url]||getHostname(g.url)});
            }
          } else {
            flushImages();
            nodes.push({type:'paragraph', html:escapeHtmlText(g.url)});
          }
        }
        flushImages();
      }
      continue;
    }

    // 通常テキスト
    if (tok.type==='text') {
      const lines=[tok.text];
      i++;
      while (i<tokens.length && tokens[i].type==='text') {
        lines.push(tokens[i].text);
        i++;
      }
      const mods=cm();
      nodes.push({type:'paragraph', html:parseInline(lines.join('\n')), mods});
      continue;
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
        return `<h${node.level} id="${esc(node.id)}"${attrs}>${esc(node.label)}</h${node.level}>`;
      }

      case 'blockquote_inline': return `<blockquote><p>${node.html}</p></blockquote>`;

      case 'blockquote_block': {
        const cu=isSafeUrl(node.cite);
        let h='<blockquote>\n';
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
        return `<div class="math-block">${node.lines.map(l=>esc(l)).join('\n')}</div>`;
      }

      case 'def_block': {
        const ddHtml=node.ddLines.map(l=>`<p>${parseInline(l)}</p>`).join('\n');
        return `<dl class="def-block"><dt>${parseInline(node.term)}</dt><dd>${ddHtml}</dd></dl>`;
      }

      case 'anchor_block': {
        return `<span class="anchor-block" id="${esc(node.id)}">[#${esc(node.label)}]</span>`;
      }

      case 'list': return node.html;

      case 'codeblock': {
        if (!forDisplay) {
          const allLines=[node.shebangLine,...node.lines];
          let h='<figure class="blogable-code">\n';
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
    let h=`<figure class="blogable-code" id="${id}">`;
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

  case 'paragraph': return `<p>${node.html}</p>`;
  default: return '';
}
```

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
return buildAST(tokenize(src.split('\n')));
}

// –– コピー操作 ––
async function copyAll(id){const node=window._cb?.[id];if(!node)return;const allLines=[...(node.shebangLine?[node.shebangLine]:[]),...node.lines];await navigator.clipboard.writeText(allLines.join('\n'));const btn=document.querySelector(`#${id} .copy-all-btn`);if(!btn)return;btn.textContent='copied!';btn.classList.add('copied');setTimeout(()=>{btn.textContent='copy';btn.classList.remove('copied');},1500);}
async function copyLine(id,idx){const node=window._cb?.[id];if(!node)return;const allRows=[...(node.shebangLine?[{text:node.shebangLine}]:[]),...node.lines.map(text=>({text}))];await navigator.clipboard.writeText(allRows[idx]?.text??'');const ln=document.getElementById(`${id}-ln-${idx}`);const lc=document.getElementById(`${id}-lc-${idx}`);if(ln){ln.classList.add('copied');setTimeout(()=>ln.classList.remove('copied'),1500);}if(lc){lc.classList.add('copied');setTimeout(()=>lc.classList.remove('copied'),1500);}}

// –– UI ––
let currentTab=‘preview’;
function switchTab(tab,btn){currentTab=tab;document.querySelectorAll(’.tab-btn’).forEach(b=>b.classList.remove(‘active’));btn.classList.add(‘active’);document.getElementById(‘preview-out’).style.display=tab===‘preview’?’’:‘none’;document.getElementById(‘html-out’).style.display=tab===‘html’?’’:‘none’;render();}
function render(){
cbCounter=0; window._cb={}; footnotes=[];
const src=document.getElementById(‘source’).value;
const ast=parseToAST(src);
if (currentTab===‘preview’) {
document.getElementById(‘preview-out’).innerHTML=astToHtml(ast,true);
if (window.Prism) Prism.highlightAllUnder(document.getElementById(‘preview-out’));
} else {
document.getElementById(‘html-out’).textContent=astToHtml(ast,false);
}
}
let renderTimer=null;
document.getElementById(‘source’).addEventListener(‘input’,()=>{
clearTimeout(renderTimer);
renderTimer=setTimeout(async()=>{render();const updated=await fetchNewOgps(document.getElementById(‘source’).value);if(updated)render();},150);
});

// –– デモソース ––
document.getElementById(‘source’).value = `@@
title: Blogable v1.1-alpha デモ
author: worthmine(Yuki Yoshida)
x-version: 1.1-alpha
@@

:: Blogable v1.1-alpha デモ

---

:: フロントマター

上記の `@@` ブロックがフロントマターです。パースされてドキュメント先頭のメタデータ一覧として表示されます。

---

:: 見出し

:: h2 見出し
::: h3 見出し
:::: h4 見出し

::# 連番 h2
:::# 連番 h3
:::# 連番 h3（カウント継続）

-----

:: 段落

通常のテキスト行は段落になります。

これは強調用クラスを付けた段落です。
@[class: lead]

-----

:: 用語リスト

- Deterministic: A parser is deterministic when the same input always produces the same output with no ambiguity in rule application.
- Single-pass: Processing proceeds line by line in one forward pass. No lookahead or backtracking is performed.

-----

:: 用語リスト

- tokenize: 行をトークン列に変換する第1段階
- buildAST: トークン列からASTノード配列を生成する第3段階

-----

:: 水平線

-----

:: リスト

- ul アイテム A
- ul アイテム B
  - ネスト B-1
  - ネスト B-2
- ul アイテム C

1. ol アイテム 1
1. ol アイテム 2
1. ol アイテム 3

[x] 完了タスク
[ ] 未完了タスク
[x] 完了タスク 2

-----

:: 引用ブロック

> これは1行の引用です。

|>
複数行の引用ブロックです。
**インライン記法**も使えます。

空行で段落が分かれます。
<|
@[author: 著者名]
@[cite: 出典書籍]

-----

:: 数式ブロック

$$
E = mc^2
F = ma
$$

-----

:: インライン記法

**strong** *emphasis* `inline code` ++inserted++ ~~deleted~~

リンク: [https://example.com リンクテキスト]

脚注: [^https://example.com 参考リンク] [^ URLなしの補足]

-----

:: URL・画像

https://www.wikipedia.org/

https://picsum.photos/seed/blogable1/600/200.jpg
@[alt: サンプル画像]
@[title: 画像キャプション]

-----

:: #!blogable ブロック（ハイライトデモ）

#!blogable
:: 見出し h2
::: 見出し h3
:= Term
Definition body paragraph.

[x] タスク完了
[ ] タスク未完了
  **bold** *italic* `code` ++ins++ ~~del~~
  [https://example.com リンク]
  @[class: lead]
  @[cite: https://example.com]
  !#
  @[title: Blogable 記法ハイライト]

-----

:: #!ebnf ブロック（ハイライトデモ）

#!ebnf
Document = [ FrontMatterBlock ] , { Block } ;
Block    = Heading | Paragraph | CodeBlock | QuoteBlock ;
Heading  = “::” , { “:” } , SP , InlineText , NL ;
!#
@[title: EBNF 記法ハイライト]

-----

:: 内部アンカー

[#blogable-v11-alpha-demo]

見出し参照: [#インライン記法]
`;

render();
fetchNewOgps(document.getElementById(‘source’).value).then(u=>{if(u)render();});
