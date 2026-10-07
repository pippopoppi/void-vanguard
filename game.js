/* Void Vanguard — a tiny vertical space shooter. MIT licence. */
(() => {
'use strict';

// ---------- constants & balance ----------
const W = 400, H = 720;
const SAVE_KEY = 'voidvanguard.v1';
const SITE_URL = (location.origin + location.pathname).replace(/index\.html$/, '');
const TAU = 6.2832;

const SHIPS = {
  dart:    { name: 'Dart',    cost: 0,   hp: 3, speed: 1.0, rate: 0.16, spread: false, color: '#38bdf8', dark: '#0369a1', desc: 'Balanced starter.' },
  bulwark: { name: 'Bulwark', cost: 400, hp: 5, speed: 0.8, rate: 0.2,  spread: false, color: '#a3e635', dark: '#3f6212', desc: 'Slow and sturdy. Five hull points.' },
  phoenix: { name: 'Phoenix', cost: 900, hp: 3, speed: 1.1, rate: 0.14, spread: true,  color: '#fb923c', dark: '#9a3412', desc: 'Twin cannons from the start.' },
};
const UPGRADES = {
  dmg:  { name: 'Cannon power', desc: '+25% bullet damage per level',      base: 120, max: 5 },
  rate: { name: 'Fire rate',    desc: '+10% fire rate per level',          base: 140, max: 5 },
  hull: { name: 'Hull plating', desc: '+1 hull point per level',           base: 160, max: 3 },
  luck: { name: 'Salvage',      desc: '+4% power-up drop chance per level', base: 100, max: 5 },
};
const upCost = k => UPGRADES[k].base * (save.up[k] + 1);
const ENEMIES = {
  drone:    { hp: 2,  speed: 75,  r: 12, score: 10, color: '#f472b6', dark: '#9d174d' },
  fighter:  { hp: 4,  speed: 105, r: 13, score: 20, color: '#fb923c', dark: '#9a3412', shoot: 1.9 },
  tank:     { hp: 12, speed: 32,  r: 18, score: 50, color: '#a78bfa', dark: '#5b21b6', shoot: 2.4 },
  kamikaze: { hp: 2,  speed: 140, r: 11, score: 15, color: '#ef4444', dark: '#7f1d1d' },
  asteroid: { hp: 6,  speed: 55,  r: 20, score: 5,  color: '#9ca3af', dark: '#4b5563', rock: true },
  shard:    { hp: 2,  speed: 85,  r: 10, score: 3,  color: '#9ca3af', dark: '#4b5563', rock: true },
};
const POWERUPS = {
  spread: { name: 'Spread shot', color: '#fb923c', icon: 'S', dur: 12 },
  rapid:  { name: 'Rapid fire',  color: '#fde047', icon: 'R', dur: 10 },
  laser:  { name: 'Laser',       color: '#f472b6', icon: 'L', dur: 7 },
  shield: { name: 'Shield',      color: '#38bdf8', icon: 'D', dur: 0 },
  bomb:   { name: 'Bomb',        color: '#ef4444', icon: 'B', dur: 0 },
  repair: { name: 'Repair',      color: '#4ade80', icon: '+', dur: 0 },
};

// ---------- save ----------
function loadSave() {
  const d = { coins: 0, level: 1, best: 1, hiscore: 0, ship: 'dart', owned: ['dart'], up: { dmg: 0, rate: 0, hull: 0, luck: 0 }, kills: 0, sound: true };
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s) { const up = Object.assign({}, d.up, s.up || {}); Object.assign(d, s); d.up = up; }
  } catch (e) { /* no storage */ }
  return d;
}
const save = loadSave();
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } }

// ---------- helpers ----------
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

// ---------- audio (tiny) ----------
let AC = null;
function beep(freq, dur, type, vol, slide) {
  if (!save.sound) return;
  try {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, AC.currentTime + dur);
    g.gain.value = vol || 0.04;
    g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
    o.connect(g); g.connect(AC.destination); o.start(); o.stop(AC.currentTime + dur);
  } catch (e) { /* no audio */ }
}

// ---------- level generation ----------
function makeLevel(n) {
  const rng = mulberry32(n * 104729 + 3);
  const pick = arr => arr[Math.floor(rng() * arr.length)];
  const boss = n % 5 === 0;
  const pool = ['drone', 'drone', 'asteroid'];
  if (n >= 2) pool.push('fighter');
  if (n >= 3) pool.push('kamikaze', 'fighter');
  if (n >= 4) pool.push('tank');
  if (n >= 7) pool.push('tank', 'kamikaze');
  const groups = [];
  const nGroups = boss ? 3 + Math.floor(n / 5) : 5 + n;
  let t = 2.5;
  for (let i = 0; i < nGroups; i++) {
    const type = i === 0 ? 'drone' : pick(pool);
    const form = type === 'asteroid' ? 'scatter' : pick(['line', 'vee', 'column', 'scatter']);
    const count = type === 'tank' ? 1 + Math.floor(n / 6) : type === 'asteroid' ? 2 + Math.floor(rng() * 3) : 3 + Math.floor(rng() * 3) + Math.floor(n / 4);
    groups.push({ t, type, form, count, x: 60 + rng() * (W - 120), done: false });
    t += Math.max(2.2, 5.5 - n * 0.2) * (0.7 + rng() * 0.6);
  }
  return { n, groups, boss, bossHp: 80 + n * 18, bossAt: t + 2, total: groups.reduce((a, g) => a + g.count, 0) + (boss ? 1 : 0) };
}

