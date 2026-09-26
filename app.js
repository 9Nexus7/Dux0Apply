/* DUX0 clan website - plain JavaScript, no build step. */
(() => {
  "use strict";

  const BASE = location.origin + location.pathname.replace(/[^/]*$/, "");
  const $ = (s, r = document) => r.querySelector(s);
  const view = $("#view");
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const S = {
    api: "", cfg: null, token: localStorage.getItem("dux0_token") || "", me: null,
    offline: false, cache: {}, timers: [], silent: false, route: "home",
    sort: "event", q: "",
    lang: localStorage.getItem("dux0_lang") || ((navigator.language || "en").toLowerCase().startsWith("de") ? "de" : "en"),
  };
  if (!localStorage.getItem("dux0_lang")) localStorage.setItem("dux0_lang", S.lang);

  /* ------------------------------------------------------------------ */
  /* helpers                                                             */
  /* ------------------------------------------------------------------ */
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, "");
      else el.setAttribute(k, v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(kid));
    }
    return el;
  }
  const NS = "http://www.w3.org/2000/svg";
  function sv(tag, props, ...kids) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(props || {})) if (v != null) el.setAttribute(k, v);
    for (const kid of kids.flat(Infinity)) if (kid != null) el.append(kid.nodeType ? kid : document.createTextNode(kid));
    return el;
  }

  /* ------------------------------------------------------------------ */
  /* Sprache: einfache Uebersetzungstabelle fuer Navigation, Fusszeile,   */
  /* Bewerbung und Konto-Seite. Datenlastige Seiten bleiben auf Englisch. */
  /* ------------------------------------------------------------------ */
  const I18N = {
    en: {
      nav_home: "Home", nav_battles: "Battles", nav_members: "Members", nav_stats: "Stats", nav_live: "Live drops",
      nav_achievements: "Achievements", nav_apply: "Apply", nav_connect: "My account", nav_owner: "Owner",
      login: "Log in with Discord", logout: "Log out", login_offline: "Login is not available while the live server is offline.",
      foot_apply: "Apply to join", foot_status: "Site status", foot_note: "Game data from the BIG Games public API. Not affiliated with BIG Games or Roblox.",
      offline_notice: "The live server is offline right now. You are seeing the last saved data. Applying, login and editing need the live server.",
      apply_title: "Apply to DUX0",
      apply_sub: "Membership is by application. Send yours in three short steps, then come back to this page to see the decision. Accepted players get added to the Discord automatically or get a personal invite.",
      apply_login_body: "Log in with Discord so we know who you are and can show you the decision here. You do not need to be in our server yet. This also lets us add you to the server automatically if you are accepted, and lets clan staff see which other Discord servers you are in, to help catch fake or duplicate applications.",
      apply_status_help: "Login not working? Open the ", apply_status_link: "site status page", apply_status_end: " to see why.",
      apply_not_in_server: "You are not in the DUX0 Discord server yet. Join first, then come back and apply.",
      apply_join_discord: "Join the Discord",
      apply_member_title: "You are a DUX0 member", apply_member_body: "You already have the member role on our Discord. See you in the next battle.",
      apply_wait_title: "Your application is in review",
      apply_wait_body: (roblox, date) => `Sent as ${roblox} on ${date}. Our staff reads every application in Discord. This page checks for the decision by itself, so you can leave it open or come back later.`,
      apply_accept_title: "You were accepted",
      apply_accept_body: (roblox, inServer) => `Welcome to DUX0, ${roblox}. ` + (inServer ? "You are already on the server and your member role is set." : "Join our Discord with your personal invite. The bot gives you your member role the moment you arrive."),
      apply_join_btn: "Join the DUX0 Discord", apply_new_invite: "Invite expired? Get a new one", apply_get_invite: "Get my invite",
      apply_invite_hint: "The invite works for one person and expires after 3 days. People who join without an accepted application are removed automatically.",
      apply_decline_title: "Not accepted this time",
      apply_decline_body: (roblox) => `Your application as ${roblox} was declined.`,
      apply_reapply: "Apply again", apply_reapply_wait: (when) => `You can apply again after ${when}.`,
      apply_roblox_first: "We ask everyone to verify their Roblox account before applying, so staff know it is really you.",
      step_you: "You", step_progress: "Progress", step_commitment: "Commitment",
      applying_as: "Applying as ",
      lbl_roblox_user: "Roblox username", lbl_rank: "Your rank", lbl_rank_hint: "(in-game rank)",
      lbl_playtime: "Playtime", lbl_playtime_hint: "(for example 120 hours)",
      lbl_gamepasses: "Gamepasses", lbl_gamepasses_hint: "(which ones you own)",
      lbl_masteries: "Masteries", lbl_masteries_hint: "(which ones and how far)",
      lbl_spend: "Can you spend 3B gems in a clan battle when required?", yes: "Yes", no: "No",
      lbl_note: "Anything else we should know ", lbl_note_hint: "(optional)",
      btn_back: "Back", btn_next: "Next step", btn_send: "Send application", btn_sending: "Sending…",
      sent_ok: "Application sent. Staff will review it in the Discord server and message you with the result.",
      drop_title: "Add screenshots", drop_hint: "Your gamepasses, masteries and rank. Drop images here or click. Up to 5, they are shrunk automatically.",
      req_title: "What we look for", req_rank: "Minimum rank", req_playtime: "Minimum playtime", req_passes: "Useful gamepasses",
      connect_title: "My account", connect_sub: "Link your accounts. Everything here is optional except what applying needs.",
      err_invalid_roblox_name: "That Roblox username does not look right. Use 3 to 20 letters, numbers or underscores.",
      err_missing_fields: "Please fill in every required field.", err_slow_down: "Please wait a few seconds before sending again.",
      err_already_member: "You already have the DUX0 member role.", err_already_pending: "You already have an application waiting for a decision.",
      err_already_accepted: "Your application was already accepted. Open the invite on this page.",
      err_cooldown: "You were declined recently. You can apply again after the waiting time shown on this page.",
      err_too_many_images: "You can attach up to 5 screenshots.", err_image_too_large: "One screenshot is too large. Try a smaller one.",
      err_not_an_image: "Only PNG, JPG or WEBP screenshots are allowed.", err_bot_not_ready: "The bot is starting up. Try again in a minute.",
      err_invite_failed: "The bot could not create an invite right now. Ask staff in Discord.", err_already_in_server: "You are already on the server.",
      err_roblox_verify_required: "Please verify your Roblox account first.", err_generic: "Something went wrong. Please try again in a minute.",
      val_rank_playtime: "Please fill in your rank and playtime.", val_gamepasses_masteries: "Please fill in gamepasses and masteries. Write \"none\" if you have none.",
      val_spend: "Please answer the 3B gems question.", new_invite_toast: "New invite created.", invite_fail_toast: "Could not create an invite.",
      screenshots_label: "Screenshots ", screenshots_hint: "(strongly recommended)", remove_screenshot: "Remove screenshot",
    },
    de: {
      nav_home: "Start", nav_battles: "Kämpfe", nav_members: "Mitglieder", nav_stats: "Statistik", nav_live: "Live-Funde",
      nav_achievements: "Erfolge", nav_apply: "Bewerben", nav_connect: "Mein Konto", nav_owner: "Owner",
      login: "Mit Discord einloggen", logout: "Abmelden", login_offline: "Login ist nicht möglich, solange der Live-Server offline ist.",
      foot_apply: "Jetzt bewerben", foot_status: "Seitenstatus", foot_note: "Spieldaten von der öffentlichen BIG-Games-API. Keine Verbindung zu BIG Games oder Roblox.",
      offline_notice: "Der Live-Server ist gerade offline. Du siehst den zuletzt gespeicherten Stand. Bewerben, Login und Bearbeiten brauchen den Live-Server.",
      apply_title: "Bei DUX0 bewerben",
      apply_sub: "Die Mitgliedschaft läuft über eine Bewerbung. Sende sie in drei kurzen Schritten ab und schau danach hier nach der Entscheidung. Angenommene Spieler werden automatisch zum Discord hinzugefügt oder bekommen eine persönliche Einladung.",
      apply_login_body: "Melde dich mit Discord an, damit wir wissen, wer du bist, und dir hier die Entscheidung zeigen können. Du musst noch nicht auf unserem Server sein. Das erlaubt uns außerdem, dich bei Annahme automatisch hinzuzufügen, und dem Team zu sehen, auf welchen anderen Discord-Servern du bist, um gefälschte oder doppelte Bewerbungen zu erkennen.",
      apply_status_help: "Login geht nicht? Öffne die ", apply_status_link: "Seitenstatus-Seite", apply_status_end: ", um den Grund zu sehen.",
      apply_not_in_server: "Du bist noch nicht auf dem DUX0-Discord-Server. Tritt zuerst bei und bewirb dich danach.",
      apply_join_discord: "Discord beitreten",
      apply_member_title: "Du bist DUX0-Mitglied", apply_member_body: "Du hast bereits die Mitgliedsrolle auf unserem Discord. Bis zum nächsten Kampf!",
      apply_wait_title: "Deine Bewerbung wird geprüft",
      apply_wait_body: (roblox, date) => `Gesendet als ${roblox} am ${date}. Unser Team liest jede Bewerbung in Discord. Diese Seite prüft selbst auf die Entscheidung, du kannst sie offen lassen oder später wiederkommen.`,
      apply_accept_title: "Du wurdest angenommen",
      apply_accept_body: (roblox, inServer) => `Willkommen bei DUX0, ${roblox}. ` + (inServer ? "Du bist schon auf dem Server, deine Mitgliedsrolle ist gesetzt." : "Tritt unserem Discord mit deiner persönlichen Einladung bei. Der Bot gibt dir sofort deine Mitgliedsrolle."),
      apply_join_btn: "DUX0-Discord beitreten", apply_new_invite: "Einladung abgelaufen? Neue holen", apply_get_invite: "Meine Einladung holen",
      apply_invite_hint: "Die Einladung gilt für eine Person und läuft nach 3 Tagen ab. Wer ohne angenommene Bewerbung beitritt, wird automatisch entfernt.",
      apply_decline_title: "Diesmal nicht angenommen",
      apply_decline_body: (roblox) => `Deine Bewerbung als ${roblox} wurde abgelehnt.`,
      apply_reapply: "Erneut bewerben", apply_reapply_wait: (when) => `Du kannst dich ab ${when} erneut bewerben.`,
      apply_roblox_first: "Wir bitten alle, vor der Bewerbung ihren Roblox-Account zu verifizieren, damit das Team weiß, dass du es wirklich bist.",
      step_you: "Du", step_progress: "Fortschritt", step_commitment: "Einsatz",
      applying_as: "Bewerbung als ",
      lbl_roblox_user: "Roblox-Benutzername", lbl_rank: "Dein Rang", lbl_rank_hint: "(Rang im Spiel)",
      lbl_playtime: "Spielzeit", lbl_playtime_hint: "(zum Beispiel 120 Stunden)",
      lbl_gamepasses: "Gamepässe", lbl_gamepasses_hint: "(welche du besitzt)",
      lbl_masteries: "Masterys", lbl_masteries_hint: "(welche und wie weit)",
      lbl_spend: "Kannst du bei Bedarf 3 Mrd. Gems in einem Clan-Kampf ausgeben?", yes: "Ja", no: "Nein",
      lbl_note: "Sonst noch etwas, das wir wissen sollten ", lbl_note_hint: "(optional)",
      btn_back: "Zurück", btn_next: "Weiter", btn_send: "Bewerbung senden", btn_sending: "Wird gesendet…",
      sent_ok: "Bewerbung gesendet. Das Team prüft sie im Discord-Server und schreibt dir das Ergebnis.",
      drop_title: "Screenshots hinzufügen", drop_hint: "Deine Gamepässe, Masterys und dein Rang. Bilder hierher ziehen oder klicken. Bis zu 5, werden automatisch verkleinert.",
      req_title: "Worauf wir achten", req_rank: "Mindestrang", req_playtime: "Mindestspielzeit", req_passes: "Hilfreiche Gamepässe",
      connect_title: "Mein Konto", connect_sub: "Verknüpfe deine Accounts. Außer dem, was die Bewerbung braucht, ist hier alles freiwillig.",
      err_invalid_roblox_name: "Der Roblox-Benutzername sieht nicht richtig aus. Nutze 3 bis 20 Buchstaben, Zahlen oder Unterstriche.",
      err_missing_fields: "Bitte fülle alle Pflichtfelder aus.", err_slow_down: "Bitte warte ein paar Sekunden, bevor du erneut sendest.",
      err_already_member: "Du hast bereits die DUX0-Mitgliedsrolle.", err_already_pending: "Du hast schon eine Bewerbung, die auf eine Entscheidung wartet.",
      err_already_accepted: "Deine Bewerbung wurde bereits angenommen. Öffne die Einladung auf dieser Seite.",
      err_cooldown: "Du wurdest kürzlich abgelehnt. Du kannst dich nach der hier gezeigten Wartezeit erneut bewerben.",
      err_too_many_images: "Du kannst bis zu 5 Screenshots anhängen.", err_image_too_large: "Ein Screenshot ist zu groß. Versuch ein kleineres Bild.",
      err_not_an_image: "Nur PNG, JPG oder WEBP als Screenshot erlaubt.", err_bot_not_ready: "Der Bot startet gerade. Versuch es in einer Minute erneut.",
      err_invite_failed: "Der Bot konnte gerade keine Einladung erstellen. Frag das Team in Discord.", err_already_in_server: "Du bist schon auf dem Server.",
      err_roblox_verify_required: "Bitte verifiziere zuerst deinen Roblox-Account.", err_generic: "Etwas ist schiefgelaufen. Bitte versuch es in einer Minute erneut.",
      val_rank_playtime: "Bitte trage deinen Rang und deine Spielzeit ein.", val_gamepasses_masteries: "Bitte trage Gamepässe und Masterys ein. Schreib \"keine\", falls du keine hast.",
      val_spend: "Bitte beantworte die 3-Mrd.-Gems-Frage.", new_invite_toast: "Neue Einladung erstellt.", invite_fail_toast: "Einladung konnte nicht erstellt werden.",
      screenshots_label: "Screenshots ", screenshots_hint: "(sehr empfohlen)", remove_screenshot: "Screenshot entfernen",
    },
  };
  const t = (key, ...args) => {
    const v = (I18N[S.lang] && I18N[S.lang][key]) ?? I18N.en[key] ?? key;
    return typeof v === "function" ? v(...args) : v;
  };
  function setLang(l) {
    S.lang = l; localStorage.setItem("dux0_lang", l);
    renderAccount(); route();
  }

  const nf = new Intl.NumberFormat("en");
  const cf = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 2 });
  const exact = (n) => nf.format(Math.round(n || 0));
  const compact = (n) => cf.format(n || 0);
  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
  const fmtDate = (ts) => (ts ? new Date(ts * 1000).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" }) : "–");
  const ago = (ts) => {
    const s = Math.max(0, Math.round(Date.now() / 1000 - ts));
    return s < 60 ? s + "s ago" : s < 3600 ? Math.floor(s / 60) + " min ago" : Math.floor(s / 3600) + " h ago";
  };

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 3800);
  }

  async function api(path, opts = {}) {
    if (!S.api) throw new Error("offline");
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), opts.timeout || 12000);
    try {
      const headers = { ...(opts.headers || {}) };
      if (S.token) headers.Authorization = "Bearer " + S.token;
      if (opts.json) headers["Content-Type"] = "application/json";
      const res = await fetch(S.api + path, {
        method: opts.method || "GET", headers,
        body: opts.json ? JSON.stringify(opts.json) : opts.body, signal: ctl.signal,
      });
      let data = null;
      try { data = await res.json(); } catch (_) { /* empty body */ }
      if (!res.ok) { const e = new Error((data && data.error) || "http_" + res.status); e.status = res.status; throw e; }
      return data;
    } finally { clearTimeout(timer); }
  }

  async function snapshot(name) {
    const r = await fetch(`data/${name}.json?t=${Date.now()}`);
    if (!r.ok) throw new Error("no_snapshot");
    return r.json();
  }

  async function load(kind, force) {
    const c = S.cache[kind];
    if (c && !force && Date.now() - c.t < 30000) return c.v;
    let v = null;
    try {
      v = await api(kind === "clan" ? "/api/clan" : "/api/content");
      if (kind === "clan" && !v.ok) throw new Error("clan_unavailable");
      if (kind === "clan") S.offline = false;
    } catch (e) {
      if (!S.cfg) S.offline = true;
      v = await snapshot(kind).catch(() => null);
      if (kind === "clan" && !(v && v.ok)) v = null;
      if (kind === "clan" && v) S.offline = true;
    }
    showNotice();
    S.cache[kind] = { t: Date.now(), v };
    return v;
  }

  async function loadPasses() {
    if (S.passes) return S.passes;
    try { S.passes = await api("/api/passes"); } catch (_) { S.passes = []; }
    return S.passes;
  }

  function showNotice() {
    const n = $("#notice");
    n.hidden = !S.offline;
    n.textContent = t("offline_notice");
  }

  function refreshChrome() {
    document.documentElement.lang = S.lang;
    document.querySelectorAll("#links a[data-r]").forEach((a) => { a.textContent = t("nav_" + a.dataset.r); });
    $("#foot-apply").textContent = t("foot_apply");
    $("#foot-status").textContent = t("foot_status");
    $("#foot-note").textContent = t("foot_note");
    const ls = $("#langswitch");
    ls.replaceChildren(...["en", "de"].map((l) => h("button", { type: "button", class: l === S.lang ? "on" : "", "aria-pressed": String(l === S.lang), onclick: () => setLang(l) }, l.toUpperCase())));
    showNotice();
  }

  function imgSrc(p) { return p && p.startsWith("/uploads/") ? (S.api || "") + p : p || ""; }
  function picture(p, alt, cls) {
    const img = h("img", { src: imgSrc(p), alt: alt || "", loading: "lazy", class: cls || "" });
    if (p && p.startsWith("/uploads/")) {
      img.addEventListener("error", () => { const b = BASE + p.slice(1); if (img.src !== b) img.src = b; }, { once: true });
    }
    img.addEventListener("click", () => openLightbox(img.src, alt));
    return img;
  }
  function openLightbox(src, alt) {
    const lb = $("#lightbox"); const i = lb.querySelector("img");
    i.src = src; i.alt = alt || ""; lb.hidden = false;
  }
  $("#lightbox").addEventListener("click", () => { $("#lightbox").hidden = true; });

  /* modal */
  function openModal(...content) {
    const m = $("#modal"); const card = m.querySelector(".modal-card");
    card.replaceChildren(...content); m.hidden = false; S.modal = true;
    const c = card.querySelector("[data-close]"); if (c) c.focus();
  }
  function closeModal() { $("#modal").hidden = true; S.modal = false; }
  $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { $("#lightbox").hidden = true; closeModal(); }
  });

  /* count up + countdown */
  function countUp(el, to, fmt = exact, dur = 1100) {
    if (RM || S.silent || !to) { el.textContent = fmt(to); return el; }
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = fmt(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    el.textContent = fmt(0); requestAnimationFrame(step);
    return el;
  }
  const num = (v, fmt = exact) => countUp(h("span", { title: exact(v) }), v, fmt);

  function countdown(el, target) {
    const tick = () => {
      let s = Math.max(0, Math.floor(target - Date.now() / 1000));
      const d = Math.floor(s / 86400), hh = Math.floor((s % 86400) / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
      const parts = [];
      if (d) parts.push([d, "d"]);
      parts.push([hh, "h"], [mm, "m"], [ss, "s"]);
      el.replaceChildren(...parts.map(([v, u]) => h("span", { class: "cd" }, h("b", {}, String(v).padStart(2, "0")), h("i", {}, u))));
    };
    tick(); S.timers.push(setInterval(tick, 1000));
    return el;
  }

  /* embers background */
  function embers() {
    if (RM) return;
    const c = $("#embers"), ctx = c.getContext("2d");
    let w = 0, hgt = 0; const P = [];
    const spawn = (init) => ({ x: Math.random() * w, y: init ? Math.random() * hgt : hgt + 10, r: Math.random() * 1.7 + .4,
      vy: -(Math.random() * .32 + .1), a: Math.random() * .55 + .2, tw: Math.random() * 6 });
    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = innerWidth; hgt = innerHeight; c.width = w * dpr; c.height = hgt * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize(); addEventListener("resize", resize);
    for (let i = 0; i < (innerWidth < 700 ? 26 : 58); i++) P.push(spawn(true));
    const frame = (t) => {
      requestAnimationFrame(frame);
      if (document.hidden) return;
      ctx.clearRect(0, 0, w, hgt);
      for (const p of P) {
        p.y += p.vy; p.x += Math.sin(t / 1600 + p.tw) * .14;
        if (p.y < -10) Object.assign(p, spawn(false));
        ctx.globalAlpha = p.a * (.55 + .45 * Math.sin(t / 750 + p.tw));
        ctx.fillStyle = p.r > 1.4 ? "#d2b0ff" : "#8b3dff";
        ctx.fillRect(p.x, p.y, p.r * 1.6, p.r * 1.6);
      }
    };
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------ */
  /* account                                                             */
  /* ------------------------------------------------------------------ */
  function login() {
    if (!S.cfg || !S.cfg.clientId) { toast(t("login_offline")); return; }
    const st = Array.from(crypto.getRandomValues(new Uint32Array(4))).join("-");
    sessionStorage.setItem("dux0_state", st);
    sessionStorage.setItem("dux0_return", location.hash || "#/");
    const q = new URLSearchParams({ client_id: S.cfg.clientId, response_type: "code", scope: "identify guilds guilds.join", redirect_uri: S.cfg.redirectUri, state: st });
    location.href = "https://discord.com/oauth2/authorize?" + q;
  }
  function logout() {
    localStorage.removeItem("dux0_token"); S.token = ""; S.me = null; renderAccount(); route();
  }
  async function refreshMe() {
    S.me = null;
    if (!S.token) return;
    try { S.me = await api("/api/me"); }
    catch (e) { if (e.status === 401) { localStorage.removeItem("dux0_token"); S.token = ""; } }
  }
  function renderAccount() {
    const box = $("#account"); box.replaceChildren();
    if (S.me) box.append(S.me.user.avatar ? h("img", { src: S.me.user.avatar, alt: "" }) : "", h("span", { class: "who" }, S.me.user.name), h("button", { class: "btn ghost small", onclick: logout }, t("logout")));
    else if (S.token) box.append(h("button", { class: "btn ghost small", onclick: logout }, t("logout")));
    else box.append(h("button", { class: "btn small", onclick: login }, t("login")));
    $("#owner-link").hidden = !(S.me && S.me.owner);
    refreshChrome();
  }

  /* ------------------------------------------------------------------ */
  /* shared building blocks                                              */
  /* ------------------------------------------------------------------ */
  const loading = () => { if (!S.silent) view.replaceChildren(h("div", { class: "loading" }, h("div", { class: "skel shard" }), h("div", { class: "skel shard" }), h("div", { class: "skel shard" }))); };
  const pageHead = (t, sub) => h("div", { class: "page-head" }, h("h1", {}, t), sub ? h("p", {}, sub) : null);
  const empty = (msg) => h("p", { class: "empty" }, msg);
  const avatar = (m, cls) => m.avatar ? h("img", { class: "av " + (cls || ""), src: m.avatar, alt: "", loading: "lazy" }) : h("span", { class: "av " + (cls || "") });
  const placeCls = (n) => "p" + (n <= 3 ? n : "x");
  const crown = () => sv("svg", { class: "crown", viewBox: "0 0 34 26" },
    sv("path", { d: "M2 22 L4 6 L11 13 L17 2 L23 13 L30 6 L32 22 Z", fill: "#f2c14e" }),
    sv("rect", { x: 2, y: 23, width: 30, height: 3, fill: "#c99a2e" }));

  function badge(state) {
    const label = state === "live" ? "Live" : state === "upcoming" ? "Starting soon" : "Ended";
    return h("span", { class: "badge " + state }, h("i"), label);
  }

  function livePanel(clan) {
    const ev = clan && clan.event, t = (clan && clan.totals) || {};
    const p = h("section", { class: "live panel shard", "aria-label": "Clan battle" });
    if (!ev) {
      p.append(
        h("div", {}, h("span", { class: "badge ended" }, h("i"), "No battle data"), h("h2", {}, "Waiting for the next clan battle"),
          h("p", { class: "cap" }, "Live standings appear here as soon as the game reports a clan battle.")),
        h("div", {}, h("div", { class: "big" }, num(t.members || 0), h("small", {}, "members"))),
        h("div", {}, h("div", { class: "big" }, num(t.points || 0), h("small", {}, "all-time points"))));
      return p;
    }
    const r = ev.rank;
    const left = h("div", {}, badge(ev.state), h("h2", {}, ev.title));
    if (ev.state === "live" && ev.finish) left.append(h("p", { class: "cap" }, "Ends in"), countdown(h("div", { class: "cd-row" }), ev.finish));
    else if (ev.state === "upcoming" && ev.start) left.append(h("p", { class: "cap" }, "Starts in"), countdown(h("div", { class: "cd-row" }), ev.start));
    else left.append(h("p", { class: "cap" }, ev.finish ? "Ended " + fmtDate(ev.finish) : "The game API still lists this battle as the latest."));

    const mid = h("div", {}, h("p", { class: "cap" }, "Global place"),
      r ? h("div", { class: "big" }, "#", num(r.place), h("small", {}, "of " + exact(r.total) + " clans")) : h("div", { class: "big" }, "–"),
      r ? null : h("p", { class: "gap" }, "Place is being calculated. Try again in a minute."));
    const right = h("div", {}, h("p", { class: "cap" }, "Points this battle"), h("div", { class: "big" }, num(ev.points)));
    const tr = clan.tracking || {};
    if (tr.rate1h != null) right.append(h("p", { class: "gap" }, h("b", {}, exact(tr.rate1h)), " points per hour (last " + winLabel(tr.window) + ")"));
    if (r && r.above) right.append(h("p", { class: "gap" }, h("b", { class: "up" }, exact(r.above.points - ev.points)), " behind #" + (r.place - 1) + " " + r.above.name));
    if (r && r.below) right.append(h("p", { class: "gap" }, h("b", { class: "down" }, exact(ev.points - r.below.points)), " ahead of " + r.below.name));
    p.append(left, mid, right);
    const upd = h("span", { class: "upd" });
    const tick = () => { upd.textContent = (S.offline ? "Saved snapshot from " : "Updated ") + ago(clan.updated) + (S.offline ? "" : " · refreshes every 30 s"); };
    tick(); S.timers.push(setInterval(tick, 1000)); p.append(upd);
    return p;
  }
  const winLabel = (sec) => (sec >= 3500 ? "hour" : Math.max(1, Math.round((sec || 0) / 60)) + " min");

  function contribRows(members, limit) {
    const top = [...members].sort((a, b) => b.event - a.event).slice(0, limit);
    const max = Math.max(...top.map((m) => m.event), 1);
    return h("ol", { class: "ledger" }, top.map((m, i) => h("li", {}, h("button", { type: "button", class: "row one " + placeCls(i + 1), onclick: () => openMember(m) },
      h("span", { class: "place" }, "#" + (i + 1)), avatar(m),
      h("div", { class: "who" }, h("b", {}, m.display, m.role !== "Member" ? h("span", { class: "tag" }, m.role) : null), h("small", {}, "@" + m.name)),
      h("div", { class: "bar" }, h("i", { style: `width:${Math.max(2, (m.event / max) * 100)}%` })),
      h("div", { class: "val" }, h("b", {}, exact(m.event)), h("small", {}, "points"))))));
  }

  function ourRow(clan, limit) {
    const ev = clan && clan.event, r = ev && ev.rank;
    if (!r || r.place <= limit) return null;
    return { rank: r.place, name: clan.clan.name, icon: clan.clan.icon, country: clan.clan.country, members: clan.totals.members, capacity: clan.clan.capacity, points: ev.points, ours: true };
  }
  function clanBoard(list, limit, clan) {
    const rows = (list || []).slice(0, limit), mine = ourRow(clan, limit);
    if (mine) { rows.push({ gap: true }); rows.push(mine); }
    return h("div", {}, rows.map((c) => c.gap ? h("div", { class: "hint", style: "padding:.3rem 0 .3rem 3.5rem" }, "…") : h("div", { class: "clanrow " + placeCls(c.rank) + (c.ours ? " ours" : "") },
      h("span", { class: "place" }, "#" + c.rank), c.icon ? h("img", { src: c.icon, alt: "", loading: "lazy" }) : h("span"),
      h("div", { class: "who" }, h("b", {}, c.name, c.ours ? h("span", { class: "tag" }, "us") : null), h("small", {}, (c.country || "") + (c.members ? " · " + c.members + (c.capacity ? "/" + c.capacity : "") + " members" : ""))),
      h("span", { class: "pts" }, exact(c.points)))));
  }

  /* member detail dialog */
  function openMember(m) {
    const clan = S.cache.clan && S.cache.clan.v; const t = (clan && clan.totals) || {};
    const stat = (v, l) => h("div", { class: "mstat" }, h("b", { title: exact(v) }, typeof v === "number" ? exact(v) : v), h("span", {}, l));
    openModal(
      h("div", { class: "mhead" }, avatar(m), h("div", {}, h("h3", {}, m.display, m.role !== "Member" ? h("span", { class: "tag" }, m.role) : null), h("small", { class: "hint" }, "@" + m.name))),
      h("div", { class: "mgrid" },
        stat(m.event, "Points this battle · #" + m.eventRank),
        stat(m.points, "All-time points · #" + m.pointsRank),
        stat(m.gems, "Gems donated · #" + m.gemsRank),
        stat(pct(m.event, t.event) + "%", "Share of this battle"),
        stat(fmtDate(m.joined), "Joined DUX0"),
        stat(compact(m.gems), "Gems (short)")),
      h("div", { class: "editor-actions" },
        h("a", { class: "btn small", href: `https://www.roblox.com/users/${m.id}/profile`, target: "_blank", rel: "noopener" }, "Roblox profile"),
        h("button", { class: "btn ghost small", "data-close": true, onclick: closeModal }, "Close")));
  }

  async function openUserDetail(uid) {
    openModal(h("p", { class: "loading" }, "Loading…"));
    let d;
    try { d = await api("/api/owner/user/" + encodeURIComponent(uid)); }
    catch (e) { openModal(h("p", { class: "err" }, "Could not load: " + e.message), h("button", { class: "btn ghost small", onclick: closeModal }, "Close")); return; }
    const disc = d.discord || {};
    const KIND_LABEL = { join: "Joined", left: "Left", kicked: "Kicked", banned: "Banned" };
    const rows = [
      h("div", { class: "mhead" },
        disc.avatar ? h("img", { class: "av", src: disc.avatar, alt: "" }) : h("span", { class: "av" }),
        h("div", {}, h("h3", {}, disc.display || disc.name || ("Discord " + uid)), h("small", { class: "hint" }, `${disc.inServer ? "On the server" : "Not on the server"}${disc.joinedAt ? " · joined " + dateTime(disc.joinedAt) : ""}${disc.isOwner ? " · Owner" : disc.isAdmin ? " · Staff" : ""}`))),
      disc.roles && disc.roles.length ? h("p", {}, h("b", {}, "Roles: "), disc.roles.join(", ")) : null,
    ];
    rows.push(h("section", { class: "section" }, h("h2", {}, "Roblox"),
      d.roblox ? h("div", { class: "verified" }, h("span", { class: "tick" }, "✓"),
          h("div", {}, h("b", {}, d.roblox.name), h("small", {}, "verified " + dateTime(d.roblox.verified))),
          h("a", { class: "btn small", style: "margin-left:auto", href: `https://www.roblox.com/users/${d.roblox.id}/profile`, target: "_blank", rel: "noopener" }, "Roblox profile"))
        : h("p", { class: "hint" }, "Not linked yet.")));
    rows.push(h("section", { class: "section" }, h("h2", {}, "Inventory"),
      d.big && d.big.shareInventory
        ? h("p", {}, h("a", { class: "btn small", href: "#/inventory/" + uid }, "Open shared inventory"), h("span", { class: "hint" }, "  updated " + ago2(d.big.lastFetch)))
        : d.big ? h("p", { class: "hint" }, "Connected to BIG Games, but the inventory is kept private.")
        : h("p", { class: "hint" }, "No BIG Games connection - inventory not shared. Ask them to open My account and connect it, or to list their pets, rank and masteries manually.")));
    rows.push(h("section", { class: "section" }, h("h2", {}, "Shared Discord servers"),
      d.guilds === null ? h("p", { class: "hint" }, "Not shared (they logged in before this feature, or declined it).")
        : h("div", { class: "grid" }, d.guilds.map((g) => h("div", { class: "clanrow" }, g.icon ? h("img", { src: g.icon, alt: "" }) : h("span"),
            h("div", { class: "who" }, h("b", {}, g.name, g.here ? h("span", { class: "tag" }, "this server") : null), h("small", {}, g.owner ? "owner" : "member")), h("span"))))));
    if (d.memberLog && d.memberLog.length) rows.push(h("section", { class: "section" }, h("h2", {}, "Join / leave history"),
      h("div", { class: "hist panel shard" }, d.memberLog.map((e) => h("div", { class: "clanrow" }, h("div", { class: "who" }, h("b", {}, KIND_LABEL[e.type] || e.type), e.by ? h("small", {}, " by " + e.by) : null), h("span"), h("span", { class: "hint" }, dateTime(e.ts)))))));
    if (d.applications && d.applications.length) rows.push(h("section", { class: "section" }, h("h2", {}, "Application history"),
      h("div", { class: "hist panel shard" }, d.applications.map((a) => h("div", { class: "clanrow" }, h("div", { class: "who" }, h("b", {}, a.roblox), h("span", { class: "tag " + a.status }, a.status)), h("span"), h("span", { class: "hint" }, dateTime(a.created)))))));
    rows.push(h("div", { class: "editor-actions" }, h("button", { class: "btn ghost small", "data-close": true, onclick: closeModal }, "Close")));
    openModal(...rows);
  }

  async function ownerUsers() {
    const input = h("input", { type: "text", placeholder: "Discord user ID", inputmode: "numeric" });
    const go = () => { const v = input.value.trim(); if (/^\d{2,25}$/.test(v)) openUserDetail(v); else toast("Enter a numeric Discord user ID (right-click a user \u2192 Copy User ID, needs Developer Mode)."); };
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    return h("div", { class: "card wide panel shard" },
      h("p", {}, "Look up any Discord user by ID to see their linked Roblox account, shared inventory, shared servers, join/leave history and past applications."),
      h("div", { class: "editor-actions" }, input, h("button", { class: "btn", type: "button", onclick: go }, "Look up")),
      h("p", { class: "hint" }, "Tip: on the Applications tab, use \"View full profile\" to open this for a specific applicant directly."));
  }

  /* ------------------------------------------------------------------ */
  /* views                                                               */
  /* ------------------------------------------------------------------ */
  async function viewHome() {
    loading();
    const [clan, content] = await Promise.all([load("clan"), load("content")]);
    const c = content || {}, t = (clan && clan.totals) || {}, cl = (clan && clan.clan) || {};
    const cap = cl.capacity ? `${t.members}/${cl.capacity}` : (t.members ?? "–");
    const tile = (label, value, cls) => h("div", { class: "tile panel shard " + (cls || "") }, h("b", {}, typeof value === "number" ? num(value) : value), h("span", {}, label));

    view.replaceChildren(
      c.announcement ? h("div", { class: "announce shard" }, h("span", { class: "pin" }), c.announcement) : null,
      h("section", { class: "hero" }, h("img", { src: "assets/banner.png", alt: "DUX0 – United as one. Built to win." }), h("div", { class: "sweep" })),
      livePanel(clan),
      h("section", { class: "tiles" },
        tile("Members", cap), tile("Points this battle", t.event || 0, "gold"), tile("All-time battle points", t.points || 0), tile("Gems donated", clan ? h("span", { title: exact(t.gems) }, compact(t.gems)) : "–")),
      clan && clan.members.length ? h("section", { class: "section" },
        h("div", { class: "two" },
          h("div", {}, h("h2", {}, "Top contributors"), contribRows(clan.members, 6), h("p", {}, h("a", { href: "#/members" }, "See every member"))),
          h("div", {}, h("h2", {}, "Clan battle top 5"),
            clan.event && clan.event.topClans.length ? clanBoard(clan.event.topClans, 5, clan) : empty("The clan leaderboard is not available right now."),
            h("p", {}, h("a", { href: "#/battles" }, "Open the battle page"))))) : null,
      h("section", { class: "section" }, h("div", { class: "join panel shard" },
        h("div", {}, h("h2", {}, "Join DUX0"), h("p", { class: "about-text" }, c.about || ""),
          h("p", { class: "hint" }, "Membership is by application. Once you are accepted you get a personal invite to our Discord."),
          h("div", { class: "cta" }, h("a", { class: "btn", href: "#/apply" }, "Apply to join"), h("a", { class: "btn ghost", href: "#/apply" }, "Check my application"))),
        c.requirements && c.requirements.length ? h("div", {}, h("h3", {}, "What we look for"), h("ul", { class: "reqs" }, c.requirements.map((r) => h("li", {}, r)))) : null)));
  }

  const SORTS = {
    event: { label: "Battle points", rank: "eventRank", get: (m) => m.event },
    points: { label: "All-time points", rank: "pointsRank", get: (m) => m.points },
    gems: { label: "Gems", rank: "gemsRank", get: (m) => m.gems },
    gain: { label: "Last hour", rank: null, get: (m) => m.gain || 0 },
    joined: { label: "Longest member", rank: null, get: (m) => -(m.joined || 9e12) },
  };
  function sortedMembers(members, key) {
    const s = SORTS[key];
    return [...members].sort((a, b) => s.get(b) - s.get(a) || a.name.localeCompare(b.name));
  }
  function mainVal(m, key) {
    if (key === "gems") return h("b", { title: exact(m.gems) }, compact(m.gems));
    if (key === "gain") return h("b", {}, (m.gain ? "+" : "") + exact(m.gain || 0));
    if (key === "joined") return h("b", {}, fmtDate(m.joined));
    return h("b", {}, exact(SORTS[key].get(m)));
  }
  function subVal(m, key) {
    if (key === "gain") return `${exact(m.event)} this battle · ${compact(m.gems)} gems`;
    if (key === "event") return `${exact(m.points)} all-time · ${compact(m.gems)} gems` + (m.gain ? ` · +${exact(m.gain)} recently` : "");
    if (key === "points") return `${exact(m.event)} this battle · ${compact(m.gems)} gems`;
    if (key === "gems") return `${exact(m.event)} battle · ${exact(m.points)} all-time`;
    return `${exact(m.event)} points this battle`;
  }

  async function viewMembers() {
    loading();
    const clan = await load("clan");
    const members = (clan && clan.members) || [];
    if (!members.length) { view.replaceChildren(pageHead("Members", "Every DUX0 member with points and gems."), empty("Member data is not available yet. Try again in a minute.")); return; }
    const list = h("ol", { class: "ledger" }), pod = h("div");
    const draw = () => {
      const key = S.sort, sorted = sortedMembers(members, key);
      const max = Math.max(...sorted.map((m) => Math.abs(SORTS[key].get(m))), 1);
      const q = S.q.toLowerCase();
      const rows = sorted.map((m, i) => ({ m, place: i + 1 })).filter(({ m }) => !q || (m.name + " " + m.display).toLowerCase().includes(q));
      if (key !== "joined" && !q) {
        pod.replaceChildren(h("div", { class: "podium" }, [2, 1, 3].map((pl) => {
          const m = sorted[pl - 1]; if (!m) return h("span");
          return h("button", { type: "button", class: `pod panel shard ${placeCls(pl)}`, onclick: () => openMember(m) },
            pl === 1 ? crown() : null, h("span", { class: "place" }, "#" + pl), avatar(m), h("b", { class: "name" }, m.display),
            h("div", { class: "pv", title: exact(SORTS[key].get(m)) }, key === "gems" ? compact(m.gems) : exact(SORTS[key].get(m))), h("small", {}, SORTS[key].label));
        })));
      } else pod.replaceChildren();
      list.replaceChildren(...(rows.length ? rows.map(({ m, place }) => h("li", {}, h("button", { type: "button", class: "row " + placeCls(place), onclick: () => openMember(m) },
        h("span", { class: "place" }, "#" + place), avatar(m),
        h("div", { class: "who" }, h("b", {}, m.display, m.role !== "Member" ? h("span", { class: "tag" }, m.role) : null), h("small", {}, "@" + m.name)),
        h("div", { class: "bar" }, h("i", { style: `width:${Math.max(2, (Math.abs(SORTS[key].get(m)) / max) * 100)}%` })),
        h("div", { class: "val" }, mainVal(m, key), h("small", {}, subVal(m, key)))))) : [h("li", { class: "empty" }, "No member matches that name.")]));
    };
    const seg = h("div", { class: "seg", role: "group", "aria-label": "Sort members by" });
    for (const [k, s] of Object.entries(SORTS)) {
      seg.append(h("button", { type: "button", "aria-pressed": String(k === S.sort), onclick: (e) => {
        S.sort = k; seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === e.currentTarget))); draw();
      } }, s.label));
    }
    const search = h("input", { type: "text", placeholder: "Search a member", "aria-label": "Search a member", value: S.q, oninput: (e) => { S.q = e.target.value.trim(); draw(); } });
    view.replaceChildren(
      pageHead("Members", `${members.length} players. Click anyone for their full numbers. Updated ${ago(clan.updated)}.`),
      h("div", { class: "tools" }, seg, search), pod, list);
    draw();
  }

  async function viewBattles() {
    loading();
    const clan = await load("clan");
    if (!clan) { view.replaceChildren(pageHead("Clan battles", "Live standings and history."), empty("Battle data is not available right now.")); return; }
    const ev = clan.event, md = clan.clan.medals || {};
    const parts = [pageHead("Clan battle", "Live standings straight from the game. Updated " + ago(clan.updated) + ".")];
    parts.push(livePanel(clan));
    if (ev) {
      parts.push(h("section", { class: "section two" },
        h("div", {}, h("h2", {}, "Leaderboard"), ev.topClans.length ? clanBoard(ev.topClans, 10, clan) : empty("Leaderboard not available.")),
        h("div", {}, h("h2", {}, "Our contributors"), clan.members.length ? contribRows(clan.members, 10) : empty("No contributions yet."))));
      const side = [];
      if (ev.rewards && ev.rewards.length) side.push(h("div", {}, h("h2", {}, "Placement rewards"), h("table", { class: "rewards" },
        h("thead", {}, h("tr", {}, h("th", {}, "Places"), h("th", {}, "Reward"))),
        h("tbody", {}, ev.rewards.map((r) => h("tr", {}, h("td", {}, r.best === r.worst ? "#" + r.best : `#${r.best} – #${r.worst}`), h("td", {}, (r.amount > 1 ? exact(r.amount) + "× " : "") + r.item)))))));
      if (ev.goals && ev.goals.length) side.push(h("div", {}, h("h2", {}, "Goals"), ev.goals.map((g) => h("div", { class: "goal" }, h("span", {}, g.title || "Goal"), h("b", {}, g.amount ? exact(g.amount) : "")))));
      if (ev.topPlayers && ev.topPlayers.length) side.push(h("div", {}, h("h2", {}, "Best players this battle"), h("div", {}, ev.topPlayers.map((p) => h("div", { class: "clanrow " + placeCls(p.rank || 9) },
        h("span", { class: "place" }, "#" + p.rank), h("span"), h("div", { class: "who" }, h("b", {}, p.name), h("small", {}, p.clan || "")), h("span", { class: "pts" }, exact(p.points)))))));
      if (side.length) parts.push(h("section", { class: "section two" }, side));
    }
    const trend = ((clan.tracking || {}).trend || []);
    if (trend.length >= 3) {
      const placeData = trend.filter((t) => t[2] != null).map((t) => [t[0], t[2]]);
      parts.push(h("section", { class: "section" }, h("h2", {}, "Live tracking", h("small", {}, "Measured by our bot every minute, last 24 hours")),
        h("div", { class: "two" },
          h("div", { class: "chart panel shard" }, h("p", { class: "cap" }, "Points this battle"), lineChart(trend.map((t) => [t[0], t[1]]), { fmt: compact })),
          placeData.length >= 3 ? h("div", { class: "chart panel shard" }, h("p", { class: "cap" }, "Our global place (higher is better)"), lineChart(placeData, { invert: true, fmt: (v) => "#" + exact(v), color: "#ff4d78" })) : null)));
    }
    parts.push(h("section", { class: "section" }, h("h2", {}, "Medals"), h("div", { class: "medals" },
      ["gold", "silver", "bronze"].map((k) => h("div", { class: "medal panel shard " + k }, h("b", {}, md[k] || 0), h("span", {}, k[0].toUpperCase() + k.slice(1) + " medals"))))));
    parts.push(h("section", { class: "section" }, h("h2", {}, "Battle history"),
      clan.history.length ? h("div", { class: "panel shard hist" }, [...clan.history].reverse().map((b) => h("div", { class: "clanrow" },
        h("div", { class: "who" }, h("b", {}, b.title, b.live ? h("span", { class: "tag" }, "live") : null), h("small", {}, b.place ? "Place #" + b.place : "Place not recorded")),
        h("span", { class: "pts" }, exact(b.points)), h("span", { class: "hint" }, "points")))) : empty("No past battles stored yet.")));
    view.replaceChildren(...parts);
  }

  function donut(slices, total) {
    const r = 70, C = 2 * Math.PI * r; let acc = 0;
    const svg = sv("svg", { viewBox: "0 0 200 200", role: "img", "aria-label": "Share of battle points per member" });
    svg.append(sv("circle", { cx: 100, cy: 100, r, fill: "none", stroke: "#1a1032", "stroke-width": 28 }));
    for (const s of slices) {
      const len = total ? (s.value / total) * C : 0;
      svg.append(sv("circle", { cx: 100, cy: 100, r, fill: "none", stroke: s.color, "stroke-width": 28, "stroke-dasharray": `${Math.max(0, len - 1.5)} ${C}`, "stroke-dashoffset": -acc, transform: "rotate(-90 100 100)" }, sv("title", {}, `${s.label}: ${exact(s.value)}`)));
      acc += len;
    }
    svg.append(sv("text", { x: 100, y: 98, "text-anchor": "middle", style: "font:600 30px Teko,sans-serif;fill:#f2ecfc" }, compact(total)),
      sv("text", { x: 100, y: 118, "text-anchor": "middle" }, "points"));
    return svg;
  }

  let chartId = 0;
  function lineChart(data, { invert = false, fmt = exact, color = "#8b3dff" } = {}) {
    const W = 640, H = 210, pl = 58, pr = 12, pt = 12, pb = 26, id = "lg" + ++chartId;
    const xs = data.map((d) => d[0]), ys = data.map((d) => d[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), lo = Math.min(...ys), hi = Math.max(...ys), span = hi - lo || 1;
    const X = (t) => pl + ((t - x0) / (x1 - x0 || 1)) * (W - pl - pr);
    const Y = (v) => { const r = (v - lo) / span; return pt + (invert ? r : 1 - r) * (H - pt - pb); };
    const line = data.map((d, i) => (i ? "L" : "M") + X(d[0]).toFixed(1) + " " + Y(d[1]).toFixed(1)).join(" ");
    const svg = sv("svg", { viewBox: `0 0 ${W} ${H}`, role: "img" });
    svg.append(sv("defs", {}, sv("linearGradient", { id, x1: 0, y1: 0, x2: 0, y2: 1 }, sv("stop", { offset: "0%", "stop-color": color, "stop-opacity": .4 }), sv("stop", { offset: "100%", "stop-color": color, "stop-opacity": 0 }))));
    [0, .5, 1].forEach((f) => {
      const v = invert ? lo + span * f : hi - span * f, y = pt + f * (H - pt - pb);
      svg.append(sv("line", { x1: pl, x2: W - pr, y1: y, y2: y, stroke: "#31205a", "stroke-dasharray": "3 5" }), sv("text", { x: pl - 8, y: y + 4, "text-anchor": "end" }, fmt(v)));
    });
    svg.append(sv("path", { d: `${line} L${X(x1)} ${H - pb} L${X(x0)} ${H - pb} Z`, fill: `url(#${id})` }), sv("path", { d: line, fill: "none", stroke: color, "stroke-width": 2.5, "stroke-linejoin": "round" }));
    const tm = (t) => new Date(t * 1000).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" });
    svg.append(sv("text", { x: pl, y: H - 6 }, tm(x0)), sv("text", { x: W - pr, y: H - 6, "text-anchor": "end" }, tm(x1)));
    const last = data[data.length - 1];
    svg.append(sv("circle", { cx: X(last[0]), cy: Y(last[1]), r: 4.5, fill: color }));
    return svg;
  }

  function historyChart(history) {
    const data = history.slice(-14); if (!data.length) return empty("No past battles stored yet.");
    const W = 640, H = 220, pad = 28, bw = (W - pad * 2) / data.length;
    const max = Math.max(...data.map((d) => d.points), 1);
    const svg = sv("svg", { viewBox: `0 0 ${W} ${H + 24}`, role: "img", "aria-label": "Points per clan battle" });
    for (let g = 0; g <= 3; g++) svg.append(sv("line", { x1: pad, x2: W - pad, y1: H - (H - 20) * g / 3, y2: H - (H - 20) * g / 3, stroke: "#31205a", "stroke-width": 1, "stroke-dasharray": "3 5" }));
    data.forEach((d, i) => {
      const bh = Math.max(3, (d.points / max) * (H - 20)), x = pad + i * bw + bw * .15, w = bw * .7;
      svg.append(sv("rect", { x, y: H - bh, width: w, height: bh, fill: d.live ? "#ff4d78" : i === data.length - 1 ? "#b47bff" : "#8b3dff", opacity: d.live ? 1 : .85 }, sv("title", {}, `${d.title}: ${exact(d.points)} points${d.place ? ", place #" + d.place : ""}`)));
      svg.append(sv("text", { x: x + w / 2, y: H + 16, "text-anchor": "middle" }, d.live ? "live" : d.place ? "#" + d.place : String(i + 1)));
    });
    return svg;
  }

  async function viewStats() {
    loading();
    const clan = await load("clan");
    if (!clan || !clan.members.length) { view.replaceChildren(pageHead("Stats", "How the clan is doing."), empty("Stats are not available right now.")); return; }
    const m = clan.members, t = clan.totals, palette = ["#8b3dff", "#b47bff", "#6a2bd1", "#d9c4ff", "#5a34a8", "#a05cff", "#7d4ad9", "#c9a3ff"];
    const top = [...m].sort((a, b) => b.event - a.event), n = 7;
    const slices = top.slice(0, n).map((x, i) => ({ label: x.display, value: x.event, color: palette[i] }));
    const rest = top.slice(n).reduce((s, x) => s + x.event, 0);
    if (rest > 0) slices.push({ label: "Everyone else", value: rest, color: "#3a2a5e" });
    const total = slices.reduce((s, x) => s + x.value, 0);
    const active = t.contributors, avg = active ? Math.round(t.event / active) : 0, top3 = pct(top.slice(0, 3).reduce((s, x) => s + x.event, 0), t.event);
    const gemTop = [...m].sort((a, b) => b.gems - a.gems).slice(0, 8), gmax = Math.max(...gemTop.map((x) => x.gems), 1);
    const tile = (label, v, cls) => h("div", { class: "tile panel shard " + (cls || "") }, h("b", {}, v), h("span", {}, label));

    view.replaceChildren(
      pageHead("Stats", "What the numbers say about DUX0. Updated " + ago(clan.updated) + "."),
      h("section", { class: "tiles" },
        tile("Members who scored this battle", `${active}/${t.members}`), tile("Average per scorer", num(avg)), tile("Top 3 share of points", top3 + "%", "gold"), tile("Gems donated in total", h("span", { title: exact(t.gems) }, compact(t.gems)))),
      h("section", { class: "section two" },
        h("div", {}, h("h2", {}, "Who carries the battle"), h("div", { class: "chart panel shard" }, h("div", { class: "donut-wrap" }, donut(slices, total),
          h("ul", { class: "legend" }, slices.map((s) => h("li", {}, h("i", { style: `background:${s.color}` }), s.label, h("span", {}, pct(s.value, total) + "%"))))))),
        h("div", {}, h("h2", {}, "Biggest gem donors"), h("div", { class: "panel shard" }, h("ol", { class: "ledger" }, gemTop.map((x, i) => h("li", {}, h("button", { type: "button", class: "row one " + placeCls(i + 1), onclick: () => openMember(x) },
          h("span", { class: "place" }, "#" + (i + 1)), avatar(x), h("div", { class: "who" }, h("b", {}, x.display)), h("div", { class: "bar" }, h("i", { style: `width:${Math.max(2, (x.gems / gmax) * 100)}%` })), h("div", { class: "val" }, h("b", { title: exact(x.gems) }, compact(x.gems)), h("small", {}, "gems"))))))))),
      h("section", { class: "section" }, h("h2", {}, "Points per battle", h("small", {}, "Labels show the place we finished")), h("div", { class: "chart panel shard" }, historyChart(clan.history))));
  }

  async function viewAchievements() {
    loading();
    const c = (await load("content")) || {}, ach = c.achievements || [], gal = c.gallery || [];
    view.replaceChildren(
      pageHead("Achievements", "What DUX0 has won together."),
      ach.length ? h("div", { class: "grid" }, ach.map((a) => h("article", { class: "ach panel shard" },
        a.image ? picture(a.image, a.title, "pic") : h("div", { class: "pic none" }, "No image yet"),
        h("div", { class: "txt" }, h("h3", {}, a.title), a.date ? h("div", { class: "date" }, a.date) : null, a.desc ? h("p", {}, a.desc) : null))))
        : empty("No achievements added yet."),
      gal.length ? h("section", { class: "section" }, h("h2", {}, "Clan gallery"),
        h("div", { class: "masonry" }, gal.map((g) => h("figure", {}, picture(g.image, g.caption), g.caption ? h("figcaption", {}, g.caption) : null)))) : null);
  }

  /* ---------------- apply: form, status, invite ---------------- */
  async function shrinkImage(file) {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("not_an_image");
    const bmp = await createImageBitmap(file);
    const sc = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.86));
    return { blob, name: file.name.replace(/\.\w+$/, "") + ".jpg", url: URL.createObjectURL(blob) };
  }

  const dateTime = (ts) => (ts ? new Date(ts * 1000).toLocaleString(S.lang, { dateStyle: "medium", timeStyle: "short" }) : "");
  function statusCard(kind, glyph, title, ...body) {
    return h("div", { class: "status-card panel shard " + kind }, h("div", { class: "status-glyph" }, h("span", {}, glyph)), h("div", { class: "status-body" }, h("h2", {}, title), body));
  }
  function timeline(active) {
    const titles = [{ en: "Application sent", de: "Bewerbung gesendet" }, { en: "Staff review", de: "Prüfung durchs Team" }, { en: "Decision", de: "Entscheidung" }];
    return h("ol", { class: "timeline" }, titles.map((tt, i) => h("li", { class: i < active ? "done" : i === active ? "now" : "" }, h("i"), tt[S.lang] || tt.en)));
  }

  function requirementsCard(content) {
    const rd = content.requirementsDetail || {};
    const hasPasses = (rd.gamepasses || []).length > 0;
    const rows = [];
    if (rd.minRank) rows.push(h("div", { class: "req-row" }, h("b", {}, t("req_rank")), h("span", {}, rd.minRank)));
    if (rd.minPlaytime) rows.push(h("div", { class: "req-row" }, h("b", {}, t("req_playtime")), h("span", {}, rd.minPlaytime)));
    if (!rows.length && !hasPasses && !(content.requirements || []).length) return null;
    const passRow = hasPasses ? h("div", { class: "req-passes" },
      h("b", {}, t("req_passes")),
      h("div", { class: "pass-chips" }, (S.passes || []).filter((p) => rd.gamepasses.includes(p.id)).map((p) =>
        h("a", { class: "pass-chip", href: `https://www.roblox.com/game-pass/${p.id}`, target: "_blank", rel: "noopener", title: p.name },
          p.icon ? h("img", { src: p.icon, alt: "" }) : null, h("span", {}, p.name))))) : null;
    return h("div", { class: "card panel shard req-card" },
      h("h3", {}, t("req_title")),
      rows.length ? h("div", { class: "req-grid" }, rows) : null,
      passRow,
      (content.requirements || []).length ? h("ul", { class: "reqs" }, content.requirements.map((r) => h("li", {}, r))) : null);
  }

  async function viewApply() {
    loading();
    const [content] = await Promise.all([load("content"), loadPasses()]);
    const head = pageHead(t("apply_title"), t("apply_sub"));
    if (S.offline || !S.api) { view.replaceChildren(head, empty("The live server is offline, so applications cannot be sent right now. Please try again later.")); return; }
    const reqCard = content ? requirementsCard(content) : null;

    if (!S.token || !S.me) {
      view.replaceChildren(head, reqCard, h("div", { class: "card panel shard" },
        h("p", {}, t("apply_login_body")),
        h("button", { class: "btn", onclick: login }, t("login")),
        h("p", { class: "hint" }, t("apply_status_help"), h("a", { href: "#/status" }, t("apply_status_link")), t("apply_status_end"))));
      return;
    }
    const me = S.me, app = me.application;
    const rerender = () => route({ silent: true });

    if (me.hasRole && (!app || app.status !== "pending")) { view.replaceChildren(head, statusCard("ok", "✓", t("apply_member_title"), h("p", {}, t("apply_member_body")))); return; }

    if (app && app.status === "pending") {
      S.timers.push(setInterval(async () => { await refreshMe(); if (!S.me || !S.me.application || S.me.application.status !== "pending") route({ silent: true }); }, 15000));
      view.replaceChildren(head, statusCard("wait", "…", t("apply_wait_title"), h("p", {}, t("apply_wait_body", app.roblox, dateTime(app.created))), timeline(1)));
      return;
    }
    if (app && app.status === "accepted") {
      const body = [h("p", {}, t("apply_accept_body", app.roblox, me.inServer))];
      if (!me.inServer) {
        const box = h("div", { class: "cta" });
        const draw = () => {
          box.replaceChildren(app.invite ? h("a", { class: "btn", href: app.invite, target: "_blank", rel: "noopener" }, t("apply_join_btn")) : null,
            h("button", { class: "btn ghost", type: "button", onclick: async (e) => {
              e.currentTarget.disabled = true;
              try { app.invite = (await api("/api/invite", { method: "POST" })).invite; toast(t("new_invite_toast")); }
              catch (ex) { toast(applyErrText(ex) || t("invite_fail_toast")); }
              draw();
            } }, app.invite ? t("apply_new_invite") : t("apply_get_invite")));
        };
        draw();
        body.push(box, h("p", { class: "hint" }, t("apply_invite_hint")));
      }
      body.push(timeline(3));
      view.replaceChildren(head, statusCard("ok", "✓", t("apply_accept_title"), body));
      return;
    }
    if (app && app.status === "declined" && !(me.canReapply && S.reapply)) {
      const when = me.reapplyAt ? dateTime(me.reapplyAt) : "";
      const body = [h("p", {}, t("apply_decline_body", app.roblox))];
      if (app.reason) body.push(h("blockquote", { class: "reason" }, app.reason));
      if (me.canReapply) body.push(h("div", { class: "cta" }, h("button", { class: "btn", type: "button", onclick: () => { S.reapply = true; rerender(); } }, t("apply_reapply"))));
      else body.push(h("p", { class: "hint" }, t("apply_reapply_wait", when)));
      view.replaceChildren(head, statusCard("bad", "✕", t("apply_decline_title"), body));
      return;
    }

    if (me.requireRoblox && !me.roblox) {
      view.replaceChildren(head, reqCard, h("div", { class: "card panel shard" },
        h("p", {}, t("apply_roblox_first")),
        robloxWidget(rerender)));
      return;
    }

    /* the form */
    const d = { roblox: me.roblox ? me.roblox.name : "", rank: "", playtime: "", gamepasses: "", masteries: "", spend: "", note: "", images: [] };
    let step = 0;
    const card = h("form", { class: "card panel shard", novalidate: true });
    const err = h("p", { class: "err", role: "alert" });
    const text = (id, label, hint, area) => {
      const el = area ? h("textarea", { id, maxlength: 500 }, d[id]) : h("input", { type: "text", id, maxlength: id === "roblox" ? 20 : 100, value: d[id], autocomplete: "off" });
      el.addEventListener("input", () => { d[id] = el.value; });
      return h("div", { class: "field" }, h("label", { for: id }, label, hint ? h("span", { class: "hint" }, " " + hint) : null), el);
    };
    const validate = () => {
      if (step === 0) {
        if (!me.roblox && !/^[A-Za-z0-9_]{3,20}$/.test(d.roblox.trim())) return t("err_invalid_roblox_name");
        if (!d.rank.trim() || !d.playtime.trim()) return t("val_rank_playtime");
      }
      if (step === 1 && (!d.gamepasses.trim() || !d.masteries.trim())) return t("val_gamepasses_masteries");
      if (step === 2 && !d.spend) return t("val_spend");
      return "";
    };
    const thumbs = h("div", { class: "thumbs" });
    const drawThumbs = () => thumbs.replaceChildren(...d.images.map((im, i) => h("div", { class: "thumb-item" }, h("img", { src: im.url, alt: "" }),
      h("button", { type: "button", "aria-label": t("remove_screenshot"), onclick: () => { URL.revokeObjectURL(im.url); d.images.splice(i, 1); drawThumbs(); } }, "×"))));
    const addFiles = async (files) => {
      for (const f of files) {
        if (d.images.length >= 5) { err.textContent = t("err_too_many_images"); break; }
        try { d.images.push(await shrinkImage(f)); err.textContent = ""; } catch (_) { err.textContent = t("err_not_an_image"); }
      }
      drawThumbs();
    };
    const dropzone = () => {
      const input = h("input", { type: "file", accept: "image/png,image/jpeg,image/webp", multiple: true, hidden: true });
      input.addEventListener("change", () => { addFiles(Array.from(input.files)); input.value = ""; });
      const zone = h("div", { class: "drop", tabindex: "0", role: "button", "aria-label": t("drop_title") }, h("b", {}, t("drop_title")), h("span", { class: "hint" }, t("drop_hint")), input);
      zone.addEventListener("click", () => input.click());
      zone.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
      zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("over"); });
      zone.addEventListener("dragleave", () => zone.classList.remove("over"));
      zone.addEventListener("drop", (e) => { e.preventDefault(); zone.classList.remove("over"); addFiles(Array.from(e.dataTransfer.files)); });
      return zone;
    };
    const draw = () => {
      err.textContent = "";
      const titles = [t("step_you"), t("step_progress"), t("step_commitment")];
      const body = [h("ol", { class: "steps" }, titles.map((tt, i) => h("li", { class: i === step ? "on" : i < step ? "done" : "" }, `${i + 1}. ${tt}`))),
        h("div", { class: "who-card" }, S.me.user.avatar ? h("img", { src: S.me.user.avatar, alt: "" }) : null, h("span", {}, t("applying_as"), h("b", {}, S.me.user.name)))];
      if (step === 0) body.push(
        me.roblox ? h("div", { class: "verified" }, h("span", { class: "tick" }, "✓"), h("div", {}, h("b", {}, me.roblox.name), h("small", {}, "Verified Roblox account"))) : text("roblox", t("lbl_roblox_user")),
        text("rank", t("lbl_rank"), t("lbl_rank_hint")), text("playtime", t("lbl_playtime"), t("lbl_playtime_hint")));
      if (step === 1) { body.push(text("gamepasses", t("lbl_gamepasses"), t("lbl_gamepasses_hint"), true), text("masteries", t("lbl_masteries"), t("lbl_masteries_hint"), true), h("div", { class: "field" }, h("label", {}, t("screenshots_label"), h("span", { class: "hint" }, t("screenshots_hint"))), dropzone(), thumbs)); drawThumbs(); }
      if (step === 2) {
        const radios = ["yes", "no"].map((v) => { const i = h("input", { type: "radio", name: "spend", value: v }); i.checked = d.spend === v; i.addEventListener("change", () => { d.spend = v; }); return h("label", {}, i, v === "yes" ? t("yes") : t("no")); });
        const note = h("textarea", { id: "note", maxlength: 800 }, d.note); note.addEventListener("input", () => { d.note = note.value; });
        body.push(h("div", { class: "field" }, h("label", {}, t("lbl_spend")), h("div", { class: "choice" }, radios)),
          h("div", { class: "field" }, h("label", { for: "note" }, t("lbl_note"), h("span", { class: "hint" }, t("lbl_note_hint"))), note));
      }
      body.push(err, h("div", { class: "actions" },
        step > 0 ? h("button", { type: "button", class: "btn ghost", onclick: () => { step--; draw(); } }, t("btn_back")) : h("span"),
        h("button", { type: "submit", class: "btn" }, step < 2 ? t("btn_next") : t("btn_send"))));
      card.replaceChildren(...body);
    };
    card.addEventListener("submit", async (e) => {
      e.preventDefault();
      const v = validate(); if (v) { err.textContent = v; return; }
      if (step < 2) { step++; draw(); return; }
      const btn = card.querySelector("button[type=submit]"); btn.disabled = true; btn.textContent = t("btn_sending");
      try {
        const fd = new FormData();
        fd.append("data", JSON.stringify({ roblox: d.roblox.trim(), rank: d.rank.trim(), playtime: d.playtime.trim(), gamepasses: d.gamepasses.trim(), masteries: d.masteries.trim(), can_spend: d.spend === "yes", note: d.note.trim(), lang: S.lang }));
        d.images.forEach((im) => fd.append("images", im.blob, im.name));
        await api("/api/apply", { method: "POST", body: fd, timeout: 90000 });
        S.reapply = false; await refreshMe(); rerender();
      } catch (ex) {
        err.textContent = applyErrText(ex);
        btn.disabled = false; btn.textContent = t("btn_send");
      }
    });
    draw();
    view.replaceChildren(head, reqCard, card);
  }

  /* ------------------------------------------------------------------ */
  /* Roblox link, BIG Games connection, live drops, inventories, owner   */
  /* ------------------------------------------------------------------ */
  const CONNECT_ERRORS = {
    invalid_roblox_name: "That Roblox username does not look right.",
    roblox_user_not_found: "Roblox does not know that username.",
    roblox_already_linked: "That Roblox account is already linked to another Discord account.",
    no_pending_code: "Your code expired. Get a new one.",
    code_not_found: "We could not find the code in your Roblox profile yet. Save your About text on Roblox, wait a few seconds and press verify again.",
    roblox_unreachable: "Roblox did not answer. Try again in a minute.",
    big_not_configured: "The site owner has not enabled the BIG Games connection yet.",
    roblox_link_first: "Link your Roblox account first.",
    state_mismatch: "The connection could not be verified. Please start again.",
    big_exchange_failed: "BIG Games rejected the connection. Please start again.",
    not_connected: "You are not connected.",
  };
  const errText = (e) => {
    if (CONNECT_ERRORS[e.message]) return CONNECT_ERRORS[e.message];
    const v = t("err_" + e.message);
    return v !== "err_" + e.message ? v : t("err_generic");
  };
  const applyErrText = errText;
  const ago2 = (ts) => (ts ? ago(ts) : "never");
  const inFuture = (ts) => { const s = Math.round(ts - Date.now() / 1000); return s <= 0 ? "any moment" : s < 3600 ? "in " + Math.ceil(s / 60) + " min" : "in " + Math.round(s / 3600) + " h"; };

  function robloxWidget(onChange) {
    const box = h("div", { class: "rbx" });
    let pend = null, msg = "";
    const draw = () => {
      const me = S.me, kids = [];
      if (me.roblox) {
        kids.push(h("div", { class: "verified" }, h("span", { class: "tick" }, "✓"), h("div", {}, h("b", {}, me.roblox.name), h("small", {}, "Roblox account verified"))),
          h("button", { type: "button", class: "btn ghost small", onclick: async () => { try { await api("/api/roblox/unlink", { method: "POST" }); await refreshMe(); pend = null; draw(); onChange && onChange(); } catch (e) { toast(errText(e)); } } }, "Unlink"));
      } else if (pend) {
        kids.push(h("p", {}, "Put this code anywhere in the ", h("b", {}, "About"), " (description) of your Roblox profile ", h("b", {}, pend.name), ", save it, then press verify. You can remove it afterwards."),
          h("div", { class: "code-row" }, h("code", { class: "bigcode" }, pend.code), h("button", { type: "button", class: "btn ghost small", onclick: () => { navigator.clipboard && navigator.clipboard.writeText(pend.code); toast("Code copied."); } }, "Copy")),
          h("div", { class: "editor-actions" },
            h("button", { type: "button", class: "btn", onclick: async (e) => { e.currentTarget.disabled = true; try { await api("/api/roblox/verify", { method: "POST" }); await refreshMe(); pend = null; msg = ""; draw(); onChange && onChange(); } catch (ex) { msg = errText(ex); draw(); } } }, "I added it, verify"),
            h("button", { type: "button", class: "btn ghost", onclick: () => { pend = null; draw(); } }, "Cancel")));
      } else {
        const input = h("input", { type: "text", maxlength: 20, placeholder: "Your Roblox username", autocomplete: "off" });
        kids.push(h("div", { class: "field" }, h("label", {}, "Roblox username"), input),
          h("button", { type: "button", class: "btn", onclick: async (e) => { e.currentTarget.disabled = true; try { pend = await api("/api/roblox/start", { method: "POST", json: { username: input.value.trim() } }); msg = ""; } catch (ex) { msg = errText(ex); } draw(); } }, "Get my code"));
      }
      kids.push(h("p", { class: "err", role: "alert" }, msg));
      box.replaceChildren(...kids);
    };
    draw();
    return box;
  }

  async function viewConnect() {
    loading();
    if (!S.token || !S.me) { view.replaceChildren(pageHead("My account", "Connect your accounts."), h("div", { class: "card panel shard" }, h("p", {}, "Log in with Discord first."), h("button", { class: "btn", onclick: () => login() }, "Log in with Discord"))); return; }
    await refreshMe();
    const me = S.me, big = me.big, rerender = () => route({ silent: true });
    const step = (n, title, ...body) => h("section", { class: "card wide panel shard connect-step" }, h("div", { class: "cs-head" }, h("span", { class: "cs-n" }, String(n)), h("h2", {}, title)), body);
    const cards = [];
    cards.push(step(1, "Discord", h("div", { class: "verified" }, h("span", { class: "tick" }, "✓"), h("div", {}, h("b", {}, me.user.name), h("small", {}, me.inServer ? "Member of the DUX0 server" : "Not on the DUX0 server yet"))),
      me.canAutoJoin ? h("p", { class: "hint" }, "You allowed the bot to add you to the server when you are accepted.") : null));
    cards.push(step(2, "Roblox", h("p", { class: "hint" }, "This proves the account is yours. It also tells us who is in the clan and on the Discord server."), robloxWidget(rerender)));

    let bigBody;
    if (!me.bigReady) bigBody = h("p", { class: "hint" }, "The site owner has not switched on inventory sharing yet.");
    else if (!me.roblox) bigBody = h("p", { class: "hint" }, "Link your Roblox account in step 2 first.");
    else if (!big) {
      const inv = h("input", { type: "checkbox", checked: true }), feed = h("input", { type: "checkbox", checked: true });
      bigBody = h("div", {},
        h("p", {}, "Connect your Pet Simulator 99 data through BIG Games. BIG Games shows its own consent screen and DUX0 only gets ", h("b", {}, "read access"), " to your inventory and profile statistics. The connection lasts 30 days and you can disconnect and delete everything at any time."),
        h("div", { class: "choice col" }, h("label", {}, inv, "Show my inventory to DUX0 members"), h("label", {}, feed, "Show my new Huge, Titanic and Gargantuan pets in the public live feed")),
        h("p", { class: "hint" }, "New pets are checked about every 45 minutes. BIG Games limits how often a player's data may refresh."),
        h("button", { class: "btn", type: "button", onclick: async (e) => { e.currentTarget.disabled = true; try { const r = await api("/api/big/start", { method: "POST", json: { share_inventory: inv.checked, share_feed: feed.checked } }); location.href = r.url; } catch (ex) { toast(errText(ex)); e.currentTarget.disabled = false; } } }, "Connect with BIG Games"));
    } else {
      const set = async (patch) => { try { await api("/api/big/settings", { method: "POST", json: { share_inventory: inv.checked, share_feed: feed.checked, ...patch } }); toast("Saved."); } catch (ex) { toast(errText(ex)); } };
      const inv = h("input", { type: "checkbox", checked: big.shareInventory, onchange: () => set() }), feed = h("input", { type: "checkbox", checked: big.shareFeed, onchange: () => set() });
      const daysLeft = Math.round((big.expiresAt - Date.now() / 1000) / 86400);
      bigBody = h("div", {},
        big.error === "token_expired" || daysLeft <= 0 ? h("p", { class: "err" }, "Your BIG Games connection expired. Connect again to keep sharing.") : null,
        h("div", { class: "verified" }, h("span", { class: "tick" }, "✓"), h("div", {}, h("b", {}, "Connected to BIG Games"), h("small", {}, `Last update ${ago2(big.lastFetch)} · next check ${big.nextPoll ? inFuture(big.nextPoll) : "soon"}${big.quotaLimit ? ` · refresh budget ${big.quotaUsed || 0}/${big.quotaLimit} today` : ""}`))),
        h("div", { class: "choice col" }, h("label", {}, inv, "Show my inventory to DUX0 members"), h("label", {}, feed, "Show my new big pets in the public live feed")),
        h("p", { class: "hint" }, `The connection ends in ${Math.max(0, daysLeft)} days. Then you connect again.`),
        h("div", { class: "editor-actions" },
          h("button", { class: "btn ghost", type: "button", onclick: () => { logoutBig(); } }, "Reconnect"),
          h("button", { class: "btn danger", type: "button", onclick: async () => { if (!confirm("Disconnect and delete your stored inventory and drops?")) return; try { await api("/api/big/disconnect", { method: "POST" }); toast("Disconnected. Your data was deleted."); rerender(); } catch (ex) { toast(errText(ex)); } } }, "Disconnect and delete my data")));
    }
    async function logoutBig() { try { const r = await api("/api/big/start", { method: "POST", json: { share_inventory: big.shareInventory, share_feed: big.shareFeed } }); location.href = r.url; } catch (ex) { toast(errText(ex)); } }
    cards.push(step(3, "Inventory and live drops", bigBody));
    view.replaceChildren(pageHead("My account", "Link your accounts. Everything here is optional except what applying needs."), h("div", { class: "stack" }, cards));
  }

  const vClass = (v) => (/Shiny/.test(v) ? " v-shiny" : "") + (/Golden/.test(v) ? " v-golden" : "") + (/Rainbow/.test(v) ? " v-rainbow" : "");
  const petImg = (it, cls) => h("div", { class: "petimg" + vClass(it.variant || "") + " " + (cls || "") }, it.icon ? h("img", { src: it.icon, alt: it.name, loading: "lazy" }) : h("span", {}, "?"), /Shiny/.test(it.variant || "") ? h("i", { class: "sparkle" }) : null);
  const chip = (t, cls) => h("span", { class: "chip " + (cls || "") }, t);

  function dropCard(e) {
    return h("article", { class: "drop panel shard tier-" + (e.tier || "x").toLowerCase() },
      petImg(e, "big"),
      h("div", { class: "drop-body" },
        h("div", { class: "chips" }, chip(e.tier, "tier"), e.variant !== "Normal" ? chip(e.variant, "var" + vClass(e.variant)) : chip("Normal", "var"), e.hatched === true ? chip("hatched", "ok") : e.hatched === false ? chip("not from hatching", "mute") : null, e.new > 1 ? chip("×" + e.new, "mute") : null),
        h("h3", {}, e.name),
        h("p", { class: "who-line" }, h("b", {}, e.robloxName || e.discord || "Player"), " · ", ago(e.detected)),
        h("div", { class: "nums" }, h("div", {}, h("b", { title: exact(e.rap) }, compact(e.rap)), h("small", {}, "RAP")), h("div", {}, h("b", {}, exact(e.exists)), h("small", {}, "Exists")), e.rarity ? h("div", {}, h("b", {}, e.rarity), h("small", {}, "Rarity")) : null)));
  }

  async function viewLive() {
    loading();
    let live = null, players = null;
    try { live = await api("/api/live?limit=60"); } catch (_) { S.offline = true; showNotice(); }
    if (S.token && S.me) { try { players = await api("/api/players"); } catch (_) { players = null; } }
    const parts = [pageHead("Live drops", "New Huge, Titanic and Gargantuan pets from DUX0 players who connected their account. Shiny, Golden and Rainbow variants are shown with their exact RAP and Exists numbers. Data comes from BIG Games and is checked about every 45 minutes per player.")];
    if (!live) { parts.push(empty("Live drops need the live server. Try again later.")); view.replaceChildren(...parts); return; }
    if (!live.enabled) parts.push(empty("Live drops are not switched on yet."));
    else {
      const TIER_RANK = { Gargantuan: 3, Titanic: 2, Huge: 1 };
      const dropsBox = h("div", { class: "drops" });
      let dsort = "new";
      const drawDrops = () => {
        const sorted = [...live.events].sort((a, b) => dsort === "rap" ? (b.rap * (b.new || 1)) - (a.rap * (a.new || 1))
          : dsort === "tier" ? (TIER_RANK[b.tier] || 0) - (TIER_RANK[a.tier] || 0) || b.detected - a.detected
          : b.detected - a.detected);
        dropsBox.replaceChildren(...(sorted.length ? sorted.map(dropCard) : [empty("No drops yet. They appear here as connected players find big pets.")]));
      };
      const dseg = h("div", { class: "seg" });
      [["new", "Newest"], ["rap", "Highest RAP"], ["tier", "Tier"]].forEach(([k, l]) => dseg.append(h("button", { type: "button", "aria-pressed": String(k === dsort), onclick: (e) => { dsort = k; dseg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === e.currentTarget))); drawDrops(); } }, l)));
      parts.push(h("div", { class: "tools" },
        h("div", { class: "cta" }, h("a", { class: "btn", href: "#/connect" }, "Connect my account"), h("span", { class: "hint" }, `${live.connected} player${live.connected === 1 ? "" : "s"} connected`)),
        live.events.length > 1 ? dseg : null));
      parts.push(dropsBox);
      drawDrops();
    }
    if (players && players.length) {
      parts.push(h("section", { class: "section" }, h("h2", {}, "Player inventories", h("small", {}, "Visible to DUX0 members")),
        h("div", { class: "grid" }, players.map((p) => h("a", { class: "pcard panel shard", href: "#/inventory/" + p.uid },
          h("div", { class: "pc-top" }, p.avatar ? h("img", { class: "av", src: p.avatar, alt: "" }) : h("span", { class: "av" }), h("div", { class: "who" }, h("b", {}, p.roblox || p.discord), h("small", {}, "updated " + ago2(p.polled)))),
          h("div", { class: "nums" }, h("div", {}, h("b", {}, compact((p.summary || {}).totalRap)), h("small", {}, "Total RAP")), h("div", {}, h("b", {}, ((p.summary || {}).bigs || {}).Huge || 0), h("small", {}, "Huge")), h("div", {}, h("b", {}, ((p.summary || {}).bigs || {}).Titanic || 0), h("small", {}, "Titanic")), h("div", {}, h("b", {}, ((p.summary || {}).bigs || {}).Gargantuan || 0), h("small", {}, "Garg."))),
          h("div", { class: "equip" }, (p.equipped || []).slice(0, 6).map((q) => petImg({ icon: q.icon, name: q.name, variant: (q.shiny ? "Shiny " : "") + (q.golden ? "Golden" : q.rainbow ? "Rainbow" : "") }, "tiny"))))))));
    } else if (!S.token) parts.push(h("p", { class: "hint" }, "Log in as a DUX0 member to browse player inventories."));
    view.replaceChildren(...parts);
  }

  async function viewInventory(uid) {
    loading();
    let d;
    try { d = await api("/api/inventory/" + encodeURIComponent(uid)); }
    catch (e) { view.replaceChildren(pageHead("Inventory", ""), empty(e.status === 401 || e.status === 403 ? "Only logged-in DUX0 members can see inventories." : "This player does not share an inventory.")); return; }
    const sm = d.summary || {}, items = d.items || [];
    const TIER_RANK = { Gargantuan: 3, Titanic: 2, Huge: 1 };
    let filter = "all", q = "", sort = "rap";
    const grid = h("div", { class: "inv-grid" });
    const draw = () => {
      let rows = items.filter((i) => (filter === "all" || (filter === "big" && i.tier) || (filter === "shiny" && /Shiny/.test(i.variant)) || (filter === "golden" && /Golden/.test(i.variant)) || (filter === "rainbow" && /Rainbow/.test(i.variant))) && (!q || i.name.toLowerCase().includes(q)));
      rows = rows.sort((a, b) => sort === "rap" ? b.rap * b.count - a.rap * a.count
        : sort === "exists" ? a.exists - b.exists
        : sort === "tier" ? (TIER_RANK[b.tier] || 0) - (TIER_RANK[a.tier] || 0) || b.rap - a.rap
        : a.name.localeCompare(b.name));
      grid.replaceChildren(...(rows.length ? rows.map((i) => h("div", { class: "invcard panel shard" + (i.tier ? " tier-" + i.tier.toLowerCase() : "") },
        petImg(i), h("div", { class: "ic-body" }, h("b", {}, i.name), h("div", { class: "chips" }, i.tier ? chip(i.tier, "tier") : null, i.variant !== "Normal" ? chip(i.variant, "var" + vClass(i.variant)) : null, i.count > 1 ? chip("×" + exact(i.count), "mute") : null),
          h("small", { title: exact(i.rap) }, `RAP ${i.rapApprox ? "~" : ""}${compact(i.rap)} · Exists ${exact(i.exists)}`))
      )) : [empty("No pets match.")]));
    };
    const seg = h("div", { class: "seg" });
    [["all", "All"], ["big", "Huge and bigger"], ["shiny", "Shiny"], ["golden", "Golden"], ["rainbow", "Rainbow"]].forEach(([k, l]) => seg.append(h("button", { type: "button", "aria-pressed": String(k === filter), onclick: (e) => { filter = k; seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === e.currentTarget))); draw(); } }, l)));
    const sortSeg = h("div", { class: "seg" });
    [["rap", "Highest RAP"], ["tier", "Tier"], ["exists", "Rarest"], ["name", "Name"]].forEach(([k, l]) => sortSeg.append(h("button", { type: "button", "aria-pressed": String(k === sort), onclick: (e) => { sort = k; sortSeg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === e.currentTarget))); draw(); } }, l)));
    const tile = (label, v) => h("div", { class: "tile panel shard" }, h("b", {}, v), h("span", {}, label));
    view.replaceChildren(
      h("p", {}, h("a", { href: "#/live" }, "Back to live drops")),
      pageHead(d.roblox || d.discord, `Updated ${ago2(d.polled)}. Snapshot from BIG Games. RAP marked with ~ is BIG Games' own estimate, not an exact number.`),
      h("section", { class: "tiles" }, tile("Total RAP", h("span", { title: exact(sm.totalRap) }, compact(sm.totalRap))), tile("Huge", (sm.bigs || {}).Huge || 0), tile("Titanic", (sm.bigs || {}).Titanic || 0), tile("Gargantuan", (sm.bigs || {}).Gargantuan || 0)),
      (d.equipped || []).length ? h("section", { class: "section" }, h("h2", {}, "Equipped"), h("div", { class: "equip" }, d.equipped.map((q) => petImg({ icon: q.icon, name: q.name, variant: (q.shiny ? "Shiny " : "") + (q.golden ? "Golden" : q.rainbow ? "Rainbow" : "") }, "mid")))) : null,
      h("section", { class: "section" }, h("h2", {}, "Pets"), h("div", { class: "tools" }, seg, sortSeg, h("input", { type: "text", placeholder: "Search a pet", oninput: (e) => { q = e.target.value.trim().toLowerCase(); draw(); } })), grid));
    draw();
  }

  /* ---------------- owner dashboard ---------------- */
  async function viewOwner() {
    loading();
    if (!S.me || !S.me.owner) { view.replaceChildren(pageHead("Owner dashboard", "Only the site owner can open this."), S.token ? empty("Your Discord account is not the owner account.") : h("button", { class: "btn", onclick: () => login() }, "Log in with Discord")); return; }
    if (S.offline) { view.replaceChildren(pageHead("Owner dashboard", ""), empty("The live server is offline.")); return; }
    const body = h("div"); let cur = S.ownerTab || "apps";
    const tabs = { apps: "Applications", users: "Users", sync: "Clan and Discord", content: "Website content", settings: "Settings" };
    const seg = h("div", { class: "seg", role: "tablist" });
    const show = async (k) => {
      cur = S.ownerTab = k;
      seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.k === k)));
      body.replaceChildren(h("div", { class: "loading" }, h("div", { class: "skel shard" })));
      try { body.replaceChildren(await ({ apps: ownerApps, users: ownerUsers, sync: ownerSync, content: buildContentEditor, settings: ownerSettings })[k]()); }
      catch (e) { body.replaceChildren(empty("Could not load: " + e.message)); }
    };
    Object.entries(tabs).forEach(([k, l]) => seg.append(h("button", { type: "button", "data-k": k, "aria-pressed": String(k === cur), onclick: () => show(k) }, l)));
    view.replaceChildren(pageHead("Owner dashboard", "Everything you can steer on the website. Only your Discord account can open this page."), h("div", { class: "tools" }, seg), body);
    show(cur);
  }

  async function ownerApps() {
    const d = await api("/api/owner/overview");
    const list = h("div", { class: "hist panel shard" });
    const rows = d.applications.map((a) => {
      const reason = h("input", { type: "text", placeholder: "Reason for declining (optional)", maxlength: 500 });
      const act = async (accept) => { try { const r = await api("/api/owner/decide", { method: "POST", json: { id: a.id, accept, reason: reason.value } }); toast((accept ? "Accepted. " : "Declined. ") + (r.notes || []).join(" ")); route({ silent: true }); } catch (e) { toast(e.message === "not_pending" ? "Already handled." : "Failed: " + e.message); } };
      const f = a.fields || {};
      return h("details", { class: "app-row" },
        h("summary", {}, h("b", {}, a.roblox), h("span", { class: "tag " + a.status }, a.status), h("small", {}, `${a.name || ""} · ${dateTime(a.created)}${a.images ? " · " + a.images + " screenshots (in Discord)" : ""}${a.status === "accepted" ? (a.joined ? " · joined" : " · not joined yet") : ""}`)),
        h("div", { class: "app-body" }, h("p", {}, `Rank ${f.rank || "-"} · Playtime ${f.playtime || "-"} · Can spend 3B: ${f.can_spend || "-"}`), h("p", {}, "Gamepasses: " + (f.gamepasses || "-")), h("p", {}, "Masteries: " + (f.masteries || "-")), f.note ? h("p", {}, "Note: " + f.note) : null, a.reason ? h("p", { class: "hint" }, "Decline reason: " + a.reason) : null,
          h("div", { class: "editor-actions" },
            a.status === "pending" ? [h("button", { class: "btn small", type: "button", onclick: () => act(true) }, "Accept"), reason, h("button", { class: "btn danger small", type: "button", onclick: () => act(false) }, "Decline")] : null,
            h("button", { class: "btn ghost small", type: "button", onclick: (ev) => { ev.preventDefault(); openUserDetail(a.uid); } }, "View full profile"))));
    });
    list.append(...(rows.length ? rows : [empty("No applications yet.")]));
    return h("div", {}, h("p", { class: "hint" }, "Screenshots are attached to the application channel in Discord. You can accept or decline here or with the Discord buttons."), list);
  }

  async function ownerSync() {
    const box = h("div"), out = h("div");
    const run = async (btn, fix) => {
      btn.disabled = true; btn.textContent = fix ? "Checking and fixing…" : "Checking…";
      try {
        const d = await api(fix ? "/api/owner/sync-fix" : "/api/owner/sync", { method: fix ? "POST" : "GET", timeout: 90000 });
        if (fix) toast(`Done: ${d.kicked.length} removed, ${d.renamed.length} nicknames fixed${d.dmSent ? ", a report was DMed to you" : ""}.`);
        const sec = (title, rows, render, note) => h("section", { class: "section" }, h("h2", {}, title, h("small", {}, rows.length + "")), note ? h("p", { class: "hint" }, note) : null, rows.length ? h("div", { class: "hist panel shard" }, rows.map(render)) : empty("Nobody."));
        const row = (main, sub, ...actions) => h("div", { class: "clanrow" }, h("div", { class: "who" }, h("b", {}, main), h("small", {}, sub)), h("span"), h("div", { class: "editor-actions" }, actions));
        const rm = (uid, mode) => h("button", { class: "btn small " + (mode === "kick" ? "danger" : "ghost"), type: "button", onclick: async () => { if (!confirm(mode === "kick" ? "Kick this member from Discord?" : "Remove the member role?")) return; try { await api("/api/owner/remove", { method: "POST", json: { uid, mode } }); toast("Done."); run(btn); } catch (e) { toast("Failed: " + e.message); } } }, mode === "kick" ? "Kick" : "Remove role");
        out.replaceChildren(
          h("div", { class: "tiles" }, h("div", { class: "tile panel shard" }, h("b", {}, d.clanSize), h("span", {}, "In the Roblox clan")), h("div", { class: "tile panel shard" }, h("b", {}, d.linked), h("span", {}, "Linked to Discord")), h("div", { class: "tile panel shard gold" }, h("b", {}, d.onServerNotInClan.length), h("span", {}, "On Discord but left the clan"))),
          sec("On Discord but no longer in the clan", d.onServerNotInClan, (x) => row(x.roblox, `Discord: ${x.discord}`, rm(x.uid, "role"), rm(x.uid, "kick")), "These members still have the member role, but their verified Roblox account is not in the clan any more."),
          sec("In the clan but not on the Discord server", d.linkedNotOnServer, (x) => row(x.roblox, `Discord: ${x.discord || "?"}`), "Verified, but not on the server (left or was removed)."),
          sec("In the clan but not linked yet", d.clanNotLinked, (x) => row(x.roblox, "has not verified a Roblox account on the website"), "Ask them to open My account and verify. Until then they cannot be matched with a Discord account."),
          sec("Member role but no linked Roblox account", d.roleNotLinked, (x) => row(x.discord, "cannot be checked against the clan", rm(x.uid, "role")), d.fullList ? "" : "Server member list unavailable. Enable the Server Members Intent."));
      } catch (e) { out.replaceChildren(empty("Check failed: " + e.message)); }
      btn.disabled = false; btn.textContent = fix ? "Run and fix again" : "Run the check again";
    };
    const btn = h("button", { class: "btn ghost", type: "button", onclick: () => run(btn) }, "Run the check");
    const fixBtn = h("button", { class: "btn", type: "button", onclick: async (e) => { if (!confirm("This removes members whose linked Roblox account is not a current clan member, renames the rest to their real Roblox name, and DMs you a report. Continue?")) return; await run(e.currentTarget, true); } }, "Run and fix");
    const setupBtn = h("button", { class: "btn ghost", type: "button", onclick: async (e) => {
      e.currentTarget.disabled = true; e.currentTarget.textContent = "Setting up…";
      try {
        const r = await api("/api/owner/setup", { method: "POST", timeout: 60000 });
        toast(`Created ${r.createdRoles.length} roles and ${r.createdChannels.length} channels. Nothing existing was changed or deleted.` + (r.kickLogChannelId ? ` New kick-log channel ID: ${r.kickLogChannelId} - add it as DUX0_KICK_LOG_CHANNEL_ID.` : ""));
      } catch (ex) { toast("Setup failed: " + ex.message); }
      e.currentTarget.disabled = false; e.currentTarget.textContent = "Set up recommended server structure";
    } }, "Set up recommended server structure");
    box.append(
      h("div", { class: "card wide panel shard" },
        h("h2", {}, "Server structure"),
        h("p", { class: "hint" }, "Creates the categories, channels and roles a clan server like this usually needs (Officer, Leaks Access, Giveaway Manager roles; information, clan, giveaways, leaks and staff channels). Only adds what is missing by name - never renames, moves or deletes anything that already exists."),
        setupBtn),
      h("div", { class: "card wide panel shard" },
        h("h2", {}, "Roster check"),
        h("p", {}, "Compares your Roblox clan roster with the people on the Discord server."),
        h("div", { class: "editor-actions" }, btn, fixBtn),
        h("p", { class: "hint" }, "\u201CRun the check\u201D only shows results. \u201CRun and fix\u201D also removes members who are not in the clan any more, fixes nicknames to the real Roblox name, and sends you a DM report.")),
      out);
    return box;
  }

  async function ownerSettings() {
    const d = await api("/api/owner/overview"), s = d.settings;
    const ownersBox = h("div");
    const drawOwners = async () => {
      const o = await api("/api/owner/owners");
      ownersBox.replaceChildren(
        h("div", { class: "hist panel shard" },
          o.core.map((id) => h("div", { class: "clanrow" }, h("div", { class: "who" }, h("b", {}, id), h("small", {}, "fixed in settings.env, cannot be removed here")), h("span"), h("span"))),
          o.extra.length ? o.extra.map((x) => h("div", { class: "clanrow" }, h("div", { class: "who" }, h("b", {}, x.label || x.id), h("small", {}, x.id)), h("span"),
            h("button", { class: "btn danger small", type: "button", onclick: async () => { if (!confirm("Remove this owner?")) return; try { await api("/api/owner/owners/remove", { method: "POST", json: { id: x.id } }); drawOwners(); } catch (e) { toast("Failed: " + e.message); } } }, "Remove")))
            : empty("No extra owners added.")));
    };
    const newId = h("input", { type: "text", placeholder: "Discord user ID", inputmode: "numeric" });
    const newLabel = h("input", { type: "text", placeholder: "Label (optional, e.g. a name)", maxlength: 60 });
    const addOwner = async () => {
      if (!/^\d{2,25}$/.test(newId.value.trim())) { toast("Enter a numeric Discord user ID."); return; }
      try { await api("/api/owner/owners/add", { method: "POST", json: { id: newId.value.trim(), label: newLabel.value.trim() } }); newId.value = ""; newLabel.value = ""; drawOwners(); }
      catch (e) { toast("Failed: " + e.message); }
    };
    drawOwners();
    const gate = h("input", { type: "checkbox", checked: s.gate }), req = h("input", { type: "checkbox", checked: s.requireRoblox });
    const poll = h("input", { type: "text", value: String(s.hatchPollMinutes) }), reapply = h("input", { type: "text", value: String(s.reapplyDays) });
    const save = h("button", { class: "btn", type: "button", onclick: async () => { try { await api("/api/owner/settings", { method: "PUT", json: { gate: gate.checked, requireRoblox: req.checked, hatchPollMinutes: poll.value, reapplyDays: reapply.value } }); toast("Saved."); } catch (e) { toast("Failed: " + e.message); } } }, "Save settings");
    return h("div", { class: "stack" },
      h("section", { class: "section" }, h("h2", {}, "Owners"), h("p", { class: "hint" }, "Owners can open this dashboard, edit the website and decide applications. Add another owner without touching settings.env."),
        h("div", { class: "editor-actions" }, newId, newLabel, h("button", { class: "btn", type: "button", onclick: addOwner }, "Add owner")), ownersBox),
      h("div", { class: "card wide panel shard" },
        h("div", { class: "choice col" }, h("label", {}, gate, "Gate: remove people who join without an accepted application"), h("label", {}, req, "Applicants must verify their Roblox account first")),
        h("div", { class: "two" }, h("div", { class: "field" }, h("label", {}, "Minutes between inventory checks per player ", h("span", { class: "hint" }, "(10 to 240)")), poll), h("div", { class: "field" }, h("label", {}, "Days before a declined player may apply again"), reapply)), save),
      h("section", { class: "section" }, h("h2", {}, "Connected players", h("small", {}, d.connections.length + "")),
        h("p", { class: "hint" }, `${d.links} Roblox accounts linked. BIG Games connection: ${d.bigConfigured ? "switched on" : "not configured (BIG_CLIENT_ID / BIG_CLIENT_SECRET)"}. Discord channel for drops: ${d.hatchChannel ? "set" : "not set (DUX0_HATCH_CHANNEL_ID)"}. Kick-log channel: ${d.kickLogChannel ? "set" : "not set (DUX0_KICK_LOG_CHANNEL_ID)"}.`),
        d.connections.length ? h("div", { class: "hist panel shard" }, d.connections.map((c) => h("div", { class: "clanrow" }, h("div", { class: "who" }, h("b", {}, c.roblox || c.discord), h("small", {}, `updated ${ago2(c.lastFetch)}${c.error ? " · " + c.error : ""} · inventory ${c.shareInventory ? "shared" : "private"} · feed ${c.shareFeed ? "public" : "off"}`)), h("span"), h("span", { class: "hint" }, "expires " + dateTime(c.expiresAt))))) : empty("Nobody connected yet.")));
  }

  /* ---------------- admin ---------------- */
  async function uploadImage(file) {
    const fd = new FormData(); fd.append("file", file);
    return (await api("/api/upload", { method: "POST", body: fd, timeout: 60000 })).path;
  }

  async function buildContentEditor() {
    const d = JSON.parse(JSON.stringify(await api("/api/content")));
    d.achievements = d.achievements || []; d.gallery = d.gallery || []; d.requirements = d.requirements || [];
    const achBox = h("div"), galBox = h("div", { class: "gallery-edit" });
    const pickFile = (onPath) => {
      const input = h("input", { type: "file", accept: "image/png,image/jpeg,image/webp,image/gif", multiple: true });
      input.addEventListener("change", async () => {
        for (const file of Array.from(input.files)) {
          if (file.size > 5 * 1024 * 1024) { toast(file.name + " is larger than 5 MB."); continue; }
          try { toast("Uploading…"); onPath(await uploadImage(file)); } catch (e) { toast("Upload failed: " + e.message); }
        }
      });
      input.click();
    };
    const drawAch = () => achBox.replaceChildren(...d.achievements.map((a, i) => h("div", { class: "editor-block shard" },
      h("div", { class: "two" },
        h("div", { class: "field" }, h("label", {}, "Title"), h("input", { type: "text", value: a.title, maxlength: 80, oninput: (e) => (a.title = e.target.value) })),
        h("div", { class: "field" }, h("label", {}, "Date"), h("input", { type: "text", value: a.date, maxlength: 40, placeholder: "e.g. May 2026", oninput: (e) => (a.date = e.target.value) }))),
      h("div", { class: "field" }, h("label", {}, "Description"), h("textarea", { maxlength: 400, oninput: (e) => (a.desc = e.target.value) }, a.desc || "")),
      a.image ? picture(a.image, "", "thumb") : null,
      h("div", { class: "editor-actions" },
        h("button", { type: "button", class: "btn ghost small", onclick: () => pickFile((p) => { a.image = p; drawAch(); }) }, a.image ? "Replace image" : "Upload image"),
        h("button", { type: "button", class: "btn danger small", onclick: () => { d.achievements.splice(i, 1); drawAch(); } }, "Remove achievement")))));
    const drawGal = () => galBox.replaceChildren(...d.gallery.map((g, i) => h("div", { class: "g" }, picture(g.image, g.caption),
      h("input", { type: "text", value: g.caption || "", maxlength: 120, placeholder: "Caption (optional)", oninput: (e) => (g.caption = e.target.value) }),
      h("div", { class: "editor-actions" }, h("button", { type: "button", class: "btn danger small", onclick: () => { d.gallery.splice(i, 1); drawGal(); } }, "Remove")))));

    d.requirementsDetail = d.requirementsDetail || { minRank: "", minPlaytime: "", gamepasses: [], notes: "" };
    const passes = await loadPasses();
    const ann = h("input", { type: "text", maxlength: 240, value: d.announcement || "", placeholder: "Shown as a banner on the home page. Leave empty for none.", oninput: (e) => (d.announcement = e.target.value) });
    const about = h("textarea", { maxlength: 4000, style: "min-height:9rem", oninput: (e) => (d.about = e.target.value) }, d.about || "");
    const reqs = h("textarea", { placeholder: "One requirement per line", oninput: (e) => (d.requirements = e.target.value.split("\n")) }, d.requirements.join("\n"));
    const minRank = h("input", { type: "text", maxlength: 60, value: d.requirementsDetail.minRank, placeholder: "e.g. Level 20+", oninput: (e) => (d.requirementsDetail.minRank = e.target.value) });
    const minPlaytime = h("input", { type: "text", maxlength: 60, value: d.requirementsDetail.minPlaytime, placeholder: "e.g. 100+ hours", oninput: (e) => (d.requirementsDetail.minPlaytime = e.target.value) });
    const passGrid = h("div", { class: "pass-check-grid" }, passes.map((p) => {
      const box = h("input", { type: "checkbox", checked: d.requirementsDetail.gamepasses.includes(p.id) });
      box.addEventListener("change", () => {
        d.requirementsDetail.gamepasses = box.checked ? [...d.requirementsDetail.gamepasses, p.id] : d.requirementsDetail.gamepasses.filter((x) => x !== p.id);
      });
      return h("label", { class: "pass-check" }, box, p.icon ? h("img", { src: p.icon, alt: "" }) : null, h("span", {}, p.name));
    }));
    const save = h("button", { class: "btn", type: "button" }, "Save changes");
    save.addEventListener("click", async () => {
      save.disabled = true;
      try { const saved = await api("/api/content", { method: "PUT", json: d }); S.cache.content = { t: Date.now(), v: saved }; toast("Saved. Everyone sees the change now."); }
      catch (e) { toast("Could not save: " + e.message); }
      save.disabled = false;
    });
    drawAch(); drawGal();
    return h("div", {},
      h("div", { class: "card wide panel shard" },
        h("div", { class: "field" }, h("label", {}, "Announcement banner"), ann),
        h("div", { class: "field" }, h("label", {}, "About text"), about),
        h("div", { class: "two" },
          h("div", { class: "field" }, h("label", {}, "Minimum rank shown on the apply page"), minRank),
          h("div", { class: "field" }, h("label", {}, "Minimum playtime shown on the apply page"), minPlaytime)),
        h("div", { class: "field" }, h("label", {}, "Useful gamepasses shown on the apply page"), passGrid),
        h("div", { class: "field" }, h("label", {}, "Extra requirements (one per line, shown as a list)"), reqs)),
      h("section", { class: "section" }, h("h2", {}, "Achievements"), achBox, h("button", { type: "button", class: "btn ghost", onclick: () => { d.achievements.push({ id: "", title: "", desc: "", date: "", image: "" }); drawAch(); } }, "Add achievement")),
      h("section", { class: "section" }, h("h2", {}, "Clan gallery"), galBox, h("button", { type: "button", class: "btn ghost", onclick: () => pickFile((p) => { d.gallery.push({ image: p, caption: "" }); drawGal(); }) }, "Add images")),
      h("div", { class: "savebar" }, save));
  }

  /* ---------------- status / diagnostics ---------------- */
  async function viewStatus() {
    loading();
    const rows = [];
    const add = (state, title, text) => rows.push(h("li", { class: "check " + state }, h("span", { class: "dot" }, state === "ok" ? "✓" : state === "bad" ? "✕" : "!"), h("div", {}, h("b", {}, title), h("p", {}, text))));
    add(S.api ? "ok" : "bad", "Website knows the bot address", S.api ? S.api : "config.json has no address yet. Start the bot with a GitHub token (DUX0_GITHUB_TOKEN in settings.env) so it writes the address automatically.");
    let cfg = null, ms = 0;
    if (S.api) { const t0 = performance.now(); try { cfg = await api("/api/config", { timeout: 7000 }); ms = Math.round(performance.now() - t0); } catch (_) { /* offline */ } }
    add(cfg ? "ok" : "bad", "Bot API reachable", cfg ? `Answered in ${ms} ms.` : "The address does not answer. The bot may be off, or the tunnel address changed. It changes on every bot restart. Restart the bot, wait about a minute, then reload this page.");
    if (cfg) {
      const st = cfg.status || {};
      add(st.bot ? "ok" : "warn", "Bot logged in to Discord", st.bot || "The bot is not logged in yet.");
      add(st.categoryFound ? "ok" : "bad", "Discord server and applications category found", st.categoryFound ? "Server: " + st.guild : "The bot cannot see the applications category. Check that the bot is on the server and can view that category.");
      add(st.loginReady ? "ok" : "bad", "Discord login configured", st.loginReady ? "Client secret is set." : "DUX0_CLIENT_SECRET is missing in settings.env, so nobody can log in. Copy it from Developer Portal, OAuth2.");
      add("warn", "Redirect URL in the Discord Developer Portal", h("span", {}, "In the application with client ID ", h("code", {}, cfg.clientId), " open OAuth2, Redirects and add exactly: ", h("code", {}, cfg.redirectUri), ". A missing or different entry makes Discord show \"Invalid OAuth2 redirect_uri\"."));
      add(st.gate ? "ok" : "warn", "Application gate", st.gate ? "On. New members without an accepted application are removed automatically. This needs the Server Members Intent and the Kick Members permission for the bot." : "Off (DUX0_GATE=0). Anyone with an invite can stay.");
      add(st.githubToken ? "ok" : "warn", "GitHub token", st.githubToken ? "Set. The bot can update config.json and back up content." : "Not set. Without it you must enter the tunnel address into config.json by hand after every restart.");
      add(st.tunnel ? "ok" : "warn", "Tunnel", st.tunnel || "No tunnel is running from this bot process.");
      add(st.bigConfigured ? "ok" : "warn", "BIG Games connection", st.bigConfigured ? "Configured. Players can connect their inventory." : "Not configured. Set BIG_CLIENT_ID and BIG_CLIENT_SECRET in settings.env to turn on live drops and inventories.");
    }
    const clan = cfg ? await load("clan", true) : null;
    if (clan && clan.health) {
      const hl = clan.health;
      add(hl.members ? "ok" : "bad", "Clan members found", `${hl.members} members.`);
      add(hl.eventContributions ? "ok" : "warn", "Points this battle found", `${hl.eventContributions} contributors. ${hl.activeBattle ? "An active battle was reported by the game." : "The game reports no active battle."}`);
      add(hl.gemEntries ? "ok" : "warn", "Gem donations found", `${hl.gemEntries} entries.`);
      add(hl.battles ? "ok" : "warn", "Battle history found", `${hl.battles} battles. Permission levels seen: ${hl.permissionLevels.join(", ") || "none"}.`);
    } else if (cfg) add("bad", "Clan data", "The bot could not load the clan from the game API right now.");
    view.replaceChildren(pageHead("Site status", "Checks that tell you why something does not work."), h("div", { class: "card wide panel shard" }, h("ul", { class: "checks" }, rows),
      cfg && cfg.status && cfg.status.loginReady ? h("div", { class: "editor-actions" }, h("button", { class: "btn", onclick: login }, "Test Discord login"), h("a", { class: "btn ghost", href: "#/apply" }, "Open application page")) : null));
  }

  /* ------------------------------------------------------------------ */
  /* router                                                              */
  /* ------------------------------------------------------------------ */
  const routes = { home: viewHome, battles: viewBattles, members: viewMembers, stats: viewStats, achievements: viewAchievements, live: viewLive, connect: viewConnect, apply: viewApply, owner: viewOwner, status: viewStatus };
  const LIVE_VIEWS = ["home", "battles", "members", "stats"];

  async function route(opts = {}) {
    S.silent = !!opts.silent;
    view.classList.toggle("silent", S.silent);
    S.timers.forEach(clearInterval); S.timers = [];
    const path = location.hash.replace(/^#\/?/, "").split("?")[0];
    const parts = path.split("/").filter(Boolean);
    const name = parts[0] || "home";
    const key = routes[name] ? name : "home";
    S.route = key;
    document.querySelectorAll("#links a").forEach((a) => a.classList.toggle("on", a.dataset.r === key));
    try {
      if (name === "inventory" && parts[1]) await viewInventory(parts[1]);
      else await routes[key]();
    }
    catch (e) { console.error(e); view.replaceChildren(pageHead("Something went wrong", "Please reload the page.")); }
    if (!S.silent) window.scrollTo(0, 0);
    S.silent = false;
  }

  async function boot() {
    try { const cfg = await (await fetch("config.json?t=" + Date.now())).json(); S.api = (cfg.api || "").replace(/\/$/, ""); } catch (_) { /* none */ }
    if (S.api) { try { S.cfg = await api("/api/config", { timeout: 6000 }); } catch (_) { S.offline = true; } } else S.offline = true;
    if (S.cfg) await refreshMe();
    showNotice(); renderAccount();
    addEventListener("hashchange", () => route());
    addEventListener("scroll", () => $("#nav").classList.toggle("scrolled", scrollY > 10), { passive: true });
    setInterval(() => {
      const a = document.activeElement;
      if (document.hidden || S.modal || S.offline || !LIVE_VIEWS.includes(S.route) || (a && /INPUT|TEXTAREA/.test(a.tagName))) return;
      delete S.cache.clan; route({ silent: true });
    }, 30000);
    embers(); route();
  }
  boot();
})();
