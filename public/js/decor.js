/* Dekor: Papel picado, Cempasúchil, Talavera, Symbole, Kronen, Konfetti – alles selbst gezeichnet (SVG). */
(function () {
  const C = {
    pink: '#E4007C', turq: '#00A19A', yellow: '#F7A600', blue: '#1E4FA0',
    green: '#2E9E4F', red: '#D7263D', cream: '#FDF1E4', night: '#1F1B3D', orange: '#EE7A12',
  };
  const FLAG_COLORS = [C.pink, C.turq, C.yellow, C.blue, C.green, C.red, C.orange];

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ----- Papel picado: Girlande mit ausgeschnittenen Fähnchen ----- */
  function cutoutsA() { // Raute + Blume
    let s = '<polygon points="50,24 78,52 50,80 22,52" fill="#000"/>';
    s += '<circle cx="50" cy="52" r="11" fill="#fff"/>';
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      s += `<circle cx="${50 + Math.cos(a) * 6.5}" cy="${52 + Math.sin(a) * 6.5}" r="2.6" fill="#000"/>`;
    }
    for (let k = 0; k < 3; k++) s += `<polygon points="${22 + k * 28},14 ${30 + k * 28},14 ${26 + k * 28},24" fill="#000"/>`;
    for (let k = 0; k < 3; k++) s += `<circle cx="${26 + k * 24}" cy="92" r="4" fill="#000"/>`;
    return s;
  }
  function cutoutsB() { // Kreise + Dreiecke
    let s = '<circle cx="50" cy="48" r="24" fill="#000"/><circle cx="50" cy="48" r="14" fill="#fff"/>';
    s += '<polygon points="50,38 58,48 50,58 42,48" fill="#000"/>';
    for (let k = 0; k < 4; k++) s += `<circle cx="${18 + k * 21}" cy="18" r="4.5" fill="#000"/>`;
    for (let k = 0; k < 3; k++) s += `<polygon points="${24 + k * 26},84 ${36 + k * 26},84 ${30 + k * 26},95" fill="#000"/>`;
    return s;
  }

  let uid = 0;
  function bunting(opts) {
    const o = Object.assign({ flags: 16, w: 1600, h: 150 }, opts);
    const id = 'pp' + (++uid);
    const fw = o.w / o.flags;
    const bodyW = fw - 10, top = 14, bodyH = 98, teeth = 6, zig = 16;
    const tw = bodyW / teeth;
    // Fähnchenform in lokalen Koordinaten 0..100 (skaliert über transform)
    let d = `M0,0 H${bodyW} V${bodyH}`;
    for (let t = 0; t < teeth; t++) d += ` L${bodyW - (t + 0.5) * tw},${bodyH + zig} L${bodyW - (t + 1) * tw},${bodyH}`;
    d += ' Z';
    const sx = bodyW / 100;
    const defs =
      `<mask id="${id}a" maskUnits="userSpaceOnUse" x="-5" y="-5" width="200" height="200"><rect x="-5" y="-5" width="200" height="200" fill="#fff"/>${cutoutsA()}</mask>` +
      `<mask id="${id}b" maskUnits="userSpaceOnUse" x="-5" y="-5" width="200" height="200"><rect x="-5" y="-5" width="200" height="200" fill="#fff"/>${cutoutsB()}</mask>`;
    let flags = '';
    for (let i = 0; i < o.flags; i++) {
      const x = i * fw + 5;
      const col = FLAG_COLORS[i % FLAG_COLORS.length];
      const m = i % 2 === 0 ? 'a' : 'b';
      const sy = bodyH / 100;
      // Maske wird in der Einheit 0..100 gezeichnet -> Gruppe skalieren, Form in Originalmaßen
      flags += `<g transform="translate(${x},${top})"><g transform="scale(${sx},${sy})" mask="url(#${id}${m})">` +
        `<path d="${scalePath(d, 1 / sx, 1 / sy)}" fill="${col}"/></g></g>`;
    }
    return `<svg class="bunting-svg" viewBox="0 0 ${o.w} ${o.h}" preserveAspectRatio="xMidYMin slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
      `<defs>${defs}</defs><path d="M0,10 Q${o.w / 2},26 ${o.w},10" stroke="#8a5a2b" stroke-width="4" fill="none"/>${flags}</svg>`;
  }
  // Pfad mit "M x,y H x V y L x,y ..." in anderen Maßstab umrechnen (für die Maske)
  function scalePath(d, kx, ky) {
    const tokens = d.match(/[MHVLZ]|-?\d*\.?\d+(?:e-?\d+)?/gi);
    let out = '', cmd = '', args = [];
    const flush = () => {
      if (!cmd) return;
      if (cmd === 'Z') { out += 'Z'; return; }
      let a = args.map(Number);
      if (cmd === 'H') a = a.map((v) => v * kx);
      else if (cmd === 'V') a = a.map((v) => v * ky);
      else a = a.map((v, i) => (i % 2 === 0 ? v * kx : v * ky));
      out += cmd + a.join(',') + ' ';
    };
    for (const t of tokens) {
      if (/[MHVLZ]/i.test(t)) { flush(); cmd = t.toUpperCase(); args = []; } else args.push(t);
    }
    flush();
    return out;
  }

  /* ----- Cempasúchil (Studentenblume) ----- */
  function marigold(size) {
    const rings = [
      { n: 16, r: 34, rx: 8.5, ry: 15, fill: '#F7A600' },
      { n: 14, r: 26, rx: 8, ry: 13, fill: '#FFB62E' },
      { n: 12, r: 18, rx: 7, ry: 11, fill: '#EE7A12' },
      { n: 9, r: 10, rx: 6, ry: 8, fill: '#F7A600' },
    ];
    let s = '';
    rings.forEach((ring, ri) => {
      for (let i = 0; i < ring.n; i++) {
        const a = (360 / ring.n) * i + (ri % 2 ? 360 / ring.n / 2 : 0);
        s += `<ellipse cx="50" cy="${50 - ring.r}" rx="${ring.rx}" ry="${ring.ry}" fill="${ring.fill}" stroke="#C96A00" stroke-width=".6" transform="rotate(${a} 50 50)"/>`;
      }
    });
    s += '<circle cx="50" cy="50" r="5.5" fill="#B8500A"/><circle cx="50" cy="50" r="2.2" fill="#7A3205"/>';
    return `<svg class="marigold" ${size ? `width="${size}" height="${size}"` : ''} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${s}</svg>`;
  }

  /* ----- Talavera-Fliese (als Hintergrundbild) ----- */
  function talaveraSVG() {
    const B = C.blue, T = C.turq, Y = C.yellow;
    let s = `<rect width="80" height="80" fill="#fff"/><rect x="2" y="2" width="76" height="76" fill="none" stroke="${B}" stroke-width="2"/>`;
    s += `<path d="M0,0 Q22,0 22,22 Q0,22 0,0Z M80,0 Q80,22 58,22 Q58,0 80,0Z M0,80 Q0,58 22,58 Q22,80 0,80Z M80,80 Q58,80 58,58 Q80,58 80,80Z" fill="${T}"/>`;
    s += `<g transform="translate(40 40)"><rect x="-15" y="-15" width="30" height="30" fill="${B}"/><rect x="-15" y="-15" width="30" height="30" fill="${B}" transform="rotate(45)"/>`;
    s += `<rect x="-9" y="-9" width="18" height="18" fill="#fff" transform="rotate(45)"/><circle r="6" fill="${T}"/><circle r="2.6" fill="${Y}"/></g>`;
    [[40, 8], [40, 72], [8, 40], [72, 40]].forEach(([x, y]) => { s += `<polygon points="${x},${y - 6} ${x + 5},${y} ${x},${y + 6} ${x - 5},${y}" fill="${Y}"/>`; });
    return `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">${s}</svg>`;
  }

  /* ----- Symbole für die vier Antworten ----- */
  function symbol(i) {
    const shapes = [
      '<circle cx="50" cy="50" r="38"/>',
      '<polygon points="50,6 94,50 50,94 6,50"/>',
      '<polygon points="50,8 95,90 5,90"/>',
      '<rect x="12" y="12" width="76" height="76" rx="4"/>',
    ];
    return `<svg class="sym-svg" viewBox="0 0 100 100" fill="currentColor" aria-hidden="true">${shapes[i % 4]}</svg>`;
  }

  /* ----- Kronen ----- */
  const METAL = {
    gold: ['#FFE27A', '#E8A100', '#B97800'],
    silver: ['#F4F7FB', '#A9B3C0', '#6F7B8A'],
    bronze: ['#F1B07A', '#C27434', '#8A4B1B'],
  };
  function crown(kind, size) {
    const [a, b, c] = METAL[kind] || METAL.gold;
    const id = 'cr' + (++uid);
    return `<svg class="crown" ${size ? `width="${size}"` : ''} viewBox="0 0 100 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
      `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".6" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs>` +
      `<path d="M8,66 L2,20 L30,42 L50,8 L70,42 L98,20 L92,66 Z" fill="url(#${id})" stroke="${c}" stroke-width="2.5" stroke-linejoin="round"/>` +
      `<rect x="8" y="62" width="84" height="12" rx="3" fill="url(#${id})" stroke="${c}" stroke-width="2.5"/>` +
      `<circle cx="2" cy="20" r="5" fill="${a}" stroke="${c}" stroke-width="2"/><circle cx="98" cy="20" r="5" fill="${a}" stroke="${c}" stroke-width="2"/><circle cx="50" cy="8" r="5.5" fill="${a}" stroke="${c}" stroke-width="2"/>` +
      `<circle cx="30" cy="68" r="3" fill="${C.pink}"/><circle cx="50" cy="68" r="3" fill="${C.turq}"/><circle cx="70" cy="68" r="3" fill="${C.blue}"/></svg>`;
  }

  /* ----- Konfetti (Canvas) ----- */
  let confettiRAF = 0, confettiParts = [];
  function confetti(canvas, ms) {
    stopConfetti(canvas);
    const dpr = window.devicePixelRatio || 1;
    const W = (canvas.width = window.innerWidth * dpr);
    const H = (canvas.height = window.innerHeight * dpr);
    const ctx = canvas.getContext('2d');
    const cols = [C.pink, C.turq, C.yellow, C.blue, C.green, C.red, C.orange];
    const t0 = performance.now();
    const spawn = (n) => {
      for (let i = 0; i < n; i++) {
        confettiParts.push({
          x: Math.random() * W, y: -20 * dpr, vx: (Math.random() - 0.5) * 3 * dpr, vy: (2 + Math.random() * 4) * dpr,
          w: (8 + Math.random() * 10) * dpr, h: (6 + Math.random() * 8) * dpr, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
          c: cols[(Math.random() * cols.length) | 0], sw: Math.random() * 6,
        });
      }
    };
    spawn(160);
    (function frame(t) {
      ctx.clearRect(0, 0, W, H);
      if (t - t0 < (ms || 9000)) spawn(3);
      confettiParts.forEach((p) => {
        p.x += p.vx + Math.sin((p.sw += 0.05)) * dpr; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
      });
      confettiParts = confettiParts.filter((p) => p.y < H + 40);
      if (confettiParts.length || t - t0 < (ms || 9000)) confettiRAF = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, W, H);
    })(t0);
  }
  function stopConfetti(canvas) {
    cancelAnimationFrame(confettiRAF);
    confettiParts = [];
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  }

  // Talavera als CSS-Variable bereitstellen
  document.documentElement.style.setProperty('--talavera', `url("data:image/svg+xml,${encodeURIComponent(talaveraSVG())}")`);

  window.Decor = { C, esc, bunting, marigold, symbol, crown, confetti, stopConfetti };
})();
