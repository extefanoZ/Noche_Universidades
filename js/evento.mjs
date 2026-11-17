import { AUDIENCES, QUESTION_COUNT, SECONDS_PER_QUESTION, instagramHandle, multiplier, pointsFor } from './evento-reglas.mjs';

const $ = (id) => document.getElementById(id);
const format = new Intl.NumberFormat('es-AR');
const queuePrefix = 'giesin-resultado-pendiente:';
const pending = new Map();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let bank, round, timer, deadline, answered, lastResultId;
let sending = false;
const savedLocally = new Set();

function shuffle(items) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function showScreen(screen) {
  for (const id of ['welcome', 'game', 'finish', 'ranking']) $(id).hidden = id !== screen;
  $('ranking-link').hidden = screen === 'ranking' || screen === 'game';
  window.scrollTo(0, 0);
}

async function loadBank() {
  try {
    const response = await fetch('/data/evento.json');
    if (!response.ok) throw new Error('Banco no disponible');
    const questions = await response.json();
    if (questions.length < QUESTION_COUNT) throw new Error('Banco incompleto');
    bank = questions;
    $('start').disabled = false;
  } catch {
    $('load-status').hidden = false;
    $('load-status').textContent = 'No pudimos cargar las preguntas. Revisá la conexión y recargá la página.';
  }
}

function revealAudience() {
  const start = $('start');
  const picker = $('audience-picker');
  const title = $('audience-title');
  const origin = reducedMotion.matches ? null : start.getBoundingClientRect();
  start.hidden = true;
  start.disabled = true;
  picker.hidden = false;

  if (origin) {
    const timing = { duration: 420, easing: 'cubic-bezier(.2, .75, .25, 1)' };
    const textFrames = [{ opacity: 0 }, { opacity: 0, offset: .25 }, { opacity: 1 }];
    title.animate(textFrames, timing);
    for (const button of picker.querySelectorAll('button')) {
      const target = button.getBoundingClientRect();
      const x = origin.left - target.left;
      const y = origin.top - target.top;
      const scaleX = origin.width / target.width;
      const scaleY = origin.height / target.height;
      button.animate([
        { transformOrigin: 'top left', transform: `translate(${x}px, ${y}px) scale(${scaleX}, ${scaleY})` },
        { transformOrigin: 'top left', transform: 'none' },
      ], timing);
      button.firstElementChild.animate(textFrames, timing);
    }
  }
  title.focus();
}

function begin(event) {
  event.preventDefault();
  if (!bank) return;
  const name = $('name').value.trim();
  const instagram = instagramHandle($('instagram').value);
  $('name').setCustomValidity(name ? '' : 'Ingresá tu nombre.');
  $('instagram').setCustomValidity(instagram === null ? 'Ingresá el usuario de Instagram, con o sin @.' : '');
  if (!$('signup').reportValidity()) return;

  if (event.submitter === $('start')) {
    revealAudience();
    return;
  }

  const audience = event.submitter?.value;
  if ($('audience-picker').hidden || !AUDIENCES.includes(audience)) return;

  round = {
    name, audience, instagram, questions: shuffle(bank).slice(0, QUESTION_COUNT),
    answers: [], index: 0, score: 0, streak: 0, usedHalf: false,
  };
  showScreen('game');
  showQuestion();
}

function paintClock(now) {
  const remaining = Math.max(0, (deadline - now) / 1000);
  const seconds = Math.ceil(remaining);
  $('time-bar').value = remaining;
  $('seconds').textContent = seconds + ' s';
  $('time-bar').classList.toggle('urgent', seconds <= 8);
}

function tick(now) {
  if (now >= deadline) {
    answer(null);
    return;
  }
  paintClock(now);
  timer = requestAnimationFrame(tick);
}

