/* MEA animations: the few effects CSS cannot do alone.
   Safe to load on every page; each part checks that the elements exist first. */
(function () {
  'use strict';

  // Do nothing for people who asked their device to reduce motion.
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /* 1. Scroll reveal: big blocks fade up the first time they scroll into view. */
  if ('IntersectionObserver' in window) {
    var targets = document.querySelectorAll(
      '.about-card, .sponsors, .block-title, .calendar-card, .info-card, .slider, .setting-card'
    );
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        el.classList.add('in-view');
        io.unobserve(el);
        // After the effect finishes, remove the helper classes so the element
        // goes back to its normal styles (and hover effects work normally).
        setTimeout(function () { el.classList.remove('js-reveal', 'in-view'); }, 900);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    targets.forEach(function (el) {
      el.classList.add('js-reveal');
      io.observe(el);
    });
  }

  /* 2. Countdown: the seconds box gives a tiny beat every time the number changes. */
  var seconds = document.getElementById('seconds');
  if (seconds && seconds.parentElement && 'MutationObserver' in window) {
    var box = seconds.parentElement;
    new MutationObserver(function () {
      box.classList.remove('tick');
      void box.offsetWidth;              // forces the browser to restart the animation
      box.classList.add('tick');
    }).observe(seconds, { childList: true, characterData: true, subtree: true });
  }

  /* 3. Header: add a shadow once the page is scrolled. */
  var header = document.querySelector('.header');
  if (header) {
    var onScroll = function () { header.classList.toggle('scrolled', window.scrollY > 10); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
})();
