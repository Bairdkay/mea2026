/* =========================================================
   Voting window (Malawi time, UTC+02:00)
   - Before OPEN_AT : countdown banner, voting locked
   - Between        : voting open, nothing shown
   - After CLOSE_AT : "Voting is closed" banner, voting locked
   All automatic. No refresh or redeploy needed.
   ========================================================= */
(function () {
  var OPEN_AT  = new Date('2026-11-20T12:00:00+02:00').getTime(); // opens: 20 Nov, 12:00 noon
  var CLOSE_AT = new Date('2026-12-10T23:59:59+02:00').getTime(); // closes: 10 Dec, 11:59 PM

  var lockMessage = '';
  var banner = null;
  var timer = null;

  /* ---------- Styles ---------- */
  var style = document.createElement('style');
  style.textContent =
    '.vote-countdown{width:calc(100% - 28px) !important;max-width:340px !important;margin:4px auto 18px !important;padding:8px 12px !important;' +
    'border:1px solid rgba(212,175,55,.6);border-radius:12px;text-align:center;' +
    'background:linear-gradient(160deg,rgba(212,175,55,.14),rgba(212,175,55,.04))}' +
    '.vote-countdown p{margin:0 !important}' +
    '.vote-countdown .vote-countdown-label{font-size:.6rem !important;letter-spacing:1.5px !important;line-height:1.3 !important;text-transform:uppercase;color:#d4af37}' +
    '.vote-countdown .vote-countdown-time{margin-top:2px !important;font-size:1.25rem !important;font-weight:800;line-height:1.2 !important;' +
    'letter-spacing:1px !important;color:#f1d27a;font-variant-numeric:tabular-nums}' +
    '.vote-countdown .vote-countdown-note{margin-top:2px !important;font-size:.68rem !important;line-height:1.35 !important;color:rgba(255,255,255,.65)}' +
    'body.voting-locked .vote-submit{opacity:.35;cursor:not-allowed}' +
    'body.voting-locked .nominee-card{cursor:not-allowed}';
  document.head.appendChild(style);

  /* ---------- Helpers ---------- */
  function showToast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () { t.classList.remove('show'); }, 2500);
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function ensureBanner() {
    if (banner) return banner;
    banner = document.createElement('div');
    banner.className = 'vote-countdown';
    banner.setAttribute('role', 'timer');
    var hero = document.querySelector('.page-hero');
    if (hero && hero.parentNode) {
      hero.parentNode.insertBefore(banner, hero.nextSibling);
    } else {
      document.body.insertBefore(banner, document.body.firstChild);
    }
    return banner;
  }

  /* ---------- Block picking + submitting while locked ---------- */
  document.addEventListener('click', function (e) {
    if (!document.body.classList.contains('voting-locked')) return;
    if (e.target.closest && e.target.closest('#vote-submit, .nominee-card, .voter-go')) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      showToast(lockMessage);
    }
  }, true); // capture phase: runs before categories.js

  /* ---------- States ---------- */
  function setClosed() {
    clearInterval(timer);
    lockMessage = 'Voting is closed. Thank you for taking part.';
    document.body.classList.add('voting-locked');
    ensureBanner().innerHTML =
      '<p class="vote-countdown-label">Voting is closed</p>' +
      '<p class="vote-countdown-note">Thank you for taking part.</p>';
  }

  function setBefore() {
    lockMessage = 'Voting opens at 12:00 PM. Please come back then.';
    document.body.classList.add('voting-locked');
    ensureBanner().innerHTML =
      '<p class="vote-countdown-label">Voting opens today at 12:00 PM</p>' +
      '<p class="vote-countdown-time" id="vote-countdown-time">--:--:--</p>' +
      '<p class="vote-countdown-note">Browse now. Voting unlocks automatically.</p>';

    function tick() {
      var left = OPEN_AT - Date.now();
      if (left <= 0) {
        clearInterval(timer);
        document.body.classList.remove('voting-locked');
        ensureBanner().innerHTML =
          '<p class="vote-countdown-label">Voting is now open</p>' +
          '<p class="vote-countdown-note">Loading voting...</p>';
        // Reload so the page picks up the server's voting status.
        // Random delay spreads the load when many people are waiting.
        setTimeout(function () { window.location.reload(); }, 500 + Math.random() * 4000);
        return;
      }
      var s = Math.floor(left / 1000);
      var el = document.getElementById('vote-countdown-time');
      if (el) el.textContent =
        pad(Math.floor(s / 3600)) + ':' + pad(Math.floor((s % 3600) / 60)) + ':' + pad(s % 60);
    }
    timer = setInterval(tick, 1000);
    tick();
  }

  function watchForClose() {
    // Voting is open: check every 30 seconds whether closing time has come
    timer = setInterval(function () {
      if (Date.now() >= CLOSE_AT) setClosed();
    }, 30000);
  }

  /* ---------- Start ---------- */
  var now = Date.now();
  if (now < OPEN_AT) {
    setBefore();
  } else if (now >= CLOSE_AT) {
    setClosed();
  } else {
    watchForClose();
  }
})();