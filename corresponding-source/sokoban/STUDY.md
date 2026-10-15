# How the Sokoban program works

## 1. Read the program from the outside in

```
Sys.init -> Main.main
               owns Game
                |-- owns Board -- owns terrain[320], boxes[320]
                |           `-- owns History -- positions[512], actions[512]
                |-- owns Draw -- masks[112]
                `-- owns optional saved String

Levels -------> Board.row (transfers each row String)
Game ---------> SaveCodec (stateless functions)
Draw ---------> Board (borrowed read-only queries)
```

`Main` constructs one controller, runs it and disposes it. `Game` alone polls
the keyboard. `Board` knows Sokoban but nothing about pixels or keyboard codes.
`Draw` reads a Board but never changes it. `Levels` is data; `SaveCodec` is a
boundary for untrusted input. This is a small model/view/controller design,
not a general UI framework. The History entries are reversible **commands**;
we do not allocate a complete board snapshot for every step.

**Ownership rule:** the creator frees an object unless an API explicitly
transfers it. `Board.row(String,y)` and UI `text` helpers consume strings.
`Game.getBoard()` returns a borrowed reference; do not dispose it. A call to
`SaveCodec.encode` returns a newly owned String. Follow every `new()` to its
corresponding `dispose()` as a first reading exercise.

## 2. Coordinates and representation

There are two coordinate systems:

- Puzzle coordinates: `(x,y)`, upper-left origin, positive y downwards.
- Hack screen coordinates: `(pixelX,pixelY)`, also upper-left origin.

A puzzle cell is `index = y*20+x`. **20 is a stride, not the actual level
width.** Two 320-element arrays support the campaign's maximum 19×16 board.
`width` and `height` restrict rendering. Unused cells and exterior space are
void. `terrainAt` and `boxAt` handle indices outside 0..319 without array access.

| Terrain | Meaning | Traversable? |
|---|---|---|
| 0 | Exterior / unused cell | No |
| 1 | Wall | No |
| 2 | Floor | Yes |
| 3 | Goal | Yes |

Boxes are separate booleans; the player is a single index. A box on a goal is
therefore `terrain[i]=3 AND boxes[i]`, not a destructive replacement of terrain.
Moving an occupant away cannot erase its underlying goal. This separation is
both a useful design invariant and the basis for reliable undo and saving.

Low-level setters (`setBox`, `setPlayer`, `setCounters`) are deliberately narrow
internal construction/restoration hooks. They trust callers. Interactive moves
must use `move`, and imported data must pass through `SaveCodec.decode`.
`setBox` does not recompute `boxCount`: a restore must preserve the campaign's
expected count, and the codec checks exactly that many unique positions.

## 3. One move is a transaction

`Board.move(dx,dy)`:

1. Reject anything except one cardinal unit step; reject the move-counter cap.
2. Calculate `next = player + dx + 20*dy`. Reject wall/void/bounds violations.
3. If a box is there, validate `beyond = next + dx + 20*dy`. A wall, void or box
   means reject the **entire** move. No box or counter has changed yet.
4. For a valid push, move exactly that box and increment pushes.
5. Record the new player position and direction/push flag in History.
6. Move the player and increment moves. Return true.

This validate-before-mutate ordering means a failed push cannot leave a half
updated model. Interactive blocked commands do not consume history capacity.
A solved board has every box on goal terrain. Navigation is a controller choice:
completion doesn't destroy the board or skip a level before the player sees it.

**Trace:** `#@ $. #` contains player at x=1 and box at x=3. Right once is a walk;
right again pushes onto x=4 goal. Moves=2, pushes=1. Undo once restores the box
to x=3 and player to x=2; terrain x=4 remains goal.

## 4. Undo without board snapshots

An entry stores the **post-move** player position and one small action:

```
0 left   1 up   2 right   3 down
add 4 if a box was pushed
```

Undo reads that entry, derives its direction vector and moves the keeper one
step backwards. For a push it also moves the box from one step ahead back into
the keeper's former position. Decrement moves and, when applicable, pushes.
The exact code makes the inverse relationship visible rather than hiding it
in a large copied snapshot.

`writeIndex` is the next free ring slot. Push writes there, increments with
explicit wrap at 512 and caps count at 512. Pop decrements with wrap to 511 and
then exposes that entry. Full-buffer writes evict the oldest entry. Thus after
600 moves and 512 undos, the remaining move count is 88, not zero. Restart,
load and import clear history because prior commands belong to another timeline.
There is no redo.

## 5. Rendering efficiently on Hack

Hack screen RAM is 16384..24575, 8192 words. Each word holds 16 horizontal
pixels; **bit 0 is the leftmost pixel**, and 1 means black.

```
address = 16384 + pixelY*32 + pixelX/16
```

The board origin is word-aligned:

```
originX = floor((22-width)/2)*16
originY = (16-height)*8
```

The left region is 22 words = 352 pixels wide. A full-height level starts at
y=0; shorter puzzles are vertically centered. Each 16×16 tile consumes 16
consecutive scanline writes, stepping the address by 32 each time. Seven mask
styles represent exterior, wall, floor, goal, crate, stored crate and keeper.
The keeper-on-goal is composed by adding corner dots. Negative decimal Jack
numbers represent masks with the high bit set; no nonstandard bit shifts or
unsigned integer extension is needed.

