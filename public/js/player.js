/* SpanishBoys Quiz – Handy-Ansicht */
(function () {
  const { esc, symbol, crown, marigold } = window.Decor;
  const app = document.getElementById('app');
  const banner = document.getElementById('banner');
  document.getElementById('bunting').innerHTML = window.Decor.bunting({ flags: 7, w: 700, h: 150 });

  const LS_TOKEN = 'sbq-token';
  const socket = io({ transports: ['websocket', 'polling'] });

  let connected = false;
  let resumed = false;     // Wiederverbindung abgeschlossen?
  let view = null;         // letzter Zustand vom Server
  let screen = 'connecting';
  let joinError = '';
  let finalRevealAt = 0;   // Gewinner-Anzeige erst nach kurzer Spannung
  let deadline = 0;

  const store = {
    get() { try { return localStorage.getItem(LS_TOKEN); } catch (e) { return null; } },
    set(t) { try { localStorage.setItem(LS_TOKEN, t); } catch (e) { /* privater Modus */ } },
    clear() { try { localStorage.removeItem(LS_TOKEN); } catch (e) { /* egal */ } },
  };

  function setView(v) {
    const prev = view && view.phase;
    view = v;
    screen = 'game';
    if (v.phase === 'question') deadline = performance.now() + v.remainingMs;
    if (v.phase === 'final' && prev !== 'final') {
      // Neu geladen mitten im Finale: sofort zeigen, sonst kurze Spannung
      finalRevealAt = prev ? Date.now() + 9000 : 0;
      if (finalRevealAt) setTimeout(render, 9100);
    }
    render();
  }

  socket.on('connect', () => {
    connected = true;
    banner.hidden = true;
    const token = store.get();
    if (!token) { resumed = true; if (screen === 'connecting') screen = 'join'; render(); return; }
    socket.emit('player:resume', { token }, (res) => {
      resumed = true;
      if (res && res.ok) setView(res.view);
      else { store.clear(); view = null; screen = 'join'; render(); }
    });
  });
  socket.on('disconnect', () => { connected = false; banner.hidden = !view; render(); });
  socket.on('connect_error', () => { banner.hidden = !view; });
  socket.on('view', setView);
  socket.on('kicked', () => {
    store.clear(); view = null; screen = 'join';
    joinError = 'Has sido sacado del juego. Elige otro nombre.';
    render();
  });

  /* ---------- Rendern ---------- */
  function render() {
    if (screen === 'connecting') return show(center(`<div class="flower">${marigold()}</div><h2>Conectando…</h2>`));
    if (screen === 'join') return renderJoin();
    if (!view) return;
    switch (view.phase) {
      case 'lobby': return show(center(
        `<div class="flower">${marigold()}</div><h2>¡Listo, ${esc(view.name)}!</h2><p>Espera…</p><p class="hint">${view.playerCount} jugador${view.playerCount === 1 ? '' : 'es'} en la sala</p>`));
      case 'question': return renderQuestion();
      case 'reveal':
      case 'ranking': return renderResult();
      case 'final': return renderFinal();
    }
  }
  function show(html) { app.innerHTML = html; }
  const center = (inner) => `<div class="center">${inner}</div>`;

  function renderJoin() {
    if (document.getElementById('joinForm')) return; // Eingabe nicht überschreiben
    show(center(`
      <div class="flower">${marigold()}</div>
      <form id="joinForm" autocomplete="off">
        <label for="nick">Tu nombre</label>
        <input id="nick" type="text" maxlength="15" autocomplete="off" autocapitalize="words" autocorrect="off" spellcheck="false" enterkeyhint="go" placeholder="Apodo">
        <div class="err" id="joinErr">${esc(joinError)}</div>
        <button class="btn" type="submit">Entrar</button>
        <div class="hint">Solo un apodo. No se guarda nada.</div>
      </form>`));
    const form = document.getElementById('joinForm');
    const input = document.getElementById('nick');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = input.value.trim();
      const err = document.getElementById('joinErr');
      if (!name) { err.textContent = 'Escribe tu nombre.'; input.focus(); return; }
      if (!connected) { err.textContent = 'Sin conexión. Espera un momento…'; return; }
      socket.emit('player:join', { name }, (res) => {
        if (res && res.ok) { joinError = ''; store.set(res.token); setView(res.view); return; }
        const msgs = { empty: 'Escribe tu nombre.', taken: 'Ese nombre ya existe. Elige otro.', full: 'La sala está llena.' };
        err.textContent = msgs[res && res.error] || 'No se pudo entrar. Inténtalo otra vez.';
      });
    });
  }

  function renderQuestion() {
    const v = view;
    if (!v.eligible) {
      return show(center(`<div class="flower">${marigold()}</div><h2>¡Espera!</h2><p>La pregunta ya empezó.<br>Juegas desde la siguiente.</p>`));
    }
    const locked = v.answered !== null && v.answered !== undefined;
    const btns = v.question.answers.map((a, i) =>
      `<button class="ans c${i}${v.answered === i ? ' picked' : ''}" data-i="${i}" ${locked ? 'disabled' : ''}>
        <span class="sym">${symbol(i)}</span><span>${esc(a)}</span></button>`).join('');
    show(`<div class="qsmall">${v.qIndex + 1}/${v.qTotal} · ${esc(v.question.text)}</div>
      <div class="tbar"><div id="bar"></div></div>
      <div class="grid${locked ? ' locked' : ''}">${btns}</div>
      ${locked ? '<div class="sent">¡Respuesta enviada!</div>' : ''}`);
  }

  app.addEventListener('click', (e) => {
    const b = e.target.closest('.ans');
    if (!b || b.disabled || !view || view.phase !== 'question') return;
    if (view.answered !== null && view.answered !== undefined) return;
    const choice = Number(b.dataset.i);
    view.answered = choice;           // sofort sperren
    renderQuestion();
    socket.emit('player:answer', { choice }, () => { /* Ergebnis kommt nach der Frage */ });
  });

  function renderResult() {
    const v = view, last = v.last;
    let box;
    if (!last) {
      box = `<div class="result" style="background:var(--blue)"><div class="big">¡Sigues en el juego!</div><div class="pts">Juegas desde la siguiente pregunta.</div></div>`;
    } else if (last.correct) {
      box = `<div class="result ok"><div class="big">¡Correcto!</div><div class="pts">+${last.points} puntos</div></div>`;
    } else {
      const right = v.question.answers[v.correctPos];
      box = `<div class="result bad"><div class="big">${last.none ? 'Sin respuesta' : 'Incorrecto'} – 0 puntos</div>
        <div class="correct-is">Respuesta correcta:<br><b>${esc(right)}</b></div></div>`;
    }
    show(center(`${box}
      <div class="stats"><div class="stat"><b>${v.score}</b><span>Puntos</span></div>
      <div class="stat"><b>${v.rank}.º</b><span>Lugar de ${v.playerCount}</span></div></div>
      <p class="hint">${v.qIndex + 1}/${v.qTotal} · Mira la pantalla…</p>`));
  }

  function renderFinal() {
    const v = view;
    if (finalRevealAt && Date.now() < finalRevealAt) {
      return show(center(`<div class="flower">${marigold()}</div><h2>¡Mira la pantalla!</h2><p>…</p>`));
    }
    const kind = { 1: 'gold', 2: 'silver', 3: 'bronze' }[v.rank];
    if (v.rank === 1) {
      show(center(`<div class="podium-msg">${crown('gold')}<h2>¡Eres campeón! 👑</h2></div><div class="place-big">1.º</div><div class="stats"><div class="stat"><b>${v.score}</b><span>Puntos</span></div></div>`));
    } else if (kind) {
      show(center(`<div class="podium-msg">${crown(kind)}<h2>¡Lugar ${v.rank}!</h2></div><div class="place-big">${v.rank}.º</div><div class="stats"><div class="stat"><b>${v.score}</b><span>Puntos</span></div></div>`));
    } else {
      show(center(`<h2>¡Buen juego!</h2><div class="place-big">${v.rank}.º</div><p>de ${v.playerCount} jugadores</p><div class="stats"><div class="stat"><b>${v.score}</b><span>Puntos</span></div></div>`));
    }
  }

  /* Zeitbalken (nur Anzeige – die echte Zeit misst der Server) */
  (function tick() {
    const bar = document.getElementById('bar');
    if (bar && view && view.phase === 'question') {
      const left = Math.max(0, deadline - performance.now());
      bar.style.transform = `scaleX(${Math.min(1, left / view.totalMs)})`;
      bar.style.background = left < 5000 ? 'var(--red)' : 'var(--turq)';
    }
    requestAnimationFrame(tick);
  })();

  render();
})();