// ---------- game state ----------
let L = null;
const mkStars = () => {
  const st = [];
  for (let i = 0; i < 90; i++) st.push({ x: Math.random() * W, y: Math.random() * H, z: 0.3 + Math.random() * 0.7, tw: Math.random() * TAU });
  return st;
};
const G = {
  state: 'menu', t: 0, stars: mkStars(), enemies: [], pbul: [], ebul: [], pups: [], parts: [], floats: [], toasts: [],
  ship: { x: W / 2, y: H - 110, hp: 3, maxHp: 3, shield: false, inv: 0, fireT: 0, spread: 0, rapid: 0, laser: 0, tilt: 0 },
  boss: null, score: 0, kills: 0, spawned: 0, shake: 0, flash: 0, lost: false, bossSpawned: false, combo: 0, comboT: 0,
};

function startLevel(n) {
  L = makeLevel(n);
  const S = SHIPS[save.ship] || SHIPS.dart;
  G.state = 'play'; G.t = 0; G.enemies = []; G.pbul = []; G.ebul = []; G.pups = []; G.parts = []; G.floats = []; G.toasts = [];
  G.ship = { x: W / 2, y: H - 110, hp: S.hp + save.up.hull, maxHp: S.hp + save.up.hull, shield: false, inv: 2, fireT: 0, spread: 0, rapid: 0, laser: 0, tilt: 0 };
  G.boss = null; G.score = 0; G.kills = 0; G.spawned = 0; G.shake = 0; G.flash = 0; G.lost = false; G.bossSpawned = false; G.combo = 0; G.comboT = 0;
  for (const g of L.groups) g.done = false;
  toast(L.boss ? 'Level ' + n + ' — BOSS AHEAD' : 'Level ' + n, 2);
  showScreen(null);
}

function spawnGroup(g) {
  const E = ENEMIES[g.type];
  for (let i = 0; i < g.count; i++) {
    let x = g.x, y = -30 - i * 34, delay = 0;
    if (g.form === 'line') { x = clamp(g.x + (i - (g.count - 1) / 2) * 50, 30, W - 30); y = -30; }
    else if (g.form === 'vee') { x = clamp(g.x + (i - (g.count - 1) / 2) * 44, 30, W - 30); y = -30 - Math.abs(i - (g.count - 1) / 2) * 30; }
    else if (g.form === 'column') { x = g.x; y = -30 - i * 44; }
    else { x = 30 + Math.random() * (W - 60); y = -30 - Math.random() * 120; }
    G.enemies.push({ type: g.type, x, y, baseX: x, hp: E.hp, maxHp: E.hp, r: E.r, speed: E.speed, ph: Math.random() * TAU, shootT: 1 + Math.random() * 1.5, hit: 0, vx: (Math.random() - 0.5) * 40, rot: Math.random() * TAU, rotV: (Math.random() - 0.5) * 2, dead: false });
    G.spawned++;
  }
}
function spawnBoss() {
  G.boss = { x: W / 2, y: -80, hp: L.bossHp, maxHp: L.bossHp, r: 46, hit: 0, t: 0, shootT: 2, ringT: 3, spawnT: 4, dir: 1, dead: false };
  G.bossSpawned = true; G.spawned++;
  toast('WARNING: BOSS', 2.5); beep(60, 1.2, 'sawtooth', 0.1, 30);
}

function fire() {
  const S = SHIPS[save.ship] || SHIPS.dart, s = G.ship;
  const dmg = 1 * (1 + 0.25 * save.up.dmg);
  const spread = S.spread || s.spread > 0;
  if (s.laser > 0) return; // laser handled continuously
  const shots = spread ? [[-0.25, -6], [0, 0], [0.25, 6]] : S.spread ? [[0, -6], [0, 6]] : [[0, 0]];
  for (const [a, ox] of shots) G.pbul.push({ x: s.x + ox, y: s.y - 18, vx: Math.sin(a) * 520, vy: -Math.cos(a) * 520, dmg, r: 4, dead: false });
  beep(spread ? 900 : 1100, 0.05, 'square', 0.02, 500);
}

function hitEnemy(e, dmg, sx, sy) {
  e.hp -= dmg; e.hit = 0.08;
  puff(sx, sy, '#fde68a', 2);
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  if (e.dead) return;
  e.dead = true; G.kills++; save.kills++;
  const E = ENEMIES[e.type];
  G.combo++; G.comboT = 2;
  const pts = E.score * Math.min(5, 1 + Math.floor(G.combo / 5));
  G.score += pts;
  G.floats.push({ x: e.x, y: e.y, text: '+' + pts, life: 0.7, color: '#fde68a' });
  boom(e.x, e.y, E.color, e.r);
  if (e.type === 'asteroid') for (let i = 0; i < 2; i++) G.enemies.push({ type: 'shard', x: e.x + (i ? 14 : -14), y: e.y, baseX: e.x, hp: 2, maxHp: 2, r: 10, speed: 85, ph: Math.random() * TAU, shootT: 9, hit: 0, vx: (i ? 1 : -1) * (40 + Math.random() * 40), rot: Math.random() * TAU, rotV: (Math.random() - 0.5) * 6, dead: false });
  if (!E.rock && Math.random() < 0.11 + 0.04 * save.up.luck) {
    const keys = Object.keys(POWERUPS);
    G.pups.push({ kind: keys[Math.floor(Math.random() * keys.length)], x: e.x, y: e.y, ph: 0, dead: false });
  }
  beep(200 + Math.random() * 100, 0.15, 'sawtooth', 0.04, 60);
}
function boom(x, y, color, r) {
  for (let i = 0; i < Math.min(40, r * 1.2); i++) {
    const a = Math.random() * TAU, v = 40 + Math.random() * r * 8;
    G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.35 + Math.random() * 0.4, r: 1.5 + Math.random() * 3, color: i % 3 === 0 ? '#fff' : color });
  }
  G.parts.push({ x, y, ring: true, life: 0.3, R: r * 2.2, color });
}
function damageShip(amount) {
  const s = G.ship;
  if (s.inv > 0 || G.state !== 'play') return;
  if (s.shield) { s.shield = false; s.inv = 1; G.parts.push({ x: s.x, y: s.y, ring: true, life: 0.35, R: 60, color: '#38bdf8' }); beep(300, 0.2, 'square', 0.05); toast('Shield down!', 1); return; }
  s.hp -= amount; s.inv = 1.6; G.shake = 1; G.flash = 0.5; G.combo = 0;
  boom(s.x, s.y, '#38bdf8', 14);
  beep(120, 0.4, 'sawtooth', 0.08, 40);
  if (s.hp <= 0) { G.lost = true; boom(s.x, s.y, '#fb923c', 40); G.shake = 2; }
}
function applyPowerup(p) {
  const s = G.ship, P = POWERUPS[p.kind];
  p.dead = true;
  if (p.kind === 'spread') s.spread = P.dur;
  else if (p.kind === 'rapid') s.rapid = P.dur;
  else if (p.kind === 'laser') s.laser = P.dur;
  else if (p.kind === 'shield') s.shield = true;
  else if (p.kind === 'repair') s.hp = Math.min(s.maxHp, s.hp + 1);
  else if (p.kind === 'bomb') {
    G.ebul = []; G.flash = 0.8; G.shake = 1.2;
    for (const e of G.enemies) if (!e.dead) hitEnemy(e, 10, e.x, e.y);
    if (G.boss && !G.boss.dead) { G.boss.hp -= 25; G.boss.hit = 0.2; }
    G.parts.push({ x: s.x, y: s.y, ring: true, life: 0.6, R: 500, color: '#ef4444' });
  }
  toast(P.name + '!', 1.1); beep(700, 0.15, 'triangle', 0.05, 1400);
  G.score += 25;
}

