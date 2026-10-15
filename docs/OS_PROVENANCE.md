# OS Provenance — Built-in Jack OS Source and Licensing

## Overview

This repository embeds 15 standard Jack OS classes in `web/builtin-os.js`,
generated from VM bytecode using `tools/embed-os.mjs`. The embedded classes
provide standard nand2tetris Jack OS functionality for games and applications.

## Built-in Classes

The embedded OS includes:

- **Array.vm** — dynamic array allocation and disposal
- **Clock.vm** — optional monotonic time (host hook)
- **Console.vm** — console text output with region clearing
- **Input.vm** — buffered keyboard input tracking
- **IntQueue.vm** — integer queue data structure
- **IntStack.vm** — integer stack data structure
- **Keyboard.vm** — raw keyboard register and line input
- **Math.vm** — fixed-point arithmetic (multiply, divide, abs)
- **Memory.vm** — heap allocation, deallocation and peek/poke
- **Output.vm** — character and string output with glyph rendering
- **Random.vm** — linear-congruential random number generation
- **Screen.vm** — pixel drawing and line rendering
- **String.vm** — string manipulation and integer parsing
- **Sys.vm** — system initialization, halt and error handling
- **Timer.vm** — countdown timer data structure

## Original Source and Licence Status

The exact provenance and original licence of these classes **is not clearly
established** in this repository. The bytecode was originally distributed with
nand2tetris, but:

1. Reconstruction via decompiler loses metadata about original terms.
2. The nand2tetris teaching platform does not declare an explicit SPDX licence.
3. Original Jack OS source rights and scope are not formally documented here.

**Before public redistribution of this application or the embedded OS material,**
you must:

- Consult the original nand2tetris distribution:
  https://www.nand2tetris.org/
- Verify the current licensing terms for the course materials and software.
- Obtain explicit permission if required by the original authors.
- Document your compliance in your own derivative work.

This application's own code (interpreter, linker, runtime, UI, tooling) is MIT
licensed. **This does not automatically grant permission to redistribute the
original Jack OS bytecode.** The two licences are distinct.

## Development Workflow

During development, `tools/embed-os.mjs` reads 15 standard `.vm` class files from
a local checkout of the [jackos repository](https://github.com/kpillai2017/jackos).
The tool regenerates `web/builtin-os.js` as a JavaScript module. This source file
is then checked into version control.

**Normal builds do not run this tool.** The checked-in `web/builtin-os.js` is used
directly; no sibling repositories are required for end users or CI/CD.

## User Programs

User-supplied game and application `.vm` files loaded through the browser are
**not affected** by this licensing notice. Users remain responsible for the
licensing of their own programs. This application's linker merges user files
with the embedded OS; the result runs in the browser without uploading to
external servers.

If a user program provides its own version of any OS class (e.g., custom
Math.vm), that user-supplied version takes precedence, and the built-in is
not linked.

## Recommendations

1. **For educational use:** This application is suitable for teaching in the
   nand2tetris curriculum under the original course terms.

2. **For redistribution:** Before publishing this application (or the embedded
   OS) to the public, contact the original authors and clarify your intended use.
   Modify the licence header in `web/builtin-os.js` to reflect any obtained
   permission.

3. **For derivative works:** If you modify the embedded OS bytecode, retain
   attribution and document your changes. If you use this application as a
   reference but distribute different code, this notice may not apply.

4. **For private use:** No action is required for private, non-public use.

## Attribution

The Jack OS source, memory map and instruction set come from:

> **The Elements of Computing Systems: Building a Modern Computer from First
> Principles** by Noam Nisan and Shimon Schocken.
> https://www.nand2tetris.org/

The bytecode was reconstructed and refactored by kpillai2017 using the
jack-decompiler tool; see `jackos/docs/ATTRIBUTION.md` in the companion
repository for full provenance details.

This notice does not constitute a licence grant; consult the original source
before redistribution.
