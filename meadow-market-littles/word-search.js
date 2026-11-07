(() => {
  'use strict';

  const dialogId = '#word-search-dialog';
  const storeKey = 'meadow-littles-word-search-v1';
  let size = 9;
  const colorSet = [
    ['#ffe28a', '#956900'], ['#bce8a8', '#39733d'], ['#ffc5a6', '#a84b29'],
    ['#b9e4f7', '#347597'], ['#e0c7f3', '#75509a'], ['#ffc5d8', '#a44769']
  ];
  const topics = [
    { id: 'everyday', name: 'Everyday words', icon: '☀️', scene: 'assets/generated/market/farmers-market.webp', words: [['sun', '☀️'], ['cup', '🥤'], ['bed', '🛏️'], ['hat', '👒'], ['bag', '👜'], ['pen', '🖍️'], ['bus', '🚌'], ['car', '🚗'], ['box', '📦'], ['egg', '🥚'], ['toy', '🧸'], ['red', '🔴'], ['run', '🏃'], ['top', '🔝'], ['fun', '🎈'], ['map', '🗺️'], ['mom', '👩'], ['dad', '👨'], ['book', '📚'], ['ball', '⚽'], ['game', '🎲'], ['home', '🏠'], ['bath', '🛁'], ['milk', '🥛'], ['shoe', '👟'], ['sock', '🧦'], ['coat', '🧥'], ['play', '🛝'], ['help', '🫶'], ['hand', '✋'], ['nose', '👃'], ['eyes', '👀'], ['baby', '👶'], ['teddy', '🧸'], ['dress', '👗'], ['snack', '🍎'], ['lunch', '🥪'], ['happy', '😊'], ['school', '🏫'], ['sleep', '😴'], ['water', '💧'], ['train', '🚂']] },
    { id: 'animals', name: 'Animal friends', icon: '🐮', scene: 'assets/generated/minigames/meadow.webp', words: [['cat', '🐱'], ['dog', '🐶'], ['pig', '🐷'], ['hen', '🐔', 'assets/generated/hen.webp'], ['cow', '🐮', 'assets/generated/cow.webp'], ['fox', '🦊'], ['bee', '🐝'], ['owl', '🦉'], ['ant', '🐜'], ['bat', '🦇'], ['bug', '🐞'], ['duck', '🦆'], ['fish', '🐟'], ['frog', '🐸'], ['goat', '🐐'], ['bear', '🐻'], ['lion', '🦁'], ['pony', '🐴'], ['lamb', '🐑'], ['calf', '🐮'], ['chick', '🐣'], ['horse', '🐴'], ['sheep', '🐑', 'assets/generated/sheep.webp'], ['mouse', '🐭'], ['bunny', '🐰'], ['puppy', '🐶'], ['kitty', '🐱'], ['tiger', '🐯'], ['zebra', '🦓'], ['whale', '🐳'], ['panda', '🐼'], ['snail', '🐌'], ['snake', '🐍'], ['camel', '🐫'], ['eagle', '🦅'], ['koala', '🐨'], ['deer', '🦌'], ['moose', '🫎'], ['swan', '🦢'], ['parrot', '🦜'], ['donkey', '🫏'], ['rabbit', '🐇']] },
    { id: 'farm', name: 'On the farm', icon: '🌾', scene: 'assets/generated/minigames/tractor-scene.webp', words: [['cow', '🐮', 'assets/generated/cow.webp'], ['pig', '🐷'], ['hen', '🐔', 'assets/generated/hen.webp'], ['egg', '🥚'], ['hay', '🌾'], ['bee', '🐝'], ['ram', '🐏'], ['pea', '🫛'], ['barn', '🏚️'], ['farm', '🚜'], ['goat', '🐐'], ['duck', '🦆'], ['corn', '🌽'], ['seed', '🌱'], ['calf', '🐮'], ['lamb', '🐑'], ['pony', '🐴'], ['coop', '🐓'], ['milk', '🥛'], ['cart', '🛒'], ['bale', '🌾'], ['gate', '🚪'], ['roof', '🏠'], ['crop', '🌱'], ['wheat', '🌾'], ['grain', '🌾'], ['field', '🌱'], ['soil', '🪴'], ['well', '🪣'], ['pond', '🦆'], ['horse', '🐴'], ['apple', '🍎'], ['peach', '🍑'], ['plum', '🫐'], ['melon', '🍈'], ['goose', '🪿'], ['chick', '🐣'], ['sheep', '🐑', 'assets/generated/sheep.webp'], ['chore', '🧹'], ['plant', '🌱'], ['wool', '🧶']] },
    { id: 'city', name: 'Meadow Town', icon: '🚌', scene: 'assets/generated/word-search/city-scene.svg', words: [['cop', '👮'], ['bus', '🚌'], ['cab', '🚕'], ['car', '🚗'], ['van', '🚐'], ['map', '🗺️'], ['jet', '✈️'], ['zoo', '🦁'], ['taxi', '🚕'], ['shop', '🏪'], ['stop', '🛑'], ['park', '🌳'], ['road', '🛣️'], ['sign', '🪧'], ['town', '🏘️'], ['bike', '🚲'], ['train', '🚂'], ['truck', '🚚'], ['plane', '✈️'], ['store', '🏬'], ['house', '🏠'], ['beach', '🏖️'], ['boat', '⛵'], ['ship', '🚢'], ['fire', '🚒'], ['light', '🚦'], ['school', '🏫'], ['police', '👮'], ['cross', '🚸'], ['street', '🛣️'], ['bridge', '🌉'], ['river', '🏞️'], ['hotel', '🏨'], ['cafe', '☕'], ['bread', '🥖'], ['fruit', '🍎'], ['flower', '🌼'], ['market', '🛒'], ['cinema', '🎬'], ['doctor', '🩺'], ['nurse', '🧑‍⚕️']] }
  ];
  let api, dialog, topic = topics[2], wordCount = 3, board = [], answers = [], found = new Map(), path = [], drag = null, skipCellClick = false, startedAt = 0, completedAt = 0, clockId = 0, winTimer = 0, starCount = 0, layoutHistory = [], resizeHandler = null;
  const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const audio = (id) => window.meadowAudio?.play(id);
  const say = (text) => { const live = dialog?.querySelector('[data-live]'); if (live) live.textContent = text; };
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const shuffle = (list) => { const result = list.slice(); for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; } return result; };
  const image = (word) => word.asset ? '<img src="' + esc(word.asset) + '" alt="">' : '<span class="ws-object-emoji" aria-hidden="true">' + word.icon + '</span>';
  const sceneUrl = () => topic.scene;
  const appState = () => api?.state?.();
  const wordTaps = new Map();
  function wordPrompt(label, taps = 0) {
    const word = String(label).toLowerCase(), clue = taps % 2 === 1;
    return { cue: clue ? ['ws-clue-start', 'ws-letter-' + word[0], 'ws-clue-next'] : [...word].map(letter => 'ws-letter-' + letter).concat('ws-word-' + word), gap: clue ? .14 : .3,
      kind: clue ? 'clue' : 'spelling',
      text: clue ? 'Let’s find ' + word[0].toUpperCase() + ' to start ' + word.toUpperCase() + '. What’s the next letter?' : word.toUpperCase().split('').join(' · ') + ' — ' + word.toUpperCase() + '. Tap the word again for a clue.' };
  }
  function hearWord(answer, button) {
    const taps = wordTaps.get(answer.id) || 0, prompt = wordPrompt(answer.label, taps);
    wordTaps.set(answer.id, taps + 1); clearTimeout(showPicture.timer);
    dialog.querySelector('.ws-found-pop')?.remove();
    button.dataset.help = prompt.kind; say(prompt.text);
    window.meadowAudio?.speak(prompt.cue, { gap: prompt.gap });
  }
  function praise() { window.meadowAudio?.speak('ws-jade-praise-'+Math.floor(Math.random()*4)); audio('reward'); }
  function boardSize() {
    // Keep the letter field small enough to scan at preschool age. Tablets get
    // a little more breathing room, while every word remains short and direct.
    const tablet = window.innerWidth >= 900 && window.innerHeight >= 600;
    if (wordCount <= 3) return tablet ? 6 : 5;
    if (wordCount <= 4) return tablet ? 7 : 6;
    return tablet ? 8 : 7;
  }
  function wordLengthLimit() { return wordCount <= 3 ? 3 : wordCount <= 4 ? 4 : 5; }
  function loadHistory() { try { const saved = JSON.parse(localStorage.getItem(storeKey) || '{}'); layoutHistory = Array.isArray(saved.layouts) ? saved.layouts.filter((item) => typeof item === 'string').slice(-250) : []; } catch { layoutHistory = []; } }
  function saveHistory(signature) { layoutHistory.push(signature); layoutHistory = layoutHistory.slice(-250); try { localStorage.setItem(storeKey, JSON.stringify({ layouts: layoutHistory })); } catch {} }
  function buildBoard(words) {
    for (let attempt = 0; attempt < 250; attempt++) {
      const cells = Array(size * size).fill('');
      const placed = [];
      const ordered = shuffle(words);
      function placeWord(index) {
        if (index === ordered.length) return true;
        const word = ordered[index];
        const starts = [];
        for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
          if (col + word.label.length <= size) starts.push({ row, col, dr: 0, dc: 1 });
          if (row + word.label.length <= size) starts.push({ row, col, dr: 1, dc: 0 });
        }
        for (const start of shuffle(starts)) {
          const indices = Array.from({ length: word.label.length }, (_, offset) => (start.row + start.dr * offset) * size + start.col + start.dc * offset);
          if (indices.some((cell) => cells[cell])) continue;
          indices.forEach((cell, offset) => { cells[cell] = word.label[offset]; });
          placed.push({ ...word, indices });
          if (placeWord(index + 1)) return true;
          placed.pop(); indices.forEach((cell) => { cells[cell] = ''; });
        }
        return false;
      }
      if (!placeWord(0)) continue;
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
      const full = cells.map((letter) => letter || pick(alphabet.split('')));
      if (hasExtraWord(full, placed)) continue;
      const signature = topic.id + ':' + words.map((word) => word.id).sort().join(',') + ':' + full.join('') + ':' + placed.map((word) => word.id + '=' + word.indices.join('.')).sort().join(';');
      if (layoutHistory.includes(signature)) continue;
      return { cells: full, answers: placed, signature };
    }
    throw new Error('Could not make a fresh word search.');
  }
  function hasExtraWord(cells, placed) {
    const solutionPaths = new Map(placed.map((word) => [word.id, word.indices]));
    const words = new Map(placed.map((word) => [word.label, word.id]));
    const lengths = [...new Set(placed.map((word) => word.label.length))];
    for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        for (const length of lengths) {
          if (row + dr * (length - 1) >= size || col + dc * (length - 1) >= size) continue;
          const indices = Array.from({ length }, (_, step) => (row + dr * step) * size + col + dc * step);
          const text = indices.map((index) => cells[index]).join(''), reverse = [...text].reverse().join('');
          const id = words.get(text) || words.get(reverse);
          if (!id) continue;
          const answer = solutionPaths.get(id);
          if (!samePath(indices, answer) && !samePath(indices, answer.slice().reverse())) return true;
        }
      }
    }
    return false;
  }
  function screen(content, extra = '') {
    if (resizeHandler) window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
    dialog.innerHTML = '<main class="ws-screen" style="--ws-scene:url(\'' + esc(sceneUrl()) + '\')"><div class="ws-window ' + extra + '">' + content + '</div><div class="ws-star-layer" aria-hidden="true"></div></main>';
    dialog.showModal();
  }
  function open() {
    topic = topics.find((item) => item.id === topic.id) || topics[2]; wordCount = 3; loadHistory(); intro();
  }
  function intro() {
    clearInterval(clockId); clearTimeout(winTimer); clockId = 0; winTimer = 0;
    const topicCards = topics.map((item) => '<button class="ws-topic ' + (topic.id === item.id ? 'selected' : '') + '" data-topic="' + item.id + '" aria-pressed="' + (topic.id === item.id) + '"><span aria-hidden="true">' + item.icon + '</span><strong>' + item.name + '</strong></button>').join('');
    const countButtons = [3, 4, 6].map((count) => '<button class="ws-count ' + (wordCount === count ? 'selected' : '') + '" data-count="' + count + '" aria-pressed="' + (wordCount === count) + '">' + count + ' words</button>').join('');
    screen('<header class="ws-header"><div><small>MEADOW MARKET LITTLES</small><h1>Little Word Search</h1></div><button class="ws-close" data-close aria-label="Back to games">×</button></header><section class="ws-intro"><div class="ws-intro-art" aria-hidden="true">' + topic.icon + '</div><h2>Find little words!</h2><p>Put your finger on a letter. Follow the word, one letter at a time.</p><h3>Choose a picture world</h3><div class="ws-topics">' + topicCards + '</div><h3>How many words?</h3><div class="ws-counts">' + countButtons + '</div><button class="ws-start" data-start>Let’s play!</button></section><div class="ws-live" data-live role="status" aria-live="polite">Choose your favourite word world.</div>');
    bindClose();
    dialog.querySelectorAll('[data-topic]').forEach((button) => button.addEventListener('click', () => { topic = topics.find((item) => item.id === button.dataset.topic) || topics[2]; intro(); }));
    dialog.querySelectorAll('[data-count]').forEach((button) => button.addEventListener('click', () => { wordCount = Number(button.dataset.count); intro(); }));
    dialog.querySelector('[data-start]').addEventListener('click', newRound);
    window.meadowAudio?.stopVoice();
  }
  function newRound() {
    wordTaps.clear();
    clearInterval(clockId); clearTimeout(winTimer); winTimer = 0; found = new Map(); path = []; drag = null; starCount = 0;
    completedAt = 0;
    window.meadowAudio?.stopVoice();
    size = boardSize();
    const choices = shuffle(topic.words
      .filter(([label]) => label.length <= wordLengthLimit())
      .map(([label, icon, asset]) => ({ id: topic.id + '-' + label, label: label.toUpperCase(), icon, asset })));
    const result = buildBoard(choices.slice(0, wordCount)); board = result.cells; answers = result.answers; saveHistory(result.signature); startedAt = Date.now();
    playBoard(); clockId = setInterval(updateTimer, 1000); updateTimer();
  }
  function playBoard() {
    const words = answers.map((answer) => '<button class="ws-word" aria-description="Tap to hear the spelling and word. Tap again for a first-letter clue." data-word="' + answer.id + '"><span>' + answer.label + '</span></button>').join('');
    const cells = board.map((letter, index) => '<button class="ws-cell" role="gridcell" aria-rowindex="' + (Math.floor(index / size) + 1) + '" aria-colindex="' + ((index % size) + 1) + '" data-cell="' + index + '" aria-label="Letter ' + letter + '">' + letter + '</button>').join('');
    screen('<header class="ws-header"><div><small>' + esc(topic.name.toUpperCase()) + ' · ' + wordCount + ' LITTLE WORDS</small><h1>Find the words</h1></div><button class="ws-close" data-close aria-label="Back to games">×</button></header><div class="ws-status"><span class="ws-progress" data-progress>0 of ' + wordCount + ' found</span><span class="ws-timer" data-timer aria-label="Time">00:00</span></div><section class="ws-board-wrap"><div class="ws-grid" role="grid" aria-label="Word search letters">' + cells + '</div><div class="ws-word-list" aria-label="Words to find">' + words + '</div><div class="ws-live" data-live role="status" aria-live="polite">Tap a word to hear it spelled. Tap again for a clue.</div></section><footer class="ws-controls"><button class="ws-help" data-hear>🔊 Hear the directions</button><button class="ws-help" data-new>New puzzle</button></footer>');
    bindClose();
    const grid = dialog.querySelector('.ws-grid');
    dialog.querySelectorAll('[data-word]').forEach(button => button.addEventListener('click', () => {
      const answer = answers.find(word => word.id === button.dataset.word);
      if (answer) hearWord(answer, button);
    }));
    grid.addEventListener('pointerdown', (event) => { const cell = event.target.closest('[data-cell]'); if (!cell || event.button > 0) return; event.preventDefault(); drag = event.pointerId; skipCellClick = true; setTimeout(() => { skipCellClick = false; }, 500); grid.setPointerCapture?.(event.pointerId); path = [Number(cell.dataset.cell)]; renderCells(); });
    grid.addEventListener('pointermove', (event) => { if (drag !== event.pointerId) return; const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-cell]'); if (cell && grid.contains(cell)) extendPath(Number(cell.dataset.cell)); });
    grid.addEventListener('pointerup', (event) => { if (drag !== event.pointerId) return; drag = null; if (grid.hasPointerCapture?.(event.pointerId)) grid.releasePointerCapture(event.pointerId); finishPath(); });
    grid.addEventListener('pointercancel', () => { drag = null; path = []; renderCells(); });
    grid.addEventListener('click', (event) => { if (skipCellClick) { skipCellClick = false; return; } if (drag !== null) return; const cell = event.target.closest('[data-cell]'); if (!cell) return; const index = Number(cell.dataset.cell); if (!path.length) path = [index]; else if (path[0] === index) path = []; else extendPath(index); renderCells(); if (path.length > 2) finishPath(); });
    dialog.querySelector('[data-new]').addEventListener('click', newRound);
    dialog.querySelector('[data-hear]').addEventListener('click', () => window.meadowAudio?.speak('ws-rhys-intro'));
    resizeHandler = () => requestAnimationFrame(sizeBoard);
    window.addEventListener('resize', resizeHandler);
    requestAnimationFrame(sizeBoard);
    window.meadowAudio?.speak('ws-rhys-intro');
  }
  function sizeBoard() {
    const wrap = dialog?.querySelector('.ws-board-wrap'), grid = dialog?.querySelector('.ws-grid');
    if (!wrap || !grid) return;
    const landscape = window.matchMedia('(orientation: landscape) and (min-width: 620px)').matches;
    const width = landscape ? wrap.clientWidth * .65 : wrap.clientWidth;
    const height = landscape ? wrap.clientHeight : wrap.clientHeight - (dialog.querySelector('.ws-word-list')?.offsetHeight || 0) - (dialog.querySelector('[data-live]')?.offsetHeight || 0) - 20;
    const gap = Math.max(2, Math.min(5, Math.floor(width / (size * 22))));
    const padding = 20;
    // Keep each letter easy to touch without letting tall tablets inflate the
    // puzzle to fill the whole screen. Larger word sets use slightly smaller
    // tiles so the board stays calm and the words remain visible together.
    const tablet = window.innerWidth >= 900 && window.innerHeight >= 600;
    const maxCell = wordCount <= 3 ? (tablet ? 64 : 56) : wordCount <= 4 ? (tablet ? 58 : 52) : (tablet ? 54 : 48);
    const cell = Math.min(maxCell, Math.floor(Math.min((width - padding - gap * (size - 1)) / size, (height - padding - gap * (size - 1)) / size)));
    if (!Number.isFinite(cell) || cell < 17) return;
    grid.style.setProperty('--ws-cols', size);
    grid.style.setProperty('--ws-cell', cell + 'px');
    grid.style.setProperty('--ws-gap', gap + 'px');
    grid.style.setProperty('--ws-board', (size * cell + (size - 1) * gap + padding) + 'px');
  }
  function extendPath(end) {
    if (!path.length || foundCells().has(end)) return;
    const start = path[0], row0 = Math.floor(start / size), col0 = start % size, row1 = Math.floor(end / size), col1 = end % size;
    if (row0 !== row1 && col0 !== col1) return;
    const length = Math.abs(row1 - row0) + Math.abs(col1 - col0) + 1;
    path = Array.from({ length: Math.min(length, Math.max(...answers.map((word) => word.label.length))) }, (_, step) => (row0 + Math.sign(row1 - row0) * step) * size + col0 + Math.sign(col1 - col0) * step);
    renderCells();
  }
  function foundCells() { const result = new Set(); for (const value of found.values()) value.indices.forEach((index) => result.add(index)); return result; }
  function renderCells() {
    const selected = new Set(path);
    dialog.querySelectorAll('[data-cell]').forEach((cell) => {
      const index = Number(cell.dataset.cell), win = [...found.values()].find((item) => item.indices.includes(index));
      cell.classList.toggle('is-selecting', selected.has(index)); cell.classList.toggle('is-found', !!win);
      if (win) { cell.style.setProperty('--found-bg', win.color[0]); cell.style.setProperty('--found-line', win.color[1]); } else { cell.style.removeProperty('--found-bg'); cell.style.removeProperty('--found-line'); }
    });
  }
  function finishPath() {
    if (path.length < 3) { if (path.length) say('Follow the word to its last letter.'); path = []; renderCells(); return; }
    const answer = answers.find((word) => !found.has(word.id) && (samePath(path, word.indices) || samePath(path, word.indices.slice().reverse())));
    if (!answer) { say('That’s a good try! Look at the word list and try again.'); audio('tap'); path = []; renderCells(); return; }
    const availableColors = colorSet.filter((candidate) => ![...found.values()].some((item) => item.color === candidate));
    const color = pick(availableColors.length ? availableColors : colorSet); found.set(answer.id, { indices: answer.indices, color }); starCount++; path = []; renderCells();
    dialog.querySelector('[data-word="' + answer.id + '"]')?.classList.add('is-found');
    dialog.querySelector('[data-word="' + answer.id + '"]')?.style.setProperty('--found-bg', color[0]);
    dialog.querySelector('[data-word="' + answer.id + '"]')?.style.setProperty('--found-line', color[1]);
    dialog.querySelector('[data-progress]').textContent = found.size + ' of ' + wordCount + ' found';
    say('You found ' + answer.label + '!'); praise(); animateStars(); showPicture(answer);
    if (found.size === wordCount) { completedAt = Date.now(); clearInterval(clockId); winTimer = setTimeout(finish, 2000); }
  }
  function samePath(first, second) { return first.length === second.length && first.every((cell, index) => cell === second[index]); }
  function animateStars() {
    const layer = dialog.querySelector('.ws-star-layer'); if (!layer) return;
    const stars = Array.from({ length: 7 }, (_, index) => '<span style="--star-x:' + (20 + Math.random() * 60) + '%;--star-delay:' + (Math.random() * .22).toFixed(2) + 's">' + (index % 3 === 0 ? '✿' : '★') + '</span>').join('');
    layer.innerHTML = stars; setTimeout(() => { if (layer.isConnected) layer.innerHTML = ''; }, 1300);
  }
  function showPicture(word) {
    const callout = dialog.querySelector('[data-live]'); if (!callout) return;
    callout.textContent = 'You found ' + word.label + '!';
    dialog.querySelector('.ws-found-pop')?.remove();
    const pop = document.createElement('div'); pop.className = 'ws-found-pop'; pop.setAttribute('aria-hidden', 'true'); pop.innerHTML = image(word) + '<strong>' + esc(word.label) + '!</strong>'; dialog.querySelector('.ws-window')?.append(pop);
    clearTimeout(showPicture.timer); showPicture.timer = setTimeout(() => { pop.remove(); if (callout.isConnected) callout.textContent = found.size + ' of ' + wordCount + ' found. Keep going!'; }, 1700);
  }
  function updateTimer() { const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000)); const node = dialog?.querySelector('[data-timer]'); if (node) node.textContent = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0'); }
  function finish() {
    if (!dialog?.open || found.size !== wordCount) return;
    clearInterval(clockId); const elapsed = Math.max(0, Math.floor(((completedAt || Date.now()) - startedAt) / 1000));
    const state = appState(); let earned = false;
    if (state?.minigames) {
      state.minigames.records ||= {}; state.minigames.rewards ||= {};
      const record = state.minigames.records.word_search || { wins: 0, best: 0, bestScore: 0, level: 1 };
      record.wins++; record.level++; record.bestScore = Math.max(record.bestScore || 0, wordCount * 100 + Math.max(0, 300 - elapsed));
      record.best = record.best ? Math.min(record.best, elapsed) : elapsed; state.minigames.records.word_search = record;
      const today = new Date().toISOString().slice(0, 10) + ':word_search'; state.minigames.rewards[today] ||= 0;
      if (state.minigames.rewards[today] < 3) { state.minigames.rewards[today]++; api.reward('apple', 1, starCount, 3); earned = true; } else api.save?.();
    }
    const formatted = String(Math.floor(elapsed / 60)).padStart(2, '0') + ':' + String(elapsed % 60).padStart(2, '0');
    screen('<header class="ws-header"><div><small>MEADOW MARKET LITTLES</small><h1>Wonderful word finding!</h1></div><button class="ws-close" data-close aria-label="Back to games">×</button></header><section class="ws-win"><div class="ws-win-stars" aria-label="' + starCount + ' stars">' + '★'.repeat(Math.min(starCount, 6)) + '</div><h2>Well done!</h2><p>You found all <strong>' + wordCount + '</strong> words in <strong>' + formatted + '</strong>.</p><p class="ws-earned">' + starCount + ' meadow stars ' + (earned ? 'earned!' : 'collected!') + '</p><div class="ws-win-actions"><button class="ws-again" data-again>Play again</button><button class="ws-thanks" data-thanks>No thank you</button></div></section><div class="ws-live" data-live role="status" aria-live="polite">A lovely word search!</div>', 'ws-result');
    bindClose(); dialog.querySelector('[data-again]').addEventListener('click', newRound); dialog.querySelector('[data-thanks]').addEventListener('click', close); animateStars();
    window.meadowAudio?.speak('ws-jade-done'); audio('reward');
  }
  function bindClose() { dialog.querySelector('[data-close]').addEventListener('click', close); }
  function close() { clearInterval(clockId); clearTimeout(winTimer); clockId = 0; winTimer = 0; if (resizeHandler) window.removeEventListener('resize', resizeHandler); resizeHandler = null; window.meadowAudio?.stopVoice(); dialog.close(); }
  function attach(options) { api = options; dialog = document.querySelector(dialogId); if (!dialog) return; dialog.addEventListener('cancel', () => { clearInterval(clockId); clearTimeout(winTimer); clockId = 0; winTimer = 0; if (resizeHandler) window.removeEventListener('resize', resizeHandler); resizeHandler = null; window.meadowAudio?.stopVoice(); }); }
  window.meadowWordSearch = { attach, open, topics, wordPrompt };
})();
