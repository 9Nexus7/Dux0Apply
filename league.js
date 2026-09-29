/* DUX0 League - standalone page for real PS99 League battles (v1/leagues API).
   This is deliberately separate from the main clan site (index.html/app.js):
   a League is its own PS99 feature (small teams on their own points board),
   not a clan, so it gets its own link and its own page. */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const view = $("#view");

  const S = { api: "", token: localStorage.getItem("dux0_token") || "" };

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

  const cf = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
  const compact = (n) => cf.format(n || 0);
  const exact = (n) => new Intl.NumberFormat("en-US").format(Math.round(n || 0));
  const dateTime = (ts) => (ts ? new Date(ts * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "");
  const loading = () => view.replaceChildren(h("div", { class: "loading" }, h("div", { class: "skel shard" }), h("div", { class: "skel shard" }), h("div", { class: "skel shard" })));
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
      h("div", { class: "who" }, h("b", {}, m.name), h("small", {}, m.inLeague ? "in the league" : "left " + (m.leftAt ? dateTime(m.leftAt) : "recently"))),
      h("span"),
      h("div", {}, m.points != null ? h("b", { class: "pts" }, compact(m.points)) : null));
  }

  async function viewDetail(name) {
    loading();
    let d;
    try { d = await api("/api/league/" + encodeURIComponent(name)); }
    catch (e) { view.replaceChildren(pageHead(name, ""), empty(e.message === "league_not_found" ? "No league with that exact name was found." : "The live server is offline right now.")); return; }

    const inCount = d.members.filter((m) => m.inLeague).length;
    const tile = (label, v) => h("div", { class: "tile panel shard" }, h("b", {}, v), h("span", {}, label));
    view.replaceChildren(
      h("p", {}, h("a", { href: "#/" }, "Back to all leagues")),
      pageHead(d.name, `Level ${d.level ?? "-"} · Owner: ${(d.owner || {}).DisplayName || "-"}${d.created ? " · created " + dateTime(d.created) : ""}`),
      h("section", { class: "tiles" },
        tile("Points", h("span", { title: exact(d.points) }, compact(d.points))),
        tile("Members", inCount + (d.memberCapacity ? "/" + d.memberCapacity : "")),
        d.pointsPerHour != null ? tile("Points/hour", (d.pointsPerHour >= 0 ? "+" : "") + compact(d.pointsPerHour)) : tile("Points/hour", "-"),
        tile("Tracked", d.tracked ? "Yes" : "No")),
      h("section", { class: "section" }, h("h2", {}, "Roster", h("small", {}, `${inCount} in the league, ${d.members.length - inCount} left since tracking began`)),
        d.members.length ? h("div", { class: "hist panel shard" }, d.members.map(memberRow)) : empty("No roster history yet - check back after the next update.")),
      d.pointContributions.length ? h("section", { class: "section" }, h("h2", {}, "Top point contributions"),
        h("div", { class: "hist panel shard" }, d.pointContributions.slice(0, 15).map((c) => h("div", { class: "clanrow" }, h("div", { class: "who" }, h("b", {}, c.DisplayName)), h("span"), h("div", {}, h("b", { class: "pts" }, compact(c.Points))))))) : null);
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
    else await viewBrowse(params);
    window.scrollTo(0, 0);
  }

  async function boot() {
    try { const cfg = await (await fetch("config.json?t=" + Date.now())).json(); S.api = (cfg.api || "").replace(/\/$/, ""); } catch (_) { /* none */ }
    addEventListener("hashchange", route);
    route();
  }

  boot();
})();
