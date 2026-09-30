/* DUX0 League - standalone page for real PS99 League battles (v1/leagues API).
   This is deliberately separate from the main clan site (index.html/app.js):
   a League is its own PS99 feature (small teams on their own points board),
   not a clan, so it gets its own link and its own page. */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const view = $("#view");

  const S = { api: "", token: localStorage.getItem("dux0_token") || "", cfg: null, me: null };

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
  let chartId = 0;
  const SERIES_COLORS = ["#8b3dff", "#22c55e", "#f43f5e", "#eab308", "#38bdf8", "#fb923c", "#d2b0ff", "#f472b6"];

  function linesChart(series) {
    // series: [{name, color, points:[[timestamp, points], ...]}, ...] - one line per series (per member,
    // or a single aggregate series). A small colored legend is drawn above the chart when there's more than one.
    const W = 640, H = 220, pl = 58, pr = 12, pt = 12, pb = 26;
    const all = series.flatMap((s) => s.points);
    if (!all.length) return null;
    const xs = all.map((d) => d[0]), ys = all.map((d) => d[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), lo = Math.min(0, ...ys), hi = Math.max(...ys) || 1, span = hi - lo || 1;
    const X = (t) => pl + ((t - x0) / (x1 - x0 || 1)) * (W - pl - pr);
    const Y = (v) => pt + (1 - (v - lo) / span) * (H - pt - pb);
    const svg = sv("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Points over time" });
    [0, .5, 1].forEach((f) => {
      const v = hi - span * f, y = pt + f * (H - pt - pb);
      svg.append(sv("line", { x1: pl, x2: W - pr, y1: y, y2: y, stroke: "#31205a", "stroke-dasharray": "3 5" }), sv("text", { x: pl - 8, y: y + 4, "text-anchor": "end" }, compact(v)));
    });
    series.forEach((s, si) => {
      if (s.points.length < 2) return;
      const color = s.color || SERIES_COLORS[si % SERIES_COLORS.length];
      const id = "lg" + ++chartId;
      const line = s.points.map((d, i) => (i ? "L" : "M") + X(d[0]).toFixed(1) + " " + Y(d[1]).toFixed(1)).join(" ");
      if (series.length === 1) {
        const last0 = s.points[s.points.length - 1], first0 = s.points[0];
        svg.append(sv("defs", {}, sv("linearGradient", { id, x1: 0, y1: 0, x2: 0, y2: 1 }, sv("stop", { offset: "0%", "stop-color": color, "stop-opacity": .4 }), sv("stop", { offset: "100%", "stop-color": color, "stop-opacity": 0 }))));
        svg.append(sv("path", { d: `${line} L${X(last0[0])} ${H - pb} L${X(first0[0])} ${H - pb} Z`, fill: `url(#${id})` }));
      }
      svg.append(sv("path", { d: line, fill: "none", stroke: color, "stroke-width": 2.5, "stroke-linejoin": "round" }));
      s.points.forEach((d) => svg.append(sv("circle", { cx: X(d[0]), cy: Y(d[1]), r: 7, fill: "transparent", stroke: "none" }, sv("title", {}, `${s.name}, ${dateTime(d[0])}: ${exact(d[1])} points`))));
      const last = s.points[s.points.length - 1];
      svg.append(sv("circle", { cx: X(last[0]), cy: Y(last[1]), r: 4, fill: color }));
    });
    const tm = (t) => new Date(t * 1000).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    svg.append(sv("text", { x: pl, y: H - 6 }, tm(x0)), sv("text", { x: W - pr, y: H - 6, "text-anchor": "end" }, tm(x1)));
    if (series.length <= 1) return svg;
    const legend = h("div", { class: "chart-legend" }, series.map((s, si) =>
      h("span", { class: "legend-item" }, h("i", { style: `background:${s.color || SERIES_COLORS[si % SERIES_COLORS.length]}` }), s.name)));
    return h("div", {}, legend, svg);
  }

  function barsChart(members) {
    // one bar per member's points - separate from the points-over-time line chart above.
    const rows = members.filter((m) => m.inLeague && m.points != null).sort((a, b) => b.points - a.points).slice(0, 12);
    if (!rows.length) return null;
    const W = 640, rowH = 26, H = rowH * rows.length + 10, pl = 130, pr = 58, color = "#8b3dff";
    const max = Math.max(...rows.map((r) => r.points), 1);
    const svg = sv("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Points per member" });
    rows.forEach((r, i) => {
      const y = 5 + i * rowH, bw = Math.max((r.points / max) * (W - pl - pr), 2);
      svg.append(
        sv("text", { x: pl - 10, y: y + 14, "text-anchor": "end" }, r.name.length > 16 ? r.name.slice(0, 15) + "…" : r.name),
        sv("rect", { x: pl, y, width: bw, height: 16, rx: 3, fill: color }, sv("title", {}, `${r.name}: ${exact(r.points)} points`)),
        sv("text", { x: pl + bw + 8, y: y + 14 }, compact(r.points)));
    });
    return svg;
  }

  const cf = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
  const compact = (n) => cf.format(n || 0);
  const exact = (n) => new Intl.NumberFormat("en-US").format(Math.round(n || 0));
  const dateTime = (ts) => (ts ? new Date(ts * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "");
  let chatTimers = [];
  const stopChatTimers = () => { chatTimers.forEach(clearInterval); chatTimers = []; };
  const loading = () => { stopChatTimers(); view.replaceChildren(h("div", { class: "loading" }, h("div", { class: "skel shard" }), h("div", { class: "skel shard" }), h("div", { class: "skel shard" }))); };
  const pageHead = (t, sub) => h("div", { class: "page-head" }, h("h1", {}, t), sub ? h("p", {}, sub) : null);
  const empty = (msg) => h("p", { class: "empty" }, msg);

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
      const res = await fetch(S.api + path, { method: opts.method || "GET", headers, body: opts.json ? JSON.stringify(opts.json) : opts.body, signal: ctl.signal });
      let data = null;
      try { data = await res.json(); } catch (_) { /* empty */ }
      if (!res.ok) { const e = new Error((data && data.error) || "http_" + res.status); e.status = res.status; throw e; }
      return data;
    } finally { clearTimeout(timer); }
  }

  /* ---------------- account: login only, no guilds.join (never joins a server) ---------------- */
  function login() {
    if (!S.cfg || !S.cfg.clientId) { toast("The live server is offline right now."); return; }
    const st = Array.from(crypto.getRandomValues(new Uint32Array(4))).join("-");
    sessionStorage.setItem("dux0_state", st);
    sessionStorage.setItem("dux0_return", "league.html" + (location.hash || "#/"));
    const q = new URLSearchParams({ client_id: S.cfg.clientId, response_type: "code", scope: "identify guilds", redirect_uri: S.cfg.redirectUri, state: st });
    location.href = "https://discord.com/oauth2/authorize?" + q;
  }
  function logout() {
    localStorage.removeItem("dux0_token"); S.token = ""; S.me = null; renderAccount(); route();
  }
  async function refreshMe() {
    S.me = null;
    if (!S.token) return;
    try { S.me = await api("/api/league/whoami"); }
    catch (e) { if (e.status === 401) { localStorage.removeItem("dux0_token"); S.token = ""; } }
  }
  function renderAccount() {
    const box = $("#account");
    if (!box) return;
    box.replaceChildren();
    if (S.me) box.append(S.me.user.avatar ? h("img", { src: S.me.user.avatar, alt: "", width: 22, height: 22 }) : "", h("span", { class: "who" }, S.me.user.name), h("button", { class: "btn ghost small", type: "button", onclick: logout }, "Log out"));
    else if (S.token) box.append(h("button", { class: "btn ghost small", type: "button", onclick: logout }, "Log out"));
    else box.append(h("button", { class: "btn small", type: "button", onclick: login }, "Log in"));
  }

  /* ---------------- roblox verification (same code-in-profile check as the main site, kept self-contained here) ---------------- */
  function verifyBox(onDone) {
    const box = h("div", { class: "card panel shard" });
    const draw = () => {
      box.replaceChildren();
      if (S.me.roblox) { box.append(h("p", {}, `Verified as `, h("b", {}, S.me.roblox.name)), onDone ? onDone() : null); return; }
      box.append(h("h3", {}, "Verify your Roblox account"), h("p", { class: "hint" }, "Needed once, to post a league or apply. Put a short code in your Roblox profile description, then confirm here."));
      const name = h("input", { type: "text", maxlength: 20, placeholder: "Your exact Roblox username" });
      const msg = h("p", { class: "err" });
      const startBtn = h("button", { class: "btn small", type: "button" }, "Get a code");
      const pending = h("div");
      startBtn.addEventListener("click", async () => {
        msg.textContent = ""; startBtn.disabled = true;
        try {
          const r = await api("/api/roblox/start", { method: "POST", json: { username: name.value.trim() } });
          pending.replaceChildren(
            h("p", {}, `Put this code in your Roblox profile description: `, h("code", {}, r.code)),
            h("button", { class: "btn small", type: "button", onclick: async (e) => {
              e.target.disabled = true;
              try { await api("/api/roblox/verify", { method: "POST" }); S.me = await api("/api/league/whoami"); toast("Verified!"); draw(); }
              catch (er) { msg.textContent = er.message === "code_not_found" ? "Code not found in your profile yet." : "Verification failed: " + er.message; e.target.disabled = false; }
            } }, "I put the code - verify now"));
        } catch (e) {
          msg.textContent = e.message === "roblox_user_not_found" ? "No Roblox user with that exact username." : e.message === "roblox_already_linked" ? "That Roblox account is already linked to someone else." : "Something went wrong.";
        }
        startBtn.disabled = false;
      });
      box.append(h("div", { class: "editor-actions" }, name, startBtn), msg, pending);
    };
    draw();
    return box;
  }

  /* ---------------- live chat thread (polling) ---------------- */
  function chatPanel(nameLower, withUid, label, myRole) {
    const box = h("div", { class: "card panel shard chatbox" });
    const log = h("div", { class: "chatlog" });
    const input = h("input", { type: "text", maxlength: 500, placeholder: "Write a message…" });
    const send = h("button", { class: "btn small", type: "button" }, "Send");
    const fileInput = h("input", { type: "file", accept: "image/png,image/jpeg,image/webp,image/gif", hidden: true });
    const attachBtn = h("button", { class: "btn ghost small", type: "button", title: "Send an image" }, "\U0001F4F7");
    const draw = async () => {
      try {
        const q = new URLSearchParams({ name: nameLower }); if (withUid) q.set("with", withUid);
        const r = await api("/api/league/chat?" + q);
        const atBottom = log.scrollTop + log.clientHeight >= log.scrollHeight - 20;
        // compared by role (owner/applicant), not by numeric id - Discord ids are 64-bit and JS numbers lose precision past 2^53
        log.replaceChildren(...(r.messages.length ? r.messages.map((m) => h("div", { class: "chatmsg " + (m.role === myRole ? "me" : "them") },
          h("b", {}, m.name),
          m.image ? h("img", { class: "chat-image", src: S.api + m.image, alt: "" }) : null,
          m.text ? h("span", {}, m.text) : null)) : [empty("No messages yet - say hi!")]));
        if (atBottom) log.scrollTop = log.scrollHeight;
      } catch (_) { /* keep last state */ }
    };
    const sendMessage = async (extra) => {
      const q = { name: nameLower, ...extra }; if (withUid) q.with = withUid;
      await api("/api/league/chat", { method: "POST", json: q });
      await draw();
    };
    const doSend = async () => {
      const text = input.value.trim(); if (!text) return;
      send.disabled = true;
      try { await sendMessage({ text }); input.value = ""; }
      catch (e) { toast("Could not send: " + e.message); }
      send.disabled = false;
    };
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0]; if (!file) return;
      attachBtn.disabled = true;
      try {
        const fd = new FormData(); fd.append("file", file);
        const up = await api("/api/league/chat/image", { method: "POST", body: fd });
        await sendMessage({ image: up.path });
      } catch (e) { toast(e.message === "file_too_large" ? "That image is too large." : e.message === "not_an_image" ? "That file isn't an image." : "Could not send the image."); }
      attachBtn.disabled = false; fileInput.value = "";
    });
    send.addEventListener("click", doSend);
    attachBtn.addEventListener("click", () => fileInput.click());
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") doSend(); });
    box.append(h("h4", {}, label || "Live chat"), log, h("div", { class: "editor-actions" }, input, attachBtn, fileInput, send));
    draw();
    chatTimers.push(setInterval(draw, 4000));
    return box;
  }

  /* ---------------- post a league / apply to a posted league ---------------- */
  function postApplySection(detail) {
    const wrap = h("div", { class: "section" });
    if (!S.token) { wrap.append(h("h2", {}, "Post this league or apply"), h("p", { class: "hint" }, "Log in to post your own league here, or to apply to one someone else posted."), h("button", { class: "btn", type: "button", onclick: login }, "Log in with Discord")); return wrap; }
    if (!S.me) { wrap.append(empty("Loading…")); return wrap; }
    if (!S.me.roblox) { wrap.append(h("h2", {}, "Post this league or apply"), verifyBox()); return wrap; }
    const nameLower = (detail.nameLower || detail.name || "").toLowerCase();
    const isMine = detail.post && String(detail.post.ownerUid) === String(S.me.user.id);
    wrap.append(h("h2", {}, "Post this league or apply"));
    if (isMine) {
      wrap.append(h("p", {}, "You posted this league. "), h("a", { href: "#/mine" }, "Manage applications and chat"));
    } else if (detail.post) {
      wrap.append(h("p", {}, `Posted by `, h("b", {}, detail.post.ownerName), `. Apply below and chat live once you have.`));
      const already = (detail.myApplications || []).some((a) => a.nameLower === nameLower);
      if (already) {
        wrap.append(h("p", {}, "You already applied."), chatPanel(nameLower, null, "Chat with " + detail.post.ownerName, "applicant"));
      } else {
        const msg = h("textarea", { maxlength: 500, placeholder: "Say a bit about yourself (optional)", rows: 3 });
        const err = h("p", { class: "err" });
        const btn = h("button", { class: "btn", type: "button" }, "Apply");
        btn.addEventListener("click", async () => {
          btn.disabled = true; err.textContent = "";
          try { await api("/api/league/apply", { method: "POST", json: { name: nameLower, message: msg.value.trim() } }); toast("Application sent!"); location.hash = "#/l/" + encodeURIComponent(detail.name); location.reload(); }
          catch (e) { err.textContent = e.message === "already_applied" ? "You already applied." : e.message === "own_league" ? "You posted this league yourself." : "Something went wrong."; btn.disabled = false; }
        });
        wrap.append(msg, h("div", { class: "editor-actions" }, btn), err);
      }
    } else {
      wrap.append(h("p", { class: "hint" }, "Nobody has posted this league yet. If it's yours, post it so people can apply."));
      const btn = h("button", { class: "btn", type: "button" }, "This is my league - post it");
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try { await api("/api/league/post", { method: "POST", json: { name: detail.name } }); toast("Posted! Applications will show up under “My league”."); location.hash = "#/mine"; }
        catch (e) { toast(e.message === "already_posted_by_someone_else" ? "Someone else already posted this league." : "Failed: " + e.message); btn.disabled = false; }
      });
      wrap.append(btn);
    }
    return wrap;
  }

  async function viewMine() {
    loading();
    if (!S.token) { view.replaceChildren(pageHead("My league", ""), h("button", { class: "btn", type: "button", onclick: login }, "Log in with Discord")); return; }
    if (!S.me) await refreshMe();
    if (!S.me) { view.replaceChildren(pageHead("My league", ""), empty("The live server is offline right now.")); return; }
    if (!S.me.roblox) { view.replaceChildren(pageHead("My league", "Verify your Roblox account to post a league or see your applications.")); view.append(verifyBox(() => viewMine())); return; }
    let d;
    try { d = await api("/api/league/mine"); } catch (e) { view.replaceChildren(pageHead("My league", ""), empty("The live server is offline right now.")); return; }
    const sections = [pageHead("My league", "Your posted leagues and their applications, plus any leagues you applied to.")];
    const posts = d.posts && d.posts.length ? d.posts : (d.post ? [{ post: d.post, applications: d.applications }] : []);
    if (posts.length) {
      for (const entry of posts) {
        const p = entry.post;
        const removeBtn = h("button", { class: "btn danger small", type: "button" }, "Remove this post");
        removeBtn.addEventListener("click", async () => {
          if (!confirm(`Remove "${p.name}"? This deletes all its applications and chats too.`)) return;
          removeBtn.disabled = true;
          try { await api("/api/league/unpost", { method: "POST", json: { name: p.nameLower } }); toast("Removed."); viewMine(); }
          catch (e) { toast("Failed: " + e.message); removeBtn.disabled = false; }
        });
        sections.push(h("section", { class: "section" }, h("h2", {}, p.name, h("small", {}, `posted ${dateTime(p.created)}`)),
          h("div", { class: "editor-actions" }, h("a", { href: "#/l/" + encodeURIComponent(p.name) }, "Open the league page"), removeBtn),
          h("h3", {}, `Applications (${entry.applications.length})`),
          entry.applications.length ? h("div", { class: "hist panel shard" }, entry.applications.map((a) =>
            h("details", { class: "app-row" },
              h("summary", {}, h("b", {}, a.name), h("small", {}, `Roblox: ${a.roblox || "-"} · ${dateTime(a.created)}`)),
              h("div", { class: "app-body" }, a.message ? h("p", {}, a.message) : null, chatPanel(p.nameLower, a.uid, "Chat with " + a.name, "owner"))))) : empty("No applications yet.")));
      }
    } else {
      sections.push(h("section", { class: "section" }, h("h3", {}, "You haven't posted a league yet."), h("p", { class: "hint" }, "Open any league page and use “This is my league - post it”.")));
    }
    if (d.myApplications.length) {
      sections.push(h("section", { class: "section" }, h("h2", {}, "Leagues you applied to"),
        h("div", { class: "hist panel shard" }, d.myApplications.map((a) =>
          h("details", { class: "app-row" },
            h("summary", {}, h("b", {}, a.leagueName), h("small", {}, dateTime(a.created))),
            h("div", { class: "app-body" }, chatPanel(a.nameLower, null, "Chat about " + a.leagueName, "applicant")))))));
    }
    view.replaceChildren(...sections);
  }

  /* ---------------- browse: best leagues + search ---------------- */
  function leagueCard(row, rank) {
    return h("a", { class: "panel shard league-card league-link", href: "#/l/" + encodeURIComponent(row.Name) },
      h("span", { class: "league-rank" }, "#" + rank),
      row.icon ? h("img", { class: "league-icon", src: row.icon, alt: "" }) : h("span", { class: "league-icon" }),
      h("div", { class: "league-body" },
        h("h3", {}, row.Name, row.tracked ? h("span", { class: "tag" }, "tracked") : null),
        h("div", { class: "nums" },
          h("div", {}, h("b", {}, compact(row.Points)), h("small", {}, "Points")),
          h("div", {}, h("b", {}, row.Members + (row.MemberCapacity ? "/" + row.MemberCapacity : "")), h("small", {}, "Members")),
          h("div", {}, h("b", {}, "Lv " + (row.Level ?? "-")), h("small", {}, "Level")))));
  }

  async function viewBrowse(params) {
    loading();
    const search = params.get("q") || "";
    const sort = params.get("sort") || "Points";
    let data = { leagues: [], total: 0, page: 1, pageSize: 25 };
    let failed = false;
    try { data = await api("/api/league?" + new URLSearchParams({ search, sort, sortOrder: "desc", pageSize: "50" })); }
    catch (_) { failed = true; }

    const q = h("input", { type: "text", value: search, maxlength: 64, placeholder: "Search a league by name" });
    q.addEventListener("keydown", (e) => { if (e.key === "Enter") go({ q: q.value.trim() }); });
    const goBtn = h("button", { class: "btn", type: "button", onclick: () => go({ q: q.value.trim() }) }, "Search");
    const sortSeg = h("div", { class: "seg" });
    [["Points", "Best points"], ["Members", "Most members"], ["Created", "Newest"], ["Name", "Name"]].forEach(([k, l]) =>
      sortSeg.append(h("button", { type: "button", "aria-pressed": String(k === sort), onclick: () => go({ sort: k }) }, l)));

    const grid = failed
      ? empty("The live server is offline right now, so leagues can't be loaded.")
      : h("div", { class: "league-grid" }, data.leagues.length ? data.leagues.map((r, i) => leagueCard(r, i + 1)) : [empty(search ? "No league found with that name." : "No leagues yet.")]);

    const name = h("input", { type: "text", maxlength: 64, placeholder: "Exact league name" });
    const msg = h("p", { class: "err" });
    const submitBtn = h("button", { class: "btn", type: "button" }, "Track this league");
    submitBtn.addEventListener("click", async () => {
      msg.textContent = ""; submitBtn.disabled = true;
      try {
        const r = await api("/api/league/submit", { method: "POST", json: { name: name.value.trim() } });
        toast(r.already ? `${r.name} is already tracked.` : `Now tracking ${r.name}.`);
        name.value = ""; go({});
      } catch (e) {
        msg.textContent = e.message === "league_not_found" ? "PS99 doesn't know a league with that exact name." : e.message === "invalid_input" ? "Enter a league name." : "Something went wrong. Please try again.";
      }
      submitBtn.disabled = false;
    });

    view.replaceChildren(
      pageHead("League battles", "Real PS99 League battles - small teams competing on their own points leaderboard. This is separate from the DUX0 clan. Anyone can add a league here so DUX0 tracks its rank, points, members and points per hour over time."),
      h("div", { class: "tools" }, q, goBtn, sortSeg),
      grid,
      h("section", { class: "section card panel shard" },
        h("h3", {}, "Track a new league"),
        h("p", { class: "hint" }, "Type the exact league name. It's open to everyone - no login needed."),
        h("div", { class: "editor-actions" }, name, submitBtn), msg));
  }

  /* ---------------- detail: one league, roster + points/hour ---------------- */
  function memberRow(m) {
    return h("div", { class: "clanrow" + (m.inLeague ? "" : " out") },
      h("div", { class: "who" }, h("b", {}, m.name, m.isOwner ? h("span", { class: "tag gold" }, "owner") : null),
        h("small", {}, m.inLeague ? "in the league" : "left " + (m.leftAt ? dateTime(m.leftAt) : "recently"))),
      h("span"),
      h("div", {}, m.points != null ? h("b", { class: "pts" }, compact(m.points)) : null));
  }

  function gainsPanel(gains) {
    const windows = [["1", "1 Hour"], ["6", "6 Hours"], ["12", "12 Hours"], ["24", "24 Hours"]];
    const have = windows.filter(([k]) => gains[k] != null);
    if (!have.length) return empty("Not enough tracking data yet.");
    const max = Math.max(...have.map(([k]) => Math.abs(gains[k])), 1);
    return h("div", { class: "gains" }, have.map(([k, label]) => {
      const v = gains[k], pos = v >= 0;
      return h("div", { class: "gain-row" },
        h("span", { class: "gain-label" }, label),
        h("div", { class: "gain-bar-track" }, h("div", { class: "gain-bar", style: `width:${Math.max(Math.abs(v) / max * 100, 3)}%;background:${pos ? "#22c55e" : "#f43f5e"}` })),
        h("span", { class: "gain-val", style: `color:${pos ? "#22c55e" : "#f43f5e"}` }, (pos ? "+" : "") + compact(v)));
    }));
  }

  function gapPanel(gap, myPoints, pph) {
    const etaText = (diff) => {
      if (!pph || pph <= 0) return "";
      const hrs = diff / pph;
      return ` · ~${hrs < 1 ? Math.round(hrs * 60) + "m" : hrs.toFixed(1) + "h"} at current rates`;
    };
    const cells = [];
    if (gap.above) {
      const diff = Math.max(gap.above.points - myPoints, 0);
      cells.push(h("div", { class: "gap-cell panel shard" },
        h("div", { class: "hint" }, `To pass ${gap.above.name}`),
        h("b", { style: "color:#22c55e" }, "+" + compact(diff) + " pts"),
        h("small", {}, etaText(diff))));
    }
    if (gap.below) {
      const diff = Math.max(myPoints - gap.below.points, 0);
      cells.push(h("div", { class: "gap-cell panel shard" },
        h("div", { class: "hint" }, `To be passed by ${gap.below.name}`),
        h("b", { style: "color:#f2c14e" }, compact(diff) + " pts ahead")));
    }
    return cells.length ? h("div", { class: "gap-grid" }, cells) : empty("No leagues within reach right now.");
  }

  async function viewDetail(name) {
    loading();
    let d;
    try { d = await api("/api/league/" + encodeURIComponent(name)); }
    catch (e) { view.replaceChildren(pageHead(name, ""), empty(e.message === "league_not_found" ? "No league with that exact name was found." : "The live server is offline right now.")); return; }
    d.myApplications = [];
    if (S.token && S.me && S.me.roblox) {
      try { const mine = await api("/api/league/mine"); d.myApplications = mine.myApplications; } catch (_) { /* ignore */ }
    }

    const inCount = d.members.filter((m) => m.inLeague).length;
    const bars = barsChart(d.members);
    const memberSeries = d.members.filter((m) => m.inLeague && m.pointsHistory && m.pointsHistory.length >= 2)
      .sort((a, b) => (b.points || 0) - (a.points || 0)).slice(0, 8)
      .map((m, i) => ({ name: m.name, color: SERIES_COLORS[i % SERIES_COLORS.length], points: m.pointsHistory }));
    const tile = (label, v) => h("div", { class: "tile panel shard" }, h("b", {}, v), h("span", {}, label));
    const avgPerMember = inCount ? Math.round((d.points || 0) / inCount) : 0;

    view.replaceChildren(
      h("p", {}, h("a", { href: "#/" }, "Back to all leagues")),
      pageHead(d.name, `Level ${d.level ?? "-"} · Owner: ${(d.owner || {}).DisplayName || "-"}${d.created ? " · created " + dateTime(d.created) : ""}`),
      h("section", { class: "tiles" },
        tile("Rank", d.rank ? "#" + d.rank : "1000+"),
        tile("Points", h("span", { title: exact(d.points) }, compact(d.points))),
        tile("Pts/Hour", d.pointsPerHour != null ? (d.pointsPerHour >= 0 ? "+" : "") + compact(d.pointsPerHour) : "-"),
        tile("Avg/Member", compact(avgPerMember)),
        tile("Members", inCount + (d.memberCapacity ? "/" + d.memberCapacity : ""))),
      h("section", { class: "grid2" },
        h("div", { class: "panel shard card" }, h("h3", {}, "Point gains"), gainsPanel(d.gains || {})),
        h("div", { class: "panel shard card" }, h("h3", {}, "Point gap"), gapPanel(d.gap || {}, d.points || 0, d.pointsPerHour))),
      h("section", { class: "section" }, h("h2", {}, "Member points"),
        bars ? h("div", { class: "panel shard chart bars" }, bars) : empty("No per-member points yet.")),
      h("section", { class: "section" }, h("h2", {}, "Points over time, per member"),
        memberSeries.length
          ? h("div", { class: "panel shard chart" }, linesChart(memberSeries))
          : empty("Not enough tracking data yet - DUX0 checks this league every few minutes, so lines will build up over the next couple of hours.")),
      h("section", { class: "section" }, h("h2", {}, "Roster", h("small", {}, `${inCount} in the league, ${d.members.length - inCount} left since tracking began`)),
        d.members.length ? h("div", { class: "hist panel shard" }, d.members.map(memberRow)) : empty("No roster history yet - check back after the next update.")),
      d.pointContributions.length ? h("section", { class: "section" }, h("h2", {}, "Top point contributions"),
        h("div", { class: "hist panel shard" }, d.pointContributions.slice(0, 15).map((c) => h("div", { class: "clanrow" }, h("div", { class: "who" }, h("b", {}, c.DisplayName)), h("span"), h("div", {}, h("b", { class: "pts" }, compact(c.Points))))))) : null,
      postApplySection(d));
  }

  /* ---------------- posted leagues: the ones someone claimed + you can apply to ---------------- */
  async function viewPosted() {
    loading();
    let d;
    try { d = await api("/api/league/posts"); }
    catch (e) { view.replaceChildren(pageHead("Posted leagues", ""), empty("The live server is offline right now.")); return; }
    const rows = d.posts.map((p) => h("a", { class: "panel shard league-card league-link", href: "#/l/" + encodeURIComponent(p.name) },
      h("span", { class: "league-icon" }),
      h("div", { class: "league-body" },
        h("h3", {}, p.name),
        h("div", { class: "nums" }, h("div", {}, h("b", {}, p.ownerName), h("small", {}, "posted by"))),
        h("small", {}, "posted " + dateTime(p.created)))));
    view.replaceChildren(
      pageHead("Posted leagues", "Leagues someone has posted here - open one to see its stats and apply to join."),
      rows.length ? h("div", { class: "league-grid" }, rows) : empty("Nobody has posted a league yet. Open any league page and use “This is my league - post it”."));
  }

  /* ---------------- routing (own tiny hash router, separate from the main site) ---------------- */
  function go(patch) {
    const cur = new URLSearchParams(location.hash.includes("?") ? location.hash.split("?")[1] : "");
    Object.entries(patch).forEach(([k, v]) => { if (v) cur.set(k, v); else cur.delete(k); });
    const qs = cur.toString();
    location.hash = "#/" + (qs ? "?" + qs : "");
  }

  async function route() {
    const raw = location.hash.replace(/^#\/?/, "");
    const [path, qs] = raw.split("?");
    const params = new URLSearchParams(qs || "");
    const parts = path.split("/").filter(Boolean);
    if (parts[0] === "l" && parts[1]) await viewDetail(decodeURIComponent(parts[1]));
    else if (parts[0] === "mine") await viewMine();
    else if (parts[0] === "posted") await viewPosted();
    else await viewBrowse(params);
    window.scrollTo(0, 0);
  }

  async function boot() {
    try { const cfg = await (await fetch("config.json?t=" + Date.now())).json(); S.api = (cfg.api || "").replace(/\/$/, ""); } catch (_) { /* none */ }
    if (S.api) { try { S.cfg = await api("/api/config"); } catch (_) { /* offline */ } }
    await refreshMe();
    renderAccount();
    addEventListener("hashchange", route);
    route();
  }

  boot();
})();
