/* Grafik SVG ringan tanpa library: line, bars, sparkline, ring. */
var Charts = (function () {
  var NS = 'http://www.w3.org/2000/svg';

  function niceStep(range, ticks) {
    var raw = range / Math.max(1, ticks);
    var mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    var f = raw / mag;
    var step = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return step * mag;
  }
  function scale(min, max, ticks) {
    if (min === max) { max = min + 1; if (min > 0) min = Math.max(0, min - 1); }
    var step = niceStep(max - min, ticks);
    var lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    var out = [];
    for (var v = lo; v <= hi + step / 2; v += step) out.push(+v.toFixed(10));
    return { min: lo, max: hi, ticks: out };
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function color(c) { return c && c.indexOf('--') === 0 ? css(c) : c; }

  function observe(el, draw) {
    draw();
    if (el._ro) el._ro.disconnect();
    if (window.ResizeObserver) {
      var w = el.clientWidth;
      el._ro = new ResizeObserver(function () { if (Math.abs(el.clientWidth - w) > 4) { w = el.clientWidth; draw(); } });
      el._ro.observe(el);
    }
  }

  function xTickIdx(n, W) {
    var maxTicks = Math.max(2, Math.floor(W / 70));
    if (n <= maxTicks) return Array.from({ length: n }, function (_, i) { return i; });
    var step = Math.ceil((n - 1) / (maxTicks - 1)), out = [];
    for (var i = 0; i < n; i += step) out.push(i);
    if (out[out.length - 1] !== n - 1) { if (n - 1 - out[out.length - 1] < step / 2) out.pop(); out.push(n - 1); }
    return out;
  }

  function tooltip(el) {
    var tip = el.querySelector('.chart-tip');
    if (!tip) { tip = document.createElement('div'); tip.className = 'chart-tip hidden'; el.appendChild(tip); }
    return tip;
  }

  /**
   * Line chart.
   * o = { labels:[], series:[{name, color, values:[], dashed}], height, fmtY, fmtX, zero:true }
   */
  function line(el, o) {
    el.classList.add('chart');
    observe(el, function () {
      var W = el.clientWidth || 600, H = o.height || 220;
      var pad = { l: 48, r: 14, t: 14, b: 28 };
      var n = o.labels.length;
      var vals = [];
      o.series.forEach(function (s) { s.values.forEach(function (v) { if (v != null && isFinite(v)) vals.push(v); }); });
      if (!vals.length) vals = [0];
      var lo = o.zero === false ? Math.min.apply(null, vals) : Math.min(0, Math.min.apply(null, vals));
      var sc = scale(lo, Math.max.apply(null, vals), 4);
      var iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
      var X = function (i) { return pad.l + (n <= 1 ? iw / 2 : i * iw / (n - 1)); };
      var Y = function (v) { return pad.t + (1 - (v - sc.min) / (sc.max - sc.min || 1)) * ih; };
      var fy = o.fmtY || String, fx = o.fmtX || String;
      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" height="' + H + '" role="img" aria-label="' + esc(o.aria || 'Grafik') + '">';
      sc.ticks.forEach(function (t) {
        var y = Y(t);
        s += '<line class="' + (t === sc.min ? 'baseline' : 'gridline') + '" x1="' + pad.l + '" x2="' + (W - pad.r) + '" y1="' + y + '" y2="' + y + '"/>';
        s += '<text class="tick num" x="' + (pad.l - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + esc(fy(t, true)) + '</text>';
      });
      xTickIdx(n, iw).forEach(function (i) {
        s += '<text class="tick" x="' + X(i) + '" y="' + (H - 8) + '" text-anchor="' + (i === 0 && n > 1 ? 'start' : i === n - 1 && n > 1 ? 'end' : 'middle') + '">' + esc(fx(o.labels[i])) + '</text>';
      });
      o.series.forEach(function (ser) {
        var c = color(ser.color), d = '', pen = false, area = '';
        ser.values.forEach(function (v, i) {
          if (v == null || !isFinite(v)) { pen = false; return; }
          d += (pen ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1);
          pen = true;
        });
        if (o.area && !ser.dashed && d) {
          var first = ser.values.findIndex(function (v) { return v != null; });
          var last = ser.values.length - 1 - ser.values.slice().reverse().findIndex(function (v) { return v != null; });
          area = '<path d="' + d + 'L' + X(last) + ' ' + Y(sc.min) + 'L' + X(first) + ' ' + Y(sc.min) + 'Z" fill="' + c + '" opacity=".10"/>';
        }
        s += area + '<path d="' + d + '" fill="none" stroke="' + c + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"' + (ser.dashed ? ' stroke-dasharray="5 4"' : '') + '/>';
        if (n <= 1 || ser.values.filter(function (v) { return v != null; }).length === 1) {
          ser.values.forEach(function (v, i) { if (v != null) s += '<circle cx="' + X(i) + '" cy="' + Y(v) + '" r="4" fill="' + c + '"/>'; });
        }
      });
      s += '<line class="crosshair hidden" x1="0" x2="0" y1="' + pad.t + '" y2="' + (H - pad.b) + '"/>';
      s += '<g class="dots"></g><rect class="hit" x="' + pad.l + '" y="0" width="' + iw + '" height="' + H + '" fill="transparent"/></svg>';
      el.innerHTML = s;
      var svg = el.querySelector('svg'), tip = tooltip(el), cross = svg.querySelector('.crosshair'), dots = svg.querySelector('.dots');
      function move(ev) {
        var r = svg.getBoundingClientRect();
        var px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
        var i = n <= 1 ? 0 : Math.round((px * (W / r.width) - pad.l) / (iw / (n - 1)));
        i = Math.max(0, Math.min(n - 1, i));
        var x = X(i);
        cross.setAttribute('x1', x); cross.setAttribute('x2', x); cross.classList.remove('hidden');
        var html = '<div class="t">' + esc((o.fmtTip || fx)(o.labels[i])) + '</div>', dh = '', topY = H;
        o.series.forEach(function (ser) {
          var v = ser.values[i]; if (v == null) return;
          var c = color(ser.color);
          topY = Math.min(topY, Y(v));
          dh += '<circle cx="' + x + '" cy="' + Y(v) + '" r="4.5" fill="' + c + '" stroke="' + css('--surface') + '" stroke-width="2"/>';
          html += '<div class="r"><span class="sw" style="background:' + c + '"></span>' + esc(ser.name) + ': ' + esc(fy(v)) + '</div>';
        });
        dots.innerHTML = dh;
        tip.innerHTML = html; tip.classList.remove('hidden');
        tip.style.left = Math.max(70, Math.min(r.width - 70, x * r.width / W)) + 'px';
        tip.style.top = (topY * r.height / H) + 'px';
      }
      function leave() { cross.classList.add('hidden'); dots.innerHTML = ''; tip.classList.add('hidden'); }
      var hit = svg.querySelector('.hit');
      hit.addEventListener('mousemove', move); hit.addEventListener('touchmove', move, { passive: true }); hit.addEventListener('touchstart', move, { passive: true });
      hit.addEventListener('mouseleave', leave); hit.addEventListener('touchend', function () { setTimeout(leave, 1500); });
    });
  }

  /**
   * Bar chart (+ garis target opsional).
   * o = { labels:[], values:[], target:[]?, color, height, fmtY, fmtX, name, targetName }
   */
  function bars(el, o) {
    el.classList.add('chart');
    observe(el, function () {
      var W = el.clientWidth || 600, H = o.height || 220;
      var pad = { l: 40, r: 10, t: 14, b: 28 };
      var n = o.labels.length;
      var all = o.values.concat(o.target || []).filter(function (v) { return v != null && isFinite(v); });
      var sc = scale(Math.min(0, Math.min.apply(null, all.concat([0]))), Math.max.apply(null, all.concat([1])), 4);
      var iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
      var bw = iw / Math.max(1, n);
      var barW = Math.max(3, Math.min(36, bw - 2 - bw * 0.25));
      var X = function (i) { return pad.l + i * bw + bw / 2; };
      var Y = function (v) { return pad.t + (1 - (v - sc.min) / (sc.max - sc.min || 1)) * ih; };
      var fy = o.fmtY || String, fx = o.fmtX || String;
      var c = color(o.color || '--accent');
      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" height="' + H + '" role="img" aria-label="' + esc(o.aria || 'Grafik batang') + '">';
      sc.ticks.forEach(function (t) {
        var y = Y(t);
        s += '<line class="' + (t === 0 ? 'baseline' : 'gridline') + '" x1="' + pad.l + '" x2="' + (W - pad.r) + '" y1="' + y + '" y2="' + y + '"/>';
        s += '<text class="tick num" x="' + (pad.l - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + esc(fy(t, true)) + '</text>';
      });
      xTickIdx(n, iw).forEach(function (i) {
        s += '<text class="tick" x="' + X(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(fx(o.labels[i])) + '</text>';
      });
      var y0 = Y(0);
      o.values.forEach(function (v, i) {
        if (v == null || !v) return;
        var y = Y(v), h = Math.abs(y0 - y), r = Math.min(4, barW / 2, h);
        var x = X(i) - barW / 2;
        var col = o.colorFn ? color(o.colorFn(v, i)) : c;
        if (v > 0) s += '<path d="M' + x + ' ' + y0 + 'V' + (y + r) + 'Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + 'H' + (x + barW - r) + 'Q' + (x + barW) + ' ' + y + ' ' + (x + barW) + ' ' + (y + r) + 'V' + y0 + 'Z" fill="' + col + '"/>';
        else s += '<rect x="' + x + '" y="' + y0 + '" width="' + barW + '" height="' + h + '" fill="' + col + '" rx="2"/>';
      });
      if (o.target) {
        var d = '';
        o.target.forEach(function (t, i) {
          if (t == null) return;
          d += 'M' + (X(i) - bw / 2 + 1) + ' ' + Y(t) + 'H' + (X(i) + bw / 2 - 1);
        });
        s += '<path d="' + d + '" stroke="' + css('--text-2') + '" stroke-width="2" stroke-dasharray="4 3" fill="none"/>';
      }
      s += '<rect class="hl hidden" y="' + pad.t + '" height="' + ih + '" width="' + bw + '" fill="' + css('--text') + '" opacity=".05"/>';
      s += '<rect class="hit" x="' + pad.l + '" y="0" width="' + iw + '" height="' + H + '" fill="transparent"/></svg>';
      el.innerHTML = s;
      var svg = el.querySelector('svg'), tip = tooltip(el), hl = svg.querySelector('.hl');
      function move(ev) {
        var r = svg.getBoundingClientRect();
        var px = ((ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left) * (W / r.width);
        var i = Math.max(0, Math.min(n - 1, Math.floor((px - pad.l) / bw)));
        hl.setAttribute('x', X(i) - bw / 2); hl.classList.remove('hidden');
        var html = '<div class="t">' + esc((o.fmtTip || fx)(o.labels[i])) + '</div>';
        html += '<div class="r"><span class="sw" style="background:' + c + '"></span>' + esc(o.name || 'Nilai') + ': ' + esc(fy(o.values[i] || 0)) + '</div>';
        if (o.target && o.target[i] != null) html += '<div class="r"><span class="sw" style="background:' + css('--text-2') + '"></span>' + esc(o.targetName || 'Target') + ': ' + esc(fy(o.target[i])) + '</div>';
        tip.innerHTML = html; tip.classList.remove('hidden');
        var top = Math.min(Y(o.values[i] || 0), o.target && o.target[i] != null ? Y(o.target[i]) : H);
        tip.style.left = Math.max(70, Math.min(r.width - 70, X(i) * r.width / W)) + 'px';
        tip.style.top = (top * r.height / H) + 'px';
      }
      function leave() { hl.classList.add('hidden'); tip.classList.add('hidden'); }
      var hit = svg.querySelector('.hit');
      hit.addEventListener('mousemove', move); hit.addEventListener('touchstart', move, { passive: true }); hit.addEventListener('touchmove', move, { passive: true });
      hit.addEventListener('mouseleave', leave); hit.addEventListener('touchend', function () { setTimeout(leave, 1500); });
    });
  }

  function spark(values, col, w, h) {
    w = w || 96; h = h || 30;
    var v = values.filter(function (x) { return x != null; });
    if (v.length < 2) return '<svg width="' + w + '" height="' + h + '"><line x1="0" x2="' + w + '" y1="' + (h / 2) + '" y2="' + (h / 2) + '" stroke="' + css('--grid') + '" stroke-width="2"/></svg>';
    var mn = Math.min.apply(null, v), mx = Math.max.apply(null, v), rg = mx - mn || 1;
    var pts = v.map(function (x, i) { return (i * (w - 4) / (v.length - 1) + 2).toFixed(1) + ',' + (h - 3 - (x - mn) / rg * (h - 6)).toFixed(1); });
    var c = color(col || '--accent');
    return '<svg width="' + w + '" height="' + h + '" aria-hidden="true"><polyline points="' + pts.join(' ') + '" fill="none" stroke="' + c + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  }

  function ring(pct, o) {
    o = o || {};
    var size = o.size || 120, sw = o.stroke || 12, r = (size - sw) / 2, C = 2 * Math.PI * r;
    var p = pct == null ? 0 : Math.max(0, Math.min(1, pct));
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" aria-hidden="true">' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + (o.track || 'rgba(127,127,127,.18)') + '" stroke-width="' + sw + '"/>' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + (o.color || css('--accent')) + '" stroke-width="' + sw + '" stroke-linecap="round" ' +
      'stroke-dasharray="' + (C * p) + ' ' + C + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')" style="transition:stroke-dasharray .6s"/></svg>';
  }

  return { line: line, bars: bars, spark: spark, ring: ring };
})();
