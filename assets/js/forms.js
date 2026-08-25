
(() => {
  "use strict";
  const read = (form, name) => String(new FormData(form).get(name) || "").trim();

  document.addEventListener("xmo:earlyaccess-ready", () => {
    const form = document.getElementById("early-access-form");
    if (!form) return;
    window.XMO.track("early_access_start");
    form.addEventListener("submit", async e => {
      e.preventDefault();
      window.XMO.track("form_submit_attempt", { form_name: "early_access" });
      const status = form.querySelector(".xmo-form-status");
      const button = form.querySelector("button[type=submit]");
      button.disabled = true;
      status.textContent = "Submitting…";
      try {
        const payload = {
          website: read(form,"website"),
          full_name: read(form,"full_name"),
          email: read(form,"email"),
          organization_name: read(form,"organization_name"),
          lane_interest: read(form,"lane_interest"),
          session_id: window.XMO.sessionId,
          utm: window.XMO.utm,
          page_url: location.href,
          page_path: location.pathname,
          referrer: document.referrer
        };
        await window.XMO.api("early-access-submit",{method:"POST",body:payload});
        window.XMO.track("form_submit_success", { form_name: "early_access" });
        if (typeof window.gtag === "function") window.gtag("event","early_access_signup");
        form.innerHTML = `<div class="xmo-success"><h2>You're on the list.</h2><p>Thanks. XMO Works will keep the signal high and the noise low.</p></div>`;
      } catch(error) {
        window.XMO.track("form_submit_error", { form_name: "early_access" });
        status.textContent = "We could not complete the signup. Please try again.";
        button.disabled = false;
        console.error(error);
      }
    });
  });

  document.addEventListener("xmo:contact-ready", () => {
    const form = document.getElementById("contact-form");
    if (!form) return;
    window.XMO.track("contact_start");
    const urlLane = new URLSearchParams(location.search).get("lane");
    if (urlLane && ["starter","mini","decision_cycle"].includes(urlLane)) form.elements.lane_interest.value = urlLane;
    form.addEventListener("submit", async e => {
      e.preventDefault();
      window.XMO.track("form_submit_attempt", { form_name: "contact" });
      const status = form.querySelector(".xmo-form-status");
      const button = form.querySelector("button[type=submit]");
      button.disabled = true;
      status.textContent = "Sending…";
      try {
        const payload = {
          website: read(form,"website"),
          full_name: read(form,"full_name"),
          email: read(form,"email"),
          organization_name: read(form,"organization_name"),
          job_title: read(form,"job_title"),
          lane_interest: read(form,"lane_interest"),
          message: read(form,"message"),
          consent_marketing: !!form.elements.consent_marketing.checked,
          session_id: window.XMO.sessionId,
          utm: window.XMO.utm,
          page_url: location.href,
          referrer: document.referrer
        };
        await window.XMO.api("contact-submit",{method:"POST",body:payload});
        window.XMO.track("form_submit_success", { form_name: "contact" });
        if (typeof window.gtag === "function") window.gtag("event","contact_submitted");
        form.innerHTML = `<div class="xmo-success"><h2>Received.</h2><p>Thank you. XMO Works will review the problem and follow up where appropriate.</p></div>`;
      } catch(error) {
        window.XMO.track("form_submit_error", { form_name: "contact" });
        status.textContent = "We could not send the inquiry. Please try again or email hello@xmoworks.ae.";
        button.disabled = false;
        console.error(error);
      }
    });
  });
})();
