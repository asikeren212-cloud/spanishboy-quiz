/* SpanishBoys Quiz – Beamer-Ansicht (Bühne 1920×1080, wird auf den Bildschirm skaliert) */
(function () {
  const { esc, symbol, crown, marigold, bunting, confetti, stopConfetti } = window.Decor;
  const stage = document.getElementById('stage');
  const canvas = document.getElementById('confetti');
  const login = document.getElementById('login');
  const offline = document.getElementById('offline');
  const socket = io({ transports: ['websocket', 'polling'] });

  let pw = null;
  try { pw = sessionStorage.getItem('sbq-pw'); } catch (e) { /* egal */ }
  let view = null, lastKey = null, timerRAF = 0, podiumTimers = [];

  /* ----- Skalieren ----- */
  function fit() {
    const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    const x = (window.innerWidth - 1920 * s) / 2, y = (window.innerHeight - 1080 * s) / 2;
    stage.style.transform = `translate(${x}px,${y}px) scale(${s})`;
  }
  window.addEventListener('resize', fit); fit();
  const viewportEl = document.getElementById('viewport');
  viewportEl.addEventListener('scroll', () => viewportEl.scrollTo(0, 0)); // Bühne nie verrutschen lassen

  /* ----- Anmeldung ----- */
  function showLogin(msg) {
    login.style.display = 'flex';
    document.getElementById('loginErr').textContent = msg || '';
    document.getElementById('pw').focus();
  }
  function auth(p) {
    socket.emit('host:auth', { password: p }, (res) => {
      if (res && res.ok) {
        pw = p; try { sessionStorage.setItem('sbq-pw', p); } catch (e) { /* egal */ }
        login.style.display = 'none';
      } else {
        pw = null; try { sessionStorage.removeItem('sbq-pw'); } catch (e) { /* egal */ }
        showLogin('Contraseña incorrecta');
      }
    });
  }
  document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    auth(document.getElementById('pw').value);
  });
  socket.on('connect', () => { offline.style.display = 'none'; if (pw) auth(pw); else showLogin(); });
  socket.on('disconnect', () => { offline.style.display = 'block'; });
  socket.on('hostView', (v) => { view = v; render(v); });

  const act = (type) => socket.emit('host:action', { type });

  /* ----- Rendern ----- */
  function keyOf(v) {
    return v.phase === 'question' || v.phase === 'reveal' ? 'q:' + v.qIndex : v.phase + ':' + v.qIndex;
  }
  function render(v) {
    const key = keyOf(v);
    if (key !== lastKey) {
      lastKey = key;
      cancelAnimationFrame(timerRAF);
      podiumTimers.forEach(clearTimeout); podiumTimers = [];
      stopConfetti(canvas);
      full(v);
    }
    patch(v);
  }
  const head = () => `<div class="bunting">${bunting({ flags: 16, w: 1920, h: 150 })}</div>`;

  function full(v) {
    if (v.phase === 'lobby') return fullLobby();
    if (v.phase === 'question' || v.phase === 'reveal') return fullQuestion(v);
    if (v.phase === 'ranking') return fullRanking(v);
    if (v.phase === 'final') return fullFinal(v);
  }
  function patch(v) {
    if (v.phase === 'lobby') return patchLobby(v);
    if (v.phase === 'question' || v.phase === 'reveal') return patchQuestion(v);
  }

  /* ---------- Lobby ---------- */
  function fullLobby() {
    stage.innerHTML = `<section class="lobby">${head()}
      <div class="deco" style="left:-120px;bottom:-130px;width:420px;height:420px">${marigold()}</div>
      <div class="deco" style="left:150px;bottom:-190px;width:330px;height:330px;opacity:.9">${marigold()}</div>
      <div class="deco" style="right:-110px;bottom:-110px;width:380px;height:380px">${marigold()}</div>
      <div class="left tile-frame"><div class="tile-inner">
        <img id="qr" src="/qr.svg?t=${Date.now()}" alt="Código QR">
        <div class="url" id="url"></div>
        <div class="scan">Escanea y entra con tu móvil</div>
      </div></div>
      <div class="right">
        <h1>SpanishBoys Quiz</h1>
        <h2>La comida mexicana</h2>
        <div class="count"><b id="pcount">0</b> <span id="plabel">jugadores</span></div>
        <div class="plist" id="plist"></div>
      </div>
      <div class="startrow"><button class="big-btn" id="start">¡Empezar!</button></div>
    </section>`;
    document.getElementById('url').textContent = location.origin.replace(/^https?:\/\//, '');
    document.getElementById('start').addEventListener('click', () => act('start'));
    document.getElementById('plist').addEventListener('click', (e) => {
      const b = e.target.closest('[data-kick]');
      if (b) socket.emit('host:kick', { id: b.dataset.kick });
    });
  }
  function patchLobby(v) {
    document.getElementById('pcount').textContent = v.playerCount;
    document.getElementById('plabel').textContent = v.playerCount === 1 ? 'jugador' : 'jugadores';
    document.getElementById('start').disabled = v.playerCount === 0;
    const list = document.getElementById('plist');
    const sig = v.players.map((p) => p.id + p.name + p.connected).join('|');
    if (list.dataset.sig === sig) return;
    list.dataset.sig = sig;
    list.innerHTML = v.players.length
      ? v.players.map((p) => `<div class="chip${p.connected ? '' : ' off'}"><span>${esc(p.name)}</span><button data-kick="${esc(p.id)}" title="Echar" aria-label="Echar a ${esc(p.name)}">×</button></div>`).join('')
      : '<div class="empty">Esperando jugadores…</div>';
  }

  /* ---------- Frage / Auflösung ---------- */
  function fullQuestion(v) {
    const answers = v.question.answers.map((a, i) =>
      `<div class="ans c${i}" data-i="${i}"><span class="sym">${symbol(i)}</span><span class="atext">${esc(a)}</span><span class="acount">0</span><div class="abar"></div></div>`).join('');
    stage.innerHTML = `<section class="q" id="qsec">${head()}
      <div class="qnum">PREGUNTA ${v.qIndex + 1} / ${v.qTotal}</div>
      <div class="timer" id="timer"><svg viewBox="0 0 100 100"><circle class="ring-bg" cx="50" cy="50" r="44" fill="none" stroke-width="9"/><circle class="ring" id="ring" cx="50" cy="50" r="44" fill="none" stroke-width="9" stroke-linecap="round" stroke-dasharray="276.46" stroke-dashoffset="0"/></svg><div class="tnum" id="tnum"></div></div>
      <div class="qtext card">${esc(v.question.text)}</div>
      <div class="answers">${answers}</div>
      <div class="foot"><div class="answered" id="answered"></div><button class="big-btn alt" id="next" hidden>Ranking →</button></div>
    </section>`;
    document.getElementById('next').addEventListener('click', () => act('next'));
    if (v.phase === 'question') {
      const end = performance.now() + v.remainingMs;
      const ring = document.getElementById('ring'), tnum = document.getElementById('tnum'), timer = document.getElementById('timer');
      (function loop() {
        const left = Math.max(0, end - performance.now());
        tnum.textContent = Math.ceil(left / 1000);
        ring.style.strokeDashoffset = String(276.46 * (1 - left / v.totalMs));
        timer.classList.toggle('low', left < 5000);
        if (left > 0) timerRAF = requestAnimationFrame(loop);
      })();
    }
  }
  function patchQuestion(v) {
    const sec = document.getElementById('qsec');
    document.getElementById('answered').innerHTML = `<b>${v.answered}</b> de <b>${v.active}</b> han respondido`;
    if (v.phase === 'reveal' && !sec.classList.contains('revealed')) {
      cancelAnimationFrame(timerRAF);
      sec.classList.add('revealed');
      document.getElementById('tnum').textContent = '0';
      const max = Math.max(1, ...v.counts);
      sec.querySelectorAll('.ans').forEach((el, i) => {
        el.classList.toggle('right', i === v.correctPos);
        el.querySelector('.acount').textContent = v.counts[i];
        requestAnimationFrame(() => { el.querySelector('.abar').style.width = (v.counts[i] / max) * 100 + '%'; });
      });
      const next = document.getElementById('next');
      next.hidden = false;
    }
  }

  /* ---------- Rangliste ---------- */
  function fullRanking(v) {
    const max = Math.max(1, ...v.top5.map((p) => p.score));
    const last = v.qIndex >= v.qTotal - 1;
    stage.innerHTML = `<section class="rank">${head()}
      <div class="deco" style="right:-90px;top:140px;width:300px;height:300px;opacity:.9">${marigold()}</div>
      <div class="h1 h">Top 5</div>
      <div class="rows">${v.top5.map((p, i) =>
        `<div class="row" style="animation-delay:${i * 0.12}s"><div class="fill" style="width:0" data-w="${(p.score / max) * 100}%"></div><span class="pos">${i + 1}</span><span class="nm">${esc(p.name)}</span><span class="sc">${p.score}<small>puntos</small></span></div>`).join('')}</div>
      <div class="btnrow"><button class="big-btn alt" id="next">${last ? '¡Los campeones! 🏆' : 'Siguiente →'}</button></div>
    </section>`;
    document.getElementById('next').addEventListener('click', () => act('next'));
    requestAnimationFrame(() => setTimeout(() => stage.querySelectorAll('.fill').forEach((f) => { f.style.width = f.dataset.w; }), 50));
  }

  /* ---------- Siegerpodest ---------- */
  function fullFinal(v) {
    const pod = v.podium;
    const slot = (n, kind) => {
      const p = pod[n - 1];
      return `<div class="slot s${n}"><div class="who" id="who${n}">${p ? `${crown(kind)}<div class="nm">${esc(p.name)}</div><div class="pt">${p.score} puntos</div>` : ''}</div>
        <div class="base" id="base${n}"><div class="num">${n}</div></div></div>`;
    };
    stage.innerHTML = `<section class="final">${head()}
      <div class="deco" style="left:-110px;bottom:-120px;width:420px;height:420px">${marigold()}</div>
      <div class="deco" style="right:-110px;bottom:-120px;width:420px;height:420px">${marigold()}</div>
      <h1>¡Los campeones!</h1>
      <div class="tension" id="tension">¿Quién será el campeón?</div>
      <div class="podium">${slot(2, 'silver')}${slot(1, 'gold')}${slot(3, 'bronze')}</div>
      <div class="btnrow"><button class="big-btn" id="again">Jugar otra vez</button></div>
    </section>`;
    document.getElementById('again').addEventListener('click', () => act('reset'));
    const reveal = (n) => {
      const b = document.getElementById('base' + n), w = document.getElementById('who' + n);
      if (!b) return;
      b.classList.add('up');
      podiumTimers.push(setTimeout(() => w.classList.add('show'), 700));
    };
    const at = (ms, fn) => podiumTimers.push(setTimeout(fn, ms));
    const tension = document.getElementById('tension');
    if (pod.length >= 3) at(800, () => reveal(3));
    if (pod.length >= 2) at(3200, () => reveal(2));
    at(5800, () => { tension.style.display = 'block'; });
    at(8200, () => {
      tension.style.display = 'none';
      reveal(1);
      at(900, () => confetti(canvas, 12000));
    });
  }

  /* Leertaste / Enter = nächster Schritt (praktisch am Laptop) */
  window.addEventListener('keydown', (e) => {
    if (login.style.display === 'flex' || !view) return;
    if (e.key === ' ' || e.key === 'Enter') {
      if (view.phase === 'reveal' || view.phase === 'ranking') { e.preventDefault(); act('next'); }
    }
  });
})();
