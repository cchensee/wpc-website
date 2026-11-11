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
      if (group || BLOCKS.indexOf(child.tagName) !== -1 || child.children.length === 0 ||
          child.classList.contains('photo-frame')) {
        out.push(child);
      } else {
        collect(child, out);
      }
    }
  }

  function init() {
    // Frame photos first so a photo reveals as one piece and its hover zoom isn't overridden.
    wrapPhotos();
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

    markHeroLines();
    enhanceHeader();
    enhanceLinks();
    parallax();
  }

  // The short white rule above each banner title draws outward instead of fading up.
  function markHeroLines() {
    document.querySelectorAll('section > div > span:first-child[data-reveal]').forEach(function (line) {
      if (line.offsetHeight > 2) return;
      line.setAttribute('data-line', '');
      line.style.transformOrigin = getComputedStyle(line.parentElement).alignItems === 'center' ? 'center' : 'left';
    });
  }

  // Header stays pinned and tightens up once the page is scrolled.
  function enhanceHeader() {
    var header = document.querySelector('header');
    if (!header) return;
    header.classList.add('site-header');
    var scrolled = false;
    function check() {
      var now = window.scrollY > 24;
      if (now !== scrolled) { scrolled = now; header.classList.toggle('is-scrolled', now); }
    }
    window.addEventListener('scroll', check, { passive: true });
    check();
  }

  // Menu links get a sliding underline; text links ("Meet the Team") get an arrow.
  function enhanceLinks() {
    document.querySelectorAll('header nav > div > a').forEach(function (a) { a.classList.add('nav-link'); });
    document.querySelectorAll('section a').forEach(function (a) {
      var st = a.getAttribute('style') || '';
      if (st.indexOf('border-bottom: 1px solid') !== -1 && st.indexOf('text-transform: uppercase') !== -1) {
        a.classList.add('cta-link');
      }
    });
    // Fade out before moving to another page on the site.
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.target && a.target !== '_self') return;
      var url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname || !/\.html?$|\/$/.test(url.pathname)) return;
      e.preventDefault();
      document.documentElement.classList.add('is-leaving');
      setTimeout(function () { location.href = url.href; }, 180);
    });
    window.addEventListener('pageshow', function () {
      document.documentElement.classList.remove('is-leaving');
    });
  }

  // Team and service photos sit in a clipping frame so they can zoom slightly on hover.
  function wrapPhotos() {
    document.querySelectorAll('img[src^="images/team/"], #services article > img').forEach(function (img) {
      var frame = document.createElement('div');
      frame.className = 'photo-frame';
      frame.style.marginBottom = img.style.marginBottom;
      img.style.marginBottom = '0';
      img.parentNode.insertBefore(frame, img);
      frame.appendChild(img);
    });
  }

  // Parallax on hero background images.
  function parallax() {
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

/* Phone menu: on small screens the nav links fold behind a menu button.
   Kept separate from the animations so it works with reduced motion too. */
(function () {
  function init() {
    var header = document.querySelector('header');
    var nav = header && header.querySelector('nav');
    var links = nav && nav.querySelector('nav > div');
    if (!links) return;
    links.id = 'site-menu';
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'menu-toggle';
    button.setAttribute('aria-controls', 'site-menu');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', 'Open menu');
    button.innerHTML = '<span></span><span></span>';
    nav.insertBefore(button, links);
    header.classList.add('has-menu');
    function setOpen(open) {
      header.classList.toggle('menu-open', open);
      button.setAttribute('aria-expanded', String(open));
      button.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }
    button.addEventListener('click', function () {
      setOpen(!header.classList.contains('menu-open'));
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && header.classList.contains('menu-open')) { setOpen(false); button.focus(); }
    });
    window.matchMedia('(min-width: 721px)').addEventListener('change', function (mq) {
      if (mq.matches) setOpen(false);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
