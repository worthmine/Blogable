/**
 * setup.js — loads Blogable.js in a mock browser context for Node.js testing.
 *
 * Blogable.js is a browser-only script that references `document`, `window`,
 * `Prism`, and `navigator`.  This module mocks the minimal subset needed so
 * that the pure parser functions (tokenize, buildAST, astToHtml, parseToAST)
 * can be exercised from Node.
 */

'use strict';

const vm   = require('node:vm');
const fs   = require('node:fs');
const path = require('node:path');

// ── Minimal DOM stubs ─────────────────────────────────────────────────────────

function makeFakeElement() {
  return {
    addEventListener() {},
    style: {},
    value: '',
    textContent: '',
    innerHTML: '',
    classList: { add() {}, remove() {} },
    dataset: {},
  };
}

const fakeDocument = {
  getElementById()    { return makeFakeElement(); },
  querySelector()     { return makeFakeElement(); },
  querySelectorAll()  { return []; },
};

const fakeWindow = { _cb: {} };
const fakePrism  = { languages: {}, highlightAllUnder() {} };

// ── Load the parser inside an isolated vm context ─────────────────────────────

const src = fs.readFileSync(
  path.resolve(__dirname, '..', 'statics', 'Blogable.js'),
  'utf8'
);

const ctx = vm.createContext({
  document:  fakeDocument,
  window:    fakeWindow,
  Prism:     fakePrism,
  navigator: { clipboard: { writeText: async () => {} } },
  console,
  setTimeout,
  clearTimeout,
});

vm.runInContext(src, ctx);

// ── Exported helpers ──────────────────────────────────────────────────────────

/**
 * parse(src) → HTML string (non-display mode, no UI decorations)
 *
 * Equivalent to: astToHtml(parseToAST(src), false)
 * parseToAST resets headingIds and footnotes so each call is independent.
 */
function parse(src) {
  // Clear callback storage for test isolation; non-display rendering does not use cbCounter.
  ctx.window._cb = {};

  const ast = ctx.parseToAST(src);
  return ctx.astToHtml(ast, false);
}

/** Equivalent to astToHtml(parseToAST(src), true) for preview-mode rendering. */
function renderDisplay(src) {
  ctx.window._cb = {};

  const ast = ctx.parseToAST(src);
  return ctx.astToHtml(ast, true);
}

/** Low-level access for tests that inspect the token stream directly. */
function tokenize(src) {
  return ctx.tokenize(src.split('\n'));
}

/** Low-level access for tests that inspect the AST directly. */
function buildAST(src) {
  return ctx.buildAST(ctx.tokenize(src.split('\n')));
}

/** Returns the diagnostics collected during the most recent parse() call. */
function getDiagnostics() {
  return ctx.getBlogableDiagnostics();
}

function getPrismLanguages() {
  return ctx.Prism.languages;
}

module.exports = { parse, renderDisplay, tokenize, buildAST, getDiagnostics, getPrismLanguages };
