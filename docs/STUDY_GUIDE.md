# Study guide: build a mental model before changing code

This project teaches a VM interpreter and browser runtime for the Hack CPU.
Read ARCHITECTURE.md alongside the source. The CPU's comments explain invariants;
the browser modules explain the boundary between machine state and presentation.
The built-in Jack OS is automatically linked; Sokoban is bundled and preloaded at
startup (paused). Exercises can use the bundled game, load custom games, or remain
OS-free. All examples use VM programs you supply through the file picker, load via
the **Load Sokoban** button, or write locally.

## Lesson 1 — the stack

Read parser.js and the push/pop/arithmetic cases in assembly/index.ts. In the
browser save the following text as a local `Main.vm`, create a folder containing it,
select that folder through the file picker, and inspect RAM starting at 256:

```vm
push constant 3
push constant 4
add
pop temp 0
```

Load it using the folder picker in the public build. The built-in OS is not needed
for this script and is not linked. Step four times and inspect RAM[5]; it is 7.
SP starts at 256 and points to the next free word. The linked records are
`[0,0,3,0]`, `[0,0,4,0]`, `[2,0,0,0]`, `[1,5,0,0]`. The host does not execute
these records: WASM does.

**Exercises:** What is SP after each instruction? Replace 3 with 32767 and 4
with 1. Why does the signed result become -32768? How is true represented?

## Lesson 2 — segments and relocation

Read parser.js's two passes and linker.js's OS-filling logic. `static 0` in Main.vm
and `static 0` in Board.vm must not alias; built-in library classes use class-prefixed
namespaces (e.g., Math.static, Output.static) to avoid collisions. The linker
assigns absolute addresses only after validating source and merging user files
with built-in OS. Branch labels belong to functions, not to a single global namespace.

**Exercises:** Write two functions with the same label name. Why do they link?
Try an undefined label and note the diagnostic location. Why does loading the
parent folder with duplicate Main.vm files fail? Which segment reads
RAM[THIS+index], and which changes THIS itself? Load a game that needs built-in
Memory or Screen; which OS functions are automatically linked?

## Lesson 3 — call frames

Read assembly/index.ts: enter() and the return case. Draw the saved frame:

```
FRAME-5  return address
FRAME-4  saved LCL
FRAME-3  saved ARG
FRAME-2  saved THIS
FRAME-1  saved THAT
FRAME    first local / next stack slot at function entry
```

Create a folder with this OS-free program and run it; inspect temp 0 (RAM[5]):

```vm
function Main.main 0
push constant 6
push constant 7
call Main.add 2
pop temp 0
push constant 0
return
function Main.add 0
push argument 0
push argument 1
add
return
```

**Exercises:** Predict ARG and LCL just before Main.add executes. Where does
its result go? Why must RET be saved before overwriting RAM[ARG]? Why does the
synthetic bootstrap frame make returning from Main.main safe? Extend this to
recursive summation and compare with tests/runtime.test.mjs.

## Lesson 4 — pixels and keys are RAM

Read display.js and keyboard.js, then write a local VM script. A word has sixteen
pixels and each row has 32 words. No native Screen API is required to draw.
Set bits are rendered white on black in this application.

**Exercises:** Calculate the word and bit for pixel (37,10): address 16706,
bit 5. Write 32 at that address. Draw a diagonal with word masks. Focus the
canvas, hold Left, then Right, release Right and inspect RAM[24576]. Why does
Left reappear? What happens when the canvas loses focus?

## Lesson 5 — scheduling, measurement and debugging

Read player.js. The CPU runs bounded batches and returns to the browser so input
and painting can happen. A busy VM loop cannot own the UI thread indefinitely.
The instruction budget changes interpreted Sys.wait duration; Clock.now uses
monotonic milliseconds modulo 32768 and is sampled per WASM batch.

**Exercises:** Compare the same game at 25k and 100k instructions/frame. Does
a slower drawing routine affect timing? Explain why Clock.elapsed is ambiguous
if more than one wrap passes. Temporarily hide the tab: why pause rather than
catch up millions of instructions? Compare a parser error with a CPU RAM-bounds
fault. Use the source marker and RAM pane to find the offending instruction.

## Read the tests as executable specifications

`npm test` compiles WASM and verifies arithmetic, signed comparison, segments,
recursion, frame restoration, labels, statics, native hook arities, memory
faults and direct screen writes. It also verifies that built-in OS functions
are linked when needed and user-supplied functions take precedence. The browser
suite checks UI controls, drawing, keyboard input, pause/step/reset, local `.vm`
file loading with directory recursion, built-in OS linking, and public packaging.
These are conformance and integration tests, not proofs of every possible VM program.

## Extension ideas

1. Add a call-stack viewer using RAM frame links (do not alter CPU semantics).
2. Highlight a single source line without rebuilding the entire text pane.
3. Implement optional breakpoints in the host scheduler.
4. Add a palette selector without changing RAM bit meaning.
5. Add independent OS-free VM test programs for each opcode.

Keep browser presentation out of the CPU, add a failing test first, and avoid
bundling third-party material until its redistribution terms are established.
