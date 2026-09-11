/* The same spatial formation board is used for preparation and combat selection. */
(() => {
  'use strict';
  const E = window.EmberEngine;
  function board(g, selected, editing = false, healing = false) {
    return `<div class="formation-board"><p class="formation-facing">↑ TOWARD THE ENEMY</p><div class="formation-grid" aria-label="Three front positions, three second-line positions, and two flanks">${Object.entries(E.FORMATION_SLOTS).map(([slot, def]) => {
      const index = g.party.findIndex(h => h.uid === g.formation[slot]), h = g.party[index];
      const active = h && index === selected, inactive = !editing && (!h || h.hp <= 0 || g.phase === 'combat' && h.acted && !healing);
      return `<button class="formation-position formation-${slot} ${def.row} ${active ? 'selected' : ''} ${h?.hp === 0 ? 'fallen' : ''}" ${editing ? `data-formation-position="${slot}"` : `data-formation-hero="${index}"`} aria-label="${def.name}: ${h ? h.name + ', ' + h.hp + ' of ' + h.maxHp + ' health' : 'empty'}${editing ? '. Assign selected hero here; occupied positions swap.' : ''}" aria-pressed="${!!active}" ${inactive ? 'disabled' : ''}><small>${def.name}</small><strong>${h ? h.name : 'Empty'}</strong><span>${h ? editing ? `${h.role} · ${index + 1}` : `${h.hp} / ${h.maxHp} HP` : editing ? 'Place hero' : '—'}</span>${h && !editing ? `<span class="formation-turn">${h.hp <= 0 ? 'Fallen' : h.acted ? 'Action used' : 'Ready · ' + (index + 1)}</span>` : ''}</button>`;
    }).join('')}</div></div>`;
  }
  function town(g, selected) {
    const h = g.party[selected];
    return `<div class="town-panel-heading"><div><h3>Give everyone a place</h3><p>Select a hero in Your fellowship, then choose a formation position. Occupied positions swap; empty positions stay available for recruits.</p></div><span class="town-badge">${g.party.length} / ${E.MAX_PARTY} ACTIVE</span></div>
      <div class="formation-selected"><span>Placing <b>${h.name}</b> · ${E.FORMATION_SLOTS[E.heroPosition(g, h)].name}</span><button class="secondary-btn" data-bench="${selected}" ${g.party.length === 1 ? 'disabled' : ''}>Rest at the inn</button></div>
      ${board(g, selected, true)}
      <div class="formation-rules"><article><h4>Front line &amp; flanks</h4><p>These positions are exposed to enemy melee attacks. Living heroes here shield the second line. Empty or fallen positions provide no protection.</p></article><article><h4>Second line</h4><p>Bows, crossbows, magic, and spears work at full strength here. Other melee weapons deal 2 less damage (minimum 1). Enemy spells and attacks that hit everyone bypass the screen.</p></article></div>
      <div class="town-notice">Start with three adventurers and grow to eight. Add recruits from the inn, then arrange them here. Everyone gets one action per round. Formation and roster changes are made in town.</div>
      <button class="secondary-btn" data-town-tab="tavern">Visit the inn · ${g.reserves.length} in reserve</button>`;
  }
  window.EmberFormationUI = { board, town };
})();
