/* Persistent fellowship, town services, and expedition preparation. */
(function (root) {
  'use strict';
  const DIFFICULTIES = {
    story: { name: 'Wayfarer', hp: 0.8, damage: 0.7, reward: 0.8, description: 'A gentler descent. Room to learn and explore.' },
    normal: { name: 'Adventurer', hp: 1, damage: 1, reward: 1, description: 'The original expedition. A balanced challenge.' },
    veteran: { name: 'Veteran', hp: 1.4, damage: 1.3, reward: 1.5, description: 'Stronger foes, richer spoils. Bring trained heroes.' },
    nightmare: { name: 'Nightmare', hp: 1.9, damage: 1.65, reward: 2.2, description: 'A brutal descent for an equipped fellowship.' }
  };
  const EQUIPMENT = {
    steel_blade: { name: 'Steel Longsword', slot: 'weapon', role: 'warden', attack: 3, hp: 0, armor: 0, price: 80 },
    hunting_bow: { name: 'Yew Longbow', slot: 'weapon', role: 'ranger', attack: 3, hp: 0, armor: 0, price: 80 },
    ember_staff: { name: 'Emberwood Staff', slot: 'weapon', role: 'arcanist', attack: 3, hp: 0, armor: 0, price: 80 },
    rune_blade: { name: 'Runebound Blade', slot: 'weapon', role: 'warden', attack: 6, hp: 0, armor: 0, price: 220 },
    star_bow: { name: 'Starfall Bow', slot: 'weapon', role: 'ranger', attack: 6, hp: 0, armor: 0, price: 220 },
    sun_staff: { name: 'Sunfire Staff', slot: 'weapon', role: 'arcanist', attack: 6, hp: 0, armor: 0, price: 220 },
    leather: { name: 'Trail Leathers', slot: 'armor', role: null, attack: 0, hp: 6, armor: 1, price: 65 },
    mail: { name: 'Warded Mail', slot: 'armor', role: null, attack: 0, hp: 12, armor: 2, price: 160 },
    plate: { name: 'Emberguard Armor', slot: 'armor', role: null, attack: 0, hp: 18, armor: 3, price: 300 }
  };
  const TREASURES = {
    silver: { name: 'Ancient Silver', value: 25, glyph: '◈' },
    sapphire: { name: 'Duskmire Sapphire', value: 45, glyph: '◆' },
    idol: { name: 'Gilded Idol', value: 70, glyph: '♜' },
    emberheart: { name: 'Emberheart Shard', value: 180, glyph: '✦' }
  };
  const RECRUITS = {
    bryn: { name: 'Bryn', id: 'warden', role: 'Warden', baseHp: 46, baseAttack: 7, price: 110, description: 'A sturdy veteran. More health, a measured strike.' },
    rowan: { name: 'Rowan', id: 'ranger', role: 'Ranger', baseHp: 32, baseAttack: 8, price: 125, description: 'A keen-eyed scout with a stronger opening shot.' },
    ione: { name: 'Ione', id: 'arcanist', role: 'Arcanist', baseHp: 30, baseAttack: 8, price: 140, description: 'An ember scholar whose spells burn brighter.' }
  };
  const STARTERS = [
    { uid: 'aldric', id: 'warden', name: 'Aldric', role: 'Warden', baseHp: 38, baseAttack: 8 },
    { uid: 'lyra', id: 'ranger', name: 'Lyra', role: 'Ranger', baseHp: 28, baseAttack: 7 },
    { uid: 'sera', id: 'arcanist', name: 'Sera', role: 'Arcanist', baseHp: 26, baseAttack: 6 }
  ];
  const owns = (object, id) => Object.prototype.hasOwnProperty.call(object, id);
  const freshSeed = () => 'EMBER-' + Math.floor(Math.random() * 1000000);
  const cleanSeed = seed => String(seed || freshSeed()).trim().slice(0, 40) || freshSeed();
  const members = g => [...g.party, ...g.reserves];
  function record(g, text, type = 'info') {
    g.log.push({ text, type, turn: g.turn });
    if (g.log.length > 65) g.log.shift();
    g.message = text;
  }
  function stats(h) {
    const weapon = EQUIPMENT[h.gear.weapon], armor = EQUIPMENT[h.gear.armor];
    return {
      maxHp: h.baseHp + (h.level - 1) * 5 + h.depthBonus * 5 + (armor?.hp || 0),
      attack: h.baseAttack + h.level - 1 + h.depthBonus + (weapon?.attack || 0),
      armor: armor?.armor || 0
    };
  }
  function sync(h, heal = false) {
    Object.assign(h, stats(h));
    h.hp = heal ? h.maxHp : Math.min(h.hp, h.maxHp);
  }
  function makeHero(def, uid = def.uid) {
    const h = { uid, id: def.id, name: def.name, role: def.role, baseHp: def.baseHp, baseAttack: def.baseAttack,
      level: 1, depthBonus: 0, gear: { weapon: null, armor: null }, cooldown: 0, acted: false, hp: 1 };
    sync(h, true);
    return h;
  }
  function updateLevel(g) { g.level = Math.floor(g.party.reduce((sum, h) => sum + h.level, 0) / 3); }
  function newState(seed, map) {
    return { version: 2, seed: cleanSeed(seed), floor: 1, turn: 0, phase: 'town',
      party: STARTERS.map(h => makeHero(h)), reserves: [], potions: 4, gold: 100, kills: 0, level: 1, xp: 0,
      difficulty: 'normal', treasures: { silver: 0, sapphire: 0, idol: 0, emberheart: 0 },
      expeditions: 0, victories: 0, lastOutcome: null, log: [], combat: null, map, pos: { ...map.start } };
  }
  function depart(g, options, engine) {
    if (g.phase !== 'town' || !options || !owns(DIFFICULTIES, options.difficulty)) return false;
    const seed = cleanSeed(options.seed);
    const map = engine.generate(seed, 1);
    g.seed = seed;
    g.difficulty = options.difficulty;
    g.floor = 1;
    g.kills = 0;
    g.combat = null;
    g.map = map;
    g.pos = { ...map.start };
    g.phase = 'explore';
    g.expeditions++;
    g.turn++;
    for (const h of g.party) { h.depthBonus = 0; h.acted = false; h.cooldown = 0; sync(h, true); }
    engine.reveal(g);
    record(g, `Expedition ${g.expeditions} begins on ${DIFFICULTIES[g.difficulty].name}. The town will keep a lantern lit.`, 'combat');
    return true;
  }
  function returnToTown(g) {
    if (!['explore', 'won', 'lost'].includes(g.phase)) return false;
    g.lastOutcome = g.phase === 'won' ? 'victory' : g.phase === 'lost' ? 'rescued' : 'retreat';
    g.phase = 'town';
    g.combat = null;
    g.turn++;
    for (const h of members(g)) { h.depthBonus = 0; h.acted = false; h.cooldown = 0; sync(h, true); }
    // A small, unsellable provision keeps a penniless fellowship able to leave again.
    g.potions = Math.max(2, g.potions);
    record(g, g.lastOutcome === 'victory' ? 'Hearthglen welcomes its heroes. Sell your spoils and prepare the next descent.' :
      g.lastOutcome === 'rescued' ? 'The innkeeper’s rescuers bring you home. Your fellowship and recovered spoils survive.' :
        'You leave this dungeon behind and return to Hearthglen with your spoils.', 'heal');
    return true;
  }
  function treasureValue(g) { return Object.entries(TREASURES).reduce((sum, [id, t]) => sum + g.treasures[id] * t.value, 0); }
  function addTreasure(g, id, amount = 1) {
    const quantity = Math.max(1, Math.round(amount * DIFFICULTIES[g.difficulty].reward));
    g.treasures[id] += quantity;
    return quantity;
  }
  function sellTreasure(g, id = 'all') {
    if (g.phase !== 'town' || id !== 'all' && !owns(TREASURES, id)) return false;
    const ids = id === 'all' ? Object.keys(TREASURES) : [id];
    const value = ids.reduce((sum, key) => sum + TREASURES[key].value * g.treasures[key], 0);
    if (value <= 0) return false;
    for (const key of ids) g.treasures[key] = 0;
    g.gold += value;
    record(g, `The merchant pays ${value} gold for your treasure.`, 'loot');
    return true;
  }
  function buyEquipment(g, heroIndex, itemId) {
    if (g.phase !== 'town' || !Number.isInteger(heroIndex) || !owns(EQUIPMENT, itemId)) return false;
    const h = g.party[heroIndex], item = EQUIPMENT[itemId];
    if (!h || item.role && h.id !== item.role || g.gold < item.price) return false;
    const current = EQUIPMENT[h.gear[item.slot]];
    if (current && current.price >= item.price) return false;
    g.gold -= item.price;
    h.gear[item.slot] = itemId;
    sync(h, true);
    record(g, `${h.name} equips ${item.name}. Its bonuses are active in the next dungeon.`, 'loot');
    return true;
  }
  function buyPotion(g) {
    if (g.phase !== 'town' || g.gold < 20 || g.potions >= 99) return false;
    g.gold -= 20;
    g.potions++;
    record(g, 'One healing draught purchased for 20 gold.', 'loot');
    return true;
  }
  function recruit(g, recruitId) {
    if (g.phase !== 'town' || !owns(RECRUITS, recruitId) || members(g).some(h => h.uid === recruitId)) return false;
    const def = RECRUITS[recruitId];
    if (g.gold < def.price) return false;
    g.gold -= def.price;
    g.reserves.push(makeHero(def, recruitId));
    record(g, `${def.name} joins your fellowship. Choose a party slot to bring them on your next expedition.`, 'loot');
    return true;
  }
  function swapParty(g, heroIndex, reserveId) {
    if (g.phase !== 'town' || !Number.isInteger(heroIndex) || !g.party[heroIndex]) return false;
    const reserveIndex = g.reserves.findIndex(h => h.uid === reserveId);
    if (reserveIndex < 0) return false;
    [g.party[heroIndex], g.reserves[reserveIndex]] = [g.reserves[reserveIndex], g.party[heroIndex]];
    updateLevel(g);
    record(g, `${g.party[heroIndex].name} takes party slot ${heroIndex + 1}. ${g.reserves[reserveIndex].name} waits at the inn.`);
    return true;
  }
  function trainingCost(h) { return { gold: 30 * h.level, xp: 40 * h.level }; }
  function train(g, heroIndex) {
    if (g.phase !== 'town' || !Number.isInteger(heroIndex)) return false;
    const h = g.party[heroIndex];
    if (!h || h.level >= 10) return false;
    const cost = trainingCost(h);
    if (g.gold < cost.gold || g.xp < cost.xp) return false;
    g.gold -= cost.gold;
    g.xp -= cost.xp;
    h.level++;
    sync(h, true);
    updateLevel(g);
    record(g, `${h.name} reaches level ${h.level}: +5 permanent health and +1 attack.`, 'loot');
    return true;
  }
  function migrateSave(source) {
    try {
      const g = JSON.parse(JSON.stringify(source));
      if (g?.version === 2) return g;
      if (g?.version !== 1 || !Array.isArray(g.party) || g.party.length !== 3 || !Number.isInteger(g.level) || g.level < 1 || g.level > 3) return null;
      if (g.party.some((h, i) => h.id !== STARTERS[i].id || h.name !== STARTERS[i].name || h.role !== STARTERS[i].role)) return null;
      for (let i = 0; i < 3; i++) {
        const h = g.party[i];
        Object.assign(h, { uid: STARTERS[i].uid, baseHp: h.maxHp - (g.level - 1) * 5,
          baseAttack: h.attack - (g.level - 1), level: g.level, depthBonus: 0,
          gear: { weapon: null, armor: null }, armor: 0 });
      }
      Object.assign(g, { version: 2, difficulty: 'normal', reserves: [], treasures: { silver: 0, sapphire: 0, idol: 0, emberheart: 0 },
        expeditions: 1, victories: g.phase === 'won' ? 1 : 0, lastOutcome: null });
      if (g.combat) for (const e of g.combat.enemies) e.areaDamage = e.type === 'boss' ? 9 : e.type === 'hexer' ? 4 : 0;
      return g;
    } catch { return null; }
  }
  function validateCampaign(g) {
    const int = (n, max = 1000000000) => Number.isInteger(n) && n >= 0 && n <= max;
    if (g.version !== 2 || !owns(DIFFICULTIES, g.difficulty) || !Array.isArray(g.reserves) || g.reserves.length > 3 ||
        !int(g.expeditions) || !int(g.victories) || g.victories > g.expeditions || ![null, 'victory', 'retreat', 'rescued'].includes(g.lastOutcome)) return false;
    if (!g.treasures || Object.keys(g.treasures).length !== Object.keys(TREASURES).length || Object.keys(TREASURES).some(id => !int(g.treasures[id]))) return false;
    const all = members(g);
    if (new Set(all.map(h => h.uid)).size !== all.length) return false;
    for (const h of all) {
      const def = STARTERS.find(s => s.uid === h.uid) || (owns(RECRUITS, h.uid) ? RECRUITS[h.uid] : null);
      if (!def || h.id !== def.id || h.name !== def.name || h.role !== def.role || h.baseHp !== def.baseHp || h.baseAttack !== def.baseAttack ||
          !int(h.level, 10) || h.level < 1 || !int(h.depthBonus, 2) || !h.gear || Object.keys(h.gear).length !== 2) return false;
      for (const slot of ['weapon', 'armor']) if (h.gear[slot] !== null && (!owns(EQUIPMENT, h.gear[slot]) ||
        EQUIPMENT[h.gear[slot]].slot !== slot || EQUIPMENT[h.gear[slot]].role && EQUIPMENT[h.gear[slot]].role !== h.id)) return false;
      const expected = stats(h);
      if (h.maxHp !== expected.maxHp || h.attack !== expected.attack || h.armor !== expected.armor || !int(h.hp, h.maxHp) ||
          !int(h.cooldown, 2) || typeof h.acted !== 'boolean') return false;
      if ((g.phase === 'town' || g.reserves.includes(h)) && (h.depthBonus !== 0 || h.hp !== h.maxHp || h.acted || h.cooldown !== 0)) return false;
    }
    return g.level === Math.floor(g.party.reduce((n, h) => n + h.level, 0) / 3);
  }
  const api = { DIFFICULTIES, EQUIPMENT, TREASURES, RECRUITS, STARTERS, newState, depart, returnToTown,
    sellTreasure, treasureValue, addTreasure, buyEquipment, buyPotion, recruit, swapParty, train, trainingCost,
    stats, sync, migrateSave, validateCampaign };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EmberCampaign = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
