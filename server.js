'use strict';
/* SpanishBoys Quiz – ein einziger Server: Webseiten + Socket.IO + QR-Code.
   Spielstand liegt nur im Arbeitsspeicher. Es wird nichts dauerhaft gespeichert. */

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { Server } = require('socket.io');
const QRCode = require('qrcode');

const PORT = Number(process.env.PORT) || 3000;
const HOST_PASSWORD = String(process.env.HOST_PASSWORD || 'comida');
const QUESTION_MS = 20 * 1000;      // Zeit pro Frage
const GRACE_MS = 600;               // Toleranz für Netzwerk-Verzögerung
const RECONNECT_GRACE_MS = 8000;   // so lange wartet eine Frage auf ein kurz getrenntes Handy
const MAX_NAME = 15;
const MAX_PLAYERS = 300;
const OFFLINE_KEEP_MS = 45 * 60 * 1000;

/* ---------- Fragen laden und prüfen ---------- */
function loadQuestions() {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'questions.json'), 'utf8'));
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('questions.json: leere Liste');
  raw.forEach((q, i) => {
    const n = i + 1;
    if (typeof q.question !== 'string' || !q.question) throw new Error(`Frage ${n}: "question" fehlt`);
    if (!Array.isArray(q.answers) || q.answers.length < 2 || q.answers.length > 4 || q.answers.some((a) => typeof a !== 'string'))
      throw new Error(`Frage ${n}: "answers" braucht 2 bis 4 Texte`);
    if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct >= q.answers.length)
      throw new Error(`Frage ${n}: "correct" muss die Nummer der richtigen Antwort sein (0 = erste)`);
  });
  return raw;
}
const questions = loadQuestions();

/* ---------- Express ---------- */
const app = express();
app.set('trust proxy', true);
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'no-referrer');
  next();
});

