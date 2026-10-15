# Jack VM Web — a WebAssembly teaching machine

A modular browser-only interpreter for standard nand2tetris Jack VM code. The
CPU is **AssemblyScript compiled to WebAssembly**; JavaScript handles parsing,
linking, local file selection, scheduling, keyboard input and the canvas.
A **built-in Jack OS is automatically embedded** via `web/builtin-os.js`; you select
your game folder and press Run. No games, game folders, or sibling VM repositories
are needed. The embedded OS provides standard Jack libraries (Memory, Math, Screen,
Output, Keyboard and others); user programs win where they supply their own classes.

## How to run the WASM browser program

### Open the GitHub Pages site

Open **https://kpillai2017.github.io/jackvm-web/** after the GitHub Pages
workflow succeeds. Source repository: https://github.com/kpillai2017/jackvm-web .
The GitHub file-view page is not the application: use the Pages website URL.
Visitors need only a modern WebAssembly-capable browser—no Node.js, terminal,
plugin, Jack compiler, or local server.

1. Click **Choose** next to **VM files or a folder of VMs**, then select
   **VM files** or **Folder of VMs** in the dialog. The browser opens the matching
   local picker. Folder selection includes VM files in subdirectories; non-VM
   files are ignored. Native “No file chosen” fields are hidden; selected program
   filenames appear in the application’s file list instead.
2. Wait for **Loaded**. The built-in Jack OS classes are automatically linked if
   your game does not provide its own versions (e.g., if your game has its own
   Memory.vm, that wins; otherwise the built-in is used).
3. Click **Run**, then click the display if necessary to focus keyboard input.
4. Optional: expand **extra classes or custom OS overrides**, then use its
   **Choose** button to add VM files or a folder. These merge with the selected
   program rather than replacing it. Custom OS functions take precedence.
5. Use **Pause**, **Step**, **Reset**, the speed slider and RAM inspector in the
   **right sidebar**. The game screen fills the main workspace by default.
6. Click **Show source** above the game to open the VM source panel and shrink
   the game into a split view. **Hide source** restores the large game view.
   Changing views does not reset or pause execution. On narrow screens the
   panels stack vertically rather than squeeze into unreadable columns.

The player fits the browser viewport without page scrolling. The game scales
within the available width **and height**, keeping its 2:1 aspect ratio. Long
source, RAM dumps, file lists and optional controls scroll inside their panels
instead of expanding the page. Resize the window to adjust the game size.

Selecting a new program through the file/folder picker replaces the selection.
Duplicate VM basenames are rejected: choose one program, not a parent folder
containing several games with conflicting `Main.vm`, `Board.vm`, etc. A failed
load leaves any previous valid program paused and usable.

**Built-in Jack OS is automatically supplied.** The embedded OS provides Sys, Memory,
Math, Screen, Output, Keyboard, Array, String, Clock, Timer, Console, Input,
IntStack, IntQueue and Random classes. If your program provides its own version
of any of these (e.g., a custom Math.vm), your version takes precedence; missing
functions are filled from the built-in library. A simple OS-free VM script can
still run by itself without triggering any OS code. The optional Clock and Sys
host hooks are documented in [Architecture](docs/ARCHITECTURE.md).

Files are read using the browser's File API; **their content is not uploaded**.
The site cannot browse arbitrary disk locations: only explicitly selected files
are available. Reloading the page clears the selection. Loading files locally
does not copy them into the repository or published site.

### Build and run locally

Prerequisites: **Node.js 22 or later** (with npm), a terminal and a modern
WebAssembly-capable browser. Chromium is used by the automated tests; Firefox
and Safari have not been verified. Initial dependency installation needs network
access; the built application has no CDN dependency.

From this workspace:

```sh
cd jackvm-web
npm ci
npm run build
npm run serve
```

For a standalone clone of this repository, start in its root and omit
`cd jackvm-web`. Open **http://127.0.0.1:3000**, then choose local files as above.
Keep the terminal open; **Ctrl+C** stops the server. Rebuild and refresh after
source changes: the server does not rebuild automatically.

The build compiles `assembly/index.ts` to `web/runtime.wasm`, then packages
application assets into `dist/`. The static server serves `dist/`, not the source
root. **Do not double-click index.html or use file://**: JavaScript modules and
the WASM module must be delivered over HTTP locally or HTTPS on GitHub Pages.
The local VM sources themselves are read from selected File objects, not HTTP.

### Try a minimal program

Save this text as `Main.vm` on your drive, click **Choose → VM files** to select it,
then press **Step** twice. Inspect RAM address **5**: it should contain **42**.
This inline example needs no OS files and is not a bundled game asset.

```vm
push constant 42
pop temp 0
```

