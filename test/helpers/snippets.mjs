import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './fixtures.mjs';

export async function loadSnippets() {
  return JSON.parse(await readFile(path.join(ROOT, 'snippets', 'siyo.json'), 'utf8'));
}

/** Snippet body as the text VS Code inserts when every placeholder keeps its default. */
export function expandSnippet(body) {
  const ESC = { '\\$': '\u0001', '\\}': '\u0002', '\\\\': '\u0003' };
  let text = (Array.isArray(body) ? body.join('\n') : body).replace(/\\[$}\\]/g, (m) => ESC[m]);
  // Resolve placeholders innermost first, remembering each tab stop's default
  // so a mirror ($2 or ${2}) inserts the same text, as VS Code does.
  const defaults = {};
  let previous;
  do {
    previous = text;
    text = text
      .replace(/\$\{(\d+):([^{}]*)\}/g, (_, n, value) => (defaults[n] ??= value))
      .replace(/\$\{(\d+)\|([^,|]*)[^|]*\|\}/g, (_, n, value) => (defaults[n] ??= value));
  } while (text !== previous);
  do {
    previous = text;
    text = text.replace(/\$\{(\d+)\}|\$(\d+)/g, (_, a, b) => defaults[a ?? b] ?? '');
  } while (text !== previous);
  return text.replace(/\u0001/g, '$').replace(/\u0002/g, '}').replace(/\u0003/g, '\\');
}

/**
 * Where each snippet is valid Siyo, and what it needs around it to compile with
 * its default placeholders. Every snippet must be listed here, which keeps the
 * compiler check (test/compiler.test.mjs) covering all of them.
 *  - top: a top-level item; `prelude` is placed before it.
 *  - statement: placed inside fn main(); `locals` are declared before it.
 */
const worker = 'actor Worker { n: int }\nimpl Worker {\n    fn new() -> Worker { Worker { n: 0 } }\n    fn method(self) { }\n}';
export const SNIPPET_CONTEXT = {
  main: { kind: 'top' },
  init: { kind: 'top' },
  fn: { kind: 'top' },
  pubfn: { kind: 'top' },
  fng: { kind: 'top' },
  lambda: { kind: 'statement', locals: '' },
  struct: { kind: 'top' },
  actor: { kind: 'top' },
  enum: { kind: 'top' },
  type: { kind: 'top' },
  interface: { kind: 'top' },
  impl: { kind: 'top', prelude: 'struct Type { x: int }' },
  implfor: { kind: 'top', prelude: 'struct Type { x: int }\ninterface Interface { fn describe() -> string }' },
  mut: { kind: 'statement', locals: '' },
  imut: { kind: 'statement', locals: '' },
  if: { kind: 'statement', locals: 'imut condition = true' },
  ifelse: { kind: 'statement', locals: 'imut condition = true' },
  while: { kind: 'statement', locals: 'imut condition = false' },
  dowhile: { kind: 'statement', locals: 'imut condition = false' },
  for: { kind: 'statement', locals: 'imut n = 3' },
  forin: { kind: 'statement', locals: 'imut items = [1, 2, 3]' },
  match: { kind: 'statement', locals: 'imut value = 1' },
  try: { kind: 'statement', locals: '' },
  throw: { kind: 'statement', locals: '' },
  scope: { kind: 'statement', locals: '' },
  spawn: { kind: 'statement', locals: '' },
  send: { kind: 'statement', prelude: worker, locals: 'mut worker = spawn Worker.new()' },
  import: { kind: 'top' },
  importas: { kind: 'top' },
  importjava: { kind: 'top' },
  test: { kind: 'top' },
};

/** A compilable program around a snippet expanded with its defaults. */
export function programFor(prefix, code) {
  const context = SNIPPET_CONTEXT[prefix];
  const prelude = context.prelude ?? '';
  if (context.kind === 'top') {
    const main = /\bfn main\(/.test(code) ? '' : '\nfn main() { }\n';
    return `${prelude}\n${code}\n${main}`;
  }
  return `${prelude}\nfn main() {\n${context.locals}\n${code}\n}\n`;
}
