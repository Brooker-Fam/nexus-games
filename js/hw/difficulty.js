// ── ADAPTIVE AI DIFFICULTY ──
// Tracks player performance via localStorage and scales AI difficulty.
// Phase 2: Glicko-inspired rating with deviation, streak multipliers,
// per-game AI rating tracking, and rating history graph.

const HW_DIFF_STORAGE_KEY = 'nexus_hw_difficulty';
const HW_DIFF_SCHEMA_VERSION = 2;
const HW_DIFF_HISTORY_MAX = 50;

// AI rating snapshot at game start (set by hwApplyDifficultyToAI)
let _hwAiRatingAtStart = 1000;

function _hwDiffDefaults(){
  return {
    v: HW_DIFF_SCHEMA_VERSION,
    rating: 1000,       // 400 (easiest) – 1600 (hardest), start at midpoint
    rd: 200,            // rating deviation — high = uncertain, decays with games
    gamesPlayed: 0,
    streak: 0,          // positive = consecutive wins, negative = consecutive losses
    lastTs: null,       // timestamp of last game (for inactivity detection)
    history: [],        // ring buffer: { ts, w, ai, rb, ra }
  };
}

// Migrate v1 data → v2
function _hwMigrateV1(d){
  d.v = HW_DIFF_SCHEMA_VERSION;
  // Estimate RD from games played — more games = more certain
  d.rd = Math.max(50, 200 - (d.gamesPlayed || 0) * 10);
  d.lastTs = d.history.length ? d.history[d.history.length - 1].ts : null;
  // v1 history entries { ts, w } are kept as-is — graph handles missing fields
  return d;
}

function hwLoadDifficultyData(){
  try {
    const raw = localStorage.getItem(HW_DIFF_STORAGE_KEY);
    if(!raw) return _hwDiffDefaults();
    const d = JSON.parse(raw);
    if(!d || !d.v) return _hwDiffDefaults();
    if(d.v === 1) return _hwMigrateV1(d);
    if(d.v !== HW_DIFF_SCHEMA_VERSION) return _hwDiffDefaults();
    return d;
  } catch(e){ return _hwDiffDefaults(); }
}

function hwSaveDifficultyData(d){
  try { localStorage.setItem(HW_DIFF_STORAGE_KEY, JSON.stringify(d)); }
  catch(e){ /* private browsing or quota exceeded */ }
}

// ── RATING ALGORITHM ──

function hwRecordGameResult(playerWon, gameFrames){
  const d = hwLoadDifficultyData();
  const before = d.rating;
  const isMP = !!window._hwMpMultiplayer;

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
  const aiRating = isMP ? d.rating : _hwAiRatingAtStart;
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
  });
  while(d.history.length > HW_DIFF_HISTORY_MAX) d.history.shift();

  hwSaveDifficultyData(d);
  return { before, after: d.rating, streak: d.streak, gamesPlayed: d.gamesPlayed, rd: d.rd, isMP };
}

// ── DIFFICULTY QUERIES & CURVES ──

function hwGetDifficultyNorm(){
  const d = hwLoadDifficultyData();
  return Math.max(0, Math.min(1, (d.rating - 400) / 1200));
}

function hwGetDifficultyLevel(){
  return Math.max(1, Math.min(10, Math.round(hwGetDifficultyNorm() * 9) + 1));
}

// Linear interpolation
function _hwDiffLerp(easy, hard){
  const t = hwGetDifficultyNorm();
  return Math.round(easy + (hard - easy) * t);
}

// Exponential curve — most change happens at higher difficulty
// Good for: reaction speed, attack frequency (hard AI feels sharply faster)
function _hwDiffExp(easy, hard){
  const t = hwGetDifficultyNorm();
  const curve = t * t; // quadratic
  return Math.round(easy + (hard - easy) * curve);
}

// S-curve — slow change at extremes, fast in the middle
// Good for: micro quality, focus-fire (moderate difficulty feels distinct)
function _hwDiffSCurve(easy, hard){
  const t = hwGetDifficultyNorm();
  const curve = t * t * (3 - 2 * t); // smoothstep
  return easy + (hard - easy) * curve;
}

// ── APPLY TO AI ──

