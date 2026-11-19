/* =========================================================
   Mchinji Entertainment Awards 2026 - Voting page

   Two modes, chosen automatically:
   - LIVE mode: when supabase.config.js has your real Supabase
     details. Categories and artists come from the database and
     votes are checked on the server.
   - DEMO mode: when the config still has placeholders. Uses the
     lists below and saves votes only in the visitor's browser.

   VOTING (LIVE mode)
   Browsing is free. When a visitor presses Submit:
   - New voter: enter phone number -> enter the SMS code -> choose a 4-digit PIN -> vote.
   - Returning voter: enter phone number and PIN -> vote. No SMS needed.
   - Forgot PIN: get a new SMS code and choose a new PIN.

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
  var VOTER_PHONE_KEY = "mea_voter_phone";

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

  // "0999 123 456" or "+265 999 123 456" -> "265999123456". Returns "" if not a valid Malawi number.
  function cleanPhone(input) {
    var d = String(input || "").replace(/\D/g, "");
    if (d.indexOf("265") === 0) d = d.slice(3);
    if (d.charAt(0) === "0") d = d.slice(1);
    return d.length === 9 ? "265" + d : "";
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

  // Phone sign-in calls (Supabase Auth). These send and check the SMS code.
  function authPost(path, payload) {
    return fetch(CFG.SUPABASE_URL + "/auth/v1/" + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: CFG.SUPABASE_ANON_KEY },
      body: JSON.stringify(payload)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        return { ok: r.ok, status: r.status, body: j };
      });
    });
  }

  function requestCode(phone) {
    return authPost("otp", { phone: "+" + phone }).then(function (res) {
      if (!res.ok) throw new Error(res.status === 429 ? "rate" : "send");
    });
  }

  // Returns the login token if the code is right. The token is only used once, to set the PIN.
  function checkCode(phone, code) {
    return authPost("verify", { phone: "+" + phone, token: code, type: "sms" }).then(function (res) {
      if (!res.ok || !res.body || !res.body.access_token) throw new Error("code");
      return res.body.access_token;
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

  function loadStoredPhone() {
    try { return localStorage.getItem(VOTER_PHONE_KEY) || ""; } catch (e) { return ""; }
  }
  var storedPhone = loadStoredPhone();   // remembered so returning voters only type their PIN

  function rememberPhone(phone) {
    storedPhone = phone;
    try { localStorage.setItem(VOTER_PHONE_KEY, phone); } catch (e) { /* ignore */ }
  }
  function forgetPhone() {
    storedPhone = "";
    try { localStorage.removeItem(VOTER_PHONE_KEY); } catch (e) { /* ignore */ }
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

  /* ---------- Voter panel (phone, code and PIN) ---------- */
  var voterStep = "";     // "", "phone", "code" or "pin"
  var pending = null;     // { category, artist } waiting for the voter to confirm
  var voterPhone = "";    // the number being used right now

  var VOTER_CSS =
    ".voter-panel [hidden]{display:none !important}" +
    ".voter-panel{width:100%;box-sizing:border-box;padding:20px 18px;margin:0 0 14px;border-radius:18px;" +
    "background:linear-gradient(160deg,rgba(255,255,255,.08),rgba(255,255,255,.02));" +
    "border:1px solid rgba(212,168,75,.3);box-shadow:0 18px 40px rgba(0,0,0,.35);color:inherit;text-align:center;" +
    "animation:voterIn .35s ease both}" +
    "@keyframes voterIn{from{opacity:0;transform:translateY(10px)}}" +
    ".voter-badge{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;" +
    "color:var(--gold,#d4a84b);background:rgba(212,168,75,.12);padding:5px 10px;border-radius:999px;margin-bottom:10px}" +
    ".voter-title{margin:0 0 6px;font-size:21px;font-weight:700;line-height:1.2}" +
    ".voter-msg{margin:0 auto 14px;max-width:320px;font-size:14px;line-height:1.5;opacity:.8}" +
    ".voter-input{display:block;width:100%;box-sizing:border-box;margin:8px 0;padding:15px 16px;border-radius:14px;" +
    "border:1.5px solid rgba(255,255,255,.14);background:rgba(0,0,0,.35);color:inherit;font:inherit;font-size:17px;" +
    "text-align:center;outline:none;transition:border-color .2s,box-shadow .2s}" +
    ".voter-input::placeholder{color:rgba(255,255,255,.35);letter-spacing:.2em}" +
    ".voter-input:focus{border-color:var(--gold,#d4a84b);box-shadow:0 0 0 4px rgba(212,168,75,.18)}" +
    ".voter-input.otp{font-size:26px;letter-spacing:.45em;font-weight:700}" +
    ".voter-input.pin{font-size:28px;letter-spacing:.6em;font-weight:700}" +
    ".voter-error{min-height:1.2em;margin:10px 0 0;font-size:14px;color:#ff8a80}" +
    ".voter-go{display:block;width:100%;margin-top:6px;padding:15px;border:0;border-radius:14px;cursor:pointer;" +
    "background:linear-gradient(135deg,#f3d27a,#d4a84b);color:#1a1205;font:inherit;font-size:16px;font-weight:700;" +
    "box-shadow:0 10px 24px rgba(212,168,75,.35);transition:transform .15s ease,box-shadow .2s ease,opacity .2s}" +
    ".voter-go:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 14px 28px rgba(212,168,75,.45)}" +
    ".voter-go:active:not(:disabled){transform:scale(.98)}" +
    ".voter-go:disabled{opacity:.6;cursor:default}" +
    ".voter-links{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-top:14px}" +
    ".voter-link{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:inherit;" +
    "padding:7px 12px;border-radius:999px;font:inherit;font-size:13px;cursor:pointer;transition:background .2s}" +
    ".voter-link:hover{background:rgba(255,255,255,.14)}" +
    "@media (prefers-reduced-motion:reduce){.voter-panel{animation:none}}";

  function injectVoterCss() {
    if (document.getElementById("voter-css")) return;
    var style = el("style");
    style.id = "voter-css";
    style.textContent = VOTER_CSS;
    document.head.appendChild(style);
  }

  injectVoterCss();

  function makeInput(type, placeholder, maxLen, extraClass) {
    var input = el("input", "voter-input" + (extraClass ? " " + extraClass : ""));
    input.type = type;
    input.placeholder = placeholder;
    if (maxLen) input.maxLength = maxLen;
    input.autocomplete = type === "password" ? "off" : "on";
    return input;
  }

  var voterPanel = el("div", "voter-panel");
  voterPanel.hidden = true;

  var voterBadge = el("span", "voter-badge");
  var voterTitle = el("h3", "voter-title");
  var voterMsg = el("p", "voter-msg");

  var phoneInput = makeInput("tel", "0999 123 456", 20);
  var codeInput = makeInput("text", "······", 6, "otp");
  codeInput.inputMode = "numeric";
  codeInput.autocomplete = "one-time-code";
  var newPinInput = makeInput("password", "····", 4, "pin");
  newPinInput.inputMode = "numeric";
  var pinInput = makeInput("password", "····", 4, "pin");
  pinInput.inputMode = "numeric";

  var voterError = el("p", "voter-error");

  var voterGo = el("button", "voter-go");
  voterGo.type = "button";

  var voterAlt = el("button", "voter-link", "Forgot PIN?");
  voterAlt.type = "button";
  var voterSwitch = el("button", "voter-link", "Use another number");
  voterSwitch.type = "button";
  var voterBack = el("button", "voter-link", "Cancel");
  voterBack.type = "button";

  var linkRow = el("div", "voter-links");
  linkRow.appendChild(voterAlt);
  linkRow.appendChild(voterSwitch);
  linkRow.appendChild(voterBack);

  voterPanel.appendChild(voterBadge);
  voterPanel.appendChild(voterTitle);
  voterPanel.appendChild(voterMsg);
  voterPanel.appendChild(phoneInput);
  voterPanel.appendChild(codeInput);
  voterPanel.appendChild(newPinInput);
  voterPanel.appendChild(pinInput);
  voterPanel.appendChild(voterError);
  voterPanel.appendChild(voterGo);
  voterPanel.appendChild(linkRow);
  voteBar.insertBefore(voterPanel, voteChoice);

  function defaultButtonLabel(step) {
    if (step === "phone") return "Send code";
    if (step === "code") return "Confirm and vote";
    return "Vote";
  }

  function setBusy(on, label) {
    busy = on;
    voterGo.disabled = on;
    voterGo.textContent = on ? (label || "Please wait...") : defaultButtonLabel(voterStep);
  }

  function voterFail(message) {
    setBusy(false);
    voterError.textContent = message;
  }

  function defaultMessage(step) {
    if (step === "phone") {
      return "Enter your phone number. We will send you a code to confirm it is you. You only do this once.";
    }
    if (step === "code") {
      return "Enter the code we sent to +" + voterPhone + " and choose a 4-digit PIN. You will use this PIN for future votes.";
    }
    return "Enter your 4-digit PIN to vote.";
  }

  function showVoterStep(step, message) {
    voterStep = step;
    voterError.textContent = "";
    phoneInput.hidden = step !== "phone";
    codeInput.hidden = step !== "code";
    newPinInput.hidden = step !== "code";
    pinInput.hidden = step !== "pin";
    voterAlt.hidden = step !== "pin";
    voterSwitch.hidden = step !== "pin";
    pinInput.value = "";
    newPinInput.value = "";
    codeInput.value = "";
    var heads = {
      phone: ["Step 1 of 2", "Verify your number"],
      code: ["Step 2 of 2", "Enter your code"],
      pin: ["Quick vote", "Enter your PIN"]
    }[step];
    voterBadge.textContent = heads[0];
    voterTitle.textContent = heads[1];
    voterMsg.textContent = message || defaultMessage(step);
    setBusy(false);
    updateBar();
  }

  function cancelVoterStep() {
    voterStep = "";
    pending = null;
    voterError.textContent = "";
    updateBar();
  }

  // Shows a number like "+265 99 ••• ••76" so voters can see which number they are using.
  function maskPhone(phone) {
    if (!phone || phone.length < 6) return "";
    return "+" + phone.slice(0, 3) + " " + phone.slice(3, 5) + " \u2022\u2022\u2022 \u2022\u2022" + phone.slice(-2);
  }

  // Called when a visitor presses Submit in LIVE mode.
  function beginVote(category, artist) {
    pending = { category: category, artist: artist };
    if (storedPhone) {
      voterPhone = storedPhone;
      showVoterStep("pin", "Enter your PIN to vote for " + artist.name + ".\n" +
        "Voting with " + maskPhone(storedPhone) + ".");
    } else {
      voterPhone = "";
      showVoterStep("phone", "Enter your phone number to vote for " + artist.name + ". We will send you a code.");
    }
  }

  function sendCodeStep() {
    var phone = cleanPhone(phoneInput.value);
    if (!phone) return voterFail("Enter a valid Malawi number, e.g. 0999 123 456.");
    setBusy(true, "Sending code...");
    requestCode(phone).then(function () {
      voterPhone = phone;
      showVoterStep("code", "We sent a code to +" + phone + ". Enter it and choose your 4-digit PIN.");
    }).catch(function (e) {
      voterFail(e.message === "rate"
        ? "Please wait a few minutes before asking for another code."
        : "We could not send the code. Please try again.");
    });
  }

  function confirmCodeStep() {
    var code = codeInput.value.trim();
    var pin = newPinInput.value.trim();
    var job = pending;
    if (!job) return cancelVoterStep();
    if (!/^\d{6}$/.test(code)) return voterFail("Enter the 6-digit code from the SMS.");
    if (!/^\d{4}$/.test(pin)) return voterFail("Your PIN must be 4 digits.");

    setBusy(true, "Checking...");
    checkCode(voterPhone, code)
      .then(function (token) {
        return callVote({ action: "set_pin", access_token: token, pin: pin });
      })
      .then(function (res) {
        if (!(res.body && res.body.ok)) {
          throw new Error((res.body && res.body.error) || "server_error");
        }
        rememberPhone(voterPhone);
        setBusy(true, "Voting...");
        return castVote(job, voterPhone, pin).then(function (result) {
          finishVote(job, result, voterPhone);
        });
      })
      .catch(function (e) {
        if (e.message === "code") return voterFail("That code is wrong or has expired. Check it or ask for a new one.");
        voterFail("We could not save your PIN. Please try again.");
      });
  }

  function votePinStep() {
    var pin = pinInput.value.trim();
    var job = pending;
    if (!job) return cancelVoterStep();
    if (!/^\d{4}$/.test(pin)) return voterFail("Enter your 4-digit PIN.");

    setBusy(true, "Voting...");
    castVote(job, voterPhone, pin).then(function (result) {
      finishVote(job, result, voterPhone);
    });
  }

  voterGo.addEventListener("click", function () {
    if (busy) return;
    if (voterStep === "phone") return sendCodeStep();
    if (voterStep === "code") return confirmCodeStep();
    if (voterStep === "pin") return votePinStep();
  });

  // "Forgot PIN?": send a new code to the saved number, then choose a new PIN.
  voterAlt.addEventListener("click", function () {
    if (busy) return;
    setBusy(true, "Sending code...");
    requestCode(voterPhone).then(function () {
      showVoterStep("code", "We sent a new code to +" + voterPhone + ". Enter it and choose a new PIN.");
    }).catch(function (e) {
      voterFail(e.message === "rate"
        ? "Please wait a few minutes before asking for another code."
        : "We could not send the code. Please try again.");
    });
  });

  voterSwitch.addEventListener("click", function () {
    if (busy) return;
    forgetPhone();
    voterPhone = "";
    showVoterStep("phone", "Enter the phone number you want to vote with. We will send you a code.");
  });

  voterBack.addEventListener("click", function () {
    if (busy) return;
    cancelVoterStep();
  });

  function castVote(job, phone, pin) {
    return callVote({
      action: "vote",
      category_id: job.category.id,
      artist_id: job.artist.id,
      device_id: getDeviceId(),
      fingerprint: fingerprint(),
      phone: phone,
      pin: pin
    }).then(function (res) {
      return res.body && res.body.ok
        ? { ok: true }
        : { ok: false, error: (res.body && res.body.error) || "server_error" };
    }).catch(function () {
      return { ok: false, error: "network" };
    });
  }

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

  // The bar at the bottom of the pop-up: your choice + Submit (or the phone/PIN panel)
  function updateBar() {
    if (!current || !current.artists.length) { voteBar.hidden = true; return; }
    voteBar.hidden = false;

    if (voterStep) {
      voterPanel.hidden = false;
      voteChoice.hidden = true;
      voteSubmit.hidden = true;
      return;
    }
    voterPanel.hidden = true;
    voteChoice.hidden = false;

    var votedFor = votes[current.id];
    voteBar.classList.toggle("is-done", !!votedFor);

    if (votedFor) {
      var a = findArtist(votedFor);
      var name = a ? a.name : "your artist";
      voteChoice.textContent = thanksFor
        ? "✓ Thank you! Your vote for " + thanksFor + " has been recorded."
        : "✓ You voted for " + name + " in this category.";
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

      card.appendChild(el("span", "nominee-check", "✓"));
      card.appendChild(avatar);
      card.appendChild(el("h3", "nominee-name", artist.name));

      card.addEventListener("click", function () {
        if (busy || voterStep) return;
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
    voterStep = "";
    pending = null;
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
    voterStep = "";
    pending = null;
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
    already_voted: "You have already voted in this category.",
    voting_closed: "Voting is closed.",
    too_many: "Too many votes from your network. Please try again later.",
    invalid_artist: "That artist is not available. Please refresh the page.",
    not_registered: "This number is not registered yet. Please request a code.",
    wrong_pin: "That PIN is not right. Please try again.",
    locked: "Too many wrong PINs. Wait 15 minutes, or tap Forgot PIN to get a new code.",
    bad_pin: "Your PIN must be 4 digits.",
    bad_request: "Please check your details and try again.",
    network: "Connection problem. Please check your internet and try again.",
    server_error: "Something went wrong. Please try again."
  };

  // Demo mode only: saves the vote in this browser.
  function demoVote(categoryId, artistId) {
    var all = loadLocalVotes();
    if (all[categoryId]) return { ok: false, error: "already_voted" };
    all[categoryId] = artistId;
    saveLocalVotes(all);
    return { ok: true };
  }

  // After a vote attempt in LIVE mode: show success, or explain what went wrong.
  function finishVote(job, result, phone) {
    setBusy(false);
    if (result.ok) {
      votes[job.category.id] = job.artist.id;
      rememberPhone(phone);
      voterStep = "";
      pending = null;
      if (current && current.id === job.category.id) {
        thanksFor = job.artist.name;
        selected = null;
      }
      renderArtists();
      renderCategories();
      return;
    }
    handleVoteError(job, result.error, phone);
  }

  function handleVoteError(job, error, phone) {
    if (error === "not_registered") {
      // This number has no PIN yet: send a code so they can set one.
      voterPhone = phone;
      setBusy(true, "Sending code...");
      requestCode(phone).then(function () {
        showVoterStep("code", "This number is new. We sent a code to +" + phone + ". Enter it and choose a PIN.");
      }).catch(function () {
        voterFail("We could not send the code. Please try again.");
      });
      return;
    }
    if (error === "wrong_pin") {
      pinInput.value = "";
      return voterFail(MESSAGES.wrong_pin);
    }
    if (error === "locked") return voterFail(MESSAGES.locked);
    if (error === "bad_pin") return voterFail(MESSAGES.bad_pin);

    if (error === "already_voted") {
      showToast(MESSAGES.already_voted);
      cancelVoterStep();
      callVote({ action: "status", device_id: getDeviceId() })
        .then(function (r) { votes = (r.body && r.body.voted) || votes; })
        .catch(function () { /* ignore */ })
        .then(function () { renderArtists(); renderCategories(); });
      return;
    }

    showToast(MESSAGES[error] || MESSAGES.server_error);
    cancelVoterStep();
    renderArtists();
  }

  function submitVote() {
    if (busy || !current || !selected) return;
    if (!votingOpen) { showToast(MESSAGES.voting_closed); return; }

    if (REMOTE) {
      // LIVE mode: the phone and PIN panel takes over from here.
      beginVote(current, selected);
      return;
    }

    // DEMO mode: no phone check, vote saved in this browser only.
    var category = current;
    var artist = selected;
    var result = demoVote(category.id, artist.id);
    if (result.ok) {
      votes[category.id] = artist.id;
      if (current && current.id === category.id) thanksFor = artist.name;
    } else {
      showToast(MESSAGES[result.error] || MESSAGES.server_error);
      votes = loadLocalVotes();
    }
    if (current && current.id === category.id) {
      if (votes[category.id]) selected = null;
      renderArtists();
    }
    renderCategories();
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