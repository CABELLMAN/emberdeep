const { test } = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
function expedition(difficulty = 'normal', seed = 'campaign-test') {
  const g = E.createGame(seed);
  assert(E.depart(g, { difficulty, seed }));
  return g;
}
function encounter(g, boss = false) {
  const e = g.map.entities.find(e => e.type === (boss ? 'boss' : 'enemy'));
  for (const [dx, dy] of E.DIRS) if (g.map.tiles[e.y - dy]?.[e.x - dx] === 1) {
    g.pos = { x: e.x - dx, y: e.y - dy }; assert(E.move(g, dx, dy)); return;
  }
  throw Error('Unreachable encounter');
}
function rejectedWithoutChanges(g, operation) {
  const before = JSON.stringify(g); assert.equal(operation(), false); assert.equal(JSON.stringify(g), before);
}
test('new campaign starts in town and departure preserves campaign resources', () => {
  const g = E.createGame();
  assert.equal(g.phase, 'town'); assert.equal(g.gold, 100); assert(E.validateSave(g));
  g.xp = 50; assert(E.train(g, 0)); const hero = structuredClone(g.party[0]);
  assert(E.depart(g, { difficulty: 'veteran', seed: 'fixed-layout' }));
  assert.equal(g.phase, 'explore'); assert.equal(g.seed, 'fixed-layout'); assert.equal(g.gold, 70);
  assert.equal(g.xp, 10); assert.deepEqual(g.party[0], hero); assert(E.validateSave(g));
  rejectedWithoutChanges(g, () => E.depart(g, { difficulty: 'story' }));
});
test('treasure sales consume exactly one stack or all treasure and cannot be repeated', () => {
  const g = E.createGame(); g.treasures.silver = 2; g.treasures.idol = 1;
  assert.equal(E.treasureValue(g), 120); assert(E.sellTreasure(g, 'silver'));
  assert.equal(g.gold, 150); assert.equal(g.treasures.silver, 0); assert.equal(g.treasures.idol, 1);
  rejectedWithoutChanges(g, () => E.sellTreasure(g, 'silver'));
  assert(E.sellTreasure(g)); assert.equal(g.gold, 220); assert.equal(E.treasureValue(g), 0);
  rejectedWithoutChanges(g, () => E.sellTreasure(g));
  rejectedWithoutChanges(g, () => E.sellTreasure(g, '__proto__'));
});
test('purchased weapons and armor equip once and affect combat damage', () => {
  const g = E.createGame(); g.gold = 1000;
  assert(E.buyEquipment(g, 0, 'steel_blade')); assert.equal(g.party[0].attack, 11);
  rejectedWithoutChanges(g, () => E.buyEquipment(g, 0, 'steel_blade'));
  rejectedWithoutChanges(g, () => E.buyEquipment(g, 1, 'steel_blade'));
  assert(E.buyEquipment(g, 0, 'rune_blade')); assert.equal(g.party[0].attack, 14);
  rejectedWithoutChanges(g, () => E.buyEquipment(g, 0, 'steel_blade'));
  assert(E.buyEquipment(g, 0, 'mail')); assert.equal(g.party[0].maxHp, 50); assert.equal(g.party[0].armor, 2);
  assert(E.depart(g, { difficulty: 'normal', seed: 'armor' })); encounter(g);
  g.combat.enemies.forEach(e => { e.intent = { type: 'strike', damage: 6, target: 0 }; });
  const hp = g.party[0].hp; E.endRound(g); assert.equal(hp - g.party[0].hp, 8);
  assert(E.validateSave(g));
});
test('failed purchases, invalid indices, and out-of-town services never change state', () => {
  const g = E.createGame(); g.gold = 0;
  for (const operation of [() => E.buyEquipment(g, 0, 'mail'), () => E.buyEquipment(g, -1, 'mail'),
    () => E.buyEquipment(g, 0, 'constructor'), () => E.recruit(g, 'bryn'), () => E.recruit(g, 'constructor'),
    () => E.buyPotion(g), () => E.train(g, 0), () => E.swapParty(g, 0, 'missing')]) rejectedWithoutChanges(g, operation);
  assert(E.depart(g, { difficulty: 'normal' })); g.gold = 1000; g.xp = 1000; g.treasures.silver = 5;
  for (const operation of [() => E.buyEquipment(g, 0, 'mail'), () => E.recruit(g, 'bryn'), () => E.buyPotion(g),
    () => E.train(g, 0), () => E.sellTreasure(g)]) rejectedWithoutChanges(g, operation);
});
test('recruitment and party swaps preserve unique heroes, their levels, and equipment', () => {
  const g = E.createGame(); g.gold = 2000; g.xp = 500;
  assert(E.buyEquipment(g, 0, 'steel_blade')); assert(E.train(g, 0));
  assert(E.recruit(g, 'bryn')); assert.equal(g.reserves[0].uid, 'bryn');
  rejectedWithoutChanges(g, () => E.recruit(g, 'bryn'));
  assert(E.swapParty(g, 0, 'bryn')); assert.equal(g.party[0].name, 'Bryn');
  assert.equal(g.reserves[0].name, 'Aldric'); assert.equal(g.reserves[0].gear.weapon, 'steel_blade');
  assert.equal(g.reserves[0].level, 2); assert(E.swapParty(g, 0, 'aldric')); assert.equal(g.party[0].attack, 12);
  assert(E.recruit(g, 'rowan')); assert(E.recruit(g, 'ione'));
  for (const [i, uid] of ['bryn', 'rowan', 'ione'].entries()) assert(E.swapParty(g, i, uid));
  assert.equal(new Set([...g.party, ...g.reserves].map(h => h.uid)).size, 6);
  assert(E.validateSave(JSON.parse(JSON.stringify(g))));
  assert(E.depart(g, { difficulty: 'normal' })); encounter(g);
  assert(E.act(g, 0, 'special')); assert(g.log.some(l => l.text.startsWith('Bryn raises')));
  assert(E.act(g, 1, 'special', 0)); assert(g.log.some(l => l.text.startsWith('Rowan marks')));
  assert(E.act(g, 2, 'special')); assert(g.log.some(l => l.text.startsWith('Ione unleashes')));
  assert(E.validateSave(g));
});
test('training spends both currencies, caps at level ten, and persists after leaving', () => {
  const g = E.createGame(); g.gold = 100000; g.xp = 100000;
  const hp = g.party[1].maxHp, attack = g.party[1].attack;
  assert(E.train(g, 1)); assert.equal(g.gold, 99970); assert.equal(g.xp, 99960);
  assert.equal(g.party[1].maxHp, hp + 5); assert.equal(g.party[1].attack, attack + 1);
  while (g.party[1].level < 10) assert(E.train(g, 1));
  rejectedWithoutChanges(g, () => E.train(g, 1));
  assert(E.depart(g, { difficulty: 'nightmare' })); assert(E.returnToTown(g));
  assert.equal(g.party[1].level, 10); assert(E.validateSave(g));
});
test('retreat removes temporary resolve, revives, preserves spoils, and cannot grant repeated provisions', () => {
  const g = expedition(); const stairs = g.map.entities.find(e => e.type === 'stairs');
  g.pos = { x: stairs.x, y: stairs.y }; assert(E.interact(g));
  assert.equal(g.party[0].depthBonus, 1); g.party[1].hp = 0; g.treasures.silver = 2; g.potions = 0; g.xp = 60;
  const previousSeed = g.seed;
  assert(E.returnToTown(g)); assert.equal(g.lastOutcome, 'retreat'); assert.equal(g.potions, 2);
  assert(g.party.every(h => h.hp === h.maxHp && h.depthBonus === 0));
  assert.equal(g.party[0].maxHp, 38); assert.equal(g.treasures.silver, 2); assert.equal(g.xp, 60);
  rejectedWithoutChanges(g, () => E.returnToTown(g));
  assert(E.depart(g, { difficulty: 'story', seed: previousSeed + '-next' }));
  assert.equal(g.floor, 1); assert.notEqual(g.seed, previousSeed); assert(E.validateSave(g));
});
test('victory and defeat both lead back to town and a fresh playable dungeon', () => {
  for (const outcome of ['won', 'lost']) {
    const g = expedition();
    if (outcome === 'won') {
      g.floor = 3; g.map = E.generate(g.seed, 3); encounter(g, true);
      g.combat.enemies.forEach(e => e.hp = 1); assert(E.act(g, 2, 'special'));
      assert.equal(g.victories, 1); assert.equal(g.treasures.emberheart, 1);
    } else {
      encounter(g); g.party.forEach(h => h.hp = 1);
      for (let i = 0; i < 6 && g.phase === 'combat'; i++) E.endRound(g);
    }
    assert.equal(g.phase, outcome); assert(E.validateSave(g)); assert(E.returnToTown(g));
    assert.equal(g.phase, 'town'); assert(E.validateSave(g));
    assert(E.depart(g, { difficulty: 'normal', seed: 'again' })); assert(E.validateSave(g));
  }
});
test('difficulty scales enemy HP, attacks, area attacks, gold, XP, and treasure', () => {
  let previous = null;
  for (const difficulty of Object.keys(E.DIFFICULTIES)) {
    const g = expedition(difficulty); g.floor = 3; g.map = E.generate(g.seed, 3); encounter(g, true);
    const boss = g.combat.enemies[0], d = E.DIFFICULTIES[difficulty];
    assert.equal(boss.maxHp, Math.round(100 * d.hp)); assert.equal(boss.attack, Math.round(10 * d.damage));
    assert.equal(boss.areaDamage, Math.round(9 * d.damage));
    if (previous) { assert(boss.maxHp > previous.hp); assert(boss.attack > previous.attack); }
    previous = { hp: boss.maxHp, attack: boss.attack };
    g.party.forEach(h => { h.maxHp = h.hp = 500; });
    E.endRound(g); E.endRound(g);
    assert.equal(boss.intent.type, 'all'); assert.equal(boss.intent.damage, boss.areaDamage);
    const gold = g.gold, xp = g.xp;
    g.combat.enemies.forEach(e => e.hp = 1); assert(E.act(g, 2, 'special'));
    assert.equal(g.gold - gold, Math.round(30 * d.reward)); assert.equal(g.xp - xp, Math.round(20 * d.reward));
    assert.equal(g.treasures.emberheart, Math.max(1, Math.round(d.reward)));
  }
});
test('difficulty cannot be invalid or changed after departure; same seed has the same layout', () => {
  const g = E.createGame(); rejectedWithoutChanges(g, () => E.depart(g, { difficulty: '__proto__' }));
  const a = expedition('story', 'same'), b = expedition('nightmare', 'same');
  assert.deepEqual(a.map.tiles, b.map.tiles);
  rejectedWithoutChanges(a, () => E.depart(a, { difficulty: 'nightmare' }));
});
test('campaign saves reject duplicate heroes, wrong gear, impossible stats, and treasure corruption', () => {
  const g = E.createGame();
  for (const corrupt of [s => s.party[1].uid = s.party[0].uid, s => s.party[0].gear.weapon = 'star_bow',
    s => s.party[0].attack += 10, s => s.treasures.silver = -1, s => s.treasures.extra = 1,
    s => s.party[0].level = 11, s => s.difficulty = 'unknown']) {
    const bad = structuredClone(g); corrupt(bad); assert(!E.validateSave(bad));
  }
});
test('v1 in-progress saves migrate without losing health, turns, gold, XP, or combat', () => {
  const original = require('./fixtures/v1-saves.json');
  for (const source of Object.values(original)) {
    const before = JSON.stringify(source), migrated = E.migrateSave(source);
    assert(E.validateSave(migrated), `Migration rejected ${source.phase} / floor ${source.floor}`);
    assert.equal(JSON.stringify(source), before); assert.equal(migrated.phase, source.phase);
    for (const field of ['gold', 'xp', 'potions', 'turn', 'floor', 'seed']) assert.equal(migrated[field], source[field]);
    assert.deepEqual(migrated.party.map(h => [h.hp, h.maxHp, h.attack, h.acted, h.cooldown]), source.party.map(h => [h.hp, h.maxHp, h.attack, h.acted, h.cooldown]));
    assert.equal(migrated.difficulty, 'normal');
    assert.deepEqual(E.migrateSave(migrated), migrated);
  }
});
