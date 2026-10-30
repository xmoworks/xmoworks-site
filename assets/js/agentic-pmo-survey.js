(() => {
  'use strict';
  const form = document.getElementById('agentic-survey');
  if (!form) return;
  const field = name => form.elements.namedItem(name);
  const button = form.querySelector('button[type=submit]');
  const status = document.getElementById('survey-status');
  const params = new URLSearchParams(location.search);
  const isTest = params.get('test') === '1';
  const newId = () => {
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    const h = Array.from(b, x => x.toString(16).padStart(2,'0')).join('');
    return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-');
  };
  document.getElementById('test-notice').hidden = !isTest;
  button.disabled = false;
  let started = false;
  let attempt = null;
  form.addEventListener('focusin', () => {
    if (!started) { started = true; if (!isTest) window.XMO.track('agentic_survey_start'); }
  });
  const selected = name => Array.from(form.querySelectorAll('input[name="'+name+'"]:checked')).map(input => input.value);
  const syncOther = name => {
    const show = ['workaround','host'].includes(name) ? selected(name).includes('other') : field(name).value === 'other';
    const input = field(name+'_other');
    document.getElementById(name+'_other-group').hidden = !show;
    input.disabled = !show;
    if (!show) input.value = '';
  };
  for (const name of ['role','pain','gain']) field(name).addEventListener('change', () => syncOther(name));
  for (const name of ['workaround','host']) {
    for (const input of form.querySelectorAll('input[name="'+name+'"]')) input.addEventListener('change', () => {
      if (input.checked) for (const other of form.querySelectorAll('input[name="'+name+'"]')) {
        if (other !== input && (input.value === 'none' || other.value === 'none')) other.checked = false;
      }
      syncOther(name);
    });
  }
  field('pain').addEventListener('change', () => {
    const pain = field('pain').value;
    const skip = ['none','not_applicable'].includes(pain);
    const wasSkipped = field('frequency').disabled;
    document.getElementById('frequency-group').hidden = skip;
    field('frequency').required = !skip;
    field('frequency').disabled = skip;
    if (skip) field('frequency').value = pain;
    else if (wasSkipped) field('frequency').value = '';
    document.getElementById('impact-group').hidden = skip;
    for (const name of ['impact_type','impact_range','impact_note']) {
      field(name).disabled = skip || (name === 'impact_range' && !ranges[field('impact_type').value]);
      if (skip) field(name).value = '';
    }
    if (skip) field('impact_range').replaceChildren(new Option('No range needed',''));
    document.getElementById('example-question').textContent = skip
      ? 'If useful, what result would improve your work? Keep the example non-confidential.'
      : 'What happened the last time? Keep the example non-confidential.';
  });
  field('opt_in').addEventListener('change', () => {
    const enabled = field('opt_in').checked;
    document.getElementById('email-group').hidden = !enabled;
    field('email').disabled = !enabled;
    field('email').required = enabled;
    if (!enabled) field('email').value = '';
  });
  const ranges = {
    time: [['under2','Under 2 hours'],['2-8','2–8 hours'],['9-24','9–24 hours'],['25+','25+ hours']],
    cost: [['under1k','Under AED 1,000 equivalent'],['1k-5k','AED 1,000–5,000 equivalent'],['5k-20k','AED 5,001–20,000 equivalent'],['20k+','Over AED 20,000 equivalent']],
    delay: [['under1','Less than 1 working day'],['1-3','1–3 working days'],['4-10','4–10 working days'],['10+','Over 10 working days']]
  };
  field('impact_type').addEventListener('change', () => {
    const choices = ranges[field('impact_type').value];
    field('impact_range').replaceChildren();
    field('impact_range').add(new Option(choices ? 'Choose a range (optional)' : 'No range needed', ''));
    for (const [value, label] of choices || []) field('impact_range').add(new Option(label, value));
    if (choices) field('impact_range').add(new Option('Unknown', 'unknown'));
    field('impact_range').disabled = !choices;
  });
  const source = {};
  for (const key of ['utm_source','utm_medium','utm_campaign','utm_content']) {
    const value = params.get(key);
    if (value && /^[a-zA-Z0-9_ .:\/-]{1,120}$/.test(value)) source[key] = value;
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const val = name => String(data.get(name) || '').trim();
    const answers = Object.fromEntries(['role','context','pain','gain','frequency','impact_type','impact_range','impact_note','example'].map(name => [name,val(name)]));
    if (['none','not_applicable'].includes(answers.pain)) {
      answers.frequency = answers.pain;
      answers.impact_type = ''; answers.impact_range = ''; answers.impact_note = '';
    }
    for (const name of ['role_other','pain_other','gain_other','workaround_other','host_other']) answers[name] = val(name);
    if (val('host_permission')) answers.host_permission = val('host_permission');
    answers.workaround = data.getAll('workaround');
    answers.host = data.getAll('host');
    const payload = { schema_version:'agentic-pmo-v1.1', answers, source, opt_in:field('opt_in').checked,
      email:field('opt_in').checked ? val('email') : null, is_test:isTest, website:val('website') };
    const signature = JSON.stringify(payload);
    if (!attempt || attempt.signature !== signature) attempt = { signature, id:newId() };
    payload.submission_id = attempt.id;
    button.disabled = true;
    status.dataset.error = 'false';
    status.textContent = 'Sending your response…';
    try {
      const receipt = await window.XMO.api('agentic-pmo-survey',{method:'POST',body:payload,signal:AbortSignal.timeout(15000)});
      if (receipt.ok !== true || receipt.submission_id !== attempt.id || !Number.isFinite(Date.parse(receipt.received_at))) throw new Error('unconfirmed_receipt');
      if (!isTest) window.XMO.track('agentic_survey_complete');
      const confirmation = document.createElement('div');
      confirmation.className = 'ap-success'; confirmation.tabIndex = -1;
      const heading = document.createElement('h2'); heading.textContent = 'Thank you. Your response has been received.';
      const text = document.createElement('p');
      text.textContent = payload.opt_in ? 'You opted into development and early-access updates. We will use your supplied email for that purpose.' : 'You have not subscribed to email updates. No contact details were needed.';
      const note = document.createElement('p'); note.textContent = 'This is an expression of interest; no purchase or place in a paid pilot is implied.';
      const id = document.createElement('p'); id.className = 'ap-receipt'; id.textContent = 'Response ID: '+receipt.submission_id+(isTest ? ' · TEST ONLY — excluded from demand results' : '');
      confirmation.append(heading,text,note,id); form.replaceChildren(confirmation); confirmation.focus();
    } catch (_) {
      status.dataset.error = 'true';
      status.textContent = 'We could not confirm receipt. Your answers are still here. Retry the unchanged response safely, or email hello@xmoworks.ae and quote your response ID. Response ID: '+attempt.id+'.';
      button.disabled = false;
    }
  });
})();
