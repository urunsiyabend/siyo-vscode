// Tokenization regression tests for syntaxes/siyo.tmLanguage.json.
// Expectations follow the Siyo 0.9.0 compiler (GRAMMAR.md, Lexer.java,
// Parser.java, SyntaxRules.java) at SiyoCompiler 02c2262.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scopeOf, scopesOf, tokens, tokenizeLines } from './helpers/tokenize.mjs';

const has = (scopes, name) => scopes.includes(name);

async function assertScope(source, text, expected, nth = 0) {
  assert.equal(await scopeOf(source, text, nth), expected, `${JSON.stringify(text)} in ${JSON.stringify(source)}`);
}

async function assertNotKeyword(source, text, nth = 0) {
  const scopes = await scopesOf(source, text, nth);
  assert.ok(
    !scopes.some((s) => s.startsWith('keyword.') || s.startsWith('storage.')),
    `${JSON.stringify(text)} in ${JSON.stringify(source)} should not be a keyword: ${scopes.join(' ')}`,
  );
}

describe('comments', () => {
  it('line comment runs to end of line', async () => {
    const all = await tokens('mut x = 1 // note: "not a string" fn');
    const comment = all.find((t) => t.text.includes('note'));
    assert.ok(has(comment.scopes, 'comment.line.double-slash.siyo'));
    assert.ok(!all.some((t) => t.text === 'fn' && t.scopes.some((s) => s.startsWith('storage'))));
  });

  it('does not invent block comments', async () => {
    const all = await tokens('/* x */');
    assert.ok(!all.some((t) => t.scopes.some((s) => s.startsWith('comment'))));
  });
});

describe('keywords', () => {
  const cases = [
    ['if x { } else { }', 'if', 'keyword.control.conditional.siyo'],
    ['if x { } else { }', 'else', 'keyword.control.conditional.siyo'],
    ['match v { _ => 1 }', 'match', 'keyword.control.conditional.siyo'],
    ['while true { }', 'while', 'keyword.control.loop.siyo'],
    ['for x in xs { }', 'for', 'keyword.control.loop.siyo'],
    ['for x in xs { }', 'in', 'keyword.control.loop.siyo'],
    ['do { } while x', 'do', 'keyword.control.loop.siyo'],
    ['return 1', 'return', 'keyword.control.flow.siyo'],
    ['break', 'break', 'keyword.control.flow.siyo'],
    ['continue', 'continue', 'keyword.control.flow.siyo'],
    ['throw err', 'throw', 'keyword.control.flow.siyo'],
    ['try { } catch e { }', 'try', 'keyword.control.trycatch.siyo'],
    ['try { } catch e { }', 'catch', 'keyword.control.trycatch.siyo'],
    ['scope { }', 'scope', 'keyword.control.concurrency.siyo'],
    ['spawn { }', 'spawn', 'keyword.control.concurrency.siyo'],
    ['import "std/io"', 'import', 'keyword.control.import.siyo'],
    ['import java "java.io.File"', 'java', 'keyword.other.java.siyo'],
    ['import "std/math" as m', 'as', 'keyword.operator.as.siyo'],
    ['mut x = 1', 'mut', 'storage.modifier.siyo'],
    ['imut x = 1', 'imut', 'storage.modifier.siyo'],
    ['pub fn f() { }', 'pub', 'storage.modifier.siyo'],
    ['fn f() { }', 'fn', 'storage.type.function.siyo'],
    ['struct P { x: int }', 'struct', 'storage.type.struct.siyo'],
    ['actor C { n: int }', 'actor', 'storage.type.actor.siyo'],
    ['enum E { A }', 'enum', 'storage.type.enum.siyo'],
    ['interface I { }', 'interface', 'storage.type.interface.siyo'],
    ['impl P { }', 'impl', 'storage.type.impl.siyo'],
    ['type R = Ok(int) | Err(string)', 'type', 'storage.type.sum.siyo'],
    ['x as Socket', 'as', 'keyword.operator.as.siyo'],
    ['self.x', 'self', 'variable.language.self.siyo'],
    ['mut b = true', 'true', 'constant.language.boolean.siyo'],
    ['mut b = false', 'false', 'constant.language.boolean.siyo'],
    ['mut b = null', 'null', 'constant.language.null.siyo'],
  ];
  for (const [source, text, scope] of cases) {
    it(`${text} in ${source}`, () => assertScope(source, text, scope));
  }

  it('keywords are whole words', async () => {
    await assertNotKeyword('mut iffy = format', 'iffy');
    await assertNotKeyword('mut iffy = format', 'format');
    await assertNotKeyword('mut typed = 1', 'typed');
  });

  it('match wildcard', () => assertScope('match v { _ => 0 }', '_', 'variable.language.wildcard.siyo'));
});

