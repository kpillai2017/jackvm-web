# Attribution and redistribution

## Reference implementation

This teaching adaptation was developed with the supplied **pySokoban** checkout:
https://github.com/kazantzakis/pySokoban . Its source identifies the author as
**Kazantzakis Nikos**; that repository includes the GNU General Public License,
version 2. A verbatim copy of that license is included as `LICENSE`.

The Jack implementation, supporting tools and documentation in this directory
are provided under GPL-2.0, consistent with distributing this adaptation and its
reference-derived level data. Preserve attribution, license and corresponding
source when distributing generated VM files; this is not legal advice.

## Puzzle data

`levels/original/level1` through `level50` are verbatim copies of the corresponding
files in the supplied checkout. `Levels.jack` is their generated encoding with
exterior spaces classified as void. Other puzzle sets are not included.

pySokoban's README attributes Sokoban's creation to **Hiroyuki Imabayashi (1982)**
and describes this 50-puzzle 'original' set as the one used by Spectrum HoloByte's
1988 **Soko-Ban**, following Thinking Rabbit's earlier releases. These are the
reference's historical attributions, not a new independent provenance audit.
No authorship of the historical puzzles is claimed. The upstream project's
license statement is not proof that it holds all rights to every historical
puzzle; review third-party puzzle rights before wider redistribution.

## Graphics

Only the Default theme was used as a visual reference: riveted metal walls,
wooden cross-braced crates, storage markers and a human warehouse keeper.
`Draw.jack` contains newly constructed monochrome masks, not copied PNG bytes.
No Default PNG files, screenshots from the reference, or other theme assets are
bundled. `docs/screenshot.png` is captured from this Jack program's real VRAM.

## Runtime

This folder does not vendor the compiler, VM, or Jack OS. They are companion
projects with their own notices. Generated `.vm` files here contain only this
game's classes; a runtime must supply the standard nand2tetris OS.
