// ── CAMPAIGN MODE ──
// Self-contained mission logic. Reuses the RTS engine (rts-canvas, S state,
// entity factories, rendering) but bypasses AI economy and win/loss flow.

const CAMPAIGN_MISSIONS = {
  shadow: {
    id: 'shadow_survival',
    faction: 'shadow',
    enemyFaction: 'prism',
    duration: 180,    // seconds
    startGold: 150,
    goldPerSec: 0,    // workers provide income naturally
  },
};

// Waves: `at` = elapsed seconds when the wave spawns.
// Units spawn at PLAYER_BASE_X+900, so add ~21s travel time for first contact.
// All attackers are Prism Armada — Witches (makeWarrior), Oracles (makeElite), Wizards (makeWizard)
const CAMPAIGN_WAVES = [
  { at: 40,  squads: [{ fn:'makeWarrior', faction:'prism', n:3 }] },
  { at: 63,  squads: [{ fn:'makeWarrior', faction:'prism', n:5 }] },
  { at: 84,  squads: [{ fn:'makeWarrior', faction:'prism', n:6 }] },
  { at: 103, squads: [{ fn:'makeWarrior', faction:'prism', n:5 }, { fn:'makeElite',   faction:'prism', n:2 }] },
  { at: 118, squads: [{ fn:'makeWarrior', faction:'prism', n:6 }, { fn:'makeElite',   faction:'prism', n:2 }] },
  { at: 133, squads: [{ fn:'makeWarrior', faction:'prism', n:6 }, { fn:'makeElite',   faction:'prism', n:3 }] },
  { at: 148, squads: [{ fn:'makeWarrior', faction:'prism', n:8 }, { fn:'makeElite',   faction:'prism', n:2 }, { fn:'makeWizard', faction:'prism', n:2 }] },
  { at: 160, squads: [{ fn:'makeWarrior', faction:'prism', n:10}, { fn:'makeElite',   faction:'prism', n:3 }, { fn:'makeWizard', faction:'prism', n:3 }] },
];

const _waveFn = { makeWarrior, makeElite, makeWizard };

// ── START ──

function startCampaignMission(faction) {
  const mission = CAMPAIGN_MISSIONS[faction];
  if (!mission) return;

  resetRtsState();
  S.playerFaction = faction;
  S.enemyFaction  = mission.enemyFaction;
  S.campaignMode  = mission;
  S.fromCampaign  = faction;
  S.campaignTimer     = 0;
  S.campaignGoldTimer = 0;
  S.campaignWaveIdx   = 0;

  _nextEntityId = 1;
  rtsRandSeed(42);
  if (typeof rtsCommandQueue !== 'undefined') rtsCommandQueue.length = 0;
  if (typeof _pendingChains  !== 'undefined') _pendingChains.length  = 0;
  if (typeof deadSwordsmenPool !== 'undefined') deadSwordsmenPool.length = 0;
  closeBuildPopup && closeBuildPopup();

  // Player base
  S.playerBase = makeBase('player', faction);
  S.entities.push(S.playerBase);

  // Enemy base — very high HP so it's never destroyed (not the win condition)
  S.enemyBase = makeBase('enemy', mission.enemyFaction);
  S.enemyBase.hp = S.enemyBase.maxHp = 9999;
  S.entities.push(S.enemyBase);

  // Pre-built Training Field (skip construction)
  const tf = makeBarracks('player', faction, PLAYER_BASE_X + 200, BASE_Y + 110);
  tf.underConstruction = false;
  tf.buildProgress = tf.buildTime;
  S.entities.push(tf);

  // 3 starting Swordsmen
  for (let i = 0; i < 3; i++) S.entities.push(makeWarrior('player', faction));

  // 5 starting Workers — they mine gold naturally; no passive trickle needed
  for (let i = 0; i < 5; i++) S.entities.push(makeWorker('player', faction));

  makeGoldNodes();
  S.gold.player = mission.startGold;
  S.gold.enemy  = 0;

  // HUD
  const pCfg = FACTION_CFG[faction];
  document.getElementById('rts-faction-badge').textContent = pCfg.barracksName + ' ARMADA';
  document.getElementById('rts-faction-badge').style.color = pCfg.color;
  document.getElementById('hud-building-name').textContent = pCfg.barracksName;
  document.getElementById('rts-enemy-faction').textContent = 'PRISM ARMADA';
  document.getElementById('rts-enemy-faction').style.color = FACTION_CFG['prism'].color;
  const diffEl = document.getElementById('rts-difficulty');
  if (diffEl) diffEl.textContent = '—';

  const timerBar = document.getElementById('campaign-timer-bar');
  if (timerBar) timerBar.style.display = '';

  rtsSetLog('The Prism Armada attacks! Mine gold with your Shades, train Swordsmen — no Bloodhounds.');
  initCamera(faction);

  if (S.raf) cancelAnimationFrame(S.raf);
  rtsLastTime = performance.now();
  rtsAccum = 0;
  S.raf = requestAnimationFrame(rtsLoop);
}

