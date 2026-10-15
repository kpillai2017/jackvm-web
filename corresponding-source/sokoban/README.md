# Sokoban in Jack

A teaching-oriented, monochrome Sokoban for the 512×256 Hack screen. Includes
**all 50 puzzles** in pySokoban's `original` set, adapted from the **Default**
theme only. Standard Jack, seven logical classes, generated VM alongside source;
no compiler, emulator or OS modifications are needed.

![Monochrome game screen](docs/screenshot.png)

## Run

From the **JackOS repository root**:

```sh
python3 tools/run_demo.py sokoban
```

The repository launcher automatically discovers this game, uses the checked-in
VM files and loads **this repository's JackOS**. Player flags pass through:

```sh
python3 tools/run_demo.py sokoban --headless --ticks 500000
```

For standalone use outside JackOS, the game-local helper remains available:

```sh
python3 games/sokoban/tools/build.py --run
```

Or, using an installed companion VM:

```sh
python3 -m jackvm /absolute/path/to/sokoban
```

The build helper first finds nearby `.companions/jack-compiler` and
`.companions/jackvm-py` checkouts, then sibling checkouts in ancestor folders.
The standalone helper uses the VM's bundled OS; prefer `tools/run_demo.py`
inside JackOS to use this repository's OS. Set `JACK_COMPILER_ROOT` and `JACKVM_ROOT` to their checkout paths if
stored elsewhere. Python requirements are those of the companion projects
(`pip install -e /path/to/jack-compiler -e /path/to/jackvm-py`). A graphical VM
needs its pygame dependencies and a display. Generated `.vm` files can also be
loaded into the nand2tetris VM emulator with its standard Jack OS enabled.

This **entire directory** is self-contained game content, not a nested Git
repository. JackOS discovers it automatically for launching and bytecode builds.
The default repository test suite includes its behavioral tests and integration
checks. Nothing has been committed or pushed as part of this integration.

## Controls (also shown in the right-hand panel)

| Key | Action |
|---|---|
| Arrow keys | Move / push one box |
| W / A / D / J | Up / left / right / down alternatives |
| U | Undo, up to the most recent 512 successful moves |
| R | Restart this level |
| N / B | Next / previous level, even if not solved |
| S / L | Save / restore one in-session slot |
| E | Export the current position as a portable save code |
| I | Import a portable save code |
| Q / Esc | Quit |

Letters are case-insensitive. **Release before repeating a key**; there is no
held-key autorepeat. `S` is save, not down: use the down arrow or `J`.

Push, never pull. Walls and other crates block pushes. Put every crate on a
storage diamond to solve the puzzle. Storage crates have an inverted interior;
the keeper has corner markers when standing on storage. Completion shows
`SOLVED! N: next`; moving on is deliberate, not automatic. No deadlock detector
is included: undo or restart if a crate is trapped. Counters count successful
steps/pushes, not blocked attempts; the 32,767-step limit prevents signed overflow.

## Saving and restoring

- **S/L** is a single RAM save slot. It survives restarts and level changes in
  this running Game, but **not closing or resetting the VM**. Saving replaces it.
- **E** displays a versioned hexadecimal code for the *current* position. Copy
  the digits (or take a screenshot). Lines are display wrapping, not separators.
- **I** opens a bounded input editor. Type the joined code; spaces are ignored,
  Backspace edits, Return restores, Esc cancels. The editor accepts at most 119
  digits. Host paste is supported only if your VM translates pasted text into
  individual keyboard events; typing works without any host extensions.
- A code contains level, keeper, boxes, counters and checksum. Invalid data is
  rejected without changing the board. Import and RAM restore **clear undo**.
  Import does not overwrite the RAM slot. Export does not implicitly save to it.
- Jack has no portable filesystem API: there is **no automatic disk save**.
  Keeping/re-entering a code is the cross-session persistence mechanism.

A checksum detects many transcription errors, not every possible error and not
malicious changes. Codes are structurally validated, not proven reachable by a
legal sequence of moves. Version 1 refers to this exact campaign's numbering.

## Build and verify

```sh
python3 tools/build_os.py                       # rebuild OS and every game
python3 tools/build_os.py --check               # repository source/VM parity
python3 games/sokoban/tools/generate_levels.py --check
python3 -m pytest -q                            # includes Sokoban's 73 tests
python3 -m pytest tests/test_sokoban_integration.py games/sokoban/tests -q
python3 games/sokoban/tools/capture.py           # standalone VM screenshot (Pillow)
# Game-only rebuild: python3 games/sokoban/tools/build.py
# Regenerate level source: python3 games/sokoban/tools/generate_levels.py
```

Tests compile fresh sources, execute the actual VM and assert explicit RAM values.
They cover all 50 puzzle dimensions/occupants, pushes, goals, blocking, undo-ring
wrap, save roundtrips, rechecksummed invalid state, controller save/load, and
incremental-versus-full pixel rendering. Both the companion compiler and the
independent `nand2tetris-py` compiler accept all source files as standard Jack.
Tests require pytest plus the companion compiler/VM. Pillow is needed only for
the screenshot helper, not to build or play.

## Source map

| Component | Responsibility |
|---|---|
| `Main.jack` | OS entry point and top-level object lifetime |
| `Game.jack` | Keyboard commands, level navigation, modal code editor, ownership |
| `Board.jack` | Terrain, occupants, validated atomic moves, counters, inverse moves |
| `History.jack` | Bounded command ring; last-in-first-out undo |
| `Levels.jack` | Generated immutable campaign data, grouped into ten-level loaders |
| `Draw.jack` | Word-aligned bitmaps, changed-cell painting, right-hand panel |
| `SaveCodec.jack` | Versioned serialization and validate-before-commit restoration |

Start with **[STUDY.md](STUDY.md)** for invariants, call flows, diagrams, memory,
serialization layout and classroom exercises. See **[ATTRIBUTION.md](ATTRIBUTION.md)**
and **[LICENSE](LICENSE)** before redistribution.

## Fidelity and deliberate adaptations

The reference's Default theme has metal walls, wooden X-braced crates, a human
keeper and storage marks. This version redraws those ideas in 16×16 monochrome
masks; it does not simply threshold or embed the coloured PNGs. It is an
interpretation, not a pixel-identical port. All puzzles fit at one scale (largest
19×16); the left board area is 352 pixels wide, the right 160 pixels hold the
instructions. Exterior space is black; warehouse floor is pale and lightly
textured. No other themes or puzzle sets are bundled.

Compared with pySokoban, this adds counters, bounded undo, explicit level
navigation, RAM saves and portable codes. There is no mouse menu, colour,
audio, file browser, redo, solver, deadlock warning, or persisted progress list.
