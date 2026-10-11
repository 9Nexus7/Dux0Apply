/* DUX0 – eigenständige Bewerbungsseite (apply2). Läuft komplett unabhängig von der Haupt-Website
   und spricht mit dem gleichen Bot, aber über eigene Endpunkte (/api/apply2, site=apply2),
   damit die Bewerbung auf dem neuen, reinen Bewerbungsserver landet. */
(() => {
  "use strict";

  const APP = document.getElementById("app");
  const TOAST = document.getElementById("toast");
  const TOKEN_KEY = "dux0a2_token";
  const STATE_KEY = "dux0a2_state";

  const S = { api: "", cfg: null, token: localStorage.getItem(TOKEN_KEY) || "", me: null, offline: false };

  function toast(msg) {
    TOAST.textContent = msg;
    TOAST.classList.add("show");
    clearTimeout(TOAST._t);
    TOAST._t = setTimeout(() => TOAST.classList.remove("show"), 4000);
  }

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else if (k === "html") el.innerHTML = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) {
      if (kid == null) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  function rc(root, ...kids) {
    root.innerHTML = "";
    root.append(...kids.flat().filter((x) => x != null));
  }

  async function api(path, opts = {}) {
    if (!S.api) throw new Error("offline");
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), opts.timeout || 15000);
    try {
      const headers = { ...(opts.headers || {}) };
      if (S.token) headers.Authorization = "Bearer " + S.token;
      if (opts.json) headers["Content-Type"] = "application/json";
      const res = await fetch(S.api + path, {
        method: opts.method || "GET", headers,
        body: opts.json ? JSON.stringify(opts.json) : opts.body, signal: ctl.signal,
      });
      let data = null;
      try { data = await res.json(); } catch (_) {}
      if (!res.ok) { const e = new Error((data && data.error) || "http_" + res.status); e.status = res.status; throw e; }
      return data;
    } finally { clearTimeout(timer); }
  }

  const ERR = {
    offline: "Der Bot ist gerade nicht erreichbar. Bitte versuch es später erneut.",
    no_token: "Deine Anmeldung ist abgelaufen. Bitte melde dich erneut an.",
    invalid_token: "Deine Anmeldung ist abgelaufen. Bitte melde dich erneut an.",
    bot_not_ready: "Der Bot ist gerade nicht bereit (oder noch nicht auf dem Bewerbungsserver). Bitte versuch es gleich noch einmal.",
    roblox_verify_required: "Du musst zuerst deinen Roblox-Account verifizieren.",
    invalid_roblox_name: "Das ist kein gültiger Roblox-Nutzername.",
    missing_fields: "Bitte fülle alle Pflichtfelder aus.",
    already_pending: "Du hast schon eine Bewerbung, die gerade geprüft wird.",
    already_accepted: "Du wurdest bereits angenommen.",
    already_member: "Du bist bereits Mitglied.",
    cooldown: "Du wurdest vor Kurzem abgelehnt. Die Wartezeit auf dieser Seite zeigt, wann du dich wieder bewerben kannst.",
    slow_down: "Bitte warte kurz, bevor du es erneut versuchst.",
    too_many_images: "Zu viele Bilder.",
    image_too_large: "Ein Bild ist zu groß.",
    not_an_image: "Eine der Dateien ist kein gültiges Bild.",
    roblox_user_not_found: "Dieser Roblox-Nutzername wurde nicht gefunden.",
    roblox_already_linked: "Dieser Roblox-Account ist schon mit einem anderen Discord-Konto verknüpft.",
    no_pending_code: "Es läuft gerade keine Verifizierung. Starte sie erneut.",
    code_not_found: "Der Code wurde nicht in deiner Roblox-Profilbeschreibung gefunden. Hast du gespeichert?",
    roblox_unreachable: "Roblox war gerade nicht erreichbar. Versuch es gleich noch einmal.",
    invite_not_available: "Es gibt noch keine Einladung für dich.",
  };
  function errText(e) {
    const code = (e && e.message) || "";
    return ERR[code] || (code ? "Fehler: " + code : "Unbekannter Fehler.");
  }

  function login() {
    const st = crypto.randomUUID ? crypto.randomUUID() : String(Math.random());
    sessionStorage.setItem(STATE_KEY, st);
    const q = new URLSearchParams({
      client_id: S.cfg.clientId, response_type: "code", scope: "identify guilds guilds.join",
      redirect_uri: S.cfg.redirectUri, state: st,
    });
    location.href = "https://discord.com/oauth2/authorize?" + q;
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    S.token = ""; S.me = null;
    render();
  }

  function dateTime(ts) {
    if (!ts) return "";
    return new Date(ts * 1000).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
  }

  function steps(n, of = 3) {
    const row = h("div", { class: "steps" });
    for (let i = 1; i <= of; i++) row.append(h("span", { class: i <= n ? "on" : "" }));
    return row;
  }

  function card(...kids) { return h("div", { class: "card panel shard" }, ...kids); }

  // ---------------- Screens ----------------

  function screenOffline() {
    rc(APP,
      h("h1", {}, "Bewerbung bei DUX0"),
      card(h("p", {}, "Der Bot ist gerade offline, deswegen können wir gerade keine Bewerbungen annehmen. Bitte versuch es in ein paar Minuten noch einmal.")));
  }

  function screenLogin() {
    rc(APP,
      h("h1", {}, "Bewerbung bei DUX0"),
      h("p", { class: "sub" }, "Melde dich mit Discord an, um dich zu bewerben. Du musst dafür noch nicht auf unserem Discord sein."),
      card(
        steps(1),
        h("h2", {}, "Schritt 1 – Anmelden"),
        h("p", {}, "Wir brauchen deinen Discord-Account, um die Bewerbung dir zuzuordnen und dir hier die Entscheidung zu zeigen. Wenn du angenommen wirst, holt dich der Bot damit automatisch auf unseren richtigen Clan-Discord."),
        S.cfg && S.cfg.status && !S.cfg.status.loginReady
          ? h("p", { class: "err" }, "Der Login ist auf der Bot-Seite noch nicht eingerichtet.")
          : h("button", { class: "btn wide", type: "button", onclick: login }, "Mit Discord anmelden")));
  }

  function screenRoblox() {
    const links = [
      h("h1", {}, "Bewerbung bei DUX0"),
      h("p", { class: "sub" }, "Fast geschafft. Verifiziere jetzt deinen Roblox-Account, damit wir wissen, dass die Bewerbung wirklich von dir ist."),
    ];
    const box = h("div", {});
    const codeBox = h("div", {});
    const nameInput = h("input", { type: "text", placeholder: "Dein Roblox-Nutzername" });
    const startBtn = h("button", { class: "btn", type: "button" }, "Code anfragen");
    startBtn.onclick = async () => {
      startBtn.disabled = true;
      try {
        const r = await api("/api/roblox/start", { method: "POST", json: { username: nameInput.value.trim() } });
        rc(codeBox,
          h("p", {}, "Gefunden: ", h("b", {}, r.name), "."),
          h("p", {}, "Trag diesen Code für ein paar Minuten in deine Roblox-Profilbeschreibung ein:"),
          h("p", {}, h("code", { style: "background:var(--panel-hi);padding:.3rem .6rem;border-radius:6px;font-size:1.05rem" }, r.code)),
          h("p", { class: "hint" }, "Roblox → dein Profil → Stift-Symbol → Beschreibung bearbeiten → Code einfügen → Speichern. Danach hier auf \"Prüfen\" klicken."),
          h("button", { class: "btn", type: "button", onclick: verify }, "Prüfen"));
      } catch (e) { toast(errText(e)); } finally { startBtn.disabled = false; }
    };
    async function verify() {
      try {
        await api("/api/roblox/verify", { method: "POST", json: {} });
        toast("Roblox-Account verknüpft!");
        await refreshMe();
        render();
      } catch (e) { toast(errText(e)); }
    }
    rc(box, h("div", { class: "field" }, h("label", {}, "Roblox-Nutzername"), nameInput), startBtn, codeBox);
    rc(APP, ...links, card(steps(2), h("h2", {}, "Schritt 2 – Roblox verknüpfen"), box,
      h("p", { class: "hint" }, "Du kannst den Code danach wieder aus deiner Beschreibung entfernen.")));
  }

  function fileField(label, name) {
    return h("div", { class: "field" },
      h("label", {}, label),
      h("input", { type: "file", name, accept: "image/*", multiple: true }));
  }

  function screenForm() {
    const me = S.me;
    const d = { rank: "", playtime: "", gamepasses: "", masteries: "", can_spend: "no", note: "", roblox: "" };
    const err = h("p", { class: "err" });
    const submitBtn = h("button", { class: "btn wide", type: "submit" }, "Bewerbung absenden");

    const fields = [];
    if (!me.roblox) {
      fields.push(h("div", { class: "field" },
        h("label", {}, "Dein Roblox-Nutzername"),
        h("input", { type: "text", required: true, oninput: (e) => (d.roblox = e.target.value) })));
    }
    const rank = h("input", { type: "text", required: true, placeholder: "z. B. Gold, Master, …", oninput: (e) => (d.rank = e.target.value) });
    const playtime = h("input", { type: "text", required: true, placeholder: "z. B. 300 Stunden", oninput: (e) => (d.playtime = e.target.value) });
    const gamepasses = h("textarea", { required: true, placeholder: "Welche Gamepasses hast du?", oninput: (e) => (d.gamepasses = e.target.value) });
    const masteries = h("textarea", { required: true, placeholder: "Welche Masteries / Pets hast du?", oninput: (e) => (d.masteries = e.target.value) });
    const note = h("textarea", { placeholder: "Noch etwas, das wir wissen sollten? (optional)", oninput: (e) => (d.note = e.target.value) });
    const canSpendYes = h("input", { type: "radio", name: "can_spend", value: "yes" });
    const canSpendNo = h("input", { type: "radio", name: "can_spend", value: "no", checked: true });
    canSpendYes.onchange = canSpendNo.onchange = () => (d.can_spend = canSpendYes.checked ? "yes" : "no");
    const images = h("input", { type: "file", name: "images", accept: "image/*", multiple: true });

    const form = h("form", {
      onsubmit: async (e) => {
        e.preventDefault();
        err.textContent = "";
        submitBtn.disabled = true;
        try {
          const fd = new FormData();
          fd.append("data", JSON.stringify({ ...d, lang: "de" }));
          for (const f of images.files || []) fd.append("images", f);
          await api("/api/apply2", { method: "POST", body: fd, timeout: 90000 });
          toast("Bewerbung gesendet!");
          await refreshMe();
          render();
        } catch (ex) {
          err.textContent = errText(ex);
        } finally { submitBtn.disabled = false; }
      },
    },
      ...fields,
      h("div", { class: "field" }, h("label", {}, "Dein Rang"), rank),
      h("div", { class: "field" }, h("label", {}, "Spielzeit"), playtime),
      h("div", { class: "field" }, h("label", {}, "Gamepasses"), gamepasses),
      h("div", { class: "field" }, h("label", {}, "Masteries / Pets"), masteries),
      h("div", { class: "field" },
        h("label", {}, "Würdest du für den Clan Geld ausgeben?"),
        h("div", { class: "radio-row" },
          h("label", {}, canSpendYes, "Ja"),
          h("label", {}, canSpendNo, "Nein"))),
      h("div", { class: "field" }, h("label", {}, "Nachricht an das Team (optional)"), note),
      h("div", { class: "field" },
        h("label", {}, "Screenshots (optional, z. B. Inventar / Stats)"),
        images,
        h("p", { class: "hint" }, "Bis zu ein paar Bilder, jedes max. ein paar MB.")),
      err, submitBtn);

    rc(APP,
      h("h1", {}, "Bewerbung bei DUX0"),
      h("div", { class: "who" },
        me.user.avatar ? h("img", { src: me.user.avatar, alt: "" }) : null,
        h("span", {}, "Bewerbung als ", h("b", {}, me.roblox ? me.roblox.name : me.user.name))),
      card(steps(3), h("h2", {}, "Schritt 3 – Angaben zur Bewerbung"), form));
  }

  function statusCard(kind, icon, title, body) {
    return card(h("div", { class: "status-card " + kind }, h("div", { class: "icon" }, icon), h("h2", {}, title), body));
  }

  function screenStatus(app) {
    const me = S.me;
    const head = [h("h1", {}, "Bewerbung bei DUX0"),
      h("div", { class: "who" }, me.user.avatar ? h("img", { src: me.user.avatar, alt: "" }) : null,
        h("span", {}, "Bewerbung als ", h("b", {}, app.roblox)))];

    if (app.status === "pending") {
      rc(APP, ...head, statusCard("wait", "…", "Deine Bewerbung wird geprüft",
        h("p", {}, `Gesendet am ${dateTime(app.created)}. Unser Team liest jede Bewerbung im Bewerbungs-Server. Diese Seite prüft von selbst auf die Entscheidung – du kannst sie offen lassen oder später wiederkommen.`)));
      return;
    }
    if (app.status === "accepted") {
      const box = h("div", {});
      const getInvite = async () => {
        try {
          const r = await api("/api/invite", { method: "POST" });
          rc(box, h("a", { class: "btn", href: r.invite || r.url, target: "_blank", rel: "noopener" }, "DUX0-Discord beitreten"),
            h("p", { class: "hint" }, "Die Einladung gilt für dich persönlich und läuft nach ein paar Tagen ab."));
        } catch (e) { toast(errText(e)); }
      };
      rc(box, h("button", { class: "btn", type: "button", onclick: getInvite }, "Einladung holen"));
      rc(APP, ...head, statusCard("ok", "✓", "Du wurdest angenommen!",
        [h("p", {}, me.inServer ? "Du bist schon auf unserem Clan-Discord und hast deine Mitgliedsrolle." : "Hol dir jetzt deine persönliche Einladung zu unserem richtigen Clan-Discord. Der Bot gibt dir dort sofort deine Mitgliedsrolle."),
          me.inServer ? null : box]));
      return;
    }
    if (app.status === "declined") {
      const when = me.reapplyAt ? dateTime(me.reapplyAt) : "";
      rc(APP, ...head, statusCard("bad", "✕", "Diesmal nicht angenommen",
        [h("p", {}, `Deine Bewerbung als ${app.roblox} wurde abgelehnt.`),
          me.canReapply
            ? h("button", { class: "btn", type: "button", onclick: () => { S.reapply = true; render(); } }, "Erneut bewerben")
            : h("p", { class: "hint" }, `Du kannst dich ab ${when} erneut bewerben.`)]));
      return;
    }
  }

  async function refreshMe() {
    try { S.me = await api("/api/me"); S.offline = false; }
    catch (e) { if (e.message === "offline") S.offline = true; else throw e; }
  }

  let pollTimer = null;
  function schedulePoll() {
    clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      if (!S.token) return;
      try { await refreshMe(); render(); } catch (_) {}
    }, 15000);
  }

  function render() {
    if (S.offline || !S.api) return screenOffline();
    if (!S.token || !S.me) return screenLogin();
    const me = S.me;
    const app = me.application;
    if (app && app.status === "pending") return screenStatus(app);
    if (app && app.status === "accepted") return screenStatus(app);
    if (app && app.status === "declined" && !(me.canReapply && S.reapply)) return screenStatus(app);
    if (me.requireRoblox && !me.roblox) return screenRoblox();
    return screenForm();
  }

  async function init() {
    try {
      S.cfg = await (await fetch("config.json?t=" + Date.now())).json();
      S.api = (S.cfg.api || "").replace(/\/$/, "");
    } catch (_) { S.api = ""; }
    if (!S.api) { S.offline = true; render(); return; }
    try {
      const cfg2 = await (await fetch(S.api + "/api/config?site=apply2")).json();
      S.cfg = { ...S.cfg, ...cfg2 };
    } catch (_) {}
    if (S.token) {
      try { await refreshMe(); } catch (e) { if (e.status === 401) { S.token = ""; localStorage.removeItem(TOKEN_KEY); } }
    }
    render();
    schedulePoll();
  }

  init();
})();