describe('contextual keywords', () => {
  it('send is a keyword as a statement prefix', () =>
    assertScope('    send counter.increment(1)', 'send', 'keyword.control.concurrency.siyo'));

  it('send is a name elsewhere', async () => {
    await assertScope('ch.send(value)', 'send', 'entity.name.function.member.siyo');
    await assertScope('fn send(self, body: string) { }', 'send', 'entity.name.function.siyo');
    await assertNotKeyword('mut send = 1', 'send');
    await assertNotKeyword('send = 2', 'send');
  });

  it('type is a keyword only in a sum type declaration', async () => {
    await assertScope('pub type Option<T> = Some(T) | None', 'type', 'storage.type.sum.siyo');
    await assertScope('type Option<T> = Some(T) | None', 'Option', 'entity.name.type.sum.siyo');
    await assertNotKeyword('mut type = "GET"', 'type');
    await assertNotKeyword('type = "POST"', 'type');
    await assertNotKeyword('req.type', 'type');
    await assertNotKeyword('if type == "GET" { }', 'type');
  });

  it('java is a keyword only after import', async () => {
    await assertNotKeyword('mut java = 1', 'java');
  });

  it('new is a method name after fn and dot', async () => {
    await assertScope('fn new(x: int) -> Point { }', 'new', 'entity.name.function.siyo');
    await assertScope('spawn Counter.new()', 'new', 'entity.name.function.member.siyo');
  });
});

describe('strings', () => {
  it('double-quoted string', async () => {
    const scopes = await scopesOf('mut s = "hello"', 'hello');
    assert.ok(has(scopes, 'string.quoted.double.siyo'));
  });

  it('valid escapes', async () => {
    for (const esc of ['\\n', '\\r', '\\t', '\\\\', '\\"', '\\0', '\\$', '\\{', '\\}']) {
      await assertScope(`"a${esc}b"`, esc, 'constant.character.escape.siyo');
    }
  });

  it('invalid escape is flagged', () => assertScope('"bad \\q here"', '\\q', 'invalid.illegal.escape.siyo'));

  it('unterminated string ends at end of line', async () => {
    const lines = await tokenizeLines('mut s = "oops\nfn main() { }');
    const fn = lines[1].find((t) => t.text === 'fn');
    assert.ok(has(fn.scopes, 'storage.type.function.siyo'), fn.scopes.join(' '));
    assert.ok(!fn.scopes.some((s) => s.startsWith('string')));
  });

  it('triple-quoted string spans lines', async () => {
    const lines = await tokenizeLines('mut t = """\nfirst "quoted" line\nfn not code\n"""\nfn main() { }');
    const inner = lines[2].find((t) => t.text.includes('fn not code'));
    assert.ok(has(inner.scopes, 'string.quoted.triple.siyo'), inner.scopes.join(' '));
    const quoted = lines[1].find((t) => t.text.includes('quoted'));
    assert.ok(has(quoted.scopes, 'string.quoted.triple.siyo'));
    const after = lines[4].find((t) => t.text === 'fn');
    assert.ok(has(after.scopes, 'storage.type.function.siyo'), after.scopes.join(' '));
  });

  it('triple-quoted string on one line', async () => {
    const scopes = await scopesOf('println("""usage: x "y" z""")', 'usage: x "y" z');
    assert.ok(has(scopes, 'string.quoted.triple.siyo'));
  });

  it('empty string is not a triple quote opener', async () => {
    // `""` followed by more code: the lexer reads `"""` as a triple quote, so
    // only exactly two quotes make an empty string.
    const lines = await tokenizeLines('mut e = ""\nfn main() { }');
    assert.ok(has(lines[1].find((t) => t.text === 'fn').scopes, 'storage.type.function.siyo'));
  });
});

