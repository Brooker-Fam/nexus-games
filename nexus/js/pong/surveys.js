// ── ATARI PONG POSTHOG SURVEYS ──
// Programmatic, self-contained survey modals. Dashboard survey definitions are not required.

const PONG_SURVEY_IDS = {
  postGameEnjoyment: 'survey_pong_postgame_enjoyment',
  firstVisitDiscovery: 'survey_pong_first_visit_discovery',
  modePreference: 'survey_pong_mode_preference',
  difficultySatisfaction: 'survey_pong_difficulty_satisfaction',
  generalFeedback: 'survey_pong_general_feedback',
};

const PONG_SURVEY_NAMES = {
  [PONG_SURVEY_IDS.postGameEnjoyment]: 'Post-game enjoyment',
  [PONG_SURVEY_IDS.firstVisitDiscovery]: 'First-visit discovery',
  [PONG_SURVEY_IDS.modePreference]: 'Mode preference reason',
  [PONG_SURVEY_IDS.difficultySatisfaction]: 'Difficulty satisfaction',
  [PONG_SURVEY_IDS.generalFeedback]: 'General feedback / feature requests',
};

const PONG_SURVEY_SESSION_KEYS = {
  modePreference: 'pong_survey_mode_preference_shown',
  difficultySatisfaction: 'pong_survey_difficulty_satisfaction_shown',
  generalFeedback: 'pong_survey_general_feedback_shown',
  singlePlayerGames: 'pong_single_player_games_completed',
};

let pongSurveyActive = null;
let pongSurveyQueue = [];

function pongSurveyCapture(eventName, properties){
  if(window.posthog && typeof window.posthog.capture === 'function'){
    posthog.capture(eventName, properties);
  }
}

function pongSurveyGetSession(key){
  try { return sessionStorage.getItem(key); }
  catch(e){ return window['__' + key] || null; }
}

function pongSurveySetSession(key, value){
  try { sessionStorage.setItem(key, value); }
  catch(e){ window['__' + key] = String(value); }
}

function pongSurveyHasSession(key){
  return pongSurveyGetSession(key) === '1';
}

function pongSurveyMarkSession(key){
  pongSurveySetSession(key, '1');
}

function pongSurveyIncrementSessionCounter(key){
  const next = (parseInt(pongSurveyGetSession(key) || '0', 10) || 0) + 1;
  pongSurveySetSession(key, String(next));
  return next;
}

function pongSurveyContainer(){
  let container = document.getElementById('pongSurveyContainer');
  if(!container){
    const host = document.querySelector('#tab-pong .pong-canvas-wrap') || document.getElementById('tab-pong') || document.body;
    container = document.createElement('div');
    container.id = 'pongSurveyContainer';
    container.className = 'pong-survey-container';
    host.appendChild(container);
  }
  return container;
}

