/* DUX0 – Bewerbungsseite (apply2) v2
   Ablauf: Discord-Login → Roblox-Name bestätigen (kein Bio-Code) → Inventar über BIG Games verbinden
   (Gamepässe werden live geprüft) → Formular (vom Owner einstellbar, Werte automatisch ausgefüllt) → Status.
   Owner können unter #/einstellungen festlegen, was wichtig/Pflicht ist. */
(() => {
  "use strict";

  const APP = document.getElementById("app");
  const TOP = document.getElementById("top");
  const TOAST = document.getElementById("toast");
  const TOKEN_KEY = "dux0a2_token";
  const STATE_KEY = "dux0a2_state";
  const DRAFT_KEY = "dux0a2_draft";

  const S = {
    api: "", cfg: null, token: localStorage.getItem(TOKEN_KEY) || "", me: null, st: null, offline: false,
    files: [], view: null, reapply: false, skipInv: sessionStorage.getItem("dux0a2_skipinv") === "1",
  };

  // ---------------------------------------------------------------- Helfer
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else if (k === "html") el.innerHTML = v;
      else if (k === "value") el.value = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  const rc = (root, ...kids) => { root.innerHTML = ""; root.append(...kids.flat(Infinity).filter((x) => x != null && x !== false)); };

  function toast(msg) {
    TOAST.textContent = msg;
    TOAST.classList.add("show");
    clearTimeout(TOAST._t);
    TOAST._t = setTimeout(() => TOAST.classList.remove("show"), 4200);
  }

  async function api(path, opts = {}) {
    if (!S.api) { const e = new Error("offline"); throw e; }
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), opts.timeout || 20000);
    try {
      const headers = { ...(opts.headers || {}) };
      if (S.token) headers.Authorization = "Bearer " + S.token;
      if (opts.json) headers["Content-Type"] = "application/json";
      let res;
      try {
        res = await fetch(S.api + path, { method: opts.method || "GET", headers, body: opts.json ? JSON.stringify(opts.json) : opts.body, signal: ctl.signal });
      } catch (_) { throw new Error("offline"); }
      let data = null;
      try { data = await res.json(); } catch (_) {}
      if (!res.ok) { const e = new Error((data && data.error) || "http_" + res.status); e.status = res.status; throw e; }
      return data;
    } finally { clearTimeout(timer); }
  }

  const ERR = {
    offline: "Der Bot ist gerade nicht erreichbar. Versuch es gleich nochmal.",
    login_required: "Bitte melde dich erneut mit Discord an.",
    bot_not_ready: "Der Bewerbungs-Server ist gerade nicht bereit. Versuch es gleich nochmal.",
    roblox_verify_required: "Bestätige zuerst deinen Roblox-Account.",
    invalid_roblox_name: "Das ist kein gültiger Roblox-Name (3–20 Zeichen, nur Buchstaben, Zahlen und _).",
    roblox_user_not_found: "Diesen Roblox-Namen gibt es nicht. Schreibfehler?",
    roblox_already_linked: "Dieser Roblox-Account gehört schon zu einem anderen Discord-Konto.",
    bio_check_required: "Hier ist die Bio-Prüfung eingeschaltet – nutze den Code.",
    missing_fields: "Bitte fülle alle Pflichtfelder aus (mit * markiert).",
    inventory_required: "Verbinde zuerst dein Inventar über BIG Games – das ist Pflicht.",
    inventory_loading: "Dein Inventar wird noch geladen. Warte kurz und versuch es dann nochmal.",
    rank_too_low: "Dein Rang ist leider unter dem Mindest-Rang für DUX0.",
    missing_gamepasses: "Dir fehlen Pflicht-Gamepässe für DUX0.",
    screenshots_required: "Bitte lade die geforderte Anzahl an Screenshots hoch.",
    already_pending: "Du hast schon eine Bewerbung, die gerade geprüft wird.",
    already_accepted: "Du wurdest bereits angenommen.",
    already_member: "Du bist schon Mitglied von DUX0.",
    cooldown: "Du wurdest vor Kurzem abgelehnt und musst noch etwas warten.",
    slow_down: "Nicht so schnell – warte ein paar Sekunden.",
    too_many_images: "Höchstens 5 Bilder.",
    image_too_large: "Ein Bild ist zu groß (max. 4 MB).",
    not_an_image: "Eine Datei ist kein Bild.",
    big_not_configured: "Die Inventar-Verbindung ist gerade nicht verfügbar.",
    roblox_link_first: "Bestätige zuerst deinen Roblox-Account.",
    no_pending_code: "Es läuft keine Prüfung. Fordere einen neuen Code an.",
    code_not_found: "Der Code steht noch nicht in deiner Roblox-Beschreibung. Gespeichert?",
    roblox_unreachable: "Roblox antwortet gerade nicht. Versuch es gleich nochmal.",
    forbidden: "Dafür hast du keine Berechtigung.",
    owner_only: "Nur Owner dürfen das.",
  };
  const errText = (e) => ERR[(e && e.message) || ""] || ("Fehler: " + ((e && e.message) || "unbekannt"));

  const fmtNum = (n) => Number(n || 0).toLocaleString("de-DE");
  function short(n) {
    n = Number(n || 0);
    const units = [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]];
    for (const [d, s] of units) if (Math.abs(n) >= d) return (n / d).toFixed(2).replace(/\.?0+$/, "") + s;
    return String(Math.round(n));
  }
  const dateTime = (ts) => ts ? new Date(ts * 1000).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" }) : "";
  const ago = (ts) => {
    if (!ts) return "";
    const s = Math.max(0, Date.now() / 1000 - ts);
    if (s < 90) return "gerade eben";
    if (s < 3600) return `vor ${Math.round(s / 60)} Min.`;
    if (s < 86400) return `vor ${Math.round(s / 3600)} Std.`;
    return `vor ${Math.round(s / 86400)} Tagen`;
  };

  function gemSvg(size = 40) {
    return h("span", { html: `<svg width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true"><polygon points="8,38 28,12 72,12 92,38 50,94" fill="#2a0b52" stroke="#2a0b52" stroke-width="10" stroke-linejoin="round"/><polygon points="8,38 28,12 39,38" fill="#7ff0ff"/><polygon points="28,12 39,38 50,12" fill="#f4feff"/><polygon points="39,38 50,12 61,38" fill="#bdf6ff"/><polygon points="50,12 61,38 72,12" fill="#fff"/><polygon points="61,38 72,12 92,38" fill="#38d6f5"/><polygon points="8,38 39,38 50,94" fill="#22c7ef"/><polygon points="39,38 61,38 50,94" fill="#43d9f7"/><polygon points="61,38 92,38 50,94" fill="#5b5ff0"/><polygon points="30,16 40,16 34,34" fill="#fff" opacity=".9"/></svg>` });
  }

  function sparkles() {
    const box = document.getElementById("sparkles");
    if (!box || box.childElementCount) return;
    const rnd = (a, b) => a + Math.random() * (b - a);
    for (let i = 0; i < 26; i++) {
      box.append(h("span", { style: { left: rnd(0, 100) + "%", top: rnd(0, 100) + "%", "--s": rnd(10, 26) + "px", "--d": rnd(2.5, 6) + "s", "--delay": rnd(0, 5) + "s" } }));
    }
    for (let i = 0; i < 7; i++) {
      const g = gemSvg(rnd(28, 70)); g.style.display = "contents";
      const wrap = h("i", { style: { left: rnd(2, 94) + "%", top: rnd(8, 92) + "%", "--s": "auto", "--d": rnd(4, 8) + "s", "--delay": rnd(0, 4) + "s", "--b": (Math.random() < .5 ? rnd(1.5, 3.5) : 0) + "px" } }, g);
      box.append(wrap);
    }
  }

  function draft() { try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "{}"); } catch (_) { return {}; } }
  function saveDraft(d) { try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch (_) {} }

  // ---------------------------------------------------------------- Login
  function login() {
    const st = crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2);
    sessionStorage.setItem(STATE_KEY, st);
    const q = new URLSearchParams({ client_id: S.cfg.clientId, response_type: "code", scope: "identify guilds guilds.join", redirect_uri: S.cfg.redirectUri, state: st });
    location.href = "https://discord.com/oauth2/authorize?" + q;
  }
  function logout() {
    localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(DRAFT_KEY);
    S.token = ""; S.me = null; S.st = null; location.hash = ""; render();
  }

  // ---------------------------------------------------------------- Kopfzeile
  function renderTop() {
    const me = S.me;
    const owner = me && me.owner;
    rc(TOP, h("div", { class: "wrap top-in" },
      h("a", { class: "brand", href: "#/" }, h("img", { src: "assets/icon.png", alt: "" }), h("b", {}, "DUX0"), h("span", { class: "pill" }, "BEWERBUNG")),
      h("span", { class: "spacer" }),
      owner ? h("button", { class: "icon-btn" + (S.view === "settings" ? " on" : ""), title: "Bewerbung einstellen", type: "button",
        onclick: () => { location.hash = S.view === "settings" ? "#/" : "#/einstellungen"; } }, "⚙️") : null,
      me ? h("span", { class: "chip" }, me.user.avatar ? h("img", { src: me.user.avatar, alt: "" }) : null, h("span", {}, me.user.name)) : null,
      me ? h("button", { class: "icon-btn", title: "Abmelden", type: "button", onclick: logout }, "⎋") : null));
  }

  // ---------------------------------------------------------------- Bildschirme
  function screenOffline() {
    rc(APP, h("div", { class: "card status wait mt" },
      h("div", { class: "badge" }, "💤"),
      h("h2", {}, "Gleich wieder da"),
      h("p", {}, "Der DUX0-Bot ist gerade offline, deshalb können wir im Moment keine Bewerbungen annehmen. Schau in ein paar Minuten nochmal vorbei."),
      h("button", { class: "btn violet mt", type: "button", onclick: () => location.reload() }, "Neu laden")));
  }

  function screenHero() {
    const ready = !(S.cfg && S.cfg.status && S.cfg.status.loginReady === false);
    rc(APP,
      h("section", { class: "hero" },
        h("div", {},
          h("h1", {}, "Werde Teil von ", h("em", {}, "DUX0")),
          h("p", { class: "sub" }, "Bewirb dich in wenigen Minuten beim Pet Simulator 99 Clan DUX0. Kein Code in der Roblox-Bio – dein Inventar und deine Gamepässe holen wir automatisch."),
          ready ? h("button", { class: "btn discord big", type: "button", onclick: login }, "🎮 Mit Discord bewerben")
            : h("p", { class: "err" }, "Der Login ist auf der Bot-Seite noch nicht eingerichtet."),
          h("p", { class: "hint" }, "Du musst dafür noch nicht auf unserem Discord sein.")),
        h("div", { class: "mascot" }, h("img", { src: "assets/mascot.webp", alt: "DUX0 Maskottchen" }), h("span", { class: "bubble" }, "Hi! 💎"))),
      h("section", { class: "features" },
        feature("⚡", "Kein Bio-Code", "Roblox-Name eingeben, Avatar bestätigen – fertig."),
        feature("💎", "Inventar automatisch", "Huges, Titanics & RAP direkt aus deinem Spielstand."),
        feature("🎟️", "Gamepässe live", "Wir sehen sofort, welche Gamepässe du hast."),
        feature("🚀", "Direkt in den Clan", "Angenommen? Der Bot holt dich automatisch auf unseren Discord.")));
  }
  const feature = (ico, title, text) => h("div", { class: "feature" }, h("div", { class: "ico" }, ico), h("b", {}, title), h("span", {}, text));

  // Schritte: 1 Discord, 2 Roblox, 3 Inventar, 4 Bewerbung, 5 Ergebnis
  function stepper(now) {
    const names = ["Discord", "Roblox", "Inventar", "Bewerbung", "Ergebnis"];
    const goto = { 2: () => { S.view = "roblox"; render(); }, 3: () => { S.view = "inventory"; render(); } };
    return h("nav", { class: "stepper", "aria-label": "Fortschritt" }, names.map((n, i) => {
      const k = i + 1;
      const cls = k < now ? "done" : k === now ? "now" : "";
      return h("button", { class: "step " + cls, type: "button", disabled: !(k < now && goto[k]), onclick: goto[k] || null },
        h("span", { class: "n" }, k < now ? "✓" : String(k)), n);
    }));
  }

  function rbxCard(rb, small) {
    return h("div", { class: "rbx" + (small ? " small" : "") },
      h("img", { src: rb.avatar || "assets/mascot.webp", alt: "" }),
      h("div", { class: "who" }, h("b", {}, rb.display || rb.name), h("span", {}, "@" + rb.name),
        small ? null : h("div", {}, rb.verified ? h("span", { class: "tag ok" }, "✔ per Bio geprüft") : null)));
  }

  // ---- Schritt 2: Roblox -------------------------------------------------
  function screenRoblox() {
    const st = S.st;
    const bio = st.form.robloxCheck === "bio";
    const input = h("input", { type: "text", placeholder: "Dein Roblox-Name (nicht der Anzeigename)", maxlength: 20, autocomplete: "off", spellcheck: "false", value: (st.roblox && st.roblox.name) || "" });
    const out = h("div", { class: "mt" });
    const btn = h("button", { class: "btn violet", type: "button" }, "🔍 Suchen");

    async function search() {
      const name = input.value.trim();
      if (!name) return input.focus();
      btn.disabled = true;
      try {
        if (bio) return await startBio(name);
        const r = await api("/api/apply2/roblox", { method: "POST", json: { username: name } });
        const p = r.preview;
        rc(out, rbxCard(p),
          h("p", { class: "center", style: { margin: "18px 0 12px", fontSize: "1.15rem" } }, "Bist das du?"),
          h("div", { class: "row", style: { justifyContent: "center" } },
            h("button", { class: "btn green", type: "button", onclick: async (e) => {
              e.currentTarget.disabled = true;
              try {
                await api("/api/apply2/roblox", { method: "POST", json: { username: p.name, confirm: true } });
                S.view = null; await refreshState(); render();
              } catch (ex) { toast(errText(ex)); e.currentTarget.disabled = false; }
            } }, "✔ Ja, das bin ich"),
            h("button", { class: "ghost", type: "button", onclick: () => { rc(out); input.select(); } }, "Nein, anderer Name")));
      } catch (e) { rc(out, h("div", { class: "notice bad" }, h("span", { class: "ico" }, "⚠️"), h("p", {}, errText(e)))); }
      finally { btn.disabled = false; }
    }

    async function startBio(name) {
      const r = await api("/api/roblox/start", { method: "POST", json: { username: name } });
      showBio(r.name, r.code);
    }
    function showBio(name, code) {
      rc(out,
        h("p", {}, "Gefunden: ", h("b", {}, name), ". Füge diesen Code kurz in deine Roblox-Profilbeschreibung ein:"),
        h("div", { class: "code-box" }, h("code", {}, code),
          h("button", { class: "ghost", type: "button", onclick: () => { navigator.clipboard && navigator.clipboard.writeText(code); toast("Code kopiert!"); } }, "📋 Kopieren")),
        h("p", { class: "hint" }, "Roblox → dein Profil → Stift-Symbol bei „Info“ → Code einfügen → Speichern. Danach hier auf „Prüfen“. Du kannst den Code danach wieder löschen."),
        h("button", { class: "btn green", type: "button", onclick: async (e) => {
          e.currentTarget.disabled = true;
          try { await api("/api/roblox/verify", { method: "POST", json: {} }); toast("Roblox-Account bestätigt!"); S.view = null; await refreshState(); render(); }
          catch (ex) { toast(errText(ex)); e.currentTarget.disabled = false; }
        } }, "Prüfen"));
    }

    btn.onclick = search;
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") search(); });
    if (bio && st.pendingBio) showBio(st.pendingBio.name, st.pendingBio.code);

    const current = st.roblox ? [h("p", { class: "hint" }, "Aktuell bestätigt:"), rbxCard(st.roblox, true),
      h("div", { class: "row mt" },
        h("button", { class: "btn small", type: "button", onclick: () => { S.view = null; render(); } }, "Weiter →"),
        st.roblox.verified ? null : h("button", { class: "link", type: "button", onclick: async () => { await api("/api/apply2/roblox/reset", { method: "POST" }); await refreshState(); render(); } }, "Zurücksetzen")),
      h("hr", { style: { border: 0, borderTop: "1.5px solid var(--line)", margin: "22px 0" } })] : null;

    rc(APP, stepper(2), h("div", { class: "card" },
      h("h2", {}, "Dein Roblox-Account"),
      h("p", { class: "lead" }, bio ? "Gib deinen Roblox-Namen ein. Zur Sicherheit bestätigst du ihn mit einem kurzen Code in deiner Roblox-Beschreibung."
        : "Gib einfach deinen Roblox-Namen ein und bestätige deinen Avatar. Kein Code, keine Bio – dauert 10 Sekunden."),
      current,
      h("div", { class: "search" }, input, btn), out));
    if (!st.roblox) setTimeout(() => input.focus(), 50);
  }

  // ---- Gamepass-Raster ----------------------------------------------------
  function passGrid(st, opts = {}) {
    const p = st.passes;
    const req = new Set(st.form.requiredPasses || []);
    if (!p) return null;
    const items = p.items || [];
    const owned = items.filter((x) => x.owned).length;
    const box = h("div", {});
    const recheck = h("button", { class: "ghost", type: "button", onclick: async (e) => {
      e.currentTarget.disabled = true;
      try { await refreshState(true); render(); toast("Gamepässe neu geprüft."); } catch (ex) { toast(errText(ex)); e.currentTarget.disabled = false; }
    } }, "🔄 Neu prüfen");
    return h("div", {},
      h("div", { class: "section-head" },
        h("h3", {}, "🎟️ Deine Gamepässe"),
        h("div", { class: "row" }, p.private ? null : h("span", { class: "pass-count" }, owned, h("small", {}, " / " + items.length)), opts.noRecheck ? null : recheck)),
      p.private ? h("div", { class: "notice" }, h("span", { class: "ico" }, "🔒"),
        h("p", {}, h("b", {}, "Dein Roblox-Inventar ist privat. "), "Damit wir deine Gamepässe sehen, stell kurz um: Roblox → Einstellungen → Privatsphäre → „Wer kann mein Inventar sehen?“ → ", h("b", {}, "Alle"), ". Danach auf „Neu prüfen“.")) : null,
      h("div", { class: "passes" }, items.map((x) => {
        const cls = x.owned ? "own" : x.owned === false ? "miss" : "unk";
        return h("div", { class: `pass ${cls}${req.has(x.id) ? " req" : ""}`, title: x.name },
          x.icon ? h("img", { src: x.icon, alt: "", loading: "lazy" }) : h("div", { style: { height: "64px", display: "grid", placeItems: "center" } }, gemSvg(44)),
          h("div", { class: "nm" }, x.name),
          h("span", { class: "st" }, x.owned ? "✓" : x.owned === false ? "–" : "?"));
      })),
      p.source === "big" ? h("p", { class: "hint" }, "Quelle: dein Spielstand (BIG Games).") : h("p", { class: "hint" }, `Geprüft ${ago(p.checked)} über Roblox.`),
      box);
  }

  // ---- Schritt 3: Inventar -----------------------------------------------
  function screenInventory() {
    const st = S.st;
    const big = st.big;
    const required = st.form.requireInventory && st.bigReady;
    const parts = [stepper(3)];

    const head = h("div", { class: "card" },
      h("div", { class: "row between" },
        h("div", {}, h("h2", {}, "Dein Account"), h("p", { class: "lead mb0" }, "Das sieht das Team automatisch – du musst nichts abtippen.")),
        h("div", { class: "row" }, rbxCard(st.roblox, true),
          h("button", { class: "link", type: "button", onclick: () => { S.view = "roblox"; render(); } }, "ändern"))));
    parts.push(head);

    // BIG Games
    const bigCard = h("div", { class: "card" });
    if (!st.bigReady) {
      rc(bigCard, h("h3", {}, "💎 Inventar"), h("div", { class: "notice info" }, h("span", { class: "ico" }, "ℹ️"), h("p", {}, "Die automatische Inventar-Verbindung ist gerade nicht eingeschaltet. Lade stattdessen im nächsten Schritt Screenshots von deinem Inventar hoch.")));
    } else if (!big) {
      rc(bigCard, h("div", { class: "big-cta" },
        h("div", { class: "logo" }, gemSvg(54)),
        h("div", {},
          h("h3", {}, "💎 Inventar verbinden", required ? h("span", { class: "tag bad", style: { marginLeft: "8px", verticalAlign: "middle" } }, "Pflicht") : null),
          h("p", { class: "mt0" }, "Verbinde deinen Pet-Simulator-99-Spielstand über ", h("b", {}, "BIG Games"), " (die Macher von PS99). Dann sehen wir deine Huges, Titanics, deinen RAP, Rang und deine Masterys – und füllen die Bewerbung für dich aus."),
          h("ul", {}, h("li", {}, "Offizielle Anmeldung bei BIG Games"), h("li", {}, "Nur Lesezugriff – niemand kann etwas verändern oder traden"), h("li", {}, "Du kannst die Verbindung jederzeit wieder trennen")),
          h("div", { class: "row" },
            h("button", { class: "btn cyan big", type: "button", onclick: connectBig }, "💎 Mit BIG Games verbinden"),
            required ? null : h("button", { class: "link", type: "button", onclick: () => { S.skipInv = true; sessionStorage.setItem("dux0a2_skipinv", "1"); render(); } }, "Überspringen")))));
    } else if (!big.loaded) {
      rc(bigCard, h("h3", {}, "💎 Inventar"),
        big.error === "token_expired" ? h("div", { class: "notice bad" }, h("span", { class: "ico" }, "⏰"), h("p", {}, "Deine BIG-Games-Verbindung ist abgelaufen. Verbinde sie bitte neu."))
          : big.error ? h("div", { class: "notice" }, h("span", { class: "ico" }, "⚠️"), h("p", {}, "BIG Games antwortet gerade langsam. Wir versuchen es automatisch weiter …")) : null,
        h("div", { class: "loader" }, h("div", { class: "m" }), h("div", {}, h("b", {}, "Dein Inventar wird geladen …"), h("div", { class: "hint" }, "Das dauert meist nur ein paar Sekunden. Die Seite aktualisiert sich von selbst."))),
        big.error ? h("button", { class: "ghost mt", type: "button", onclick: connectBig }, "Neu verbinden") : null);
      scheduleStatePoll();
    } else {
      const sm = big.summary || {};
      const b = sm.bigs || {};
      const pr = big.profile || {};
      rc(bigCard,
        h("div", { class: "section-head" }, h("h3", {}, "💎 Dein Inventar"), h("span", { class: "tag ok" }, "✔ verbunden · " + ago(big.lastFetch))),
        h("div", { class: "stats" },
          stat("Gesamt-RAP", short(sm.totalRap), "gold"),
          stat("Huge", fmtNum(b.Huge), "huge"), stat("Titanic", fmtNum(b.Titanic), "titanic"), stat("Gargantuan", fmtNum(b.Gargantuan), "garg")),
        pr && (pr.rank || pr.playtimeHours || pr.diamonds) ? h("div", { class: "stats" },
          stat("Rang", pr.rank ? fmtNum(pr.rank) : "–"), stat("Spielzeit", pr.playtimeHours ? "~" + fmtNum(pr.playtimeHours) + " h" : "–"),
          stat("Diamanten", pr.diamonds ? short(pr.diamonds) : "–"), stat("Rebirths", pr.rebirths != null ? fmtNum(pr.rebirths) : "–")) : null,
        big.topBigs && big.topBigs.length ? [h("p", { class: "hint", style: { margin: "4px 0 8px" } }, "Deine besten Pets:"),
          h("div", { class: "pets" }, big.topBigs.map((p) => h("div", { class: "pet " + (p.tier || "") },
            p.icon ? h("img", { src: p.icon, alt: "", loading: "lazy" }) : gemSvg(54),
            h("div", { class: "nm" }, (p.variant && p.variant !== "Normal" && p.variant !== "Regular" ? p.variant + " " : "") + p.name + (p.count > 1 ? " ×" + p.count : "")),
            h("div", { class: "rap" }, short(p.rap) + " RAP"))))] : h("p", { class: "hint" }, "Noch keine Huges – kein Problem!"));
    }
    parts.push(bigCard);

    const pg = passGrid(st);
    if (pg) parts.push(h("div", { class: "card" }, pg));

    const canGo = !required || (big && big.loaded);
    parts.push(h("div", { class: "row end mt" },
      canGo ? h("button", { class: "btn big", type: "button", onclick: () => { S.view = "form"; render(); window.scrollTo({ top: 0, behavior: "smooth" }); } }, "Weiter zur Bewerbung →")
        : h("span", { class: "hint" }, "Verbinde dein Inventar, um weiterzumachen.")));
    rc(APP, parts);
  }
  const stat = (lbl, val, cls) => h("div", { class: "stat " + (cls || "") }, h("div", { class: "lbl" }, lbl), h("div", { class: "val" }, val));

  async function connectBig() {
    try {
      const r = await api("/api/apply2/big/start", { method: "POST", json: {} });
      sessionStorage.setItem("dux0_big_token", S.token);
      sessionStorage.setItem("dux0_big_return", location.origin + location.pathname + "#/inventar");
      location.href = r.url;
    } catch (e) { toast(errText(e)); }
  }

  // ---- Schritt 4: Formular -----------------------------------------------
  function screenForm() {
    const st = S.st;
    const form = st.form;
    const d = draft();
    const answers = d.answers || {};
    for (const f of form.fields) {
      const v = f.auto && st.prefill ? st.prefill[f.auto] : null;
      if (v && (answers[f.key] == null || answers[f.key] === "")) answers[f.key] = v;
    }
    const store = () => saveDraft({ ...draft(), answers });
    const err = h("p", { class: "err" });

    const fieldEls = form.fields.filter((f) => f.enabled !== false).map((f) => {
      const auto = f.auto && st.prefill && st.prefill[f.auto] && String(answers[f.key] || "") === String(st.prefill[f.auto]);
      const lbl = h("label", { class: "lbl", for: "f_" + f.key }, f.label, f.required ? h("span", { class: "req" }, "*") : null, auto ? h("span", { class: "tag auto" }, "✨ aus deinem Spielstand") : null);
      let ctl;
      if (f.type === "textarea") {
        ctl = h("textarea", { id: "f_" + f.key, placeholder: f.placeholder || "", maxlength: 1000, value: answers[f.key] || "", oninput: (e) => { answers[f.key] = e.target.value; store(); } });
      } else if (f.type === "yesno") {
        const yes = h("button", { type: "button", class: "choice yes" + (answers[f.key] === "yes" ? " on" : "") }, "👍 Ja");
        const no = h("button", { type: "button", class: "choice no" + (answers[f.key] === "no" ? " on" : "") }, "👎 Nein");
        yes.onclick = () => { answers[f.key] = "yes"; yes.classList.add("on"); no.classList.remove("on"); store(); };
        no.onclick = () => { answers[f.key] = "no"; no.classList.add("on"); yes.classList.remove("on"); store(); };
        ctl = h("div", { class: "choices" }, yes, no);
      } else if (f.type === "select") {
        const btns = (f.options || []).map((o) => {
          const b = h("button", { type: "button", class: "choice" + (answers[f.key] === o ? " on" : "") }, o);
          b.onclick = () => { answers[f.key] = o; btns.forEach((x) => x.classList.toggle("on", x === b)); store(); };
          return b;
        });
        ctl = h("div", { class: "choices" }, btns);
      } else {
        ctl = h("input", { id: "f_" + f.key, type: f.type === "number" ? "text" : "text", inputmode: f.type === "number" ? "decimal" : null,
          placeholder: f.placeholder || "", maxlength: f.type === "number" ? 30 : 200, value: answers[f.key] || "",
          oninput: (e) => { answers[f.key] = e.target.value; store(); } });
      }
      const full = f.type === "textarea" || f.type === "select" || f.type === "yesno" || (f.label || "").length > 38;
      return h("div", { class: "field" + (full ? " full" : "") }, lbl, ctl);
    });

    // Screenshots
    const minShots = Number(form.minScreenshots || 0);
    const thumbs = h("div", { class: "thumbs" });
    const fileInput = h("input", { type: "file", accept: "image/*", multiple: true, style: { display: "none" } });
    const drop = h("div", { class: "drop", tabindex: "0", role: "button" },
      h("div", { class: "ico" }, "📸"),
      h("b", {}, "Screenshots hierher ziehen oder klicken"),
      h("span", { class: "hint" }, minShots ? `Mindestens ${minShots} – z.B. Inventar, Stats, Huges (max. 5, je 4 MB)` : "Freiwillig – z.B. Inventar, Stats, Huges (max. 5, je 4 MB)"));
    const addFiles = (list) => {
      for (const f of list) {
        if (!f.type.startsWith("image/")) { toast("Nur Bilder, bitte."); continue; }
        if (S.files.length >= 5) { toast("Höchstens 5 Bilder."); break; }
        if (f.size > 4 * 1024 * 1024) { toast(`${f.name} ist zu groß (max. 4 MB).`); continue; }
        S.files.push(f);
      }
      drawThumbs();
    };
    function drawThumbs() {
      rc(thumbs, S.files.map((f, i) => {
        const url = URL.createObjectURL(f);
        return h("div", { class: "thumb" }, h("img", { src: url, alt: "" }),
          h("button", { type: "button", title: "Entfernen", onclick: () => { S.files.splice(i, 1); drawThumbs(); } }, "×"));
      }));
    }
    drop.onclick = () => fileInput.click();
    drop.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); } };
    fileInput.onchange = () => { addFiles(fileInput.files); fileInput.value = ""; };
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add("over"); };
    drop.ondragleave = () => drop.classList.remove("over");
    drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove("over"); addFiles(e.dataTransfer.files); };
    drawThumbs();

    // Anforderungen
    const rq = st.requirements || {};
    const reqTags = [];
    if (rq.minRank) reqTags.push(rq.rankOk === true ? h("span", { class: "tag ok" }, `✔ Rang ${rq.rank} (min. ${rq.minRank})`)
      : rq.rankOk === false ? h("span", { class: "tag bad" }, `✖ Rang ${rq.rank} – mindestens ${rq.minRank}`) : h("span", { class: "tag warn" }, `Mindest-Rang: ${rq.minRank}`));
    if ((form.requiredPasses || []).length) {
      reqTags.push(rq.missingPasses && rq.missingPasses.length ? h("span", { class: "tag bad" }, "✖ Es fehlt: " + rq.missingPasses.join(", "))
        : rq.unknownPasses && rq.unknownPasses.length ? h("span", { class: "tag warn" }, "? Nicht prüfbar: " + rq.unknownPasses.join(", "))
          : h("span", { class: "tag ok" }, "✔ Alle Pflicht-Gamepässe"));
    }
    const owned = ((st.passes || {}).items || []).filter((x) => x.owned).length;
    if (st.passes && !st.passes.private) reqTags.push(h("span", { class: "tag" }, `🎟️ ${owned}/${st.passes.items.length} Gamepässe`));
    if (st.big && st.big.summary) reqTags.push(h("span", { class: "tag" }, `💎 ${short(st.big.summary.totalRap)} RAP`));
    const blocked = (form.blockLowRank && rq.rankOk === false) || (form.blockMissingPasses && rq.missingPasses && rq.missingPasses.length);

    const submit = h("button", { class: "btn big", type: "submit", disabled: blocked ? true : null }, "🚀 Bewerbung absenden");
    const formEl = h("form", { novalidate: true, onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = "";
      const missing = form.fields.filter((f) => f.enabled !== false && f.required && !String(answers[f.key] || "").trim());
      if (missing.length) { err.textContent = "Bitte noch ausfüllen: " + missing.map((f) => f.label).join(", "); const el = document.getElementById("f_" + missing[0].key); if (el) el.focus(); return; }
      if (S.files.length < minShots) { err.textContent = `Bitte lade mindestens ${minShots} Screenshot${minShots > 1 ? "s" : ""} hoch.`; return; }
      submit.disabled = true; submit.textContent = "Wird gesendet …";
      try {
        const fd = new FormData();
        fd.append("data", JSON.stringify({ answers, lang: "de" }));
        for (const f of S.files) fd.append("images", f);
        await api("/api/apply2", { method: "POST", body: fd, timeout: 120000 });
        sessionStorage.removeItem(DRAFT_KEY); S.files = [];
        toast("Bewerbung gesendet! 🎉");
        await refreshMe(); S.view = null; render(); window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (ex) {
        err.textContent = errText(ex);
        if (ex.message === "inventory_required" || ex.message === "inventory_loading") { await refreshState(); }
      } finally { submit.disabled = !!blocked; submit.textContent = "🚀 Bewerbung absenden"; }
    } },
      h("div", { class: "fields" }, fieldEls,
        h("div", { class: "field full" }, h("label", { class: "lbl" }, "Screenshots", minShots ? h("span", { class: "req" }, "*") : null), drop, fileInput, thumbs)),
      h("div", { class: "submit-bar" },
        h("div", {}, err, blocked ? h("p", { class: "err" }, "Du erfüllst die Mindestanforderungen von DUX0 gerade noch nicht.") : null,
          h("p", { class: "hint mb0" }, "Mit dem Absenden sieht das Team deine Angaben, dein Inventar und deine Gamepässe.")),
        submit));

    rc(APP, stepper(4),
      h("div", { class: "card" },
        h("div", { class: "row between" },
          h("div", {}, h("h2", {}, "Deine Bewerbung"), h("p", { class: "lead mb0" }, "Felder mit * sind Pflicht. Was wir aus deinem Spielstand kennen, ist schon ausgefüllt – du kannst es ändern.")),
          rbxCard(st.roblox, true)),
        form.intro ? h("div", { class: "notice info mt" }, h("span", { class: "ico" }, "📣"), h("p", { style: { whiteSpace: "pre-line" } }, form.intro)) : null,
        reqTags.length ? h("div", { class: "req-box mt" }, reqTags) : null),
      h("div", { class: "card" }, formEl),
      h("div", { class: "row mt" }, h("button", { class: "ghost", type: "button", onclick: () => { S.view = "inventory"; render(); } }, "← Zurück zum Account")));
  }

  // ---- Schritt 5: Ergebnis -----------------------------------------------
  function screenStatus(app) {
    const me = S.me;
    if (app.status === "pending") {
      rc(APP, stepper(5), h("div", { class: "card status wait" },
        h("div", { class: "badge" }, "⏳"),
        h("h2", {}, "Bewerbung ist unterwegs!"),
        h("p", {}, `Gesendet ${dateTime(app.created)} als `, h("b", {}, app.roblox), ". Unser Team schaut sich jede Bewerbung persönlich an."),
        h("div", { class: "timeline" },
          h("div", { class: "on" }, h("b", {}, "1 · Gesendet ✔"), "Deine Bewerbung ist beim Team."),
          h("div", { class: "on" }, h("b", {}, "2 · Prüfung"), "Das Team checkt Inventar, Gamepässe & Antworten."),
          h("div", {}, h("b", {}, "3 · Entscheidung"), "Du siehst das Ergebnis hier und bekommst eine DM.")),
        h("p", { class: "hint" }, "Du kannst die Seite offen lassen – sie aktualisiert sich von selbst.")));
      return;
    }
    if (app.status === "accepted") {
      confetti();
      const box = h("div", { class: "mt" });
      const parts = [];
      if (me.inServer) parts.push(h("p", {}, "Du bist schon auf unserem Clan-Discord und hast deine Rolle. Willkommen im Team! 💜"));
      else if (app.awaitingClan) parts.push(h("p", {}, h("b", {}, "Letzter Schritt: "), "Tritt im Spiel dem Clan ", h("b", {}, "DUX0"), " bei. Sobald du drin bist, holt dich der Bot automatisch auf unseren Discord."));
      else if (me.canAutoJoin) parts.push(h("p", {}, "Der Bot fügt dich automatisch zu unserem Clan-Discord hinzu. Falls nicht, hol dir hier deine Einladung:"));
      else parts.push(h("p", {}, "Hol dir jetzt deine persönliche Einladung zu unserem Clan-Discord:"));
      if (!me.inServer && !app.awaitingClan) {
        rc(box, h("button", { class: "btn green", type: "button", onclick: async () => {
          try {
            const r = await api("/api/invite", { method: "POST" });
            rc(box, h("a", { class: "btn green", href: r.invite || r.url, target: "_blank", rel: "noopener" }, "🎉 DUX0-Discord beitreten"),
              h("p", { class: "hint" }, "Die Einladung gilt nur für dich und läuft nach ein paar Tagen ab."));
          } catch (e) { toast(errText(e)); }
        } }, "Einladung holen"));
      }
      rc(APP, stepper(6), h("div", { class: "card status ok" }, h("div", { class: "badge" }, "🎉"), h("h2", {}, "Du bist angenommen!"), parts, box));
      return;
    }
    if (app.status === "declined") {
      rc(APP, stepper(6), h("div", { class: "card status bad" },
        h("div", { class: "badge" }, "💔"),
        h("h2", {}, "Diesmal leider nicht"),
        h("p", {}, `Deine Bewerbung als ${app.roblox} wurde abgelehnt.`),
        app.reason ? h("div", { class: "notice", style: { textAlign: "left", maxWidth: "36rem", margin: "16px auto" } }, h("span", { class: "ico" }, "💬"), h("p", {}, h("b", {}, "Grund: "), app.reason)) : null,
        me.canReapply ? h("button", { class: "btn violet mt", type: "button", onclick: () => { S.reapply = true; S.view = null; render(); } }, "Erneut bewerben")
          : h("p", { class: "hint" }, `Du kannst dich ab ${dateTime(me.reapplyAt)} erneut bewerben. Bis dahin: weiter grinden! 💪`)));
    }
  }

  function confetti() {
    if (document.querySelector(".confetti")) return;
    const box = h("div", { class: "confetti" });
    const cols = ["#ffd23f", "#4fe6ff", "#ff7ae6", "#3ddc84", "#b47bff", "#fff"];
    for (let i = 0; i < 90; i++) {
      box.append(h("i", { style: { left: Math.random() * 100 + "%", background: cols[i % cols.length], animationDuration: 2.5 + Math.random() * 2.5 + "s", animationDelay: Math.random() * 1.2 + "s", transform: `rotate(${Math.random() * 360}deg)` } }));
    }
    document.body.append(box);
    setTimeout(() => box.remove(), 6500);
  }

  // ---------------------------------------------------------------- Owner-Einstellungen
  async function screenSettings() {
    rc(APP, h("div", { class: "boot" }, h("div", { class: "boot-mascot" }), h("p", {}, "Lädt Einstellungen …")));
    let cfg, passes;
    try { [cfg, passes] = await Promise.all([api("/api/apply2/form"), api("/api/passes")]); }
    catch (e) { rc(APP, h("div", { class: "card" }, h("p", { class: "err" }, errText(e)))); return; }
    const defaults = cfg.defaults; delete cfg.defaults;
    const F = JSON.parse(JSON.stringify(cfg));

    const sw = (get, set) => { const b = h("button", { type: "button", class: "switch" + (get() ? " on" : ""), "aria-pressed": String(!!get()) }); b.onclick = () => { set(!get()); b.classList.toggle("on", !!get()); }; return b; };
    const toggle = (title, text, get, set) => h("div", { class: "toggle" }, h("div", { class: "t" }, h("b", {}, title), text ? h("span", {}, text) : null), sw(get, set));

    // Roblox-Pruefung
    const seg = h("div", { class: "seg" });
    const drawSeg = () => rc(seg, [["name", "Nur Name + Avatar (einfach)"], ["bio", "Code in der Roblox-Bio (sicher)"]].map(([v, t]) =>
      h("button", { type: "button", class: F.robloxCheck === v ? "on" : "", onclick: () => { F.robloxCheck = v; drawSeg(); } }, t)));
    drawSeg();

    // Gamepaesse
    const passBox = h("div", { class: "passes pick" });
    const drawPasses = () => rc(passBox, passes.map((p) => {
      const sel = F.requiredPasses.includes(p.id);
      return h("div", { class: "pass" + (sel ? " sel" : ""), onclick: () => {
        F.requiredPasses = sel ? F.requiredPasses.filter((x) => x !== p.id) : [...F.requiredPasses, p.id]; drawPasses();
      } }, p.icon ? h("img", { src: p.icon, alt: "" }) : gemSvg(44), h("div", { class: "nm" }, p.name), h("span", { class: "st" }, sel ? "★" : ""));
    }));
    drawPasses();

    // Fragen
    const qBox = h("div", {});
    const TYPES = [["text", "Kurze Antwort"], ["textarea", "Langer Text"], ["yesno", "Ja / Nein"], ["select", "Auswahl"], ["number", "Zahl"]];
    const AUTO = { rank: "Rang", playtime: "Spielzeit", masteries: "Masterys", diamonds: "Diamanten", rebirths: "Rebirths", eggs: "Eier geöffnet" };
    function drawQ() {
      rc(qBox, F.fields.map((f, i) => {
        const typeSel = h("select", { onchange: (e) => { f.type = e.target.value; if (f.type === "select" && !(f.options || []).length) f.options = ["Option 1", "Option 2"]; drawQ(); } },
          TYPES.map(([v, t]) => h("option", { value: v, selected: f.type === v ? true : null }, t)));
        return h("div", { class: "qrow" + (f.enabled === false ? " off" : "") },
          h("div", { class: "mv" },
            h("button", { type: "button", title: "Nach oben", disabled: i === 0 ? true : null, onclick: () => { F.fields.splice(i - 1, 0, F.fields.splice(i, 1)[0]); drawQ(); } }, "▲"),
            h("button", { type: "button", title: "Nach unten", disabled: i === F.fields.length - 1 ? true : null, onclick: () => { F.fields.splice(i + 1, 0, F.fields.splice(i, 1)[0]); drawQ(); } }, "▼")),
          h("div", { class: "body" },
            h("div", { class: "opts" }, h("input", { type: "text", value: f.label, maxlength: 120, placeholder: "Frage", oninput: (e) => { f.label = e.target.value; } }), typeSel),
            f.type === "select" ? h("input", { type: "text", value: (f.options || []).join(", "), placeholder: "Antworten, mit Komma getrennt", oninput: (e) => { f.options = e.target.value.split(",").map((x) => x.trim()).filter(Boolean); } }) : null,
            f.type !== "yesno" && f.type !== "select" ? h("input", { type: "text", value: f.placeholder || "", maxlength: 120, placeholder: "Beispiel-Text im Feld (optional)", oninput: (e) => { f.placeholder = e.target.value; } }) : null,
            h("div", { class: "flags" },
              h("label", {}, h("input", { type: "checkbox", checked: f.enabled !== false ? true : null, onchange: (e) => { f.enabled = e.target.checked; drawQ(); } }), "Anzeigen"),
              h("label", {}, h("input", { type: "checkbox", checked: f.required ? true : null, onchange: (e) => { f.required = e.target.checked; } }), "Pflicht"),
              f.auto ? h("span", { class: "tag auto" }, "✨ automatisch: " + (AUTO[f.auto] || f.auto)) : null)),
          h("button", { type: "button", class: "del", title: "Frage löschen", onclick: () => { if (confirm(`Frage „${f.label}“ löschen?`)) { F.fields.splice(i, 1); drawQ(); } } }, "🗑"));
      }));
    }
    drawQ();

    const minRank = h("input", { type: "number", min: 0, max: 9999, value: F.minRank || 0, style: { maxWidth: "140px" }, oninput: (e) => { F.minRank = Number(e.target.value || 0); } });
    const shots = h("input", { type: "number", min: 0, max: 5, value: F.minScreenshots || 0, style: { maxWidth: "140px" }, oninput: (e) => { F.minScreenshots = Number(e.target.value || 0); } });
    const intro = h("textarea", { maxlength: 1500, placeholder: "z.B. Wir suchen gerade aktive Spieler für Clan Battles! …", value: F.intro || "", oninput: (e) => { F.intro = e.target.value; } });

    const saveBtn = h("button", { class: "btn green", type: "button", onclick: async () => {
      saveBtn.disabled = true;
      try {
        const res = await api("/api/apply2/form", { method: "PUT", json: F });
        Object.assign(F, res); toast("Gespeichert! ✅ Gilt sofort für alle neuen Bewerbungen."); drawQ(); drawPasses();
        S.st = null;
      } catch (e) { toast(errText(e)); } finally { saveBtn.disabled = false; }
    } }, "💾 Speichern");

    rc(APP, h("div", { class: "card mt" },
      h("h2", {}, "⚙️ Bewerbung einstellen"),
      h("p", { class: "lead" }, "Hier legst du fest, was bei einer Bewerbung wichtig ist. Nur Owner sehen diese Seite."),

      h("div", { class: "set-section" }, h("h3", {}, "🧑 Roblox-Account"),
        h("p", { class: "hint mt0" }, "„Nur Name“ ist am einfachsten für Bewerber. Mit „Bio-Code“ kann niemand einen fremden Account angeben."), seg),

      h("div", { class: "set-section" }, h("h3", {}, "💎 Inventar"),
        toggle("Inventar ist Pflicht", "Bewerber müssen ihren Spielstand über BIG Games verbinden.", () => F.requireInventory, (v) => { F.requireInventory = v; })),

      h("div", { class: "set-section" }, h("h3", {}, "🏆 Mindest-Rang"),
        h("div", { class: "row" }, minRank, h("span", { class: "hint" }, "0 = egal. Wird automatisch mit dem echten Rang verglichen.")),
        toggle("Unter dem Mindest-Rang blockieren", "Sonst wird es dem Team nur rot markiert.", () => F.blockLowRank, (v) => { F.blockLowRank = v; })),

      h("div", { class: "set-section" }, h("h3", {}, "🎟️ Pflicht-Gamepässe"),
        h("p", { class: "hint mt0" }, "Antippen = Pflicht (★). Die Seite prüft automatisch, ob der Bewerber sie hat."), passBox,
        toggle("Ohne Pflicht-Gamepässe blockieren", "Sonst wird es dem Team nur rot markiert.", () => F.blockMissingPasses, (v) => { F.blockMissingPasses = v; })),

      h("div", { class: "set-section" }, h("h3", {}, "📸 Screenshots"),
        h("div", { class: "row" }, shots, h("span", { class: "hint" }, "So viele Screenshots muss man mindestens hochladen (0–5)."))),

      h("div", { class: "set-section" }, h("h3", {}, "📣 Text oben auf der Bewerbung"), intro),

      h("div", { class: "set-section" },
        h("div", { class: "section-head" }, h("h3", {}, "📝 Fragen"),
          h("div", { class: "row" },
            h("button", { class: "ghost", type: "button", onclick: () => { F.fields.push({ key: "", label: "Neue Frage", type: "text", required: false, enabled: true, placeholder: "" }); drawQ(); } }, "＋ Frage hinzufügen"),
            h("button", { class: "link", type: "button", onclick: () => { if (confirm("Alle Fragen auf den Standard zurücksetzen?")) { F.fields = JSON.parse(JSON.stringify(defaults.fields)); drawQ(); } } }, "Standard"))),
        qBox),

      h("div", { class: "save-bar" }, h("span", { class: "hint" }, "Änderungen gelten erst nach dem Speichern."),
        h("div", { class: "row" }, h("button", { class: "ghost", type: "button", onclick: () => { location.hash = "#/"; } }, "Schließen"), saveBtn))));
  }

  // ---------------------------------------------------------------- Daten
  async function refreshMe() {
    try { S.me = await api("/api/me"); S.offline = false; }
    catch (e) {
      if (e.message === "offline") S.offline = true;
      else if (e.status === 401) { S.token = ""; S.me = null; localStorage.removeItem(TOKEN_KEY); }
      else throw e;
    }
  }
  async function refreshState(recheck) {
    S.st = await api("/api/apply2/state" + (recheck ? "?recheck=1" : ""));
  }

  let statePoll = null;
  function scheduleStatePoll() {
    if (statePoll) return;
    statePoll = setTimeout(async () => {
      statePoll = null;
      try { await refreshState(); if (!S.view || S.view === "inventory") render(); } catch (_) {}
    }, 4000);
  }

  let mePoll = null;
  function scheduleMePoll() {
    clearInterval(mePoll);
    mePoll = setInterval(async () => {
      if (!S.token || !S.me) return;
      const app = S.me.application;
      if (!(app && app.status === "pending")) return;
      try { await refreshMe(); if (S.view !== "settings") render(); } catch (_) {}
    }, 20000);
  }

  // ---------------------------------------------------------------- Ablauf
  async function render() {
    renderTop();
    if (S.offline || !S.api) return screenOffline();
    if (!S.token || !S.me) return screenHero();
    if (S.view === "settings") {
      if (!S.me.owner) { location.hash = "#/"; return; }
      return screenSettings();
    }
    const me = S.me;
    const app = me.application;
    if (app && (app.status === "pending" || app.status === "accepted")) return screenStatus(app);
    if (app && app.status === "declined" && !(me.canReapply && S.reapply)) return screenStatus(app);

    if (!S.st) {
      rc(APP, h("div", { class: "boot" }, h("div", { class: "boot-mascot" }), h("p", {}, "Lädt deinen Account …")));
      try { await refreshState(); } catch (e) { rc(APP, h("div", { class: "card mt" }, h("p", { class: "err" }, errText(e)), h("button", { class: "btn violet", type: "button", onclick: () => location.reload() }, "Neu laden"))); return; }
    }
    const st = S.st;
    if (!st.roblox || S.view === "roblox") return screenRoblox();
    const invRequired = st.form.requireInventory && st.bigReady;
    const invDone = st.big && st.big.loaded;
    if (S.view === "inventory") { S.visitedInv = true; return screenInventory(); }
    if (S.view === "form") return (invRequired && !invDone) ? screenInventory() : screenForm();
    if (invRequired && !invDone) return screenInventory();
    if (!invRequired && !invDone && st.bigReady && !S.skipInv) return screenInventory();
    if (!S.visitedInv) { S.visitedInv = true; return screenInventory(); }
    return screenForm();
  }

  function readHash() {
    const hsh = (location.hash || "").replace(/^#\/?/, "");
    S.view = hsh === "einstellungen" ? "settings" : hsh === "inventar" ? "inventory" : null;
  }
  window.addEventListener("hashchange", () => { readHash(); render(); });

  async function init() {
    sparkles();
    readHash();
    try {
      S.cfg = await (await fetch("config.json?t=" + Date.now(), { cache: "no-store" })).json();
      S.api = (S.cfg.api || "").replace(/\/$/, "");
    } catch (_) { S.api = ""; }
    if (!S.api) { S.offline = true; return render(); }
    try {
      const c2 = await (await fetch(S.api + "/api/config?site=apply2")).json();
      S.cfg = { ...S.cfg, ...c2 };
    } catch (_) { S.offline = true; return render(); }
    if (S.token) { try { await refreshMe(); } catch (_) {} }
    if (S.view === "inventory" && S.me) S.visitedInv = true;
    await render();
    scheduleMePoll();
  }

  init();
})();