function hwApplyDifficultyToAI(){
  if(window._hwMpMultiplayer){ hwResetAIConfig(); return; }

  const d = hwLoadDifficultyData();
  _hwAiRatingAtStart = d.rating;

  const t = hwGetDifficultyNorm();

  // Decision cadence — exponential: hard AI reacts sharply faster
  HW_AI_CONFIG.buildInterval     = _hwDiffExp(420, 100);   // 7s → 1.7s
  HW_AI_CONFIG.trainInterval     = _hwDiffExp(240, 70);    // 4s → 1.2s
  HW_AI_CONFIG.attackInterval    = _hwDiffExp(800, 150);   // 13s → 2.5s

  // Economy — wider range for more distinct easy/hard feel
  HW_AI_CONFIG.maxWorkers        = _hwDiffLerp(5, 20);
  HW_AI_CONFIG.resourceBonus     = +(0.70 + t * 0.45).toFixed(2);  // 0.70x → 1.15x

  // Attack thresholds
  HW_AI_CONFIG.attackMinWarriors = _hwDiffLerp(8, 3);
  HW_AI_CONFIG.attackMatchMin    = _hwDiffLerp(6, 2);

  // Build order quality — easy AI delays expansion, hard AI rushes
  HW_AI_CONFIG.barracksWorkerReq   = _hwDiffLerp(5, 2);   // workers needed for 1st barracks
  HW_AI_CONFIG.barracks2WorkerReq  = _hwDiffLerp(11, 5);   // workers needed for 2nd barracks
  HW_AI_CONFIG.eliteWorkerReq      = _hwDiffLerp(9, 3);   // workers needed for elite structure
  HW_AI_CONFIG.maxCannons          = _hwDiffLerp(1, 4);    // defensive cannon cap

  // Tactical micro — S-curve: kicks in meaningfully at mid difficulty
  HW_AI_CONFIG.focusFireChance  = +_hwDiffSCurve(0, 0.85).toFixed(2); // target low-HP enemies
  HW_AI_CONFIG.kiteChance       = +_hwDiffSCurve(0, 0.7).toFixed(2);  // ranged retreat from melee

  // Mistakes — easy AI sometimes skips decisions
  HW_AI_CONFIG.mistakeChance      = +(0.30 * (1 - t)).toFixed(2);   // 30% at easy → 0% at hard
  HW_AI_CONFIG.attackPartialChance= +(0.50 * (1 - t)).toFixed(2);   // chance to only send some warriors
}

// ── HUD HELPERS ──

function hwUpdateDifficultyHUD(){
  const el = document.getElementById('hw-difficulty');
  if(el) el.textContent = hwGetDifficultyLevel();
}

function hwShowRatingChange(result){
  const el = document.getElementById('hw-over-rating');
  if(!el || !result) return;
  const delta = result.after - result.before;
  const sign = delta >= 0 ? '+' : '';
  const color = delta >= 0 ? '#ff6666' : '#66ff88';
  const level = hwGetDifficultyLevel();
  const absStreak = Math.abs(result.streak);
  const streakText = absStreak >= 2
    ? ` · ${absStreak} ${result.streak > 0 ? 'WIN' : 'LOSS'} STREAK`
    : '';
  const rdText = result.rd > 100 ? ' · CALIBRATING' : '';
  const modeText = result.isMP ? ' · PVP' : '';
  el.innerHTML = `<span style="color:${color}">RATING ${sign}${delta}</span>`
    + ` · AI LEVEL ${level}/10`
    + `<span style="color:var(--text-dim)">${streakText}${rdText}${modeText}</span>`;
  el.style.display = 'block';
}

// ── STATS PANEL (faction select screen) ──

