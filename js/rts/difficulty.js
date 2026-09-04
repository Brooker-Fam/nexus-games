// ── ADAPTIVE AI DIFFICULTY ──
// Tracks player performance via localStorage and scales AI difficulty.
// Phase 2: Glicko-inspired rating with deviation, streak multipliers,
// per-game AI rating tracking, and rating history graph.

const DIFF_STORAGE_KEY = 'nexus_rts_difficulty';
const DIFF_SCHEMA_VERSION = 2;
const DIFF_HISTORY_MAX = 50;

// AI rating snapshot at game start (set by applyDifficultyToAI)
let _aiRatingAtStart = 1000;

function _diffDefaults(){
  return {
    v: DIFF_SCHEMA_VERSION,
    rating: 1000,       // 400 (easiest) – 1600 (hardest), start at midpoint
    rd: 200,            // rating deviation — high = uncertain, decays with games
    gamesPlayed: 0,
    streak: 0,          // positive = consecutive wins, negative = consecutive losses
    lastTs: null,       // timestamp of last game (for inactivity detection)
    history: [],        // ring buffer: { ts, w, ai, rb, ra }
  };
}

// Migrate v1 data → v2
function _migrateV1(d){
  d.v = DIFF_SCHEMA_VERSION;
  // Estimate RD from games played — more games = more certain
  d.rd = Math.max(50, 200 - (d.gamesPlayed || 0) * 10);
  d.lastTs = d.history.length ? d.history[d.history.length - 1].ts : null;
  // v1 history entries { ts, w } are kept as-is — graph handles missing fields
  return d;
}

function loadDifficultyData(){
  try {
    const raw = localStorage.getItem(DIFF_STORAGE_KEY);
    if(!raw) return _diffDefaults();
    const d = JSON.parse(raw);
    if(!d || !d.v) return _diffDefaults();
    if(d.v === 1) return _migrateV1(d);
    if(d.v !== DIFF_SCHEMA_VERSION) return _diffDefaults();
    return d;
  } catch(e){ return _diffDefaults(); }
}

function saveDifficultyData(d){
  try { localStorage.setItem(DIFF_STORAGE_KEY, JSON.stringify(d)); }
  catch(e){ /* private browsing or quota exceeded */ }
}

// ── RATING ALGORITHM ──

function _perfScore(stats, gameFrames){
  // Returns a performance multiplier 0.4–1.6 based on in-game play quality.
  // High K/D and solid gold income boost the multiplier; dying a lot tanks it.
  const kills      = (stats && stats.kills)      || 0;
  const deaths     = (stats && stats.deaths)     || 0;
  const goldEarned = (stats && stats.goldEarned) || 0;
  const gameSecs   = Math.max(60, (gameFrames || 3600) / 60);

  const kd       = kills / Math.max(1, deaths);          // 1 = break-even, 3+ = dominant
  const goldRate = goldEarned / gameSecs;                // gold per second

  const kdScore    = Math.min(kd / 3, 1);               // caps at 1 for 3:1 KD
  const econScore  = Math.min(goldRate / 4, 1);          // caps at 1 for 4g/s

  const perf = kdScore * 0.65 + econScore * 0.35;        // 0–1
  return +(0.4 + perf * 1.2).toFixed(3);                 // 0.4 (terrible) – 1.6 (excellent)
}