// ---------- simulation ----------
function update(dt) {
  G.t += dt;
  const s = G.ship, S = SHIPS[save.ship] || SHIPS.dart;
  G.shake = Math.max(0, G.shake - dt * 3); G.flash = Math.max(0, G.flash - dt * 2);
  if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) G.combo = 0; }
  for (const st of G.stars) { st.y += (60 + st.z * 160) * dt; if (st.y > H) { st.y = -2; st.x = Math.random() * W; } }

  // spawning
  for (const g of L.groups) if (!g.done && G.t >= g.t) { g.done = true; spawnGroup(g); }
  if (L.boss && !G.bossSpawned && G.t >= L.bossAt && G.enemies.length === 0) spawnBoss();

  // ship
  s.inv = Math.max(0, s.inv - dt); s.spread = Math.max(0, s.spread - dt); s.rapid = Math.max(0, s.rapid - dt); s.laser = Math.max(0, s.laser - dt);
  s.tilt += (s.targetTilt || 0 - s.tilt) * Math.min(1, dt * 10); s.targetTilt = 0;
  s.fireT -= dt;
  if (s.fireT <= 0) { s.fireT = S.rate / (1 + 0.1 * save.up.rate) / (s.rapid > 0 ? 2 : 1); fire(); }
  if (s.laser > 0) {
    const dmg = 9 * (1 + 0.25 * save.up.dmg) * dt;
    for (const e of G.enemies) if (!e.dead && Math.abs(e.x - s.x) < e.r + 5 && e.y < s.y) hitEnemy(e, dmg, e.x, e.y + e.r);
    if (G.boss && !G.boss.dead && Math.abs(G.boss.x - s.x) < G.boss.r + 5) { G.boss.hp -= dmg; G.boss.hit = 0.05; }
  }

  // player bullets
  for (const b of G.pbul) {
    if (b.dead) continue;
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.y < -10 || b.x < -10 || b.x > W + 10) { b.dead = true; continue; }
    for (const e of G.enemies) {
      if (e.dead) continue;
      if (dist2(b, e) < (e.r + b.r) ** 2) { b.dead = true; hitEnemy(e, b.dmg, b.x, b.y); break; }
    }
    if (!b.dead && G.boss && !G.boss.dead && dist2(b, G.boss) < (G.boss.r + b.r) ** 2) { b.dead = true; G.boss.hp -= b.dmg; G.boss.hit = 0.08; puff(b.x, b.y, '#fde68a', 2); }
  }

  // enemies
  for (const e of G.enemies) {
    if (e.dead) continue;
    const E = ENEMIES[e.type];
    if (e.hit > 0) e.hit -= dt;
    e.rot += e.rotV * dt;
    if (e.type === 'drone') { e.y += e.speed * dt; e.x = e.baseX + Math.sin(G.t * 2.5 + e.ph) * 55; }
    else if (e.type === 'fighter') { e.y += e.speed * dt; e.x += (s.x - e.x) * Math.min(1, dt * 1.2); }
    else if (e.type === 'tank') { e.y += e.speed * dt; e.x = e.baseX + Math.sin(G.t * 0.8 + e.ph) * 30; }
    else if (e.type === 'kamikaze') {
      const dx = s.x - e.x, dy = s.y - e.y, d = Math.hypot(dx, dy) || 1;
      if (e.y < s.y - 10) { e.vx = e.vx + (dx / d * 300 - e.vx) * Math.min(1, dt * 2); e.x += e.vx * dt; e.y += e.speed * dt; }
      else { e.y += e.speed * dt; }
    }
    else { e.y += e.speed * dt; e.x += e.vx * dt; if (e.x < e.r || e.x > W - e.r) e.vx *= -1; }
    e.x = clamp(e.x, 10, W - 10);
    if (e.y > H + 40) { e.dead = true; continue; }
    if (E.shoot && e.y > 0 && e.y < s.y - 40) {
      e.shootT -= dt;
      if (e.shootT <= 0) {
        e.shootT = E.shoot;
        if (e.type === 'fighter') { const dx = s.x - e.x, dy = s.y - e.y, d = Math.hypot(dx, dy) || 1; G.ebul.push({ x: e.x, y: e.y + e.r, vx: dx / d * 190, vy: dy / d * 190, r: 4, dead: false }); }
        else for (const a of [-0.35, 0, 0.35]) G.ebul.push({ x: e.x, y: e.y + e.r, vx: Math.sin(a) * 150, vy: Math.cos(a) * 150, r: 5, dead: false });
        beep(400, 0.06, 'square', 0.02, 200);
      }
    }
    if (dist2(e, s) < (e.r + 12) ** 2 && s.inv <= 0) { damageShip(1); if (!E.rock || e.type === 'shard') killEnemy(e); }
    else if (dist2(e, s) < (e.r + 12) ** 2 && s.inv > 0 && e.type === 'kamikaze') killEnemy(e);
  }

  // boss
  const b = G.boss;
  if (b && !b.dead) {
    b.t += dt; if (b.hit > 0) b.hit -= dt;
    b.y += (110 - b.y) * Math.min(1, dt * 1.5);
    const frac = b.hp / b.maxHp;
    const sp = frac < 0.33 ? 120 : 70;
    b.x += b.dir * sp * dt; if (b.x < 70) { b.x = 70; b.dir = 1; } else if (b.x > W - 70) { b.x = W - 70; b.dir = -1; }
    b.shootT -= dt;
    if (b.shootT <= 0 && b.y > 60) {
      b.shootT = frac < 0.33 ? 1.0 : frac < 0.66 ? 1.4 : 2.0;
      const dx = s.x - b.x, dy = s.y - b.y, d = Math.hypot(dx, dy) || 1, ang = Math.atan2(dy, dx);
      for (const o of (frac < 0.66 ? [-0.3, 0, 0.3] : [-0.22, 0, 0.22])) G.ebul.push({ x: b.x, y: b.y + 30, vx: Math.cos(ang + o) * 175, vy: Math.sin(ang + o) * 175, r: 5, dead: false });
      beep(220, 0.1, 'square', 0.04, 110);
    }
    if (frac < 0.66) {
      b.ringT -= dt;
      if (b.ringT <= 0) { b.ringT = frac < 0.33 ? 1.8 : 2.6; for (let i = 0; i < 14; i++) { const a = i / 14 * TAU + b.t; G.ebul.push({ x: b.x, y: b.y, vx: Math.cos(a) * 130, vy: Math.sin(a) * 130, r: 5, dead: false }); } beep(160, 0.3, 'sawtooth', 0.05); }
    }
    if (frac < 0.33) {
      b.spawnT -= dt;
      if (b.spawnT <= 0) { b.spawnT = 4; for (let i = 0; i < 2; i++) G.enemies.push({ type: 'drone', x: b.x + (i ? 50 : -50), y: b.y + 20, baseX: b.x + (i ? 50 : -50), hp: 2, maxHp: 2, r: 12, speed: 75, ph: Math.random() * TAU, shootT: 9, hit: 0, vx: 0, rot: 0, rotV: 0, dead: false }); }
    }
    if (dist2(b, s) < (b.r + 12) ** 2) damageShip(1);
    if (b.hp <= 0) {
      b.dead = true; G.score += 500; G.kills++;
      boom(b.x, b.y, '#fde047', 60); G.shake = 2.5; G.flash = 1; G.ebul = [];
      G.floats.push({ x: b.x, y: b.y, text: '+500', life: 1.4, color: '#fde047' });
      beep(80, 1.0, 'sawtooth', 0.1, 20); setTimeout(() => beep(880, 0.5, 'triangle', 0.06), 300);
    }
  }

  // enemy bullets
  for (const eb of G.ebul) {
    if (eb.dead) continue;
    eb.x += eb.vx * dt; eb.y += eb.vy * dt;
    if (eb.y > H + 10 || eb.y < -10 || eb.x < -10 || eb.x > W + 10) { eb.dead = true; continue; }
    if (dist2(eb, s) < (eb.r + 7) ** 2) { eb.dead = true; damageShip(1); }
  }
  // power-ups
  for (const p of G.pups) {
    if (p.dead) continue;
    p.y += 60 * dt; p.ph += dt;
    const d = Math.hypot(p.x - s.x, p.y - s.y);
    if (d < 90 + 20 * save.up.luck) { p.x += (s.x - p.x) * Math.min(1, dt * 4); p.y += (s.y - p.y) * Math.min(1, dt * 4); }
    if (d < 24) applyPowerup(p);
    if (p.y > H + 20) p.dead = true;
  }

  G.enemies = G.enemies.filter(e => !e.dead);
  G.pbul = G.pbul.filter(x => !x.dead); G.ebul = G.ebul.filter(x => !x.dead); G.pups = G.pups.filter(x => !x.dead);
  for (let i = G.parts.length - 1; i >= 0; i--) {
    const p = G.parts[i]; p.life -= dt;
    if (p.life <= 0) { G.parts.splice(i, 1); continue; }
    if (!p.ring) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.95; p.vy *= 0.95; }
  }
  for (let i = G.floats.length - 1; i >= 0; i--) { const f = G.floats[i]; f.life -= dt; f.y -= 40 * dt; if (f.life <= 0) G.floats.splice(i, 1); }
  for (let i = G.toasts.length - 1; i >= 0; i--) { G.toasts[i].t -= dt; if (G.toasts[i].t <= 0) G.toasts.splice(i, 1); }

  if (G.lost) { G.lostT = (G.lostT || 0) + dt; if (G.lostT > 1.2) endLevel(false); return; }
  const allSpawned = L.groups.every(g => g.done) && (!L.boss || G.bossSpawned);
  if (allSpawned && G.enemies.length === 0 && (!L.boss || (G.boss && G.boss.dead))) endLevel(true);
}

