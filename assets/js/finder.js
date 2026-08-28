
(() => {
  "use strict";

  const state = {
    config: null,
    route: null,
    answers: {},
    context: {},
    step: 0,
    startedAt: new Date().toISOString()
  };

  const scoredDimensions = ["delivery","governance","portfolio","value","transformation","sustainability","reporting","ai_readiness"];
  const dimensionLabels = {
    delivery:"Delivery",
    governance:"Governance",
    portfolio:"Portfolio",
    value:"Value",
    transformation:"Transformation",
    sustainability:"Sustainability",
    reporting:"Reporting",
    ai_readiness:"AI readiness"
  };

  function esc(v) {
    return String(v ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]));
  }

  function questionsForRoute() {
    const questions = state.config?.questions || [];
    return questions.filter(q => !state.route || (q.lane_scope || []).includes(state.route));
  }

  function byOrder(min,max) {
    return questionsForRoute().filter(q => q.display_order >= min && q.display_order <= max);
  }

  function renderScale(q) {
    const selected = Number(state.answers[q.question_key] || 0);
    return `<fieldset class="xmo-question">
      <legend>${esc(q.prompt)}${q.required ? " *" : ""}</legend>
      <div class="xmo-scale">
        ${[1,2,3,4,5].map(n => `<label class="${selected===n?"selected":""}"><input type="radio" name="${esc(q.question_key)}" value="${n}" ${selected===n?"checked":""}>${n}<small>${n===1?"Strongly disagree":n===5?"Strongly agree":""}</small></label>`).join("")}
      </div>
    </fieldset>`;
  }

  function renderSelect(q) {
    const current = state.answers[q.question_key] ?? "";
    return `<label class="xmo-question">${esc(q.prompt)}${q.required ? " *" : ""}
      <select name="${esc(q.question_key)}" ${q.required?"required":""}>
        <option value="">Select…</option>
        ${(q.options || []).map(o => `<option value="${esc(o.value)}" ${current===o.value?"selected":""}>${esc(o.label)}</option>`).join("")}
      </select>
    </label>`;
  }

  function renderMulti(q) {
    const current = Array.isArray(state.answers[q.question_key]) ? state.answers[q.question_key] : [];
    return `<fieldset class="xmo-question"><legend>${esc(q.prompt)}${q.required ? " *" : ""}</legend>
      <div class="xmo-check-grid">${(q.options || []).map(o => `<label class="xmo-check"><input type="checkbox" name="${esc(q.question_key)}" value="${esc(o.value)}" ${current.includes(o.value)?"checked":""}> ${esc(o.label)}</label>`).join("")}</div>
    </fieldset>`;
  }

  function renderLong(q) {
    return `<label class="xmo-question">${esc(q.prompt)}${q.required ? " *" : ""}
      <textarea name="${esc(q.question_key)}" rows="5" ${q.required?"required":""}>${esc(state.answers[q.question_key] || "")}</textarea>
    </label>`;
  }

  function renderQuestion(q) {
    if (q.question_type === "scale_1_5") return renderScale(q);
    if (q.question_type === "single_select") return renderSelect(q);
    if (q.question_type === "multi_select") return renderMulti(q);
    if (q.question_type === "long_text") return renderLong(q);
    return "";
  }

  function progress() {
    const pct = Math.round(((state.step + 1) / 6) * 100);
    return `<div class="xmo-progress"><span style="width:${pct}%"></span></div>`;
  }

  function routeStep() {
    const q = state.config.questions.find(x => x.question_key === "route_selection");
    return `<div class="xmo-form-step">
      <div class="xmo-eyebrow">Step 1 of 6</div>
      <h1>Where are you today?</h1>
      <p class="xmo-lead">This routes the diagnostic to your operating reality before we score anything.</p>
      <div class="xmo-route-grid">
        ${(q.options || []).map(o => `<button type="button" class="xmo-route-card ${state.route===o.value?"active":""}" data-route="${esc(o.value)}"><strong>${esc(o.label)}</strong><span>${o.value==="starter"?"Growing company / no formal PMO":o.value==="mini"?"Lean PMO needing leverage":"Established management office"}</span></button>`).join("")}
      </div>
    </div>`;
  }

  function identityStep() {
    const contextQs = byOrder(2,7);
    return `<div class="xmo-form-step">
      <div class="xmo-eyebrow">Step 2 of 6</div>
      <h2>Tell us about your operating environment.</h2>
      <div class="xmo-form-grid">
        <label>Full name *<input name="full_name" value="${esc(state.context.full_name || "")}" autocomplete="name" required></label>
        <label>Work email *<input name="email" type="email" value="${esc(state.context.email || "")}" autocomplete="email" required></label>
        <label>Organization *<input name="organization_name" value="${esc(state.context.organization_name || "")}" autocomplete="organization" required></label>
        <label>Your role *<input name="role_category" value="${esc(state.context.role_category || "")}" placeholder="e.g. PMO leader, COO, project manager" required></label>
        <label>Job title<input name="job_title" value="${esc(state.context.job_title || "")}" autocomplete="organization-title"></label>
        <label>Organization size
          <select name="employee_band">
            <option value="">Select…</option>
            ${["1–19","20–49","50–99","100–199","200–499","500–999","1,000+"].map(v=>`<option ${state.context.employee_band===v?"selected":""}>${v}</option>`).join("")}
          </select>
        </label>
        <label>Country code<input name="country_code" value="${esc(state.context.country_code || "AE")}" maxlength="2"></label>
        <label>City<input name="city" value="${esc(state.context.city || "")}"></label>
      </div>
      <div class="xmo-question-stack">${contextQs.map(renderQuestion).join("")}</div>
    </div>`;
  }

  function scoredStep(title, stepNumber, minOrder, maxOrder) {
    const qs = byOrder(minOrder,maxOrder);
    return `<div class="xmo-form-step">
      <div class="xmo-eyebrow">Step ${stepNumber} of 6</div>
      <h2>${esc(title)}</h2>
      <p class="xmo-scale-note">1 = strongly disagree · 5 = strongly agree</p>
      <div class="xmo-question-stack">${qs.map(renderQuestion).join("")}</div>
    </div>`;
  }

  function finalStep() {
    const qs = byOrder(90,99);
    return `<div class="xmo-form-step">
      <div class="xmo-eyebrow">Step 5 of 6</div>
      <h2>What matters most now?</h2>
      <div class="xmo-question-stack">${qs.map(renderQuestion).join("")}</div>
      <div class="xmo-consent-box">
        <label class="xmo-check"><input type="checkbox" name="diagnostic_contact" checked> XMO Works may contact me about this diagnostic result or related follow-up.</label>
        <label class="xmo-check"><input type="checkbox" name="marketing"> I also want relevant XMO Works resources, product updates and pilot opportunities.</label>
      </div>
      <input type="text" name="website" class="xmo-honeypot" tabindex="-1" autocomplete="off">
    </div>`;
  }

  function reviewStep() {
    return `<div class="xmo-form-step">
      <div class="xmo-eyebrow">Step 6 of 6</div>
      <h2>Ready to see your diagnostic.</h2>
      <p class="xmo-lead">Your first result is calculated immediately. A deeper AI-assisted interpretation is then prepared from the score pattern and your specific answers for review.</p>
      <div class="xmo-review-card">
        <strong>${esc(state.context.organization_name || "Your organization")}</strong>
        <span>${esc(state.route === "starter" ? "XMO Starter route" : state.route === "mini" ? "XMO Mini route" : "XMO Decision Cycle route")}</span>
      </div>
      <button class="xmo-btn xmo-btn-primary" type="submit">Generate my result</button>
    </div>`;
  }

  function stepHtml() {
    if (state.step === 0) return routeStep();
    if (state.step === 1) return identityStep();
    if (state.step === 2) return scoredStep("Delivery, governance, portfolio and value",3,10,42);
    if (state.step === 3) return scoredStep("Transformation, sustainability, reporting and AI readiness",4,50,82);
    if (state.step === 4) return finalStep();
    return reviewStep();
  }

  function render() {
    const app = document.getElementById("app");
    app.innerHTML = `<section class="xmo-form-shell xmo-panel">
      ${progress()}
      <form id="finder-form" class="xmo-form">${stepHtml()}
        <div class="xmo-step-nav">
          ${state.step > 0 && state.step < 5 ? `<button class="xmo-btn xmo-btn-ghost" type="button" data-back>Back</button>` : ""}
          ${state.step < 5 ? `<button class="xmo-btn xmo-btn-primary" type="button" data-next ${state.step===0&&!state.route?"disabled":""}>Continue</button>` : ""}
        </div>
        <div class="xmo-form-status" aria-live="polite"></div>
      </form>
    </section>`;
    bind();
  }

  function saveCurrentForm() {
    const form = document.getElementById("finder-form");
    if (!form) return true;
    const fd = new FormData(form);
    const contextKeys = ["full_name","email","organization_name","role_category","job_title","employee_band","country_code","city"];
    contextKeys.forEach(k => { if (fd.has(k)) state.context[k] = String(fd.get(k) || ""); });

    const relevant = questionsForRoute();
    relevant.forEach(q => {
      if (q.question_type === "multi_select") {
        const vals = fd.getAll(q.question_key).map(String);
        if (vals.length) state.answers[q.question_key] = vals;
      } else if (fd.has(q.question_key)) {
        const val = fd.get(q.question_key);
        if (val !== null && String(val) !== "") state.answers[q.question_key] = q.question_type === "scale_1_5" ? Number(val) : String(val);
      }
    });
    if (fd.has("diagnostic_contact")) state.context.diagnostic_contact = fd.get("diagnostic_contact") === "on";
    if (fd.has("marketing")) state.context.marketing = fd.get("marketing") === "on";
    if (fd.has("website")) state.context.website = String(fd.get("website") || "");
    return true;
  }

  function validateStep() {
    saveCurrentForm();
    if (state.step === 0) return !!state.route;
    if (state.step === 1) {
      if (!state.context.full_name || !state.context.email || !state.context.email.includes("@") || !state.context.organization_name || !state.context.role_category) return false;
      const required = byOrder(2,7).filter(q => q.required);
      return required.every(q => {
        const v = state.answers[q.question_key];
        return Array.isArray(v) ? v.length > 0 : v !== undefined && v !== "";
      });
    }
    if (state.step === 2 || state.step === 3) {
      const range = state.step === 2 ? [10,42] : [50,82];
      return byOrder(...range).filter(q=>q.required).every(q => Number(state.answers[q.question_key]) >= 1);
    }
    if (state.step === 4) {
      return !!String(state.answers.biggest_issue || "").trim();
    }
    return true;
  }

  function bind() {
    document.querySelectorAll("[data-route]").forEach(btn => btn.addEventListener("click", () => {
      state.route = btn.dataset.route;
      state.answers.route_selection = state.route;
      render();
      window.XMO.track("finder_step", { lane: state.route, step: 1 });
    }));

    document.querySelector("[data-next]")?.addEventListener("click", () => {
      if (!validateStep()) {
        document.querySelector(".xmo-form-status").textContent = "Please complete the required fields before continuing.";
        return;
      }
      state.step++;
      window.XMO.track("finder_step", { lane: state.route, step: state.step + 1 });
      render();
      window.scrollTo({top:0,behavior:"smooth"});
    });

    document.querySelector("[data-back]")?.addEventListener("click", () => {
      saveCurrentForm();
      state.step = Math.max(0,state.step-1);
      render();
      window.scrollTo({top:0,behavior:"smooth"});
    });

    document.getElementById("finder-form")?.addEventListener("change", saveCurrentForm);
    document.getElementById("finder-form")?.addEventListener("submit", submit);
  }

  function resultHtml(result) {
    const sorted = Object.entries(result.scores || {}).filter(([k])=>k!=="ai_readiness").sort((a,b)=>Number(b[1])-Number(a[1]));
    const bars = Object.entries(result.scores || {}).map(([k,v]) => {
      const isAI = k === "ai_readiness";
      const pct = Math.round((Number(v)/15)*100);
      return `<div class="xmo-score-row"><div><strong>${esc(dimensionLabels[k] || k)}</strong><span>${esc(v)}/15 ${isAI?"readiness":"need"}</span></div><div class="xmo-score-bar"><span style="width:${pct}%"></span></div></div>`;
    }).join("");
    return `<section class="xmo-result xmo-panel">
      <div class="xmo-eyebrow">Your XMO Finder result</div>
      <h1>${esc(result.recommendation_qualifier || result.recommended_model)}</h1>
      <p class="xmo-lead">${esc(result.diagnostic_summary || "")}</p>
      <div class="xmo-result-offer">Recommended pathway: <strong>${esc(result.recommended_offer || "")}</strong></div>
      <div class="xmo-scores">${bars}</div>
      <div class="xmo-actions">
        <a class="xmo-btn xmo-btn-primary" href="/contact/?lane=${encodeURIComponent(result.route || "")}" data-cta-code="contact_xmo">Discuss the result</a>
        <a class="xmo-btn xmo-btn-secondary" href="/" data-cta-code="home">Explore XMO Works</a>
      </div>
      <p class="xmo-mini-note">A deeper interpretation is being prepared from your complete score pattern and written answers. Where contact consent was provided, XMO Works may follow up after review.</p>
    </section>`;
  }

  async function submit(e) {
    e.preventDefault();
    if (!validateStep()) return;
    window.XMO.track("form_submit_attempt", { form_name: "finder" });
    const status = document.querySelector(".xmo-form-status");
    const btn = e.submitter;
    if (btn) btn.disabled = true;
    status.textContent = "Calculating your diagnostic…";

    const answers = {...state.answers};
    const biggestIssue = answers.biggest_issue || "";
    const usefulResources = Array.isArray(answers.useful_resources) ? answers.useful_resources : [];
    delete answers.biggest_issue;
    delete answers.useful_resources;
    delete answers.route_selection;

    const payload = {
      website: state.context.website || "",
      submission_id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      session_id: window.XMO.sessionId,
      started_at: state.startedAt,
      route_selection: state.route,
      contact: {
        full_name: state.context.full_name,
        email: state.context.email,
        role_category: state.context.role_category,
        job_title: state.context.job_title || ""
      },
      organization: {
        name: state.context.organization_name,
        employee_band: state.context.employee_band || "",
        country_code: (state.context.country_code || "AE").toUpperCase(),
        city: state.context.city || "",
        pm_office_type: state.route === "starter" ? "none" : state.route === "mini" ? "lean_pmo" : "established"
      },
      answers,
      biggest_issue: biggestIssue,
      useful_resources: usefulResources,
      consent: {
        diagnostic_contact: state.context.diagnostic_contact !== false,
        marketing: !!state.context.marketing
      },
      utm: window.XMO.utm,
      page_url: location.href,
      page_path: location.pathname,
      referrer: document.referrer
    };

    try {
      const result = await window.XMO.api("finder-submit-v2", { method:"POST", body:payload });
      window.XMO.track("finder_completed", { lane: state.route });
      window.XMO.track("form_submit_success", { form_name: "finder" });
      window.XMO.trackLinkedInFinderConversion?.(payload.submission_id);
      document.getElementById("app").innerHTML = resultHtml(result);
      window.scrollTo({top:0,behavior:"smooth"});
    } catch (error) {
      window.XMO.track("form_submit_error", { form_name: "finder" });
      status.textContent = "We could not submit your diagnostic. Please try again or contact hello@xmoworks.ae.";
      if (btn) btn.disabled = false;
      console.error(error);
    }
  }

  async function init() {
    document.getElementById("app").innerHTML = `<section class="xmo-panel xmo-loading"><p>Loading XMO Finder…</p></section>`;
    state.config = await window.XMO.api("finder-config");
    window.XMO.track("finder_start");
    render();
  }

  document.addEventListener("DOMContentLoaded", () => {
    init().catch(error => {
      console.error(error);
      document.getElementById("app").innerHTML = `<section class="xmo-panel xmo-error"><h1>XMO Finder is temporarily unavailable.</h1><p>Please contact <a href="mailto:hello@xmoworks.ae">hello@xmoworks.ae</a>.</p></section>`;
    });
  });
})();
