# Architecture: from VM text to browser pixels

## 1. Boundaries and data flow

```
explicitly selected local File objects
                 ↓
          app.js composition root
                 ↓
 parser.js: validate → collect symbols → relocate / link
                 ↓
 { instructions: Int32Array, locations, entry }
                 ↓
 runtime.js: copy instruction records to WASM linear memory
                 ↓
 assembly/index.ts: run(budget, monotonicMilliseconds)
                 ↓
       signed 16-bit Hack RAM
          ↙                  ↖
 display.js → canvas    keyboard.js ← focused browser keys
                 ↑
 player.js: requestAnimationFrame, bounded batches, repaint, yield
```

Dependency direction is deliberate: the CPU knows nothing about the DOM, file
names, fetch, games, or the canvas. The linker knows nothing about rendering.
`Runtime` is an adapter for the WASM ABI; `Player` is a cooperative scheduler;
`app.js` assembles these components rather than mixing them into the CPU loop.
No framework or backend is necessary.

## 2. Parsing and linking

`linkProgram([{name,source}], {entry:'auto'})` accepts user-supplied `.vm` files,
parses them with `parseProgram`, and fills missing OS functions from the built-in
library embedded in `web/builtin-os.js` (15 standard Jack OS classes). User function
definitions always win; the linker is invoked to detect unresolved calls, then
fills absent built-in functions from the embedded library once OS support is needed. This keeps OS-free
test programs and simple scripts lean.

`parseProgram([{name,source}], {entry:'auto'})` strips `//` comments, validates
operands, and reports filename/line diagnostics. It rejects duplicate basenames
(including directory uploads containing multiple games), duplicate functions
and labels, illegal segment indices, oversized programs and unresolved calls.
Labels belong to their function; top-level scripts get a file scope. Static
variables in conventional single-class files are keyed by VM filename and index.
Merged multi-class files (such as built-in library files) use the class prefix
of the current function instead: Math.static 0 and Output.static 0 must not alias.
This supports the embedded OS format while preserving ordinary file-based static
semantics.
Only referenced static slots are allocated, in deterministic filename order,
within RAM 16..255. The conventional sparse-index layout is not guaranteed.

There is one source-location entry per executable record. Labels do not execute.
A linked instruction is four little-endian i32 words:

```
[ opcode, segment, a, b ]
```

| Operation | Opcode | Operands |
|---|---:|---|
| push / pop | 0 / 1 | segment, index (static already absolute) |
| add, sub, neg, eq, gt, lt, and, or, not | 2..10 | none |
| goto / if-goto | 11 / 12 | a = resolved PC |
| function | 13 | a = local count |
| call | 14 | a = target PC, b = argument count |
| return | 15 | none |
| Clock.supported / Clock.now | 16 / 17 | native call, zero arguments |
| Sys.halt / Sys.error | 18 / 19 | zero / one arguments respectively |

Segments: constant=0, local=1, argument=2, this=3, that=4, temp=5,
pointer=6, static=7. Example: `push constant 42` → `[0,0,42,0]`.
The ABI is internal, not a standard .vm binary serialization format.

Auto entry chooses `Sys.init`, then `Main.main`, then top-level instruction 0.
A function entry gets a synthetic caller frame. `entry:'script'` bypasses that
frame; an explicit function name is also supported by the parser API. Returning
from the entry function halts cleanly using sentinel return address 65535.
At most 65534 executable records fit because return addresses occupy one word.

## 3. CPU and memory model

AssemblyScript compiles into `web/runtime.wasm`. It reserves separate linear
memory regions for the Hack RAM array (65536 bytes) and linked instructions.
The CPU executes in WASM, not a JavaScript fallback. CPU RAM addresses below
are **word indices relative to ramPointer()**, not raw WASM byte addresses.

| Hack RAM words | Purpose |
|---|---|
| 0 | SP: next free stack word |
| 1..4 | LCL, ARG, THIS, THAT segment pointers |
| 5..12 | temp 0..7 |
| 13..15 | conventional scratch registers, otherwise ordinary RAM |
| 16..255 | linked static variables |
| 256..2047 | stack, growing toward increasing addresses |
| 2048..16383 | heap managed by the loaded OS, not by the CPU |
| 16384..24575 | 8192 screen words |
| 24576 | keyboard register (0 when no key is held) |
| 24577..32767 | remaining addressable RAM |

Arithmetic stores truncate to signed i16. Thus 32767+1=-32768; comparisons use
signed operands; true=-1, false=0. Addresses are checked as unsigned pointer
values plus offsets, not silently wrapped into arbitrary WASM memory. Stack
push/pop are confined to 256..2047 to protect the OS heap. This is a deliberate
diagnostic guard, not a claim that a hardware Hack CPU enforces stack bounds.

