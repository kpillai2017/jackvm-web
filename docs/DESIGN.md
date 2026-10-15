# Visual design: a focused developer-tool interface

The player uses a restrained dark-slate theme rather than a decorative purple
gradient. This keeps the high-contrast monochrome game prominent while giving
controls, source and RAM a consistent visual hierarchy. Dark is a deliberate
product choice, not a claim that dark themes are universally superior. The
layout and game pixel palette are independent of the application theme.

## Semantic roles

`theme.css` contains reusable tokens; `styles.css` controls layout and sizing.
Use role names rather than scattering new literal colors across components.

| Role | Token / color | Purpose |
|---|---|---|
| Page | bg / #0f172a | Quiet outer background |
| Panel | surface / #1e293b | Group related controls |
| Inset | surface-inset / #111c2e | Inputs, source and RAM |
| Text | text / #f1f5f9 | Primary readable content |
| Secondary | text-secondary / #cbd5e1 | Labels and data |
| Muted | text-muted / #94a3b8 | Supporting descriptions, not invisible text |
| Accent | accent / #7dd3fc | Links and interactive emphasis |
| Focus | focus / #38bdf8 | 3px keyboard-focus outline |
| Success | deep green + light green text | Run and loaded/running state |
| Warning | deep amber + light amber text | Pause action |
| Error | danger / #fda4af | Written failure/fault messages |

Neutral buttons are secondary actions; Show source uses the primary blue fill.
Run and Pause have stable semantic styling in hover states. Reset is neutral:
it is not styled as a destructive danger action. Links are underlined, not
identified only by color. Status uses color in addition to explicit text;
success, errors and paused/running state remain understandable without color.

## Form grouping and proportion

Related text and actions follow the proximity principle: each Choose button sits
12px beside its label, with vertical alignment and wrapping on narrow screens.
Avoid `justify-content: space-between` for these pairs, which forces users to
scan across a wide empty card. The selection form is left-aligned and capped at
42rem rather than stretched to match the game display. Short helper text is
shown once; feedback appears only after a selection or error. Optional overrides
use progressive disclosure. Button targets remain at least 36px high, above the
WCAG 2.2 minimum 24px target size, while visible keyboard focus is preserved.
These choices follow established proximity, readable line-length and clear
hierarchy principles; they are design decisions, not a claim of a complete UX
or accessibility audit.

## Contrast and interaction

Automated WCAG relative-luminance checks enforce **at least 4.5:1** for the
specified normal-text foreground/background pairs and **at least 3:1** for
active input boundaries and focus rings against adjacent surfaces. Hover fills
are included. Disabled elements retain explicit, readable colors rather than
reducing the opacity of entire controls. They still use native disabled state
and a not-allowed cursor; color alone does not enforce their behavior.

Visible focus rings support keyboard navigation; the file pickers remain
native browser controls. A forced-colors media query respects operating-system
high-contrast mode and preserves the canvas's emulated black-and-white pixels.
Browser tests check that theme tokens apply to actual controls and that error
and success feedback retain clear text and distinct colors.

These targeted checks are **not a complete WCAG conformance audit**. They do
not replace testing with assistive technology, high zoom, color-vision users,
multiple browsers, or all platform-specific native-control renderings.

## Avoid theme-related behavior changes

Changing appearance must not resize the VM framebuffer, alter input mappings,
affect execution, or make the page scroll. The viewport, keyboard, file-loading
and playback browser suites continue to run after theme changes. Long content
remains scrollable inside its own panel, and source stays hidden by default.