function puff(x, y, color, n) {
  if (G.parts.length > 400) return;
  for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = 20 + Math.random() * 80; G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.2 + Math.random() * 0.2, r: 1 + Math.random() * 2, color }); }
}
function toast(msg, t) { G.toasts.push({ msg, t: t || 1.5, max: t || 1.5 }); }

function endLevel(win) {
  G.state = win ? 'win' : 'lose';
  G.lostT = 0;
  const bonus = win ? 100 + L.n * 40 + G.ship.hp * 30 : 0;
  G.score += bonus;
  const coins = Math.round(G.score / 10);
  G.coins = coins; save.coins += coins;
  save.hiscore = Math.max(save.hiscore, G.score);
  if (win) { save.level = L.n + 1; save.best = Math.max(save.best, L.n + 1); }
  persist();
  beep(win ? 660 : 110, 0.6, win ? 'triangle' : 'sawtooth', 0.07);
  if (win) setTimeout(() => beep(990, 0.6, 'triangle', 0.07), 150);
  showEnd(win);
}

// ---------- rendering ----------
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const wrap = document.getElementById('wrap');
let scale = 1;
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const vw = window.innerWidth, vh = window.innerHeight;
  scale = Math.min(vw / W, vh / H);
  const cw = Math.round(W * scale), ch = Math.round(H * scale);
  canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
  wrap.style.width = cw + 'px'; wrap.style.height = ch + 'px';
  canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
}
window.addEventListener('resize', resize);
resize();