function baseUrl(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/+$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

app.get('/health', (req, res) => res.type('text').send('ok'));
app.get('/qr.svg', async (req, res) => {
  try {
    const svg = await QRCode.toString(`${baseUrl(req)}/`, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
    res.set('Cache-Control', 'no-store').type('image/svg+xml').send(svg);
  } catch (e) {
    res.status(500).end();
  }
});
app.get('/host', (req, res) => res.sendFile(path.join(__dirname, 'public', 'host.html')));
app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html', maxAge: 0 }));

const server = http.createServer(app);
const io = new Server(server, {
  pingInterval: 10000,
  pingTimeout: 20000,
  maxHttpBufferSize: 1e4,
});

/* ---------- Spielzustand (nur Arbeitsspeicher) ---------- */
const players = new Map(); // token -> Spieler
const hosts = new Set();   // socket-IDs der angemeldeten Host-Verbindungen

const game = {
  phase: 'lobby', // lobby | question | reveal | ranking | final
  qIndex: -1,
  startedAt: 0,
  timer: null,
  answers: [],    // gemischte Antworttexte
  correctPos: 0,  // Position der richtigen Antwort nach dem Mischen
  firstCorrectGiven: false,
};

const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const reply = (cb, obj) => { if (typeof cb === 'function') cb(obj); };
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cleanName(raw) {
  if (typeof raw !== 'string') return '';
  const s = raw
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(s).slice(0, MAX_NAME).join('').trim();
}
const nameKey = (n) => n.toLocaleLowerCase('es');

const isEligible = (p) => game.phase !== 'lobby' && p.activeFrom <= game.qIndex;

function ranking() {
  return [...players.values()].sort(
    (a, b) => b.score - a.score || a.totalMs - b.totalMs || a.name.localeCompare(b.name, 'es')
  );
}

/* ---------- Ansichten ---------- */
function answerCounts() {
  const counts = game.answers.map(() => 0);
  for (const p of players.values()) {
    if (isEligible(p) && p.answer) counts[p.answer.choice]++;
  }
  return counts;
}

function hostView() {
  const v = {
    phase: game.phase,
    qIndex: game.qIndex,
    qTotal: questions.length,
    totalMs: QUESTION_MS,
    playerCount: players.size,
    players: [...players.values()].map((p) => ({ id: p.id, name: p.name, connected: p.connected })),
  };
  if (game.phase === 'question' || game.phase === 'reveal') {
    v.question = { text: questions[game.qIndex].question, answers: game.answers };
    const elig = [...players.values()].filter(isEligible);
    v.answered = elig.filter((p) => p.answer).length;
    v.active = elig.filter((p) => p.connected || p.answer).length;
    if (game.phase === 'question') {
      v.remainingMs = Math.max(0, game.startedAt + QUESTION_MS - Date.now());
    } else {
      v.correctPos = game.correctPos;
      v.counts = answerCounts();
    }
  }
  const rank = ranking();
  if (game.phase === 'ranking' || game.phase === 'reveal' || game.phase === 'final') {
    v.top5 = rank.slice(0, 5).map((p) => ({ name: p.name, score: p.score }));
  }
  if (game.phase === 'final') {
    v.podium = rank.slice(0, 3).map((p) => ({ name: p.name, score: p.score }));
  }
  return v;
}

function playerView(p) {
  const rank = ranking();
  const v = {
    phase: game.phase,
    name: p.name,
    score: p.score,
    rank: rank.indexOf(p) + 1,
    playerCount: players.size,
    qIndex: game.qIndex,
    qTotal: questions.length,
    totalMs: QUESTION_MS,
  };
  if (game.phase === 'question') {
    v.eligible = isEligible(p);
    v.question = { text: questions[game.qIndex].question, answers: game.answers };
    v.remainingMs = Math.max(0, game.startedAt + QUESTION_MS - Date.now());
    v.answered = p.answer ? p.answer.choice : null;
  } else if (game.phase === 'reveal' || game.phase === 'ranking') {
    v.question = { text: questions[game.qIndex].question, answers: game.answers };
    v.correctPos = game.correctPos;
    v.last = isEligible(p) ? p.last : null;
  }
  return v;
}

function sendHost(sock) {
  (sock || io.to('hosts')).emit('hostView', hostView());
}
function sendPlayer(p) {
  if (p.connected && p.socketId) io.to(p.socketId).emit('view', playerView(p));
}
function sendAll() {
  sendHost();
  for (const p of players.values()) sendPlayer(p);
}

/* ---------- Spielablauf ---------- */
function startQuestion() {
  clearTimeout(game.timer);
  game.qIndex++;
  const q = questions[game.qIndex];
  const order = shuffle(q.answers.map((_, i) => i));
  game.answers = order.map((i) => q.answers[i]);
  game.correctPos = order.indexOf(q.correct);
  game.firstCorrectGiven = false;
  game.phase = 'question';
  for (const p of players.values()) { p.answer = null; p.last = null; }
  game.startedAt = Date.now();
  game.timer = setTimeout(endQuestion, QUESTION_MS + GRACE_MS);
  sendAll();
}

function endQuestion() {
  if (game.phase !== 'question') return;
  clearTimeout(game.timer);
  for (const p of players.values()) {
    if (!isEligible(p)) continue;
    if (p.answer) {
      p.score += p.answer.points;
      p.totalMs += p.answer.ms;
      p.last = { correct: p.answer.correct, points: p.answer.points, choice: p.answer.choice, none: false };
    } else {
      p.totalMs += QUESTION_MS;
      p.last = { correct: false, points: 0, choice: null, none: true };
    }
  }
  game.phase = 'reveal';
  sendAll();
}

function checkAllAnswered() {
  if (game.phase !== 'question') return;
  // Wer gerade erst offline ging (Display aus), bekommt ein paar Sekunden zum Zurückkommen
  const now = Date.now();
  const active = [...players.values()].filter((p) => isEligible(p) && (p.connected || p.answer || now - p.lastSeen < RECONNECT_GRACE_MS));
  if (active.length > 0 && active.every((p) => p.answer)) endQuestion();
}

function submitAnswer(p, choice) {
  if (game.phase !== 'question') return 'closed';
  if (!isEligible(p)) return 'not-eligible';
  if (p.answer) return 'already';
  if (!Number.isInteger(choice) || choice < 0 || choice >= game.answers.length) return 'invalid';
  const elapsed = Date.now() - game.startedAt;     // Zeit wird auf dem Server gemessen
  if (elapsed > QUESTION_MS + GRACE_MS) return 'closed';
  const ms = clamp(elapsed, 0, QUESTION_MS);
  const correct = choice === game.correctPos;
  let points = 0;
  if (correct) {
    if (!game.firstCorrectGiven) {
      points = 10;
      game.firstCorrectGiven = true;
    } else {
      points = clamp(Math.round(5 + 5 * ((QUESTION_MS - ms) / QUESTION_MS)), 5, 10);
    }
  }
  p.answer = { choice, ms, correct, points };
  return 'ok';
}

function resetGame() {
  clearTimeout(game.timer);
  game.phase = 'lobby';
  game.qIndex = -1;
  game.answers = [];
  for (const p of players.values()) {
    p.score = 0; p.totalMs = 0; p.answer = null; p.last = null; p.activeFrom = 0;
  }
}

function hostAction(type) {
  switch (type) {
    case 'start':
      if (game.phase === 'lobby' && players.size > 0) startQuestion();
      break;
    case 'next':
      if (game.phase === 'reveal') { game.phase = 'ranking'; sendAll(); }
      else if (game.phase === 'ranking') {
        if (game.qIndex >= questions.length - 1) { game.phase = 'final'; sendAll(); }
        else startQuestion();
      }
      break;
    case 'reset':
      if (game.phase === 'final' || game.phase === 'lobby') { resetGame(); sendAll(); }
      break;
  }
}

/* ---------- Socket.IO ---------- */
io.on('connection', (socket) => {
  /* --- Host --- */
  socket.on('host:auth', (data, cb) => {
    const pw = data && data.password;
    const ok = typeof pw === 'string' && crypto.timingSafeEqual(sha(pw), sha(HOST_PASSWORD));
    if (!ok) { setTimeout(() => reply(cb, { ok: false }), 600); return; }
    hosts.add(socket.id);
    socket.join('hosts');
    reply(cb, { ok: true });
    sendHost(socket);
  });

  socket.on('host:action', (data) => {
    if (!hosts.has(socket.id) || !data) return;
    hostAction(data.type);
  });

  socket.on('host:kick', (data) => {
    if (!hosts.has(socket.id) || !data) return;
    for (const [token, p] of players) {
      if (p.id === data.id) {
        players.delete(token);
        if (p.socketId) io.to(p.socketId).emit('kicked');
        sendHost();
        checkAllAnswered();
        break;
      }
    }
  });

  /* --- Spieler --- */
  socket.on('player:join', (data, cb) => {
    const name = cleanName(data && data.name);
    if (!name) return reply(cb, { ok: false, error: 'empty' });
    if (players.size >= MAX_PLAYERS) return reply(cb, { ok: false, error: 'full' });
    const key = nameKey(name);
    for (const p of players.values()) {
      if (nameKey(p.name) === key) return reply(cb, { ok: false, error: 'taken' });
    }
    const token = crypto.randomBytes(16).toString('hex');
    const p = {
      token, id: crypto.randomBytes(4).toString('hex'), name,
      socketId: socket.id, connected: true,
      score: 0, totalMs: 0, answer: null, last: null,
      // Wer mitten im Spiel beitritt, spielt ab der nächsten Frage mit
      activeFrom: game.phase === 'lobby' ? 0 : game.qIndex + 1,
      lastSeen: Date.now(),
    };
    players.set(token, p);
    socket.data.token = token;
    reply(cb, { ok: true, token, name, view: playerView(p) });
    sendHost();
  });

  socket.on('player:resume', (data, cb) => {
    const p = data && typeof data.token === 'string' ? players.get(data.token) : null;
    if (!p) return reply(cb, { ok: false });
    p.socketId = socket.id;
    p.connected = true;
    p.lastSeen = Date.now();
    socket.data.token = p.token;
    reply(cb, { ok: true, name: p.name, view: playerView(p) });
    sendHost();
  });

  socket.on('player:answer', (data, cb) => {
    const p = players.get(socket.data.token);
    if (!p || !data) return reply(cb, { ok: false, error: 'unknown' });
    const res = submitAnswer(p, data.choice);
    reply(cb, { ok: res === 'ok', error: res === 'ok' ? undefined : res });
    if (res === 'ok') {
      sendHost();
      checkAllAnswered();
    }
  });

  socket.on('disconnect', () => {
    hosts.delete(socket.id);
    const p = players.get(socket.data.token);
    if (p && p.socketId === socket.id) {
      p.connected = false;
      p.lastSeen = Date.now();
      sendHost();
      checkAllAnswered();
      setTimeout(checkAllAnswered, RECONNECT_GRACE_MS + 100).unref();
    }
  });
});

/* Lange abwesende Spieler aufräumen (Speicher sauber halten) */
setInterval(() => {
  const now = Date.now();
  let changed = false;
  for (const [token, p] of players) {
    if (!p.connected && now - p.lastSeen > OFFLINE_KEEP_MS) { players.delete(token); changed = true; }
  }
  if (changed) sendHost();
}, 5 * 60 * 1000).unref();

server.listen(PORT, () => {
  console.log(`SpanishBoys Quiz läuft auf http://localhost:${PORT}  (Host: /host)`);
  if (!process.env.HOST_PASSWORD) console.log('Hinweis: Standard-Host-Passwort "comida" – online bitte HOST_PASSWORD setzen!');
});
