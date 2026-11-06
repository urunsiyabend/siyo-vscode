# Changelog

## 0.2.0

Syntax support updated for Siyo 0.9.0. Derived from the compiler's
`GRAMMAR.md`, lexer, parser and test programs.

### Highlighting

- **String interpolation** uses the current `$name` and `${expr}` forms. A `${...}` holding a map literal, a nested string or a call is tokenized as code.
  - The removed `{expr}` form is no longer highlighted: a bare `{` inside a string is plain text.
- **Triple-quoted strings:** added `"""..."""` strings, which may span lines and support interpolation.
- **Escapes:** only the escapes the lexer accepts (`\n \r \t \\ \" \0 \$ \{ \}`) are highlighted as escapes; any other escape is marked invalid.
- **Unterminated strings:** a `"` string that is never closed now ends at the end of its line, as the lexer does, instead of colouring the rest of the file.
- **New keywords and declarations:** `type` sum types, `interface`, `impl Interface for Struct`, `pub`, `throw`, `do ... while`, and `actor struct`.
  - `type` and `send` are highlighted as keywords only where they act as keywords. They stay ordinary names elsewhere: `mut type = "GET"`, `ch.send(x)`, `fn send(...)`.
  - `java` and `new` are reserved words. `new` is highlighted as a method name in `fn new` and `Type.new()`.
- **Types:**
  - Generic type arguments: `Map<string, Array<Task>>` and `fn identity<T>(x: T) -> T`.
  - Function types such as `fn(int) -> int`.
  - `object`, `any`, `channel`, `map` and `set` are highlighted as types only in type positions, so the `map()`, `set()` and `channel()` builtins stay functions.
- **Numbers:** hexadecimal (`0xFF`) and long (`9000000000L`, `0xFFL`) literals. A long suffix on a float (`1.5L`) is marked invalid, as the lexer reports it.
- **New syntax highlighted:** `#{...}` set literals, the `=>` match arrow, the `_` wildcard, and declaration names for functions, structs, actors, enums, sum types, interfaces and variables.
- **Built-in functions** now match the 0.9.0 documented set, which adds `filter`, `reduce`, `forEach`, `parseLong`, `fields`, `field`, `setField`, `toMap`, `typeName` and `typeOf`.
- **Method calls** on built-in names (`text.trim()`, `m.set(k, v)`) are highlighted as methods.
- **Removed** `double`, which is not a Siyo type, and the `..` operator, which the parser does not accept.

### Snippets

- Added 31 snippets for declarations, control flow, concurrency, imports and `std/testing` suites. Every snippet compiles with Siyo 0.9.0 using its default placeholders.

### Project

- **Tests:** added tokenization regression tests that run the shipped grammar through `vscode-textmate` and `vscode-oniguruma` (the engine VS Code uses), with whole-file snapshots of real Siyo programs.
  - An optional check compiles the fixtures and snippets with a real compiler (`SIYOC_JAR`).
- **CI:** tests, packages and verifies the VSIX on every push and pull request.
- **Release workflow:** publishes the tested VSIX to Open VSX and the VS Code Marketplace only when the matching token is configured. A registry without a token is reported as skipped; it does not fail the run.
- **License:** added the MIT `LICENSE` file.

## 0.1.0

- Initial release: syntax highlighting, comment toggling, bracket matching and folding for `.siyo` files.
