/* Interface unit tests with a minimal document adapter; not browser layout tests. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const E = require('../engine.js');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
function boot(initial, withTools = false) {
  const nodes = new Map(), classes = new Map(), saved = new Map();
  if (initial) saved.set('emberdeep.expedition.v1', JSON.stringify(initial));
  const paint = new Proxy({ createRadialGradient: () => ({ addColorStop() {} }) }, { get: (o, k) => o[k] || (() => {}) });
  function element(tag = 'div', attributes = {}) {
    return {
      tagName: tag.toUpperCase(), dataset: {}, attributes, listeners: {}, hidden: false, innerHTML: '', textContent: '',
      width: 1092, height: 756, classList: { toggle() {} },
      addEventListener(type, fn) { this.listeners[type] = fn; },
      setAttribute(key, value) { this.attributes[key] = value; },
      hasAttribute(key) { return Object.hasOwn(this.attributes, key); },
      getContext() { return paint; },
      prepend() {}, focus() {}, close() { this.open = false; }, showModal() { this.open = true; },
      closest(selector) {
        if (selector === 'button' && this.tagName === 'BUTTON') return this;
        const attr = selector.match(/^\[([^\]]+)\]$/)?.[1];
        return attr && this.hasAttribute(attr) ? this : null;
      },
      querySelector(selector) {
        const attr = selector.match(/\[([\w-]+)="([^"]+)"\]/);
        if (attr && this.innerHTML.includes(`${attr[1]}="${attr[2]}"`)) return element();
        return null;
      }
    };
  }
  for (const match of html.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)) {
    const attributes = Object.fromEntries([...match[2].matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
    const node = element(match[1], attributes); node.id = attributes.id;
    if (attributes.id) nodes.set(attributes.id, node);
    for (const name of (attributes.class || '').split(' ')) if (name && !classes.has(name)) classes.set(name, node);
  }
  const document = {
    getElementById: id => nodes.get(id) || null,
    createElement: element,
    querySelector: selector => selector === 'dialog[open]' ? [...nodes.values()].find(n => n.tagName === 'DIALOG' && n.open) || null : classes.get(selector.slice(1)) || null,
    querySelectorAll: selector => selector === 'dialog' ? [...nodes.values()].filter(n => n.tagName === 'DIALOG') : [],
    listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; }
  };
  const agentTools = new Map();
  if (withTools) document.modelContext = { registerTool(tool) { agentTools.set(tool.name, tool); } };
  const context = { document, console, setInterval, clearInterval, AbortController,
    localStorage: { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) }, addEventListener() {} };
  context.window = context; vm.createContext(context);
  for (const file of ['armor.js','weapons.js', 'formations.js','campaign.js', 'engine.js', 'weapon-ui.js','formation-ui.js','town-ui.js', 'game.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
  function fire(id, type = 'click', dataset = {}) {
    const target = element('button'); target.dataset = dataset;
    for (const [key, value] of Object.entries(dataset)) target.attributes['data-' + key.replace(/[A-Z]/g, c => '-' + c.toLowerCase())] = value;
    const handler = nodes.get(id)?.listeners[type]; assert(handler, `Missing ${type} handler for ${id}`);
    handler({ target, preventDefault() {} });
  }
  return { nodes, context, document, fire, agentTools, state: () => JSON.parse(saved.get('emberdeep.expedition.v1')) };
}
test('game boots into town with real document IDs and all service controls', () => {
  const ui = boot(); assert.equal(ui.state().phase, 'town');
  assert.equal(ui.nodes.get('floor-title').textContent, 'Hearthglen');
  assert.equal(ui.nodes.get('town').hidden, false);
  for (const tab of ['tavern', 'formation', 'merchant', 'weapons', 'forge', 'training']) {
    ui.fire('town', 'click', { townTab: tab });
    assert.match(ui.nodes.get('town').innerHTML, /id="depart-form"/);
    assert.match(ui.nodes.get('town').innerHTML, /name="difficulty"/);
  }
});

test('weapon controls buy each size, change legal grips, and switch owned weapons without paying twice', () => {
  const g = E.createGame(); g.gold = 3000;
  const ui = boot(g); ui.fire('town', 'click', { townTab: 'weapons' });
  for (const type of ['spear', 'axe', 'mace_hammer', 'sword']) for (const size of ['small', 'medium', 'large']) {
    assert.match(ui.nodes.get('town').innerHTML, new RegExp(`data-buy-gear="${type}_${size}"`));
  }
  assert.match(ui.nodes.get('town').innerHTML, /Pierce/); assert.match(ui.nodes.get('town').innerHTML, /Blunt/);
  ui.fire('town', 'click', { buyGear: 'spear_medium' });
  assert.equal(ui.state().party[0].attack, 11);
  ui.fire('town', 'click', { weaponGrip: '2' });
  assert.equal(ui.state().party[0].attack, 13); assert.equal(ui.state().party[0].weaponGrip, 2);
  assert.match(ui.nodes.get('town').innerHTML, /Same weapon/);
  ui.fire('town', 'click', { buyGear: 'axe_small' });
  const gold = ui.state().gold;
  assert.equal(ui.state().party[0].weaponGrip, 1);
  assert.match(ui.nodes.get('town').innerHTML, /data-weapon-grip="2" aria-pressed="false" disabled/);
  ui.fire('town', 'click', { weaponGrip: '2' }); assert.equal(ui.state().party[0].weaponGrip, 1);
  ui.fire('town', 'click', { ownedWeapon: 'spear_medium' });
  assert.equal(ui.state().gold, gold); assert.equal(ui.state().party[0].gear.weapon, 'spear_medium');
  ui.fire('town', 'click', { ownedWeapon: 'starting' });
  assert.equal(ui.state().party[0].gear.weapon, null); assert.equal(ui.state().party[0].weapons.length, 2);
  assert(E.validateSave(ui.state()));
});

test('weapon filtering and hero selection expose every ranged and magic weapon with legal grips', () => {
  const g = E.createGame(); g.gold = 3000;
  const ui = boot(g); ui.fire('town', 'click', { townTab: 'weapons' });
  ui.nodes.get('town').listeners.change({ target: { dataset: { weaponFilter: 'type' }, value: 'spear' } });
  assert.match(ui.nodes.get('town').innerHTML, /data-buy-gear="spear_large"/);
  assert.doesNotMatch(ui.nodes.get('town').innerHTML, /data-buy-gear="axe_large"/);
  ui.fire('party', 'click', { hero: '1' });
  for (const type of ['crossbow', 'shortbow', 'longbow']) assert.match(ui.nodes.get('town').innerHTML, new RegExp(`data-buy-gear="${type}"`));
  ui.fire('town', 'click', { buyGear: 'crossbow' }); assert.equal(ui.state().party[1].weaponGrip, 2);
  assert.match(ui.nodes.get('town').innerHTML, /data-weapon-grip="1" aria-pressed="false" disabled/);
  ui.fire('party', 'click', { hero: '2' });
  for (const type of ['wand', 'staff']) assert.match(ui.nodes.get('town').innerHTML, new RegExp(`data-buy-gear="${type}"`));
  ui.fire('town', 'click', { buyGear: 'staff' }); assert.equal(ui.state().party[2].weaponGrip, 2);
  ui.fire('town', 'click', { buyGear: 'wand' }); assert.equal(ui.state().party[2].weaponGrip, 1);
  assert.match(ui.nodes.get('town').innerHTML, /Arcane/); assert(E.validateSave(ui.state()));
});

test('combat buttons reflect the equipped weapon, grip, and damage profile after reloading a save', () => {
  const g = E.createGame(); g.gold = 3000;
  E.buyEquipment(g, 0, 'mace_hammer_medium'); E.setWeaponGrip(g, 0, 2);
  E.depart(g, { difficulty: 'normal', seed: 'ui-weapon-combat' });
  const foe = g.map.entities.find(e => e.type === 'enemy');
  const [dx, dy] = E.DIRS.find(([dx, dy]) => g.map.tiles[foe.y - dy]?.[foe.x - dx] === 1);
  g.pos = { x: foe.x - dx, y: foe.y - dy }; E.move(g, dx, dy);
  const ui = boot(g);
  assert.match(ui.nodes.get('actions').innerHTML, /Crushing Blow/);
  assert.match(ui.nodes.get('actions').innerHTML, /2 hands/);
  assert.match(ui.nodes.get('actions').innerHTML, /11 Blunt/);
  ui.fire('encounter', 'click', { enemy: '0' });
  assert(ui.state().log.some(l => l.type === 'damage' && l.text.includes('Blunt')));
  assert(E.validateSave(ui.state()));
});
test('town controls buy gear, recruit, swap, sell, and train the selected hero', () => {
  const g = E.createGame(); g.gold = 2000; g.xp = 300; g.treasures.silver = 2;
  const ui = boot(g);
  ui.fire('town', 'click', { buyGear: 'steel_blade' }); assert.equal(ui.state().party[0].attack, 11);
  ui.fire('town', 'click', { recruit: 'bryn' }); assert.equal(ui.state().reserves[0].uid, 'bryn');
  ui.fire('town', 'click', { swap: 'bryn' }); assert.equal(ui.state().party[0].name, 'Bryn');
  ui.fire('town', 'click', { train: '0' }); assert.equal(ui.state().party[0].level, 2);
  assert.match(ui.nodes.get('party').innerHTML, /LVL 2/);
  assert.match(ui.nodes.get('party').innerHTML, /LVL 1/);
  ui.fire('town', 'click', { sell: 'all' }); assert.equal(ui.state().treasures.silver, 0);
  assert(E.validateSave(ui.state()));
});
test('departure and confirmed retreat preserve the campaign through interface events', () => {
  const ui = boot(); ui.context.EmberTown.setDifficulty('veteran'); ui.context.EmberTown.setSeed('ui-seed');
  ui.nodes.get('town').listeners.submit({ target: { id: 'depart-form' }, preventDefault() {} });
  assert.equal(ui.state().phase, 'explore'); assert.equal(ui.state().difficulty, 'veteran'); assert.equal(ui.state().seed, 'ui-seed');
  assert.equal(ui.nodes.get('town').hidden, true);
  ui.fire('town-btn'); assert.equal(ui.nodes.get('retreat-dialog').open, true);
  ui.fire('confirm-retreat'); assert.equal(ui.state().phase, 'town'); assert.equal(ui.state().gold, 100);
  assert.equal(ui.nodes.get('retreat-dialog').open, false);
});
test('legacy combat loads without resetting, and victory/defeat CTAs return to town', () => {
  const fixtures = require('./fixtures/v1-saves.json');
  const combat = boot(fixtures.combat); assert.equal(combat.state().phase, 'combat');
  assert.equal(combat.state().version, 5); assert.equal(combat.nodes.get('town-btn').disabled, true);
  for (const source of [fixtures.won, fixtures.lost]) {
    const ui = boot(source); assert.equal(ui.state().phase, source.phase);
    assert.match(ui.nodes.get('ending').innerHTML, /data-return-town/);
    ui.fire('ending', 'click', { returnTown: '' }); assert.equal(ui.state().phase, 'town');
    assert(E.validateSave(ui.state()));
  }
});
test('movement shortcuts do not consume turns while editing town forms', () => {
  const ui = boot(); const before = JSON.stringify(ui.state());
  for (const tagName of ['INPUT', 'SELECT', 'TEXTAREA']) ui.document.listeners.keydown({ target: { tagName }, key: '1', preventDefault() {} });
  assert.equal(JSON.stringify(ui.state()), before);
});
test('forge exposes five independent armor controls and equips heavy Arcanist plate', () => {
  const g = E.createGame(); g.gold = 10000;
  const ui = boot(g); ui.fire('party', 'click', { hero: '2' }); ui.fire('town', 'click', { townTab: 'forge' });
  function choose(attribute, value) {
    ui.nodes.get('town').listeners.change({ target: { dataset: { armorFilter: attribute }, value } });
  }
  for (const [key, value] of Object.entries({ location: 'left_arm', layer: 'plate', tier: '4', weight: 'heavy', class: 'arcanist' })) choose(key, value);
  const markup = ui.nodes.get('town').innerHTML;
  for (const key of ['location', 'layer', 'tier', 'weight', 'class']) assert.match(markup, new RegExp(`data-armor-filter="${key}"`));
  assert.equal((markup.match(/data-armor-location=/g) || []).length, 18);
  assert.match(markup, /Masterwork/); assert.match(markup, /Heavy/); assert.match(markup, /Arcanist/);
  const id = E.armorItemId({ location: 'left_arm', layer: 'plate', tier: 4, weight: 'heavy', class: 'arcanist' });
  assert.match(markup, new RegExp(`data-buy-gear="${id}"`));
  ui.fire('town', 'click', { buyGear: id });
  assert.equal(ui.state().party[2].gear.armor.left_arm.plate, id);
  ui.fire('town', 'click', { unequipLocation: 'left_arm', unequipLayer: 'plate' });
  assert.equal(ui.state().party[2].gear.armor.left_arm.plate, null);
  ui.fire('town', 'click', { ownedEquip: id });
  assert.equal(ui.state().party[2].gear.armor.left_arm.plate, id);
  assert(E.validateSave(ui.state()));
  ui.fire('town', 'click', { armorLocation: 'left_arm', armorLayer: 'plate' });
  assert.match(ui.nodes.get('town').innerHTML, /value="heavy" selected/);
  assert.match(ui.nodes.get('town').innerHTML, /value="4" selected/);
});
test('v2 purchased armor loads into the correct torso layer and appears in the forge', () => {
  const source = require('./fixtures/v2-saves.json').town;
  const ui = boot(source); ui.fire('town', 'click', { townTab: 'forge' });
  assert.equal(ui.state().version, 5); assert.equal(ui.state().party[0].gear.armor.torso.mail, 'mail');
  assert.match(ui.nodes.get('town').innerHTML, /Warded Mail/);
  ui.fire('town', 'click', { armorLocation: 'torso', armorLayer: 'mail' });
  assert.match(ui.nodes.get('town').innerHTML, /data-owned-equip="mail"/);
  assert.match(ui.nodes.get('town').innerHTML, /value="all" selected/);
});
test('formation and inn controls fill eight positions, swap, bench, and preserve selection', () => {
  const g = E.createGame(); g.gold = 10000;
  const ui = boot(g);
  for (const id of Object.keys(E.RECRUITS)) {
    ui.fire('town', 'click', { recruit: id });
    if (ui.state().party.length < 8) ui.fire('town', 'click', { addParty: id });
  }
  assert.equal(ui.state().party.length, 8); assert.equal(ui.state().reserves.length, 1);
  assert.match(ui.nodes.get('town').innerHTML, /Party full/);
  ui.fire('town', 'click', { townTab: 'formation' });
  const board = ui.nodes.get('town').innerHTML;
  assert.equal((board.match(/data-formation-position=/g) || []).length, 8);
  for (const slot of Object.keys(E.FORMATION_SLOTS)) assert.match(board, new RegExp(`data-formation-position="${slot}"`));
  ui.fire('party', 'click', { hero: '7' });
  const last = ui.state().party[7].uid, first = ui.state().party[0].uid;
  ui.fire('town', 'click', { formationPosition: 'front_left' });
  assert.equal(ui.state().formation.front_left, last); assert.equal(ui.state().formation.flank_right, first);
  ui.fire('town', 'click', { bench: '7' });
  assert.equal(ui.state().party.length, 7); assert.equal(ui.state().formation.front_left, null);
  assert.doesNotMatch(ui.nodes.get('town').innerHTML, /undefined/);
  ui.fire('town', 'click', { addParty: last }); assert.equal(ui.state().party.length, 8);
  assert.equal(ui.state().formation.front_left, last); assert(E.validateSave(ui.state()));
});

test('keyboard shortcuts safely select hero eight, and combat formation selects allies and healing targets', () => {
  const small = boot();
  small.document.listeners.keydown({ key: '8', target: { tagName: 'DIV' }, preventDefault() {} });
  assert.equal(small.state().party.length, 3);
  const g = E.createGame(); g.gold = 10000;
  for (const id of Object.keys(E.RECRUITS).slice(0, 5)) { E.recruit(g, id); E.addToParty(g, id); }
  E.depart(g, { difficulty: 'normal', seed: 'formation-ui-battle' });
  const foe = g.map.entities.find(e => e.type === 'enemy');
  const [dx, dy] = E.DIRS.find(([dx, dy]) => g.map.tiles[foe.y - dy]?.[foe.x - dx] === 1);
  g.pos = { x: foe.x - dx, y: foe.y - dy }; E.move(g, dx, dy);
  g.party[7].hp -= 20;
  const ui = boot(g);
  assert.equal((ui.nodes.get('encounter').innerHTML.match(/data-formation-hero=/g) || []).length, 8);
  ui.document.listeners.keydown({ key: '8', target: { tagName: 'DIV' }, preventDefault() {} });
  assert.match(ui.nodes.get('actions').innerHTML, new RegExp(g.party[7].name));
  ui.fire('encounter', 'click', { formationHero: '0' });
  assert.match(ui.nodes.get('actions').innerHTML, /Aldric/);
  ui.fire('actions', 'click', { action: 'potion' });
  ui.fire('encounter', 'click', { formationHero: '7' });
  assert.equal(ui.state().party[7].hp, g.party[7].hp + 18);
  assert.equal(ui.state().party[0].acted, true); assert(E.validateSave(ui.state()));
});

test('formation UI shows the second-line damage penalty and old saves load all three heroes into the front line', () => {
  const g = E.migrateSave(require('./fixtures/v4-saves.json').weaponsCombat);
  g.party.forEach(h => h.acted = false); g.party[0].gear.weapon = null; g.party[0].weaponGrip = 1; E.sync(g.party[0]);
  g.formation.rear_left = g.formation.front_left; g.formation.front_left = null;
  const ui = boot(g); assert.match(ui.nodes.get('actions').innerHTML, /second line −2/);
  const old = boot(require('./fixtures/v4-saves.json').weapons);
  assert.equal(old.state().party.length, 3); assert.equal(old.state().version, 5);
  assert.equal(Object.values(old.state().formation).filter(Boolean).length, 3);
  old.fire('town', 'click', { townTab: 'formation' }); assert.match(old.nodes.get('town').innerHTML, /3 \/ 8 ACTIVE/);
});

test('optional agent actions expose eight-person limits, roster expansion, formation moves, and hero eight healing', () => {
  const g = E.createGame(); g.gold = 10000;
  const ui = boot(g, true), town = ui.agentTools.get('use_town_service'), action = ui.agentTools.get('take_hero_action');
  assert.equal(action.inputSchema.properties.hero.maximum, 7);
  assert.equal(action.inputSchema.properties.target.maximum, 7);
  for (const id of Object.keys(E.RECRUITS).slice(0, 5)) {
    town.execute({ service: 'recruit', item: id }); town.execute({ service: 'add_party', item: id });
  }
  town.execute({ service: 'formation', hero: 7, position: 'front_left' });
  assert.equal(ui.state().formation.front_left, ui.state().party[7].uid);
  assert.equal(ui.agentTools.get('read_town_catalog').execute({}).maxParty, 8);
  assert.equal(ui.agentTools.get('read_expedition').execute().maxParty, 8);
  assert(E.validateSave(ui.state()));
  // Load a damaged eight-person expedition, then exercise the same public action surface.
  const battle = ui.state(); E.depart(battle, { difficulty: 'normal', seed: 'tools-eight' }); battle.party[7].hp -= 20;
  const resumed = boot(battle, true);
  resumed.agentTools.get('take_hero_action').execute({ hero: 7, action: 'potion', target: 7 });
  assert.equal(resumed.state().party[7].hp, battle.party[7].hp + 18);
  assert.throws(() => resumed.agentTools.get('take_hero_action').execute({ hero: 8, action: 'potion', target: 7 }));
  assert(E.validateSave(resumed.state()));
});
