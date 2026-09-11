const { test } = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const melee = ['spear', 'axe', 'mace_hammer', 'sword'];
function unchanged(g, operation) {
  const before = JSON.stringify(g); assert.equal(operation(), false); assert.equal(JSON.stringify(g), before);
}
function encounter(g) {
  assert(E.depart(g, { difficulty: 'normal', seed: 'weapon-battle' }));
  const foe = g.map.entities.find(e => e.type === 'enemy');
  const [dx, dy] = E.DIRS.find(([dx, dy]) => g.map.tiles[foe.y - dy]?.[foe.x - dx] === 1);
  g.pos = { x: foe.x - dx, y: foe.y - dy }; assert(E.move(g, dx, dy));
  return g.combat.enemies[0];
}
test('all four melee types can be bought in all three sizes with enforced hand rules', () => {
  for (const type of melee) for (const [size, hands] of [['small', [1]], ['medium', [1, 2]], ['large', [2]]]) {
    const g = E.createGame(); g.gold = 1000;
    const id = `${type}_${size}`, item = E.WEAPON_CATALOG[id];
    assert.equal(item.type, type); assert.equal(item.size, size); assert.deepEqual(item.hands, hands);
    assert(E.buyEquipment(g, 0, id)); assert.equal(g.party[0].weaponGrip, hands[0]);
    for (const grip of [1, 2]) {
      if (grip === g.party[0].weaponGrip || !hands.includes(grip)) unchanged(g, () => E.setWeaponGrip(g, 0, grip));
      else assert(E.setWeaponGrip(g, 0, grip));
    }
    assert(E.validateSave(g));
  }
});
test('melee damage emphasizes the intended type and swords are balanced at every attack value', () => {
  const expected = { spear: { pierce: 70, cut: 10, blunt: 20 }, axe: { pierce: 10, cut: 70, blunt: 20 },
    mace_hammer: { pierce: 10, cut: 10, blunt: 80 }, sword: { pierce: 34, cut: 33, blunt: 33 } };
  for (const type of melee) {
    assert.deepEqual(E.splitDamage(100, E.WEAPON_TYPES[type].damage), expected[type]);
    for (let total = 1; total <= 100; total++) {
      const parts = E.splitDamage(total, E.WEAPON_TYPES[type].damage), values = Object.values(parts);
      assert(values.every(n => Number.isInteger(n) && n >= 0)); assert.equal(values.reduce((a, b) => a + b), total);
      if (type === 'sword') assert(Math.max(...values) - Math.min(...values) <= 1);
    }
  }
});
test('medium two-hand bonus persists with training and reserve swaps, and switching never stacks it', () => {
  const g = E.createGame(); g.gold = 10000; g.xp = 100;
  assert(E.buyEquipment(g, 0, 'axe_medium')); const oneHand = g.party[0].attack;
  assert(E.setWeaponGrip(g, 0, 2)); assert.equal(g.party[0].attack, oneHand + 2);
  assert(E.train(g, 0)); assert.equal(g.party[0].attack, oneHand + 3);
  assert(E.recruit(g, 'bryn')); assert(E.swapParty(g, 0, 'bryn')); assert.equal(g.reserves[0].weaponGrip, 2);
  assert(E.validateSave(g)); assert(E.swapParty(g, 0, 'aldric'));
  assert(E.depart(g, { difficulty: 'normal' })); assert(E.returnToTown(g));
  assert.equal(g.party[0].attack, oneHand + 3); assert.equal(g.party[0].weaponGrip, 2);
  assert(E.setWeaponGrip(g, 0, 1)); assert.equal(g.party[0].attack, oneHand + 1);
  assert(E.setWeaponGrip(g, 0, 2)); assert.equal(g.party[0].attack, oneHand + 3);
  assert(E.validateSave(g));
});
test('weapons stay owned when replaced, can be swapped for free, and reject invalid transactions atomically', () => {
  const g = E.createGame(); g.gold = 2000;
  assert(E.buyEquipment(g, 0, 'sword_large')); assert(E.buyEquipment(g, 0, 'spear_small'));
  const gold = g.gold; assert(E.equipWeapon(g, 0, 'sword_large', 2)); assert.equal(g.gold, gold);
  assert.deepEqual(g.party[0].weapons, ['sword_large', 'spear_small']);
  for (const operation of [() => E.buyEquipment(g, 0, 'sword_large'), () => E.equipWeapon(g, 0, 'sword_large', 1),
    () => E.equipWeapon(g, 0, 'spear_small', 2), () => E.equipWeapon(g, 0, 'axe_small'),
    () => E.equipWeapon(g, 1, 'sword_large'), () => E.equipWeapon(g, -1, null),
    () => E.equipWeapon(g, 0, '__proto__'), () => E.setWeaponGrip(g, 0, '2'),
    () => E.buyEquipment(g, 1, 'axe_small'), () => E.setWeaponGrip(g, 0, 3)]) unchanged(g, operation);
  assert(E.equipWeapon(g, 0, null, 1)); assert.equal(g.party[0].attack, 8);
  assert.equal(g.party[0].weapons.length, 2); assert(E.validateSave(g));
  encounter(g);
  unchanged(g, () => E.equipWeapon(g, 0, 'spear_small'));
  unchanged(g, () => E.setWeaponGrip(g, 0, 2));
  unchanged(g, () => E.buyEquipment(g, 0, 'axe_small'));
});
test('crossbows, shortbows, longbows, wands, and staffs equip with their required hands and damage', () => {
  for (const type of ['crossbow', 'shortbow', 'longbow', 'wand', 'staff']) {
    const g = E.createGame(); g.gold = 1000; const hero = ['wand', 'staff'].includes(type) ? 2 : 1;
    assert(E.buyEquipment(g, hero, type)); const h = g.party[hero], expectedGrip = type === 'wand' ? 1 : 2;
    assert.equal(h.weaponGrip, expectedGrip);
    unchanged(g, () => E.setWeaponGrip(g, hero, expectedGrip === 1 ? 2 : 1));
    assert.deepEqual(E.weaponAttack(h).damage, { [hero === 2 ? 'arcane' : 'pierce']: h.attack });
    const enemy = encounter(g); const hp = enemy.hp;
    assert(E.act(g, hero, 'attack', 0)); assert.equal(hp - enemy.hp, Math.min(hp, Math.max(1, h.attack - enemy.armor)));
    assert(g.log.some(l => l.type === 'damage' && l.text.includes(hero === 2 ? 'Arcane' : 'Pierce')));
    assert(E.validateSave(g));
  }
});
test('actual melee hits distribute damage after one armor reduction and a mark bonus', () => {
  for (const type of melee) {
    const g = E.createGame(); g.gold = 1000; assert(E.buyEquipment(g, 0, `${type}_medium`));
    assert(E.setWeaponGrip(g, 0, 2)); const enemy = encounter(g);
    enemy.hp = enemy.maxHp = 100; enemy.armor = 2; enemy.marked = 2;
    assert(E.act(g, 0, 'attack', 0)); const damage = g.party[0].attack + 3 - 2;
    assert.equal(enemy.hp, 100 - damage); assert.equal(enemy.marked, 1);
    assert(g.log.some(l => l.text.includes(`${damage} damage (${E.damageText(E.splitDamage(damage, E.WEAPON_TYPES[type].damage))})`)));
    assert(E.validateSave(g));
  }
  const g = E.createGame(), e = encounter(g); e.armor = 100;
  const hp = e.hp; assert(E.act(g, 0, 'attack', 0)); assert.equal(e.hp, hp - 1);
  assert(g.log.some(l => l.text.includes('1 damage (1 Pierce · 0 Cut · 0 Blunt)')));
});
test('v4 saves reject illegal grips, unowned weapons, duplicate ownership, and inflated grip bonuses', () => {
  const g = E.createGame(); g.gold = 1000; assert(E.buyEquipment(g, 0, 'sword_large'));
  for (const corrupt of [s => s.party[0].weaponGrip = 1, s => s.party[0].weaponGrip = '2',
    s => s.party[0].weapons = [], s => s.party[0].weapons.push('sword_large'),
    s => s.party[0].weapons.push('wand'), s => s.party[0].weapons.push('__proto__'),
    s => s.party[0].gear.weapon = 'spear_small', s => s.party[0].attack += 2,
    s => delete s.party[0].weaponGrip, s => s.party[0].weapons = null]) {
    const bad = structuredClone(g); corrupt(bad); assert(!E.validateSave(bad));
  }
  assert(E.validateSave(E.migrateSave(g)));
});
test('v3 campaigns migrate every original weapon, active/reserve armor, and unfinished combat without losing state', () => {
  const fixtures = require('./fixtures/v3-saves.json');
  for (const [name, old] of Object.entries(fixtures)) {
    const before = JSON.stringify(old), g = E.migrateSave(old);
    assert(E.validateSave(g), name); assert.equal(g.version, 4); assert.equal(JSON.stringify(old), before);
    for (const field of ['map', 'combat', 'phase', 'floor', 'gold', 'xp', 'treasures', 'turn', 'potions']) assert.deepEqual(g[field], old[field]);
    for (const [i, h] of [...g.party, ...g.reserves].entries()) {
      const previous = [...old.party, ...old.reserves][i];
      for (const field of Object.keys(previous)) assert.deepEqual(h[field], previous[field], `${name}: ${field}`);
      assert.deepEqual(h.weapons, previous.gear.weapon ? [previous.gear.weapon] : []);
      assert.equal(h.weaponGrip, E.equippedWeapon(h).hands[0]);
    }
    assert.deepEqual(E.migrateSave(g), g);
  }
});
