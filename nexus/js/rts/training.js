// ── TRAINING MODE ──
// A lightweight AI advisor that walks a new commander through their first
// battle: economy → barracks → army → attack. Auto-advances as the player
// completes each step, but "GOT IT" always lets them skip ahead.

const TRAINING_STEPS = [
  {
    text: (cfg, fd) => `Welcome, Commander of the ${fd.armada}! I'm your AI advisor, guided by the spirit of ${fd.champion}, here to walk you through your first Deep Space Ops battle, step by step. Click GOT IT to begin.`,
  },
  {
    text: (cfg) => `First, click your glowing ${cfg.buildingName} to open its build menu.`,
    check: () => S.buildingSource === S.playerBase,
  },
  {
    text: (cfg) => `Queue up an extra ${cfg.workerLabel} — more ${cfg.workerLabel}S mean faster gold income.`,
    check: () => S.entities.filter(e => e.side === 'player' && e.type === 'worker').length > 5,
  },
  {
    text: (cfg) => `${cfg.workerLabel}S automatically mine nearby gold nodes and haul it home. Watch your GOLD counter climb.`,
    check: () => S.gold.player >= 150,
  },
  {
    text: (cfg) => `Click one of your ${cfg.workerLabel}S (not your ${cfg.buildingName}) and choose to build a ${cfg.barracksLabel} — it trains ${cfg.warriorLabel}S to fight for you.`,
    check: () => S.entities.some(e => e.side === 'player' && e.isBarracks),
  },
  {
    text: (cfg) => `Queue a few ${cfg.warriorLabel}S from the ${cfg.barracksLabel} once it finishes building.`,
    check: () => S.entities.some(e => e.side === 'player' && e.type === 'warrior'),
  },
  {
    text: (cfg) => `Select your ${cfg.warriorLabel}S (SELECT ARMY, or drag a box around them) and right-click the enemy base to attack!`,
    check: () => S.entities.some(e => e.side === 'player' && e.type === 'warrior' && e.state === 'march'),
  },
  {
    text: (cfg, fd) => `That's the core loop — mine gold, build ${cfg.workerLabel}S and ${cfg.warriorLabel}S, then attack. ${fd.champion} would be proud, Commander. Destroy the enemy base to win!`,
  },
];

let _trainingStepIdx = 0;
let _trainingTimer = null;

function isTrainingMode(){ return !!window._dsoTrainingMode; }

// Eases off the adaptive AI so a first-time commander has room to learn.
function applyTrainingEasyMode(){
  AI_CONFIG.buildInterval = 900;
  AI_CONFIG.trainInterval = 500;
  AI_CONFIG.attackInterval = 2200;
  AI_CONFIG.maxWorkers = 4;
  AI_CONFIG.resourceBonus = 0.5;
  AI_CONFIG.attackMinWarriors = 10;
  AI_CONFIG.attackMatchMin = 6;
  AI_CONFIG.mistakeChance = 0.6;
  AI_CONFIG.attackPartialChance = 0.7;
}

function startTrainingGuide(){
  _trainingStepIdx = 0;
  const panel = document.getElementById('training-guide');
  if(!panel) return;
  panel.style.display = 'flex';
  renderTrainingStep();
  if(_trainingTimer) clearInterval(_trainingTimer);
  _trainingTimer = setInterval(_trainingAutoAdvance, 500);
}

function stopTrainingGuide(){
  if(_trainingTimer){ clearInterval(_trainingTimer); _trainingTimer = null; }
  const panel = document.getElementById('training-guide');
  if(panel) panel.style.display = 'none';
}

function renderTrainingStep(){
  const step = TRAINING_STEPS[_trainingStepIdx];
  const textEl = document.getElementById('training-guide-text');
  const nextBtn = document.getElementById('btn-training-next');
  if(!step || !textEl) return;
  const cfg = FACTION_CFG[S.playerFaction] || FACTION_CFG.prism;
  const fd = FACTION_DATA[S.playerFaction] || FACTION_DATA.prism;
  textEl.textContent = typeof step.text === 'function' ? step.text(cfg, fd) : step.text;
  if(nextBtn) nextBtn.textContent = _trainingStepIdx >= TRAINING_STEPS.length - 1 ? 'GOT IT' : 'GOT IT ▸';
}

function advanceTrainingStep(){
  if(_trainingStepIdx >= TRAINING_STEPS.length - 1){
    stopTrainingGuide();
    return;
  }
  _trainingStepIdx++;
  renderTrainingStep();
}

function _trainingAutoAdvance(){
  if(!isTrainingMode() || !S.raf || S.gameOver) return;
  const step = TRAINING_STEPS[_trainingStepIdx];
  if(step && typeof step.check === 'function' && step.check()) advanceTrainingStep();
}

//# sourceMappingURL=training.js.map
