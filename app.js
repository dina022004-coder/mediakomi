/* Медиакоми — игровая логика */
'use strict';

const ROUND_COUNT = 10;
const SLIDER_MIN = 50000;
const SLIDER_MAX = 2000000;
const SLIDER_STEP = 5000;

const fmt = new Intl.NumberFormat('ru-RU');
const rub = n => fmt.format(n) + ' ₽';

// --- Балльная система: чем ближе к реальной цене, тем больше баллов ---
function calcPoints(guess, real) {
  const d = Math.abs(guess - real) / real;
  if (d <= 0.05) return { pts: 100, label: 'Точное попадание!' };
  if (d <= 0.10) return { pts: 80,  label: 'Почти в точку!' };
  if (d <= 0.20) return { pts: 60,  label: 'Хороший глазомер!' };
  if (d <= 0.35) return { pts: 40,  label: 'Неплохо, но мимо' };
  if (d <= 0.50) return { pts: 20,  label: 'Сильно мимо' };
  return { pts: 0, label: 'Совсем не угадали' };
}

// Архетип по систематическому смещению ставок игрока
function pickArchetype(results) {
  const bias = results.reduce((s, r) => s + (r.guess - r.real) / r.real, 0) / results.length;
  if (bias >= 0.15) {
    return {
      emoji: '💸', title: 'Транжира',
      desc: 'Ваши цены стабильно выше реальных — вы переплачивали бы за каждую квартиру. На рынке Коми такое не прощают: торгуйтесь смелее!'
    };
  }
  if (bias <= -0.15) {
    return {
      emoji: '🧠', title: 'Жадный студент',
      desc: 'Вы называли цены заметно ниже реальных. Экономия — это хорошо, но с такой ставкой ни одну квартиру не купишь. Владельцы даже не ответят!'
    };
  }
  return {
    emoji: '🏡', title: 'Адекватный квартирант',
    desc: 'Ваши оценки в целом совпадают с реальными ценами. Вы трезво смотрите на рынок недвижимости Коми — агентствам стоит вас переманить!'
  };
}

// --- Состояние ---
let game = null;

const $ = id => document.getElementById(id);
const screens = { start: $('screen-start'), game: $('screen-game'), final: $('screen-final') };
function show(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
  window.scrollTo(0, 0);
}

// --- Старт ---
$('btn-start').addEventListener('click', startGame);
$('btn-restart').addEventListener('click', startGame);

function startGame() {
  const pool = LOTS.slice();
  // Фишер—Йетс
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  game = { lots: pool.slice(0, ROUND_COUNT), round: 0, results: [] };
  show('game');
  renderLot();
}

// --- Рендер лота ---
function renderLot() {
  const lot = game.lots[game.round];
  $('round-counter').textContent = `Квартира ${game.round + 1} / ${ROUND_COUNT}`;
  $('progress-fill').style.width = (game.round / ROUND_COUNT * 100) + '%';

  // Галерея
  const gallery = $('gallery');
  gallery.innerHTML = '';
  lot.photos.forEach(src => {
    const img = new Image();
    img.src = src;
    img.alt = 'Фотография квартиры';
    img.loading = 'eager';
    gallery.appendChild(img);
  });
  // Точки-переключатели
  const dots = $('gallery-dots');
  dots.innerHTML = '';
  if (lot.photos.length > 1) {
    lot.photos.forEach((_, i) => {
      const d = document.createElement('span');
      d.className = 'dot' + (i === 0 ? ' on' : '');
      dots.appendChild(d);
    });
  }
  gallery.onscroll = () => {
    const i = Math.round(gallery.scrollLeft / gallery.clientWidth);
    dots.querySelectorAll('.dot').forEach((d, k) => d.classList.toggle('on', k === i));
  };

  $('lot-title').textContent = lot.title;
  $('lot-street').textContent = '📍 ' + lot.street;

  // Сброс ставки
  const slider = $('price-slider');
  slider.value = 500000;
  updateSlider(slider);

  $('bid-block').classList.remove('hidden');
  $('btn-submit').classList.remove('hidden');
  $('round-result').classList.add('hidden');
}

