# Implementation Plan

1. Build a deterministic Frogger engine with wrap tunnels, looping traffic/support lanes, scoring, pause, reset, and the required browser hooks.
2. Drive both manual play and autoplay from that single engine so tests, self-check output, and Playwright captures all agree.
3. Ship a cabinet-style UI, capture GIFs plus JSON proof artifacts, then publish through the required `main` + `codex/*` GitHub flow before updating automation records.