function pongSurveyEscapeHtml(value){
  return String(value == null ? '' : value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function pongSurveyBaseCard(config, bodyHtml){
  return `
    <div class="pong-survey-card" role="dialog" aria-modal="false" aria-labelledby="pongSurveyTitle">
      <button class="pong-survey-close" type="button" data-pong-survey-dismiss aria-label="Close survey">×</button>
      <div class="pong-survey-kicker">Quick question</div>
      <div class="pong-survey-title" id="pongSurveyTitle">${pongSurveyEscapeHtml(config.question)}</div>
      <form class="pong-survey-form" data-pong-survey-form>
        ${bodyHtml}
      </form>
    </div>
  `;
}

function pongSurveyRatingHtml(config){
  const buttons = [1, 2, 3, 4, 5].map(function(score){
    return `<button class="pong-survey-rating" type="submit" name="rating" value="${score}">${score}</button>`;
  }).join('');
  return pongSurveyBaseCard(config, `<div class="pong-survey-rating-row" aria-label="Rating from 1 to 5">${buttons}</div>`);
}

function pongSurveyChoiceHtml(config){
  const choices = ['GitHub', 'Friend', 'Search', 'Other'].map(function(choice){
    const safe = pongSurveyEscapeHtml(choice);
    return `<button class="pong-survey-choice" type="submit" name="choice" value="${safe}">${safe}</button>`;
  }).join('');
  return pongSurveyBaseCard(config, `<div class="pong-survey-choice-grid">${choices}</div>`);
}

function pongSurveyTextHtml(config){
  return pongSurveyBaseCard(config, `
    <textarea class="pong-survey-textarea" name="response" rows="4" maxlength="500" placeholder="Type your answer..."></textarea>
    <button class="pong-survey-submit" type="submit">Send feedback</button>
  `);
}

function pongSurveyDifficultyHtml(config){
  const buttons = [1, 2, 3, 4, 5].map(function(score){
    return `<button class="pong-survey-rating" type="button" data-pong-difficulty-rating="${score}">${score}</button>`;
  }).join('');
  return pongSurveyBaseCard(config, `
    <div class="pong-survey-rating-row" aria-label="Rating from 1 to 5">${buttons}</div>
    <textarea class="pong-survey-textarea" name="comment" rows="3" maxlength="500" placeholder="Optional: what should change?"></textarea>
    <button class="pong-survey-submit" type="submit">Send rating</button>
  `);
}

function pongSurveyRenderHtml(config){
  if(config.type === 'rating') return pongSurveyRatingHtml(config);
  if(config.type === 'choice') return pongSurveyChoiceHtml(config);
  if(config.type === 'difficulty') return pongSurveyDifficultyHtml(config);
  return pongSurveyTextHtml(config);
}

function pongSurveyDismiss(answered){
  if(!pongSurveyActive) return;
  const active = pongSurveyActive;
  const container = pongSurveyContainer();
  container.innerHTML = '';
  pongSurveyActive = null;
  if(!answered){
    pongSurveyCapture('survey dismissed', {
      $survey_id: active.id,
      $survey_name: active.name,
    });
  }
  pongSurveyShowNext();
}

function pongSurveySubmit(config, answer, extraProperties){
  const properties = Object.assign({
    $survey_id: config.id,
    $survey_response: answer,
    $survey_name: config.name,
  }, extraProperties || {});
  pongSurveyCapture('survey sent', properties);
  pongSurveyDismiss(true);
}

function pongSurveyAttach(config){
  const container = pongSurveyContainer();
  const dismiss = container.querySelector('[data-pong-survey-dismiss]');
  const form = container.querySelector('[data-pong-survey-form]');

  if(dismiss){
    dismiss.addEventListener('click', function(e){
      e.preventDefault();
      pongSurveyDismiss(false);
    });
  }

  if(config.type === 'difficulty'){
    let rating = null;
    container.querySelectorAll('[data-pong-difficulty-rating]').forEach(function(button){
      button.addEventListener('click', function(){
        rating = parseInt(button.dataset.pongDifficultyRating, 10);
        container.querySelectorAll('[data-pong-difficulty-rating]').forEach(function(btn){ btn.classList.remove('selected'); });
        button.classList.add('selected');
      });
    });
    form.addEventListener('submit', function(e){
      e.preventDefault();
      if(!rating) return;
      const comment = (new FormData(form).get('comment') || '').toString().trim();
      pongSurveySubmit(config, { rating, comment }, {
        rating,
        comment,
        single_player_games_completed: config.singlePlayerGamesCompleted,
      });
    });
    return;
  }

  form.addEventListener('submit', function(e){
    e.preventDefault();
    const submitter = e.submitter;
    if(config.type === 'rating'){
      const rating = parseInt(submitter && submitter.value, 10);
      if(!rating) return;
      pongSurveySubmit(config, rating, {
        rating,
        mode: config.mode,
        difficulty: config.difficulty,
        winner: config.winner,
      });
      return;
    }
    if(config.type === 'choice'){
      const choice = submitter && submitter.value;
      if(!choice) return;
      pongSurveySubmit(config, choice, { discovery_source: choice });
      return;
    }
    const response = (new FormData(form).get('response') || '').toString().trim();
    if(!response) return;
    pongSurveySubmit(config, response, config.extraProperties || {});
  });
}

function pongSurveyShowNext(){
  if(pongSurveyActive || !pongSurveyQueue.length) return;
  const config = pongSurveyQueue.shift();
  config.name = PONG_SURVEY_NAMES[config.id];
  pongSurveyActive = config;
  const container = pongSurveyContainer();
  container.innerHTML = pongSurveyRenderHtml(config);
  pongSurveyAttach(config);
  pongSurveyCapture('survey shown', {
    $survey_id: config.id,
    $survey_name: config.name,
    trigger: config.trigger,
  });
}

function pongSurveyEnqueue(config){
  pongSurveyQueue.push(config);
  pongSurveyShowNext();
}

function pongSurveyHandleFirstVisit(){
  pongSurveyEnqueue({
    id: PONG_SURVEY_IDS.firstVisitDiscovery,
    type: 'choice',
    question: 'How did you discover this Pong game?',
    trigger: 'first_visit_welcome_screen',
  });
}

function pongSurveyHandleModeSelected(detail){
  if(pongSurveyHasSession(PONG_SURVEY_SESSION_KEYS.modePreference)) return;
  pongSurveyMarkSession(PONG_SURVEY_SESSION_KEYS.modePreference);
  const modeLabel = detail.mode === '1p' ? 'single-player' : 'two-player';
  pongSurveyEnqueue({
    id: PONG_SURVEY_IDS.modePreference,
    type: 'text',
    question: `Why did you choose ${modeLabel} mode?`,
    trigger: 'mode_selected',
    extraProperties: { mode: detail.mode, mode_label: modeLabel },
  });
}

function pongSurveyHandleGameOver(detail){
  pongSurveyEnqueue({
    id: PONG_SURVEY_IDS.postGameEnjoyment,
    type: 'rating',
    question: 'How much did you enjoy this game of Pong?',
    trigger: 'game_over',
    mode: detail.mode,
    difficulty: detail.difficulty,
    winner: detail.winner,
  });

  if(detail.mode !== '1p') return;
  const completed = pongSurveyIncrementSessionCounter(PONG_SURVEY_SESSION_KEYS.singlePlayerGames);
  if(completed >= 3 && !pongSurveyHasSession(PONG_SURVEY_SESSION_KEYS.difficultySatisfaction)){
    pongSurveyMarkSession(PONG_SURVEY_SESSION_KEYS.difficultySatisfaction);
    pongSurveyEnqueue({
      id: PONG_SURVEY_IDS.difficultySatisfaction,
      type: 'difficulty',
      question: 'Are you satisfied with the AI difficulty options?',
      trigger: 'single_player_game_3_completed',
      singlePlayerGamesCompleted: completed,
    });
  }
}

function pongSurveyHandlePauseOrIdle(detail){
  if(pongSurveyHasSession(PONG_SURVEY_SESSION_KEYS.generalFeedback)) return;
  pongSurveyMarkSession(PONG_SURVEY_SESSION_KEYS.generalFeedback);
  pongSurveyEnqueue({
    id: PONG_SURVEY_IDS.generalFeedback,
    type: 'text',
    question: 'Any feedback or feature requests for Pong?',
    trigger: detail.reason || 'pause_or_idle',
    extraProperties: { trigger_reason: detail.reason || 'pause_or_idle' },
  });
}

window.addEventListener('pong:event', function(e){
  const detail = e.detail || {};
  if(detail.type === 'first_visit') pongSurveyHandleFirstVisit(detail);
  if(detail.type === 'mode_selected') pongSurveyHandleModeSelected(detail);
  if(detail.type === 'game_over') pongSurveyHandleGameOver(detail);
  if(detail.type === 'pause_or_idle') pongSurveyHandlePauseOrIdle(detail);
});

//# sourceMappingURL=surveys.js.map