function hwRefreshDifficultyStats(){
  const panel = document.getElementById('hw-stats');
  if(!panel) return;

  const d = hwLoadDifficultyData();

  // Hide panel if no games played
  if(d.gamesPlayed === 0){
    panel.style.display = 'none';
    return;
  }
  panel.style.display = '';

  // Update stat values
  const setTxt = (id, txt) => { const e = document.getElementById(id); if(e) e.textContent = txt; };
  setTxt('hw-stat-rating', d.rating);
  setTxt('hw-stat-games', d.gamesPlayed);
  setTxt('hw-stat-level', hwGetDifficultyLevel() + '/10');

  const wins = d.history.filter(g => g.w).length;
  const total = d.history.length;
  setTxt('hw-stat-winrate', total > 0 ? Math.round(wins / total * 100) + '%' : '—');

  if(d.streak > 0) setTxt('hw-stat-streak', d.streak + 'W');
  else if(d.streak < 0) setTxt('hw-stat-streak', Math.abs(d.streak) + 'L');
  else setTxt('hw-stat-streak', '—');

  // Color streak
  const streakEl = document.getElementById('hw-stat-streak');
  if(streakEl){
    if(d.streak >= 3) streakEl.style.color = '#ff6666';
    else if(d.streak <= -3) streakEl.style.color = '#66ff88';
    else streakEl.style.color = '';
  }

  // RD indicator
  const rdEl = document.getElementById('hw-stat-rd');
  if(rdEl){
    if(d.rd > 150) rdEl.textContent = 'NEW';
    else if(d.rd > 100) rdEl.textContent = 'LEARNING';
    else if(d.rd > 70) rdEl.textContent = 'SETTLING';
    else rdEl.textContent = 'STABLE';
  }

  // Draw the rating graph
  hwDrawRatingGraph();
}

function hwDrawRatingGraph(){
  const canvas = document.getElementById('hw-rating-graph');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, HT = canvas.height;

  ctx.clearRect(0, 0, W, HT);

  const d = hwLoadDifficultyData();
  // Need entries with ratingAfter (ra) — skip v1 legacy entries without it
  const points = d.history.filter(g => g.ra !== undefined);
  if(points.length < 2) return;

  const PAD_L = 40, PAD_R = 15, PAD_T = 14, PAD_B = 20;
  const gW = W - PAD_L - PAD_R;
  const gH = HT - PAD_T - PAD_B;

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

  // Background — warm farm tones
  ctx.fillStyle = 'rgba(20,12,8,0.85)';
  ctx.fillRect(0, 0, W, HT);

  // Grid lines
  ctx.strokeStyle = 'rgba(139,90,43,0.07)';
  ctx.lineWidth = 1;
  const gridSteps = 4;
  for(let i = 0; i <= gridSteps; i++){
    const r = rMin + (rMax - rMin) * (i / gridSteps);
    const y = yOf(r);
    ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(W - PAD_R, y); ctx.stroke();
    // Label — warm brown axis labels
    ctx.fillStyle = '#8B5A2B';
    ctx.font = '9px Georgia, serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(r), PAD_L - 6, y + 3);
  }

  // X-axis labels
  ctx.fillStyle = '#8B5A2B';
  ctx.textAlign = 'center';
  ctx.font = '8px Georgia, serif';
  const xLabels = Math.min(points.length, 6);
  for(let i = 0; i < xLabels; i++){
    const idx = Math.round(i * (points.length - 1) / (xLabels - 1));
    ctx.fillText(idx + 1, xOf(idx), HT - 4);
  }

  // Midline at 1000 if visible
  if(rMin < 1000 && rMax > 1000){
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(PAD_L, yOf(1000)); ctx.lineTo(W - PAD_R, yOf(1000)); ctx.stroke();
    ctx.setLineDash([]);
  }

  // Line gradient — warm farm colors
  const grad = ctx.createLinearGradient(0, PAD_T, 0, PAD_T + gH);
  grad.addColorStop(0, '#dd3322');   // high rating = harder = red
  grad.addColorStop(0.5, '#DAA520'); // mid = gold
  grad.addColorStop(1, '#44cc44');   // low rating = easier = green

  // Fill area under curve
  ctx.beginPath();
  ctx.moveTo(xOf(0), yOf(points[0].ra));
  for(let i = 1; i < points.length; i++) ctx.lineTo(xOf(i), yOf(points[i].ra));
  ctx.lineTo(xOf(points.length - 1), PAD_T + gH);
  ctx.lineTo(xOf(0), PAD_T + gH);
  ctx.closePath();
  ctx.fillStyle = 'rgba(218,165,32,0.05)';
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
    ctx.fillStyle = isWin ? '#44cc44' : '#dd3322';
    ctx.fill();
    if(isMP){
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#DAA520';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // Current rating dot (larger, glowing)
  const lastX = xOf(points.length - 1);
  const lastY = yOf(points[points.length - 1].ra);
  ctx.beginPath();
  ctx.arc(lastX, lastY, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#DAA520';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(lastX, lastY, 8, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(218,165,32,0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();
}
