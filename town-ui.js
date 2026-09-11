/* Town views share the same campaign actions as the dungeon interface. */
(() => {
  'use strict';
  const E = window.EmberEngine;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const glyphs = { warden: '♜', ranger: '♞', arcanist: '♝' };
  let tab = 'tavern', difficulty = null, seed = '';
  const armorDraft = { location: 'torso', layer: 'flexible', tier: 1, weight: 'light', class: null };
  const armorOptions = { location: E.ARMOR_LOCATIONS, layer: E.ARMOR_LAYERS, tier: E.ARMOR_TIERS, weight: E.ARMOR_WEIGHTS, class: E.ARMOR_CLASSES };
  const armorSummary = h => `${E.equippedArmor(h).length} armor pieces equipped`;
  const disabled = condition => condition ? 'disabled' : '';
  const gearName = id => E.EQUIPMENT[id]?.name || 'Starting gear';
  const tabs = { tavern: 'The Lantern Inn', merchant: 'Treasure & supplies', forge: 'The forge', training: 'Training grounds' };
  function tavern(g, selected) {
    const owned = new Set([...g.party, ...g.reserves].map(h => h.uid));
    return `<div class="town-panel-heading"><div><h3>A seat by the fire</h3><p>Your fellowship rests and revives here for free. Three adventurers travel; the others keep a room at the inn.</p></div><span class="town-badge">${owned.size} / 6 RECRUITED</span></div>
      <div class="town-notice">Choose a hero in <b>Your fellowship</b> to select a party slot. New recruits wait in reserve until you assign them.</div>
      ${g.reserves.length ? `<h4 class="town-label">WAITING AT THE INN · REPLACE ${esc(g.party[selected].name.toUpperCase())}</h4><div class="town-card-grid">${g.reserves.map(h => `<article class="town-item"><span class="town-item-glyph">${glyphs[h.id]}</span><h4>${h.name}</h4><p>${h.role} · Level ${h.level}<br>${h.maxHp} HP · ${h.attack} ATK · ${h.armor} ARM</p><p class="item-detail">${gearName(h.gear.weapon)}<br>${armorSummary(h)}</p><button class="secondary-btn" data-swap="${h.uid}">Take ${esc(g.party[selected].name)}’s slot</button></article>`).join('')}</div>` : ''}
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
    const choice = { ...armorDraft, class: armorDraft.class || h.id };
    const id = E.armorItemId(choice), item = E.EQUIPMENT[id];
    const currentId = h.gear.armor[choice.location][choice.layer], current = E.EQUIPMENT[currentId];
    const owned = h.armory.includes(id), equipped = currentId === id, fits = E.armorFits(h, item);
    const detail = a => `Tier ${a.tier} ${E.ARMOR_TIERS[a.tier]} · ${E.ARMOR_WEIGHTS[a.weight]} · ${E.ARMOR_CLASSES[a.class]}`;
    const ownedHere = h.armory.filter(key => { const a = E.EQUIPMENT[key]; return a.location === choice.location && a.layer === choice.layer; });
    return `<div class="town-panel-heading"><div><h3>Arm ${esc(h.name)} for the descent</h3><p>Each location holds one piece in each layer. Choose every attribute independently, including weight and class suitability.</p></div><span class="town-badge">${h.role.toUpperCase()}</span></div>
      <div class="loadout"><span>⚔ ${gearName(h.gear.weapon)}</span><span>♜ ${armorSummary(h)}</span><strong>${h.attack} ATK · ${h.armor} ARM · ${h.maxHp} HP</strong></div>
      <div class="armor-table-wrap"><table class="armor-table"><caption>Equipped armor · select a location and layer to inspect or change it</caption><thead><tr><th scope="col">Location</th>${Object.values(E.ARMOR_LAYERS).map(label => `<th scope="col">${label}</th>`).join('')}</tr></thead><tbody>${Object.entries(E.ARMOR_LOCATIONS).map(([location, label]) => `<tr><th scope="row">${label}</th>${Object.keys(E.ARMOR_LAYERS).map(layer => {
        const slotItem = E.EQUIPMENT[h.gear.armor[location][layer]], active = choice.location === location && choice.layer === layer;
        return `<td><button class="armor-slot ${active ? 'active' : ''}" data-armor-location="${location}" data-armor-layer="${layer}" aria-pressed="${active}" aria-label="${label}, ${E.ARMOR_LAYERS[layer]}: ${slotItem ? esc(slotItem.name + ', ' + detail(slotItem)) : 'empty'}"><strong>${slotItem ? esc(slotItem.name) : 'Empty'}</strong>${slotItem ? `<small>T${slotItem.tier} · ${E.ARMOR_WEIGHTS[slotItem.weight]}<br>${E.ARMOR_CLASSES[slotItem.class]}</small>` : '<small>Browse armor</small>'}</button></td>`;
      }).join('')}</tr>`).join('')}</tbody></table></div>
      <section class="armor-workbench" aria-label="Choose armor attributes"><h4>Find your armor</h4><p>All combinations are available. A heavy Arcanist plate piece is as valid as a light Warden mail piece.</p>
      <div class="armor-filters">${Object.entries(armorOptions).map(([attribute, options]) => `<label for="armor-filter-${attribute}">${attribute === 'class' ? 'Class suitability' : attribute.charAt(0).toUpperCase() + attribute.slice(1)}<select id="armor-filter-${attribute}" data-armor-filter="${attribute}">${Object.entries(options).map(([value, label]) => `<option value="${value}" ${String(choice[attribute]) === value ? 'selected' : ''}>${attribute === 'tier' ? value + ' · ' : ''}${label}</option>`).join('')}</select></label>`).join('')}</div>
      <article class="armor-preview"><div><span class="town-label">FORGE OFFER</span><h4>${item.name}</h4><dl class="armor-attributes"><div><dt>Location</dt><dd>${E.ARMOR_LOCATIONS[item.location]}</dd></div><div><dt>Layer</dt><dd>${E.ARMOR_LAYERS[item.layer]}</dd></div><div><dt>Tier</dt><dd>${item.tier} · ${E.ARMOR_TIERS[item.tier]}</dd></div><div><dt>Weight</dt><dd>${E.ARMOR_WEIGHTS[item.weight]}</dd></div><div><dt>Class</dt><dd>${E.ARMOR_CLASSES[item.class]}</dd></div></dl><p class="armor-bonuses">+${item.armor} armor · +${item.hp} max HP</p><p class="armor-comparison">${current ? `Currently: ${esc(current.name)} (+${current.armor} armor, +${current.hp} HP).` : 'This location and layer are empty.'} Other locations and layers stay equipped.</p></div><div class="armor-purchase"><button class="primary-btn" ${owned ? `data-owned-equip="${id}"` : `data-buy-gear="${id}"`} ${disabled(!fits || equipped || !owned && g.gold < item.price)}>${!fits ? `For ${E.ARMOR_CLASSES[item.class]}` : equipped ? 'Equipped ✓' : owned ? 'Equip owned piece' : `Buy & equip · ${item.price} gold`}</button><small>${!fits ? `Select a suitable hero to equip this piece.` : owned ? 'Already owned · no gold needed' : g.gold < item.price ? `Need ${item.price - g.gold} more gold` : 'Replaced armor stays in your collection.'}</small></div></article>
      <div class="owned-armor"><div class="owned-armor-heading"><h4>Owned for this slot</h4>${current ? `<button class="quiet-btn" data-unequip-location="${choice.location}" data-unequip-layer="${choice.layer}">Remove equipped piece</button>` : ''}</div>${ownedHere.length ? `<ul>${ownedHere.map(key => { const a = E.EQUIPMENT[key]; return `<li><span><strong>${a.name}</strong><small>${detail(a)} · +${a.armor} ARM · +${a.hp} HP</small></span><button class="secondary-btn" data-owned-equip="${key}" ${disabled(currentId === key)}>${currentId === key ? 'Equipped ✓' : 'Equip'}</button></li>`; }).join('')}</ul>` : '<p>No owned pieces for this location and layer yet.</p>'}</div>
      <div class="town-notice">Armor bonuses from equipped pieces add together. Weight describes the piece’s build; it does not restrict character classes or layers. Town is the place to change equipment.</div></section>
      <h4 class="town-label">WEAPONS FOR ${h.name.toUpperCase()}</h4><div class="town-card-grid gear-grid">${Object.entries(E.EQUIPMENT).filter(([, a]) => a.slot === 'weapon' && a.role === h.id).map(([key, a]) => {
        const previous = E.EQUIPMENT[h.gear.weapon], wearing = h.gear.weapon === key, inferior = previous && previous.price >= a.price;
        return `<article class="town-item"><span class="town-label">WEAPON</span><h4>${a.name}</h4><p class="gear-bonus">+${a.attack} attack</p><p class="item-detail">Strengthens basic attacks and damaging abilities. Replaces the current weapon.</p><button class="secondary-btn" data-buy-gear="${key}" ${disabled(inferior || g.gold < a.price)}>${wearing ? 'Equipped ✓' : inferior ? 'Better gear equipped' : `Equip · ${a.price} gold`}</button></article>`;
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
    setArmorAttribute(attribute, value) {
      if (!Object.prototype.hasOwnProperty.call(armorOptions, attribute) || !Object.prototype.hasOwnProperty.call(armorOptions[attribute], value)) return false;
      armorDraft[attribute] = attribute === 'tier' ? Number(value) : value;
      return true;
    },
    options(g) { return { difficulty: difficulty || g.difficulty, seed }; },
    resetDraft() { difficulty = null; seed = ''; }
  };
})();
