const { test } = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const attributes = (overrides = {}) => ({ location: 'torso', layer: 'plate', tier: 3, weight: 'heavy', class: 'arcanist', ...overrides });
const itemId = overrides => E.armorItemId(attributes(overrides));
function unchanged(g, fn) { const before = JSON.stringify(g); assert.equal(fn(), false); assert.equal(JSON.stringify(g), before); }
test('every location, layer, tier, weight, and class combination has an independent armor item', () => {
  const ids = new Set();
  for (const location of Object.keys(E.ARMOR_LOCATIONS)) for (const layer of Object.keys(E.ARMOR_LAYERS))
    for (let tier = 1; tier <= 5; tier++) for (const weight of Object.keys(E.ARMOR_WEIGHTS)) for (const cls of Object.keys(E.ARMOR_CLASSES)) {
      const selection = { location, layer, tier, weight, class: cls }, id = E.armorItemId(selection), item = E.EQUIPMENT[id];
      assert(id && item); ids.add(id); assert(E.validArmorAttributes(item));
      for (const key of Object.keys(selection)) assert.equal(item[key], selection[key]);
      assert(item.price > 0 && item.armor > 0 && item.hp > 0);
    }
  assert.equal(ids.size, 1080);
  assert.equal(Object.keys(E.ARMOR_TIERS).length, 5);
  assert.equal(new Set(Object.values(E.ARMOR_TIERS)).size, 5);
  assert.notEqual(E.armorItemId(attributes({ tier: 1 })), E.armorItemId(attributes({ tier: 5 })));
});
test('heavy mage plate and light warrior mail are valid purchases, independent of class stereotypes', () => {
  const g = E.createGame(); g.gold = 10000;
  assert(E.buyEquipment(g, 2, itemId()));
  const mage = g.party[2]; assert.equal(mage.gear.armor.torso.plate, itemId());
  assert.equal(mage.armor, E.EQUIPMENT[itemId()].armor);
  const warriorMail = itemId({ layer: 'mail', weight: 'light', class: 'warden' });
  assert(E.buyEquipment(g, 0, warriorMail));
  unchanged(g, () => E.buyEquipment(g, 1, itemId({ class: 'warden' })));
  assert(E.validateSave(g));
});
test('six locations support three layers each without aliasing or overwriting other slots', () => {
  const g = E.createGame(); g.gold = 100000;
  const h = g.party[0], beforeHp = h.maxHp; let armor = 0, hp = 0;
  for (const location of Object.keys(E.ARMOR_LOCATIONS)) for (const layer of Object.keys(E.ARMOR_LAYERS)) {
    const id = itemId({ location, layer, class: 'warden', tier: 1, weight: 'light' });
    assert(E.buyEquipment(g, 0, id)); assert.equal(h.gear.armor[location][layer], id);
    armor += E.EQUIPMENT[id].armor; hp += E.EQUIPMENT[id].hp;
  }
  assert.equal(E.equippedArmor(h).length, 18); assert.equal(h.armory.length, 18);
  assert.equal(h.armor, armor); assert.equal(h.maxHp, beforeHp + hp);
  assert.equal(E.equippedArmor(g.party[1]).length, 0);
  assert.notEqual(h.gear.armor.left_arm, h.gear.armor.right_arm);
  assert(E.validateSave(g));
});
test('changing one attribute preserves all other attributes and replaces only its target layer', () => {
  const g = E.createGame(); g.gold = 10000;
  const h = g.party[2], heavy = itemId(), light = itemId({ weight: 'light' }), inner = itemId({ layer: 'flexible' });
  assert(E.buyEquipment(g, 2, heavy)); assert(E.buyEquipment(g, 2, inner));
  assert(E.buyEquipment(g, 2, light));
  assert.equal(h.gear.armor.torso.plate, light); assert.equal(h.gear.armor.torso.flexible, inner);
  assert(h.armory.includes(heavy)); assert.equal(h.armory.length, 3);
  for (const key of ['location', 'layer', 'tier', 'class']) assert.equal(E.EQUIPMENT[heavy][key], E.EQUIPMENT[light][key]);
  assert.equal(h.armor, E.EQUIPMENT[light].armor + E.EQUIPMENT[inner].armor);
  const gold = g.gold; assert(E.equipArmor(g, 2, heavy)); assert.equal(g.gold, gold);
  assert.equal(h.armor, E.EQUIPMENT[heavy].armor + E.EQUIPMENT[inner].armor);
  unchanged(g, () => E.equipArmor(g, 2, heavy)); unchanged(g, () => E.buyEquipment(g, 2, heavy));
  assert(E.unequipArmor(g, 2, 'torso', 'plate')); assert(h.armory.includes(heavy));
  assert.equal(h.armor, E.EQUIPMENT[inner].armor); assert.equal(h.hp, h.maxHp);
  assert(E.equipArmor(g, 2, light)); assert(E.validateSave(g));
});
test('armor equipment and ownership survive reserve swaps and new expeditions', () => {
  const g = E.createGame(); g.gold = 10000;
  assert(E.buyEquipment(g, 2, itemId())); assert(E.recruit(g, 'ione'));
  assert(E.swapParty(g, 2, 'ione')); const sera = g.reserves.find(h => h.uid === 'sera');
  assert.equal(sera.gear.armor.torso.plate, itemId());
  assert(E.swapParty(g, 2, 'sera'));
  assert(E.depart(g, { difficulty: 'veteran', seed: 'armored-campaign' }));
  unchanged(g, () => E.unequipArmor(g, 2, 'torso', 'plate'));
  unchanged(g, () => E.buyEquipment(g, 2, itemId({ location: 'head' })));
  assert(E.returnToTown(g)); assert.equal(g.party[2].gear.armor.torso.plate, itemId());
  assert(E.validateSave(JSON.parse(JSON.stringify(g))));
});
test('invalid armor data, wrong location/layer, and unowned equipment are rejected', () => {
  const g = E.createGame(); g.gold = 10000; assert(E.buyEquipment(g, 2, itemId()));
  for (const bad of [{ tier: 0 }, { tier: 6 }, { tier: '3' }, { layer: 'heavy' }, { weight: 'plate' }, { location: 'arms' }, { class: '__proto__' }]) {
    assert.equal(E.armorItemId(attributes(bad)), null);
  }
  unchanged(g, () => E.equipArmor(g, 2, itemId({ location: 'head' })));
  unchanged(g, () => E.equipArmor(g, 2, 'steel_blade'));
  unchanged(g, () => E.unequipArmor(g, 2, '__proto__', 'plate'));
  for (const corrupt of [s => s.party[2].gear.armor.left_arm.plate = itemId(),
    s => s.party[2].gear.armor.torso.mail = itemId(), s => s.party[2].armory = [],
    s => s.party[2].armory.push(itemId()), s => s.party[2].gear.armor.torso.extra = null,
    s => s.party[2].gear.armor.extra = {}, s => delete s.party[2].gear.armor.head,
    s => s.party[2].armor += 100, s => s.party[0].armory.push(itemId())]) {
    const invalid = structuredClone(g); corrupt(invalid); assert(!E.validateSave(invalid));
  }
});
test('v2 armor saves migrate active and reserve heroes without losing bonuses, health, gold, or combat', () => {
  const fixtures = require('./fixtures/v2-saves.json');
  for (const old of Object.values(fixtures)) {
    const source = JSON.stringify(old), g = E.migrateSave(old);
    assert(g && E.validateSave(g), `Invalid migrated ${old.phase}`); assert.equal(g.version, 5);
    assert.equal(JSON.stringify(old), source);
    for (const key of ['phase', 'turn', 'gold', 'xp', 'floor', 'potions']) assert.equal(g[key], old[key]);
    assert.deepEqual(g.combat, old.combat);
    const heroes = [...g.party, ...g.reserves], previous = [...old.party, ...old.reserves];
    for (let i = 0; i < heroes.length; i++) {
      const h = heroes[i], oldHero = previous[i], oldId = oldHero.gear.armor;
      for (const key of ['uid', 'hp', 'maxHp', 'attack', 'armor', 'level', 'acted', 'cooldown']) assert.equal(h[key], oldHero[key]);
      assert.deepEqual(h.armory, oldId ? [oldId] : []);
      if (oldId) assert.equal(h.gear.armor.torso[E.EQUIPMENT[oldId].layer], oldId);
    }
    assert.deepEqual(E.migrateSave(g), g);
  }
});
