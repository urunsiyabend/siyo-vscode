// Tokenizes Siyo source with the grammar the extension ships, using the same
// TextMate engine (vscode-textmate + vscode-oniguruma) that VS Code runs.
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vsctm from 'vscode-textmate';
import oniguruma from 'vscode-oniguruma';

const require = createRequire(import.meta.url);
const root = new URL('../../', import.meta.url);
export const GRAMMAR_PATH = fileURLToPath(new URL('syntaxes/siyo.tmLanguage.json', root));

let grammarPromise;

async function loadGrammar() {
  const wasm = await readFile(require.resolve('vscode-oniguruma/release/onig.wasm'));
  await oniguruma.loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength));
  const registry = new vsctm.Registry({
    onigLib: Promise.resolve({
      createOnigScanner: (patterns) => new oniguruma.OnigScanner(patterns),
      createOnigString: (s) => new oniguruma.OnigString(s),
    }),
    loadGrammar: async (scopeName) => {
      if (scopeName !== 'source.siyo') return null;
      const text = await readFile(GRAMMAR_PATH, 'utf8');
      return vsctm.parseRawGrammar(text, GRAMMAR_PATH);
    },
  });
  const grammar = await registry.loadGrammar('source.siyo');
  if (!grammar) throw new Error('source.siyo grammar failed to load');
  return grammar;
}

export function getGrammar() {
  grammarPromise ??= loadGrammar();
  return grammarPromise;
}

/** Tokenizes `source` line by line: [[{ text, scopes }]] per line. */
export async function tokenizeLines(source) {
  const grammar = await getGrammar();
  let ruleStack = vsctm.INITIAL;
  return source.split(/\r?\n/).map((line) => {
    const result = grammar.tokenizeLine(line, ruleStack);
    ruleStack = result.ruleStack;
    return result.tokens.map((t) => ({
      text: line.substring(t.startIndex, t.endIndex),
      scopes: t.scopes,
    }));
  });
}

/** All tokens of `source`, flattened across lines. */
export async function tokens(source) {
  return (await tokenizeLines(source)).flat();
}

/**
 * Scopes of the `nth` (0-based) token whose text is exactly `text`.
 * Throws with the full token dump when there is no such token, so a failing
 * test shows how the line was actually split.
 */
export async function scopesOf(source, text, nth = 0) {
  const all = await tokens(source);
  const matches = all.filter((t) => t.text === text);
  if (matches.length <= nth) {
    const dump = all.map((t) => `${JSON.stringify(t.text)} ${t.scopes.join(' ')}`).join('\n');
    throw new Error(`no token #${nth} with text ${JSON.stringify(text)} in:\n${dump}`);
  }
  return matches[nth].scopes;
}

/** Innermost (most specific) scope of a token. */
export async function scopeOf(source, text, nth = 0) {
  const scopes = await scopesOf(source, text, nth);
  return scopes[scopes.length - 1];
}