function recordGameResult(playerWon, gameFrames, gameStats){
  const d = loadDifficultyData();
  const before = d.rating;
  const isMP = !!window._mpMultiplayer;

  // Inactivity: if 7+ days since last game, increase RD (re-calibrate faster)
  if(d.lastTs){
    const daysSince = (Date.now() - d.lastTs) / 86400000;
    if(daysSince > 7){
      const rdIncrease = Math.min(Math.floor(daysSince - 7) * 10, 150);
      d.rd = Math.min(200, d.rd + rdIncrease);
    }
  }

  // Update streak
  if(playerWon){
    d.streak = d.streak > 0 ? d.streak + 1 : 1;
  } else {
    d.streak = d.streak < 0 ? d.streak - 1 : -1;
  }
  d.gamesPlayed++;
  d.lastTs = Date.now();

  // ELO-like expected score
  // Singleplayer: AI was calibrated to player's level → expected ≈ 0.5
  // Multiplayer: assume opponent is equal skill → use player's own rating
  const aiRating = isMP ? d.rating : _aiRatingAtStart;
  const expected = 1 / (1 + Math.pow(10, (aiRating - d.rating) / 400));
  const actual = playerWon ? 1.0 : 0.0;

  // Effective K-factor — scales with rating deviation
  // High RD (new player): K_eff ≈ 64 → big swings for fast calibration
  // Low RD (experienced):  K_eff ≈ 16 → stable, gradual adjustment
  const K = 32;
  const K_eff = K * (d.rd / 100);

  // Base delta
  let delta = K_eff * (actual - expected);

  // Streak multiplier — accelerate when system is clearly wrong
  const absStreak = Math.abs(d.streak);
  if(absStreak >= 7)      delta *= 2.5;
  else if(absStreak >= 5) delta *= 2.0;
  else if(absStreak >= 3) delta *= 1.5;

  // Asymmetric: losses push 30% harder (frustration relief comes faster)
  if(!playerWon) delta *= 1.3;

  // Performance multiplier — good play boosts rating gains/reduces losses
  const pm = _perfScore(gameStats, gameFrames);
  delta *= pm;

  d.rating = Math.round(d.rating + delta);
  d.rating = Math.max(400, Math.min(1600, d.rating));

  // Decay RD — confidence increases with each game
  d.rd = Math.max(50, Math.round(d.rd * 0.92));

  // History ring buffer
  d.history.push({
    ts: Date.now(),
    w: playerWon ? 1 : 0,
    ai: aiRating,
    rb: before,
    ra: d.rating,
    f: gameFrames || 0,
    mp: isMP ? 1 : 0,
    k:  (gameStats && gameStats.kills)      || 0,
    dt: (gameStats && gameStats.deaths)     || 0,
    ge: (gameStats && gameStats.goldEarned) || 0,
    ub: (gameStats && gameStats.unitsBuilt) || 0,
    pm,
  });
  while(d.history.length > DIFF_HISTORY_MAX) d.history.shift();

  saveDifficultyData(d);
  return { before, after: d.rating, streak: d.streak, gamesPlayed: d.gamesPlayed, rd: d.rd, isMP, pm };
}

// ── DIFFICULTY QUERIES & CURVES ──

function getDifficultyNorm(){
  const d = loadDifficultyData();
  return Math.max(0, Math.min(1, (d.rating - 400) / 1200));
}

function getDifficultyLevel(){
  return Math.max(1, Math.min(10, Math.round(getDifficultyNorm() * 9) + 1));
}

// Linear interpolation
function _diffLerp(easy, hard){
  const t = getDifficultyNorm();
  return Math.round(easy + (hard - easy) * t);
}

// Exponential curve — most change happens at higher difficulty
// Good for: reaction speed, attack frequency (hard AI feels sharply faster)
function _diffExp(easy, hard){
  const t = getDifficultyNorm();
  const curve = t * t; // quadratic
  return Math.round(easy + (hard - easy) * curve);
}

// S-curve — slow change at extremes, fast in the middle
// Good for: micro quality, focus-fire (moderate difficulty feels distinct)
function _diffSCurve(easy, hard){
  const t = getDifficultyNorm();
  const curve = t * t * (3 - 2 * t); // smoothstep
  return easy + (hard - easy) * curve;
}

// ── APPLY TO AI ──

function applyDifficultyToAI(){
  if(window._mpMultiplayer){ resetAIConfig(); return; }

  const d = loadDifficultyData();
  _aiRatingAtStart = d.rating;

  const t = getDifficultyNorm();

  // Decision cadence — exponential: hard AI reacts sharply faster
  AI_CONFIG.buildInterval     = _diffExp(420, 100);   // 7s → 1.7s
  AI_CONFIG.trainInterval     = _diffExp(240, 70);    // 4s → 1.2s
  AI_CONFIG.attackInterval    = _diffExp(800, 150);   // 13s → 2.5s

  // Economy — wider range for more distinct easy/hard feel
  AI_CONFIG.maxWorkers        = _diffLerp(5, 20);
  AI_CONFIG.resourceBonus     = +(0.70 + t * 0.45).toFixed(2);  // 0.70x → 1.15x

  // Attack thresholds
  AI_CONFIG.attackMinWarriors = _diffLerp(8, 3);
  AI_CONFIG.attackMatchMin    = _diffLerp(6, 2);

  // Build order quality — easy AI delays expansion, hard AI rushes
  AI_CONFIG.barracksWorkerReq   = _diffLerp(5, 2);   // workers needed for 1st barracks
  AI_CONFIG.barracks2WorkerReq  = _diffLerp(11, 5);   // workers needed for 2nd barracks
  AI_CONFIG.eliteWorkerReq      = _diffLerp(9, 3);   // workers needed for elite structure
  AI_CONFIG.maxCannons          = _diffLerp(1, 4);    // defensive cannon cap

  // Tactical micro — S-curve: kicks in meaningfully at mid difficulty
  AI_CONFIG.focusFireChance  = +_diffSCurve(0, 0.85).toFixed(2); // target low-HP enemies
  AI_CONFIG.kiteChance       = +_diffSCurve(0, 0.7).toFixed(2);  // ranged retreat from melee
  AI_CONFIG.strategicTargetChance = +_diffSCurve(0.05, 0.9).toFixed(2);
  AI_CONFIG.counterAttackRatio = +(1.45 - t * 0.55).toFixed(2);

  // Mistakes — easy AI sometimes skips decisions
  AI_CONFIG.mistakeChance      = +(0.30 * (1 - t)).toFixed(2);   // 30% at easy → 0% at hard
  AI_CONFIG.attackPartialChance= +(0.50 * (1 - t)).toFixed(2);   // chance to only send some warriors
}

