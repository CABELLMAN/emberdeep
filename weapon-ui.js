/* Town weapon collection and grip controls. */
(() => {
  'use strict';
  const E = window.EmberEngine;
  let filter = 'all';
  const disabled = value => value ? 'disabled' : '';
  const describe = item => `${E.WEAPON_TYPES[item.type].name}${item.size ? ' · ' + E.WEAPON_SIZES[item.size] : ''} · ${E.handRule(item)}`;
  function damageDisplay(parts) {
    return `<dl class="weapon-damage">${Object.entries(parts).map(([type, value]) => `<div class="damage-${type}"><dt>${E.DAMAGE_TYPES[type]}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
  }
  function mix(item) {
    if (item.type === 'sword') return 'Balanced: equal Pierce, Cut, and Blunt shares (rounded to whole damage).';
    const total = Object.values(item.damage).reduce((n, value) => n + value, 0);
    return Object.entries(item.damage).map(([type, n]) => `${Math.round(100 * n / total)}% ${E.DAMAGE_TYPES[type]}`).join(' · ');
  }
  function render(g, selected) {
    const h = g.party[selected], current = E.equippedWeapon(h), attack = E.weaponAttack(h);
    const types = Object.entries(E.WEAPON_TYPES).filter(([, type]) => type.role === h.id);
    const choice = types.some(([type]) => type === filter) ? filter : 'all';
    const offers = Object.entries(E.WEAPON_CATALOG).filter(([, item]) => item.role === h.id && (choice === 'all' || item.type === choice));
    const owned = [[null, E.STARTING_WEAPONS[h.id]], ...h.weapons.map(id => [id, E.WEAPON_CATALOG[id]])];
    return `<div class="town-panel-heading"><div><h3>Choose ${h.name}’s weapon</h3><p>Wardens wield melee weapons, Rangers use bows and crossbows, and Arcanists channel wands and staffs. Select a hero to browse their equipment.</p></div><span class="town-badge">${h.role.toUpperCase()}</span></div>
      <section class="weapon-loadout" aria-label="Current weapon and grip"><div><span class="town-label">EQUIPPED WEAPON</span><h4>${current.name}</h4><p>${describe(current)}</p>${damageDisplay(attack.damage)}<p class="item-detail">${h.attack} total damage before enemy armor · ${mix(current)}</p></div>
      <div class="weapon-hands"><div class="hand-slots"><span><small>MAIN HAND</small><strong>${current.name}</strong></span><span><small>OFF HAND</small><strong>${h.weaponGrip === 2 ? 'Same weapon' : 'Free'}</strong></span></div>
      <div class="grip-controls" role="group" aria-label="Equipped weapon grip">${[1, 2].map(grip => `<button class="secondary-btn ${h.weaponGrip === grip ? 'selected-grip' : ''}" data-weapon-grip="${grip}" aria-pressed="${h.weaponGrip === grip}" ${disabled(!E.validGrip(current, grip) || h.weaponGrip === grip)}>${grip === 1 ? 'One hand' : 'Two hands'}</button>`).join('')}</div><p class="item-detail">${current.hands.length === 2 ? 'Two hands adds +2 attack. Change your grip here before departing.' : `${E.handRule(current)}. This weapon has a fixed grip.`}</p></div></section>
      <div class="town-notice">Small melee weapons use one hand. Large melee weapons require two. Medium melee weapons support either grip. Each hero equips one weapon at a time; a free hand is currently unused.</div>
      <section class="owned-armor owned-weapons" aria-label="Owned weapons"><h4>Your weapon collection</h4><ul>${owned.map(([id, item]) => `<li><span><strong>${item.name}</strong><small>${describe(item)} · +${item.attack} attack</small></span><button class="secondary-btn" data-owned-weapon="${id || 'starting'}" ${disabled(h.gear.weapon === id)}>${h.gear.weapon === id ? 'Equipped ✓' : 'Equip'}</button></li>`).join('')}</ul></section>
      <div class="weapon-shop-heading"><div><span class="town-label">THE WEAPONSMITH</span><h4>Find your next weapon</h4><p>Purchases equip immediately. Replaced weapons stay in this hero’s collection.</p></div><label for="weapon-type">Weapon type<select id="weapon-type" data-weapon-filter="type"><option value="all" ${choice === 'all' ? 'selected' : ''}>All ${current.family} weapons</option>${types.map(([type, def]) => `<option value="${type}" ${choice === type ? 'selected' : ''}>${def.name}</option>`).join('')}</select></label></div>
      <div class="town-card-grid weapon-grid">${offers.map(([id, item]) => {
        const total = h.baseAttack + h.level - 1 + h.depthBonus + item.attack;
        const wearing = h.gear.weapon === id, purchased = h.weapons.includes(id);
        return `<article class="town-item weapon-offer"><span class="town-label">${item.family.toUpperCase()}${item.size ? ' · ' + E.WEAPON_SIZES[item.size].toUpperCase() : ''}</span><h4>${item.name}</h4><p class="weapon-rule">${E.handRule(item)}</p>${damageDisplay(E.splitDamage(total, item.damage))}<p class="item-detail">${mix(item)}</p><p class="gear-bonus">+${item.attack} attack · ${total} total damage${item.hands.length === 2 ? '<small>Shown in one hand · +2 total in two hands</small>' : ''}</p><button class="secondary-btn" ${purchased ? `data-owned-weapon="${id}"` : `data-buy-gear="${id}"`} ${disabled(wearing || !purchased && g.gold < item.price)}>${wearing ? 'Equipped ✓' : purchased ? 'Equip owned weapon' : `Buy & equip · ${item.price} gold`}</button></article>`;
      }).join('')}</div><p class="item-detail weapon-note">Damage shares include the hero’s base attack, training, and resolve. Enemy armor reduces the total hit once; the combat log shows the resulting damage by type. Magic deals Arcane damage.</p>`;
  }
  window.EmberWeaponUI = { render, setFilter(value) { if (value !== 'all' && !Object.hasOwn(E.WEAPON_TYPES, value)) return false; filter = value; return true; } };
})();
