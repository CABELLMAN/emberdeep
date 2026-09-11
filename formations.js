/* Eight stable formation positions; party order remains the action/shortcut order. */
(function (root) {
  'use strict';
  const W = typeof module !== 'undefined' && module.exports ? require('./weapons.js') : root.EmberWeapons;
  const FORMATION_SLOTS = {
    front_left: { name: 'Front left', row: 'front', column: 2 },
    front_center: { name: 'Front center', row: 'front', column: 3 },
    front_right: { name: 'Front right', row: 'front', column: 4 },
    rear_left: { name: 'Second line left', row: 'rear', column: 2 },
    rear_center: { name: 'Second line center', row: 'rear', column: 3 },
    rear_right: { name: 'Second line right', row: 'rear', column: 4 },
    flank_left: { name: 'Left flank', row: 'flank', column: 1 },
    flank_right: { name: 'Right flank', row: 'flank', column: 5 }
  };
  const MAX_PARTY = Object.keys(FORMATION_SLOTS).length;
  const defaultFormation = party => Object.fromEntries(Object.keys(FORMATION_SLOTS).map((slot, i) => [slot, party[i]?.uid || null]));
  const heroPosition = (g, hero) => Object.keys(FORMATION_SLOTS).find(slot => g.formation[slot] === hero.uid);
  function validFormation(g) {
    if (!g.formation || typeof g.formation !== 'object' || Array.isArray(g.formation) || Object.keys(g.formation).length !== MAX_PARTY ||
        Object.keys(FORMATION_SLOTS).some(slot => !Object.hasOwn(g.formation, slot))) return false;
    const assigned = Object.values(g.formation).filter(uid => uid !== null);
    return assigned.length === g.party.length && new Set(assigned).size === assigned.length &&
      assigned.every(uid => typeof uid === 'string' && g.party.some(h => h.uid === uid));
  }
  function formationTargets(g, enemy) {
    const living = g.party.map((h, i) => h.hp > 0 ? i : -1).filter(i => i >= 0);
    if (enemy.type === 'hexer') return living;
    const exposed = living.filter(i => FORMATION_SLOTS[heroPosition(g, g.party[i])].row !== 'rear');
    return exposed.length ? exposed : living;
  }
  function intentTarget(g, enemy) {
    const eligible = formationTargets(g, enemy);
    return eligible.includes(enemy.intent.target) ? enemy.intent.target : eligible[0];
  }
  function combatAttack(g, hero) {
    const attack = W.weaponAttack(hero), position = FORMATION_SLOTS[heroPosition(g, hero)];
    const modifier = position.row === 'rear' && attack.item.family === 'melee' && attack.item.type !== 'spear' ? -2 : 0;
    const total = Math.max(1, attack.total + modifier);
    return { ...attack, total, damage: W.splitDamage(total, attack.item.damage), modifier, position: position.name };
  }
  const api = { FORMATION_SLOTS, MAX_PARTY, defaultFormation, heroPosition, validFormation, formationTargets, intentTarget, combatAttack };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EmberFormations = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