// ── TICK (called from rtsTick instead of aiTick when S.campaignMode is set) ──

function campaignTick() {
  const mission = S.campaignMode;
  if (!mission) return;

  S.campaignTimer++;

  // Passive gold trickle
  S.campaignGoldTimer++;
  if (S.campaignGoldTimer >= 60) {
    S.campaignGoldTimer = 0;
    S.gold.player += mission.goldPerSec;
  }

  // Spawn waves
  const elapsed = S.campaignTimer / 60;
  while (S.campaignWaveIdx < CAMPAIGN_WAVES.length &&
         elapsed >= CAMPAIGN_WAVES[S.campaignWaveIdx].at) {
    _spawnWave(CAMPAIGN_WAVES[S.campaignWaveIdx], S.campaignWaveIdx + 1);
    S.campaignWaveIdx++;
  }

  // Update timer HUD
  const remaining = Math.max(0, mission.duration - elapsed);
  const timerEl = document.getElementById('campaign-timer');
  if (timerEl) {
    const m = Math.floor(remaining / 60);
    const s = Math.floor(remaining % 60);
    timerEl.textContent = m + ':' + String(s).padStart(2, '0');
    timerEl.style.color = remaining < 30 ? '#ff4444' : remaining < 60 ? '#ffaa00' : '#00f5ff';
  }

  // Victory condition
  if (S.campaignTimer >= mission.duration * 60) {
    endCampaign(true);
  }
}

function _spawnWave(wave, waveNum) {
  // Spawn close to the player so waves arrive in ~20s, not 88s.
  // PLAYER_BASE_X + 900 gives ~21s travel time at Witch speed (0.7 px/tick @ 60fps).
  const spawnX = PLAYER_BASE_X + 900;
  const spawnY = BASE_Y;
  for (const sq of wave.squads) {
    const factory = _waveFn[sq.fn];
    if (!factory) continue;
    for (let i = 0; i < sq.n; i++) {
      const unit = factory('enemy', sq.faction, spawnX, spawnY + (rtsRand() - 0.5) * 400);
      unit.state = 'march';
      S.entities.push(unit);
    }
  }
  rtsSetLog('⚠ Wave ' + waveNum + ' incoming!');
}

// ── END ──

function endCampaign(won) {
  S.gameOver = true;
  const ov    = document.getElementById('rts-gameover-overlay');
  const title = document.getElementById('rts-over-title');
  const sub   = document.getElementById('rts-over-sub');
  const ratingEl = document.getElementById('rts-over-rating');
  if (ratingEl) ratingEl.style.display = 'none';
  ov.style.display = 'flex';
  if (won) {
    title.textContent  = 'MISSION COMPLETE';
    title.className    = 'rts-over-title win';
    sub.textContent    = 'You held the void for 3 minutes. The Shadow Armada stands!';
  } else {
    title.textContent  = 'MISSION FAILED';
    title.className    = 'rts-over-title lose';
    sub.textContent    = 'Your base has fallen. The void claims another soul.';
  }
  if (window.posthog) posthog.capture('campaign_mission_ended', {
    faction: S.playerFaction,
    outcome: won ? 'victory' : 'defeat',
    wave_reached: S.campaignWaveIdx,
    seconds_survived: Math.floor((S.campaignTimer || 0) / 60),
  });
}

// ── REGISTRATION ──

document.addEventListener('DOMContentLoaded', function () {
  registerGame('campaign', {
    init()    { document.getElementById('campaign-select').style.display = ''; },
    cleanup() {},
  });

  document.getElementById('cc-shadow').addEventListener('click', function () {
    S.fromCampaign = 'shadow';
    switchTab('cs', document.getElementById('tab-btn-cs'));
    startCampaignMission('shadow');
  });
});

//# sourceMappingURL=campaign.js.map
