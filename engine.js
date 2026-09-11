(function (root) {
  'use strict';
  const C = typeof module !== 'undefined' && module.exports ? require('./campaign.js') : root.EmberCampaign;
  const W = 39, H = 27, FLOORS = ['The Sunken Halls', 'The Hollow Sanctum', 'The Ember Throne'];
  const DIRS = [[0,-1],[1,0],[0,1],[-1,0]];
  function hash(text) { let n = 2166136261; for (const c of String(text)) { n ^= c.charCodeAt(0); n = Math.imul(n,16777619); } return n >>> 0; }
  function random(seed) { let n = hash(seed); return () => { n += 0x6D2B79F5; let t = Math.imul(n ^ n >>> 15, 1 | n); t ^= t + Math.imul(t ^ t >>> 7,61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const key = (x,y) => `${x},${y}`;
  function distances(map, start) { const found = new Map([[key(start.x,start.y),0]]), queue = [start]; for (let i=0;i<queue.length;i++) { const p=queue[i]; for (const [dx,dy] of DIRS) { const x=p.x+dx,y=p.y+dy,k=key(x,y); if (map.tiles[y]?.[x]===1 && !found.has(k)) { found.set(k,found.get(key(p.x,p.y))+1); queue.push({x,y}); } } } return found; }
  function generate(seed, floor) {
    const rng=random(`${seed}/floor/${floor}`), roll=(a,b)=>a+Math.floor(rng()*(b-a+1));
    const tiles=Array.from({length:H},()=>Array(W).fill(0)), rooms=[];
    // Nine cells guarantee enough separate rooms; an orthogonal tree guarantees connectivity.
    for(let gy=0;gy<3;gy++) for(let gx=0;gx<3;gx++) { const w=roll(5,9),h=roll(4,6),x=gx*13+roll(1,12-w),y=gy*9+roll(1,8-h); const r={x,y,w,h,cx:x+Math.floor(w/2),cy:y+Math.floor(h/2)}; rooms.push(r); for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)tiles[yy][xx]=1; }
    function connect(a,b) { let x=a.cx,y=a.cy; const horizontal=()=>{while(x!==b.cx){tiles[y][x]=1;x+=Math.sign(b.cx-x);}tiles[y][x]=1;}; const vertical=()=>{while(y!==b.cy){tiles[y][x]=1;y+=Math.sign(b.cy-y);}tiles[y][x]=1;}; if(rng()<.5){horizontal();vertical();}else{vertical();horizontal();} }
    for(let i=1;i<rooms.length;i++) { const gx=i%3,gy=Math.floor(i/3); connect(rooms[i],rooms[gx&&gy?(rng()<.5?i-1:i-3):gx?i-1:i-3]); }
    connect(rooms[1],rooms[4]);connect(rooms[4],rooms[5]);
    const start={x:rooms[0].cx,y:rooms[0].cy};
    const map={width:W,height:H,tiles,rooms,start,entities:[],seen:[],visible:[]};
    const dist=distances(map,start), sorted=rooms.slice(1).sort((a,b)=>dist.get(key(b.cx,b.cy))-dist.get(key(a.cx,a.cy)));
    const end=sorted[0], used=new Set([key(start.x,start.y)]);
    function place(type,r,data={}) { const spots=[]; for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++)if(!used.has(key(x,y)))spots.push({x,y}); const p=spots[roll(0,spots.length-1)];used.add(key(p.x,p.y));map.entities.push({id:`${type}-${map.entities.length}`,type,...p,...data}); }
    if(floor<3)place('stairs',end);else place('boss',end,{kind:'warden'});
    place('chest',rooms[2]);place('chest',rooms[6]);place('shrine',rooms[4]);
    const count=floor===1?4:floor===2?5:3;
    const eligible=rooms.slice(1).filter(r=>floor<3||r!==end);
    for(let i=0;i<count;i++)place('enemy',eligible[(i*3)%eligible.length],{kind:floor===1?(i%2?'raiders':'rats'):floor===2?(i%2?'hexers':'guards'):'guards'});
    return map;
  }
  function log(g,text,type='info') { g.log.push({text,type,turn:g.turn}); if(g.log.length>65)g.log.shift();g.message=text; }
  function reveal(g) { const seen=new Set(g.map.seen),visible=new Set(); const {x:px,y:py}=g.pos; for(let y=py-6;y<=py+6;y++)for(let x=px-6;x<=px+6;x++){if(y<0||x<0||y>=H||x>=W||Math.hypot(x-px,y-py)>6.5)continue;let ax=px,ay=py,dx=Math.abs(x-px),sx=px<x?1:-1,dy=-Math.abs(y-py),sy=py<y?1:-1,err=dx+dy;while(true){visible.add(key(ax,ay));seen.add(key(ax,ay));if(ax===x&&ay===y||g.map.tiles[ay]?.[ax]!==1)break;const e=2*err;if(e>=dy){err+=dy;ax+=sx;}if(e<=dx){err+=dx;ay+=sy;}}}g.map.seen=[...seen];g.map.visible=[...visible]; }
  function createGame(seed='EMBER-'+Math.floor(Math.random()*99999)) {
    seed=String(seed).trim().slice(0,40)||'EMBER';
    const g=C.newState(seed,generate(seed,1));
    reveal(g);
    log(g,'Welcome to Hearthglen. Spend your 100 gold, gather a fellowship, and choose your first descent.');
    return g;
  }
  function enemy(type,i,floor) { const defs={rat:['Cinder Rat',13,4,0,'rat'],raider:['Hollow Raider',21,6,0,'sword'],guard:['Bone Sentinel',29,6,2,'shield'],hexer:['Ash Hexer',22,7,0,'spark'],boss:['The Ash Warden',100,10,1,'crown']}; const [name,hp,attack,armor,icon]=defs[type];return {id:`foe-${i}`,type,name,hp:hp+(type==='boss'?0:(floor-1)*3),maxHp:hp+(type==='boss'?0:(floor-1)*3),attack,armor,icon,marked:0,intent:null}; }
  function setIntents(g) { const alive=g.party.map((h,i)=>h.hp>0?i:-1).filter(i=>i>=0); const rng=random(`${g.seed}/${g.floor}/${g.turn}/${g.combat.round}`);for(const e of g.combat.enemies){ const target=alive[Math.floor(rng()*alive.length)]; let type='strike',damage=e.attack;if(e.type==='boss'){const cycle=(g.combat.round-1)%3;if(cycle===1){type='charge';damage=0;}if(cycle===2){type='all';damage=e.areaDamage;}}else if(e.type==='hexer'&&g.combat.round%2===0){type='all';damage=e.areaDamage;}e.intent={type,damage,target};} }
  function beginCombat(g,entity) {
    const types=entity.type==='boss'?['boss','guard']:entity.kind==='rats'?['rat','rat']:entity.kind==='raiders'?['raider','rat']:entity.kind==='hexers'?['hexer','guard']:['guard','raider'];
    const difficulty=C.DIFFICULTIES[g.difficulty];
    const enemies=types.map((type,i)=>{
      const e=enemy(type,i,g.floor);
      e.hp=e.maxHp=Math.max(1,Math.round(e.hp*difficulty.hp));
      e.attack=Math.max(1,Math.round(e.attack*difficulty.damage));
      e.areaDamage=Math.round((type==='boss'?9:type==='hexer'?4:0)*difficulty.damage);
      return e;
    });
    g.phase='combat';g.combat={entityId:entity.id,boss:entity.type==='boss',round:1,guard:false,enemies};
    g.party.forEach(h=>{h.acted=false;h.cooldown=0;});setIntents(g);
    log(g,entity.type==='boss'?'The Ash Warden rises. Bring the Emberheart home.':'An enemy blocks your path. Choose a hero and an action.','combat');
  }
  function entityAt(g,x=g.pos.x,y=g.pos.y){return g.map.entities.find(e=>e.x===x&&e.y===y);}
  function move(g,dx,dy) { if(g.phase!=='explore'||Math.abs(dx)+Math.abs(dy)!==1)return false;const x=g.pos.x+dx,y=g.pos.y+dy;if(g.map.tiles[y]?.[x]!==1)return false;g.pos={x,y};g.turn++;reveal(g);const e=entityAt(g);if(e?.type==='enemy'||e?.type==='boss')beginCombat(g,e);else if(e?.type==='chest'){g.potions++;g.gold+=Math.round((20+g.floor*5)*C.DIFFICULTIES[g.difficulty].reward);const treasureId=['silver','sapphire','idol'][g.floor-1];const quantity=C.addTreasure(g,treasureId);g.map.entities=g.map.entities.filter(v=>v!==e);log(g,`A forgotten cache: +1 draught, gold, and ${quantity} ${C.TREASURES[treasureId].name}. Sell treasure in town.`,'loot');}else if(e?.type==='shrine')log(g,'A quiet shrine. Invoke it to heal and revive your party.');else if(e?.type==='stairs')log(g,'The stairwell leads deeper. Descend when you are ready.');return true; }
  function interact(g) {
    if(g.phase!=='explore')return false;
    const e=entityAt(g);
    if(e?.type==='shrine'){
      g.party.forEach(h=>{h.hp=Math.min(h.maxHp,h.hp+18);});
      g.map.entities=g.map.entities.filter(v=>v!==e);
      log(g,'The shrine rekindles every soul. All heroes recover 18 health.','heal');g.turn++;return true;
    }
    if(e?.type==='stairs'){
      g.floor++;
      g.party.forEach(h=>{h.depthBonus++;C.sync(h);h.hp=Math.min(h.maxHp,h.hp+12);h.cooldown=0;});
      g.map=generate(g.seed,g.floor);g.pos={...g.map.start};g.turn++;reveal(g);
      log(g,`You enter ${FLOORS[g.floor-1]}. +5 health capacity and +1 attack for this expedition; recover 12 health.`,'loot');return true;
    }
    return false;
  }
  function hurt(g,e,amount,profile) {
    let bonus=0;if(e.marked>0){e.marked--;bonus=3;}
    // Armor is a flat reduction applied once to the entire hit, before distributing damage.
    const damage=Math.max(1,amount+bonus-e.armor), parts=C.splitDamage(damage,profile);
    e.hp=Math.max(0,e.hp-damage);
    log(g,`${e.name} takes ${damage} damage (${C.damageText(parts)})${e.hp===0?' and falls':''}.`,'damage');
  }
  function checkVictory(g) {
    if(g.combat.enemies.some(e=>e.hp>0))return false;
    const boss=g.combat.boss,count=g.combat.enemies.length,multiplier=C.DIFFICULTIES[g.difficulty].reward;
    const gold=Math.round(15*count*multiplier),xp=Math.round(10*count*multiplier);
    g.kills+=count;g.gold+=gold;g.xp+=xp;
    g.map.entities=g.map.entities.filter(e=>e.id!==g.combat.entityId);
    g.party.forEach(h=>{if(h.hp>0)h.hp=Math.min(h.maxHp,h.hp+4);h.acted=false;});
    if(boss){g.victories++;C.addTreasure(g,'emberheart');}
    g.phase=boss?'won':'explore';g.combat=null;
    log(g,`${boss?'The Warden falls! Return to town with the Emberheart shard.':'The chamber is yours. Living heroes recover 4 health.'} +${gold} gold, +${xp} training XP.`,'loot');return true;
  }
  function enemyTurn(g) { for(const e of g.combat.enemies.filter(e=>e.hp>0)){const intent=e.intent;if(intent.type==='charge'){log(g,`${e.name} gathers embers. A devastating attack is coming.`,'combat');continue;}let targets=intent.type==='all'?g.party.filter(h=>h.hp>0):[g.party[intent.target]?.hp>0?g.party[intent.target]:g.party.find(h=>h.hp>0)].filter(Boolean);for(const h of targets){const armored=Math.max(1,intent.damage-h.armor);const damage=g.combat.guard?Math.ceil(armored/2):armored;h.hp=Math.max(0,h.hp-damage);log(g,`${e.name} hits ${h.name} for ${damage}${h.hp===0?' — fallen':''}.`,'danger');}if(g.party.every(h=>h.hp<=0)){g.phase='lost';log(g,'The torch goes dark. Your expedition has ended.','danger');return;}}g.combat.round++;g.combat.guard=false;g.party.forEach(h=>{h.acted=false;h.cooldown=Math.max(0,h.cooldown-1);});setIntents(g); }
  function act(g,heroIndex,action,targetIndex=0) { if(!Number.isInteger(heroIndex))return false;const h=g.party[heroIndex];if(!h||h.hp<=0||!['attack','special','potion','guard'].includes(action))return false;
    if(g.phase==='explore'){if(action!=='potion')return false;const target=g.party[targetIndex];if(!target||target.hp<=0||target.hp===target.maxHp||g.potions<=0)return false;g.potions--;target.hp=Math.min(target.maxHp,target.hp+18);g.turn++;log(g,`${target.name} drinks a draught and recovers 18 health.`,'heal');return true;}
    if(g.phase!=='combat'||h.acted)return false;const c=g.combat,e=c.enemies[targetIndex];
    if(action==='attack'&&(!e||e.hp<=0))return false;
    if(action==='special'&&(h.cooldown>0||h.id==='ranger'&&(!e||e.hp<=0)))return false;
    if(action==='potion'){const target=g.party[targetIndex];if(!target||target.hp<=0||target.hp===target.maxHp||g.potions<=0)return false;g.potions--;target.hp=Math.min(target.maxHp,target.hp+18);log(g,`${h.name} restores 18 health to ${target.name}.`,'heal');}
    if(action==='attack')hurt(g,e,h.attack,C.equippedWeapon(h).damage);
    if(action==='special'){h.cooldown=2;if(h.id==='warden'){c.guard=true;log(g,`${h.name} raises Bulwark. All incoming damage is halved this round.`,'heal');}else if(h.id==='ranger'){hurt(g,e,h.attack-2,C.equippedWeapon(h).damage);if(e.hp>0)e.marked=2;log(g,`${h.name} marks the quarry. The next two hits gain +3 damage.`,'combat');}else {log(g,`${h.name} unleashes an Ember Wave.`,'combat');c.enemies.filter(v=>v.hp>0).forEach(v=>hurt(g,v,h.attack+1,{arcane:100}));}}
    if(action==='guard'){log(g,`${h.name} holds their action.`);}
    h.acted=true;g.turn++;if(checkVictory(g))return true;if(g.party.every(v=>v.hp<=0||v.acted))enemyTurn(g);return true;
  }
  function endRound(g){if(g.phase!=='combat')return false;g.party.forEach(h=>h.acted=true);g.turn++;enemyTurn(g);return true;}
  function pathTo(g,x,y) { const seen=new Set(g.map.seen);if(!seen.has(key(x,y))||g.map.tiles[y]?.[x]!==1)return [];const queue=[g.pos],prev=new Map([[key(g.pos.x,g.pos.y),null]]);for(let i=0;i<queue.length;i++){const p=queue[i];if(p.x===x&&p.y===y)break;for(const [dx,dy] of DIRS){const nx=p.x+dx,ny=p.y+dy,k=key(nx,ny);if(g.map.tiles[ny]?.[nx]===1&&seen.has(k)&&!prev.has(k)){prev.set(k,p);queue.push({x:nx,y:ny});}}}let p={x,y},path=[];if(!prev.has(key(x,y)))return [];while(prev.get(key(p.x,p.y))){path.unshift(p);p=prev.get(key(p.x,p.y));}return path; }
  function validateSave(g) {
    try {
      const num=(v,max=1000000)=>Number.isFinite(v)&&v>=0&&v<=max;
      if(g?.version!==4||typeof g.seed!=='string'||g.seed.length>40||!Number.isInteger(g.floor)||g.floor<1||g.floor>3||!['town','explore','combat','won','lost'].includes(g.phase)||!Number.isInteger(g.turn)||!num(g.turn))return false;
      if(!Array.isArray(g.party)||g.party.length!==3||!C.validateCampaign(g))return false;
      const allDead=g.party.every(h=>h.hp===0);
      if((g.phase==='lost')!==allDead||g.phase==='won'&&g.floor!==3)return false;
      if(!Number.isInteger(g.potions)||!num(g.potions)||!Number.isInteger(g.gold)||!num(g.gold)||!Number.isInteger(g.kills)||!num(g.kills)||!Number.isInteger(g.xp)||!num(g.xp))return false;
      const m=g.map;
      if(m.width!==W||m.height!==H||m.tiles.length!==H||m.tiles.some(row=>row.length!==W||row.some(t=>t!==0&&t!==1))||!Number.isInteger(g.pos.x)||!Number.isInteger(g.pos.y)||m.tiles[g.pos.y]?.[g.pos.x]!==1)return false;
      if(!Array.isArray(m.entities)||m.entities.some(e=>!['stairs','chest','shrine','enemy','boss'].includes(e.type)||m.tiles[e.y]?.[e.x]!==1||typeof e.id!=='string')||!Array.isArray(m.seen)||!Array.isArray(m.visible)||!Array.isArray(g.log)||g.log.some(l=>typeof l.text!=='string'||!num(l.turn)))return false;
      if(!['won','town'].includes(g.phase)&&m.entities.filter(e=>e.type===(g.floor<3?'stairs':'boss')).length!==1)return false;
      if(new Set(m.entities.map(e=>key(e.x,e.y))).size!==m.entities.length)return false;
      if(g.phase==='combat'||g.phase==='lost'){
        const c=g.combat;
        if(!c||typeof c.guard!=='boolean'||typeof c.boss!=='boolean'||typeof c.entityId!=='string'||!Number.isInteger(c.round)||c.round<1||!Array.isArray(c.enemies)||c.enemies.length<1||c.enemies.length>3)return false;
        if(!m.entities.some(e=>e.id===c.entityId&&e.x===g.pos.x&&e.y===g.pos.y&&e.type===(c.boss?'boss':'enemy')))return false;
        if(c.enemies.some(e=>!['rat','raider','guard','hexer','boss'].includes(e.type)||typeof e.name!=='string'||!num(e.hp,1000)||!num(e.maxHp,1000)||e.maxHp<1||e.hp>e.maxHp||!num(e.armor,1000)||!num(e.attack,1000)||!num(e.areaDamage,1000)||!Number.isInteger(e.marked)||!num(e.marked,2)||!e.intent||!['strike','charge','all'].includes(e.intent.type)||!num(e.intent.damage,1000)||!Number.isInteger(e.intent.target)||e.intent.target<0||e.intent.target>2))return false;
        if(g.phase==='combat'&&(!c.enemies.some(e=>e.hp>0)||g.party.every(h=>h.hp<=0||h.acted)))return false;
      } else if(g.combat!==null)return false;
      return true;
    } catch {return false;}
  }
  const api={...C,W,H,FLOORS,DIRS,key,random,generate,distances,createGame,move,interact,act,endRound,pathTo,entityAt,reveal,validateSave,
    depart:(g,options)=>C.depart(g,options,{generate,reveal})};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.EmberEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this);