// --- Слайдер ---
const slider = $('price-slider');
slider.addEventListener('input', () => updateSlider(slider));
function updateSlider(el) {
  $('bid-value').textContent = rub(+el.value);
  const pct = (el.value - el.min) / (el.max - el.min) * 100;
  el.style.setProperty('--fill', pct + '%');
}

// --- Оценка ---
$('btn-submit').addEventListener('click', submitGuess);
function submitGuess() {
  const lot = game.lots[game.round];
  const guess = +slider.value;
  const { pts, label } = calcPoints(guess, lot.price);
  const diff = guess - lot.price;
  game.results.push({ lot, guess, real: lot.price, pts, diff });

  // Экран результата
  $('bid-block').classList.add('hidden');
  $('btn-submit').classList.add('hidden');
  $('round-result').classList.remove('hidden');

  const v = $('rr-verdict');
  v.textContent = label;
  v.className = 'rr-verdict ' + (pts >= 80 ? 'good' : pts >= 40 ? 'mid' : 'bad');

  $('rr-guess').textContent = rub(guess);
  $('rr-real').textContent = rub(lot.price);

  const absDiff = Math.abs(diff);
  const pct = Math.round(absDiff / lot.price * 100);
  const dir = diff > 0 ? 'выше' : diff < 0 ? 'ниже' : '';
  const cls = Math.abs(diff) < 1 ? 'exact' : diff > 0 ? 'over' : 'under';
  $('rr-diff').innerHTML = diff === 0
    ? '<span class="exact">Идеально!</span>'
    : `<span class="${cls}">${dir} на ${rub(absDiff)} (${pct}%)</span>`;

  $('rr-points').textContent = `+${pts} баллов`;
  $('rr-link').href = lot.url;
  $('btn-next').textContent = game.round === ROUND_COUNT - 1 ? 'Показать итоги 🏁' : 'Следующая квартира';
  $('progress-fill').style.width = ((game.round + 1) / ROUND_COUNT * 100) + '%';
  $('round-result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// --- Далее ---
$('btn-next').addEventListener('click', () => {
  game.round++;
  if (game.round < ROUND_COUNT) renderLot();
  else showFinal();
});

// --- Финал ---
function showFinal() {
  const results = game.results;
  const total = results.reduce((s, r) => s + r.pts, 0);
  const arch = pickArchetype(results);
  const close = results.filter(r => r.pts >= 80).length;
  const over = results.filter(r => r.diff > 0).length;
  const under = results.filter(r => r.diff < 0).length;

  $('arch-emoji').textContent = arch.emoji;
  $('arch-title').textContent = arch.title;
  $('arch-desc').textContent = arch.desc;
  $('final-score').textContent = total;
  $('stat-close').textContent = close;
  $('stat-over').textContent = over;
  $('stat-under').textContent = under;

  const details = $('final-details');
  details.innerHTML = '';
  results.forEach((r, i) => {
    const pct = Math.round(Math.abs(r.diff) / r.real * 100);
    const cls = Math.abs(r.diff) < 1 ? 'exact' : r.diff > 0 ? 'over' : 'under';
    const sign = r.diff > 0 ? '+' : r.diff < 0 ? '−' : '';
    const row = document.createElement('div');
    row.className = 'fd-row';
    row.innerHTML =
      `<span class="fd-name">${i + 1}. ${r.lot.title}, ${r.lot.street}</span>` +
      `<span class="fd-diff ${cls}">${r.diff === 0 ? 'в точку' : sign + fmt.format(Math.round(Math.abs(r.diff) / 1000)) + ' тыс.'}</span>` +
      `<span class="fd-pts">${r.pts}</span>`;
    details.appendChild(row);
  });

  show('final');
}

// Инициализация слайдера
updateSlider(slider);
