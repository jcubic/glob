## 0.2.0

- BREAKING: expand() reports matches of a relative pattern relative to cwd, absolute patterns are unchanged
- fix `.` and `..` segments reached through a wildcard, `*/../*.js` and `**/..` expand like in bash

## 0.1.0

- inital version
