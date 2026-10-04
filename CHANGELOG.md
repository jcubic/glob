## 0.3.0

- add support for a trailing separator, `*/` and `**/` match directories only and keep the separator
- BREAKING: a wildcard no longer matches entries starting with a dot, new `dot: true` option opts back in
- BREAKING: match() applies the same dot rule, it accepts options as third argument, `match(pattern, str, options)`
- BREAKING: Path#toString() compiles the dot rule into the expression, `toString({ dot: true })` leaves it out

## 0.2.0

- BREAKING: expand() reports matches of a relative pattern relative to cwd, absolute patterns are unchanged
- fix `.` and `..` segments reached through a wildcard, `*/../*.js` and `**/..` expand like in bash

## 0.1.0

- inital version
