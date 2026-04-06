# Siyo Language Support for Visual Studio Code

Provides syntax highlighting and language support for the [Siyo programming language](https://github.com/siyo-lang/siyo).

## Features

- Full syntax highlighting for `.siyo` files
- Keyword, type, and operator highlighting
- String interpolation support (`{expr}` inside strings)
- Built-in function recognition
- Comment toggling (`Ctrl+/`)
- Bracket matching and auto-closing
- Code folding

## Siyo at a Glance

Siyo is a modern programming language with built-in concurrency primitives, actor-based message passing, and structured concurrency through `scope`/`spawn`.

```siyo
struct Point {
    x: int,
    y: int
}

impl Point {
    fn new(x: int, y: int) -> Point {
        Point { x: x, y: y }
    }

    fn distance(self, other: Point) -> float {
        imut dx = self.x - other.x
        imut dy = self.y - other.y
        toFloat(dx * dx + dy * dy)
    }
}

fn main() {
    imut p1 = Point.new(0, 0)
    imut p2 = Point.new(3, 4)
    println("Distance: {p1.distance(p2)}")
}
```

### Concurrency

```siyo
actor Counter {
    count: int
}

impl Counter {
    fn new() -> Counter {
        Counter { count: 0 }
    }

    fn increment(self) -> int {
        self.count = self.count + 1
        self.count
    }
}

fn main() {
    imut counter = Counter.new()

    scope {
        spawn counter.increment()
        spawn counter.increment()
    }

    println("Count: {counter.count}")
}
```

## Supported Syntax

| Category | Elements |
|----------|----------|
| Keywords | `fn`, `mut`, `imut`, `if`, `else`, `while`, `for`, `in`, `return`, `match`, `break`, `continue` |
| Declarations | `struct`, `enum`, `impl`, `actor`, `import` |
| Concurrency | `spawn`, `scope`, `send` |
| Error handling | `try`, `catch` |
| Types | `int`, `string`, `bool`, `float`, `double`, `long`, `object`, `channel`, `set`, `map` |
| Constants | `true`, `false`, `null`, `self` |
| Built-in functions | `println`, `print`, `input`, `len`, `range`, `push`, `pop`, `map`, `set`, `channel`, and more |

## Installation

### From VS Code Marketplace

Search for **"Siyo Language"** in the Extensions view (`Ctrl+Shift+X`).

### From VSIX

1. Download the `.vsix` file from [Releases](https://github.com/siyo-lang/siyo-vscode/releases)
2. Run: `code --install-extension siyo-0.1.0.vsix`

## Requirements

VS Code 1.75.0 or later.

## License

MIT
