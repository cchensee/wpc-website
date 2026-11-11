/* Scroll animations: content fades up as it enters the viewport, and hero
   background images drift slowly (parallax). Loaded in <head> so content is
   hidden before first paint; without JS everything simply shows. */
(function () {
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  document.documentElement.classList.add('js');

  var BLOCKS = 'H1,H2,H3,H4,P,IMG,A,BLOCKQUOTE,TABLE,FORM,BUTTON';
  var STAGGER_MS = 50;
  var MAX_DELAY_MS = 250;

  // A grid or wrapping row of 3+ items is a set of cards: reveal each card whole.
  function isCardGroup(el) {
    if (el.children.length < 3) return false;
    var cs = getComputedStyle(el);
    return cs.display === 'grid' ||
      (cs.display === 'flex' && cs.flexWrap === 'wrap' && cs.flexDirection.indexOf('row') === 0);
  }

  function collect(node, out) {
    var group = isCardGroup(node);
    for (var i = 0; i < node.children.length; i++) {
      var child = node.children[i];
      var cs = getComputedStyle(child);
      if (cs.position === 'absolute' || cs.display === 'none') continue;
      if (group || BLOCKS.indexOf(child.tagName) !== -1 || child.children.length === 0) {
        out.push(child);
      } else {
        collect(child, out);
      }
    }
  }

  function init() {
    var targets = [];
    document.querySelectorAll('section').forEach(function (section) {
      collect(section, targets);
    });
    targets.forEach(function (el) { el.setAttribute('data-reveal', ''); });

    // Once shown, hand the element back to its own transitions (e.g. hover effects).
    targets.forEach(function (el) {
      el.addEventListener('transitionend', function (ev) {
        if (ev.target !== el || !el.classList.contains('is-visible')) return;
        el.classList.add('is-settled');
        el.style.transitionDelay = '';
      });
    });

    // Replays on the way down: elements reset only after leaving below the viewport,
    // so scrolling back up never re-animates content you've already seen.
    var observer = new IntersectionObserver(function (entries) {
      var i = 0;
      entries.forEach(function (entry) {
        var el = entry.target;
        if (entry.isIntersecting) {
          el.style.transitionDelay = Math.min(i++ * STAGGER_MS, MAX_DELAY_MS) + 'ms';
          el.classList.add('is-visible');
        } else if (entry.boundingClientRect.top > 0) {
          el.style.transitionDelay = '';
          el.classList.remove('is-visible', 'is-settled');
        }
      });
    }, { rootMargin: '0px 0px -4% 0px', threshold: 0 });
    targets.forEach(function (el) { observer.observe(el); });

    // Parallax on hero background images.
    var heroes = [];
    document.querySelectorAll('section > img').forEach(function (img) {
      if (getComputedStyle(img).position !== 'absolute') return;
      img.setAttribute('data-parallax', '');
      heroes.push(img);
    });
    if (!heroes.length) return;

    var ticking = false;
    function update() {
      heroes.forEach(function (img) {
        var rect = img.parentElement.getBoundingClientRect();
        if (rect.bottom < 0) return;
        img.style.transform = 'translate3d(0, ' + (Math.max(0, -rect.top) * 0.3) + 'px, 0) scale(1.12)';
      });
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
