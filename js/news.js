/* =========================================================
   News Room - news, event calendar, gallery slider, partners
   ---------------------------------------------------------
   EDIT THE DATA BELOW. You do not need to touch the code
   further down.

   Images (all optional - a logo placeholder shows until
   the image file exists):
     News covers   -> assets/news/
     Gallery       -> assets/gallery/
     Partner logos -> assets/partners/
   ========================================================= */

(function () {
  "use strict";

  var LOGO = "assets/logo.png";

  /* ---------- 1. LATEST NEWS (newest first) ---------- */
  var NEWS = [
    {
      title: "Welcome to Mchinji Entertainment Awards 2026",
      date: "2026-10-13",
      cover: "assets/news/news-1.jpg",
      summary:
        "Celebrating local talent, recognising excellence, and promoting creativity across Mchinji District.",
      body: [
        "Mchinji Entertainment Awards (#MEA26) is a platform dedicated to celebrating local talent, recognising excellence, and promoting creativity across Mchinji District.",
        "Our mission is to empower creatives, create opportunities, and expose Mchinji talent to national recognition. MEA: Celebrating Local Talent, From Mchinji to the National Stage."
      ]
    },
    {
      title: "How to Vote",
      date: "2026-10-13",
      cover: "assets/news/news-2.jpg",
      summary:
        "Voting is simple: pick a category, find your favourite artist, and tap Vote.",
      body: [
        "Open the Categories page and choose the award you want to vote in. Each category opens a list of artists.",
        "Select your favourite artist and tap the Vote button. You can come back at any time to explore the other categories."
      ]
    },
    {
      title: "Meet the Team Behind MEA: Zikomo Social Net",
      date: "2026-10-13",
      cover: "assets/news/news-3.jpg",
      summary:
        "Zikomo Social Net is the founder, owner and main organiser of the awards.",
      body: [
        "Zikomo Social Net (ZSN) is a creative and entertainment platform based in Mchinji, Malawi and Nairobi, Kenya, dedicated to promoting talent, sharing stories, and creating opportunities for creatives and young people.",
        "Through digital media, entertainment, and community initiatives, ZSN aims to inspire positive change and empower local talent."
      ]
    }
  ];

  /* ---------- 2. EVENT CALENDAR ----------
     Add event days here. Date format: "YYYY-MM-DD".
     Example:
       { date: "2026-12-05", title: "MEA 2026 Awards Night", time: "6:00 PM" }
  */
  var EVENTS = [
    // { date: "2026-12-05", title: "MEA 2026 Awards Night", time: "6:00 PM" }
  ];

  /* ---------- 3. VENUE ---------- */
  var VENUE = {
    name: "Venue to be announced",
    address: "Mchinji, Malawi",
    mapUrl: "" // paste a Google Maps link here to show a "View on Map" button
  };

  /* ---------- 4. GALLERY SLIDES ---------- */
  var SLIDES = [
    { src: "assets/gallery/1.jpg", caption: "Celebrating Mchinji talent" },
    { src: "assets/gallery/2.jpg", caption: "Music, comedy, art and more" },
    { src: "assets/gallery/3.jpg", caption: "Moments from the stage" },
    { src: "assets/gallery/4.jpg", caption: "Creatives of Mchinji" },
    { src: "assets/gallery/5.jpg", caption: "From Mchinji to the national stage" }
  ];
  var SLIDE_SECONDS = 4;

  /* ---------- 5. PARTNERS ----------
     Click a partner on the page to open its details popup.
     description: text shown in the popup (leave "" if you have none yet)
     url:         website link shown as a "Visit website" button
  */
  var PARTNERS = [
    {
      name: "Zikomo Social Net",
      logo: "assets/partners/zsn.png",
      url: "",
      description: "Zikomo Social Net is the founder, owner and main organiser of the Mchinji Entertainment Awards."
    },
    {
      name: "DynExa",
      logo: "assets/partners/dynexa.png",
      url: "",
      description: ""
    }
  ];

  /* =========================================================
     CODE (no need to edit below)
     ========================================================= */

  var MONTHS = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function parseDate(str) {
    var p = str.split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  function prettyDate(str) {
    var d = parseDate(str);
    return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
  }

  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function key(y, m, d) { return y + "-" + pad(m + 1) + "-" + pad(d); }

  /* Image box: logo placeholder behind, real image on top if it exists */
  function imageBox(className, src, alt) {
    var box = el("div", className);
    var fallback = el("img", "ph-logo");
    fallback.src = LOGO;
    fallback.alt = "";
    box.appendChild(fallback);

    if (src) {
      var img = el("img", "ph-img");
      img.alt = alt || "";
      img.loading = "lazy";
      img.addEventListener("error", function () { img.remove(); });
      img.src = src;
      box.appendChild(img);
    }
    return box;
  }

  /* ---------- Latest news ---------- */
  function renderNews() {
    var grid = document.getElementById("news-grid");
    if (!grid) return;
    if (!NEWS.length) {
      grid.appendChild(el("p", "event-empty", "News will be posted soon."));
      return;
    }

    NEWS.forEach(function (item, index) {
      var card = el("article", "news-card" + (index === 0 ? " news-card--featured" : ""));
      card.appendChild(imageBox("news-cover", item.cover, item.title));

      var body = el("div", "news-body");
      body.appendChild(el("time", "news-date", prettyDate(item.date)));
      body.appendChild(el("h3", "news-title", item.title));
      body.appendChild(el("p", "news-summary", item.summary));

      var more = el("div", "news-more");
      more.hidden = true;
      item.body.forEach(function (para) { more.appendChild(el("p", "", para)); });
      body.appendChild(more);

      var btn = el("button", "read-more", "Read more");
      btn.type = "button";
      btn.setAttribute("aria-expanded", "false");
      btn.addEventListener("click", function () {
        var open = more.hidden;
        more.hidden = !open;
        btn.textContent = open ? "Show less" : "Read more";
        btn.setAttribute("aria-expanded", String(open));
      });
      body.appendChild(btn);

      card.appendChild(body);
      grid.appendChild(card);
    });
  }

  /* ---------- Calendar ---------- */
  function renderCalendar() {
    var grid = document.getElementById("cal-grid");
    var title = document.getElementById("cal-title");
    var prev = document.getElementById("cal-prev");
    var next = document.getElementById("cal-next");
    if (!grid) return;

    var today = new Date();
    var year = today.getFullYear();
    var month = today.getMonth();

    // Start on the month of the first upcoming event, if there is one
    var upcoming = upcomingEvents();
    if (upcoming.length) {
      var d = parseDate(upcoming[0].date);
      year = d.getFullYear();
      month = d.getMonth();
    }

    var eventMap = {};
    EVENTS.forEach(function (e) {
      (eventMap[e.date] = eventMap[e.date] || []).push(e);
    });

    function draw() {
      title.textContent = MONTHS[month] + " " + year;
      grid.textContent = "";

      var first = new Date(year, month, 1).getDay();
      var days = new Date(year, month + 1, 0).getDate();

      for (var i = 0; i < first; i++) grid.appendChild(el("span", "cal-cell empty"));

      for (var day = 1; day <= days; day++) {
        var k = key(year, month, day);
        var cell = el("span", "cal-cell", String(day));
        if (eventMap[k]) {
          cell.classList.add("has-event");
          cell.title = eventMap[k].map(function (e) { return e.title; }).join(", ");
        }
        if (year === today.getFullYear() && month === today.getMonth() && day === today.getDate()) {
          cell.classList.add("today");
        }
        grid.appendChild(cell);
      }
    }

    prev.addEventListener("click", function () {
      month--;
      if (month < 0) { month = 11; year--; }
      draw();
    });
    next.addEventListener("click", function () {
      month++;
      if (month > 11) { month = 0; year++; }
      draw();
    });

    draw();
  }

  function upcomingEvents() {
    var now = new Date();
    var start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return EVENTS
      .filter(function (e) { return parseDate(e.date) >= start; })
      .sort(function (a, b) { return parseDate(a.date) - parseDate(b.date); });
  }

  function renderEventList() {
    var list = document.getElementById("event-list");
    if (!list) return;
    var items = upcomingEvents();

    if (!items.length) {
      list.appendChild(el("li", "event-empty", "Event dates will be announced soon."));
      return;
    }

    items.forEach(function (e) {
      var d = parseDate(e.date);
      var li = el("li", "event-item");
      var badge = el("div", "event-badge");
      badge.appendChild(el("strong", "", String(d.getDate())));
      badge.appendChild(el("span", "", MONTHS[d.getMonth()].slice(0, 3)));
      var info = el("div", "event-info");
      info.appendChild(el("p", "event-title", e.title));
      if (e.time) info.appendChild(el("p", "event-time", e.time));
      li.appendChild(badge);
      li.appendChild(info);
      list.appendChild(li);
    });
  }

  function renderVenue() {
    var name = document.getElementById("venue-name");
    var address = document.getElementById("venue-address");
    var map = document.getElementById("venue-map");
    if (!name) return;
    name.textContent = VENUE.name;
    address.textContent = VENUE.address;
    if (VENUE.mapUrl) {
      map.href = VENUE.mapUrl;
      map.hidden = false;
    }
  }

  /* ---------- Gallery slider ---------- */
  function renderSlider() {
    var slider = document.getElementById("slider");
    var track = document.getElementById("slider-track");
    var dotsBox = document.getElementById("slider-dots");
    var prev = document.getElementById("slider-prev");
    var next = document.getElementById("slider-next");
    if (!slider || !SLIDES.length) return;

    var current = 0;
    var timer = null;
    var dots = [];

    SLIDES.forEach(function (slide, i) {
      var item = el("figure", "slide");
      item.appendChild(imageBox("slide-image", slide.src, slide.caption));
      item.appendChild(el("figcaption", "slide-caption", slide.caption));
      track.appendChild(item);

      var dot = el("button", "dot-btn");
      dot.type = "button";
      dot.setAttribute("aria-label", "Go to photo " + (i + 1));
      dot.addEventListener("click", function () { go(i); restart(); });
      dotsBox.appendChild(dot);
      dots.push(dot);
    });

    function go(i) {
      current = (i + SLIDES.length) % SLIDES.length;
      track.style.transform = "translateX(-" + current * 100 + "%)";
      dots.forEach(function (d, n) { d.classList.toggle("active", n === current); });
    }

    var reduce = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function start() {
      if (reduce || timer) return;
      timer = setInterval(function () { go(current + 1); }, SLIDE_SECONDS * 1000);
    }
    function stop() { clearInterval(timer); timer = null; }
    function restart() { stop(); start(); }

    prev.addEventListener("click", function () { go(current - 1); restart(); });
    next.addEventListener("click", function () { go(current + 1); restart(); });

    slider.addEventListener("mouseenter", stop);
    slider.addEventListener("mouseleave", start);
    slider.addEventListener("focusin", stop);
    slider.addEventListener("focusout", start);

    // Swipe on phones
    var startX = null;
    slider.addEventListener("touchstart", function (e) {
      startX = e.touches[0].clientX;
      stop();
    }, { passive: true });
    slider.addEventListener("touchend", function (e) {
      if (startX !== null) {
        var diff = e.changedTouches[0].clientX - startX;
        if (Math.abs(diff) > 40) go(current + (diff < 0 ? 1 : -1));
      }
      startX = null;
      start();
    });

    go(0);
    start();
  }

  /* ---------- Partners ---------- */

  // Only allow normal web links in the "Visit website" button
  function safeUrl(url) {
    return /^https?:\/\//i.test(url || "") ? url : "";
  }

  var partnerPopup = null;

  // Builds the popup once, the first time a partner is clicked
  function buildPartnerPopup() {
    var overlay = el("div", "partner-modal");
    overlay.hidden = true;

    var dialog = el("div", "partner-dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "partner-dialog-title");

    var close = el("button", "partner-close", "\u00D7");
    close.type = "button";
    close.setAttribute("aria-label", "Close partner details");

    var logo = el("img", "partner-dialog-logo");
    logo.alt = "";

    var title = el("h3", "partner-dialog-title");
    title.id = "partner-dialog-title";

    var text = el("p", "partner-dialog-text");

    var visit = el("a", "btn btn-outline partner-visit", "Visit website");
    visit.target = "_blank";
    visit.rel = "noopener";
    visit.hidden = true;

    dialog.appendChild(close);
    dialog.appendChild(logo);
    dialog.appendChild(title);
    dialog.appendChild(text);
    dialog.appendChild(visit);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    var opener = null;

    function hide() {
      overlay.hidden = true;
      document.body.classList.remove("modal-open");
      if (opener && opener.focus) opener.focus();
    }

    close.addEventListener("click", hide);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) hide();
    });

    document.addEventListener("keydown", function (e) {
      if (overlay.hidden) return;
      if (e.key === "Escape") {
        hide();
        return;
      }
      if (e.key === "Tab") {
        var items = visit.hidden ? [close] : [close, visit];
        var first = items[0];
        var last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    return {
      show: function (partner, trigger) {
        opener = trigger;

        title.textContent = partner.name;
        text.textContent = partner.description ||
          "More details about this partner will be added soon.";

        logo.classList.remove("loaded");
        logo.removeAttribute("src");
        if (partner.logo) {
          logo.alt = partner.name;
          logo.onload = function () { logo.classList.add("loaded"); };
          logo.onerror = function () { logo.classList.remove("loaded"); };
          logo.src = partner.logo;
        }

        var link = safeUrl(partner.url);
        if (link) {
          visit.href = link;
          visit.hidden = false;
        } else {
          visit.removeAttribute("href");
          visit.hidden = true;
        }

        overlay.hidden = false;
        document.body.classList.add("modal-open");
        close.focus();
      }
    };
  }

  function openPartner(partner, trigger) {
    if (!partnerPopup) partnerPopup = buildPartnerPopup();
    partnerPopup.show(partner, trigger);
  }

  function renderPartners() {
    var row = document.getElementById("partners-row");
    if (!row) return;

    PARTNERS.forEach(function (p) {
      var tile = el("button", "partner");
      tile.type = "button";
      tile.setAttribute("aria-haspopup", "dialog");
      tile.setAttribute("aria-label", "View details about " + p.name);
      tile.addEventListener("click", function () { openPartner(p, tile); });

      var label = el("span", "partner-name", p.name);
      tile.appendChild(label);

      if (p.logo) {
        var img = el("img", "partner-logo");
        img.alt = "";
        img.addEventListener("load", function () {
          img.classList.add("loaded");
          label.hidden = true;
        });
        img.addEventListener("error", function () { img.remove(); });
        img.src = p.logo;
        tile.appendChild(img);
      }
      row.appendChild(tile);
    });
  }

  /* ---------- Live data from Supabase ----------
     If js/supabase-config.js has real values, the content below is loaded
     from your database (managed in the admin page). If Supabase is not
     connected, or the request fails, the built-in content at the top of
     this file is shown instead. */
  var CFG = window.MEA_CONFIG || {};
  var BASE = (CFG.SUPABASE_URL || "").replace(/\/$/, "");
  var KEY = CFG.SUPABASE_ANON_KEY || "";
  var LIVE = !!BASE && !!KEY && !/YOUR-PROJECT|YOUR-ANON/.test(BASE + KEY);

  function get(path) {
    return fetch(BASE + "/rest/v1/" + path, {
      headers: { apikey: KEY, Authorization: "Bearer " + KEY }
    }).then(function (r) {
      if (!r.ok) throw new Error("Request failed (" + r.status + ")");
      return r.json();
    });
  }

  function loadLive() {
    return Promise.all([
      get("news_posts?select=*&is_published=eq.true&order=published_at.desc,created_at.desc"),
      get("events?select=*&is_active=eq.true&order=event_date.asc"),
      get("gallery_slides?select=*&is_active=eq.true&order=sort_order.asc,created_at.asc"),
      get("partners?select=*&is_active=eq.true&order=sort_order.asc,name.asc"),
      get("settings?select=key,value&key=in.(venue_name,venue_address,venue_map_url)")
    ]).then(function (r) {
      NEWS = r[0].map(function (n) {
        var paras = (n.body || "").split(/\n\s*\n/).map(function (t) { return t.trim(); })
          .filter(Boolean);
        var summary = n.summary || (paras[0] || "").slice(0, 140);
        return { title: n.title, date: n.published_at, cover: n.cover_url || "", summary: summary, body: paras };
      });
      EVENTS = r[1].map(function (e) {
        return { date: e.event_date, title: e.title, time: e.event_time || "" };
      });
      SLIDES = r[2].map(function (x) { return { src: x.image_url, caption: x.caption || "" }; });
      PARTNERS = r[3].map(function (p) {
        return {
          name: p.name,
          logo: p.logo_url || "",
          url: p.website_url || "",
          description: p.description || ""
        };
      });
      var v = {};
      r[4].forEach(function (row) { v[row.key] = row.value; });
      VENUE = {
        name: v.venue_name || VENUE.name,
        address: v.venue_address || VENUE.address,
        mapUrl: v.venue_map_url || ""
      };
    });
  }

  function hideSection(id) {
    var sec = document.getElementById(id);
    if (sec) sec.hidden = true;
    var link = document.querySelector('.jump-links a[href="#' + id + '"]');
    if (link) link.hidden = true;
  }

  function renderAll() {
    renderNews();
    renderCalendar();
    renderEventList();
    renderVenue();
    if (SLIDES.length) renderSlider(); else hideSection("gallery");
    if (PARTNERS.length) renderPartners(); else hideSection("partners");
  }

  if (LIVE) loadLive().then(renderAll, renderAll);
  else renderAll();
})();