/* =========================================================
   Voting lock: opens automatically at 12:00 noon (Malawi time)
   Before that: countdown banner, nominees and Submit are locked.
   At noon: unlocks by itself, no refresh needed.
   ========================================================= */
(function () {
  // 20 Nov 2026, 12:00 noon Central Africa Time (UTC+02:00)
  var OPEN_AT = new Date('2026-11-20T12:00:00+02:00').getTime();

  if (Date.now() >= OPEN_AT) return; // already open, do nothing

  /* ---------- Styles (injected, so no CSS file edit needed) ---------- */
  var style = document.createElement('style');
  style.textContent =
    '.vote-countdown{max-width:640px;margin:10px auto 0;padding:16px 20px;' +
    'border:1px solid rgba(212,175,55,.6);border-radius:16px;text-align:center;' +
    'background:linear-gradient(160deg,rgba(212,175,55,.14),rgba(212,175,55,.04));' +
    'transition:opacity .6s ease}' +
    '.vote-countdown-label{font-size:.8rem;letter-spacing:3px;text-transform:uppercase;color:#d4af37}' +
    '.vote-countdown-time{margin-top:6px;font-size:clamp(1.8rem,7vw,2.6rem);font-weight:800;' +
    'letter-spacing:2px;color:#f1d27a;font-variant-numeric:tabular-nums}' +
    '.vote-countdown-note{margin-top:4px;font-size:.9rem;color:rgba(255,255,255,.7)}' +
    '.vote-countdown.is-open{border-color:#d4af37}' +
    'body.voting-locked .vote-submit{opacity:.35;cursor:not-allowed}' +
    'body.voting-locked .nominee-card{cursor:not-allowed}';
  document.head.appendChild(style);

  /* ---------- Countdown banner ---------- */
  var banner = document.createElement('div');
  banner.className = 'vote-countdown';
  banner.setAttribute('role', 'timer');
  banner.innerHTML =
    '<p class="vote-countdown-label">Voting opens today at 12:00 PM</p>' +
    '<p class="vote-countdown-time" id="vote-countdown-time">--:--:--</p>' +
    '<p class="vote-countdown-note">You can browse the categories now. Voting unlocks automatically.</p>';

  var hero = document.querySelector('.page-hero');
  if (hero && hero.parentNode) {
    hero.parentNode.insertBefore(banner, hero.nextSibling);
  } else {
    document.body.insertBefore(banner, document.body.firstChild);
  }

  document.body.classList.add('voting-locked');

  /* ---------- Block picking + submitting while locked ---------- */
  function showToast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () { t.classList.remove('show'); }, 2500);
  }

  document.addEventListener('click', function (e) {
    if (!document.body.classList.contains('voting-locked')) return;
    if (e.target.closest && e.target.closest('#vote-submit, .nominee-card')) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      showToast('Voting opens at 12:00 PM. Please come back then.');
    }
  }, true); // capture phase: runs before categories.js

  /* ---------- Tick ---------- */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function tick() {
    var left = OPEN_AT - Date.now();
    var timeEl = document.getElementById('vote-countdown-time');

    if (left <= 0) {
      clearInterval(timer);
      document.body.classList.remove('voting-locked');
      banner.classList.add('is-open');
      banner.innerHTML =
        '<p class="vote-countdown-label">Voting is now open</p>' +
        '<p class="vote-countdown-note">Choose a category and cast your vote.</p>';
      setTimeout(function () { banner.style.opacity = '0'; }, 8000);
      setTimeout(function () { banner.style.display = 'none'; }, 8700);
      return;
    }

    var s = Math.floor(left / 1000);
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var sec = s % 60;
    if (timeEl) timeEl.textContent = pad(h) + ':' + pad(m) + ':' + pad(sec);
  }

  var timer = setInterval(tick, 1000);
  tick();
})();