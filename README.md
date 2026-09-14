# HANON / SIX

Six-lane Hanon rhythm practice, built with HTML, CSS, JavaScript, Three.js and Web Audio. The middle four lanes are flat and the two outside lanes rise outward. No sky input is implemented.

Middle-lane notes are blue. Track inclination (10–35 degrees) and outer-lane elevation (0–50 degrees) are independently adjustable. Defaults are 75 BPM and 30 world units/second, with scroll speed adjustable up to 100. Existing saved preferences are retained; Restore Defaults applies the new defaults.

## Run

`npm install` then `npm run dev`. Open the local URL printed by Vite.

## Timing

- A note step lasts `60000 / BPM * 4 / subdivision` milliseconds.
- Each selected exercise plays its ascending unit N times, then its descending unit N times, then moves to the next entry. Entries may repeat and can be reordered.
- Scroll speed is measured in world units per second; perspective produces apparent acceleration without changing note timing.
- Signed error is `input time - input offset - note time`. A press earlier than the negative final boundary is ignored. Both boundaries are inclusive. An unhit note past the positive final boundary automatically becomes MISS.
- Inner interval boundaries belong to the better (left) interval. Each interval name is editable; the infinite tail has no editable name.
- Score per hit is `max(0, 1 - absolute error / final boundary)`; an exact hit scores 1. Total score is normalized to 1,000,000. Accuracy uses resolved notes while playing and all notes at results.

## Music

Music is generated and scheduled independently of player input. It uses a short additive piano-like voice, not a piano sample library. Each ascending repetition transposes up one C-major scale degree by default; the first descending repetition uses the final ascending height, then each repetition steps down. The next exercise resets to C. A fixed whole-tone transposition mode is also available. Very high frequencies above 18 kHz are omitted. Music, volume, and metronome are configurable. Escape pauses, with a short count-in on resume. Leaving the window also pauses.

Successful hits optionally play the matched note one octave lower (MIDI minus 12), including its repetition transposition. Early ignored presses, empty presses and automatic misses do not play this sound. Background music and hit sounds have separate persisted toggles, both enabled by default. `node tests/settings-browser.mjs` checks actual oscillator frequencies and independent mute behavior, plus slope controls and note colors.

## Checks

`npm test` runs timing, chord, order and transposition tests. With the development server running, `node tests/browser.mjs` runs Playwright checks for settings, persistence, real keyboard input, inclusive boundaries, misses, pause, restart, results, automatic music scheduling and responsive rendering. Screenshots are saved in `output/qa/`. The copied skill runner is `web_game_playwright_client.mjs`.

Hanon units are loaded from `hanon_units.json`, retaining the previously reviewed 18 exercises. Digits 1-6 identify lanes; parenthesized digits represent simultaneous notes. Source: [Mutopia Hanon Part I](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2037).
