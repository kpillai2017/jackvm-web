# Matching source for the bundled Sokoban

This directory contains the seven Jack classes used by `games/sokoban/*.vm`,
the original 50 level data files, generation/build tools, study notes and
GPL-2.0 license/attribution. The VM files are in `../../games/sokoban/` so the
runtime game folder contains only executable VM files.

The source and VM files were copied from the same local
`jackos/games/sokoban` teaching edition on 16 October 2026. Preserve the license
and attribution when redistributing this game. The root player MIT license does
not relicense it. Historical puzzle provenance limitations remain documented
in ATTRIBUTION.md.

## Rebuild

The source uses standard Jack and the standard Jack OS interfaces. Compile all
seven `.jack` files with a compatible Jack compiler, then place its generated
`.vm` files in `../../games/sokoban/` and run `npm run build` at the project root.
The player provides its embedded OS separately; the OS is not part of these
seven game classes.

The supplied `tools/build.py` locates the companion Python compiler checkout
named `jack-compiler` in ancestor folders, or via `JACK_COMPILER_ROOT`. Run
`python3 tools/build.py` to generate VM files next to the Jack sources, then
copy those files to the game's VM directory. Its `--check` flag compares files
next to the source; first copy the bundled VM files there if checking parity.
The compiler is an external build dependency and is not vendored here:
https://github.com/kpillai2017/jack-compiler . Install its requirements following
its own documentation.

`tools/generate_levels.py` regenerates Levels.jack from the retained files in
`levels/original/`. No level download is required. The browser application's
normal npm build uses the checked-in VM files and does not require Python,
a Jack compiler, or sibling repositories.
