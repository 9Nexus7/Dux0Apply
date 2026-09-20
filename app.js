/* DUX0 clan website – no build step, no dependencies. */
(() => {
  "use strict";

  const BASE = location.origin + location.pathname.replace(/[^/]*$/, "");
  const $ = (s) => document.querySelector(s);
  const view = $("#view");

  const state = {
    api: "",            // address of the bot API (from config.json)
    cfg: null,          // /api/config
    token: localStorage.getItem("dux0_token") || "",
    me: null,           // /api/me
    offline: false,
    cache: {},
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
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(kid));
    }
    return el;
  }

  const fmt = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 2 });
  const num = (n) => fmt.format(n || 0);

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove("show"), 3500);
  }

  async function api(path, opts = {}) {
    if (!state.api) throw new Error("offline");
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), opts.timeout || 9000);
    try {
      const headers = { ...(opts.headers || {}) };
      if (state.token) headers.Authorization = "Bearer " + state.token;
      if (opts.json) { headers["Content-Type"] = "application/json"; }
      const res = await fetch(state.api + path, {
        method: opts.method || "GET",
        headers,
        body: opts.json ? JSON.stringify(opts.json) : opts.body,
        signal: ctl.signal,
      });
      let data = null;
      try { data = await res.json(); } catch (_) { /* no body */ }
      if (!res.ok) {
        const err = new Error((data && data.error) || "http_" + res.status);
        err.status = res.status;
        throw err;
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  async function snapshot(name) {
    const r = await fetch(`data/${name}.json?t=${Date.now()}`);
    if (!r.ok) throw new Error("no_snapshot");
    return r.json();
  }

  async function load(kind) {
    const c = state.cache[kind];
    if (c && Date.now() - c.t < 30000) return c.v;
    let v;
    try {
      v = await api(kind === "clan" ? "/api/clan" : "/api/content");
      if (kind === "clan" && !v.ok) throw new Error("clan_unavailable");
    } catch (e) {
      state.offline = true;
      v = await snapshot(kind === "clan" ? "clan" : "content").catch(() => null);
    }
    showNotice();
    state.cache[kind] = { t: Date.now(), v };
    return v;
  }

  function showNotice() {
    const n = $("#notice");
    n.hidden = !state.offline;
    n.textContent = "The live server is offline right now. You are seeing the latest saved data. Applying and editing need the live server.";
  }

  function imgSrc(p) {
    if (!p) return "";
    if (p.startsWith("/uploads/")) return (state.api || "") + p;
    return p;
  }
  function picture(p, alt, cls) {
    const img = h("img", { src: imgSrc(p), alt: alt || "", loading: "lazy", class: cls || "" });
    if (p && p.startsWith("/uploads/")) {
      // fallback: the repo copy of the same file (used when the live server is off)
      img.addEventListener("error", () => {
        const alt2 = BASE + p.slice(1);
        if (img.src !== alt2) img.src = alt2;
      }, { once: true });
    }
    img.addEventListener("click", () => openLightbox(img.src, alt));
    return img;
  }
  function openLightbox(src, alt) {
    const lb = $("#lightbox");
    lb.querySelector("img").src = src;
    lb.querySelector("img").alt = alt || "";
    lb.hidden = false;
  }
  $("#lightbox").addEventListener("click", () => { $("#lightbox").hidden = true; });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("#lightbox").hidden = true; });

  /* ------------------------------------------------------------------ */
  /* account                                                             */
  /* ------------------------------------------------------------------ */
  function login() {
    if (!state.cfg || !state.cfg.clientId) {
      toast("Login is not available while the live server is offline.");
      return;
    }
    const st = crypto.getRandomValues(new Uint32Array(4)).join("-");
    sessionStorage.setItem("dux0_state", st);
    sessionStorage.setItem("dux0_return", location.hash || "#/");
    const q = new URLSearchParams({
      client_id: state.cfg.clientId,
      response_type: "code",
      scope: "identify",
      redirect_uri: state.cfg.redirectUri,
      state: st,
    });
    location.href = "https://discord.com/oauth2/authorize?" + q;
  }

  function logout() {
    localStorage.removeItem("dux0_token");
    state.token = ""; state.me = null;
    renderAccount(); route();
  }

  async function refreshMe() {
    state.me = null;
    if (!state.token) return;
    try {
      state.me = await api("/api/me");
    } catch (e) {
      if (e.status === 401) { localStorage.removeItem("dux0_token"); state.token = ""; }
    }
  }

  function renderAccount() {
    const box = $("#account");
    box.replaceChildren();
    if (state.me) {
      box.append(
        state.me.user.avatar ? h("img", { src: state.me.user.avatar, alt: "" }) : "",
        h("span", { class: "who" }, state.me.user.name),
        h("button", { class: "btn ghost small", onclick: logout }, "Log out")
      );
    } else if (state.token) {
      box.append(h("button", { class: "btn ghost small", onclick: logout }, "Log out"));
    } else {
      box.append(h("button", { class: "btn small", onclick: login }, "Log in with Discord"));
    }
    $("#admin-link").hidden = !(state.me && state.me.admin);
  }

  /* ------------------------------------------------------------------ */
  /* views                                                               */
  /* ------------------------------------------------------------------ */
  const loading = () => view.replaceChildren(h("p", { class: "loading" }, "Loading…"));

  async function viewHome() {
    loading();
    const [clan, content] = await Promise.all([load("clan"), load("content")]);
    const c = content || {};
    const t = (clan && clan.totals) || {};
    const invite = c.invite || (state.cfg && state.cfg.invite) || "https://discord.gg/dux0";

    const stat = (value, label) => h("div", { class: "stat" }, h("b", {}, value), h("span", {}, label));
    const cap = clan && clan.capacity ? `${t.members}/${clan.capacity}` : (t.members ?? "–");

    const top = ((clan && clan.members) || []).slice(0, 5);

    view.replaceChildren(
      h("section", { class: "hero" },
        h("img", { src: "assets/banner.png", alt: "DUX0 – United as one. Built to win." })),
      h("section", { class: "stats", "aria-label": "Live clan numbers" },
        stat(clan && clan.rank ? "#" + clan.rank : "–", "Global clan rank"),
        stat(cap, "Members"),
        stat(num(t.points), "Total points"),
        stat(num(t.gems), "Total gems")),
      h("div", { class: "split" },
        h("section", {},
          h("h2", {}, "About DUX0"),
          h("p", { class: "about-text" }, c.about || ""),
          h("div", { class: "cta" },
            h("a", { class: "btn", href: "#/apply" }, "Apply to join"),
            h("a", { class: "btn ghost", href: invite, target: "_blank", rel: "noopener" }, "Join the Discord"))),
        (c.requirements && c.requirements.length)
          ? h("section", {}, h("h3", {}, "What we look for"),
              h("ul", { class: "reqs" }, c.requirements.map((r) => h("li", {}, r))))
          : null),
      top.length ? h("section", { class: "section" },
        h("h2", {}, "Top contributors"),
        h("ol", { class: "ledger" }, top.map((m) => memberRow(m, "points", top[0].points, false))),
        h("p", {}, h("a", { href: "#/members" }, "See all members"))) : null
    );
  }

  function memberRow(m, sortBy, max, showOther = true) {
    const main = sortBy === "points" ? m.points : m.gems;
    const other = sortBy === "points" ? m.gems : m.points;
    const place = sortBy === "points" ? m.pointsRank : m.gemsRank;
    const pct = max ? Math.max(2, Math.round((main / max) * 100)) : 0;
    return h("li", { class: "row p" + (place <= 3 ? place : "x") + (showOther ? "" : " one") },
      h("span", { class: "place" }, "#" + place),
      m.avatar ? h("img", { class: "av", src: m.avatar, alt: "", loading: "lazy" }) : h("span", { class: "av" }),
      h("div", { class: "who" },
        h("b", {}, m.display || m.name, m.role !== "Member" ? h("span", { class: "tag" }, m.role) : null),
        h("small", {}, "@" + m.name)),
      h("div", { class: "bar", title: sortBy }, h("i", { style: `width:${pct}%` })),
      h("div", { class: "val" }, h("b", {}, num(main)), h("small", {}, sortBy === "points" ? "points" : "gems")),
      showOther ? h("div", { class: "val dim" }, h("b", {}, num(other)), h("small", {}, sortBy === "points" ? "gems" : "points")) : null);
  }

  async function viewMembers() {
    loading();
    const clan = await load("clan");
    const members = (clan && clan.members) || [];
    if (!members.length) {
      view.replaceChildren(pageHead("Members", "Every DUX0 member ranked by points and gems."),
        h("p", { class: "empty" }, "Member data is not available yet. Try again in a minute."));
      return;
    }
    let sortBy = "points", q = "";
    const list = h("ol", { class: "ledger" });
    const draw = () => {
      const max = Math.max(...members.map((m) => m[sortBy]), 1);
      const rows = [...members]
        .sort((a, b) => (sortBy === "points" ? a.pointsRank - b.pointsRank : a.gemsRank - b.gemsRank))
        .filter((m) => !q || (m.name + " " + m.display).toLowerCase().includes(q));
      list.replaceChildren(...(rows.length ? rows.map((m) => memberRow(m, sortBy, max)) :
        [h("li", { class: "empty" }, "No member matches that name.")]));
    };
    const seg = h("div", { class: "seg", role: "group", "aria-label": "Sort by" });
    for (const [key, label] of [["points", "Points"], ["gems", "Gems"]]) {
      seg.append(h("button", { type: "button", "aria-pressed": key === sortBy ? "true" : "false",
        onclick: (e) => {
          sortBy = key;
          seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b === e.currentTarget ? "true" : "false"));
          draw();
        } }, label));
    }
    const search = h("input", { type: "text", placeholder: "Search a member", "aria-label": "Search a member",
      oninput: (e) => { q = e.target.value.trim().toLowerCase(); draw(); } });
    view.replaceChildren(
      pageHead("Members", `${members.length} players. Points are earned in clan battles, gems are what each member has put into the clan.`),
      h("div", { class: "tools" }, seg, search), list);
    draw();
  }

  async function viewBattles() {
    loading();
    const clan = await load("clan");
    const battles = (clan && clan.battles) || [];
    const md = (clan && clan.medals) || {};
    view.replaceChildren(
      pageHead("Clan battles", "How DUX0 has done in clan battles."),
      h("div", { class: "medals" },
        h("div", { class: "medal gold" }, h("b", {}, md.gold || 0), h("span", {}, "Gold medals")),
        h("div", { class: "medal silver" }, h("b", {}, md.silver || 0), h("span", {}, "Silver medals")),
        h("div", { class: "medal bronze" }, h("b", {}, md.bronze || 0), h("span", {}, "Bronze medals"))),
      battles.length
        ? h("div", {}, [...battles].reverse().map((b) => h("div", { class: "battle" },
            h("span", { class: "name" }, b.name),
            h("span", { class: "pts" }, num(b.points) + " pts"),
            h("span", { class: "pl" }, b.place ? "Place #" + b.place : ""))))
        : h("p", { class: "empty" }, "No battle results yet."));
  }

  async function viewAchievements() {
    loading();
    const c = (await load("content")) || {};
    const ach = c.achievements || [], gal = c.gallery || [];
    view.replaceChildren(
      pageHead("Achievements", "What DUX0 has won together."),
      ach.length
        ? h("div", { class: "grid" }, ach.map((a) => h("article", { class: "ach" },
            a.image ? picture(a.image, a.title, "pic") : h("div", { class: "pic none" }, "No image"),
            h("div", { class: "txt" },
              h("h3", {}, a.title),
              a.date ? h("div", { class: "date" }, a.date) : null,
              a.desc ? h("p", {}, a.desc) : null))))
        : h("p", { class: "empty" }, "No achievements added yet."),
      gal.length ? h("section", { class: "section" }, h("h2", {}, "Clan gallery"),
        h("div", { class: "masonry" }, gal.map((g) => h("figure", {}, picture(g.image, g.caption),
          g.caption ? h("figcaption", {}, g.caption) : null)))) : null);
  }

  const APPLY_ERRORS = {
    login_required: "Please log in with Discord first.",
    invalid_roblox_name: "That Roblox username does not look right. Use 3 to 20 letters, numbers or underscores.",
    missing_fields: "Please fill in rank, playtime, gamepasses and masteries.",
    slow_down: "Please wait a few seconds before sending again.",
    join_server_first: "You need to be in the DUX0 Discord server first. Join it, then send your application again.",
    already_member: "You already have the DUX0 member role.",
    already_pending: "You already have an application waiting for a decision.",
    bot_not_ready: "The bot is starting up. Try again in a minute.",
    offline: "The live server is offline, so applications cannot be sent right now.",
  };

  async function viewApply() {
    loading();
    await load("content");
    const invite = (state.cache.content && state.cache.content.v && state.cache.content.v.invite) || "https://discord.gg/dux0";
    const head = pageHead("Apply to DUX0", "Log in with Discord, fill in the form, and our staff will review it in the Discord server. You get a DM with the decision.");

    if (state.offline) {
      view.replaceChildren(head, h("p", { class: "empty" }, APPLY_ERRORS.offline));
      return;
    }
    if (!state.token || !state.me) {
      view.replaceChildren(head, h("div", { class: "card" },
        h("p", {}, "We need your Discord account so the bot can give you your role and message you the result. We only read your Discord name and ID."),
        h("button", { class: "btn", onclick: login }, "Log in with Discord")));
      return;
    }
    if (!state.me.inServer) {
      view.replaceChildren(head, h("div", { class: "card" },
        h("p", {}, "You are not in the DUX0 Discord server yet. Join first, then come back and apply."),
        h("a", { class: "btn", href: invite, target: "_blank", rel: "noopener" }, "Join the Discord")));
      return;
    }
    if (state.me.pending) {
      view.replaceChildren(head, h("div", { class: "ok-box" }, "Your application is in. Staff will review it in the Discord server and message you with the result."));
      return;
    }

    const err = h("p", { class: "err", role: "alert" });
    const f = {};
    const text = (id, label, hint, tag = "input") => {
      f[id] = tag === "input" ? h("input", { type: "text", id, maxlength: 100, required: true }) : h("textarea", { id, maxlength: 500, required: true });
      return h("div", { class: "field" }, h("label", { for: id }, label, hint ? h("span", { class: "hint" }, " " + hint) : null), f[id]);
    };
    f.roblox = h("input", { type: "text", id: "roblox", maxlength: 20, required: true, autocomplete: "off" });
    f.note = h("textarea", { id: "note", maxlength: 800 });
    const submit = h("button", { class: "btn", type: "submit" }, "Send application");

    const form = h("form", { class: "card", novalidate: true },
      h("div", { class: "field" }, h("label", { for: "roblox" }, "Roblox username"), f.roblox),
      text("rank", "Your rank", "(in-game rank)"),
      text("playtime", "Playtime", "(for example: 120 hours)"),
      text("gamepasses", "Gamepasses", "(which ones you own)", "textarea"),
      text("masteries", "Masteries", "(which ones and how far)", "textarea"),
      h("div", { class: "field" },
        h("label", {}, "Can you spend 3B gems in a clan battle when required?"),
        h("div", { class: "choice" },
          h("label", {}, h("input", { type: "radio", name: "spend", value: "yes", required: true }), "Yes"),
          h("label", {}, h("input", { type: "radio", name: "spend", value: "no" }), "No"))),
      h("div", { class: "field" }, h("label", { for: "note" }, "Anything else we should know ", h("span", { class: "hint" }, "(optional)")), f.note),
      submit, err);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      err.textContent = "";
      const spend = form.querySelector("input[name=spend]:checked");
      if (!spend) { err.textContent = "Please answer the 3B gems question."; return; }
      submit.disabled = true; submit.textContent = "Sending…";
      try {
        await api("/api/apply", { method: "POST", json: {
          roblox: f.roblox.value.trim(), rank: f.rank.value.trim(), playtime: f.playtime.value.trim(),
          gamepasses: f.gamepasses.value.trim(), masteries: f.masteries.value.trim(),
          can_spend: spend.value === "yes", note: f.note.value.trim() } });
        state.me.pending = true;
        view.replaceChildren(head, h("div", { class: "ok-box" }, "Application sent. Staff will review it in the Discord server and message you with the result."));
      } catch (ex) {
        err.textContent = APPLY_ERRORS[ex.message] || "Something went wrong. Please try again in a minute.";
        submit.disabled = false; submit.textContent = "Send application";
      }
    });
    view.replaceChildren(head, form);
  }

  /* ---------------- admin ---------------- */
  async function uploadImage(file) {
    const fd = new FormData();
    fd.append("file", file);
    const r = await api("/api/upload", { method: "POST", body: fd, timeout: 60000 });
    return r.path;
  }

  async function viewAdmin() {
    loading();
    if (!state.me || !state.me.admin) {
      view.replaceChildren(pageHead("Admin", "Only clan staff can edit the website."),
        state.token ? h("p", { class: "empty" }, "Your account does not have the admin role.")
          : h("button", { class: "btn", onclick: login }, "Log in with Discord"));
      return;
    }
    if (state.offline) {
      view.replaceChildren(pageHead("Admin", ""), h("p", { class: "empty" }, "The live server is offline. Editing is not possible right now."));
      return;
    }
    const current = await api("/api/content");
    const d = JSON.parse(JSON.stringify(current));
    d.achievements = d.achievements || []; d.gallery = d.gallery || []; d.requirements = d.requirements || [];

    const achBox = h("div"), galBox = h("div", { class: "gallery-edit" });

    const pickFile = (onPath) => {
      const input = h("input", { type: "file", accept: "image/png,image/jpeg,image/webp,image/gif", hidden: true });
      input.addEventListener("change", async () => {
        for (const file of input.files) {
          if (file.size > 5 * 1024 * 1024) { toast(file.name + " is larger than 5 MB."); continue; }
          try { toast("Uploading…"); onPath(await uploadImage(file)); }
          catch (e) { toast("Upload failed: " + e.message); }
        }
      });
      input.click();
    };

    const drawAch = () => {
      achBox.replaceChildren(...d.achievements.map((a, i) => h("div", { class: "editor-block" },
        h("div", { class: "two" },
          h("div", { class: "field" }, h("label", {}, "Title"), h("input", { type: "text", value: a.title, maxlength: 80, oninput: (e) => (a.title = e.target.value) })),
          h("div", { class: "field" }, h("label", {}, "Date"), h("input", { type: "text", value: a.date, maxlength: 40, placeholder: "e.g. May 2026", oninput: (e) => (a.date = e.target.value) }))),
        h("div", { class: "field" }, h("label", {}, "Description"), h("textarea", { maxlength: 400, oninput: (e) => (a.desc = e.target.value) }, a.desc || "")),
        a.image ? picture(a.image, "", "thumb") : null,
        h("div", { class: "editor-actions" },
          h("button", { type: "button", class: "btn ghost small", onclick: () => pickFile((p) => { a.image = p; drawAch(); }) }, a.image ? "Replace image" : "Upload image"),
          h("button", { type: "button", class: "btn danger small", onclick: () => { d.achievements.splice(i, 1); drawAch(); } }, "Remove achievement")))));
    };
    const drawGal = () => {
      galBox.replaceChildren(...d.gallery.map((g, i) => h("div", { class: "g" },
        picture(g.image, g.caption),
        h("input", { type: "text", value: g.caption || "", maxlength: 120, placeholder: "Caption (optional)", oninput: (e) => (g.caption = e.target.value) }),
        h("div", { class: "editor-actions" },
          h("button", { type: "button", class: "btn danger small", onclick: () => { d.gallery.splice(i, 1); drawGal(); } }, "Remove")))));
    };

    const about = h("textarea", { maxlength: 4000, style: "min-height:9rem", oninput: (e) => (d.about = e.target.value) }, d.about || "");
    const invite = h("input", { type: "url", value: d.invite || "", oninput: (e) => (d.invite = e.target.value) });
    const reqs = h("textarea", { placeholder: "One requirement per line", oninput: (e) => (d.requirements = e.target.value.split("\n")) }, d.requirements.join("\n"));

    const save = h("button", { class: "btn", type: "button" }, "Save changes");
    save.addEventListener("click", async () => {
      save.disabled = true;
      try {
        const saved = await api("/api/content", { method: "PUT", json: d });
        state.cache.content = { t: Date.now(), v: saved };
        toast("Saved. Everyone sees the change now.");
      } catch (e) { toast("Could not save: " + e.message); }
      save.disabled = false;
    });

    drawAch(); drawGal();
    view.replaceChildren(
      pageHead("Admin", "Changes go live for every visitor as soon as you save. No GitHub step needed."),
      h("div", { class: "card wide" },
        h("div", { class: "field" }, h("label", {}, "About text"), about),
        h("div", { class: "field" }, h("label", {}, "Discord invite link"), invite),
        h("div", { class: "field" }, h("label", {}, "Requirements"), reqs)),
      h("section", { class: "section" }, h("h2", {}, "Achievements"), achBox,
        h("button", { type: "button", class: "btn ghost", onclick: () => { d.achievements.push({ id: "", title: "", desc: "", date: "", image: "" }); drawAch(); } }, "Add achievement")),
      h("section", { class: "section" }, h("h2", {}, "Clan gallery"), galBox,
        h("div", { class: "editor-actions" },
          h("button", { type: "button", class: "btn ghost", onclick: () => pickFile((p) => { d.gallery.push({ image: p, caption: "" }); drawGal(); }) }, "Add image"))),
      h("div", { class: "savebar" }, save));
  }

  function pageHead(title, sub) {
    return h("div", { class: "page-head" }, h("h1", {}, title), sub ? h("p", {}, sub) : null);
  }

  /* ------------------------------------------------------------------ */
  /* router                                                              */
  /* ------------------------------------------------------------------ */
  const routes = { home: viewHome, members: viewMembers, battles: viewBattles,
                   achievements: viewAchievements, apply: viewApply, admin: viewAdmin };

  async function route() {
    const name = (location.hash.replace(/^#\/?/, "").split("?")[0]) || "home";
    const fn = routes[name] || viewHome;
    document.querySelectorAll("#links a").forEach((a) => a.classList.toggle("on", a.dataset.r === (routes[name] ? name : "home")));
    try { await fn(); }
    catch (e) {
      console.error(e);
      view.replaceChildren(pageHead("Something went wrong", "Please reload the page."));
    }
    window.scrollTo(0, 0);
  }

  async function boot() {
    try {
      const cfg = await (await fetch("config.json?t=" + Date.now())).json();
      state.api = (cfg.api || "").replace(/\/$/, "");
    } catch (_) { /* no config */ }

    if (state.api) {
      try { state.cfg = await api("/api/config", { timeout: 6000 }); }
      catch (_) { state.offline = true; }
    } else {
      state.offline = true;
    }
    if (state.cfg) {
      $("#foot-discord").href = state.cfg.invite || "https://discord.gg/dux0";
      await refreshMe();
    }
    showNotice();
    renderAccount();
    window.addEventListener("hashchange", route);
    route();
  }
  boot();
})();
