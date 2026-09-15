# In Falsus 哈农

Six-lane Hanon rhythm practice, built with HTML, CSS, JavaScript, Three.js and Web Audio. The middle four lanes are flat and the two outside lanes rise outward. No sky input is implemented.

Middle-lane notes are blue. Track inclination (0–90 degrees) and outer-lane elevation (0–50 degrees) are independently adjustable. At 0 degrees, surfaces flatten to a horizontal edge-on view; at 90 degrees the camera is overhead, with horizontal framing compensation to keep six lanes readable. Defaults are 75 BPM, displayed speed 4.00, inclination 10 degrees and outer elevation 30 degrees. Each slider has its own Default button. Speed is displayed as internal world units/second divided by 10.5: 4.00 equals the measured 42 units/second. Slider and numeric input adjust by 0.01 over 0.38–9.52. Saved internal speeds are preserved until adjusted.

Distance fog is disabled. Notes enter at the visible far boundary. Judgement-line position is adjustable from -4 (nearer) to +4 (farther), default 0; far-edge distance is 20–120 world units, default 58. Moving the judgement line does not move the camera. Receptors, labels, hit effects and note positions use the same line coordinate. The opening count-in extends when necessary so the first note also enters from the far edge. Subsequent rhythm intervals remain unchanged.

## Run

`npm install` then `npm run dev`. Open the local URL printed by Vite.

## Timing

- A note step lasts `60000 / BPM * 4 / subdivision` milliseconds.
- Each selected exercise plays its ascending unit N times, then its descending unit N times, then moves to the next entry. Entries may repeat and can be reordered.
- Scroll speed remains stored in world units per second; only the displayed value is divided by 10.5. Perspective produces apparent acceleration without changing note timing.
- Signed error is `input time - input offset - note time`. With optional early protection disabled, presses earlier than the negative final boundary are ignored. Both hit-window boundaries are inclusive. Unhit notes past the positive final boundary automatically become MISS.
- Enable Early Protection to add a draggable special point x outside the final boundary M. Errors `< -x` are ignored; `[-x, -M)` consumes the note as MISS; `[-M, +M]` uses named hit tiers. Unhit notes past `+M` automatically miss regardless of x. Early misses break combo and play no hit audio. Increasing M moves x outward if necessary. Disable the toggle to remove early-MISS behavior.
- The final miss-tier name is editable and used for both early and late misses, timing hints, effects and results. Default judgement settings are EXACT+ through 25 ms, EXACT through 50 ms, NEAR through 100 ms, BREAK beyond 100 ms, with early protection at 120 ms. Inner endpoints remain inclusive in the better tier.
- Judgement-only reset restores tier names, boundaries, colors, early protection and zero input offset, while retaining chart/audio/track preferences. Tier count includes the final miss tier: 4 uses bright purple / purple / teal / red; 3 uses purple / teal / red; 2 uses purple / red. Above 4, random colors are inserted between purple and teal and persisted across reloads.
- Score per hit is `max(0, 1 - absolute error / final boundary)`; an exact hit scores 1. Total score is normalized to 1,000,000. Accuracy uses resolved notes while playing and all notes at results.

## Music

Music is generated and scheduled independently of player input. It uses a short additive piano-like voice, not a piano sample library. Each ascending repetition transposes up one C-major scale degree by default; the first descending repetition uses the final ascending height, then each repetition steps down. The next exercise resets to C. A fixed whole-tone transposition mode is also available. Very high frequencies above 18 kHz are omitted. Music, volume, and metronome are configurable. Escape pauses, with a short count-in on resume. Leaving the window also pauses.

Successful hits optionally play the matched note one octave lower (MIDI minus 12), including its repetition transposition. Early ignored presses, empty presses and automatic misses do not play this sound. Background music and hit sounds have separate persisted toggles, both enabled by default. `node tests/settings-browser.mjs` checks actual oscillator frequencies and independent mute behavior, plus slope controls and note colors.

Background and hit audio also have independent 0–100% levels, multiplied by master volume. Their defaults are 100% with the existing 30% master level; the 100% audio level now has twice its previous gain. Turning either sound off disables and greys its slider, displays 0%, and instantly mutes its audio bus. Turning it back on restores the saved level. The metronome follows master volume and retains its previous gain.

## Checks

`npm test` runs timing, chord, order and transposition tests. With the development server running, `node tests/browser.mjs` runs Playwright checks for settings, persistence, real keyboard input, inclusive boundaries, misses, pause, restart, results, automatic music scheduling and responsive rendering. Screenshots are saved in `output/qa/`. The copied skill runner is `web_game_playwright_client.mjs`.

`node tests/protection-browser.mjs` checks calibrated speed, 0.01 edits, independent defaults, old settings, draggable early protection, persistence, early/late boundaries and early-MISS silence.

`node tests/judgement-browser.mjs` checks editable miss labels in effects/results, default reset isolation, palettes for 2–6 total tiers, random color persistence and responsive layout. Earlier workflow suites explicitly configure their legacy 140 ms windows as custom-window regression coverage.

`node tests/track-browser.mjs` checks exact spawn and hit-line coordinates, no fog, extreme distances and 0/90-degree views, independent audio envelope levels, zero-volume silence, persistence and desktop/mobile framing.

`node tests/panel-browser.mjs` checks fixed-height settings, its scrolling body and pinned reset/start controls, mute slider states, saved volume restoration and camera-stable judgement-line movement on desktop/mobile.

Hanon units are loaded from `hanon_units.json`, retaining the previously reviewed 18 exercises. Digits 1-6 identify lanes; parenthesized digits represent simultaneous notes. Source: [Mutopia Hanon Part I](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2037).