function roundRect(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function poly(c, pts) { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); }

function drawShip(c, x, y, S, t, tilt, hit) {
  c.save(); c.translate(x, y); c.scale(1 - Math.abs(tilt) * 0.25, 1);
  // engine flame
  const fl = 14 + Math.sin(t * 40) * 4;
  c.fillStyle = '#fde047'; poly(c, [[-6, 14], [6, 14], [0, 14 + fl]]); c.fill();
  c.fillStyle = '#fb923c'; poly(c, [[-3, 14], [3, 14], [0, 14 + fl * 0.6]]); c.fill();
  // wings
  c.fillStyle = hit ? '#fff' : S.dark; poly(c, [[-22, 12], [-6, -2], [-6, 14]]); c.fill(); poly(c, [[22, 12], [6, -2], [6, 14]]); c.fill();
  // hull
  c.fillStyle = hit ? '#fff' : S.color; poly(c, [[0, -24], [9, 4], [9, 14], [-9, 14], [-9, 4]]); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.35)'; poly(c, [[0, -24], [4, 0], [0, 4], [-4, 0]]); c.fill();
  // cockpit
  c.fillStyle = '#e0f2fe'; c.beginPath(); c.ellipse(0, -4, 3.5, 7, 0, 0, TAU); c.fill();
  c.fillStyle = S.dark; c.fillRect(-9, 8, 18, 3);
  c.restore();
}

function drawEnemy(c, e, t) {
  const E = ENEMIES[e.type], col = e.hit > 0 ? '#fff' : E.color, dark = e.hit > 0 ? '#ddd' : E.dark;
  c.save(); c.translate(e.x, e.y);
  switch (e.type) {
    case 'drone':
      c.rotate(Math.sin(t * 2.5 + e.ph) * 0.25);
      c.fillStyle = dark; c.beginPath(); c.ellipse(0, 2, 14, 6, 0, 0, TAU); c.fill();
      c.fillStyle = col; c.beginPath(); c.ellipse(0, -2, 9, 8, 0, 0, TAU); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(0, -3, 3, 0, TAU); c.fill();
      c.fillStyle = '#111'; c.beginPath(); c.arc(0, -3, 1.5, 0, TAU); c.fill();
      break;
    case 'fighter':
      c.fillStyle = dark; poly(c, [[-16, -10], [0, -2], [16, -10], [10, 2], [-10, 2]]); c.fill();
      c.fillStyle = col; poly(c, [[0, 16], [7, -8], [0, -12], [-7, -8]]); c.fill();
      c.fillStyle = '#fee2e2'; c.beginPath(); c.ellipse(0, 2, 2.5, 5, 0, 0, TAU); c.fill();
      c.fillStyle = '#fde047'; c.fillRect(-2, 14 + Math.sin(t * 30) * 2, 4, 5);
      break;
    case 'tank': {
      c.fillStyle = dark; c.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.PI / 6; c.lineTo(Math.cos(a) * 20, Math.sin(a) * 20); } c.closePath(); c.fill();
      c.fillStyle = col; c.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.PI / 6; c.lineTo(Math.cos(a) * 14, Math.sin(a) * 14); } c.closePath(); c.fill();
      c.fillStyle = '#1e1b4b'; c.beginPath(); c.arc(0, 0, 6, 0, TAU); c.fill();
      c.fillStyle = dark; c.fillRect(-3, 6, 6, 14); c.fillRect(-14, 6, 5, 10); c.fillRect(9, 6, 5, 10);
      c.fillStyle = '#c4b5fd'; c.beginPath(); c.arc(0, 0, 3, 0, TAU); c.fill();
      break;
    }
    case 'kamikaze':
      c.fillStyle = 'rgba(239,68,68,0.35)'; poly(c, [[-5, -30], [5, -30], [0, -2]]); c.fill();
      c.fillStyle = dark; poly(c, [[-11, -6], [0, 2], [11, -6], [0, -2]]); c.fill();
      c.fillStyle = col; poly(c, [[0, 14], [6, -6], [0, -10], [-6, -6]]); c.fill();
      c.fillStyle = '#fde047'; c.beginPath(); c.arc(0, 0, 2.5 + Math.sin(t * 25) * 1, 0, TAU); c.fill();
      break;
    default: { // asteroid / shard
      c.rotate(e.rot);
      const r = e.r, n = e.type === 'shard' ? 6 : 8;
      c.fillStyle = dark; c.beginPath(); for (let i = 0; i < n; i++) { const a = i / n * TAU, rr = r * (0.8 + ((i * 7) % 3) * 0.1); c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); c.fill();
      c.fillStyle = col; c.beginPath(); for (let i = 0; i < n; i++) { const a = i / n * TAU, rr = r * 0.7 * (0.8 + ((i * 7) % 3) * 0.1); c.lineTo(Math.cos(a) * rr - r * 0.15, Math.sin(a) * rr - r * 0.15); } c.closePath(); c.fill();
      c.fillStyle = dark; c.beginPath(); c.arc(r * 0.2, -r * 0.1, r * 0.2, 0, TAU); c.arc(-r * 0.3, r * 0.3, r * 0.14, 0, TAU); c.fill();
    }
  }
  c.restore();
  if (e.hp < e.maxHp && e.maxHp > 2) {
    const w = e.r * 2, f = clamp(e.hp / e.maxHp, 0, 1);
    c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(e.x - w / 2, e.y - e.r - 8, w, 3);
    c.fillStyle = '#f87171'; c.fillRect(e.x - w / 2, e.y - e.r - 8, w * f, 3);
  }
}