describe('interpolation', () => {
  it('$name', async () => {
    const source = '"hello $name!"';
    const dollar = await scopesOf(source, '$');
    assert.ok(has(dollar, 'punctuation.definition.interpolation.siyo'));
    const name = await scopesOf(source, 'name');
    assert.ok(has(name, 'meta.interpolation.siyo'));
    assert.equal(name.at(-1), 'variable.other.interpolated.siyo');
    const after = await scopesOf(source, '!');
    assert.ok(has(after, 'string.quoted.double.siyo'));
    assert.ok(!has(after, 'meta.interpolation.siyo'));
  });

  it('${expr}', async () => {
    const source = '"sum is ${a + len(xs)} done"';
    assert.equal(await scopeOf(source, '${'), 'punctuation.section.interpolation.begin.siyo');
    assert.equal(await scopeOf(source, '}'), 'punctuation.section.interpolation.end.siyo');
    assert.equal(await scopeOf(source, '+'), 'keyword.operator.arithmetic.siyo');
    assert.equal(await scopeOf(source, 'len'), 'support.function.builtin.siyo');
    const done = await scopesOf(source, ' done');
    assert.ok(has(done, 'string.quoted.double.siyo'));
    assert.ok(!has(done, 'meta.interpolation.siyo'));
  });

  it('nested braces inside ${}', async () => {
    const source = '"v=${ {"k": 1}["k"] } end"';
    const end = await scopesOf(source, ' end');
    assert.ok(!has(end, 'meta.interpolation.siyo'), end.join(' '));
    assert.ok(has(end, 'string.quoted.double.siyo'));
    const k = await scopesOf(source, 'k', 0);
    assert.ok(has(k, 'meta.interpolation.siyo'));
  });

  it('string inside ${} does not end the outer string', async () => {
    const source = '"a ${join(xs, ", ")} b" + rest';
    assert.equal(await scopeOf(source, 'rest'), 'variable.other.siyo');
    assert.ok(has(await scopesOf(source, ' b'), 'string.quoted.double.siyo'));
  });

  it('interpolation in triple-quoted strings', async () => {
    const lines = await tokenizeLines('"""\nHi $who, ${n + 1}\n"""');
    assert.ok(has(lines[1].find((t) => t.text === 'who').scopes, 'meta.interpolation.siyo'));
    assert.equal(lines[1].find((t) => t.text === '+').scopes.at(-1), 'keyword.operator.arithmetic.siyo');
  });

  it('$name stops at the identifier, as the lexer does', async () => {
    // "$self.x" interpolates self and prints ".x" literally.
    const scopes = await scopesOf('"($self.x)"', '.x)');
    assert.ok(!has(scopes, 'meta.interpolation.siyo'), scopes.join(' '));
    assert.ok(has(scopes, 'string.quoted.double.siyo'));
  });

  it('bare braces and lone $ are literal text (old {expr} syntax is gone)', async () => {
    for (const source of ['"Point {x}"', '"cost: $5"', '"end $"']) {
      const all = await tokens(source);
      assert.ok(!all.some((t) => t.scopes.some((s) => s.startsWith('meta.interpolation'))), source);
    }
  });

  it('escaped $ is not interpolation', async () => {
    const all = await tokens('"price \\$name"');
    assert.ok(!all.some((t) => t.scopes.some((s) => s.startsWith('meta.interpolation'))));
  });
});

describe('numbers', () => {
  const cases = [
    ['42', 'constant.numeric.decimal.siyo'],
    ['0xFF', 'constant.numeric.hex.siyo'],
    ['3.14', 'constant.numeric.float.siyo'],
  ];
  for (const [text, scope] of cases) {
    it(text, () => assertScope(`mut n = ${text}`, text, scope));
  }

  it('long suffix', async () => {
    await assertScope('mut n = 9000000000L', '9000000000', 'constant.numeric.decimal.siyo');
    await assertScope('mut n = 9000000000L', 'L', 'storage.type.numeric.long.siyo');
    await assertScope('mut n = 0xFFl', 'l', 'storage.type.numeric.long.siyo');
  });

  it('member access on an integer is not a float', async () => {
    await assertScope('xs[0].name', '0', 'constant.numeric.decimal.siyo');
  });

  it('digits inside identifiers are not numbers', async () => {
    await assertScope('mut hex4 = 1', 'hex4', 'variable.other.definition.siyo');
  });
});

