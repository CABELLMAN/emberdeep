/* Weapon families, legal grips, and integer damage distributions. */
(function (root) {
  'use strict';
  const WEAPON_TYPES = {
    spear: { name: 'Spear', family: 'melee', role: 'warden', damage: { pierce: 70, cut: 10, blunt: 20 }, action: 'Spear Thrust' },
    axe: { name: 'Axe', family: 'melee', role: 'warden', damage: { pierce: 10, cut: 70, blunt: 20 }, action: 'Axe Cleave' },
    mace_hammer: { name: 'Mace / Hammer', family: 'melee', role: 'warden', damage: { pierce: 10, cut: 10, blunt: 80 }, action: 'Crushing Blow' },
    sword: { name: 'Sword', family: 'melee', role: 'warden', damage: { pierce: 1, cut: 1, blunt: 1 }, action: 'Sword Strike' },
    crossbow: { name: 'Crossbow', family: 'ranged', role: 'ranger', damage: { pierce: 100 }, action: 'Crossbow Bolt' },
    shortbow: { name: 'Shortbow', family: 'ranged', role: 'ranger', damage: { pierce: 100 }, action: 'Quick Shot' },
    longbow: { name: 'Longbow', family: 'ranged', role: 'ranger', damage: { pierce: 100 }, action: 'Longbow Shot' },
    wand: { name: 'Wand', family: 'magic', role: 'arcanist', damage: { arcane: 100 }, action: 'Wand Spark' },
    staff: { name: 'Staff', family: 'magic', role: 'arcanist', damage: { arcane: 100 }, action: 'Staff Bolt' }
  };
  const WEAPON_SIZES = { small: 'Small', medium: 'Medium', large: 'Large' };
  const DAMAGE_TYPES = { pierce: 'Pierce', cut: 'Cut', blunt: 'Blunt', arcane: 'Arcane' };
  const owns = (o, id) => Object.prototype.hasOwnProperty.call(o, id);
  function weapon(type, size, name, attack, price) {
    const def = WEAPON_TYPES[type];
    return { name, slot: 'weapon', type, family: def.family, role: def.role, size,
      hands: def.family === 'melee' ? size === 'medium' ? [1, 2] : [size === 'small' ? 1 : 2] : [type === 'wand' ? 1 : 2],
      damage: { ...def.damage }, attack, hp: 0, armor: 0, price };
  }
  const WEAPON_CATALOG = {};
  for (const [type, def] of Object.entries(WEAPON_TYPES)) {
    if (def.family === 'melee') {
      for (const [size, label] of Object.entries(WEAPON_SIZES)) {
        const [attack, price] = { small: [2, 55], medium: [3, 80], large: [6, 150] }[size];
        WEAPON_CATALOG[`${type}_${size}`] = weapon(type, size, `${label} ${def.name}`, attack, price);
      }
    } else {
      const [attack, price] = { crossbow: [4, 110], shortbow: [2, 55], longbow: [3, 80], wand: [2, 55], staff: [3, 80] }[type];
      WEAPON_CATALOG[type] = weapon(type, null, def.name, attack, price);
    }
  }
  // Retain purchased items and their exact bonuses from earlier campaigns.
  Object.assign(WEAPON_CATALOG, {
    steel_blade: weapon('sword', 'medium', 'Steel Longsword', 3, 80),
    rune_blade: weapon('sword', 'medium', 'Runebound Blade', 6, 220),
    hunting_bow: weapon('longbow', null, 'Yew Longbow', 3, 80),
    star_bow: weapon('longbow', null, 'Starfall Bow', 6, 220),
    ember_staff: weapon('staff', null, 'Emberwood Staff', 3, 80),
    sun_staff: weapon('staff', null, 'Sunfire Staff', 6, 220)
  });
  const STARTING_WEAPONS = {
    warden: weapon('sword', 'medium', 'Traveler’s Sword', 0, 0),
    ranger: weapon('shortbow', null, 'Scout’s Shortbow', 0, 0),
    arcanist: weapon('wand', null, 'Apprentice’s Wand', 0, 0)
  };
  const equippedWeapon = h => h.gear.weapon === null ? STARTING_WEAPONS[h.id] : WEAPON_CATALOG[h.gear.weapon];
  const validGrip = (item, grip) => !!item && item.hands.includes(grip);
  const gripBonus = (item, grip) => item.family === 'melee' && item.size === 'medium' && grip === 2 ? 2 : 0;
  const handRule = item => item.hands.length === 2 ? '1 or 2 hands' : `${item.hands[0]} ${item.hands[0] === 1 ? 'hand' : 'hands'} required`;
  // Largest remainders keep every component integral and their sum exact, even on tiny hits.
  function splitDamage(total, profile) {
    const entries = Object.entries(profile), weight = entries.reduce((sum, [, n]) => sum + n, 0);
    const parts = entries.map(([type, n], i) => ({ type, value: Math.floor(total * n / weight), fraction: total * n / weight % 1, i }));
    const remaining = total - parts.reduce((sum, p) => sum + p.value, 0);
    const order = [...parts].sort((a, b) => b.fraction - a.fraction || a.i - b.i);
    for (let i = 0; i < remaining; i++) order[i].value++;
    return Object.fromEntries(parts.map(p => [p.type, p.value]));
  }
  const damageText = parts => Object.entries(parts).map(([type, n]) => `${n} ${DAMAGE_TYPES[type]}`).join(' · ');
  function weaponAttack(h) {
    const item = equippedWeapon(h);
    return { item, grip: h.weaponGrip, total: h.attack, damage: splitDamage(h.attack, item.damage), action: WEAPON_TYPES[item.type].action };
  }
  function validWeaponLoadout(h) {
    if (!Array.isArray(h.weapons) || h.weapons.length > Object.keys(WEAPON_CATALOG).length || new Set(h.weapons).size !== h.weapons.length ||
        h.weapons.some(id => !owns(WEAPON_CATALOG, id) || WEAPON_CATALOG[id].role !== h.id)) return false;
    if (h.gear.weapon !== null && !h.weapons.includes(h.gear.weapon)) return false;
    return validGrip(equippedWeapon(h), h.weaponGrip);
  }
  const api = { WEAPON_TYPES, WEAPON_SIZES, DAMAGE_TYPES, WEAPON_CATALOG, STARTING_WEAPONS, equippedWeapon,
    validGrip, gripBonus, handRule, splitDamage, damageText, weaponAttack, validWeaponLoadout };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EmberWeapons = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
