/* Interface unit tests with a minimal document adapter; not browser layout tests. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const E = require('../engine.js');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
function boot(initial) {
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
  const context = { document, console, setInterval, clearInterval, AbortController,
    localStorage: { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) }, addEventListener() {} };
  context.window = context; vm.createContext(context);
  for (const file of ['armor.js', 'campaign.js', 'engine.js', 'town-ui.js', 'game.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
  function fire(id, type = 'click', dataset = {}) {
    const target = element('button'); target.dataset = dataset;
    for (const [key, value] of Object.entries(dataset)) target.attributes['data-' + key.replace(/[A-Z]/g, c => '-' + c.toLowerCase())] = value;
    const handler = nodes.get(id)?.listeners[type]; assert(handler, `Missing ${type} handler for ${id}`);
    handler({ target, preventDefault() {} });
  }
  return { nodes, context, document, fire, state: () => JSON.parse(saved.get('emberdeep.expedition.v1')) };
}
test('game boots into town with real document IDs and all service controls', () => {
  const ui = boot(); assert.equal(ui.state().phase, 'town');
  assert.equal(ui.nodes.get('floor-title').textContent, 'Hearthglen');
  assert.equal(ui.nodes.get('town').hidden, false);
  for (const tab of ['tavern', 'merchant', 'forge', 'training']) {
    ui.fire('town', 'click', { townTab: tab });
    assert.match(ui.nodes.get('town').innerHTML, /id="depart-form"/);
    assert.match(ui.nodes.get('town').innerHTML, /name="difficulty"/);
  }
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
  assert.equal(combat.state().version, 3); assert.equal(combat.nodes.get('town-btn').disabled, true);
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
  assert.equal(ui.state().version, 3); assert.equal(ui.state().party[0].gear.armor.torso.mail, 'mail');
  assert.match(ui.nodes.get('town').innerHTML, /Warded Mail/);
  ui.fire('town', 'click', { armorLocation: 'torso', armorLayer: 'mail' });
  assert.match(ui.nodes.get('town').innerHTML, /data-owned-equip="mail"/);
  assert.match(ui.nodes.get('town').innerHTML, /value="all" selected/);
});
