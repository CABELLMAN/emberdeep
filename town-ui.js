/* Town views share the same campaign actions as the dungeon interface. */
(() => {
  'use strict';
  const E = window.EmberEngine;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const glyphs = { warden: '♜', ranger: '♞', arcanist: '♝' };
  let tab = 'tavern', difficulty = null, seed = '';
  const disabled = condition => condition ? 'disabled' : '';
  const gearName = id => E.EQUIPMENT[id]?.name || 'Starting gear';
  const tabs = { tavern: 'The Lantern Inn', merchant: 'Treasure & supplies', forge: 'The forge', training: 'Training grounds' };
  function tavern(g, selected) {
    const owned = new Set([...g.party, ...g.reserves].map(h => h.uid));
    return `<div class="town-panel-heading"><div><h3>A seat by the fire</h3><p>Your fellowship rests and revives here for free. Three adventurers travel; the others keep a room at the inn.</p></div><span class="town-badge">${owned.size} / 6 RECRUITED</span></div>
      <div class="town-notice">Choose a hero in <b>Your fellowship</b> to select a party slot. New recruits wait in reserve until you assign them.</div>
      ${g.reserves.length ? `<h4 class="town-label">WAITING AT THE INN · REPLACE ${esc(g.party[selected].name.toUpperCase())}</h4><div class="town-card-grid">${g.reserves.map(h => `<article class="town-item"><span class="town-item-glyph">${glyphs[h.id]}</span><h4>${h.name}</h4><p>${h.role} · Level ${h.level}<br>${h.maxHp} HP · ${h.attack} ATK · ${h.armor} ARM</p><p class="item-detail">${gearName(h.gear.weapon)}<br>${gearName(h.gear.armor)}</p><button class="secondary-btn" data-swap="${h.uid}">Take ${esc(g.party[selected].name)}’s slot</button></article>`).join('')}</div>` : ''}
      <h4 class="town-label">LOOKING FOR A FELLOWSHIP</h4><div class="town-card-grid">${Object.entries(E.RECRUITS).map(([id, h]) => `<article class="town-item ${owned.has(id) ? 'recruited' : ''}"><span class="town-item-glyph">${glyphs[h.id]}</span><h4>${h.name} <small>${h.role}</small></h4><p>${h.description}</p><p class="item-detail">${h.baseHp} HP · ${h.baseAttack} ATK · Level 1</p><button class="secondary-btn" data-recruit="${id}" ${disabled(owned.has(id) || g.gold < h.price)}>${owned.has(id) ? 'Recruited ✓' : `Recruit · ${h.price} gold`}</button></article>`).join('')}</div>`;
  }
  function merchant(g) {
    const value = E.treasureValue(g);
    return `<div class="town-panel-heading"><div><h3>Something old. Something valuable.</h3><p>Turn dungeon finds into gold for equipment, recruits, and training.</p></div><button class="primary-btn" data-sell="all" ${disabled(!value)}>Sell all · ${value} gold</button></div>
      <div class="treasure-list">${Object.entries(E.TREASURES).map(([id, t]) => `<article class="treasure-row"><span class="town-item-glyph">${t.glyph}</span><div><h4>${t.name}</h4><p>${t.value} gold each · ${g.treasures[id]} carried</p></div><button class="secondary-btn" data-sell="${id}" ${disabled(!g.treasures[id])}>Sell stack · ${t.value * g.treasures[id]} gold</button></article>`).join('')}</div>
      <article class="supply-row"><div><h4>The apothecary’s shelf</h4><p>Healing draught · restores 18 HP to a living hero. ${g.potions} in your pack.</p></div><button class="secondary-btn" data-buy-potion ${disabled(g.gold < 20 || g.potions >= 99)}>Buy draught · 20 gold</button></article>`;
  }
  function forge(g, selected) {
    const h = g.party[selected];
    return `<div class="town-panel-heading"><div><h3>Arm ${esc(h.name)} for the descent</h3><p>Select a hero in your fellowship. Purchases equip immediately; an upgrade replaces the previous item.</p></div><span class="town-badge">${h.role.toUpperCase()}</span></div>
      <div class="loadout"><span>⚔ ${gearName(h.gear.weapon)}</span><span>♜ ${gearName(h.gear.armor)}</span><strong>${h.attack} ATK · ${h.armor} ARM · ${h.maxHp} HP</strong></div>
      <div class="town-card-grid gear-grid">${Object.entries(E.EQUIPMENT).filter(([, item]) => !item.role || item.role === h.id).map(([id, item]) => {
        const current = E.EQUIPMENT[h.gear[item.slot]], equipped = h.gear[item.slot] === id, inferior = current && current.price >= item.price;
        return `<article class="town-item"><span class="town-label">${item.slot.toUpperCase()}</span><h4>${item.name}</h4><p class="gear-bonus">${item.attack ? `+${item.attack} attack` : `+${item.armor} armor · +${item.hp} HP`}</p><p class="item-detail">${item.slot === 'armor' ? 'Armor reduces every incoming hit, before Bulwark.' : 'Strengthens basic attacks and damaging abilities.'}</p><button class="secondary-btn" data-buy-gear="${id}" ${disabled(inferior || g.gold < item.price)}>${equipped ? 'Equipped ✓' : inferior ? 'Better gear equipped' : `Equip · ${item.price} gold`}</button></article>`;
      }).join('')}</div>`;
  }
  function training(g) {
    return `<div class="town-panel-heading"><div><h3>Make experience count</h3><p>Spend shared training XP and gold to permanently strengthen a hero. Reserve heroes can train after joining the active party.</p></div><span class="town-badge">${g.xp} XP AVAILABLE</span></div>
      <div class="town-card-grid">${g.party.map((h, i) => {
        const cost = E.trainingCost(h), max = h.level >= 10;
        return `<article class="town-item training-card"><span class="town-item-glyph">${glyphs[h.id]}</span><h4>${h.name}</h4><p>${h.role} · Level ${h.level}${max ? ' · MAX' : ` → ${h.level + 1}`}</p><p class="gear-bonus">+5 max health<br>+1 attack</p><p class="item-detail">${max ? 'Fully trained.' : `${cost.xp} shared XP + ${cost.gold} gold`}</p><button class="secondary-btn" data-train="${i}" ${disabled(max || g.gold < cost.gold || g.xp < cost.xp)}>${max ? 'Master adventurer' : 'Train to level ' + (h.level + 1)}</button></article>`;
      }).join('')}</div><div class="town-notice">Training levels persist between dungeons. The resolve bonuses gained while descending last for that expedition only.</div>`;
  }
  function departure(g) {
    const choice = difficulty || g.difficulty, d = E.DIFFICULTIES[choice];
    return `<section class="departure-board"><div class="town-panel-heading"><div><span class="eyebrow">THE EXPEDITION BOARD</span><h3>Choose your next descent</h3><p>Three procedural floors. One final guardian. Your fellowship carries its gear and training.</p></div></div>
      <form id="depart-form"><fieldset class="difficulty-options"><legend>Dungeon difficulty</legend>${Object.entries(E.DIFFICULTIES).map(([id, option]) => `<label class="difficulty-option ${id === choice ? 'chosen' : ''}"><input type="radio" name="difficulty" value="${id}" ${id === choice ? 'checked' : ''}><strong>${option.name}</strong><small>${Math.round(option.reward * 100)}% rewards</small></label>`).join('')}</fieldset>
      <p class="difficulty-description">${d.description}<br><b>${Math.round(d.hp * 100)}% enemy HP · ${Math.round(d.damage * 100)}% enemy damage · ${Math.round(d.reward * 100)}% gold and XP</b><span>Treasure quantities scale with difficulty, rounded to whole items. Difficulty stays fixed for the entire dungeon.</span></p>
      <div class="departure-bottom"><label for="dungeon-seed">Dungeon seed <span>optional</span><input id="dungeon-seed" name="seed" maxlength="40" placeholder="Random each expedition" value="${esc(seed)}" autocomplete="off"></label><button type="submit" class="primary-btn">Enter the dungeon →</button></div></form></section>`;
  }
  function render(g, selected) {
    const panel = tab === 'merchant' ? merchant(g) : tab === 'forge' ? forge(g, selected) : tab === 'training' ? training(g) : tavern(g, selected);
    document.getElementById('town').innerHTML = `<div class="town-welcome"><span class="town-seal" aria-hidden="true">♜</span><div><span class="eyebrow">HEARTHGLEN · A LIGHT ABOVE THE DARK</span><h2>Every adventurer needs a home.</h2><p>Rest, trade, and gather your fellowship for the road ahead.</p></div><span class="town-rested">● FULLY RESTED</span></div>
      <nav class="town-tabs" aria-label="Town services">${Object.entries(tabs).map(([id, name]) => `<button type="button" data-town-tab="${id}" aria-pressed="${id === tab}" class="${id === tab ? 'active' : ''}">${name}</button>`).join('')}</nav>
      <div class="town-panel" aria-label="${tabs[tab]}">${panel}</div>${departure(g)}`;
  }
  window.EmberTown = {
    render,
    setTab(value) { if (Object.prototype.hasOwnProperty.call(tabs, value)) tab = value; },
    setDifficulty(value) { if (Object.prototype.hasOwnProperty.call(E.DIFFICULTIES, value)) difficulty = value; },
    setSeed(value) { seed = String(value).slice(0, 40); },
    options(g) { return { difficulty: difficulty || g.difficulty, seed }; },
    resetDraft() { difficulty = null; seed = ''; }
  };
})();