### Troubleshooting

- **npm not found:** install Node.js 22 or later and reopen the terminal.
- **Connection refused:** run `npm run serve` and leave the terminal open.
- **Port busy:** stop the previous server or use `PORT=3001 npm run serve` on
  macOS/Linux; PowerShell: `$env:PORT=3001; npm run serve`. Open the matching URL.
- **WASM 404:** run `npm run build`, serve dist, and refresh the browser.
- **Unresolved function / Run stays disabled:** the selection is incomplete or
  uses an unrecognized OS class name. The built-in OS includes the standard
  nand2tetris library. If your program references a non-standard class (e.g., a
  custom helper), select a folder containing that class's `.vm` file alongside
  your game files.
- **Merged VM file loads but produces wrong graphics:** merged class files,
  including `JackOS.vm`, now isolate statics by function class prefix. Rebuild
  and refresh the page if you are running an older build.
- **Duplicate filename:** select one program and exactly one copy of each class.
- **Keys do nothing:** click the screen; it must have keyboard focus.
- **No VM files selected:** choose `.vm` files or a folder containing them;
  `.jack` source and other file types are not interpreted.

## Deploy to GitHub Pages

Put this project's contents at the root of a repository under `kpillai2017`.
In **Settings → Pages**, set **Source → GitHub Actions**. The supplied
`.github/workflows/pages.yml` builds, tests and deploys on pushes to `main` or
manual dispatch. Wait for a successful deployment, then open the URL shown by
GitHub. Relative asset URLs support project sites under `/<repository>/`.

The deployed output contains only the application, WASM, embedded built-in OS
bytecode, documentation and license. It has no games, examples folders, manifests
or downloadable `.vm` game assets. There are no private-game build modes or import
tools. The OS is part of the player and is linked automatically. No sibling repositories are needed. Users may select
their own game programs from the hosted site without uploading those programs to
GitHub. Respect the licenses of programs you load or distribute separately; see
[Attribution](docs/ATTRIBUTION.md).

## Visual design

The UI uses neutral dark-slate surfaces, one blue accent, green Run and amber
Pause actions. Labels remain readable in disabled states; links are underlined,
keyboard focus is clearly outlined, and errors always include explanatory text.
The black-and-white VM screen is unchanged. Semantic theme tokens live in
`theme.css`; layout remains in `styles.css`. Defined text pairs are tested at
4.5:1 contrast and active control/focus boundaries at 3:1. See
[Visual design](docs/DESIGN.md) for rationale and accessibility testing limits.

## Teaching controls and limitations

- Run / Pause / Step / Reset provide instruction-level control.
- Speed is the instruction budget per nominal 60Hz frame (default 40,000, matching the original web player). The small **Original**
  button restores that budget without resetting the game.
- The source pane follows the next instruction, and RAM shows signed/hex words.
- Hack arrow codes: **Left=130, Up=131, Right=132, Down=133**.
- Letters use uppercase ASCII regardless of Shift/Caps Lock (A=65..Z=90);
  digits, punctuation and Space retain ASCII. Enter=128, Backspace=129,
  Esc=140 and F1..F12=141..152. Newest held key wins; blur clears.
- Hidden tabs pause rather than accumulating unlimited execution debt.

Sys.wait runs as supplied VM bytecode; its duration depends on instruction
speed. Optional Clock.now uses browser monotonic milliseconds modulo 32768.
This is not a cycle-accurate Hack CPU or guaranteed real-time arcade emulator.
There is no audio, Jack compilation, save-state system or touch controller.

## Project map

| Path | Responsibility |
|---|---|
| `assembly/index.ts` | WASM CPU, RAM, call frames, arithmetic, safety faults |
| `web/parser.js` | Source validation, scoped labels, statics, function linking |
| `web/runtime.js` | Typed-array adapter to WASM exports |
| `web/app.js` | Local file selection, dependency merging, UI composition |
| `web/player.js` | Bounded browser-frame scheduling and input sampling |
| `web/display.js` | Hack screen RAM → 512×256 canvas |
| `web/keyboard.js` | Focus-aware keys → keyboard register |
| `tools/` | Application-only packaging and loopback static server |
| `tests/` | CPU tests and browser file/folder loading checks |

## Verification and further reading

```sh
npm test
npx playwright install chromium  # one-time browser setup
npm run test:browser
```

Tests use inline synthetic VM inputs, not bundled games or sibling repositories.
Browser folder fixtures are temporary workspace files removed after each test.
See [Verification](docs/VERIFICATION.md) for results and limits,
[Architecture](docs/ARCHITECTURE.md) for component design and the WASM ABI, and
[Study guide](docs/STUDY_GUIDE.md) for exercises. Original code is MIT licensed.