`call f n` pushes return PC and LCL/ARG/THIS/THAT, sets ARG=SP-n-5 and LCL=SP,
and jumps to the function declaration, which pushes zero-initialized locals.
`return` remembers FRAME=LCL and RET=RAM[FRAME-5], moves the result to RAM[ARG],
sets SP=ARG+1, restores THAT/THIS/ARG/LCL, then jumps to RET. Tests cover nested
calls and recursion. A malformed frame, stack overflow/underflow or illegal
RAM address becomes a visible fault instead of corrupting the host.

## 4. WASM ABI and OS policy

Exports: `memory`, `ramPointer`, `codePointer`, `reset(length,entry)`,
`run(budget,now)`, `setKey`, `getPC`, `getStatus`, `getError`, `getExecuted`.
`run` returns 0=running, 1=halted, 2=fault. `runtime.js` owns the typed views and
validates the host-side budget. Its only WASM import is an assertion-abort
handler; there is no WASI, network access or DOM inside the module.

Fault codes: 1=RAM bounds, 2=stack overflow, 3=stack underflow,
4=invalid PC, 5=return frame, 6=opcode. `Sys.error(n)` produces code 1000+n
(using the unsigned 16-bit argument). PC normally points to the next record
after a fault; `locations[pc-1]` helps diagnose the executed instruction.

Only four calls are native: Clock.supported() returns -1, Clock.now() returns
`floor(now % 32768)`, Sys.halt() halts, and Sys.error(code) reports a fault.
The linker checks their arities and replaces call records with hook opcodes.
These hooks are reserved even if fallback definitions appear in loaded VM.
Clock.elapsed remains ordinary bytecode. All Memory, Math, Screen, Output,
String, Keyboard and extended OS operations run as supplied VM code.
**Sys.wait is not intercepted** and preserves the local games' instruction-work
timing. User-written scripts can use direct RAM writes and require no OS.

## 5. Browser I/O and cooperative scheduling

A screen word represents 16 horizontal pixels, least significant bit leftmost:

```
word = RAM[16384 + y*32 + floor(x/16)]
pixel = (word >>> (x % 16)) & 1
```

Dimensions are x=0..511, y=0..255. The renderer displays set bits white and clear
bits black (an inverted palette relative to traditional black-on-white Hack
screens; the bit layout is unchanged). A dirty-word cache avoids conversion
when RAM hasn't changed. Reset invalidates the cache and clears the canvas.

Keyboard mapping: printable ASCII 32..126 with letters normalized to uppercase
(A=65..Z=90), regardless of Shift/Caps Lock; Enter=128, Backspace=129,
Left/Up/Right/Down=130..133, Home/End/PageUp/PageDown/Insert/Delete=134..139,
Esc=140, F1..F12=141..152. Physical key tracking avoids stuck keys if Shift is
released first. The newest held key wins; releasing it restores the previous
held key. Blur clears input; shortcuts outside the canvas remain normal.

`Player` samples input once per frame, calls WASM in batches of up to 4096,
and yields after about 8ms of CPU work. The default budget is 40,000 instructions (the original jackvm-rs web player baseline,
recorded in jackvm-py's player.py and README). The Original button restores this
budget without changing CPU state. Budgets are measured
per nominal 60Hz frame. Catch-up is capped at three frames. Source-pane refresh
is throttled to avoid rebuilding thousands of lines every frame. Hidden tabs
pause. No scheduler can guarantee exact game speed across machines.

## 6. Loading and distribution

Sokoban is bundled and preloaded at startup, paused. Users can press **Run** to play
it, or click **Load Sokoban** to restore it after loading custom files. Additional
game `.vm` files are loaded through the browser's file picker. The app accepts a
directory containing a complete game VM set. The linker automatically merges
user-supplied files with the embedded Jack OS library (15 standard classes
from `web/builtin-os.js`); missing OS functions are filled transparently. User
definitions always take precedence.
File names must be unique within the selected set; only one program loads at a time.
Loading builds a new linked program and WASM instance before replacing the
previous paused program. A version token makes stale asynchronous requests harmless.

`tools/package.mjs` whitelists public assets and cleans dist before each build.
The build ships the interpreter, WASM module, embedded Jack OS bytecode in
`web/builtin-os.js`, Sokoban bundled (seven VM files, matching source in
corresponding-source/sokoban with GPL LICENSE), and documentation.
The embedded OS is generated once via `tools/embed-os.mjs` (reading 15 `.vm`
classes from `jackos/src`) and checked in; normal builds use the generated module.
Sokoban source availability for GPL compliance is shipped in `corresponding-source/sokoban`.
See ATTRIBUTION.md, SOKOBAN_LICENSE.txt and SOKOBAN_PROVENANCE.md for licensing context.
All files stay in the browser; there is no upload endpoint. File reading uses the
browser's native picker, not unrestricted disk access.
