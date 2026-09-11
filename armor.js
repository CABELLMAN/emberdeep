/* Orthogonal armor attributes and location/layer equipment slots. */
(function (root) {
  'use strict';
  const ARMOR_LOCATIONS = { head: 'Head', left_arm: 'Left arm', right_arm: 'Right arm', torso: 'Torso', left_leg: 'Left leg', right_leg: 'Right leg' };
  const ARMOR_LAYERS = { flexible: 'Flexible (inner)', mail: 'Mail (middle)', plate: 'Plate (outer)' };
  const ARMOR_TIERS = { 1: 'Serviceable', 2: 'Sturdy', 3: 'Refined', 4: 'Masterwork', 5: 'Legendary' };
  const ARMOR_WEIGHTS = { light: 'Light', medium: 'Medium', heavy: 'Heavy' };
  const ARMOR_CLASSES = { warden: 'Warden', ranger: 'Ranger', arcanist: 'Arcanist', all: 'All classes' };
  const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  function validArmorAttributes(a) {
    return !!a && owns(ARMOR_LOCATIONS, a.location) && owns(ARMOR_LAYERS, a.layer) &&
      Number.isInteger(a.tier) && a.tier >= 1 && a.tier <= 5 && owns(ARMOR_WEIGHTS, a.weight) && owns(ARMOR_CLASSES, a.class);
  }
  function armorItemId(a) {
    return validArmorAttributes(a) ? `armor_${a.location}_${a.layer}_${a.tier}_${a.weight}_${a.class}` : null;
  }
  const ARMOR_CATALOG = {};
  const names = {
    flexible: { head: 'Hood', torso: 'Vest', arm: 'Sleeve', leg: 'Legwrap' },
    mail: { head: 'Coif', torso: 'Hauberk', arm: 'Mail Sleeve', leg: 'Chausses' },
    plate: { head: 'Helm', torso: 'Cuirass', arm: 'Vambrace', leg: 'Greave' }
  };
  // The full Cartesian product is intentional: layer, weight, tier, and class never exclude one another.
  for (const location of Object.keys(ARMOR_LOCATIONS)) for (const layer of Object.keys(ARMOR_LAYERS))
    for (let tier = 1; tier <= 5; tier++) for (const weight of Object.keys(ARMOR_WEIGHTS)) for (const classId of Object.keys(ARMOR_CLASSES)) {
      const attributes = { location, layer, tier, weight, class: classId };
      const layerRank = ['flexible', 'mail', 'plate'].indexOf(layer), weightRank = ['light', 'medium', 'heavy'].indexOf(weight) + 1;
      const part = location.includes('arm') ? 'arm' : location.includes('leg') ? 'leg' : location;
      const side = location.startsWith('left_') ? 'Left ' : location.startsWith('right_') ? 'Right ' : '';
      ARMOR_CATALOG[armorItemId(attributes)] = {
        name: `${ARMOR_TIERS[tier]} ${classId === 'all' ? 'Traveler' : ARMOR_CLASSES[classId]} ${side}${names[layer][part]}`,
        slot: 'armor', ...attributes, attack: 0,
        armor: tier + layerRank + (weight === 'heavy' ? 1 : 0),
        hp: tier * 2 + weightRank + (location === 'torso' ? 2 : 0),
        price: 20 + tier * tier * 25 + layerRank * 20 + weightRank * 10 + (location === 'torso' ? 20 : 0)
      };
    }
  // Old purchases retain their original names, prices, and bonuses during migration.
  Object.assign(ARMOR_CATALOG, {
    leather: { name: 'Trail Leathers', slot: 'armor', location: 'torso', layer: 'flexible', tier: 1, weight: 'light', class: 'all', attack: 0, hp: 6, armor: 1, price: 65, legacy: true },
    mail: { name: 'Warded Mail', slot: 'armor', location: 'torso', layer: 'mail', tier: 2, weight: 'medium', class: 'all', attack: 0, hp: 12, armor: 2, price: 160, legacy: true },
    plate: { name: 'Emberguard Armor', slot: 'armor', location: 'torso', layer: 'plate', tier: 3, weight: 'heavy', class: 'all', attack: 0, hp: 18, armor: 3, price: 300, legacy: true }
  });
  function emptyArmorSlots() {
    return Object.fromEntries(Object.keys(ARMOR_LOCATIONS).map(location => [location,
      Object.fromEntries(Object.keys(ARMOR_LAYERS).map(layer => [layer, null]))]));
  }
  function equippedArmor(h) {
    return Object.values(h.gear.armor).flatMap(layers => Object.values(layers)).filter(Boolean).map(id => ARMOR_CATALOG[id]);
  }
  function armorFits(h, item) { return !!item && item.slot === 'armor' && (item.class === 'all' || item.class === h.id); }
  function validArmorLoadout(h) {
    if (!h.gear.armor || typeof h.gear.armor !== 'object' || Array.isArray(h.gear.armor) ||
        Object.keys(h.gear.armor).length !== 6 || !Array.isArray(h.armory) || h.armory.length > Object.keys(ARMOR_CATALOG).length ||
        new Set(h.armory).size !== h.armory.length || h.armory.some(id => typeof id !== 'string' || !owns(ARMOR_CATALOG, id) || !armorFits(h, ARMOR_CATALOG[id]))) return false;
    for (const location of Object.keys(ARMOR_LOCATIONS)) {
      const layers = h.gear.armor[location];
      if (!layers || typeof layers !== 'object' || Array.isArray(layers) || Object.keys(layers).length !== 3) return false;
      for (const layer of Object.keys(ARMOR_LAYERS)) {
        const id = layers[layer];
        if (id === null) continue;
        if (typeof id !== 'string' || !h.armory.includes(id)) return false;
        const item = ARMOR_CATALOG[id];
        if (item.location !== location || item.layer !== layer) return false;
      }
    }
    return true;
  }
  const api = { ARMOR_LOCATIONS, ARMOR_LAYERS, ARMOR_TIERS, ARMOR_WEIGHTS, ARMOR_CLASSES, ARMOR_CATALOG,
    validArmorAttributes, armorItemId, emptyArmorSlots, equippedArmor, armorFits, validArmorLoadout };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EmberArmor = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
