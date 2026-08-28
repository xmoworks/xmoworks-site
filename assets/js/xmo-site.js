
(() => {
  "use strict";

  const XMO = window.XMO = window.XMO || {};
  XMO.supabaseUrl = "https://ahbjovxatcuoszsxwwzz.supabase.co";
  XMO.anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYmpvdnhhdGN1b3N6c3h3d3p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5NTk3MTYsImV4cCI6MjEwMjUzNTcxNn0.0UI_-OwvZY1NxC9dE6dNq1-uOUtiH9WiZEaYcArOIrM";
  XMO.functionsBase = XMO.supabaseUrl + "/functions/v1";
  XMO.linkedinPartnerId = "9644434";
  XMO.linkedinFinderConversionId = 29779602;

  function loadLinkedInInsightTag() {
    window._linkedin_partner_id = XMO.linkedinPartnerId;
    window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
    if (!window._linkedin_data_partner_ids.includes(XMO.linkedinPartnerId)) {
      window._linkedin_data_partner_ids.push(XMO.linkedinPartnerId);
    }
    if (!window.lintrk) {
      window.lintrk = function(a, b) { window.lintrk.q.push([a, b]); };
      window.lintrk.q = [];
    }
    if (document.querySelector('script[src="https://snap.licdn.com/li.lms-analytics/insight.min.js"]')) return;
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.async = true;
    script.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
    document.head.appendChild(script);
  }

  loadLinkedInInsightTag();

  XMO.trackLinkedInFinderConversion = function(submissionId) {
    if (!submissionId || typeof window.lintrk !== "function") return false;
    const dedupeKey = "xmo_li_finder_conversion_" + submissionId;
    if (sessionStorage.getItem(dedupeKey) === "1") return false;
    window.lintrk("track", { conversion_id: XMO.linkedinFinderConversionId });
    sessionStorage.setItem(dedupeKey, "1");
    return true;
  };

  const apiHeaders = {
    "apikey": XMO.anonKey,
    "Authorization": "Bearer " + XMO.anonKey,
    "Content-Type": "application/json"
  };

  function getSessionId() {
    let id = localStorage.getItem("xmo_session_id");
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(16).slice(2));
      localStorage.setItem("xmo_session_id", id);
    }
    return id;
  }

  function readUtm() {
    const params = new URLSearchParams(location.search);
    const current = {
      source: params.get("utm_source") || "",
      medium: params.get("utm_medium") || "",
      campaign: params.get("utm_campaign") || "",
      content: params.get("utm_content") || "",
      term: params.get("utm_term") || ""
    };
    const hasCurrent = Object.values(current).some(Boolean);
    if (hasCurrent) localStorage.setItem("xmo_first_utm", JSON.stringify(current));
    try {
      return hasCurrent ? current : JSON.parse(localStorage.getItem("xmo_first_utm") || "{}");
    } catch (_) {
      return current;
    }
  }

  XMO.sessionId = getSessionId();
  XMO.utm = readUtm();

  const trackedEvents = new Set([
    "page_view", "cta_click", "link_click", "page_engaged", "scroll_depth",
    "finder_start", "finder_step", "finder_complete", "finder_completed",
    "finder_result", "finder_abandon", "early_access_start", "contact_start",
    "form_start", "form_submit_attempt", "form_submit_success", "form_submit_error"
  ]);

  XMO.api = async function(functionName, options = {}) {
    const method = options.method || "GET";
    const query = options.query ? "?" + new URLSearchParams(options.query).toString() : "";
    const response = await fetch(XMO.functionsBase + "/" + functionName + query, {
      method,
      headers: apiHeaders,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(data.error || ("Request failed: " + response.status));
    return data;
  };

  XMO.track = function(eventName, extra = {}) {
    if (!trackedEvents.has(eventName)) return;
    if (typeof window.gtag === "function") {
      window.gtag("event", eventName, extra);
    }
    const body = {
      event_name: eventName,
      session_id: XMO.sessionId,
      page_path: location.pathname,
      page_title: document.title,
      referrer: document.referrer,
      utm: XMO.utm,
      viewport_width: window.innerWidth,
      ...extra
    };
    XMO.api("site-event", { method: "POST", body }).catch(() => {});
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[ch]));
  }

  function getCtaMap(ctas) {
    return Object.fromEntries((ctas || []).map(x => [x.cta_code, x]));
  }

  function ctaHtml(code, map, fallbackLabel = "Learn more") {
    const c = map[code];
    if (!c) return "";
    const klass = c.style === "primary" ? "xmo-btn xmo-btn-primary" : "xmo-btn xmo-btn-secondary";
    return `<a class="${klass}" href="${escapeHtml(c.destination_value)}" data-cta-code="${escapeHtml(c.cta_code)}">${escapeHtml(c.label || fallbackLabel)}</a>`;
  }

  function renderHero(section, ctas) {
    const b = section.body || {};
    const cfg = section.config || {};
    return `
      <section class="xmo-hero xmo-panel">
        <div class="xmo-eyebrow">${escapeHtml(section.eyebrow || "")}</div>
        <h1>${escapeHtml(section.heading || "")}</h1>
        ${section.subheading ? `<p class="xmo-lead">${escapeHtml(section.subheading)}</p>` : ""}
        ${b.description ? `<p class="xmo-copy">${escapeHtml(b.description)}</p>` : ""}
        ${b.tagline ? `<p class="xmo-tagline">${escapeHtml(b.tagline)}</p>` : ""}
        ${b.target_outcome ? `<div class="xmo-callout"><strong>Target outcome</strong><br>${escapeHtml(b.target_outcome)}</div>` : ""}
        ${b.estimated_minutes ? `<div class="xmo-mini-note">Estimated time: ${escapeHtml(b.estimated_minutes)}</div>` : ""}
        <div class="xmo-actions">
          ${cfg.primary_cta ? ctaHtml(cfg.primary_cta, ctas) : ""}
          ${cfg.secondary_cta ? ctaHtml(cfg.secondary_cta, ctas) : ""}
          ${cfg.cta_code ? ctaHtml(cfg.cta_code, ctas) : ""}
        </div>
      </section>`;
  }

  function renderProductGrid(section, products, ctas) {
    const wanted = (section.body || {}).products || products.map(p => p.product_code);
    const cards = wanted.map(code => products.find(p => p.product_code === code)).filter(Boolean).map(p => `
      <article class="xmo-product-card">
        <div class="xmo-product-code">${escapeHtml(p.name)}</div>
        <h3>${escapeHtml(p.promise)}</h3>
        <p>${escapeHtml(p.description || "")}</p>
        <div class="xmo-card-audience"><strong>Built for:</strong> ${escapeHtml(p.audience || "")}</div>
        <div class="xmo-actions">${ctaHtml(p.primary_cta_code, ctas)}${ctaHtml(p.secondary_cta_code, ctas)}</div>
      </article>`).join("");
    return `
      <section class="xmo-section">
        <div class="xmo-section-heading">
          <div class="xmo-eyebrow">${escapeHtml(section.eyebrow || "")}</div>
          <h2>${escapeHtml(section.heading || "")}</h2>
          <p>${escapeHtml(section.subheading || "")}</p>
        </div>
        <div class="xmo-product-grid">${cards}</div>
      </section>`;
  }

  function renderOutcomes(section) {
    const items = (section.body || {}).items || [];
    return `
      <section class="xmo-section xmo-panel">
        <div class="xmo-section-heading">
          <div class="xmo-eyebrow">${escapeHtml(section.eyebrow || "")}</div>
          <h2>${escapeHtml(section.heading || "")}</h2>
          <p>${escapeHtml(section.subheading || "")}</p>
        </div>
        <div class="xmo-outcomes">${items.map((x, i) => `<div class="xmo-outcome"><span>${String(i+1).padStart(2,"0")}</span><p>${escapeHtml(x)}</p></div>`).join("")}</div>
      </section>`;
  }

  function renderContent(section) {
    const body = section.body || {};
    const points = body.points || body.paragraphs || [];
    return `
      <section class="xmo-section xmo-panel">
        <div class="xmo-section-heading">
          <div class="xmo-eyebrow">${escapeHtml(section.eyebrow || "")}</div>
          <h2>${escapeHtml(section.heading || "")}</h2>
          <p>${escapeHtml(section.subheading || "")}</p>
        </div>
        ${points.length ? `<div class="xmo-list">${points.map(x => `<div class="xmo-list-item">${escapeHtml(x)}</div>`).join("")}</div>` : ""}
      </section>`;
  }

  function renderCta(section, ctas) {
    const code = (section.body || {}).cta_code || (section.config || {}).cta_code;
    return `
      <section class="xmo-section xmo-cta-panel">
        <div class="xmo-eyebrow">${escapeHtml(section.eyebrow || "")}</div>
        <h2>${escapeHtml(section.heading || "")}</h2>
        <p>${escapeHtml(section.subheading || "")}</p>
        <div class="xmo-actions">${code ? ctaHtml(code, ctas) : ""}</div>
      </section>`;
  }

  function renderFaqs(faqs, productCode) {
    const rows = (faqs || []).filter(f => !productCode || f.product_code === productCode);
    if (!rows.length) return "";
    return `
      <section class="xmo-section">
        <div class="xmo-section-heading"><div class="xmo-eyebrow">FAQ</div><h2>Common questions</h2></div>
        <div class="xmo-faqs">${rows.map(f => `<details><summary>${escapeHtml(f.question)}</summary><p>${escapeHtml(f.answer)}</p></details>`).join("")}</div>
      </section>`;
  }

  function renderSection(section, data, ctas) {
    switch (section.section_type) {
      case "hero": return renderHero(section, ctas);
      case "product_grid": return renderProductGrid(section, data.products || [], ctas);
      case "outcomes": return renderOutcomes(section);
      case "cta": return renderCta(section, ctas);
      case "content": return renderContent(section);
      default: return renderContent(section);
    }
  }

  async function loadArticlesIndex() {
    const data = await XMO.api("site-content", { query: { articles: "1" } });
    const container = document.querySelector("[data-articles]");
    if (!container) return;
    container.innerHTML = (data.articles || []).map(a => {
      const legacy = a.slug === "not-every-organization-needs-a-pmo";
      const url = legacy ? `/insights/${a.slug}.html` : `/insights/article.html?slug=${encodeURIComponent(a.slug)}`;
      return `<a class="xmo-article-card" href="${url}">
        <div class="xmo-eyebrow">${escapeHtml(a.category || "Insights")}</div>
        <h3>${escapeHtml(a.title)}</h3>
        <p>${escapeHtml(a.summary || "")}</p>
        <span>Read insight →</span>
      </a>`;
    }).join("") || `<div class="xmo-empty">New insights are being prepared.</div>`;
  }

  async function loadArticle() {
    const slug = document.body.dataset.articleSlug || new URLSearchParams(location.search).get("slug");
    if (!slug) throw new Error("Article not specified.");
    const data = await XMO.api("site-content", { query: { article: slug } });
    const a = data.article;
    document.title = a.seo_title || (a.title + " | XMO Works");
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", a.meta_description || a.summary || "");
    document.getElementById("app").innerHTML = `
      <article class="xmo-article xmo-panel">
        <div class="xmo-eyebrow">${escapeHtml(a.category || "Insights")}</div>
        <h1>${escapeHtml(a.title)}</h1>
        <p class="xmo-article-meta">XMO Works Insights</p>
        <div class="xmo-article-body">${a.body_html || ""}</div>
        <div class="xmo-cta-panel xmo-article-cta">
          <h2>Find your starting point</h2>
          <p>XMO Finder identifies the strongest management-office friction and routes you to the most appropriate XMO pathway.</p>
          <a class="xmo-btn xmo-btn-primary" href="/finder/" data-cta-code="start_finder">Start XMO Finder</a>
        </div>
      </article>`;
  }

  function renderEarlyAccess() {
    document.getElementById("app").innerHTML = `
      <section class="xmo-form-shell xmo-panel">
        <div class="xmo-eyebrow">Early Access</div>
        <h1>Follow what XMO Works is building.</h1>
        <p class="xmo-lead">Get practical resources, product updates and selected pilot opportunities.</p>
        <form id="early-access-form" class="xmo-form">
          <input type="text" name="website" class="xmo-honeypot" tabindex="-1" autocomplete="off">
          <label>Name <input name="full_name" autocomplete="name"></label>
          <label>Email <input name="email" type="email" autocomplete="email" required></label>
          <label>Organization <input name="organization_name" autocomplete="organization"></label>
          <label>Which area is most relevant?
            <select name="lane_interest">
              <option value="">Not sure yet</option>
              <option value="starter">We do not have a formal PMO</option>
              <option value="mini">Our PMO is one or two people</option>
              <option value="decision_cycle">We have an established PMO / portfolio office</option>
            </select>
          </label>
          <label class="xmo-check"><input type="checkbox" required> I agree to receive XMO Works product updates, resources and related information.</label>
          <button class="xmo-btn xmo-btn-primary" type="submit">Join Early Access</button>
          <div class="xmo-form-status" aria-live="polite"></div>
        </form>
      </section>`;
  }

  function renderContact() {
    document.getElementById("app").innerHTML = `
      <section class="xmo-form-shell xmo-panel">
        <div class="xmo-eyebrow">Contact</div>
        <h1>Tell us what is consuming management attention.</h1>
        <p class="xmo-lead">We are currently speaking with growing-company leaders, lean PMOs and established portfolio offices for design-partner pilots.</p>
        <form id="contact-form" class="xmo-form">
          <input type="text" name="website" class="xmo-honeypot" tabindex="-1" autocomplete="off">
          <label>Name <input name="full_name" autocomplete="name" required></label>
          <label>Email <input name="email" type="email" autocomplete="email" required></label>
          <label>Organization <input name="organization_name" autocomplete="organization"></label>
          <label>Role <input name="job_title" autocomplete="organization-title"></label>
          <label>Which path is closest?
            <select name="lane_interest">
              <option value="">Not sure</option>
              <option value="starter">No formal PMO</option>
              <option value="mini">One/two-person PMO</option>
              <option value="decision_cycle">Established PMO / portfolio office</option>
            </select>
          </label>
          <label>What problem are you trying to solve? <textarea name="message" rows="6" required></textarea></label>
          <label class="xmo-check"><input name="consent_marketing" type="checkbox"> Send me relevant XMO Works resources and updates.</label>
          <button class="xmo-btn xmo-btn-primary" type="submit">Send inquiry</button>
          <div class="xmo-form-status" aria-live="polite"></div>
        </form>
      </section>`;
  }

  async function hydratePage() {
    const pageSlug = document.body.dataset.page || "/";
    if (document.body.dataset.articleSlug !== undefined || document.body.dataset.articleQuery === "true") {
      await loadArticle();
      XMO.track("page_view");
      return;
    }

    if (pageSlug === "/early-access/") {
      renderEarlyAccess();
      document.dispatchEvent(new CustomEvent("xmo:earlyaccess-ready"));
      XMO.track("page_view");
      return;
    }
    if (pageSlug === "/contact/") {
      renderContact();
      document.dispatchEvent(new CustomEvent("xmo:contact-ready"));
      XMO.track("page_view");
      return;
    }
    if (pageSlug === "/finder/") {
      XMO.track("page_view");
      return; // finder.js owns rendering
    }

    const cacheKey = "xmo_page_cache_" + pageSlug;
    let data;
    try {
      data = await XMO.api("site-content", { query: { page: pageSlug } });
      localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), data }));
    } catch (error) {
      try {
        data = JSON.parse(localStorage.getItem(cacheKey) || "{}").data;
      } catch (_) {}
      if (!data) throw error;
    }

    document.title = data.page.seo_title || (data.page.title + " | XMO Works");
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", data.page.meta_description || "");

    const ctas = getCtaMap(data.ctas || []);
    const productCode = pageSlug === "/starter/" ? "XMO-STARTER" :
                        pageSlug === "/mini/" ? "XMO-MINI" :
                        pageSlug === "/decision-cycle/" ? "XMO-DECISION" : null;

    document.getElementById("app").innerHTML =
      (data.sections || []).map(s => renderSection(s, data, ctas)).join("") +
      renderFaqs(data.faqs || [], productCode);

    if (pageSlug === "/insights/") {
      const holder = document.createElement("section");
      holder.className = "xmo-section";
      holder.innerHTML = `<div class="xmo-section-heading"><div class="xmo-eyebrow">Published insights</div><h2>Latest thinking</h2></div><div class="xmo-article-grid" data-articles></div>`;
      document.getElementById("app").appendChild(holder);
      await loadArticlesIndex();
    }

    XMO.track("page_view");
  }

  document.addEventListener("click", e => {
    const a = e.target.closest("a[href]");
    if (!a) return;
    const href = a.getAttribute("href") || "";
    const absolute = new URL(href, location.href);
    const linkType = href.startsWith("mailto:") ? "email" :
                     href.startsWith("tel:") ? "phone" :
                     absolute.origin !== location.origin ? "external" :
                     "internal";
    if (a.dataset.ctaCode) XMO.track("cta_click", { cta_code: a.dataset.ctaCode });
    XMO.track("link_click", {
      cta_code: a.dataset.ctaCode || "",
      link_url: absolute.href,
      link_text: (a.textContent || "").trim().slice(0, 160),
      link_type: linkType
    });
  });

  document.addEventListener("focusin", e => {
    const form = e.target.closest("form");
    if (!form || form.dataset.analyticsStarted) return;
    form.dataset.analyticsStarted = "1";
    XMO.track("form_start", { form_name: form.id || "unnamed_form" });
  });

  document.addEventListener("DOMContentLoaded", () => {
    const pageKey = "xmo_depth_" + location.pathname;
    const sentDepths = new Set();
    window.addEventListener("scroll", () => {
      const available = document.documentElement.scrollHeight - window.innerHeight;
      if (available <= 0) return;
      const depth = Math.min(100, Math.round((window.scrollY / available) * 100));
      [25, 50, 75, 90].forEach(threshold => {
        if (depth >= threshold && !sentDepths.has(threshold)) {
          sentDepths.add(threshold);
          sessionStorage.setItem(pageKey + "_" + threshold, "1");
          XMO.track("scroll_depth", { scroll_depth: threshold });
        }
      });
    }, { passive: true });

    window.setTimeout(() => {
      if (document.visibilityState === "visible") {
        XMO.track("page_engaged", { engagement_seconds: 30 });
      }
    }, 30000);
  });

  document.addEventListener("DOMContentLoaded", () => {
    hydratePage().catch(error => {
      console.error(error);
      const app = document.getElementById("app");
      if (app) app.innerHTML = `<section class="xmo-panel xmo-error"><h1>We could not load this page.</h1><p>Please refresh or contact <a href="mailto:hello@xmoworks.ae">hello@xmoworks.ae</a>.</p></section>`;
    });
  });
})();
