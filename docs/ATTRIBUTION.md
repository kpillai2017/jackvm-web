# Attribution and licensing

Copyright © 2026 **kpillai2017**. The original WebAssembly interpreter,
JavaScript linker and browser adapters, UI, tooling and documentation are
licensed under the root [MIT license](../LICENSE).

## Educational foundation

The standard Jack VM instruction set, OS API conventions and Hack memory map
come from **nand2tetris / The Elements of Computing Systems**, by **Noam Nisan
and Shimon Schocken**, https://www.nand2tetris.org/ . These are conceptual and
compatibility references; this application does not include course tools or
game programs. It embeds OS bytecode, including font data, from the local JackOS
teaching edition. The existing Python VM was consulted for compatibility;
its Python source is not bundled. See the OS provenance notice below.

## Built-in OS and bundled vs. user programs

This project contains **no game VM files or game folders**. It does contain a
**built-in Jack OS library** (15 standard classes: Array, Clock, Console, Input,
IntQueue, IntStack, Keyboard, Math, Memory, Output, Random, Screen, String, Sys,
Timer) embedded in checked-in `web/builtin-os.js` and regenerated from
`jackos/src` using `tools/embed-os.mjs`.

Users choose their own game `.vm` files through the browser's local file picker.
These files are read in-browser and are not uploaded to the site or copied into
its repository. The built-in OS is automatically linked; users do not need to
supply standard library classes. If a user program provides its own version of
any built-in class (e.g., custom Math.vm), that user-supplied class takes
precedence. The loader neither grants nor changes the licenses of user-supplied
programs or the original OS material.

The embedded OS bytecode is generated once and checked in (not absent or reconstructed
at runtime). Before redistributing the application or OS material separately, see
**OS_PROVENANCE.md** in this directory.

If you redistribute games or OS material separately, retain their notices and
check applicable source-availability and permission requirements. Attribution
alone is not redistribution permission. This application's MIT license does
not relicense user-supplied programs or the original nand2tetris OS bytecode.

## Development dependencies and OS provenance

- **AssemblyScript** (Apache-2.0): compiles `assembly/index.ts` to WebAssembly.
- **Playwright** (Apache-2.0): development-only browser testing.
- **jackos repository** (reference; not a dependency): `tools/embed-os.mjs` reads
  15 standard `.vm` classes from a local checkout of `jackos/src` and generates
  `web/builtin-os.js`. This tool is developer-only; normal builds use the
  generated, checked-in module.

Installed npm packages retain their own notices. Dependency folders and test
browsers are not deployed as site assets. The compiled WASM contains
compiler-generated runtime machinery and uses AssemblyScript's stub runtime.
There is no pygame, Python VM, ANTLR runtime, or game art in the static site.

**Important:** The embedded OS bytecode's original provenance (including license
and copyright) is not clearly established in this repository. Before public
redistribution, consult **OS_PROVENANCE.md** in this directory and verify
compliance with nand2tetris/original source terms.
