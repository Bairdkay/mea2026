/* =========================================================
   Mchinji Entertainment Awards 2026 - Voting page

   Two modes, chosen automatically:
   - LIVE mode: when js/supabase-config.js has your real Supabase
     details. Categories and artists come from the database and
     votes are checked on the server (one device = one vote per
     category).
   - DEMO mode: when the config still has placeholders. Uses the
     lists below and saves votes only in the visitor's browser.

   DEMO MODE - HOW TO ADD ARTISTS
     "artist-of-the-year-male": [
       { name: "Artist One", photo: "assets/artists/artist-one.jpg" }
     ],
   ========================================================= */

(function () {
  "use strict";

  var CFG = window.MEA_CONFIG || {};
  var REMOTE = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY &&
    CFG.SUPABASE_URL.indexOf("YOUR-PROJECT") === -1 &&
    CFG.SUPABASE_ANON_KEY.indexOf("YOUR-ANON") === -1);

  var LOGO = "assets/logo.png";
  var PLACEHOLDER_COUNT = 4;
  var LOCAL_VOTES_KEY = "mea_votes_2026";
  var DEVICE_KEY = "mea_device_id";

  /* ---------- DEMO data ---------- */
  var GROUPS = [
    {
      name: "Music & Entertainment",
      awards: [
        "Artist of the Year (Male)",
        "Artist of the Year (Female)",
        "Song of the Year",
        "Best New Artist (Male)",
        "Best New Artist (Female)",
        "Music Producer of the Year",
        "Best Music Video of the Year",
        "Video Vixen/Model of the Year",
        "Best Collaboration",
        "Best Album",
        "Best Hiphop/Trap Act",
        "Best Gospel Act (Male)",
        "Best Gospel Act (Female)",
        "Best Gospel Song",
        "Best Dancehall Act",
        "Best Afro/RnB Act",
        "Best Stage Performance",
        "Best Radio Presenter"
      ]
    },
    {
      name: "Media & Communication",
      awards: [
        "Photographer of the Year",
        "Best Video Director of the Year",
        "Media Personality of the Year"
      ]
    },
    {
      name: "Arts & Creative Industry",
      awards: [
        "Graphic Designer of the Year",
        "Poet of the Year (Male)",
        "Poet of the Year (Female)",
        "Best Content Creator (Male)",
        "Best Content Creator (Female)",
        "Best Comedian (Male)",
        "Best Comedian (Female)"
      ]
    },
    {
      name: "Sports",
      awards: ["Sportsman of the Year", "Sportswoman of the Year"]
    },
    {
      name: "Honorary Category",
      awards: ["Lifetime Achievement Award"]
    },
    {
      name: "Lifestyle & Entertainment",
      awards: ["Event Organisers of the Year"]
    },
    {
      name: "Community & Social Impact",
      awards: ["Mchinji Community Impact Organisation of the Year"]
    }
  ];

  var ARTISTS = {
    // "best-album": [ { name: "Artist Name", photo: "assets/artists/name.jpg" } ]
  };

  /* ---------- Helpers ---------- */
  function slug(text) {
    return text
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function initials(name) {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map(function (w) { return w.charAt(0); })
      .join("")
      .toUpperCase();
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  /* ---------- Device identity (for one-device-one-vote) ---------- */
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16);
    crypto.getRandomValues(b);
    b[6] = (b[6] & 15) | 64;
    b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) {
      return ("0" + x.toString(16)).slice(-2);
    }).join("");
    return [h.slice(0, 8), h.slice(8, 12), h.slice(12, 16), h.slice(16, 20), h.slice(20)].join("-");
  }

  function readCookie(name) {
    var m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  }

  var cachedDeviceId = null;
  function getDeviceId() {
    if (cachedDeviceId) return cachedDeviceId;
    var id = null;
    try { id = localStorage.getItem(DEVICE_KEY); } catch (e) { /* ignore */ }
    if (!id) id = readCookie(DEVICE_KEY);
    if (!id) id = uuid();
    try { localStorage.setItem(DEVICE_KEY, id); } catch (e) { /* ignore */ }
    // Cookie copy: survives if only localStorage is cleared
    document.cookie = DEVICE_KEY + "=" + id + "; max-age=31536000; path=/; SameSite=Lax";
    cachedDeviceId = id;
    return id;
  }

  // Describes the browser/phone. Not unique, only used to spot bots.
  function fingerprint() {
    return [
      navigator.userAgent,
      navigator.language,
      navigator.platform,
      screen.width + "x" + screen.height + "x" + screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || "",
      navigator.maxTouchPoints || 0
    ].join("|");
  }

  /* ---------- Server calls (LIVE mode) ---------- */
  function rest(path) {
    return fetch(CFG.SUPABASE_URL + "/rest/v1/" + path, {
      headers: {
        apikey: CFG.SUPABASE_ANON_KEY,
        Authorization: "Bearer " + CFG.SUPABASE_ANON_KEY
      }
    }).then(function (r) {
      if (!r.ok) {
        return r.text().then(function (t) {
          throw new Error("Request failed (" + r.status + ") for " + path.split("?")[0] + ": " + t.slice(0, 200));
        });
      }
      return r.json();
    });
  }

  function callVote(body) {
    return fetch(CFG.SUPABASE_URL + "/functions/v1/vote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: CFG.SUPABASE_ANON_KEY,
        Authorization: "Bearer " + CFG.SUPABASE_ANON_KEY
      },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().then(function (j) { return { status: r.status, body: j }; });
    });
  }

  /* ---------- State ---------- */
  var groups = [];      // [{ name, awards: [{ id, title, artists: [{id,name,photo}] }] }]
  var votes = {};       // { categoryId: artistId }
  var votingOpen = true;

  var memoryVotes = {};
  function loadLocalVotes() {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_VOTES_KEY)) || {};
    } catch (e) {
      return memoryVotes;
    }
  }
  function saveLocalVotes(v) {
    memoryVotes = v;
    try { localStorage.setItem(LOCAL_VOTES_KEY, JSON.stringify(v)); } catch (e) { /* ignore */ }
  }

  function loadDemo() {
    groups = GROUPS.map(function (g) {
      return {
        name: g.name,
        awards: g.awards.map(function (title) {
          var id = slug(title);
          var list = ARTISTS[id];
          var artists;
          if (list && list.length) {
            artists = list.map(function (a) {
              return { id: a.name, name: a.name, photo: a.photo };
            });
          } else {
            artists = [];
            for (var i = 1; i <= PLACEHOLDER_COUNT; i++) {
              artists.push({ id: "Artist " + i, name: "Artist " + i });
            }
          }
          return { id: id, title: title, artists: artists };
        })
      };
    });
    votes = loadLocalVotes();
    votingOpen = true;
    return Promise.resolve();
  }

  function loadLive() {
    return Promise.all([
      rest("categories?select=id,slug,name,group_name&is_active=eq.true&order=sort_order.asc"),
      rest("artists?select=id,category_id,name,photo_url&is_active=eq.true&order=sort_order.asc,name.asc"),
      callVote({ action: "status", device_id: getDeviceId() })
        .catch(function () { return { body: { voting_open: true, voted: {} } }; })
    ]).then(function (res) {
      var cats = res[0];
      var arts = res[1];
      var status = res[2].body || {};

      var byCat = {};
      arts.forEach(function (a) {
        (byCat[a.category_id] = byCat[a.category_id] || []).push({
          id: a.id, name: a.name, photo: a.photo_url
        });
      });

      var groupMap = {};
      var order = [];
      cats.forEach(function (c) {
        if (!groupMap[c.group_name]) {
          groupMap[c.group_name] = { name: c.group_name, awards: [] };
          order.push(c.group_name);
        }
        groupMap[c.group_name].awards.push({
          id: c.id, title: c.name, artists: byCat[c.id] || []
        });
      });

      groups = order.map(function (n) { return groupMap[n]; });
      votes = status.voted || {};
      votingOpen = status.voting_open !== false;
    });
  }

  /* ---------- Elements ---------- */
  var groupsRoot = document.getElementById("award-groups");
  var modal = document.getElementById("nominee-modal");
  var modalTitle = document.getElementById("modal-title");
  var modalGroup = document.getElementById("modal-group");
  var modalHint = modal ? modal.querySelector(".modal-hint") : null;
  var artistGrid = document.getElementById("nominee-grid");
  var closeBtn = document.getElementById("modal-close");
  var toast = document.getElementById("toast");
  var voteBar = document.getElementById("vote-bar");
  var voteChoice = document.getElementById("vote-choice");
  var voteSubmit = document.getElementById("vote-submit");

  if (!groupsRoot || !modal) return;

  var current = null;   // { id, title, group, artists }
  var lastFocused = null;
  var toastTimer = null;
  var busy = false;
  var selected = null;   // artist picked in the open pop-up (not yet submitted)
  var thanksFor = null;  // name shown in the thank-you message after a vote

  var HINT_DEFAULT = "Tap your favourite artist, then press Submit. Your vote is final.";

  /* ---------- Category grid ---------- */
  function renderCategories() {
    groupsRoot.textContent = "";

    var grid = el("div", "award-grid");
    groups.forEach(function (group) {
      group.awards.forEach(function (award) {
        var card = el("button", "award-card");
        card.type = "button";
        card.setAttribute("data-id", award.id);

        var logo = el("img", "award-card-logo");
        logo.src = LOGO;
        logo.alt = "";
        card.appendChild(logo);
        card.appendChild(el("span", "award-card-name", award.title));

        if (votes[award.id]) {
          card.classList.add("is-voted");
          card.appendChild(el("span", "award-card-badge", "✓ Voted"));
        }

        card.addEventListener("click", function () {
          openModal({
            id: award.id, title: award.title,
            group: group.name, artists: award.artists
          });
        });
        grid.appendChild(card);
      });
    });
    groupsRoot.appendChild(grid);
  }

  /* ---------- Pop-up with artists ---------- */
  function findArtist(id) {
    for (var i = 0; i < current.artists.length; i++) {
      if (current.artists[i].id === id) return current.artists[i];
    }
    return null;
  }

  // The bar at the bottom of the pop-up: your choice + Submit
  function updateBar() {
    if (!current || !current.artists.length) { voteBar.hidden = true; return; }
    var votedFor = votes[current.id];
    voteBar.hidden = false;
    voteBar.classList.toggle("is-done", !!votedFor);

    if (votedFor) {
      var a = findArtist(votedFor);
      var name = a ? a.name : "your artist";
      voteChoice.textContent = thanksFor
        ? "\u2713 Thank you! Your vote for " + thanksFor + " has been recorded."
        : "\u2713 You voted for " + name + " in this category.";
      voteSubmit.hidden = true;
      return;
    }

    voteSubmit.hidden = false;
    if (!votingOpen) {
      voteChoice.textContent = "Voting is closed.";
      voteSubmit.disabled = true;
      return;
    }
    voteChoice.textContent = selected ? "Your choice: " + selected.name : "Tap an artist to choose";
    voteSubmit.disabled = !selected || busy;
    voteSubmit.textContent = busy ? "Submitting..." : "Submit";
  }

  function renderArtists() {
    var votedFor = votes[current.id];
    var cards = [];
    artistGrid.textContent = "";

    if (modalHint) {
      modalHint.textContent = !votingOpen
        ? "Voting is closed."
        : votedFor
          ? "You have voted in this category. Thank you!"
          : HINT_DEFAULT;
    }

    if (!current.artists.length) {
      artistGrid.appendChild(el("p", "modal-hint", "Artists for this category will be announced soon."));
      updateBar();
      return;
    }

    function paint() {
      cards.forEach(function (c) {
        var isPicked = !votedFor && selected && selected.id === c.artist.id;
        c.node.classList.toggle("is-picked", !!isPicked);
        c.node.setAttribute("aria-pressed", String(!!isPicked || votedFor === c.artist.id));
      });
    }

    current.artists.forEach(function (artist) {
      var isVoted = votedFor === artist.id;

      var card = el("button", "nominee-card");
      card.type = "button";
      if (isVoted) card.classList.add("is-voted");
      if (votedFor && !isVoted) card.classList.add("is-dim");
      card.disabled = !votingOpen || !!votedFor;

      var avatar = el("div", "nominee-avatar");
      if (artist.photo) {
        var img = el("img");
        img.src = artist.photo;
        img.alt = artist.name;
        img.addEventListener("error", function () {
          img.remove();
          avatar.textContent = initials(artist.name);
        });
        avatar.appendChild(img);
      } else {
        avatar.textContent = initials(artist.name);
      }

      card.appendChild(el("span", "nominee-check", "\u2713"));
      card.appendChild(avatar);
      card.appendChild(el("h3", "nominee-name", artist.name));

      card.addEventListener("click", function () {
        if (busy) return;
        selected = artist;
        paint();
        updateBar();
      });

      cards.push({ node: card, artist: artist });
      artistGrid.appendChild(card);
    });

    paint();
    updateBar();
  }

  function openModal(info) {
    current = info;
    selected = null;
    thanksFor = null;
    lastFocused = document.activeElement;
    modalTitle.textContent = info.title;
    modalGroup.textContent = info.group;
    renderArtists();
    modal.hidden = false;
    document.body.classList.add("modal-open");
    closeBtn.focus();
  }

  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove("modal-open");
    current = null;
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove("show");
    }, 3200);
  }

  /* ---------- Voting ---------- */
  var MESSAGES = {
    already_voted: "You have already voted in this category on this device.",
    voting_closed: "Voting is closed.",
    too_many: "Too many votes from your network. Please try again later.",
    invalid_artist: "That artist is not available. Please refresh the page.",
    network: "Connection problem. Please check your internet and try again.",
    server_error: "Something went wrong. Please try again."
  };

  function sendVote(categoryId, artistId) {
    if (!REMOTE) {
      var all = loadLocalVotes();
      if (all[categoryId]) return Promise.resolve({ ok: false, error: "already_voted" });
      all[categoryId] = artistId;
      saveLocalVotes(all);
      return Promise.resolve({ ok: true });
    }
    return callVote({
      action: "vote",
      category_id: categoryId,
      artist_id: artistId,
      device_id: getDeviceId(),
      fingerprint: fingerprint()
    }).then(function (res) {
      return res.body && res.body.ok
        ? { ok: true }
        : { ok: false, error: (res.body && res.body.error) || "server_error" };
    }).catch(function () {
      return { ok: false, error: "network" };
    });
  }

  function submitVote() {
    if (busy || !current || !selected) return;
    if (!votingOpen) { showToast(MESSAGES.voting_closed); return; }

    var category = current;
    var artist = selected;
    busy = true;
    updateBar();

    sendVote(category.id, artist.id).then(function (result) {
      if (result.ok) {
        votes[category.id] = artist.id;
        if (current && current.id === category.id) thanksFor = artist.name;
        return;
      }
      showToast(MESSAGES[result.error] || MESSAGES.server_error);
      if (result.error === "already_voted") {
        // Sync with the server so the page shows what was voted before
        if (REMOTE) {
          return callVote({ action: "status", device_id: getDeviceId() })
            .then(function (r) { votes = (r.body && r.body.voted) || votes; })
            .catch(function () { /* ignore */ });
        }
        votes = loadLocalVotes();
      }
    }).then(function () {
      busy = false;
      if (current && current.id === category.id) {
        if (votes[category.id]) selected = null;
        renderArtists();
      }
      renderCategories();
    });
  }

  voteSubmit.addEventListener("click", submitVote);

  closeBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", function (e) {
    if (e.target === modal) closeModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.hidden) closeModal();
  });

  /* ---------- Start ---------- */
  groupsRoot.appendChild(el("p", "modal-hint", "Loading categories..."));

  (REMOTE ? loadLive() : loadDemo())
    .then(renderCategories)
    .catch(function (err) {
      console.error("MEA load error:", err);
      groupsRoot.textContent = "";
      groupsRoot.appendChild(el("p", "modal-hint",
        "Could not load the categories. Details: " + (err && err.message ? err.message : err)));
    });
})();