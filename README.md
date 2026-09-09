# Emberdeep

A self-contained, single-player, turn-based dungeon crawler. Lead a Warden, Ranger, and Arcanist through three seeded procedural floors and defeat the Ash Warden to reclaim the Emberheart.

## Play

Open `index.html` in a modern browser. No installation, account, or network connection is needed. Alternatively, run `python -m http.server 4173 --bind 127.0.0.1` or `npm start`, then visit `http://127.0.0.1:4173`.

- Move with WASD, arrow keys, revealed-floor clicks, or the optional directional pad.
- Step onto a shrine or stairwell and press Space or its action button.
- In combat, select a hero (1–3), choose an ability, and click an enemy. Every living hero acts once, then enemies resolve their displayed intentions.
- Bulwark protects the entire party; Hunter’s Mark boosts the next two hits; Ember Wave hits every enemy. Specials recharge after one full round.
- Healing draughts restore 18 HP to a living hero. They cost an action in combat. Shrines can revive fallen heroes; descending also revives and levels the party.
- Progress saves in the current browser when local storage is available. A new expedition replaces the save. Seeds reproduce dungeon layouts.

## Development

Vanilla HTML, CSS, Canvas 2D, and JavaScript. There are no dependencies to install.

`npm test` runs the engine tests using Node’s built-in test runner. `npm run build` validates JavaScript syntax and copies public files into `dist/`. `npm start` serves the game on loopback port 4173.

- `engine.js`: deterministic generation, visibility, movement, combat, progression, save validation.
- `game.js`: interface, canvas, keyboard and pointer controls, optional sound, automatic saving.
- `styles.css`: responsive presentation and reduced-motion support.
- `tests/engine.test.cjs`: generation invariants, combat transitions, resource rules, victory/defeat, save integrity.

This first playable prototype uses a shared party token during exploration and an encounter view in combat. Gold is an expedition score; shops, equipment, character creation, and permanent progression are future expansion points.

## Art

`assets/emberdeep.png` was created with the built-in image-generation tool. Prompt: cinematic painterly dark-fantasy landscape of three adventurers with an amber torch in a vast ruined subterranean gothic vault; charcoal and teal shadows, copper light, carved arches and mist; exact ivory serif title “EMBERDEEP” and subtitle “A TURN-BASED DUNGEON EXPEDITION”.