// ── HUD HELPERS ──

function updateDifficultyHUD(){
  const el = document.getElementById('rts-difficulty');
  if(el) el.textContent = getDifficultyLevel();
}

function showRatingChange(result){
  const el = document.getElementById('rts-over-rating');
  if(!el || !result) return;
  const delta = result.after - result.before;
  const sign = delta >= 0 ? '+' : '';
  const color = delta >= 0 ? '#ff6666' : '#66ff88';
  const level = getDifficultyLevel();
  const absStreak = Math.abs(result.streak);
  const streakText = absStreak >= 2
    ? ` · ${absStreak} ${result.streak > 0 ? 'WIN' : 'LOSS'} STREAK`
    : '';
  const rdText = result.rd > 100 ? ' · CALIBRATING' : '';
  const modeText = result.isMP ? ' · PVP' : '';
  // Performance label
  const pm = result.pm || 1;
  const perfLabel = pm >= 1.4 ? ' · OUTSTANDING' : pm >= 1.1 ? ' · SOLID PLAY'
    : pm <= 0.6 ? ' · POOR FORM' : '';
  const perfColor = pm >= 1.1 ? '#ffdd44' : pm <= 0.6 ? '#ff6666' : 'var(--text-dim)';
  el.innerHTML = `<span style="color:${color}">RATING ${sign}${delta}</span>`
    + ` · AI LEVEL ${level}/10`
    + `<span style="color:var(--text-dim)">${streakText}${rdText}${modeText}</span>`
    + `<span style="color:${perfColor}">${perfLabel}</span>`;
  el.style.display = 'block';
}

// ── STATS PANEL (faction select screen) ──

function refreshDifficultyStats(){
  const panel = document.getElementById('dso-stats');
  if(!panel) return;

  const d = loadDifficultyData();

  panel.style.display = '';

  // Update stat values
  const setTxt = (id, txt) => { const e = document.getElementById(id); if(e) e.textContent = txt; };
  setTxt('dso-stat-rating', d.rating);
  setTxt('dso-stat-games', d.gamesPlayed);
  setTxt('dso-stat-level', getDifficultyLevel() + '/10');

  // K/D ratio from history
  const gamesWithStats = d.history.filter(g => g.k !== undefined);
  if(gamesWithStats.length > 0){
    const totalKills  = gamesWithStats.reduce((s,g)=>s+(g.k||0),0);
    const totalDeaths = gamesWithStats.reduce((s,g)=>s+(g.dt||0),0);
    const kd = totalKills / Math.max(1, totalDeaths);
    setTxt('dso-stat-kd', kd.toFixed(2));
  } else {
    setTxt('dso-stat-kd', '—');
  }

  // Average gold per minute
  if(gamesWithStats.length > 0){
    const totalGold = gamesWithStats.reduce((s,g)=>s+(g.ge||0),0);
    const totalMins = gamesWithStats.reduce((s,g)=>s+((g.f||0)/3600),0); // frames→minutes at 60fps
    const gpm = totalMins > 0 ? Math.round(totalGold / totalMins) : 0;
    setTxt('dso-stat-gpm', gpm > 0 ? gpm + '/m' : '—');
  } else {
    setTxt('dso-stat-gpm', '—');
  }

  if(d.streak > 0) setTxt('dso-stat-streak', d.streak + 'W');
  else if(d.streak < 0) setTxt('dso-stat-streak', Math.abs(d.streak) + 'L');
  else setTxt('dso-stat-streak', '—');

  // Color streak
  const streakEl = document.getElementById('dso-stat-streak');
  if(streakEl){
    if(d.streak >= 3) streakEl.style.color = '#ff6666';
    else if(d.streak <= -3) streakEl.style.color = '#66ff88';
    else streakEl.style.color = '';
  }

  // RD indicator
  const rdEl = document.getElementById('dso-stat-rd');
  if(rdEl){
    if(d.rd > 150) rdEl.textContent = 'NEW';
    else if(d.rd > 100) rdEl.textContent = 'LEARNING';
    else if(d.rd > 70) rdEl.textContent = 'SETTLING';
    else rdEl.textContent = 'STABLE';
  }

  // Draw the rating graph
  drawRatingGraph();
}