function showQuestion() {
  const question = round.questions[round.index];
  answered = false;
  $('question').textContent = question.pregunta;
  $('progress').textContent = 'Pregunta ' + (round.index + 1) + ' de ' + QUESTION_COUNT;
  $('score').textContent = format.format(round.score);
  $('feedback').textContent = '';
  $('next').hidden = true;
  $('half').hidden = round.usedHalf;
  $('half').disabled = false;
  $('options').replaceChildren();

  shuffle(question.opciones.map((_, index) => index)).forEach((index, position) => {
    const button = document.createElement('button');
    const letter = document.createElement('span');
    const label = document.createElement('span');
    button.type = 'button';
    button.dataset.index = index;
    letter.className = 'option-letter';
    letter.textContent = 'ABCD'[position];
    label.textContent = question.opciones[index];
    button.append(letter, label);
    button.addEventListener('click', () => answer(index));
    $('options').append(button);
  });

  const now = performance.now();
  deadline = now + SECONDS_PER_QUESTION * 1000;
  paintClock(now);
  timer = requestAnimationFrame(tick);
  $('question').focus({ preventScroll: true });
}

function showStreak() {
  const badge = $('streak');
  badge.hidden = round.streak < 3;
  if (badge.hidden) return;
  $('multiplier').textContent = '×' + format.format(multiplier(round.streak));
  badge.style.setProperty('--burst-color', ['#c9f16d', '#ffd66e', '#ffa578', '#edbaff', '#86e5f3', '#a8baff'][round.streak - 3]);
  if (!reducedMotion.matches) {
    badge.getAnimations().forEach((animation) => animation.cancel());
    badge.animate([
      { transform: 'scale(.6) rotate(-12deg)' },
      { transform: 'scale(1.12) rotate(5deg)', offset: .65 },
      { transform: 'scale(1) rotate(0)' },
    ], { duration: 400, easing: 'ease-out' });
  }
}

function answer(choice) {
  if (answered) return;
  answered = true;
  cancelAnimationFrame(timer);
  const now = performance.now();
  const seconds = Math.max(0, Math.min(SECONDS_PER_QUESTION, Math.ceil((deadline - now) / 1000)));
  if (!seconds) choice = null;
  const question = round.questions[round.index];
  const correct = choice === question.respuesta;
  round.streak = correct ? round.streak + 1 : 0;
  const earned = correct ? pointsFor(seconds, round.streak) : 0;
  round.score += earned;
  round.answers.push({ questionId: question.id, choice, seconds: choice === null ? 0 : seconds });
  paintClock(now);
  showStreak();
  $('score').textContent = format.format(round.score);
  for (const button of $('options').children) {
    button.disabled = true;
    const index = Number(button.dataset.index);
    if (index === question.respuesta) button.classList.add('correct');
    if (index === choice && !correct) button.classList.add('incorrect');
  }
  const rightAnswer = question.opciones[question.respuesta];
  $('feedback').textContent = correct
    ? '¡Correcto! +' + format.format(earned) + ' pts'
    : (choice === null ? 'Se terminó el tiempo. ' : 'Respuesta incorrecta. ') + 'La respuesta era ' + rightAnswer + '.';
  $('half').disabled = true;
  $('next').hidden = false;
  $('next').textContent = round.index + 1 === QUESTION_COUNT ? 'Ver resultado →' : 'Siguiente pregunta →';
  $('next').focus({ preventScroll: true });
}

function useHalf() {
  if (answered || round.usedHalf) return;
  if (performance.now() >= deadline) {
    answer(null);
    return;
  }
  round.usedHalf = true;
  const correct = round.questions[round.index].respuesta;
  const wrong = [...$('options').children].filter((button) => Number(button.dataset.index) !== correct);
  for (const button of shuffle(wrong).slice(0, 2)) {
    button.disabled = true;
    button.classList.add('eliminated');
  }
  $('half').disabled = true;
  $('feedback').textContent = 'Eliminaste dos opciones.';
}

function savePending(result) {
  pending.set(result.id, result);
  try {
    localStorage.setItem(queuePrefix + result.id, JSON.stringify(result));
    savedLocally.add(result.id);
  } catch { /* El resultado sigue disponible en esta pestaña. */ }
}

