// ── ATARI PONG POSTHOG SURVEYS ──
// Listens for core Pong's CustomEvent('pong:event', { detail: { type, ... } })
// contract and renders non-blocking survey toasts for active PostHog API surveys.
(function(){
  const PONG_SURVEY_EVENT = 'pong:event';
  const PONG_SURVEY_TITLE = 'Pong feedback';

  const PONG_SURVEY_DEFINITIONS = {
    postGameEnjoyment: {
      key: 'pong_post_game_enjoyment',
      triggerType: 'game_over',
      title: 'Post-game enjoyment',
      fields: [
        {
          id: 'enjoyment_rating',
          kind: 'rating',
          question: 'How much did you enjoy that match?',
          required: true,
          min: 1,
          max: 5,
        },
        {
          id: 'enjoyment_comment',
          kind: 'textarea',
          question: 'Anything you want to add?',
          placeholder: 'Optional comment',
          required: false,
        },
      ],
    },
    firstVisitDiscovery: {
      key: 'pong_first_visit_discovery',
      triggerType: 'first_visit',
      title: 'First-visit discovery',
      fields: [
        {
          id: 'discovery_source',
          kind: 'choice',
          question: 'How did you find this game?',
          required: true,
          choices: [
            { value: 'friend', label: 'Friend' },
            { value: 'social', label: 'Social' },
            { value: 'search', label: 'Search' },
            { value: 'other', label: 'Other' },
          ],
        },
      ],
    },
    modePreferenceReason: {
      key: 'pong_mode_preference_reason',
      triggerType: 'mode_selected',
      title: 'Mode preference',
      fields: [
        {
          id: 'mode_reason',
          kind: 'text',
          question(detail){ return 'Why did you choose ' + pongSurveyModeLabel(detail) + '?'; },
          placeholder: 'Tell us briefly',
          required: true,
        },
      ],
    },
    difficultySatisfaction: {
      key: 'pong_difficulty_satisfaction',
      triggerType: 'returned_to_menu',
      title: 'Difficulty satisfaction',
      predicate(detail){ return pongSurveyNumber(detail, ['rounds_played', 'roundsPlayed']) >= 2; },
      fields: [
        {
          id: 'difficulty_rating',
          kind: 'choice',
          question: 'How was the difficulty?',
          required: true,
          choices: [
            { value: 'too_easy', label: 'Too easy' },
            { value: 'just_right', label: 'Just right' },
            { value: 'too_hard', label: 'Too hard' },
          ],
        },
      ],
    },
    generalFeedback: {
      key: 'pong_general_feedback',
      triggerType: 'pause_or_idle',
      title: 'General feedback',
      fields: [
        {
          id: 'general_feedback',
          kind: 'textarea',
          question: 'Any feedback or feature requests?',
          placeholder: 'Share ideas, bugs, or requests',
          required: true,
        },
      ],
    },
  };

  const pongSurveyState = {
    active: false,
    loading: false,
    queue: [],
    completedThisPage: {},
  };

  window.PONG_SURVEY_KEYS = Object.freeze(Object.keys(PONG_SURVEY_DEFINITIONS).reduce(function(keys, name){
    keys[name] = PONG_SURVEY_DEFINITIONS[name].key;
    return keys;
  }, {}));

  window.pongSurveys = {
    trigger(detail){ pongSurveyHandleEvent({ detail }); },
    surveyKeys: window.PONG_SURVEY_KEYS,
  };

  window.addEventListener(PONG_SURVEY_EVENT, pongSurveyHandleEvent, true);

  function pongSurveyHandleEvent(event){
    const detail = event && event.detail ? event.detail : {};
    const type = detail.type || detail.event_type || detail.eventType;
    if(!type || !pongSurveysEnabled()) return;

    Object.keys(PONG_SURVEY_DEFINITIONS).forEach(function(name){
      const definition = PONG_SURVEY_DEFINITIONS[name];
      if(definition.triggerType !== type) return;
      if(definition.predicate && !definition.predicate(detail)) return;
      pongSurveyEnqueue(definition, detail);
    });
  }

  function pongSurveyEnqueue(definition, detail){
    if(pongSurveyState.completedThisPage[definition.key]) return;
    if(pongSurveyState.active && pongSurveyState.active.key === definition.key) return;
    if(pongSurveyState.queue.some(function(item){ return item.definition.key === definition.key; })) return;
    pongSurveyState.queue.push({ definition, detail: detail || {} });
    pongSurveyPumpQueue();
  }

  function pongSurveyPumpQueue(){
    if(pongSurveyState.active || pongSurveyState.loading || !pongSurveyState.queue.length) return;
    const item = pongSurveyState.queue.shift();
    pongSurveyState.loading = true;
    pongSurveyFindPostHogSurvey(item.definition, function(survey){
      pongSurveyState.loading = false;
      if(!survey){
        pongSurveyPumpQueue();
        return;
      }
      pongSurveyShow(item.definition, item.detail, survey);
    });
  }

  function pongSurveyFindPostHogSurvey(definition, callback){
    const ph = window.posthog;
    if(!pongSurveysEnabled()){
      callback(null);
      return;
    }

    const surveyLoader = typeof ph.getActiveMatchingSurveys === 'function'
      ? ph.getActiveMatchingSurveys.bind(ph)
      : (typeof ph.getSurveys === 'function' ? ph.getSurveys.bind(ph) : null);

    if(!surveyLoader){
      callback(null);
      return;
    }

    surveyLoader(function(surveys, context){
      if(context && context.error){
        callback(null);
        return;
      }
      const key = pongSurveyNormalize(definition.key);
      const match = (surveys || []).find(function(survey){
        const name = pongSurveyNormalize(survey.name);
        const id = pongSurveyNormalize(survey.id);
        const description = pongSurveyNormalize(survey.description);
        return name === key || id === key || name.indexOf(key) !== -1 || description.indexOf(key) !== -1;
      });
      callback(match || null);
    }, false);
  }

  function pongSurveyShow(definition, detail, survey){
    pongSurveyInjectStyles();

    const existing = document.getElementById('pong-survey-toast');
    if(existing) existing.remove();

    const toast = document.createElement('section');
    toast.id = 'pong-survey-toast';
    toast.className = 'pong-survey-toast';
    toast.setAttribute('role', 'dialog');
    toast.setAttribute('aria-live', 'polite');
    toast.setAttribute('aria-label', definition.title || PONG_SURVEY_TITLE);

    const head = document.createElement('div');
    head.className = 'pong-survey-head';

    const eyebrow = document.createElement('div');
    eyebrow.className = 'pong-survey-eyebrow';
    eyebrow.textContent = PONG_SURVEY_TITLE;

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'pong-survey-close';
    close.setAttribute('aria-label', 'Dismiss Pong feedback survey');
    close.textContent = '×';

    head.append(eyebrow, close);

    const title = document.createElement('h2');
    title.textContent = definition.title;

    const form = document.createElement('form');
    form.className = 'pong-survey-form';

    const fieldQuestions = definition.fields.map(function(field, index){
      return pongSurveyQuestionFor(survey, definition, field, index, detail);
    });

    definition.fields.forEach(function(field, index){
      form.appendChild(pongSurveyRenderField(definition, field, fieldQuestions[index], index));
    });

    const error = document.createElement('div');
    error.className = 'pong-survey-error';
    error.setAttribute('aria-live', 'assertive');

    const actions = document.createElement('div');
    actions.className = 'pong-survey-actions';

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'pong-survey-submit';
    submit.textContent = 'Send';

    const skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'pong-survey-skip';
    skip.textContent = 'Not now';

    actions.append(skip, submit);
    form.append(error, actions);
    toast.append(head, title, form);

    toast.addEventListener('keydown', function(e){ e.stopPropagation(); });
    close.addEventListener('click', function(){ pongSurveyDismiss(definition, survey, toast, fieldQuestions, detail); });
    skip.addEventListener('click', function(){ pongSurveyDismiss(definition, survey, toast, fieldQuestions, detail); });

    form.addEventListener('submit', function(e){
      e.preventDefault();
      const response = pongSurveyBuildResponse(form, definition, fieldQuestions);
      if(!response.valid){
        error.textContent = 'Please answer the required question before sending.';
        return;
      }
      pongSurveySubmit(definition, survey, toast, fieldQuestions, response.responses, detail);
    });

    document.body.appendChild(toast);
    pongSurveyState.active = { key: definition.key, element: toast };
    pongSurveyCapture('survey shown', definition, survey, detail, {});
  }

  function pongSurveyRenderField(definition, field, question, index){
    const wrapper = document.createElement('fieldset');
    wrapper.className = 'pong-survey-field';

    const legend = document.createElement('legend');
    legend.textContent = question.question;
    wrapper.appendChild(legend);

    if(field.kind === 'rating'){
      const scale = document.createElement('div');
      scale.className = 'pong-survey-scale';
      for(let value = field.min; value <= field.max; value += 1){
        const label = document.createElement('label');
        label.className = 'pong-survey-scale-option';
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = pongSurveyFieldName(definition, field, index);
        input.value = String(value);
        input.required = !!field.required;
        const span = document.createElement('span');
        span.textContent = String(value);
        label.append(input, span);
        scale.appendChild(label);
      }
      wrapper.appendChild(scale);
      return wrapper;
    }

    if(field.kind === 'choice'){
      const choices = document.createElement('div');
      choices.className = 'pong-survey-choices';
      field.choices.forEach(function(choice){
        const label = document.createElement('label');
        label.className = 'pong-survey-choice';
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = pongSurveyFieldName(definition, field, index);
        input.value = choice.value;
        input.required = !!field.required;
        const span = document.createElement('span');
        span.textContent = choice.label;
        label.append(input, span);
        choices.appendChild(label);
      });
      wrapper.appendChild(choices);
      return wrapper;
    }

    const textInput = document.createElement(field.kind === 'textarea' ? 'textarea' : 'input');
    if(field.kind !== 'textarea') textInput.type = 'text';
    textInput.name = pongSurveyFieldName(definition, field, index);
    textInput.placeholder = field.placeholder || '';
    textInput.required = !!field.required;
    if(field.kind === 'textarea') textInput.rows = 4;
    wrapper.appendChild(textInput);
    return wrapper;
  }

  function pongSurveyBuildResponse(form, definition, fieldQuestions){
    const responses = {};
    let valid = true;

    definition.fields.forEach(function(field, index){
      const name = pongSurveyFieldName(definition, field, index);
      const question = fieldQuestions[index];
      let value = null;

      if(field.kind === 'rating'){
        const selected = form.querySelector('input[name="' + name + '"]:checked');
        value = selected ? Number(selected.value) : null;
      }else if(field.kind === 'choice'){
        const selected = form.querySelector('input[name="' + name + '"]:checked');
        value = selected ? selected.value : null;
      }else{
        const input = form.elements[name];
        value = input && input.value ? input.value.trim() : '';
        if(value === '') value = null;
      }

      if(field.required && (value === null || value === '')) valid = false;
      responses['$survey_response_' + question.id] = value;
    });

    return { valid, responses };
  }

  function pongSurveySubmit(definition, survey, toast, fieldQuestions, responses, detail){
    const responseProps = pongSurveyResponseProperties(fieldQuestions, responses);
    pongSurveyCapture('survey sent', definition, survey, detail, Object.assign(responseProps, {
      '$survey_submission_id': pongSurveyUuid(),
      '$survey_completed': true,
    }));
    pongSurveyComplete(definition, toast);
  }

  function pongSurveyDismiss(definition, survey, toast, fieldQuestions, detail){
    const emptyResponses = {};
    fieldQuestions.forEach(function(question){ emptyResponses['$survey_response_' + question.id] = null; });
    pongSurveyCapture('survey dismissed', definition, survey, detail, pongSurveyResponseProperties(fieldQuestions, emptyResponses));
    pongSurveyComplete(definition, toast);
  }

  function pongSurveyComplete(definition, toast){
    pongSurveyState.completedThisPage[definition.key] = true;
    pongSurveyState.active = false;
    if(toast && toast.parentNode) toast.parentNode.removeChild(toast);
    pongSurveyPumpQueue();
  }

  function pongSurveyCapture(eventName, definition, survey, detail, extraProps){
    if(!pongSurveysEnabled() || !survey || !survey.id) return;
    const ph = window.posthog;
    const props = Object.assign({
      '$survey_name': survey.name,
      '$survey_id': survey.id,
      '$survey_iteration': survey.current_iteration || null,
      '$survey_iteration_start_date': survey.current_iteration_start_date || null,
      pong_survey_key: definition.key,
      pong_event_type: definition.triggerType,
      pong_mode: detail.mode || detail.player_mode || detail.playerMode || null,
      rounds_played: pongSurveyNumber(detail, ['rounds_played', 'roundsPlayed']) || null,
      sessionRecordingUrl: typeof ph.get_session_replay_url === 'function' ? ph.get_session_replay_url() : undefined,
    }, extraProps || {});

    if(eventName === 'survey sent'){
      props.$set = {};
      props.$set[pongSurveyInteractionProperty(survey, 'responded')] = true;
    }

    if(eventName === 'survey dismissed'){
      props.$set = {};
      props.$set[pongSurveyInteractionProperty(survey, 'dismissed')] = true;
    }

    ph.capture(eventName, props);
  }

  function pongSurveyResponseProperties(fieldQuestions, responses){
    const props = {
      '$survey_questions': fieldQuestions.map(function(question){
        return {
          id: question.id,
          question: question.question,
          response: responses['$survey_response_' + question.id],
        };
      }),
    };

    fieldQuestions.forEach(function(question, index){
      const value = responses['$survey_response_' + question.id];
      props['$survey_response_' + question.id] = value;
      props[index === 0 ? '$survey_response' : '$survey_response_' + index] = value;
    });

    return props;
  }

  function pongSurveyQuestionFor(survey, definition, field, index, detail){
    const configured = survey && survey.questions ? survey.questions[index] : null;
    const fallbackQuestion = typeof field.question === 'function' ? field.question(detail || {}) : field.question;
    const configuredId = configured && configured.id ? configured.id : null;
    return {
      id: configuredId || definition.key + '_' + field.id,
      question: fallbackQuestion || (configured && configured.question) || field.id,
    };
  }

  function pongSurveyFieldName(definition, field, index){
    return definition.key + '_' + field.id + '_' + index;
  }

  function pongSurveysEnabled(){
    return !!(window.POSTHOG_TOKEN && window.posthog && typeof window.posthog.capture === 'function');
  }

  function pongSurveyNormalize(value){
    return String(value || '').trim().toLowerCase();
  }

  function pongSurveyModeLabel(detail){
    const raw = String(detail.mode || detail.player_mode || detail.playerMode || detail.players || '').toLowerCase();
    if(raw.indexOf('2') !== -1 || raw.indexOf('two') !== -1 || raw.indexOf('versus') !== -1 || raw.indexOf('local') !== -1) return '2P';
    if(raw.indexOf('1') !== -1 || raw.indexOf('one') !== -1 || raw.indexOf('single') !== -1 || raw.indexOf('ai') !== -1) return '1P';
    return 'that mode';
  }

  function pongSurveyNumber(detail, keys){
    for(let i = 0; i < keys.length; i += 1){
      const value = Number(detail[keys[i]]);
      if(Number.isFinite(value)) return value;
    }
    return 0;
  }

  function pongSurveyInteractionProperty(survey, action){
    let property = '$survey_' + action + '/' + survey.id;
    if(survey.current_iteration && survey.current_iteration > 0){
      property += '/' + survey.current_iteration;
    }
    return property;
  }

  function pongSurveyUuid(){
    if(window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
  }

  function pongSurveyInjectStyles(){
    if(document.getElementById('pong-survey-styles')) return;
    const style = document.createElement('style');
    style.id = 'pong-survey-styles';
    style.textContent = `
      .pong-survey-toast {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 2147483000;
        width: min(360px, calc(100vw - 32px));
        padding: 16px;
        border: 1px solid rgba(0, 245, 255, 0.35);
        border-radius: 16px;
        background: rgba(2, 8, 16, 0.96);
        color: #f4fbff;
        box-shadow: 0 16px 44px rgba(0, 0, 0, 0.5), 0 0 28px rgba(0, 245, 255, 0.13);
        font-family: Rajdhani, system-ui, sans-serif;
      }
      .pong-survey-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .pong-survey-eyebrow {
        color: #00f5ff;
        font-family: Orbitron, system-ui, sans-serif;
        font-size: 0.72rem;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }
      .pong-survey-close {
        width: 30px;
        height: 30px;
        border: 1px solid rgba(255, 255, 255, 0.24);
        border-radius: 50%;
        background: transparent;
        color: #fff;
        cursor: pointer;
        font-size: 1.35rem;
        line-height: 1;
      }
      .pong-survey-toast h2 {
        margin: 8px 0 12px;
        color: #fff;
        font-family: Orbitron, system-ui, sans-serif;
        font-size: 1rem;
      }
      .pong-survey-field {
        margin: 0 0 12px;
        padding: 0;
        border: 0;
      }
      .pong-survey-field legend {
        margin-bottom: 8px;
        color: #d7f8ff;
        font-weight: 600;
      }
      .pong-survey-scale,
      .pong-survey-choices {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .pong-survey-scale-option,
      .pong-survey-choice {
        cursor: pointer;
      }
      .pong-survey-scale-option input,
      .pong-survey-choice input {
        position: absolute;
        opacity: 0;
        pointer-events: none;
      }
      .pong-survey-scale-option span,
      .pong-survey-choice span {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 34px;
        padding: 6px 12px;
        border: 1px solid rgba(0, 245, 255, 0.28);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.06);
      }
      .pong-survey-scale-option input:checked + span,
      .pong-survey-choice input:checked + span {
        border-color: #00f5ff;
        background: rgba(0, 245, 255, 0.18);
        color: #fff;
      }
      .pong-survey-field input[type="text"],
      .pong-survey-field textarea {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid rgba(0, 245, 255, 0.28);
        border-radius: 10px;
        background: rgba(0, 0, 0, 0.38);
        color: #fff;
        font: inherit;
        padding: 9px 10px;
        resize: vertical;
      }
      .pong-survey-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 12px;
      }
      .pong-survey-submit,
      .pong-survey-skip {
        border: 1px solid rgba(0, 245, 255, 0.35);
        border-radius: 999px;
        cursor: pointer;
        font-family: Orbitron, system-ui, sans-serif;
        font-size: 0.78rem;
        letter-spacing: 0.05em;
        padding: 8px 14px;
      }
      .pong-survey-submit {
        background: #00f5ff;
        color: #021018;
      }
      .pong-survey-skip {
        background: transparent;
        color: #d7f8ff;
      }
      .pong-survey-error {
        min-height: 1.1em;
        color: #ff7ca8;
        font-size: 0.9rem;
      }
    `;
    document.head.appendChild(style);
  }
})();

//# sourceMappingURL=surveys.js.map
