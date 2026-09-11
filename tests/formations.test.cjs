const { test } = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
function funded() { const g = E.createGame(); g.gold = 10000; g.xp = 10000; return g; }
function fullParty() {
  const g = funded();
  for (const id of Object.keys(E.RECRUITS)) {
    assert(E.recruit(g, id));
    if (g.party.length < E.MAX_PARTY) assert(E.addToParty(g, id));
  }
  return g;
}
function encounter(g, seed = 'formations', kind = 'rats') {
  assert(E.depart(g, { difficulty: 'normal', seed }));
  const entity = g.map.entities.find(e => e.type === 'enemy'); entity.kind = kind;
  const [dx, dy] = E.DIRS.find(([dx, dy]) => g.map.tiles[entity.y - dy]?.[entity.x - dx] === 1);
  g.pos = { x: entity.x - dx, y: entity.y - dy }; assert(E.move(g, dx, dy));
  return g.combat.enemies;
}
function unchanged(g, operation) { const before = JSON.stringify(g); assert.equal(operation(), false); assert.equal(JSON.stringify(g), before); }

test('new campaigns still start with three heroes and have exactly eight formation positions', () => {
  const g = E.createGame(); assert.equal(g.party.length, 3); assert.equal(g.reserves.length, 0); assert.equal(g.gold, 100);
  assert.equal(E.MAX_PARTY, 8); assert.equal(Object.keys(g.formation).length, 8);
  assert.deepEqual(Object.values(E.FORMATION_SLOTS).reduce((counts, p) => { counts[p.row]++; return counts; }, { front: 0, rear: 0, flank: 0 }), { front: 3, rear: 3, flank: 2 });
  assert.equal(Object.values(g.formation).filter(Boolean).length, 3); assert(E.validateSave(g));
});
test('enough unique recruits exist to fill eight positions and a ninth hero stays in reserve', () => {
  const g = fullParty(); assert.equal(g.party.length, 8); assert.equal(g.reserves.length, 1);
  assert.equal(new Set(Object.values(g.formation)).size, 8); assert(E.validateSave(g));
  const spare = g.reserves[0].uid; unchanged(g, () => E.addToParty(g, spare));
  const old = g.party[7].uid, position = E.heroPosition(g, g.party[7]);
  assert(E.swapParty(g, 7, spare)); assert.equal(g.formation[position], spare); assert.equal(g.reserves[0].uid, old);
  assert(E.validateSave(g));
});
test('moving into empty positions and swapping occupied positions never loses or duplicates a hero', () => {
  const g = funded();
  assert(E.assignFormation(g, 0, 'rear_center')); assert.equal(g.formation.front_left, null);
  assert.equal(g.formation.rear_center, 'aldric');
  assert(E.assignFormation(g, 1, 'rear_center')); assert.equal(g.formation.rear_center, 'lyra');
  assert.equal(g.formation.front_center, 'aldric');
  for (const operation of [() => E.assignFormation(g, 1, 'rear_center'), () => E.assignFormation(g, 0, '__proto__'),
    () => E.assignFormation(g, 8, 'flank_left'), () => E.assignFormation(g, '1', 'flank_left')]) unchanged(g, operation);
  assert(E.validateSave(g));
  const formation = structuredClone(g.formation); encounter(g);
  assert.deepEqual(g.formation, formation); unchanged(g, () => E.assignFormation(g, 0, 'flank_left'));
  unchanged(g, () => E.benchHero(g, 0)); unchanged(g, () => E.addToParty(g, 'bryn'));
});
test('adding and benching preserve equipment and training, leave no ghost positions, and average active levels', () => {
  const g = funded(); E.train(g, 0); E.train(g, 0); E.buyEquipment(g, 0, 'spear_medium'); E.setWeaponGrip(g, 0, 2);
  const hero = structuredClone(g.party[0]); assert(E.benchHero(g, 0));
  assert.equal(g.level, 1); assert.equal(g.party.length, 2); assert(!Object.values(g.formation).includes('aldric'));
  assert.deepEqual(g.reserves[0], hero);
  unchanged(g, () => E.addToParty(g, 'aldric', 'front_center'));
  unchanged(g, () => E.addToParty(g, 'aldric', '__proto__'));
  assert(E.addToParty(g, 'aldric', 'flank_right')); assert.deepEqual(g.party[2], hero);
  assert.equal(g.formation.flank_right, 'aldric'); assert(E.validateSave(g));
  assert(E.benchHero(g, 0)); assert(E.benchHero(g, 0));
  assert.equal(g.party.length, 1); assert.equal(g.level, 3); unchanged(g, () => E.benchHero(g, 0));
  assert(E.depart(g, { difficulty: 'normal' })); assert(E.validateSave(g));
});
test('eight living heroes each receive one action and the enemy phase waits for the eighth', () => {
  const g = fullParty(); encounter(g); const hp = g.party.map(h => h.hp);
  for (let i = 0; i < 7; i++) {
    assert(E.act(g, i, 'guard')); assert.equal(g.combat.round, 1); assert.deepEqual(g.party.map(h => h.hp), hp);
    unchanged(g, () => E.act(g, i, 'guard'));
    assert(E.validateSave(g));
  }
  assert(E.act(g, 7, 'guard')); assert.equal(g.combat.round, 2); assert(g.party.some((h, i) => h.hp < hp[i]));
  assert(g.party.every(h => !h.acted)); assert(E.validateSave(g));
});
test('healing, armor purchases, training, and saves accept the eighth hero', () => {
  const g = fullParty(), h = g.party[7]; assert(E.train(g, 7));
  assert.equal(g.level, Math.floor(g.party.reduce((n, h) => n + h.level, 0) / 8));
  const armor = E.armorItemId({ location: 'head', layer: 'plate', tier: 2, weight: 'heavy', class: h.id });
  assert(E.buyEquipment(g, 7, armor)); encounter(g); h.hp -= 20;
  const hp = h.hp; assert(E.act(g, 0, 'potion', 7)); assert.equal(h.hp, hp + 18);
  unchanged(g, () => E.act(g, 1, 'potion', 8)); unchanged(g, () => E.act(g, 8, 'attack', 0));
  g.combat.enemies[0].intent.target = 7; assert(E.validateSave(g));
  const restored = E.migrateSave(g); assert(E.validateSave(restored)); assert.deepEqual(restored, g);
});
test('front and flank heroes screen the second line; empty and fallen positions cannot screen', () => {
  const g = funded(); E.assignFormation(g, 0, 'rear_left'); E.assignFormation(g, 1, 'rear_center'); E.assignFormation(g, 2, 'flank_right');
  const enemies = encounter(g), hp = g.party.map(h => h.hp);
  assert(enemies.every(e => e.intent.target === 2)); assert.deepEqual(E.formationTargets(g, enemies[0]), [2]);
  g.party[2].hp = 1;
  E.endRound(g); assert.equal(g.party[2].hp, 0);
  assert.equal(g.party[0].hp, hp[0] - enemies[1].attack); assert.equal(g.party[1].hp, hp[1]);
  assert.deepEqual(E.formationTargets(g, enemies[0]), [0, 1]); assert(E.validateSave(g));
});
test('retargeting a fallen front hero respects another exposed hero even if rear heroes occur first in the roster', () => {
  const g = funded(); E.assignFormation(g, 0, 'rear_left'); E.assignFormation(g, 2, 'flank_left');
  const enemies = encounter(g); g.party[1].hp = 1; const backHp = g.party[0].hp, flankHp = g.party[2].hp;
  enemies.forEach(e => e.intent.target = 1); E.endRound(g);
  assert.equal(g.party[1].hp, 0); assert.equal(g.party[0].hp, backHp);
  assert.equal(g.party[2].hp, flankHp - enemies[1].attack); assert(E.validateSave(g));
});
test('enemy spells and area attacks bypass a full frontline screen', () => {
  const g = fullParty(); const enemies = encounter(g, 'spells', 'hexers'), hexer = enemies[0];
  assert.equal(E.formationTargets(g, hexer).length, 8);
  const back = g.party.findIndex(h => E.FORMATION_SLOTS[E.heroPosition(g, h)].row === 'rear');
  hexer.intent.target = back; const hp = g.party[back].hp; E.endRound(g);
  assert.equal(g.party[back].hp, hp - hexer.attack); assert.equal(hexer.intent.type, 'all');
  enemies[1].hp = 0; const before = g.party.map(h => h.hp); E.endRound(g);
  assert.deepEqual(g.party.map(h => h.hp), before.map(hp => hp - hexer.areaDamage)); assert(E.validateSave(g));
});
test('second-line reach penalty affects actual melee damage, while spears, ranged weapons, and magic keep their reach', () => {
  for (const [id, index, penalty] of [['sword_medium', 0, 2], ['axe_large', 0, 2], ['mace_hammer_small', 0, 2],
    ['spear_small', 0, 0], ['spear_medium', 0, 0], ['spear_large', 0, 0], ['crossbow', 1, 0], ['wand', 2, 0]]) {
    const g = funded(); E.buyEquipment(g, index, id); E.assignFormation(g, index, 'rear_center');
    const attack = E.combatAttack(g, g.party[index]); assert.equal(attack.total, g.party[index].attack - penalty);
    const [e] = encounter(g); e.hp = e.maxHp = 100; const hp = e.hp;
    assert(E.act(g, index, 'attack', 0)); assert.equal(hp - e.hp, attack.total); assert(E.validateSave(g));
  }
});
test('formations and roster survive a complete eight-hero expedition, a return, and a second departure', () => {
  const g = fullParty(), formation = structuredClone(g.formation); E.depart(g, { difficulty: 'normal', seed: 'full-expedition' });
  for (let floor = 1; floor <= 2; floor++) {
    const stairs = g.map.entities.find(e => e.type === 'stairs'); g.pos = { x: stairs.x, y: stairs.y };
    assert(E.interact(g)); assert(g.party.every(h => h.depthBonus === floor)); assert(E.validateSave(g));
  }
  const boss = g.map.entities.find(e => e.type === 'boss'), [dx, dy] = E.DIRS.find(([dx, dy]) => g.map.tiles[boss.y - dy]?.[boss.x - dx] === 1);
  g.pos = { x: boss.x - dx, y: boss.y - dy }; E.move(g, dx, dy); g.combat.enemies.forEach(e => e.hp = 1);
  assert(E.act(g, 2, 'special')); assert.equal(g.phase, 'won'); assert(E.validateSave(g));
  assert(E.returnToTown(g)); assert.deepEqual(g.formation, formation); assert(g.party.every(h => h.hp === h.maxHp && h.depthBonus === 0));
  assert(E.depart(g, { difficulty: 'veteran' })); assert.deepEqual(g.formation, formation); assert(E.validateSave(g));
});
test('save validation rejects missing, duplicate, invalid, reserved, and over-capacity formation assignments', () => {
  const g = fullParty();
  for (const corrupt of [s => delete s.formation, s => delete s.formation.front_left, s => s.formation.extra = null,
    s => s.formation.front_left = s.formation.front_center, s => s.formation.front_left = 'unknown',
    s => s.formation.front_left = s.reserves[0].uid, s => s.formation.front_left = null,
    s => s.party.push(s.reserves.pop()), s => s.party = [], s => s.formation = []]) {
    const bad = structuredClone(g); corrupt(bad); assert(!E.validateSave(bad));
  }
  encounter(g); g.combat.enemies[0].intent.target = 8; assert(!E.validateSave(g));
});
test('v4 migration adds formation positions while preserving every previous field including combat intentions and grip', () => {
  for (const [name, old] of Object.entries(require('./fixtures/v4-saves.json'))) {
    const before = JSON.stringify(old), g = E.migrateSave(old); assert(E.validateSave(g), name); assert.equal(g.version, 5);
    for (const field of Object.keys(old).filter(k => k !== 'version')) assert.deepEqual(g[field], old[field], `${name}: ${field}`);
    assert.deepEqual(Object.values(g.formation).filter(Boolean), old.party.map(h => h.uid));
    assert.equal(JSON.stringify(old), before); assert.deepEqual(E.migrateSave(g), g);
  }
});
