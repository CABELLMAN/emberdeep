# Emberdeep

A self-contained, single-player, turn-based dungeon crawler with a persistent town and fellowship. Prepare in Hearthglen, explore three seeded procedural floors, defeat the Ash Warden, and return with treasure to fund the next expedition.

## Play

Open `index.html` in a modern browser. No installation, account, or network connection is needed. Alternatively, run `python -m http.server 4173 --bind 127.0.0.1` or `npm start`, then visit `http://127.0.0.1:4173`.

- Move with WASD, arrow keys, revealed-floor clicks, or the optional directional pad.
- Step onto a shrine or stairwell and press Space or its action button.
- In combat, select a hero (1–3), choose an ability, and click an enemy. Every living hero acts once, then enemies resolve their displayed intentions.
- Bulwark protects the entire party; Hunter’s Mark boosts the next two hits; Ember Wave hits every enemy. Specials recharge after one full round.
- Healing draughts restore 18 HP to a living hero. They cost an action in combat. Shrines can revive fallen heroes. Descending restores 12 HP and grants temporary resolve (+5 max HP and +1 attack per floor), which expires on returning to town.
- Progress saves in the current browser when local storage is available. Gold, treasure, gear, heroes, and training persist across expeditions. Older v1, v2, and v3 saves migrate automatically, including unfinished battles. Only **New campaign** resets progress, after confirmation.

## Hearthglen

- **The Lantern Inn:** heals and revives everyone on return for free. Recruit Bryn, Rowan, or Ione into reserves. Select one of the three active heroes, then assign a reserve to that slot. Benched heroes retain their equipment and training.
- **Treasure & supplies:** sell individual treasure stacks or all treasure. Buy healing draughts for 20 gold. The inn ensures at least two unsellable draughts on return so an empty purse cannot prevent another expedition.
- **Weapons:** buy and swap a selected hero’s weapons, inspect damage profiles, and set a legal grip. Replaced weapons stay owned by that hero.
- **Armor forge:** choose an active hero and purchase armor. Armor has independent location, layer, tier, weight, and class attributes. Purchases equip immediately in the matching location and layer. Replaced armor stays owned by that hero and can be equipped again for free in town.
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

## Weapons

| Melee type | Pierce | Cut | Blunt |
| --- | ---: | ---: | ---: |
| Spear | 70% | 10% | 20% |
| Axe | 10% | 70% | 20% |
| Mace / Hammer | 10% | 10% | 80% |
| Sword | One third | One third | One third |

Every melee type comes in **Small, Medium, and Large** sizes. Small weapons must use one hand; Large weapons require two; Medium weapons allow either grip and gain +2 attack in two hands. Choose the equipped weapon’s grip in town. Each hero equips one weapon at a time, with the UI showing hand occupancy. A free hand is currently unused; shields and dual wielding are not implemented.

Wardens use melee weapons. Rangers can equip **Crossbows, Shortbows, and Longbows**, which require two hands and deal Pierce damage. Arcanists can equip **Wands** (one hand) and **Staffs** (two hands), which deal Arcane damage. Class abilities stay with the hero. Hunter’s Mark uses the equipped ranged weapon’s damage profile, while Ember Wave deals Arcane damage.

The Weapons tab shows both the damage mix and actual damage amounts for the selected hero. The hero’s base attack, training, temporary resolve, weapon bonus, and grip bonus form one attack total. On a hit, a mark adds its bonus and enemy armor reduces the total once (minimum 1); that total is then distributed by type, rounded to whole numbers while keeping the sum exact. Swords remain balanced to within one point. The combat log shows each hit’s damage breakdown. Enemy armor currently reduces every damage type equally.

Purchases equip immediately using the weapon’s default legal grip (one hand for Medium melee weapons). Replaced weapons remain in that hero’s collection and can be re-equipped for free, including cheaper weapons and starting gear. Equipment and grips can only change in town and persist through reserve swaps and expeditions. Existing purchased weapons retain their names and bonuses; v3 saves migrate ownership and grips without changing stats, health, armor, or unfinished battles.

## Armor

| Attribute | Values |
| --- | --- |
| Location | Head, left arm, right arm, torso, left leg, right leg |
| Layer | Flexible (inner), Mail (middle), Plate (outer) |
| Tier | 1 Serviceable, 2 Sturdy, 3 Refined, 4 Masterwork, 5 Legendary |
| Weight | Light, Medium, Heavy |
| Class suitability | Warden, Ranger, Arcanist, All classes |

All five attributes are independent. Every combination is represented in the forge, including heavy Arcanist plate and light Warden mail. Tier is stored as a number; its flavor name is a display label. Layer specifies where the piece is worn, while weight describes its build. Weight influences bonuses and price without restricting the layer or class.

Each hero has **18 armor slots**: six locations with three layers apiece. A Flexible sleeve, Mail sleeve, and Plate vambrace can coexist on the same arm. Armor and HP bonuses from equipped pieces add together; armor reduces incoming damage before Bulwark. Combat currently uses this combined armor value for each hit. Locations determine equipment slots rather than separate hit-location damage.

Select any cell in the forge’s armor table to inspect its current piece, change any of the five attributes, and buy a matching piece. Class-specific armor fits its named class; All classes pieces fit anyone. An owned piece can replace another in the same slot regardless of tier or price. Unequipping keeps ownership. Each hero’s armor stays with them when they move into or out of reserves.

Both v1 and v2 saves migrate automatically. Older Trail Leathers, Warded Mail, and Emberguard Armor become torso pieces in their matching layers, retaining their original health/armor bonuses and names. Campaign progress and unfinished combat are preserved.

## Development

Vanilla HTML, CSS, Canvas 2D, and JavaScript. There are no dependencies to install.

`npm test` runs the engine tests using Node’s built-in test runner. `npm run build` validates JavaScript syntax and copies public files into `dist/`. `npm start` serves the game on loopback port 4173.

- `armor.js`: independent armor attributes, full combination catalog, body/layer slots, and loadout validation.
- `weapons.js`: melee, ranged, and magic catalogs, size/grip rules, damage profiles, and weapon loadout validation.
- `weapon-ui.js`: weapon shop, collection, damage previews, and hand controls.
- `campaign.js`: town services, hero roster, weapon/armor ownership and equipping, gear stats, training, difficulty, and legacy save migration.
- `engine.js`: deterministic generation, visibility, movement, combat, expedition progression, and save validation.
- `town-ui.js`: town services and expedition board.
- `game.js`: interface, canvas, keyboard and pointer controls, optional sound, automatic saving.
- `styles.css`: responsive presentation and reduced-motion support.
- `tests/`: generation and combat regressions, campaign transactions, migration fixtures from v1, v2, and v3 engines, and interface event tests using a minimal document adapter. Interface tests do not replace browser layout/playtesting.

Exploration uses a shared party token; battles use an encounter view. Campaign storage is local to the browser and origin. Optional WebMCP tools expose the same expedition and town actions where supported; validation in a browser with WebMCP remains pending.

## Art

`assets/emberdeep.png` was created with the built-in image-generation tool. Prompt: cinematic painterly dark-fantasy landscape of three adventurers with an amber torch in a vast ruined subterranean gothic vault; charcoal and teal shadows, copper light, carved arches and mist; exact ivory serif title “EMBERDEEP” and subtitle “A TURN-BASED DUNGEON EXPEDITION”.
