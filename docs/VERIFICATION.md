# Verification record — bundled Sokoban and local-file loading

Verified locally on **16 October 2026** with embedded Jack OS and bundled Sokoban
preloaded at startup (paused). The original verification was local. Publication
checks were rerun on 16 October 2026: 20 runtime/contrast tests and 29 Chromium
browser tests passed. GitHub publication and deployment status can be checked in
the repository's Actions tab: https://github.com/kpillai2017/jackvm-web/actions .

## Results

- `npm test`: **20 passed**. Compiles and exercises the real WASM CPU,
  including merged multi-class static isolation, built-in OS linking, and
  complete missing-call lists.
- `PLAYWRIGHT_BROWSERS_PATH=0 npm run test:browser`: **31 passed**,
  using Chromium. This command rebuilds the application with embedded OS and
  bundled Sokoban first.
- The project and dist include Sokoban bundled (seven VM files, GPL2-licensed,
  source in corresponding-source/sokoban); no other games, examples/ folders or
  downloadable `.vm` game assets.
- The embedded Jack OS (`web/builtin-os.js`) and Sokoban are generated and checked
  in; no sibling repositories are needed for normal builds or deployment.
- No obsolete game import tool, private-build script, manifests or alternate
  picker modes remain. The local static server serves the refreshed application.
- Folder test fixtures used a workspace-local `tmp_rovo_` prefix and were removed
  in `finally` blocks. No temporary program files were retained.

The environment used Node.js 26.11.1; CI is configured for Node.js 22.
`PLAYWRIGHT_BROWSERS_PATH=0` selects the already installed workspace-local test
browser and is unnecessary for a normal default Playwright installation.

## Coverage

Runtime tests cover signed arithmetic, segments, scoped statics and labels,
nested/recursive calls and frame restoration, clock/key/screen RAM, reset,
halt/error, parser diagnostics and memory/stack safety faults. Inputs are inline
synthetic strings, not copied game or OS files. Built-in OS linking tests verify
that user-supplied functions win and missing standard library functions are
filled automatically.

Browser tests cover:

1. Loading a directory containing game `.vm` files, with built-in OS automatically linked.
2. Drawing through WASM, pause/step/reset, and user class override precedence.
3. End-to-end browser events through WASM keyboard RAM and screen output for
   every Hack special key (128..152), all four arrows in Left/Up/Right/Down
   order, uppercase-normalized letters, digits, punctuation, Space, overlapping
   held keys and blur clearing. This detects code swaps rather than only testing
   the adapter in isolation.
4. Linking game files with built-in OS, detecting truly unresolved functions.
5. Real directory selection with nested VM files, ignoring non-VM files and
   rejecting duplicate basenames.
6. Feedback for selections containing no VM files.
7. No manifest/game requests or VM-content uploads during local loading.
8. Default hidden source, wide game display, right-side playback/memory/docs,
   Show source / Hide source resizing without resetting or pausing the VM,
   unchanged canvas resolution and narrow-screen layout without overflow.
   No document scrolling at 1440×900, 1366×768, 1280×720, 1024×600,
   1920×1080 and 390×844, with source both hidden and shown and a populated
   RAM inspector. Canvas preserves 2:1 proportions; long content scrolls locally.
9. Application output includes `web/builtin-os.js`, correct WASM MIME type
   and malformed URL handling. No sibling OS repositories required.

## Theme checks

WCAG relative-luminance tests cover defined normal-text pairs at 4.5:1 and
active input boundaries/focus rings at 3:1, including hover and disabled labels.
Browser checks verify applied slate surfaces, readable disabled styling, visible
keyboard focus and explicit error/success messages with semantic colors. These
checks are targeted safeguards, not a complete accessibility certification.

## Limits

Sokoban is bundled and preloaded at startup (paused); the portable automated suite
does not require additional legacy games. The built-in OS is automatically supplied.
Standard Jack OS functions (Sys, Memory, Math, Screen, Output, Keyboard, Array,
String, Clock, Timer, Console, Input, IntStack, IntQueue, Random) are embedded and
linked transparently. Users may additionally load custom game programs via the file
picker. Local Chromium checks verified Sokoban startup, drawing, keyboard input and
basic gameplay without runtime faults. These checks verify bundled Sokoban and
startup, not complete gameplay of all possible programs. Passing checks do not prove
every possible VM program or game path is correct. No Safari, Firefox, mobile browser,
complete accessibility audit, long-session heap stress or live GitHub Pages
deployment was tested. Standard VM syntax and the four documented host hooks are
supported; arbitrary VM-language extensions are not implied. Sokoban GPL2 license
and source provenance are documented in SOKOBAN_LICENSE.txt and SOKOBAN_PROVENANCE.md.