`full` blackens the left region, paints all active tiles and draws panel text.
`changed` repaints the old/new keeper cells and their cardinal neighbours. Both
sets matter: undoing a push leaves a former box destination beyond the **old**
keeper. Repainting only around the new keeper leaves a ghost crate. Regression
tests compare these pixels to a fresh complete repaint.

The OS font uses 8×11 character cells. Panel text starts at column 45 (x=360),
stays within column 62, and uses rows 0..22. UI helpers dispose temporary String
literals; Jack does not garbage-collect them. Text status updates are separate
from board-cell updates. The screenshot helper reads actual VRAM, not a mocked
reconstruction of the intended scene.

## 6. Input and modal screens

Hack exposes one current-key register, not a queue or simultaneous-key set.
The loop detects a nonzero key different from the prior poll, normalizes letter
case, and routes it to `command`. Holding a key does not repeat. `Sys.wait(5)`
limits polling work but is not a wall-clock promise; emulator speed varies.

Export/import temporarily replace the game view. `readReleased` drains the
opening key, waits for one key and drains its release. The editor has fixed
capacity (119), validates hex characters as typed, supports erase and commits
only on Return. Rendering returns to the board after the modal operation.
No text-mode editor is mistaken for an asynchronous input queue.

## 7. Portable save format, version 1

Numbers are hexadecimal, most significant digit first:

| Offset | Digits | Field |
|---|---:|---|
| 0 | 1 | Version `1` |
| 1 | 2 | Level 01..32 hexadecimal (=1..50 decimal) |
| 3 | 4 | Moves 0000..7FFF |
| 7 | 4 | Pushes 0000..moves |
| 11 | 3 | Keeper index 000..13F |
| 14 | 3 each | Box indices, strictly increasing |
| final 3 | 3 | Checksum |

Total length is `17+3*boxCount`, at most 119 (34 crates). The encoder uses a
160-character buffer for headroom; only actual content is output. Checksum is
`sum(hexDigitValue + characterIndex) modulo 4093`, over every preceding digit.
Digit values, not ASCII codes, make uppercase and lowercase equivalent.
Intermediate sums are bounded so Jack signed arithmetic cannot overflow.

`decode` checks length, characters, version, signed-counter range and checksum
before allocating a candidate Board. It loads the claimed level's immutable
terrain; then verifies exact expected box count, unique sorted positions,
walkable terrain, no player/box overlap and pushes<=moves. Only then does
`copy` replace the live state. On rejection the old game is unchanged and the
candidate is freed. Undo history isn't serialized. This is transactional input
validation, **not cryptographic integrity or a solvability check**.

RAM save owns an encoded String rather than retaining model pointers. Mutating
the current board cannot silently mutate its saved state. Export is a manual
cross-session persistence mechanism because portable Jack has no file API.

## 8. Campaign generation and reproducibility

The original level text is bundled unchanged. `generate_levels.py` validates
symbols, a single keeper, matching crate/goal counts and 19×16 size limits.
Flood fill starts in a padded outside border and travels through spaces only;
reachable spaces become `-` void. Interior spaces remain floor. This preserves
coordinates and keeps the outer black area from becoming a walkable warehouse.
Generated Jack uses five ten-level functions and disposes row Strings through
`Board.row`. `--check` compares the entire generated source, not just a count.

VM files are build artifacts but intentionally included for immediate play.
`build.py --check` verifies exact source/VM parity without writing. The source
also compiles with the independent nand2tetris-py compiler, demonstrating that
it does not rely on the companion compiler's extensions.

## 9. Memory and test strategy

Persistent game arrays use 320+320+512+512+112 = 1776 words, plus small objects
and an optional save string. A decode temporarily owns another Board/History
(~1664 array words), a modest fit in the normal Jack heap. Moving and undoing
allocate no new objects. Row literals, UI literals and modal strings are freed.

Headless tests compile source and run the same VM/OS used to play. Drivers put
results in reserved test RAM around 8000, with a completion sentinel at 8100;
the test then compares actual values. Merely reaching halt is not evidence
that a move was right. Generated programs and compiler outputs are isolated by
pytest. Graphics tests compare all 22 left-hand words of every scanline after
push/undo with a complete repaint. This catches stale-pixel bugs that state-only
tests cannot detect. Tests do not constitute an interactive usability assessment
or a proof that every supplied puzzle is solvable.

## 10. Classroom exercises

1. Trace a walk, push and undo with both arrays and History slots on paper.
2. Why can't a single terrain enum that overwrites goals safely support undo?
3. Change the ring capacity to 16; add a test exercising eviction and wrap.
4. Decode an exported code by hand. Corrupt a crate coordinate, recompute the
   checksum, and explain why semantic validation must still reject it.
5. Draw a new 16-row wall mask; explain signed integers and bit order.
6. Add redo without copying whole boards. When must redo history be invalidated?
7. Add a simple non-goal corner deadlock warning, keeping it separate from rules.
8. If a host filesystem extension is available, wrap it in a new adapter rather
   than putting disk I/O inside Board. What should happen on partial reads?
