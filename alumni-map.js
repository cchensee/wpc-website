/* Alumni route map: a dotted world map with arcs drawn from Waterloo to every
   city where WPC alumni work. Arcs draw in when the map scrolls into view.

   EDIT THE DATA HERE: the cities where WPC alumni work. */
var WPC_CITIES = [
  { name: 'Toronto', lat: 43.6532, lon: -79.3832, count: 1 },
  { name: 'New York', lat: 40.7128, lon: -74.006, count: 1 },
  { name: 'Boston', lat: 42.3601, lon: -71.0589, count: 1 },
  { name: 'Calgary', lat: 51.0447, lon: -114.0719, count: 1 },
  { name: 'Victoria', lat: 48.4284, lon: -123.3656, count: 1 },
  { name: 'San Francisco', lat: 37.7749, lon: -122.4194, count: 1 },
  { name: 'Los Angeles', lat: 34.0522, lon: -118.2437, count: 1 },
  { name: 'London', lat: 51.5072, lon: -0.1276, count: 1 },
  { name: 'Hong Kong', lat: 22.3193, lon: 114.1694, count: 1 }
];

(function () {
  var HOME = { name: 'Waterloo', lat: 43.4643, lon: -80.5204 };
  var wrap = document.getElementById('route-map');
  if (!wrap || !window.d3 || !window.topojson) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canvas = wrap.querySelector('canvas');
  var svg = d3.select(wrap).select('svg');
  var ctx = canvas.getContext('2d');
  var land = null, drawn = false, width = 0, height = 0;
  var cities = WPC_CITIES.slice().sort(function (a, b) { return b.count - a.count; });

  // Legend under the map: a single line of cities and counts.
  var legend = document.getElementById('route-legend');
  if (legend) {
    legend.innerHTML = cities.map(function (c, i) {
      return '<span class="route-city" data-i="' + i + '">' + c.name + ' <b>' + c.count + '</b></span>';
    }).join('');
    legend.addEventListener('mouseover', function (e) {
      var el = e.target.closest('.route-city');
      if (el) highlight(+el.getAttribute('data-i'));
    });
    legend.addEventListener('mouseleave', function () { highlight(-1); });
  }

  function render() {
    width = wrap.clientWidth;
    if (!width || !land) return;
    // Equirectangular world, centred on 10°E, cropped to 76°N–48°S (drops Antarctica).
    var TOP = 76, BOTTOM = -48;
    height = Math.round(width * (TOP - BOTTOM) / 360);
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = width * dpr; canvas.height = height * dpr;
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var k = width / (2 * Math.PI);
    var proj = d3.geoEquirectangular().rotate([-10, 0]).scale(k).translate([width / 2, k * TOP * Math.PI / 180]);

    // Dots: sample the land shape on a fixed grid.
    var off = document.createElement('canvas');
    off.width = width; off.height = height;
    var octx = off.getContext('2d');
    octx.fillStyle = '#000';
    octx.beginPath(); d3.geoPath(proj, octx)(land); octx.fill();
    var px = octx.getImageData(0, 0, width, height).data;
    var step = width < 600 ? 5 : 7;
    dotR = width < 600 ? 0.9 : 1.25;
    dots = [];
    for (var y = step / 2; y < height; y += step) {
      for (var x = step / 2; x < width; x += step) {
        if (px[((y | 0) * width + (x | 0)) * 4 + 3] > 0) dots.push({ x: x, y: y, lift: 0 });
      }
    }
    drawDots();

    // Arcs and markers.
    svg.attr('viewBox', '0 0 ' + width + ' ' + height).style('height', height + 'px');
    svg.selectAll('*').remove();
    var h = proj([HOME.lon, HOME.lat]);
    var arcs = svg.append('g');
    cities.forEach(function (c, i) {
      var p = proj([c.lon, c.lat]);
      var dx = p[0] - h[0], dy = p[1] - h[1], dist = Math.sqrt(dx * dx + dy * dy);
      var mx = (h[0] + p[0]) / 2, my = (h[1] + p[1]) / 2 - Math.min(160, dist * 0.32 + 6);
      var d = 'M' + h[0] + ',' + h[1] + ' Q' + mx + ',' + my + ' ' + p[0] + ',' + p[1];
      arcs.append('path')
        .attr('id', 'route-' + i)
        .attr('class', 'route-arc' + (drawn || reduce ? ' is-drawn' : ''))
        .attr('data-i', i)
        .attr('d', d)
        .attr('pathLength', 1)
        .style('transition-delay', (reduce ? 0 : 0.15 + i * 0.12) + 's');

      // A small light travels along each route, on a loop.
      if (!reduce) {
        var pulse = svg.append('circle').attr('class', 'route-pulse').attr('data-i', i).attr('r', 2);
        pulse.append('animateMotion')
          .attr('dur', (6.5 + i * 0.6) + 's').attr('repeatCount', 'indefinite')
          .attr('begin', (1.8 + i * 0.4) + 's').attr('keyPoints', '0;1').attr('keyTimes', '0;1')
          .attr('calcMode', 'spline').attr('keySplines', '0.45 0 0.55 1')
          .append('mpath').attr('href', '#route-' + i);
      }

      var g = svg.append('g').attr('class', 'route-city-pt').attr('data-i', i).attr('tabindex', 0)
        .attr('role', 'button').attr('aria-label', c.name);
      g.append('circle').attr('class', 'route-hit').attr('cx', p[0]).attr('cy', p[1]).attr('r', 16);
      g.append('circle').attr('class', 'route-dot').attr('data-i', i).attr('cx', p[0]).attr('cy', p[1]).attr('r', 3);
      var right = p[0] < width - 140;
      g.append('text').attr('class', 'route-tag')
        .attr('x', p[0] + (right ? 12 : -12)).attr('y', p[1] - 10)
        .attr('text-anchor', right ? 'start' : 'end').text(c.name.toUpperCase());
      g.on('mouseenter focus', function () { highlight(i); })
        .on('mouseleave blur', function () { highlight(-1); })
        .on('click', function (e) { e.stopPropagation(); highlight(active === i ? -1 : i); });
    });
    highlight(active);
    svg.append('circle').attr('class', 'route-home').attr('cx', h[0]).attr('cy', h[1]).attr('r', 4.5);
  }

  var active = -1;
  // ---- Dot field: dots near the cursor rise up and swell, then settle back. ----
  var dots = [], dotR = 1.25, mouse = null, looping = false;
  var RADIUS = 40, LIFT = 8;

  function drawDots() {
    ctx.clearRect(0, 0, width, height);
    var base = new Path2D(), near = new Path2D();
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i], r = dotR * (1 + d.lift * 1.1), y = d.y - d.lift * LIFT;
      var p = d.lift > 0.08 ? near : base;
      p.moveTo(d.x + r, y); p.arc(d.x, y, r, 0, 2 * Math.PI);
    }
    ctx.fillStyle = '#41597C'; ctx.fill(base);
    ctx.fillStyle = '#A9BBD3'; ctx.fill(near);
  }

  function stepDots() {
    var moving = false;
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i], target = 0;
      if (mouse && active < 0) {
        var dx = d.x - mouse.x, dy = d.y - mouse.y, dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < RADIUS) { var t = 1 - dist / RADIUS; target = t * t * (3 - 2 * t); }
      }
      var next = d.lift + (target - d.lift) * 0.07;
      if (Math.abs(next - d.lift) > 0.001) moving = true;
      d.lift = Math.abs(next) < 0.001 ? 0 : next;
    }
    drawDots();
    if (moving || mouse) requestAnimationFrame(stepDots); else looping = false;
  }

  function wake() { if (!looping && !reduce) { looping = true; requestAnimationFrame(stepDots); } }
  wrap.addEventListener('pointermove', function (e) {
    var b = canvas.getBoundingClientRect();
    mouse = { x: e.clientX - b.left, y: e.clientY - b.top };
    wake();
  });
  wrap.addEventListener('pointerleave', function () { mouse = null; wake(); });

  function highlight(i) {
    active = i;
    wake();
    svg.classed('has-active', i >= 0);
    svg.selectAll('.route-arc, .route-pulse, .route-city-pt').classed('is-active', function () {
      return +this.getAttribute('data-i') === i;
    });
    if (legend) Array.prototype.forEach.call(legend.children, function (el, k) {
      el.classList.toggle('is-active', k === i);
    });
  }

  function drawIn() {
    if (drawn) return;
    drawn = true;
    svg.selectAll('.route-arc').classed('is-drawn', true);
  }

  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { drawIn(); io.disconnect(); }
    }, { threshold: 0.35 });
    io.observe(wrap);
  } else {
    drawn = true;
  }

  wrap.addEventListener('click', function () { highlight(-1); });

  var t;
  window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(render, 150); });
  fetch('data/land-110m.json').then(function (res) { return res.json(); }).then(function (topo) {
    land = topojson.feature(topo, topo.objects.land);
    render();
  });
})();