function drawBoss(c, b, t) {
  const col = b.hit > 0 ? '#fff' : '#7c3aed', dark = b.hit > 0 ? '#ddd' : '#3b0764', frac = b.hp / b.maxHp;
  c.save(); c.translate(b.x, b.y);
  c.fillStyle = 'rgba(124,58,237,0.25)'; c.beginPath(); c.arc(0, 0, 60 + Math.sin(t * 4) * 4, 0, TAU); c.fill();
  c.fillStyle = dark; poly(c, [[-70, -10], [-30, -30], [30, -30], [70, -10], [50, 30], [-50, 30]]); c.fill();
  c.fillStyle = col; poly(c, [[-40, -24], [40, -24], [52, 10], [20, 34], [-20, 34], [-52, 10]]); c.fill();
  c.fillStyle = dark; for (const x of [-56, 56]) { c.fillRect(x - 5, -4, 10, 28); c.fillStyle = '#fde047'; c.fillRect(x - 3, 22 + Math.sin(t * 30) * 2, 6, 8); c.fillStyle = dark; }
  const core = frac < 0.33 ? '#ef4444' : frac < 0.66 ? '#fb923c' : '#22d3ee';
  c.fillStyle = core; c.beginPath(); c.arc(0, 4, 14 + Math.sin(t * 8) * 2, 0, TAU); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(-4, 0, 4, 0, TAU); c.fill();
  c.fillStyle = '#1e1b4b'; for (const x of [-26, 26]) { c.beginPath(); c.arc(x, -8, 7, 0, TAU); c.fill(); c.fillStyle = core; c.beginPath(); c.arc(x, -8, 3.5, 0, TAU); c.fill(); c.fillStyle = '#1e1b4b'; }
  c.restore();
}

