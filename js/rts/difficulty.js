// ── ADAPTIVE AI DIFFICULTY ──
// Tracks player wins/losses in localStorage and scales AI parameters.
// The more you win, the harder the AI gets. The more you lose, the easier.
// Phase 1: Sliding window over last 10 games with streak bonuses.

const DIFF_STORAGE_KEY = 'nexus_rts_difficulty';
const DIFF_SCHEMA_VERSION = 1;
const DIFF_HISTORY_MAX = 10;

function _diffDefaults(){
  return {
    v: DIFF_SCHEMA_VERSION,
    rating: 1000,       // 400 (easiest) – 1600 (hardest), start at midpoint
    gamesPlayed: 0,
    streak: 0,          // positive = consecutive wins, negative = consecutive losses
    history: [],        // ring buffer of last N game results
  };
}

function loadDifficultyData(){
  try {
    const raw = localStorage.getItem(DIFF_STORAGE_KEY);
    if(!raw) return _diffDefaults();
    const d = JSON.parse(raw);
    if(!d || d.v !== DIFF_SCHEMA_VERSION) return _diffDefaults();
    return d;
  } catch(e){ return _diffDefaults(); }
}

function saveDifficultyData(d){
  try { localStorage.setItem(DIFF_STORAGE_KEY, JSON.stringify(d)); }
  catch(e){ /* private browsing or quota exceeded — silently fail */ }
}

// Record a game result and return the rating change info
function recordGameResult(playerWon){
  if(window._mpMultiplayer) return null; // don't track multiplayer

  const d = loadDifficultyData();
  const before = d.rating;

  // Update streak counter
  if(playerWon){
    d.streak = d.streak > 0 ? d.streak + 1 : 1;
  } else {
    d.streak = d.streak < 0 ? d.streak - 1 : -1;
  }
  d.gamesPlayed++;

  // Ring buffer — keep last N results
  d.history.push({ ts: Date.now(), w: playerWon ? 1 : 0 });
  while(d.history.length > DIFF_HISTORY_MAX) d.history.shift();

  // Compute new rating from recent win rate
  const wins = d.history.filter(g => g.w).length;
  const total = d.history.length;
  const winRate = wins / total;

  // Map win rate → target rating in [400, 1600]
  const targetRating = 400 + winRate * 1200;

  // Blend toward target — faster early on, slower once settled
  const blend = total < 5 ? 0.4 : 0.25;
  d.rating = Math.round(d.rating + (targetRating - d.rating) * blend);

  // Streak bonus — accelerate adjustment on hot/cold runs
  const absStreak = Math.abs(d.streak);
  if(absStreak >= 3){
    const bonus = Math.min(absStreak - 2, 3) * 20; // +20, +40, +60 max
    d.rating += playerWon ? bonus : -bonus;
  }

  // Asymmetric: losses push rating down 30% harder (so relief comes faster)
  if(!playerWon){
    const extra = Math.round(Math.abs(d.rating - before) * 0.3);
    d.rating -= extra;
  }

  // Clamp to valid range
  d.rating = Math.max(400, Math.min(1600, d.rating));

  saveDifficultyData(d);
  return { before, after: d.rating, streak: d.streak, gamesPlayed: d.gamesPlayed };
}

// ── DIFFICULTY QUERIES ──

// Normalized 0.0 (easiest) → 1.0 (hardest)
function getDifficultyNorm(){
  const d = loadDifficultyData();
  return Math.max(0, Math.min(1, (d.rating - 400) / 1200));
}

// Display level 1–10
function getDifficultyLevel(){
  return Math.max(1, Math.min(10, Math.round(getDifficultyNorm() * 9) + 1));
}

// Lerp helper — interpolate between easy/hard values
function _diffLerp(easy, hard){
  const t = getDifficultyNorm();
  return Math.round(easy + (hard - easy) * t);
}

// ── APPLY TO AI ──
// Call once at game start to set AI_CONFIG parameters for this match.

function applyDifficultyToAI(){
  if(window._mpMultiplayer) return; // no scaling in multiplayer

  const t = getDifficultyNorm();

  // Decision cadence (ticks) — lower = AI reacts faster
  AI_CONFIG.buildInterval     = _diffLerp(360, 120);  // 6s → 2s
  AI_CONFIG.trainInterval     = _diffLerp(200, 80);   // 3.3s → 1.3s

  // Attack wave frequency — lower = more aggressive
  AI_CONFIG.attackInterval    = _diffLerp(600, 240);   // 10s → 4s

  // Economic power — more workers = more gold
  AI_CONFIG.maxWorkers        = _diffLerp(8, 18);

  // Attack thresholds — lower = attacks with fewer warriors
  AI_CONFIG.attackMinWarriors = _diffLerp(7, 3);
  AI_CONFIG.attackMatchMin    = _diffLerp(5, 2);

  // Gold gathering multiplier for AI workers
  AI_CONFIG.resourceBonus     = +(0.85 + t * 0.30).toFixed(2); // 0.85x → 1.15x
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
  const streakAbs = Math.abs(result.streak);
  const streakText = streakAbs >= 2
    ? ` · ${streakAbs} ${result.streak > 0 ? 'WIN' : 'LOSS'} STREAK`
    : '';
  el.innerHTML = `<span style="color:${color}">RATING ${sign}${delta}</span>`
    + ` · AI LEVEL ${level}/10`
    + `<span style="color:var(--text-dim)">${streakText}</span>`;
  el.style.display = 'block';
}
