# Match logs

Recorded human games land here so Claude can analyze them.

**How to record & share a game:**

1. Play at https://xoanteis.github.io/peninsulae/ — every game records itself
   automatically (economy snapshots, the strategic timeline, your orders).
2. Save the log as a JSON file:
   - end screen → **📜 Save match log**, or
   - **F2** at any moment (works mid-game too), or
   - **Shift+F2** right after a reload to recover the previous match from its
     minute-by-minute backup (survives crashes and "Play again").
3. Get it to Claude either way:
   - on GitHub, open this folder → **Add file → Upload files**, then tell
     Claude a new log is here, or
   - paste the JSON straight into the session (logs are ~30–50 KB).

Claude reads logs only through `node tools/analyze-match.mjs <file>` — a
compact report with the timeline, your build order, per-nation curves, and
coaching flags — never the raw JSON.
