/* =========================================================
   MEA admin dashboard (plain JS, talks to Supabase over fetch)
   Needs js/supabase-config.js (window.MEA_CONFIG) loaded first.
   Only people listed in the `admins` table can use it - the
   database enforces this, not this file.
   ========================================================= */
(function () {
  "use strict";

  const CFG = window.MEA_CONFIG || {};
  const URL_BASE = (CFG.SUPABASE_URL || "").replace(/\/$/, "");
  const ANON = CFG.SUPABASE_ANON_KEY || "";
  const SESSION_KEY = "mea_admin_session";
  const BUCKET = "artist-photos";

  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- toast ---------- */
  let toastTimer;
  function toast(msg, bad) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.toggle("bad", !!bad);
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
  }

  /* ---------- session ---------- */
  function loadSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
  }
  function saveSession(s) {
    try {
      if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      else localStorage.removeItem(SESSION_KEY);
    } catch { /* private mode: stay logged in for this page only */ }
    session = s;
  }
  let session = loadSession();

  function toSession(data) {
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in || 3600) * 1000,
      email: data.user && data.user.email,
    };
  }

  async function refreshSession() {
    if (!session || !session.refresh_token) return false;
    try {
      const r = await fetch(`${URL_BASE}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: { apikey: ANON, "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      });
      if (!r.ok) return false;
      saveSession(toSession(await r.json()));
      return true;
    } catch { return false; }
  }

  /* ---------- API helper ---------- */
  async function api(path, opts = {}, retry = true) {
    if (session && session.expires_at - Date.now() < 60000) await refreshSession();
    const headers = {
      apikey: ANON,
      Authorization: `Bearer ${session ? session.access_token : ANON}`,
      ...(opts.headers || {}),
    };
    if (opts.body && !(opts.body instanceof Blob) && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
    const res = await fetch(`${URL_BASE}${path}`, { ...opts, headers });
    if (res.status === 401 && retry && (await refreshSession())) return api(path, opts, false);
    if (res.status === 401) { showLogin("Your session ended. Please sign in again."); throw new Error("Signed out"); }
    if (!res.ok) {
      let detail = "";
      let code = "";
      try { const j = await res.json(); detail = j.message || j.error || ""; code = j.code || ""; } catch {}
      const err = new Error(detail || `Request failed (${res.status})`);
      err.status = res.status; err.code = code;
      throw err;
    }
    if (res.status === 204) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }
  const rest = (p, o) => api(`/rest/v1/${p}`, o);

  /* ---------- views ---------- */
  function showLogin(msg) {
    saveSession(null);
    stopAutoRefresh();
    $("app-view").hidden = true;
    $("login-view").hidden = false;
    const e = $("login-error");
    e.hidden = !msg;
    e.textContent = msg || "";
  }

  async function showApp() {
    // Make sure this person really is an admin
    let ok = false;
    try { ok = (await rest("rpc/is_admin", { method: "POST", body: "{}" })) === true; } catch (e) {
      if (e.message === "Signed out") return;
      showLogin("Could not check admin access: " + e.message);
      return;
    }
    if (!ok) { showLogin("This account is not an admin."); return; }

    $("login-view").hidden = true;
    $("app-view").hidden = false;
    await Promise.all([loadSettings(), loadCategories()]);
    await loadResults();
    startAutoRefresh();
  }

  /* ---------- login / logout ---------- */
  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("login-btn");
    btn.disabled = true; btn.textContent = "Signing in…";
    try {
      const r = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: ANON, "Content-Type": "application/json" },
        body: JSON.stringify({ email: $("email").value.trim(), password: $("password").value }),
      });
      const raw = await r.text();
      let data = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch {}
      if (!r.ok || !data.access_token) {
        if (!URL_BASE || URL_BASE.includes("YOUR-PROJECT")) {
          throw new Error("Supabase is not connected. Check js/supabase-config.js has your real URL and key.");
        }
        throw new Error(data.error_description || data.msg || data.message ||
          (r.status === 400 ? "Wrong email or password." : "Sign-in failed (status " + r.status + ")."));
      }
      saveSession(toSession(data));
      $("password").value = "";
      await showApp();
    } catch (err) {
      const el = $("login-error");
      el.hidden = false; el.textContent = err.message;
    } finally {
      btn.disabled = false; btn.textContent = "Sign in";
    }
  });

  $("logout-btn").addEventListener("click", async () => {
    try {
      await fetch(`${URL_BASE}/auth/v1/logout`, {
        method: "POST",
        headers: { apikey: ANON, Authorization: `Bearer ${session.access_token}` },
      });
    } catch {}
    showLogin();
  });

  /* ---------- tabs ---------- */
  const TAB_LOADERS = {
    results: () => loadResults(),
    artists: () => loadArtists(),
    news: () => loadContent("news_posts"),
    events: () => loadContent("events"),
    gallery: () => loadContent("gallery_slides"),
    partners: () => loadContent("partners"),
    settings: () => loadVenue(),
  };
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === tab));
      Object.keys(TAB_LOADERS).forEach((n) => { $("tab-" + n).hidden = n !== tab.dataset.tab; });
      TAB_LOADERS[tab.dataset.tab]();
    });
  });

  /* ---------- results ---------- */
  let resultRows = [];
  let refreshTimer;

  function startAutoRefresh() {
    stopAutoRefresh();
    refreshTimer = setInterval(() => {
      if (!document.hidden && !$("tab-results").hidden) loadResults(true);
    }, 20000);
  }
  function stopAutoRefresh() { clearInterval(refreshTimer); }

  async function loadResults(quiet) {
    try {
      resultRows = (await rest("rpc/admin_results", { method: "POST", body: "{}" })) || [];
      renderResults();
      $("results-meta").textContent = "Updated " + new Date().toLocaleTimeString() + " · refreshes every 20 seconds";
    } catch (e) {
      if (!quiet) toast("Could not load results: " + e.message, true);
    }
  }

  function renderResults() {
    const q = $("results-search").value.trim().toLowerCase();
    const cats = new Map();
    let total = 0, artistCount = 0;

    resultRows.forEach((r) => {
      if (!cats.has(r.category_id)) cats.set(r.category_id, { name: r.category, group: r.group_name, rows: [], sum: 0 });
      if (r.artist_id) {
        const c = cats.get(r.category_id);
        c.rows.push(r);
        c.sum += Number(r.votes);
        total += Number(r.votes);
        artistCount++;
      }
    });

    $("stat-total").textContent = total.toLocaleString();
    $("stat-artists").textContent = artistCount;

    const html = [];
    cats.forEach((c) => {
      if (q && !c.name.toLowerCase().includes(q)) return;
      const max = Math.max(1, ...c.rows.map((r) => Number(r.votes)));
      const bars = c.rows.length
        ? c.rows.map((r, i) => {
            const v = Number(r.votes);
            const pct = c.sum ? Math.round((v / c.sum) * 100) : 0;
            return `<div class="bar-row${i === 0 && v > 0 ? " leader" : ""}">
              <div class="bar-top"><span>${esc(r.artist)}</span><b>${v.toLocaleString()} · ${pct}%</b></div>
              <div class="bar-track"><div class="bar-fill" style="width:${(v / max) * 100}%"></div></div>
            </div>`;
          }).join("")
        : `<p class="muted">No artists yet.</p>`;
      html.push(`<article class="res-card"><h3>${esc(c.name)}</h3>
        <p class="muted">${esc(c.group)} · ${c.sum.toLocaleString()} vote${c.sum === 1 ? "" : "s"}</p>${bars}</article>`);
    });
    $("results-list").innerHTML = html.join("") || `<p class="muted">Nothing to show.</p>`;
  }
  $("results-search").addEventListener("input", renderResults);
  $("refresh-results").addEventListener("click", () => loadResults());

  $("export-csv").addEventListener("click", () => {
    const q = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const lines = [["Group", "Category", "Artist", "Votes"].join(",")];
    resultRows.forEach((r) => { if (r.artist_id) lines.push([q(r.group_name), q(r.category), q(r.artist), r.votes].join(",")); });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mea-results-" + new Date().toISOString().slice(0, 10) + ".csv";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  /* ---------- settings (voting open / closed) ---------- */
  let votingOpen = true;

  async function loadSettings() {
    try {
      const rows = await rest("settings?select=value&key=eq.voting_open");
      votingOpen = !rows || !rows.length ? true : rows[0].value === "true";
      renderVoting();
    } catch (e) { toast("Could not load settings: " + e.message, true); }
  }

  function renderVoting() {
    $("stat-status").textContent = votingOpen ? "Open" : "Closed";
    $("voting-text").textContent = votingOpen
      ? "Voting is OPEN. Visitors can vote now."
      : "Voting is CLOSED. Visitors can see the site but cannot vote.";
    $("toggle-voting").textContent = votingOpen ? "Close voting" : "Open voting";
  }

  $("toggle-voting").addEventListener("click", async () => {
    const next = !votingOpen;
    if (!confirm(next ? "Open voting to the public?" : "Close voting? Nobody will be able to vote.")) return;
    try {
      await rest("settings?on_conflict=key", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ key: "voting_open", value: String(next) }),
      });
      votingOpen = next;
      renderVoting();
      toast(next ? "Voting is now open" : "Voting is now closed");
    } catch (e) { toast("Failed: " + e.message, true); }
  });

  /* ---------- artists ---------- */
  let categories = [];

  async function loadCategories() {
    try {
      categories = await rest("categories?select=id,name,group_name&order=sort_order.asc,name.asc");
      const sel = $("artist-category");
      const keep = sel.value;
      sel.innerHTML = categories.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
      if (keep) sel.value = keep;
    } catch (e) { toast("Could not load categories: " + e.message, true); }
  }

  async function loadArtists() {
    const cat = $("artist-category").value;
    if (!cat) { $("artist-list").innerHTML = ""; return; }
    try {
      const rows = await rest(`artists?select=*&category_id=eq.${encodeURIComponent(cat)}&order=sort_order.asc,name.asc`);
      $("artist-list").innerHTML = rows.length
        ? rows.map(artistRow).join("")
        : `<p class="muted">No artists in this category yet. Add one above.</p>`;
    } catch (e) { toast("Could not load artists: " + e.message, true); }
  }

  function artistRow(a) {
    const photo = a.photo_url
      ? `<img class="art-photo" src="${esc(a.photo_url)}" alt="" loading="lazy">`
      : `<div class="art-photo">${esc((a.name || "?").charAt(0).toUpperCase())}</div>`;
    return `<div class="art-row${a.is_active ? "" : " inactive"}" data-id="${a.id}">
      ${photo}
      <div class="art-body">
        <input class="art-name" value="${esc(a.name)}" maxlength="80" aria-label="Artist name">
        <div class="art-actions">
          <button class="btn btn-sm" data-act="save">Save name</button>
          <span class="btn btn-sm file-btn">Photo<input type="file" accept="image/*" data-act="photo"></span>
          <button class="btn btn-sm" data-act="toggle">${a.is_active ? "Hide" : "Show"}</button>
          <button class="btn btn-sm btn-danger" data-act="delete">Delete</button>
        </div>
      </div>
    </div>`;
  }

  $("artist-category").addEventListener("change", loadArtists);

  $("add-artist-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("new-artist-name").value.trim();
    if (!name) return;
    try {
      await rest("artists", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ category_id: $("artist-category").value, name }),
      });
      $("new-artist-name").value = "";
      toast("Artist added");
      loadArtists();
    } catch (err) { toast("Could not add: " + err.message, true); }
  });

  $("artist-list").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const row = btn.closest(".art-row");
    const id = row.dataset.id;
    const act = btn.dataset.act;
    try {
      if (act === "save") {
        const name = row.querySelector(".art-name").value.trim();
        if (!name) return toast("Name cannot be empty", true);
        await rest(`artists?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ name }) });
        toast("Name saved");
      } else if (act === "toggle") {
        const hide = !row.classList.contains("inactive");
        await rest(`artists?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ is_active: !hide }) });
        toast(hide ? "Hidden from voting page" : "Visible again");
        loadArtists();
      } else if (act === "delete") {
        if (!confirm("Delete this artist for good?")) return;
        await rest(`artists?id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
        toast("Artist deleted");
        loadArtists();
      }
    } catch (err) {
      if (err.code === "23503") toast("This artist already has votes, so it cannot be deleted. Use Hide instead.", true);
      else toast("Failed: " + err.message, true);
    }
  });

  // Photo upload: shrink on the phone first (saves data), then upload
  $("artist-list").addEventListener("change", async (e) => {
    const input = e.target.closest('input[data-act="photo"]');
    if (!input || !input.files[0]) return;
    const id = input.closest(".art-row").dataset.id;
    const file = input.files[0];
    if (!file.type.startsWith("image/")) return toast("Please choose an image", true);
    toast("Uploading photo…");
    try {
      const blob = await shrink(file, 700);
      const path = `${id}-${Date.now()}.jpg`;
      await api(`/storage/v1/object/${BUCKET}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: blob,
      });
      const publicUrl = `${URL_BASE}/storage/v1/object/public/${BUCKET}/${path}`;
      await rest(`artists?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ photo_url: publicUrl }) });
      toast("Photo saved");
      loadArtists();
    } catch (err) { toast("Upload failed: " + err.message, true); }
  });

  async function shrink(file, max, type = "image/jpeg") {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Could not read image"))), type, 0.85));
  }

  /* =========================================================
     Site content: news, events, gallery, partners, venue
     ========================================================= */
  const MEDIA = "site-media";
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const cache = { news_posts: [], events: [], gallery_slides: [], partners: [] };
  const NOPREF = { Prefer: "return=minimal" };

  async function uploadImage(file, folder, max, keepAlpha) {
    if (!file.type.startsWith("image/")) throw new Error("Please choose an image");
    const type = keepAlpha ? "image/png" : "image/jpeg";
    const blob = await shrink(file, max, type);
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${keepAlpha ? "png" : "jpg"}`;
    await api(`/storage/v1/object/${MEDIA}/${path}`, { method: "POST", headers: { "Content-Type": type }, body: blob });
    return `${URL_BASE}/storage/v1/object/public/${MEDIA}/${path}`;
  }

  const thumb = (url, label) => url
    ? `<img class="art-photo sq" src="${esc(url)}" alt="" loading="lazy">`
    : `<div class="art-photo sq">${esc((label || "?").charAt(0).toUpperCase())}</div>`;

  function actions(table, id, on, editable, hideWord) {
    const d = `data-table="${table}" data-id="${id}"`;
    return `<div class="art-actions">
      ${editable ? `<button class="btn btn-sm" data-act="edit" ${d}>Edit</button>` : ""}
      <button class="btn btn-sm" data-act="toggle" ${d}>${on ? hideWord || "Hide" : "Show"}</button>
      <button class="btn btn-sm btn-danger" data-act="del" ${d}>Delete</button>
    </div>`;
  }

  const TABLES = {
    news_posts: {
      list: "news-list", order: "published_at.desc,created_at.desc", active: "is_published",
      empty: "No news yet. Add your first post above.",
      row: (n) => `<div class="art-row${n.is_published ? "" : " inactive"}">${thumb(n.cover_url, n.title)}
        <div class="art-body"><div class="row-info"><p class="row-title">${esc(n.title)}</p>
        <p class="muted">${esc(n.published_at)} · ${n.is_published ? "Published" : "Hidden"}</p></div>
        ${actions("news_posts", n.id, n.is_published, true, "Unpublish")}</div></div>`,
    },
    events: {
      list: "event-admin-list", order: "event_date.asc", active: "is_active",
      empty: "No events yet.",
      row: (e) => `<div class="art-row${e.is_active ? "" : " inactive"}">
        <div class="art-photo sq">${esc(String(e.event_date).slice(8, 10))}</div>
        <div class="art-body"><div class="row-info"><p class="row-title">${esc(e.title)}</p>
        <p class="muted">${esc(e.event_date)}${e.event_time ? " · " + esc(e.event_time) : ""}</p></div>
        ${actions("events", e.id, e.is_active, true)}</div></div>`,
    },
    gallery_slides: {
      list: "gallery-admin-list", order: "sort_order.asc,created_at.asc", active: "is_active",
      empty: "No photos yet. Upload some above.",
      row: (g) => `<div class="art-row${g.is_active ? "" : " inactive"}">${thumb(g.image_url, "P")}
        <div class="art-body"><input class="art-name slide-caption" value="${esc(g.caption)}" maxlength="120" placeholder="Caption" aria-label="Caption">
        <div class="art-actions">
          <button class="btn btn-sm" data-act="savecap" data-table="gallery_slides" data-id="${g.id}">Save caption</button>
          <button class="btn btn-sm" data-act="toggle" data-table="gallery_slides" data-id="${g.id}">${g.is_active ? "Hide" : "Show"}</button>
          <button class="btn btn-sm btn-danger" data-act="del" data-table="gallery_slides" data-id="${g.id}">Delete</button>
        </div></div></div>`,
    },
    partners: {
      list: "partner-admin-list", order: "sort_order.asc,name.asc", active: "is_active",
      empty: "No partners yet.",
      row: (p) => `<div class="art-row${p.is_active ? "" : " inactive"}">${thumb(p.logo_url, p.name)}
        <div class="art-body"><div class="row-info"><p class="row-title">${esc(p.name)}</p>
        <p class="muted">${esc(p.website_url || "No website")}</p></div>
        ${actions("partners", p.id, p.is_active, true)}</div></div>`,
    },
  };

  async function loadContent(table) {
    const t = TABLES[table];
    try {
      cache[table] = (await rest(`${table}?select=*&order=${t.order}`)) || [];
      $(t.list).innerHTML = cache[table].length ? cache[table].map(t.row).join("") : `<p class="muted">${t.empty}</p>`;
    } catch (e) {
      const missing = /relation|does not exist|schema cache|42P01|PGRST205/i.test(e.message + (e.code || ""));
      $(t.list).innerHTML = `<p class="error">${missing
        ? "This section is not set up yet. Run supabase/news.sql in the Supabase SQL Editor first."
        : esc(e.message)}</p>`;
    }
  }

  const save = (table, id, data) => id
    ? rest(`${table}?id=eq.${id}`, { method: "PATCH", headers: NOPREF, body: JSON.stringify(data) })
    : rest(table, { method: "POST", headers: NOPREF, body: JSON.stringify(data) });

  /* --- list buttons (edit / show-hide / delete / caption) --- */
  const editors = {
    news_posts: (n) => {
      $("news-id").value = n.id; $("news-title").value = n.title; $("news-summary").value = n.summary || "";
      $("news-body").value = n.body || ""; $("news-date").value = n.published_at;
      $("news-published").checked = n.is_published; $("news-cover").value = "";
      $("news-save").textContent = "Update post"; $("news-cancel").hidden = false;
      $("news-form").scrollIntoView({ behavior: "smooth", block: "start" });
    },
    events: (e) => {
      $("ev-id").value = e.id; $("ev-title").value = e.title; $("ev-date").value = e.event_date;
      $("ev-time").value = e.event_time || ""; $("ev-cancel").hidden = false;
      $("event-form").scrollIntoView({ behavior: "smooth", block: "start" });
    },
    partners: (p) => {
      $("pt-id").value = p.id; $("pt-name").value = p.name; $("pt-url").value = p.website_url || "";
      $("pt-logo").value = ""; $("pt-cancel").hidden = false;
      $("partner-form").scrollIntoView({ behavior: "smooth", block: "start" });
    },
  };

  document.addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-table]");
    if (!b) return;
    const { act, table, id } = b.dataset;
    const t = TABLES[table];
    const row = cache[table].find((r) => r.id === id);
    try {
      if (act === "edit" && row) editors[table](row);
      else if (act === "toggle" && row) {
        await save(table, id, { [t.active]: !row[t.active] });
        toast(row[t.active] ? "Hidden from the website" : "Visible on the website");
        loadContent(table);
      } else if (act === "del") {
        if (!confirm("Delete this for good?")) return;
        await rest(`${table}?id=eq.${id}`, { method: "DELETE", headers: NOPREF });
        toast("Deleted");
        loadContent(table);
      } else if (act === "savecap") {
        const cap = b.closest(".art-row").querySelector(".slide-caption").value.trim();
        await save(table, id, { caption: cap });
        toast("Caption saved");
      }
    } catch (err) { toast("Failed: " + err.message, true); }
  });

  /* --- News form --- */
  function resetNews() {
    $("news-form").reset(); $("news-id").value = ""; $("news-date").value = todayStr();
    $("news-published").checked = true; $("news-save").textContent = "Save post"; $("news-cancel").hidden = true;
  }
  $("news-date").value = todayStr();
  $("news-cancel").addEventListener("click", resetNews);
  $("news-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("news-save"); btn.disabled = true;
    try {
      const data = {
        title: $("news-title").value.trim(), summary: $("news-summary").value.trim(),
        body: $("news-body").value.trim(), published_at: $("news-date").value,
        is_published: $("news-published").checked,
      };
      const f = $("news-cover").files[0];
      if (f) data.cover_url = await uploadImage(f, "news", 1200);
      await save("news_posts", $("news-id").value, data);
      toast("Post saved"); resetNews(); loadContent("news_posts");
    } catch (err) { toast("Could not save: " + err.message, true); }
    finally { btn.disabled = false; }
  });

  /* --- Events form --- */
  function resetEvent() { $("event-form").reset(); $("ev-id").value = ""; $("ev-cancel").hidden = true; }
  $("ev-cancel").addEventListener("click", resetEvent);
  $("event-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await save("events", $("ev-id").value, {
        title: $("ev-title").value.trim(), event_date: $("ev-date").value,
        event_time: $("ev-time").value.trim() || null,
      });
      toast("Event saved"); resetEvent(); loadContent("events");
    } catch (err) { toast("Could not save: " + err.message, true); }
  });

  /* --- Gallery form --- */
  $("gallery-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const files = Array.from($("gal-files").files);
    if (!files.length) return;
    const caption = $("gal-caption").value.trim();
    const btn = e.target.querySelector("button[type=submit]"); btn.disabled = true;
    try {
      for (let i = 0; i < files.length; i++) {
        toast(`Uploading photo ${i + 1} of ${files.length}…`);
        const url = await uploadImage(files[i], "gallery", 1600);
        await save("gallery_slides", "", { image_url: url, caption, sort_order: cache.gallery_slides.length + i });
      }
      toast(files.length === 1 ? "Photo added" : files.length + " photos added");
      $("gallery-form").reset(); loadContent("gallery_slides");
    } catch (err) { toast("Upload failed: " + err.message, true); }
    finally { btn.disabled = false; }
  });

  /* --- Partners form --- */
  function resetPartner() { $("partner-form").reset(); $("pt-id").value = ""; $("pt-cancel").hidden = true; }
  $("pt-cancel").addEventListener("click", resetPartner);
  $("partner-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const data = { name: $("pt-name").value.trim(), website_url: $("pt-url").value.trim() || null };
      const f = $("pt-logo").files[0];
      if (f) data.logo_url = await uploadImage(f, "partners", 500, true);
      if (!$("pt-id").value) data.sort_order = cache.partners.length + 1;
      await save("partners", $("pt-id").value, data);
      toast("Partner saved"); resetPartner(); loadContent("partners");
    } catch (err) { toast("Could not save: " + err.message, true); }
  });

  /* --- Venue (Settings tab) --- */
  async function loadVenue() {
    try {
      const rows = await rest("settings?select=key,value&key=in.(venue_name,venue_address,venue_map_url)");
      const v = {}; (rows || []).forEach((r) => { v[r.key] = r.value; });
      $("ven-name").value = v.venue_name || ""; $("ven-address").value = v.venue_address || "";
      $("ven-map").value = v.venue_map_url || "";
    } catch (err) { toast("Could not load venue: " + err.message, true); }
  }
  $("venue-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await rest("settings?on_conflict=key", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify([
          { key: "venue_name", value: $("ven-name").value.trim() },
          { key: "venue_address", value: $("ven-address").value.trim() },
          { key: "venue_map_url", value: $("ven-map").value.trim() },
        ]),
      });
      toast("Venue saved");
    } catch (err) { toast("Could not save: " + err.message, true); }
  });

  /* ---------- start ---------- */
  if (!URL_BASE || URL_BASE.includes("YOUR-PROJECT") || ANON.includes("YOUR-ANON")) {
    showLogin("Supabase is not connected. Fill in js/supabase-config.js first.");
  } else if (session) {
    showApp();
  } else {
    showLogin();
  }
})();