function drawRatingGraph(){
  const canvas = document.getElementById('dso-rating-graph');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  ctx.clearRect(0, 0, W, H);

  const d = loadDifficultyData();
  // Need entries with ratingAfter (ra) — skip v1 legacy entries without it
  const points = d.history.filter(g => g.ra !== undefined);
  if(points.length < 2) return;

  const PAD_L = 40, PAD_R = 15, PAD_T = 14, PAD_B = 20;
  const gW = W - PAD_L - PAD_R;
  const gH = H - PAD_T - PAD_B;

  // Rating range — auto-scale with min 200 range
  const ratings = points.map(g => g.ra);
  let rMin = Math.min(...ratings);
  let rMax = Math.max(...ratings);
  const range = rMax - rMin;
  if(range < 200){ const mid = (rMin + rMax) / 2; rMin = mid - 100; rMax = mid + 100; }
  else { rMin -= 30; rMax += 30; }
  rMin = Math.max(350, rMin); rMax = Math.min(1650, rMax);

  // Helper: data → pixel
  const xOf = i => PAD_L + (i / (points.length - 1)) * gW;
  const yOf = r => PAD_T + (1 - (r - rMin) / (rMax - rMin)) * gH;

  // Background
  ctx.fillStyle = 'rgba(2,8,16,0.85)';
  ctx.fillRect(0, 0, W, H);

  // Grid lines
  ctx.strokeStyle = 'rgba(0,245,255,0.07)';
  ctx.lineWidth = 1;
  const gridSteps = 4;
  for(let i = 0; i <= gridSteps; i++){
    const r = rMin + (rMax - rMin) * (i / gridSteps);
    const y = yOf(r);
    ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(W - PAD_R, y); ctx.stroke();
    // Label
    ctx.fillStyle = 'rgba(0,245,255,0.3)';
    ctx.font = '9px Orbitron, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(r), PAD_L - 6, y + 3);
  }

  // X-axis labels
  ctx.fillStyle = 'rgba(0,245,255,0.25)';
  ctx.textAlign = 'center';
  ctx.font = '8px Orbitron, monospace';
  const xLabels = Math.min(points.length, 6);
  for(let i = 0; i < xLabels; i++){
    const idx = Math.round(i * (points.length - 1) / (xLabels - 1));
    ctx.fillText(idx + 1, xOf(idx), H - 4);
  }

  // Midline at 1000 if visible
  if(rMin < 1000 && rMax > 1000){
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(PAD_L, yOf(1000)); ctx.lineTo(W - PAD_R, yOf(1000)); ctx.stroke();
    ctx.setLineDash([]);
  }

  // Line gradient
  const grad = ctx.createLinearGradient(0, PAD_T, 0, PAD_T + gH);
  grad.addColorStop(0, '#ff4444');  // high rating = harder = red
  grad.addColorStop(0.5, '#00f5ff'); // mid = cyan
  grad.addColorStop(1, '#44ff88');   // low rating = easier = green

  // Fill area under curve
  ctx.beginPath();
  ctx.moveTo(xOf(0), yOf(points[0].ra));
  for(let i = 1; i < points.length; i++) ctx.lineTo(xOf(i), yOf(points[i].ra));
  ctx.lineTo(xOf(points.length - 1), PAD_T + gH);
  ctx.lineTo(xOf(0), PAD_T + gH);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0,245,255,0.05)';
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.moveTo(xOf(0), yOf(points[0].ra));
  for(let i = 1; i < points.length; i++) ctx.lineTo(xOf(i), yOf(points[i].ra));
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Dots — wins green, losses red; MP games get a ring outline
  for(let i = 0; i < points.length; i++){
    const x = xOf(i), y = yOf(points[i].ra);
    const isWin = points[i].w;
    const isMP = points[i].mp;
    ctx.beginPath();
    ctx.arc(x, y, isMP ? 4 : 3, 0, Math.PI * 2);
    ctx.fillStyle = isWin ? '#44ff88' : '#ff4466';
    ctx.fill();
    if(isMP){
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffcc00';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // Current rating dot (larger, glowing)
  const lastX = xOf(points.length - 1);
  const lastY = yOf(points[points.length - 1].ra);
  ctx.beginPath();
  ctx.arc(lastX, lastY, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#00f5ff';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(lastX, lastY, 8, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,245,255,0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

//# sourceMappingURL=difficulty.js.map