describe('operators and punctuation', () => {
  const cases = [
    ['a -> b', '->', 'keyword.operator.arrow.siyo'],
    ['A => b', '=>', 'keyword.operator.arrow.match.siyo'],
    ['a += 1', '+=', 'keyword.operator.assignment.compound.siyo'],
    ['a /= 1', '/=', 'keyword.operator.assignment.compound.siyo'],
    ['a == b', '==', 'keyword.operator.comparison.siyo'],
    ['a != b', '!=', 'keyword.operator.comparison.siyo'],
    ['a <= b', '<=', 'keyword.operator.comparison.siyo'],
    ['a >= b', '>=', 'keyword.operator.comparison.siyo'],
    ['a && b', '&&', 'keyword.operator.logical.siyo'],
    ['a || b', '||', 'keyword.operator.logical.siyo'],
    ['!a', '!', 'keyword.operator.logical.siyo'],
    ['a << 2', '<<', 'keyword.operator.bitwise.shift.siyo'],
    ['a >> 2', '>>', 'keyword.operator.bitwise.shift.siyo'],
    ['a & b', '&', 'keyword.operator.bitwise.siyo'],
    ['a | b', '|', 'keyword.operator.bitwise.siyo'],
    ['a ^ b', '^', 'keyword.operator.bitwise.siyo'],
    ['~a', '~', 'keyword.operator.bitwise.siyo'],
    ['a = b', '=', 'keyword.operator.assignment.siyo'],
    ['a % b', '%', 'keyword.operator.arithmetic.siyo'],
    ['mut s = #{1, 2}', '#', 'punctuation.definition.set.siyo'],
  ];
  for (const [source, text, scope] of cases) {
    it(`${text} in ${source}`, () => assertScope(source, text, scope));
  }

  it('there is no .. range operator', async () => {
    const all = await tokens('a..b');
    assert.ok(!all.some((t) => t.scopes.some((s) => s.includes('range'))));
  });
});

describe('types', () => {
  it('primitive types in annotations', async () => {
    for (const t of ['int', 'long', 'float', 'bool', 'string']) {
      await assertScope(`fn f(x: ${t}) -> ${t} { }`, t, 'support.type.primitive.siyo');
    }
  });

  it('object, any and collection types in type positions', async () => {
    await assertScope('fn f(x: object) { }', 'object', 'support.type.builtin.siyo');
    await assertScope('mut v: any = 1', 'any', 'support.type.builtin.siyo');
    await assertScope('fn f(c: channel) { }', 'channel', 'support.type.builtin.siyo');
    await assertScope('fn f() -> map { }', 'map', 'support.type.builtin.siyo');
    await assertScope('x as set', 'set', 'support.type.builtin.siyo');
    await assertScope('mut xs: object[] = []', 'object', 'support.type.builtin.siyo');
  });

  it('map/set/channel calls are builtins, not types', async () => {
    await assertScope('mut m = map()', 'map', 'support.function.builtin.siyo');
    await assertScope('mut c = channel(10)', 'channel', 'support.function.builtin.siyo');
    await assertScope('m.set("k", 1)', 'set', 'entity.name.function.member.siyo');
    await assertNotKeyword('mut any = 1', 'any');
  });

  it('double is not a Siyo type', async () => {
    const scopes = await scopesOf('fn f(x: double) { }', 'double');
    assert.ok(!has(scopes, 'support.type.primitive.siyo'), scopes.join(' '));
  });

  it('generic type arguments', async () => {
    const source = 'mut byId: Map<string, Array<Task>> = {}';
    await assertScope(source, 'Map', 'support.type.generic.siyo');
    await assertScope(source, 'Array', 'support.type.generic.siyo');
    await assertScope(source, 'string', 'support.type.primitive.siyo');
    await assertScope(source, 'Task', 'entity.name.type.siyo');
    await assertScope(source, '<', 'punctuation.definition.typeparameters.begin.siyo');
    await assertScope(source, '>', 'punctuation.definition.typeparameters.end.siyo', 0);
    await assertScope(source, '>', 'punctuation.definition.typeparameters.end.siyo', 1);
    await assertScope(source, '=', 'keyword.operator.assignment.siyo');
  });

  it('comparison is not generic', async () => {
    const source = 'if a < b || c > d { }';
    await assertScope(source, '<', 'keyword.operator.comparison.siyo');
    await assertScope(source, '>', 'keyword.operator.comparison.siyo');
    await assertScope('if Count < limit { }', '<', 'keyword.operator.comparison.siyo');
  });

  it('function types', async () => {
    const source = 'fn apply(f: fn(int) -> int, x: int) -> int { f(x) }';
    await assertScope(source, 'fn', 'storage.type.function.siyo', 1);
    await assertScope(source, 'int', 'support.type.primitive.siyo', 0);
  });

  it('PascalCase names are types', () => assertScope('mut p: Point = origin', 'Point', 'entity.name.type.siyo'));
});

