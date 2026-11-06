# Siyo Language Support for Visual Studio Code

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/SiyoLang.siyo?label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=SiyoLang.siyo)
[![Open VSX](https://img.shields.io/open-vsx/v/SiyoLang/siyo?label=Open%20VSX)](https://open-vsx.org/extension/SiyoLang/siyo)

Syntax highlighting and snippets for the [Siyo programming language](https://github.com/urunsiyabend/SiyoCompiler), tracking **Siyo 0.9.0**.

This is a declarative extension: a TextMate grammar, a language configuration and snippets. It does not include a language server, so there are no diagnostics, completion, go-to-definition or formatting. To check a program, run `siyoc`.

## Features

- Syntax highlighting for `.siyo` files:
  - String interpolation: `"hello $name"` and `"sum is ${a + b}"`, in both regular and `"""triple-quoted"""` strings. Escapes the lexer does not accept are marked invalid.
  - Declarations: `fn`, `struct`, `actor`, `enum`, `type` sum types, `interface`, `impl` and `impl Interface for Struct`, `pub`.
  - Generic types: `Map<string, Array<Task>>`, `fn identity<T>(x: T) -> T`, and function types such as `fn(int) -> int`.
  - Numbers: decimal, hexadecimal (`0xFF`), long (`9000000000L`) and float literals.
  - Concurrency: `scope`, `spawn`, `send`, and actors.
  - Error handling: `try` / `catch`, `throw`.
  - Contextual keywords: `type` and `send` are highlighted as keywords only where they act as keywords. They stay ordinary names elsewhere, as the parser allows: `mut type = "GET"`, `ch.send(x)`.
  - The built-in functions documented for 0.9.0.
- Snippets for common declarations, control flow, concurrency, imports and `std/testing` suites.
- Comment toggling (`Ctrl+/`), bracket matching, auto-closing pairs and folding.

## Siyo at a Glance

```siyo
import "std/strings"

type Shape = Circle(float) | Rect(float, float)

interface Describe {
    fn describe() -> string
}

struct Point { x: int, y: int }

impl Describe for Point {
    fn describe(self) -> string { "(${self.x}, ${self.y})" }
}

fn area(s: Shape) -> float {
    match s {
        Circle(r) => 3.14159 * r * r,
        Rect(w, h) => w * h,
    }
}

fn main() {
    imut p = Point { x: 3, y: 4 }
    println("point $p is ${p.describe()}, area ${area(Rect(2.0, 3.0))}")
}
```

### Concurrency

```siyo
actor Counter { count: int }

impl Counter {
    fn new() -> Counter { Counter { count: 0 } }
    fn increment(self, n: int) -> int {
        self.count += n
        self.count
    }
}

fn main() {
    mut c = spawn Counter.new()
    imut now = c.increment(5)   // synchronous call
    send c.increment(1)         // fire-and-forget

    scope {
        spawn { println("task one") }
        spawn { println("task two") }
    }   // both tasks are joined here
}
```

## Supported Syntax

| Category | Elements |
|----------|----------|
| Control flow | `if`, `else`, `match`, `while`, `do`, `for`, `in`, `return`, `break`, `continue` |
| Declarations | `fn`, `mut`, `imut`, `pub`, `struct`, `actor`, `enum`, `type`, `interface`, `impl`, `impl ... for` |
| Modules | `import "module"`, `import "module" as alias`, `import java "pkg.Class"` |
| Concurrency | `scope`, `spawn`, `send` |
| Errors | `try`, `catch`, `throw` |
| Types | `int`, `long`, `float`, `bool`, `string`, `object`, `any`, `channel`, `map`, `set`, `fn(...) -> T`, `T[]`, `Array<T>`, `List<T>`, `Map<K, V>`, `Set<T>` |
| Literals | `true`, `false`, `null`, `42`, `0xFF`, `9000000000L`, `3.14`, `"..."`, `"""..."""`, `[..]`, `{"k": v}`, `#{..}` |
| Operators | `+ - * / %`, `== != < <= > >=`, `&& \|\| !`, `& \| ^ ~ << >>`, `= += -= *= /=`, `->`, `=>`, `as` |
| Built-ins | `print`, `println`, `input`, `error`, `len`, `toString`, `parseInt`, `push`, `pop`, `map`, `filter`, `reduce`, `forEach`, `range`, `typeOf`, and the rest of the 0.9.0 list |

## Snippets

| Prefix | Inserts |
|--------|---------|
| `main`, `init` | `fn main()` / `fn init()` |
| `fn`, `pubfn`, `fng`, `lambda` | function, exported function, generic function, lambda |
| `struct`, `actor`, `enum`, `type`, `interface` | type declarations (`actor` includes its `new` constructor) |
| `impl`, `implfor` | `impl Type { }`, `impl Interface for Type { }` |
| `mut`, `imut` | variable declarations |
| `if`, `ifelse`, `match` | conditionals |
| `while`, `dowhile`, `for`, `forin` | loops |
| `try`, `throw` | error handling |
| `scope`, `spawn`, `send` | concurrency |
| `import`, `importas`, `importjava` | imports |
| `test` | a `std/testing` test file |

## Installation

### From VS Code Marketplace

Search for **"Siyo Language"** in the Extensions view (`Ctrl+Shift+X`) or install directly from the [Marketplace page](https://marketplace.visualstudio.com/items?itemName=SiyoLang.siyo).

### From Open VSX

Available on [Open VSX Registry](https://open-vsx.org/extension/SiyoLang/siyo) for VS Code compatible editors like VSCodium, Gitpod, and Eclipse Theia.

### From VSIX

1. Download the `.vsix` file from [Releases](https://github.com/urunsiyabend/siyo-vscode/releases)
2. Run: `code --install-extension siyo-0.2.0.vsix`

## Requirements

VS Code 1.75.0 or later.

## Development

Requires Node.js 22 or later (see `.nvmrc`).

```sh
npm ci                 # install the pinned toolchain
npm test               # tokenization, snapshot and snippet tests
npm run package        # build siyo-<version>.vsix
npm run verify:vsix    # check the VSIX contents and version
```

- **Grammar tests** load `syntaxes/siyo.tmLanguage.json` with `vscode-textmate` and `vscode-oniguruma`, the engine VS Code uses. They assert the scopes of real Siyo code.
- **Snapshot tests** cover `example.siyo` and `test/fixtures/*.siyo`, which are written in `test/snapshots/`. After an intended grammar change, regenerate them with `UPDATE_SNAPSHOTS=1 npm test` and review the diff.
- **Compiler check** (optional): to compile every fixture and snippet with a real Siyo compiler, run `SIYOC_JAR=/path/to/siyo-compiler-0.9.0.jar npm test`. It needs Java.

### Releasing

1. Bump `version` in `package.json` and add a `CHANGELOG.md` entry.
2. Push a tag `v<version>`.

The **Release** workflow then:

1. Checks that the tag matches `package.json`.
2. Runs the tests.
3. Packages and verifies the VSIX.
4. Attaches the VSIX to the GitHub release.
5. Publishes that same VSIX to each registry whose token is configured as a repository secret:

| Registry | Secret |
|----------|--------|
| Open VSX | `OVSX_PAT` |
| VS Code Marketplace | `VSCE_PAT` |

A registry without a token is skipped, and the skip is reported in the run summary. A publish that fails fails the run.

## License

[MIT](LICENSE)