function restoreQueue() {
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key?.startsWith(queuePrefix)) continue;
      const result = JSON.parse(localStorage.getItem(key));
      if (!result || key !== queuePrefix + result.id) continue;
      pending.set(result.id, result);
      savedLocally.add(result.id);
    }
  } catch { /* La partida puede empezar aunque el almacenamiento esté restringido. */ }
}

function sendStatus(message, retry = false) {
  $('send-status').textContent = message;
  $('retry').hidden = !retry;
}

async function flushQueue() {
  if (sending || !pending.size) return;
  sending = true;
  try {
    for (const result of pending.values()) {
      try {
        const response = await fetch('/api/resultados', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(result),
          signal: AbortSignal.timeout(6000),
        });
        if (!response.ok && response.status !== 400 && response.status !== 413) throw new Error('Envío pendiente');
        pending.delete(result.id);
        savedLocally.delete(result.id);
        try { localStorage.removeItem(queuePrefix + result.id); } catch { /* El servidor deduplica los reintentos. */ }
        if (result.id === lastResultId) {
          sendStatus(response.ok ? 'Tu puntaje ya está en el ranking.' : 'El ranking no pudo aceptar esta partida.');
        }
      } catch {
        if (pending.has(lastResultId)) {
          sendStatus(savedLocally.has(lastResultId)
            ? 'Puntaje guardado en este dispositivo. Se enviará cuando vuelva la conexión.'
            : 'El envío está pendiente. Mantené esta pestaña abierta hasta recuperar la conexión.', true);
        }
        break;
      }
    }
  } finally {
    sending = false;
  }
}

function finish() {
  const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const correct = round.answers.filter((entry, index) => entry.choice === round.questions[index].respuesta).length;
  savePending({ id, name: round.name, audience: round.audience, instagram: round.instagram, answers: round.answers });
  lastResultId = id;
  $('final-score').textContent = format.format(round.score);
  $('summary').textContent = correct + ' de ' + QUESTION_COUNT + ' respuestas correctas.';
  sendStatus('Enviando tu puntaje…');
  $('signup').reset();
  $('audience-picker').hidden = true;
  $('start').hidden = false;
  $('start').disabled = false;
  showScreen('finish');
  $('finish-title').focus();
  void flushQueue();
}

async function refreshRanking() {
  try {
    const response = await fetch('/api/ranking', { signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw new Error('Ranking no disponible');
    const results = await response.json();
    for (const audience of AUDIENCES) {
      const entries = results[audience].map(({ name, score }) => {
        const row = document.createElement('li');
        const entry = document.createElement('div');
        const player = document.createElement('span');
        const points = document.createElement('strong');
        entry.className = 'ranking-entry';
        player.textContent = name;
        points.textContent = format.format(score) + ' pts';
        entry.append(player, points);
        row.append(entry);
        return row;
      });
      $('ranking-' + audience).replaceChildren(...entries);
      $('empty-' + audience).hidden = entries.length > 0;
    }
    $('ranking-status').textContent = '';
  } catch {
    $('ranking-status').textContent = 'Sin conexión con el ranking. Se actualizará al reconectar.';
  }
}

if (location.pathname === '/ranking') {
  document.title = 'Ranking del stand | Desafío GIESIN';
  showScreen('ranking');
  void refreshRanking();
  setInterval(refreshRanking, 10000);
} else {
  $('question-count').textContent = QUESTION_COUNT;
  $('signup').addEventListener('submit', begin);
  for (const id of ['name', 'instagram']) $(id).addEventListener('input', () => $(id).setCustomValidity(''));
  $('half').addEventListener('click', useHalf);
  $('next').addEventListener('click', () => {
    round.index++;
    if (round.index === QUESTION_COUNT) finish();
    else showQuestion();
  });
  $('retry').addEventListener('click', flushQueue);
  $('restart').addEventListener('click', () => {
    lastResultId = null;
    $('streak').hidden = true;
    showScreen('welcome');
    $('name').focus();
  });
  restoreQueue();
  window.addEventListener('online', flushQueue);
  setInterval(flushQueue, 12000);
  void flushQueue();
  void loadBank();
}