describe('declarations', () => {
  it('function declaration', () => assertScope('fn distance(self, other: Point) -> float { }', 'distance', 'entity.name.function.siyo'));

  it('generic function declaration', async () => {
    const source = 'fn identity<T>(x: T) -> T { x }';
    await assertScope(source, 'identity', 'entity.name.function.siyo');
    await assertScope(source, 'T', 'entity.name.type.parameter.siyo', 0);
    await assertScope(source, '<', 'punctuation.definition.typeparameters.begin.siyo');
  });

  it('lambda', async () => {
    const source = 'mut f = fn(n: int) -> int { n * 2 }';
    await assertScope(source, 'fn', 'storage.type.function.siyo');
  });

  it('struct, actor, enum, interface, sum type names', async () => {
    await assertScope('struct Point { x: int }', 'Point', 'entity.name.type.struct.siyo');
    await assertScope('actor Counter { count: int }', 'Counter', 'entity.name.type.actor.siyo');
    await assertScope('actor struct Counter { count: int }', 'Counter', 'entity.name.type.actor.siyo');
    await assertScope('actor struct Counter { count: int }', 'struct', 'storage.type.struct.siyo');
    await assertScope('enum Status { OK = 200, GONE }', 'Status', 'entity.name.type.enum.siyo');
    await assertScope('interface Shape { fn area(self) -> float }', 'Shape', 'entity.name.type.interface.siyo');
    await assertScope('type Result = Ok(int) | Err(string)', 'Result', 'entity.name.type.sum.siyo');
  });

  it('impl and impl ... for', async () => {
    await assertScope('impl Point { }', 'Point', 'entity.name.type.siyo');
    const source = 'impl Shape for Circle { }';
    await assertScope(source, 'for', 'keyword.other.for.siyo');
    await assertScope(source, 'Shape', 'entity.name.type.siyo');
    await assertScope(source, 'Circle', 'entity.name.type.siyo');
  });

  it('variable declarations', async () => {
    await assertScope('mut count = 0', 'count', 'variable.other.definition.siyo');
    await assertScope('for mut i = 0 i < 3 i = i + 1 { }', 'i', 'variable.other.definition.siyo', 0);
  });
});

describe('calls and members', () => {
  it('builtin functions', async () => {
    for (const name of ['println', 'print', 'len', 'push', 'filter', 'reduce', 'forEach', 'typeOf', 'toMap', 'parseLong', 'range', 'error']) {
      await assertScope(`${name}(x)`, name, 'support.function.builtin.siyo');
    }
  });

  it('undocumented internals are not builtins', async () => {
    await assertScope('actorHandle(x)', 'actorHandle', 'entity.name.function.call.siyo');
  });

  it('user function call', () => assertScope('mut d = distance(a, b)', 'distance', 'entity.name.function.call.siyo'));

  it('method calls and properties', async () => {
    const source = 'text.trim().toUpper() + p.x';
    await assertScope(source, 'trim', 'entity.name.function.member.siyo');
    await assertScope(source, 'toUpper', 'entity.name.function.member.siyo');
    await assertScope(source, 'x', 'variable.other.property.siyo');
    await assertScope(source, '.', 'punctuation.accessor.dot.siyo');
  });

  it('builtin name used as method stays a method', () => assertScope('xs.filter(f)', 'filter', 'entity.name.function.member.siyo'));

  it('struct literal type', () => assertScope('Point { x: 1, y: 2 }', 'Point', 'entity.name.type.siyo'));

  it('qualified variant in match pattern', async () => {
    const source = 'Result.Ok(v) => v,';
    await assertScope(source, 'Result', 'entity.name.type.siyo');
    await assertScope(source, '=>', 'keyword.operator.arrow.match.siyo');
  });
});
