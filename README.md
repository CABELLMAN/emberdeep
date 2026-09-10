# Emberdeep

A self-contained, single-player, turn-based dungeon crawler with a persistent town and fellowship. Prepare in Hearthglen, explore three seeded procedural floors, defeat the Ash Warden, and return with treasure to fund the next expedition.

## Play

Open `index.html` in a modern browser. No installation, account, or network connection is needed. Alternatively, run `python -m http.server 4173 --bind 127.0.0.1` or `npm start`, then visit `http://127.0.0.1:4173`.

- Move with WASD, arrow keys, revealed-floor clicks, or the optional directional pad.
- Step onto a shrine or stairwell and press Space or its action button.
- In combat, select a hero (1–3), choose an ability, and click an enemy. Every living hero acts once, then enemies resolve their displayed intentions.
- Bulwark protects the entire party; Hunter’s Mark boosts the next two hits; Ember Wave hits every enemy. Specials recharge after one full round.
- Healing draughts restore 18 HP to a living hero. They cost an action in combat. Shrines can revive fallen heroes. Descending restores 12 HP and grants temporary resolve (+5 max HP and +1 attack per floor), which expires on returning to town.
- Progress saves in the current browser when local storage is available. Gold, treasure, gear, heroes, and training persist across expeditions. Original v1 saves migrate automatically, including unfinished battles. Only **New campaign** resets progress, after confirmation.

## Hearthglen

- **The Lantern Inn:** heals and revives everyone on return for free. Recruit Bryn, Rowan, or Ione into reserves. Select one of the three active heroes, then assign a reserve to that slot. Benched heroes retain their equipment and training.
- **Treasure & supplies:** sell individual treasure stacks or all treasure. Buy healing draughts for 20 gold. The inn ensures at least two unsellable draughts on return so an empty purse cannot prevent another expedition.
- **The forge:** choose an active hero and purchase a weapon or armor. Gear equips immediately; upgrades replace earlier gear without stacking bonuses or refunding the previous item. Armor reduces incoming damage before Bulwark.
- **Training grounds:** spend shared XP and gold to permanently level an active hero, up to level 10. Each level adds 5 max HP and 1 attack. Training from level N costs 40N XP and 30N gold.
- **Expedition board:** choose difficulty and an optional seed, then depart. Difficulty stays fixed for all three floors. The same seed reproduces the same layout on any difficulty.

| Difficulty | Enemy HP | Enemy damage | Gold / XP |
| --- | ---: | ---: | ---: |
| Wayfarer | 80% | 70% | 80% |
| Adventurer | 100% | 100% | 100% |
| Veteran | 140% | 130% | 150% |
| Nightmare | 190% | 165% | 220% |

Treasure quantities use the reward multiplier, rounded to whole items with a minimum of one. Area attacks also scale with difficulty. Armor and Bulwark reduce the base damage shown in enemy intentions.

After victory or defeat, choose **Return to Hearthglen**. While exploring, **Return to town** offers a confirmed retreat that abandons the current dungeon. All recovered spoils, equipment, recruits, and permanent levels survive. Town services are unavailable during combat.

## Development

Vanilla HTML, CSS, Canvas 2D, and JavaScript. There are no dependencies to install.

`npm test` runs the engine tests using Node’s built-in test runner. `npm run build` validates JavaScript syntax and copies public files into `dist/`. `npm start` serves the game on loopback port 4173.

- `campaign.js`: town services, hero roster, gear stats, training, difficulty, and legacy save migration.
- `engine.js`: deterministic generation, visibility, movement, combat, expedition progression, and save validation.
- `town-ui.js`: town services and expedition board.
- `game.js`: interface, canvas, keyboard and pointer controls, optional sound, automatic saving.
- `styles.css`: responsive presentation and reduced-motion support.
- `tests/`: generation and combat regressions, campaign transactions, migration fixtures from the original engine, and interface event tests using a minimal document adapter. Interface tests do not replace browser layout/playtesting.

Exploration uses a shared party token; battles use an encounter view. Campaign storage is local to the browser and origin. Optional WebMCP tools expose the same expedition and town actions where supported; validation in a browser with WebMCP remains pending.

## Art

`assets/emberdeep.png` was created with the built-in image-generation tool. Prompt: cinematic painterly dark-fantasy landscape of three adventurers with an amber torch in a vast ruined subterranean gothic vault; charcoal and teal shadows, copper light, carved arches and mist; exact ivory serif title “EMBERDEEP” and subtitle “A TURN-BASED DUNGEON EXPEDITION”.