function draw() {
  ctx.save();
  if (G.shake > 0) ctx.translate((Math.random() - 0.5) * G.shake * 10, (Math.random() - 0.5) * G.shake * 10);

  // space
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0b1026'); grad.addColorStop(0.5, '#141a3a'); grad.addColorStop(1, '#1b0f33');
  ctx.fillStyle = grad; ctx.fillRect(-10, -10, W + 20, H + 20);
  ctx.fillStyle = 'rgba(124,58,237,0.12)'; ctx.beginPath(); ctx.ellipse(300, 200 + Math.sin(G.t * 0.1) * 20, 180, 120, 0.4, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(14,165,233,0.10)'; ctx.beginPath(); ctx.ellipse(80, 520, 160, 110, -0.5, 0, TAU); ctx.fill();
  for (const st of G.stars) {
    const a = 0.4 + st.z * 0.6 * (0.7 + Math.sin(G.t * 3 + st.tw) * 0.3);
    ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fillRect(st.x, st.y, st.z > 0.8 ? 2 : 1.2, 1 + st.z * 6);
  }
  if (G.state !== 'play' && !L) { ctx.restore(); return; }

  // power-ups
  for (const p of G.pups) {
    const P = POWERUPS[p.kind], pulse = 1 + Math.sin(p.ph * 6) * 0.1;
    ctx.fillStyle = P.color; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(p.x, p.y, 16 * pulse, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    roundRect(ctx, p.x - 11, p.y - 11, 22, 22, 6); ctx.fill();
    ctx.fillStyle = '#0f172a'; ctx.font = 'bold 14px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(P.icon, p.x, p.y + 1);
  }
  // enemies & boss
  for (const e of G.enemies) drawEnemy(ctx, e, G.t);
  if (G.boss && !G.boss.dead) drawBoss(ctx, G.boss, G.t);
  // bullets
  ctx.fillStyle = '#fef08a';
  for (const b of G.pbul) { ctx.beginPath(); ctx.ellipse(b.x, b.y, 2.5, 7, Math.atan2(b.vy, b.vx) + Math.PI / 2, 0, TAU); ctx.fill(); }
  for (const eb of G.ebul) { ctx.fillStyle = '#f87171'; ctx.beginPath(); ctx.arc(eb.x, eb.y, eb.r, 0, TAU); ctx.fill(); ctx.fillStyle = '#fee2e2'; ctx.beginPath(); ctx.arc(eb.x, eb.y, eb.r * 0.45, 0, TAU); ctx.fill(); }
  // ship
  const s = G.ship;
  if (!G.lost) {
    if (s.laser > 0) {
      const lw = 6 + Math.sin(G.t * 50) * 2;
      ctx.fillStyle = 'rgba(244,114,182,0.35)'; ctx.fillRect(s.x - lw, 0, lw * 2, s.y - 16);
      ctx.fillStyle = '#fbcfe8'; ctx.fillRect(s.x - lw * 0.4, 0, lw * 0.8, s.y - 16);
    }
    if (s.inv <= 0 || Math.floor(G.t * 20) % 2 === 0) drawShip(ctx, s.x, s.y, SHIPS[save.ship] || SHIPS.dart, G.t, s.tilt, false);
    if (s.shield) { ctx.strokeStyle = `rgba(56,189,248,${0.6 + Math.sin(G.t * 6) * 0.3})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(s.x, s.y, 30, 0, TAU); ctx.stroke(); }
  }
  // particles
  for (const p of G.parts) {
    if (p.ring) { ctx.strokeStyle = p.color; ctx.globalAlpha = p.life / 0.35; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, p.R * (1 - p.life / (p.R > 200 ? 0.6 : 0.3)), 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; continue; }
    ctx.globalAlpha = clamp(p.life * 2.5, 0, 1); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const f of G.floats) {
    ctx.globalAlpha = clamp(f.life * 1.5, 0, 1); ctx.fillStyle = f.color; ctx.font = 'bold 15px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  if (G.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${G.flash * 0.35})`; ctx.fillRect(-10, -10, W + 20, H + 20); }

  // HUD
  if (L) {
    ctx.fillStyle = 'rgba(2,6,23,0.6)'; roundRect(ctx, 8, 8, W - 16, 40, 10); ctx.fill();
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px system-ui, sans-serif'; ctx.fillText('LVL ' + L.n, 18, 20);
    for (let i = 0; i < s.maxHp; i++) { ctx.fillStyle = i < s.hp ? '#f87171' : 'rgba(255,255,255,0.2)'; roundRect(ctx, 18 + i * 14, 30, 11, 9, 3); ctx.fill(); }
    ctx.textAlign = 'center'; ctx.fillStyle = '#fde68a'; ctx.font = 'bold 20px system-ui, sans-serif'; ctx.fillText(G.score.toLocaleString(), W / 2, 28);
    if (G.combo >= 5) { ctx.fillStyle = '#fb923c'; ctx.font = 'bold 11px system-ui, sans-serif'; ctx.fillText('×' + Math.min(5, 1 + Math.floor(G.combo / 5)) + ' COMBO', W / 2, 44); }
    const bx = W - 118, bw = 100;
    ctx.fillStyle = '#1e293b'; roundRect(ctx, bx, 16, bw, 8, 4); ctx.fill();
    ctx.fillStyle = '#38bdf8'; roundRect(ctx, bx, 16, bw * clamp(G.spawned / L.total, 0, 1), 8, 4); ctx.fill();
    ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = 'bold 10px system-ui, sans-serif'; ctx.fillText('WAVE', W - 18, 36);
    let px = W - 18;
    for (const k of ['spread', 'rapid', 'laser']) if (s[k] > 0) { ctx.fillStyle = POWERUPS[k].color; ctx.fillText(POWERUPS[k].icon + ' ' + Math.ceil(s[k]) + 's', px, 36); px -= 40; }
    if (G.boss && !G.boss.dead) {
      ctx.fillStyle = 'rgba(2,6,23,0.6)'; roundRect(ctx, 40, 56, W - 80, 14, 7); ctx.fill();
      ctx.fillStyle = '#7c3aed'; roundRect(ctx, 42, 58, (W - 84) * clamp(G.boss.hp / G.boss.maxHp, 0, 1), 10, 5); ctx.fill();
      ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = 'bold 9px system-ui, sans-serif'; ctx.fillText('DREADNOUGHT', W / 2, 63);
    }
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  G.toasts.forEach((t, i) => {
    const a = clamp(t.t * 2, 0, 1) * clamp((t.max - t.t) * 4, 0, 1);
    ctx.globalAlpha = a; ctx.font = 'bold 20px system-ui, sans-serif';
    const tw = Math.max(220, ctx.measureText(t.msg).width + 30);
    ctx.fillStyle = 'rgba(2,6,23,0.7)'; roundRect(ctx, W / 2 - tw / 2, 300 + i * 40 - 18, tw, 36, 10); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(t.msg, W / 2, 300 + i * 40);
  });
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ---------- input: relative drag ----------
let drag = null;
function pointerPos(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; }
canvas.addEventListener('pointerdown', e => {
  if (!AC) beep(1, 0.01, 'sine', 0.0001);
  if (G.state !== 'play') return;
  const p = pointerPos(e); drag = { x: p.x, y: p.y, sx: G.ship.x, sy: G.ship.y };
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
});
canvas.addEventListener('pointermove', e => {
  if (!drag || G.state !== 'play') return;
  const p = pointerPos(e), S = SHIPS[save.ship] || SHIPS.dart;
  const nx = clamp(drag.sx + (p.x - drag.x) * 1.3 * S.speed, 16, W - 16);
  G.ship.targetTilt = clamp((nx - G.ship.x) * 0.15, -1, 1);
  G.ship.x = nx; G.ship.y = clamp(drag.sy + (p.y - drag.y) * 1.3 * S.speed, 260, H - 40);
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('pointercancel', () => { drag = null; });
const keys = {};
window.addEventListener('keydown', e => { keys[e.key] = true; });
window.addEventListener('keyup', e => { keys[e.key] = false; });

// ---------- screens ----------
const $ = id => document.getElementById(id);
function showScreen(id) { document.querySelectorAll('.screen').forEach(sc => sc.classList.toggle('hidden', sc.id !== id)); }
function fmt(n) { return n.toLocaleString(); }
function showMenu() {
  G.state = 'menu';
  $('menu-level').textContent = 'LAUNCH  ·  LEVEL ' + save.level;
  $('menu-coins').textContent = '🪙 ' + fmt(save.coins);
  $('menu-best').textContent = save.hiscore > 0 ? 'High score ' + fmt(save.hiscore) + '  ·  ' + fmt(save.kills) + ' enemies destroyed' : 'Drag anywhere to fly. Your ship fires by itself.';
  $('btn-sound').textContent = save.sound ? '🔊 Sound on' : '🔇 Sound off';
  showScreen('menu');
}
function showEnd(win) {
  $('end-title').textContent = win ? 'SECTOR CLEARED' : 'SHIP LOST';
  $('end-title').className = win ? 'win' : 'lose';
  $('end-sub').textContent = (win ? 'Level ' + L.n + ' complete' : 'Destroyed on level ' + L.n) + (G.score >= save.hiscore && G.score > 0 ? ' · NEW HIGH SCORE' : '');
  $('end-stats').innerHTML = `<div><b>${fmt(G.score)}</b><span>score</span></div><div><b>${fmt(G.kills)}</b><span>destroyed</span></div><div><b>+${fmt(G.coins)}</b><span>coins</span></div>`;
  $('btn-next').textContent = win ? 'NEXT LEVEL ▶' : 'RETRY ↻';
  const text = win
    ? `I cleared level ${L.n} of Void Vanguard with ${fmt(G.score)} points! 🚀👾 Can you beat it?`
    : `My ship went down on level ${L.n} of Void Vanguard with ${fmt(G.score)} points. 🚀👾 Think you can fly better?`;
  $('btn-share').href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(SITE_URL) + '&hashtags=VoidVanguard';
  showScreen('end');
}
function showShop() {
  G.state = 'shop';
  $('shop-coins').textContent = '🪙 ' + fmt(save.coins);
  let html = '<h3>Ships</h3>';
  for (const k in SHIPS) {
    const S = SHIPS[k], owned = save.owned.includes(k), eq = save.ship === k;
    html += `<div class="item ${eq ? 'eq' : ''}"><canvas class="shipico" data-ship="${k}" width="48" height="48"></canvas><div class="info"><b>${S.name} <em>${S.hp} hull</em></b><span>${S.desc}</span></div>` +
      (eq ? '<button disabled>EQUIPPED</button>' : owned ? `<button data-equip="${k}">EQUIP</button>` : `<button data-buy="${k}" ${save.coins < S.cost ? 'disabled' : ''}>🪙 ${S.cost}</button>`) + '</div>';
  }
  html += '<h3>Upgrades</h3>';
  for (const k in UPGRADES) {
    const u = UPGRADES[k], lv = save.up[k], maxed = lv >= u.max, cost = upCost(k);
    html += `<div class="item"><div class="info"><b>${u.name} <em>Lv ${lv}/${u.max}</em></b><span>${u.desc}</span></div>` + (maxed ? '<button disabled>MAX</button>' : `<button data-up="${k}" ${save.coins < cost ? 'disabled' : ''}>🪙 ${cost}</button>`) + '</div>';
  }
  $('shop-list').innerHTML = html;
  for (const cv of $('shop-list').querySelectorAll('canvas.shipico')) { const c = cv.getContext('2d'); if (c) drawShip(c, 24, 26, SHIPS[cv.dataset.ship], 0, 0, false); }
  showScreen('shop');
}
$('shop-list').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  if (b.dataset.buy) { const S = SHIPS[b.dataset.buy]; if (save.coins >= S.cost) { save.coins -= S.cost; save.owned.push(b.dataset.buy); save.ship = b.dataset.buy; } }
  else if (b.dataset.equip) save.ship = b.dataset.equip;
  else if (b.dataset.up) { const k = b.dataset.up, cost = upCost(k); if (save.coins >= cost && save.up[k] < UPGRADES[k].max) { save.coins -= cost; save.up[k]++; } }
  persist(); beep(700, 0.1, 'triangle', 0.04); showShop();
});
let shopReturn = 'menu';
$('btn-play').addEventListener('click', () => startLevel(save.level));
$('btn-shop').addEventListener('click', () => { shopReturn = 'menu'; showShop(); });
$('btn-howto').addEventListener('click', () => $('howto').classList.toggle('hidden'));
$('btn-sound').addEventListener('click', () => { save.sound = !save.sound; persist(); $('btn-sound').textContent = save.sound ? '🔊 Sound on' : '🔇 Sound off'; });
$('btn-shop-back').addEventListener('click', () => shopReturn === 'end' ? showScreen('end') : showMenu());
$('btn-next').addEventListener('click', () => startLevel(save.level));
$('btn-end-shop').addEventListener('click', () => { shopReturn = 'end'; showShop(); });
$('btn-end-menu').addEventListener('click', showMenu);
$('btn-reset').addEventListener('click', () => {
  if (!confirm('Reset all progress and coins?')) return;
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
  location.reload();
});

// ---------- main loop ----------
let last = performance.now();
function frame(now) {
  let dt = (now - last) / 1000; last = now;
  if (dt > 0.05) dt = 0.05;
  if (G.state === 'play') {
    const S = SHIPS[save.ship] || SHIPS.dart, sp = 380 * S.speed;
    if (keys.ArrowLeft || keys.a) { G.ship.x = clamp(G.ship.x - sp * dt, 16, W - 16); G.ship.targetTilt = -1; }
    if (keys.ArrowRight || keys.d) { G.ship.x = clamp(G.ship.x + sp * dt, 16, W - 16); G.ship.targetTilt = 1; }
    if (keys.ArrowUp || keys.w) G.ship.y = clamp(G.ship.y - sp * dt, 260, H - 40);
    if (keys.ArrowDown || keys.s) G.ship.y = clamp(G.ship.y + sp * dt, 260, H - 40);
    update(dt);
  } else {
    for (const st of G.stars) { st.y += (20 + st.z * 50) * dt; if (st.y > H) { st.y = -2; st.x = Math.random() * W; } }
    G.t += dt;
  }
  draw();
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => { last = performance.now(); });

showMenu();
requestAnimationFrame(frame);

window.VoidVanguard = { G, save, startLevel, update, draw, makeLevel, SHIPS, ENEMIES, POWERUPS, UPGRADES, get level() { return L; } };
})();
