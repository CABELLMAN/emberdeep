/* Persistent fellowship, town services, and expedition preparation. */
(function (root) {
  'use strict';
  const A = typeof module !== 'undefined' && module.exports ? require('./armor.js') : root.EmberArmor;
  const W = typeof module !== 'undefined' && module.exports ? require('./weapons.js') : root.EmberWeapons;
  const F = typeof module !== 'undefined' && module.exports ? require('./formations.js') : root.EmberFormations;
  const DIFFICULTIES = {
    story: { name: 'Wayfarer', hp: 0.8, damage: 0.7, reward: 0.8, description: 'A gentler descent. Room to learn and explore.' },
    normal: { name: 'Adventurer', hp: 1, damage: 1, reward: 1, description: 'The original expedition. A balanced challenge.' },
    veteran: { name: 'Veteran', hp: 1.4, damage: 1.3, reward: 1.5, description: 'Stronger foes, richer spoils. Bring trained heroes.' },
    nightmare: { name: 'Nightmare', hp: 1.9, damage: 1.65, reward: 2.2, description: 'A brutal descent for an equipped fellowship.' }
  };
  const EQUIPMENT = { ...W.WEAPON_CATALOG, ...A.ARMOR_CATALOG };
  const TREASURES = {
    silver: { name: 'Ancient Silver', value: 25, glyph: '◈' },
    sapphire: { name: 'Duskmire Sapphire', value: 45, glyph: '◆' },
    idol: { name: 'Gilded Idol', value: 70, glyph: '♜' },
    emberheart: { name: 'Emberheart Shard', value: 180, glyph: '✦' }
  };
  const RECRUITS = {
    bryn: { name: 'Bryn', id: 'warden', role: 'Warden', baseHp: 46, baseAttack: 7, price: 110, description: 'A sturdy veteran. More health, a measured strike.' },
    rowan: { name: 'Rowan', id: 'ranger', role: 'Ranger', baseHp: 32, baseAttack: 8, price: 125, description: 'A keen-eyed scout with a stronger opening shot.' },
    maela: { name: 'Maela', id: 'warden', role: 'Warden', baseHp: 40, baseAttack: 9, price: 160, description: 'A bold duelist, ready to hold a flank.' },
    finn: { name: 'Finn', id: 'ranger', role: 'Ranger', baseHp: 30, baseAttack: 9, price: 155, description: 'A traveling bowyer with a steady aim.' },
    tamsin: { name: 'Tamsin', id: 'arcanist', role: 'Arcanist', baseHp: 34, baseAttack: 7, price: 150, description: 'A resilient scholar, at home behind a shield line.' },
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
    const weapon = W.equippedWeapon(h), armor = A.equippedArmor(h);
    return {
      maxHp: h.baseHp + (h.level - 1) * 5 + h.depthBonus * 5 + armor.reduce((sum, item) => sum + item.hp, 0),
      attack: h.baseAttack + h.level - 1 + h.depthBonus + weapon.attack + W.gripBonus(weapon, h.weaponGrip),
      armor: armor.reduce((sum, item) => sum + item.armor, 0)
    };
  }
  function sync(h, heal = false) {
    Object.assign(h, stats(h));
    h.hp = heal ? h.maxHp : Math.min(h.hp, h.maxHp);
  }
  function makeHero(def, uid = def.uid) {
    const h = { uid, id: def.id, name: def.name, role: def.role, baseHp: def.baseHp, baseAttack: def.baseAttack,
      level: 1, depthBonus: 0, gear: { weapon: null, armor: A.emptyArmorSlots() }, armory: [], weapons: [], weaponGrip: W.STARTING_WEAPONS[def.id].hands[0], cooldown: 0, acted: false, hp: 1 };
    sync(h, true);
    return h;
  }
  function updateLevel(g) { g.level = Math.floor(g.party.reduce((sum, h) => sum + h.level, 0) / g.party.length); }
  function newState(seed, map) {
    return { version: 5, seed: cleanSeed(seed), floor: 1, turn: 0, phase: 'town',
      party: STARTERS.map(h => makeHero(h)), reserves: [], formation: F.defaultFormation(STARTERS), potions: 4, gold: 100, kills: 0, level: 1, xp: 0,
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
    if (item.slot === 'armor') {
      if (!A.armorFits(h, item) || h.armory.includes(itemId)) return false;
      g.gold -= item.price;
      h.armory.push(itemId);
      h.gear.armor[item.location][item.layer] = itemId;
      sync(h, true);
      record(g, `${h.name} equips ${item.name} on ${A.ARMOR_LOCATIONS[item.location].toLowerCase()}, ${A.ARMOR_LAYERS[item.layer].toLowerCase()}.`, 'loot');
      return true;
    }
    if (h.weapons.includes(itemId)) return false;
    g.gold -= item.price;
    h.weapons.push(itemId);
    h.gear.weapon = itemId;
    h.weaponGrip = item.hands[0];
    sync(h, true);
    record(g, `${h.name} equips ${item.name} in ${h.weaponGrip} ${h.weaponGrip === 1 ? 'hand' : 'hands'}. Replaced weapons remain owned.`, 'loot');
    return true;
  }
  function equipWeapon(g, heroIndex, itemId, grip) {
    if (g.phase !== 'town' || !Number.isInteger(heroIndex)) return false;
    const h = g.party[heroIndex];
    if (!h || itemId !== null && (!owns(W.WEAPON_CATALOG, itemId) || !h.weapons.includes(itemId))) return false;
    const item = itemId === null ? W.STARTING_WEAPONS[h.id] : W.WEAPON_CATALOG[itemId];
    const hands = grip === undefined ? (h.gear.weapon === itemId ? h.weaponGrip : item.hands[0]) : grip;
    if (item.role !== h.id || !W.validGrip(item, hands) || h.gear.weapon === itemId && h.weaponGrip === hands) return false;
    h.gear.weapon = itemId;
    h.weaponGrip = hands;
    sync(h, true);
    record(g, `${h.name} readies ${item.name} in ${hands} ${hands === 1 ? 'hand' : 'hands'}.`, 'loot');
    return true;
  }
  function setWeaponGrip(g, heroIndex, grip) {
    if (!Number.isInteger(heroIndex) || !g.party[heroIndex]) return false;
    return equipWeapon(g, heroIndex, g.party[heroIndex].gear.weapon, grip);
  }
  function equipArmor(g, heroIndex, itemId) {
    if (g.phase !== 'town' || !Number.isInteger(heroIndex) || !owns(EQUIPMENT, itemId)) return false;
    const h = g.party[heroIndex], item = EQUIPMENT[itemId];
    if (!h || !A.armorFits(h, item) || !h.armory.includes(itemId) || h.gear.armor[item.location][item.layer] === itemId) return false;
    h.gear.armor[item.location][item.layer] = itemId;
    sync(h, true);
    record(g, `${h.name} changes into ${item.name}.`, 'loot');
    return true;
  }
  function unequipArmor(g, heroIndex, location, layer) {
    if (g.phase !== 'town' || !Number.isInteger(heroIndex) || !owns(A.ARMOR_LOCATIONS, location) || !owns(A.ARMOR_LAYERS, layer)) return false;
    const h = g.party[heroIndex];
    if (!h || !h.gear.armor[location][layer]) return false;
    const item = EQUIPMENT[h.gear.armor[location][layer]];
    h.gear.armor[location][layer] = null;
    sync(h, true);
    record(g, `${h.name} stores ${item.name} with their owned armor.`);
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
    const position = F.heroPosition(g, g.party[heroIndex]);
    g.formation[position] = reserveId;
    [g.party[heroIndex], g.reserves[reserveIndex]] = [g.reserves[reserveIndex], g.party[heroIndex]];
    updateLevel(g);
    record(g, `${g.party[heroIndex].name} takes party slot ${heroIndex + 1}. ${g.reserves[reserveIndex].name} waits at the inn.`);
    return true;
  }
  function assignFormation(g, heroIndex, position) {
    if (g.phase !== 'town' || !Number.isInteger(heroIndex) || !g.party[heroIndex] || !owns(F.FORMATION_SLOTS, position)) return false;
    const hero = g.party[heroIndex], previous = F.heroPosition(g, hero);
    if (previous === position) return false;
    g.formation[previous] = g.formation[position];
    g.formation[position] = hero.uid;
    record(g, `${hero.name} takes ${F.FORMATION_SLOTS[position].name.toLowerCase()}. Formation changes are ready for the next battle.`);
    return true;
  }
  function addToParty(g, reserveId, position) {
    if (g.phase !== 'town' || g.party.length >= F.MAX_PARTY) return false;
    const reserveIndex = g.reserves.findIndex(h => h.uid === reserveId);
    const slot = position === undefined ? Object.keys(F.FORMATION_SLOTS).find(key => g.formation[key] === null) : position;
    if (reserveIndex < 0 || !owns(F.FORMATION_SLOTS, slot) || g.formation[slot] !== null) return false;
    const hero = g.reserves.splice(reserveIndex, 1)[0];
    g.party.push(hero);
    g.formation[slot] = hero.uid;
    updateLevel(g);
    record(g, `${hero.name} joins the active party at ${F.FORMATION_SLOTS[slot].name.toLowerCase()}. ${g.party.length} of ${F.MAX_PARTY} positions filled.`, 'loot');
    return true;
  }
  function benchHero(g, heroIndex) {
    if (g.phase !== 'town' || !Number.isInteger(heroIndex) || !g.party[heroIndex] || g.party.length <= 1) return false;
    const hero = g.party[heroIndex];
    g.formation[F.heroPosition(g, hero)] = null;
    g.party.splice(heroIndex, 1);
    g.reserves.push(hero);
    updateLevel(g);
    record(g, `${hero.name} rests at the inn. Their equipment and training stay with them.`);
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
      if (g?.version === 5) return g;
      if (g?.version === 1) {
        if (!Array.isArray(g.party) || g.party.length !== 3 || !Number.isInteger(g.level) || g.level < 1 || g.level > 3) return null;
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
      }
      if (!Array.isArray(g?.party) || !Array.isArray(g.reserves)) return null;
      if (g.version === 2) {
        for (const h of members(g)) {
          if (!h.gear || ![null, 'leather', 'mail', 'plate'].includes(h.gear.armor)) return null;
          const previous = h.gear.armor;
          h.gear.armor = A.emptyArmorSlots();
          h.armory = previous ? [previous] : [];
          if (previous) {
            const item = EQUIPMENT[previous];
            h.gear.armor[item.location][item.layer] = previous;
          }
        }
        g.version = 3;
      }
      if (g.version === 3) {
        for (const h of members(g)) {
          if (!h.gear || h.gear.weapon !== null && !owns(W.WEAPON_CATALOG, h.gear.weapon)) return null;
          const item = W.equippedWeapon(h);
          if (!item || item.role !== h.id) return null;
          h.weapons = h.gear.weapon === null ? [] : [h.gear.weapon];
          h.weaponGrip = item.hands[0];
        }
        g.version = 4;
      }
      if (g.version !== 4 || g.party.length !== 3) return null;
      // All three legacy members remain exposed so saved enemy intentions retain their targets.
      g.formation = F.defaultFormation(g.party);
      g.version = 5;
      return g;
    } catch { return null; }
  }
  function validateCampaign(g) {
    const int = (n, max = 1000000000) => Number.isInteger(n) && n >= 0 && n <= max;
    if (g.version !== 5 || !owns(DIFFICULTIES, g.difficulty) || !Array.isArray(g.reserves) || g.reserves.length > STARTERS.length + Object.keys(RECRUITS).length - 1 ||
        !int(g.expeditions) || !int(g.victories) || g.victories > g.expeditions || ![null, 'victory', 'retreat', 'rescued'].includes(g.lastOutcome)) return false;
    if (!g.treasures || Object.keys(g.treasures).length !== Object.keys(TREASURES).length || Object.keys(TREASURES).some(id => !int(g.treasures[id]))) return false;
    const all = members(g);
    if (!F.validFormation(g)) return false;
    if (new Set(all.map(h => h.uid)).size !== all.length) return false;
    for (const h of all) {
      const def = STARTERS.find(s => s.uid === h.uid) || (owns(RECRUITS, h.uid) ? RECRUITS[h.uid] : null);
      if (!def || h.id !== def.id || h.name !== def.name || h.role !== def.role || h.baseHp !== def.baseHp || h.baseAttack !== def.baseAttack ||
          !int(h.level, 10) || h.level < 1 || !int(h.depthBonus, 2) || !h.gear || Object.keys(h.gear).length !== 2) return false;
      if (h.gear.weapon !== null && (!owns(EQUIPMENT, h.gear.weapon) || EQUIPMENT[h.gear.weapon].slot !== 'weapon' || EQUIPMENT[h.gear.weapon].role !== h.id)) return false;
      if (!W.validWeaponLoadout(h) || !A.validArmorLoadout(h)) return false;
      const expected = stats(h);
      if (h.maxHp !== expected.maxHp || h.attack !== expected.attack || h.armor !== expected.armor || !int(h.hp, h.maxHp) ||
          !int(h.cooldown, 2) || typeof h.acted !== 'boolean') return false;
      if ((g.phase === 'town' || g.reserves.includes(h)) && (h.depthBonus !== 0 || h.hp !== h.maxHp || h.acted || h.cooldown !== 0)) return false;
    }
    return g.level === Math.floor(g.party.reduce((n, h) => n + h.level, 0) / g.party.length);
  }
  const api = { ...A, ...W, ...F, DIFFICULTIES, EQUIPMENT, TREASURES, RECRUITS, STARTERS, newState, depart, returnToTown,
    sellTreasure, treasureValue, addTreasure, buyEquipment, buyPotion, recruit, swapParty, train, trainingCost,
    stats, sync, migrateSave, validateCampaign, equipArmor, unequipArmor, equipWeapon, setWeaponGrip, assignFormation, addToParty, benchHero };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EmberCampaign = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
