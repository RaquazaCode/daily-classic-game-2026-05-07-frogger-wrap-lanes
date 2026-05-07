# Design

## Core pitch

Build a one-screen Frogger MVP where the board behaves like a loop instead of a box. Cars, river supports, and player sidesteps wrap at the horizontal edges, so the twist is both a visual motif and a mechanical shortcut.

## System choices

- Deterministic grid simulation rather than free physics so the autoplay, tests, and `window.advanceTime(ms)` hook all share one authoritative rules engine.
- River supports and traffic advance on per-lane timers, which keeps the board readable while still producing enough motion for GIF capture.
- Homes persist until all four are filled, then the round restarts with slightly faster lane timing.

## Presentation

- Left rail: cabinet-style headline and concise control cues.
- Main stage: large board with high-contrast river, road, and safe grass bands.
- Lower panels: scoreboard, manual controls, event feed, and JSON proof readout for unattended verification.

## Verification strategy

- Node tests prove wrap scoring, home banking, pause, and reset.
- The autoplay solver uses bounded BFS over the same simulation state so browser proof does not drift from test proof.
- Playwright artifacts capture opening motion, the wrap shortcut, and pause/reset without relying on pointer-only flows.
