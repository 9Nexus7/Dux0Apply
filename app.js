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
  };

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

  function showNotice() {
    const n = $("#notice");
    n.hidden = !S.offline;
    n.textContent = "The live server is offline right now. You are seeing the last saved data. Applying, login and editing need the live server.";
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
    if (!S.cfg || !S.cfg.clientId) { toast("Login is not available while the live server is offline."); return; }
    const st = Array.from(crypto.getRandomValues(new Uint32Array(4))).join("-");
    sessionStorage.setItem("dux0_state", st);
    sessionStorage.setItem("dux0_return", location.hash || "#/");
    const q = new URLSearchParams({ client_id: S.cfg.clientId, response_type: "code", scope: "identify", redirect_uri: S.cfg.redirectUri, state: st });
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
    if (S.me) box.append(S.me.user.avatar ? h("img", { src: S.me.user.avatar, alt: "" }) : "", h("span", { class: "who" }, S.me.user.name), h("button", { class: "btn ghost small", onclick: logout }, "Log out"));
    else if (S.token) box.append(h("button", { class: "btn ghost small", onclick: logout }, "Log out"));
    else box.append(h("button", { class: "btn small", onclick: login }, "Log in with Discord"));
    $("#admin-link").hidden = !(S.me && S.me.admin);
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
    if (r && r.above) right.append(h("p", { class: "gap" }, h("b", { class: "up" }, exact(r.above.points - ev.points)), " behind #" + (r.place - 1) + " " + r.above.name));
    if (r && r.below) right.append(h("p", { class: "gap" }, h("b", { class: "down" }, exact(ev.points - r.below.points)), " ahead of " + r.below.name));
    p.append(left, mid, right);
    return p;
  }

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

  /* ------------------------------------------------------------------ */
  /* views                                                               */
  /* ------------------------------------------------------------------ */
  async function viewHome() {
    loading();
    const [clan, content] = await Promise.all([load("clan"), load("content")]);
    const c = content || {}, t = (clan && clan.totals) || {}, cl = (clan && clan.clan) || {};
    const invite = c.invite || (S.cfg && S.cfg.invite) || "https://discord.gg/dux0";
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
          h("div", { class: "cta" }, h("a", { class: "btn", href: "#/apply" }, "Apply to join"),
            h("a", { class: "btn ghost", href: invite, target: "_blank", rel: "noopener" }, "Open our Discord"))),
        c.requirements && c.requirements.length ? h("div", {}, h("h3", {}, "What we look for"), h("ul", { class: "reqs" }, c.requirements.map((r) => h("li", {}, r)))) : null)));
  }

  const SORTS = {
    event: { label: "Battle points", rank: "eventRank", get: (m) => m.event },
    points: { label: "All-time points", rank: "pointsRank", get: (m) => m.points },
    gems: { label: "Gems", rank: "gemsRank", get: (m) => m.gems },
    joined: { label: "Longest member", rank: null, get: (m) => -(m.joined || 9e12) },
  };
  function sortedMembers(members, key) {
    const s = SORTS[key];
    return [...members].sort((a, b) => s.get(b) - s.get(a) || a.name.localeCompare(b.name));
  }
  function mainVal(m, key) {
    if (key === "gems") return h("b", { title: exact(m.gems) }, compact(m.gems));
    if (key === "joined") return h("b", {}, fmtDate(m.joined));
    return h("b", {}, exact(SORTS[key].get(m)));
  }
  function subVal(m, key) {
    if (key === "event") return `${exact(m.points)} all-time · ${compact(m.gems)} gems`;
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

  /* ---------------- apply (3-step form) ---------------- */
  const APPLY_ERRORS = {
    login_required: "Please log in with Discord first.",
    invalid_roblox_name: "That Roblox username does not look right. Use 3 to 20 letters, numbers or underscores.",
    missing_fields: "Please fill in every required field.",
    slow_down: "Please wait a few seconds before sending again.",
    join_server_first: "You need to be in the DUX0 Discord server first. Join it, then send your application again.",
    already_member: "You already have the DUX0 member role.",
    already_pending: "You already have an application waiting for a decision.",
    bot_not_ready: "The bot is starting up. Try again in a minute.",
  };

  async function viewApply() {
    loading();
    const content = (await load("content")) || {};
    const invite = content.invite || "https://discord.gg/dux0";
    const head = pageHead("Apply to DUX0", "Three short steps. Our staff reviews every application in Discord and you get a direct message with the decision.");
    if (S.offline || !S.api) { view.replaceChildren(head, empty("The live server is offline, so applications cannot be sent right now. Please try again later.")); return; }
    if (!S.token || !S.me) {
      view.replaceChildren(head, h("div", { class: "card panel shard" },
        h("p", {}, "Log in with Discord so the bot can message you the result and give you your role. We only read your Discord name and ID."),
        h("button", { class: "btn", onclick: login }, "Log in with Discord"),
        h("p", { class: "hint" }, "Login not working? Open the ", h("a", { href: "#/status" }, "site status page"), " to see why.")));
      return;
    }
    if (!S.me.inServer) { view.replaceChildren(head, h("div", { class: "card panel shard" }, h("p", {}, "You are not in the DUX0 Discord server yet. Join first, then come back and apply."), h("a", { class: "btn", href: invite, target: "_blank", rel: "noopener" }, "Join the Discord"))); return; }
    if (S.me.pending) { view.replaceChildren(head, h("div", { class: "ok-box shard" }, "Your application is in. Staff will review it in the Discord server and message you with the result.")); return; }

    const d = { roblox: "", rank: "", playtime: "", gamepasses: "", masteries: "", spend: "", note: "" };
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
        if (!/^[A-Za-z0-9_]{3,20}$/.test(d.roblox.trim())) return APPLY_ERRORS.invalid_roblox_name;
        if (!d.rank.trim() || !d.playtime.trim()) return "Please fill in your rank and playtime.";
      }
      if (step === 1 && (!d.gamepasses.trim() || !d.masteries.trim())) return "Please fill in gamepasses and masteries. Write \"none\" if you have none.";
      if (step === 2 && !d.spend) return "Please answer the 3B gems question.";
      return "";
    };
    const draw = () => {
      err.textContent = "";
      const titles = ["You", "Progress", "Commitment"];
      const body = [];
      body.push(h("ol", { class: "steps" }, titles.map((t, i) => h("li", { class: i === step ? "on" : i < step ? "done" : "" }, `${i + 1}. ${t}`))));
      body.push(h("div", { class: "who-card" }, S.me.user.avatar ? h("img", { src: S.me.user.avatar, alt: "" }) : null, h("span", {}, "Applying as ", h("b", {}, S.me.user.name))));
      if (step === 0) body.push(text("roblox", "Roblox username"), text("rank", "Your rank", "(in-game rank)"), text("playtime", "Playtime", "(for example 120 hours)"));
      if (step === 1) body.push(text("gamepasses", "Gamepasses", "(which ones you own)", true), text("masteries", "Masteries", "(which ones and how far)", true));
      if (step === 2) {
        const radios = ["yes", "no"].map((v) => { const i = h("input", { type: "radio", name: "spend", value: v }); i.checked = d.spend === v; i.addEventListener("change", () => { d.spend = v; }); return h("label", {}, i, v === "yes" ? "Yes" : "No"); });
        const note = h("textarea", { id: "note", maxlength: 800 }, d.note); note.addEventListener("input", () => { d.note = note.value; });
        body.push(h("div", { class: "field" }, h("label", {}, "Can you spend 3B gems in a clan battle when required?"), h("div", { class: "choice" }, radios)),
          h("div", { class: "field" }, h("label", { for: "note" }, "Anything else we should know ", h("span", { class: "hint" }, "(optional)")), note));
      }
      body.push(err, h("div", { class: "actions" },
        step > 0 ? h("button", { type: "button", class: "btn ghost", onclick: () => { step--; draw(); } }, "Back") : h("span"),
        h("button", { type: "submit", class: "btn" }, step < 2 ? "Next step" : "Send application")));
      card.replaceChildren(...body);
    };
    card.addEventListener("submit", async (e) => {
      e.preventDefault();
      const v = validate(); if (v) { err.textContent = v; return; }
      if (step < 2) { step++; draw(); return; }
      const btn = card.querySelector("button[type=submit]"); btn.disabled = true; btn.textContent = "Sending…";
      try {
        await api("/api/apply", { method: "POST", json: { roblox: d.roblox.trim(), rank: d.rank.trim(), playtime: d.playtime.trim(), gamepasses: d.gamepasses.trim(), masteries: d.masteries.trim(), can_spend: d.spend === "yes", note: d.note.trim() } });
        S.me.pending = true;
        view.replaceChildren(head, h("div", { class: "ok-box shard" }, "Application sent. Staff will review it in the Discord server and message you with the result."));
      } catch (ex) {
        err.textContent = APPLY_ERRORS[ex.message] || "Something went wrong. Please try again in a minute.";
        btn.disabled = false; btn.textContent = "Send application";
      }
    });
    draw();
    view.replaceChildren(head, card);
  }

  /* ---------------- admin ---------------- */
  async function uploadImage(file) {
    const fd = new FormData(); fd.append("file", file);
    return (await api("/api/upload", { method: "POST", body: fd, timeout: 60000 })).path;
  }

  async function viewAdmin() {
    loading();
    if (!S.me || !S.me.admin) {
      view.replaceChildren(pageHead("Admin", "Only clan staff can edit the website."), S.token ? empty("Your account does not have the admin role.") : h("button", { class: "btn", onclick: login }, "Log in with Discord"));
      return;
    }
    if (S.offline) { view.replaceChildren(pageHead("Admin", ""), empty("The live server is offline. Editing is not possible right now.")); return; }
    const d = JSON.parse(JSON.stringify(await api("/api/content")));
    d.achievements = d.achievements || []; d.gallery = d.gallery || []; d.requirements = d.requirements || [];
    const achBox = h("div"), galBox = h("div", { class: "gallery-edit" });
    const pickFile = (onPath) => {
      const input = h("input", { type: "file", accept: "image/png,image/jpeg,image/webp,image/gif", multiple: true });
      input.addEventListener("change", async () => {
        for (const file of input.files) {
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

    const ann = h("input", { type: "text", maxlength: 240, value: d.announcement || "", placeholder: "Shown as a banner on the home page. Leave empty for none.", oninput: (e) => (d.announcement = e.target.value) });
    const about = h("textarea", { maxlength: 4000, style: "min-height:9rem", oninput: (e) => (d.about = e.target.value) }, d.about || "");
    const invite = h("input", { type: "url", value: d.invite || "", oninput: (e) => (d.invite = e.target.value) });
    const reqs = h("textarea", { placeholder: "One requirement per line", oninput: (e) => (d.requirements = e.target.value.split("\n")) }, d.requirements.join("\n"));
    const save = h("button", { class: "btn", type: "button" }, "Save changes");
    save.addEventListener("click", async () => {
      save.disabled = true;
      try { const saved = await api("/api/content", { method: "PUT", json: d }); S.cache.content = { t: Date.now(), v: saved }; toast("Saved. Everyone sees the change now."); }
      catch (e) { toast("Could not save: " + e.message); }
      save.disabled = false;
    });
    drawAch(); drawGal();
    view.replaceChildren(
      pageHead("Admin", "Changes go live for every visitor as soon as you save. No GitHub step needed."),
      h("div", { class: "card wide panel shard" },
        h("div", { class: "field" }, h("label", {}, "Announcement banner"), ann),
        h("div", { class: "field" }, h("label", {}, "About text"), about),
        h("div", { class: "field" }, h("label", {}, "Discord invite link"), invite),
        h("div", { class: "field" }, h("label", {}, "Requirements"), reqs)),
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
      add(st.githubToken ? "ok" : "warn", "GitHub token", st.githubToken ? "Set. The bot can update config.json and back up content." : "Not set. Without it you must enter the tunnel address into config.json by hand after every restart.");
      add(st.tunnel ? "ok" : "warn", "Tunnel", st.tunnel || "No tunnel is running from this bot process.");
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
  const routes = { home: viewHome, battles: viewBattles, members: viewMembers, stats: viewStats, achievements: viewAchievements, apply: viewApply, admin: viewAdmin, status: viewStatus };
  const LIVE_VIEWS = ["home", "battles", "members", "stats"];

  async function route(opts = {}) {
    S.silent = !!opts.silent;
    S.timers.forEach(clearInterval); S.timers = [];
    const name = location.hash.replace(/^#\/?/, "").split("?")[0] || "home";
    const key = routes[name] ? name : "home";
    S.route = key;
    document.querySelectorAll("#links a").forEach((a) => a.classList.toggle("on", a.dataset.r === key));
    try { await routes[key](); }
    catch (e) { console.error(e); view.replaceChildren(pageHead("Something went wrong", "Please reload the page.")); }
    if (!S.silent) window.scrollTo(0, 0);
    S.silent = false;
  }

  async function boot() {
    try { const cfg = await (await fetch("config.json?t=" + Date.now())).json(); S.api = (cfg.api || "").replace(/\/$/, ""); } catch (_) { /* none */ }
    if (S.api) { try { S.cfg = await api("/api/config", { timeout: 6000 }); } catch (_) { S.offline = true; } } else S.offline = true;
    if (S.cfg) { $("#foot-discord").href = S.cfg.invite || "https://discord.gg/dux0"; await refreshMe(); }
    showNotice(); renderAccount();
    addEventListener("hashchange", () => route());
    addEventListener("scroll", () => $("#nav").classList.toggle("scrolled", scrollY > 10), { passive: true });
    setInterval(() => {
      const a = document.activeElement;
      if (document.hidden || S.modal || S.offline || !LIVE_VIEWS.includes(S.route) || (a && /INPUT|TEXTAREA/.test(a.tagName))) return;
      delete S.cache.clan; route({ silent: true });
    }, 90000);
    embers(); route();
  }
  boot();
})();
