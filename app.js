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
    $("#owner-link").hidden = !(S.me && S.me.owner);
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
  const APPLY_ERRORS = {
    login_required: "Please log in with Discord first.",
    invalid_roblox_name: "That Roblox username does not look right. Use 3 to 20 letters, numbers or underscores.",
    missing_fields: "Please fill in every required field.",
    slow_down: "Please wait a few seconds before sending again.",
    already_member: "You already have the DUX0 member role.",
    already_pending: "You already have an application waiting for a decision.",
    already_accepted: "Your application was already accepted. Open the invite on this page.",
    cooldown: "You were declined recently. You can apply again after the waiting time shown on this page.",
    too_many_images: "You can attach up to 5 screenshots.",
    image_too_large: "One screenshot is too large. Try a smaller one.",
    not_an_image: "Only PNG, JPG or WEBP screenshots are allowed.",
    bot_not_ready: "The bot is starting up. Try again in a minute.",
    invite_failed: "The bot could not create an invite right now. Ask staff in Discord.",
    already_in_server: "You are already on the server.",
    roblox_verify_required: "Please verify your Roblox account first.",
  };

  async function shrinkImage(file) {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("not_an_image");
    const bmp = await createImageBitmap(file);
    const sc = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.86));
    return { blob, name: file.name.replace(/\.\w+$/, "") + ".jpg", url: URL.createObjectURL(blob) };
  }

  const dateTime = (ts) => (ts ? new Date(ts * 1000).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" }) : "");
  function statusCard(kind, glyph, title, ...body) {
    return h("div", { class: "status-card panel shard " + kind }, h("div", { class: "status-glyph" }, h("span", {}, glyph)), h("div", { class: "status-body" }, h("h2", {}, title), body));
  }
  function timeline(active) {
    const steps = ["Application sent", "Staff review", "Decision"];
    return h("ol", { class: "timeline" }, steps.map((t, i) => h("li", { class: i < active ? "done" : i === active ? "now" : "" }, h("i"), t)));
  }

  async function viewApply() {
    loading();
    await load("content");
    const head = pageHead("Apply to DUX0", "Membership is by application. Send yours in three short steps, then come back to this page to see the decision. Accepted players get a personal invite to our Discord.");
    if (S.offline || !S.api) { view.replaceChildren(head, empty("The live server is offline, so applications cannot be sent right now. Please try again later.")); return; }
    if (!S.token || !S.me) {
      view.replaceChildren(head, h("div", { class: "card panel shard" },
        h("p", {}, "Log in with Discord so we know who you are and can show you the decision here. You do not need to be in our server yet. We only read your Discord name and ID."),
        h("button", { class: "btn", onclick: login }, "Log in with Discord"),
        h("p", { class: "hint" }, "Login not working? Open the ", h("a", { href: "#/status" }, "site status page"), " to see why.")));
      return;
    }
    const me = S.me, app = me.application;
    const rerender = () => route({ silent: true });

    if (me.hasRole && (!app || app.status !== "pending")) { view.replaceChildren(head, statusCard("ok", "✓", "You are a DUX0 member", h("p", {}, "You already have the member role on our Discord. See you in the next battle."))); return; }

    if (app && app.status === "pending") {
      S.timers.push(setInterval(async () => { await refreshMe(); if (!S.me || !S.me.application || S.me.application.status !== "pending") route({ silent: true }); }, 15000));
      view.replaceChildren(head, statusCard("wait", "…", "Your application is in review",
        h("p", {}, `Sent as ${app.roblox} on ${dateTime(app.created)}. Our staff reads every application in Discord. This page checks for the decision by itself, so you can leave it open or come back later.`),
        timeline(1)));
      return;
    }
    if (app && app.status === "accepted") {
      const body = [h("p", {}, `Welcome to DUX0, ${app.roblox}. ` + (me.inServer ? "You are already on the server and your member role is set." : "Join our Discord with your personal invite. The bot gives you your member role the moment you arrive."))];
      if (!me.inServer) {
        const box = h("div", { class: "cta" });
        const draw = () => {
          box.replaceChildren(app.invite ? h("a", { class: "btn", href: app.invite, target: "_blank", rel: "noopener" }, "Join the DUX0 Discord") : null,
            h("button", { class: "btn ghost", type: "button", onclick: async (e) => {
              e.currentTarget.disabled = true;
              try { app.invite = (await api("/api/invite", { method: "POST" })).invite; toast("New invite created."); }
              catch (ex) { toast(APPLY_ERRORS[ex.message] || "Could not create an invite."); }
              draw();
            } }, app.invite ? "Invite expired? Get a new one" : "Get my invite"));
        };
        draw();
        body.push(box, h("p", { class: "hint" }, "The invite works for one person and expires after 3 days. People who join without an accepted application are removed automatically."));
      }
      body.push(timeline(3));
      view.replaceChildren(head, statusCard("ok", "✓", "You were accepted", body));
      return;
    }
    if (app && app.status === "declined" && !(me.canReapply && S.reapply)) {
      const when = me.reapplyAt ? dateTime(me.reapplyAt) : "";
      const body = [h("p", {}, `Your application as ${app.roblox} was declined.`)];
      if (app.reason) body.push(h("blockquote", { class: "reason" }, app.reason));
      if (me.canReapply) body.push(h("div", { class: "cta" }, h("button", { class: "btn", type: "button", onclick: () => { S.reapply = true; rerender(); } }, "Apply again")));
      else body.push(h("p", { class: "hint" }, "You can apply again after " + when + "."));
      view.replaceChildren(head, statusCard("bad", "✕", "Not accepted this time", body));
      return;
    }

    if (me.requireRoblox && !me.roblox) {
      view.replaceChildren(head, h("div", { class: "card panel shard" },
        h("p", {}, "We ask everyone to verify their Roblox account before applying, so staff know it is really you."),
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
        if (!me.roblox && !/^[A-Za-z0-9_]{3,20}$/.test(d.roblox.trim())) return APPLY_ERRORS.invalid_roblox_name;
        if (!d.rank.trim() || !d.playtime.trim()) return "Please fill in your rank and playtime.";
      }
      if (step === 1 && (!d.gamepasses.trim() || !d.masteries.trim())) return "Please fill in gamepasses and masteries. Write \"none\" if you have none.";
      if (step === 2 && !d.spend) return "Please answer the 3B gems question.";
      return "";
    };
    const thumbs = h("div", { class: "thumbs" });
    const drawThumbs = () => thumbs.replaceChildren(...d.images.map((im, i) => h("div", { class: "thumb-item" }, h("img", { src: im.url, alt: "" }),
      h("button", { type: "button", "aria-label": "Remove screenshot", onclick: () => { URL.revokeObjectURL(im.url); d.images.splice(i, 1); drawThumbs(); } }, "×"))));
    const addFiles = async (files) => {
      for (const f of files) {
        if (d.images.length >= 5) { err.textContent = APPLY_ERRORS.too_many_images; break; }
        try { d.images.push(await shrinkImage(f)); err.textContent = ""; } catch (_) { err.textContent = APPLY_ERRORS.not_an_image; }
      }
      drawThumbs();
    };
    const dropzone = () => {
      const input = h("input", { type: "file", accept: "image/png,image/jpeg,image/webp", multiple: true, hidden: true });
      input.addEventListener("change", () => { addFiles(Array.from(input.files)); input.value = ""; });
      const zone = h("div", { class: "drop", tabindex: "0", role: "button", "aria-label": "Add screenshots" }, h("b", {}, "Add screenshots"), h("span", { class: "hint" }, "Your gamepasses, masteries and rank. Drop images here or click. Up to 5, they are shrunk automatically."), input);
      zone.addEventListener("click", () => input.click());
      zone.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
      zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("over"); });
      zone.addEventListener("dragleave", () => zone.classList.remove("over"));
      zone.addEventListener("drop", (e) => { e.preventDefault(); zone.classList.remove("over"); addFiles(Array.from(e.dataTransfer.files)); });
      return zone;
    };
    const draw = () => {
      err.textContent = "";
      const titles = ["You", "Progress", "Commitment"];
      const body = [h("ol", { class: "steps" }, titles.map((t, i) => h("li", { class: i === step ? "on" : i < step ? "done" : "" }, `${i + 1}. ${t}`))),
        h("div", { class: "who-card" }, S.me.user.avatar ? h("img", { src: S.me.user.avatar, alt: "" }) : null, h("span", {}, "Applying as ", h("b", {}, S.me.user.name)))];
      if (step === 0) body.push(
        me.roblox ? h("div", { class: "verified" }, h("span", { class: "tick" }, "✓"), h("div", {}, h("b", {}, me.roblox.name), h("small", {}, "Verified Roblox account"))) : text("roblox", "Roblox username"),
        text("rank", "Your rank", "(in-game rank)"), text("playtime", "Playtime", "(for example 120 hours)"));
      if (step === 1) { body.push(text("gamepasses", "Gamepasses", "(which ones you own)", true), text("masteries", "Masteries", "(which ones and how far)", true), h("div", { class: "field" }, h("label", {}, "Screenshots ", h("span", { class: "hint" }, "(strongly recommended)")), dropzone(), thumbs)); drawThumbs(); }
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
        const fd = new FormData();
        fd.append("data", JSON.stringify({ roblox: d.roblox.trim(), rank: d.rank.trim(), playtime: d.playtime.trim(), gamepasses: d.gamepasses.trim(), masteries: d.masteries.trim(), can_spend: d.spend === "yes", note: d.note.trim() }));
        d.images.forEach((im) => fd.append("images", im.blob, im.name));
        await api("/api/apply", { method: "POST", body: fd, timeout: 90000 });
        S.reapply = false; await refreshMe(); rerender();
      } catch (ex) {
        err.textContent = APPLY_ERRORS[ex.message] || "Something went wrong. Please try again in a minute.";
        btn.disabled = false; btn.textContent = "Send application";
      }
    });
    draw();
    view.replaceChildren(head, card);
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
  const errText = (e) => CONNECT_ERRORS[e.message] || APPLY_ERRORS[e.message] || "Something went wrong. Please try again.";
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
      parts.push(h("div", { class: "cta" }, h("a", { class: "btn", href: "#/connect" }, "Connect my account"), h("span", { class: "hint" }, `${live.connected} player${live.connected === 1 ? "" : "s"} connected`)));
      parts.push(live.events.length ? h("div", { class: "drops" }, live.events.map(dropCard)) : empty("No drops yet. They appear here as connected players find big pets."));
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
    let filter = "all", q = "", sort = "rap";
    const grid = h("div", { class: "inv-grid" });
    const draw = () => {
      let rows = items.filter((i) => (filter === "all" || (filter === "big" && i.tier) || (filter === "shiny" && /Shiny/.test(i.variant)) || (filter === "golden" && /Golden/.test(i.variant)) || (filter === "rainbow" && /Rainbow/.test(i.variant))) && (!q || i.name.toLowerCase().includes(q)));
      rows = rows.sort((a, b) => sort === "rap" ? b.rap * b.count - a.rap * a.count : sort === "exists" ? a.exists - b.exists : a.name.localeCompare(b.name));
      grid.replaceChildren(...(rows.length ? rows.map((i) => h("div", { class: "invcard panel shard" + (i.tier ? " tier-" + i.tier.toLowerCase() : "") },
        petImg(i), h("div", { class: "ic-body" }, h("b", {}, i.name), h("div", { class: "chips" }, i.tier ? chip(i.tier, "tier") : null, i.variant !== "Normal" ? chip(i.variant, "var" + vClass(i.variant)) : null, i.count > 1 ? chip("×" + exact(i.count), "mute") : null),
          h("small", {}, `RAP ${compact(i.rap)}${i.rapApprox ? "~" : ""} · Exists ${exact(i.exists)}`))
      )) : [empty("No pets match.")]));
    };
    const seg = h("div", { class: "seg" });
    [["all", "All"], ["big", "Huge and bigger"], ["shiny", "Shiny"], ["golden", "Golden"], ["rainbow", "Rainbow"]].forEach(([k, l]) => seg.append(h("button", { type: "button", "aria-pressed": String(k === filter), onclick: (e) => { filter = k; seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === e.currentTarget))); draw(); } }, l)));
    const tile = (label, v) => h("div", { class: "tile panel shard" }, h("b", {}, v), h("span", {}, label));
    view.replaceChildren(
      h("p", {}, h("a", { href: "#/live" }, "Back to live drops")),
      pageHead(d.roblox || d.discord, `Updated ${ago2(d.polled)}. Snapshot from BIG Games, RAP is cached for a few hours.`),
      h("section", { class: "tiles" }, tile("Total RAP", h("span", { title: exact(sm.totalRap) }, compact(sm.totalRap))), tile("Huge", (sm.bigs || {}).Huge || 0), tile("Titanic", (sm.bigs || {}).Titanic || 0), tile("Gargantuan", (sm.bigs || {}).Gargantuan || 0)),
      (d.equipped || []).length ? h("section", { class: "section" }, h("h2", {}, "Equipped"), h("div", { class: "equip" }, d.equipped.map((q) => petImg({ icon: q.icon, name: q.name, variant: (q.shiny ? "Shiny " : "") + (q.golden ? "Golden" : q.rainbow ? "Rainbow" : "") }, "mid")))) : null,
      h("section", { class: "section" }, h("h2", {}, "Pets"), h("div", { class: "tools" }, seg, h("input", { type: "text", placeholder: "Search a pet", oninput: (e) => { q = e.target.value.trim().toLowerCase(); draw(); } })), grid));
    draw();
  }

  /* ---------------- owner dashboard ---------------- */
  async function viewOwner() {
    loading();
    if (!S.me || !S.me.owner) { view.replaceChildren(pageHead("Owner dashboard", "Only the site owner can open this."), S.token ? empty("Your Discord account is not the owner account.") : h("button", { class: "btn", onclick: () => login() }, "Log in with Discord")); return; }
    if (S.offline) { view.replaceChildren(pageHead("Owner dashboard", ""), empty("The live server is offline.")); return; }
    const body = h("div"); let cur = S.ownerTab || "apps";
    const tabs = { apps: "Applications", sync: "Clan and Discord", content: "Website content", settings: "Settings" };
    const seg = h("div", { class: "seg", role: "tablist" });
    const show = async (k) => {
      cur = S.ownerTab = k;
      seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.k === k)));
      body.replaceChildren(h("div", { class: "loading" }, h("div", { class: "skel shard" })));
      try { body.replaceChildren(await ({ apps: ownerApps, sync: ownerSync, content: buildContentEditor, settings: ownerSettings })[k]()); }
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
          a.status === "pending" ? h("div", { class: "editor-actions" }, h("button", { class: "btn small", type: "button", onclick: () => act(true) }, "Accept"), reason, h("button", { class: "btn danger small", type: "button", onclick: () => act(false) }, "Decline")) : null));
    });
    list.append(...(rows.length ? rows : [empty("No applications yet.")]));
    return h("div", {}, h("p", { class: "hint" }, "Screenshots are attached to the application channel in Discord. You can accept or decline here or with the Discord buttons."), list);
  }

  async function ownerSync() {
    const box = h("div"), out = h("div");
    const run = async (btn) => {
      btn.disabled = true; btn.textContent = "Checking…";
      try {
        const d = await api("/api/owner/sync", { timeout: 60000 });
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
      btn.disabled = false; btn.textContent = "Run the check again";
    };
    const btn = h("button", { class: "btn", type: "button", onclick: () => run(btn) }, "Run the check");
    box.append(h("p", {}, "Compares your Roblox clan roster with the people on the Discord server. Nothing changes unless you press a button."), btn, out);
    return box;
  }

  async function ownerSettings() {
    const d = await api("/api/owner/overview"), s = d.settings;
    const gate = h("input", { type: "checkbox", checked: s.gate }), req = h("input", { type: "checkbox", checked: s.requireRoblox });
    const poll = h("input", { type: "text", value: String(s.hatchPollMinutes) }), reapply = h("input", { type: "text", value: String(s.reapplyDays) });
    const save = h("button", { class: "btn", type: "button", onclick: async () => { try { await api("/api/owner/settings", { method: "PUT", json: { gate: gate.checked, requireRoblox: req.checked, hatchPollMinutes: poll.value, reapplyDays: reapply.value } }); toast("Saved."); } catch (e) { toast("Failed: " + e.message); } } }, "Save settings");
    return h("div", { class: "stack" },
      h("div", { class: "card wide panel shard" },
        h("div", { class: "choice col" }, h("label", {}, gate, "Gate: remove people who join without an accepted application"), h("label", {}, req, "Applicants must verify their Roblox account first")),
        h("div", { class: "two" }, h("div", { class: "field" }, h("label", {}, "Minutes between inventory checks per player ", h("span", { class: "hint" }, "(10 to 240)")), poll), h("div", { class: "field" }, h("label", {}, "Days before a declined player may apply again"), reapply)), save),
      h("section", { class: "section" }, h("h2", {}, "Connected players", h("small", {}, d.connections.length + "")),
        h("p", { class: "hint" }, `${d.links} Roblox accounts linked. BIG Games connection: ${d.bigConfigured ? "switched on" : "not configured (BIG_CLIENT_ID / BIG_CLIENT_SECRET)"}. Discord channel for drops: ${d.hatchChannel ? "set" : "not set (DUX0_HATCH_CHANNEL_ID)"}.`),
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

    const ann = h("input", { type: "text", maxlength: 240, value: d.announcement || "", placeholder: "Shown as a banner on the home page. Leave empty for none.", oninput: (e) => (d.announcement = e.target.value) });
    const about = h("textarea", { maxlength: 4000, style: "min-height:9rem", oninput: (e) => (d.about = e.target.value) }, d.about || "");
    const reqs = h("textarea", { placeholder: "One requirement per line", oninput: (e) => (d.requirements = e.target.value.split("\n")) }, d.requirements.join("\n"));
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
