(() => {
  'use strict';

  const dialogId = '#word-search-dialog';
  const storeKey = 'meadow-markets-word-search-v1';
  let size = 9;
  const colorSet = [
    ['#ffe28a', '#956900'], ['#bce8a8', '#39733d'], ['#ffc5a6', '#a84b29'],
    ['#b9e4f7', '#347597'], ['#e0c7f3', '#75509a'], ['#ffc5d8', '#a44769']
  ];
  const topics = window.meadowWordTopics;
  let api, dialog, topic = topics[2], wordCount = 20, board = [], answers = [], found = new Map(), path = [], drag = null, skipCellClick = false, startedAt = 0, completedAt = 0, clockId = 0, winTimer = 0, starCount = 0, layoutHistory = [], positionHistory = {}, finished = false, resizeHandler = null;
  const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const audio = (id) => window.meadowAudio?.play(id);
  const say = (text) => { const live = dialog?.querySelector('[data-live]'); if (live) live.textContent = text; };
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const shuffle = (list) => { const result = list.slice(); for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; } return result; };
  const image = (word) => word.asset ? '<img src="' + esc(word.asset) + '" alt="">' : '<span class="ws-object-emoji" aria-hidden="true">' + word.icon + '</span>';
  const sceneUrl = () => topic.scene;
  const appState = () => api?.state?.();
  function speakText(text) {
    const preferences = (() => { try { return JSON.parse(localStorage.getItem('meadow-market-audio-v1') || '{}'); } catch { return {}; } })();
    const supported = window.speechSynthesis && window.SpeechSynthesisUtterance;
    if (supported && !preferences.muted && preferences.voice !== 0) {
      const voice = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices?.() || [];
      voice.voice = voices.find((item) => /^en-AU/i.test(item.lang)) || voices.find((item) => /^en-GB/i.test(item.lang)) || null;
      voice.lang = voice.voice?.lang || 'en-AU'; voice.rate = 0.88; voice.pitch = 1.12; voice.volume = Math.max(0, Math.min(1, Number(preferences.voice ?? 0.8)));
      window.speechSynthesis.cancel(); window.speechSynthesis.speak(voice);
    }
  }
  function praise() {
    const phrases = ['Well done!', 'Nice find!', 'You found it!', 'Another word in the basket!'];
    speakText(pick(phrases));
    audio('reward');
  }
  function boardSize() { return 16; }
  function loadHistory() { try { const saved = JSON.parse(localStorage.getItem(storeKey) || '{}'); positionHistory = saved.positions || {}; layoutHistory = Array.isArray(saved.layouts) ? saved.layouts.filter((item) => typeof item === 'string').slice(-250) : []; } catch { layoutHistory = []; } }
  function saveHistory(signature) { layoutHistory.push(signature); layoutHistory = layoutHistory.slice(-250); try { localStorage.setItem(storeKey, JSON.stringify({ layouts: layoutHistory, positions: positionHistory })); } catch {} }
  function buildBoard(words) { return window.meadowWordCore.make(words,size,Math.random,positionHistory); }
  function screen(content, extra = '') {
    if (resizeHandler) window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
    dialog.innerHTML = '<main class="ws-screen" style="--ws-scene:url(\'' + esc(sceneUrl()) + '\')"><div class="ws-window ' + extra + '">' + content + '</div><div class="ws-star-layer" aria-hidden="true"></div></main>';
    dialog.showModal();
  }
  function open() {
    if(api.canPlay && !api.canPlay())return api.notify("Return to your own farm to play.");
    topic = topics.find((item) => item.id === topic.id) || topics[2]; wordCount = 20; loadHistory(); intro();
  }
  function intro() {
    clearInterval(clockId); clearTimeout(winTimer); clockId = 0; winTimer = 0;
    const topicCards = topics.map((item) => '<button class="ws-topic ' + (topic.id === item.id ? 'selected' : '') + '" data-topic="' + item.id + '" aria-pressed="' + (topic.id === item.id) + '"><span aria-hidden="true">' + item.icon + '</span><strong>' + item.name + '</strong></button>').join('');
    const countButtons = [20].map((count) => '<button class="ws-count ' + (wordCount === count ? 'selected' : '') + '" data-count="' + count + '" aria-pressed="' + (wordCount === count) + '">' + count + ' words</button>').join('');
    screen('<header class="ws-header"><div><small>MEADOW MARKETS</small><h1>Meadow Word Search</h1></div><button class="ws-close" data-close aria-label="Back to games">×</button></header><section class="ws-intro"><div class="ws-intro-art" aria-hidden="true">' + topic.icon + '</div><h2>Twenty words. One meadow mystery.</h2><p>Put your finger on a letter. Follow the word, one letter at a time.</p><h3>Choose a farm theme</h3><div class="ws-topics">' + topicCards + '</div><h3>20 words in every puzzle</h3><div class="ws-counts">' + countButtons + '</div><button class="ws-start" data-start>Let’s play!</button></section><div class="ws-live" data-live role="status" aria-live="polite">Choose your favourite word world.</div>');
    bindClose();
    dialog.querySelectorAll('[data-topic]').forEach((button) => button.addEventListener('click', () => { topic = topics.find((item) => item.id === button.dataset.topic) || topics[2]; intro(); }));
    dialog.querySelectorAll('[data-count]').forEach((button) => button.addEventListener('click', () => { wordCount = Number(button.dataset.count); intro(); }));
    dialog.querySelector('[data-start]').addEventListener('click', newRound);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }
  function newRound() {
    clearInterval(clockId); clearTimeout(winTimer); winTimer = 0; found = new Map(); path = []; drag = null; starCount = 0;
    completedAt = 0; finished = false;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    size = boardSize();
    const choices = shuffle(topic.words.map(([label, icon, asset]) => ({ id: topic.id + '-' + label, label: label.toUpperCase(), icon, asset })));
    let result; try { result = buildBoard(choices.slice(0, wordCount)); } catch(error) { say(error.message); return; } board = result.cells; answers = result.answers; for(const answer of answers){const history=positionHistory[answer.id] ||= []; history.push(answer.indices.join('.'));positionHistory[answer.id]=history.slice(-64);} saveHistory(result.signature); startedAt = Date.now();
    playBoard(); clockId = setInterval(updateTimer, 1000); updateTimer();
  }
  function playBoard() {
    const words = answers.map((answer) => '<button class="ws-word" data-word="' + answer.id + '"><span>' + answer.label + '</span></button>').join('');
    const cells = board.map((letter, index) => '<button class="ws-cell" role="gridcell" aria-rowindex="' + (Math.floor(index / size) + 1) + '" aria-colindex="' + ((index % size) + 1) + '" data-cell="' + index + '" aria-label="Letter ' + letter + '">' + letter + '</button>').join('');
    screen('<header class="ws-header"><div><small>' + esc(topic.name.toUpperCase()) + ' · ' + wordCount + ' WORDS</small><h1>Find the words</h1></div><button class="ws-close" data-close aria-label="Back to games">×</button></header><div class="ws-status"><span class="ws-progress" data-progress>0 of ' + wordCount + ' found</span><span class="ws-timer" data-timer aria-label="Time">00:00</span></div><section class="ws-board-wrap"><div class="ws-grid" role="grid" aria-label="Word search letters">' + cells + '</div><div class="ws-word-list" aria-label="Words to find">' + words + '</div><div class="ws-live" data-live role="status" aria-live="polite">Put your finger on the first letter and follow the word.</div></section><footer class="ws-controls"><button class="ws-help" data-hear>🔊 Hear the directions</button><button class="ws-help" data-new>New puzzle</button></footer>');
    bindClose();
    dialog.querySelectorAll('[data-word]').forEach(button=>button.addEventListener('click',()=>speakText(answers.find(a=>a.id===button.dataset.word)?.label||'')));
    const grid = dialog.querySelector('.ws-grid');
    grid.addEventListener('pointerdown', (event) => { const cell = event.target.closest('[data-cell]'); if (!cell || event.button > 0) return; event.preventDefault(); drag = event.pointerId; skipCellClick = true; setTimeout(() => { skipCellClick = false; }, 500); grid.setPointerCapture?.(event.pointerId); path = [Number(cell.dataset.cell)]; renderCells(); });
    grid.addEventListener('pointermove', (event) => { if (drag !== event.pointerId) return; const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-cell]'); if (cell && grid.contains(cell)) extendPath(Number(cell.dataset.cell)); });
    grid.addEventListener('pointerup', (event) => { if (drag !== event.pointerId) return; drag = null; if (grid.hasPointerCapture?.(event.pointerId)) grid.releasePointerCapture(event.pointerId); finishPath(); });
    grid.addEventListener('pointercancel', () => { drag = null; path = []; renderCells(); });
    grid.addEventListener('click', (event) => { if (skipCellClick) { skipCellClick = false; return; } if (drag !== null) return; const cell = event.target.closest('[data-cell]'); if (!cell) return; const index = Number(cell.dataset.cell); if (!path.length) path = [index]; else if (path[0] === index) path = []; else extendPath(index); renderCells(); if (path.length > 2) finishPath(); });
    dialog.querySelector('[data-new]').addEventListener('click', newRound);
    dialog.querySelector('[data-hear]').addEventListener('click', () => speakText('Find twenty words in the list. Words can run horizontally, vertically or diagonally, forwards or backwards. Drag from the first letter to the last.'));
    resizeHandler = () => requestAnimationFrame(sizeBoard);
    window.addEventListener('resize', resizeHandler);
    requestAnimationFrame(sizeBoard);
    speakText('Find twenty farm words. Slide across letters in any straight direction, forwards or backwards. Select a word in the list to hear it.');
  }
  function sizeBoard() {
    const wrap = dialog?.querySelector('.ws-board-wrap'), grid = dialog?.querySelector('.ws-grid');
    if (!wrap || !grid) return;
    const landscape = window.matchMedia('(orientation: landscape) and (min-width: 620px)').matches;
    const width = landscape ? wrap.clientWidth * .60 : wrap.clientWidth;
    const height = landscape ? wrap.clientHeight : wrap.clientHeight - (dialog.querySelector('.ws-word-list')?.offsetHeight || 0) - (dialog.querySelector('[data-live]')?.offsetHeight || 0) - 20;
    const gap = Math.max(2, Math.min(5, Math.floor(width / (size * 22))));
    const padding = 20;
    const cell = Math.floor(Math.min((width - padding - gap * (size - 1)) / size, (height - padding - gap * (size - 1)) / size));
    if (!Number.isFinite(cell)) return;
    const fitCell = Math.max(10,cell);
    grid.style.setProperty('--ws-cols', size);
    grid.style.setProperty('--ws-cell', fitCell + 'px');
    grid.style.setProperty('--ws-gap', gap + 'px');
    grid.style.setProperty('--ws-board', (size * fitCell + (size - 1) * gap + padding) + 'px');
  }
  function extendPath(end) {
    if (!path.length || path.at(-1)===end) return;
    const start = path[0], row0 = Math.floor(start / size), col0 = start % size, row1 = Math.floor(end / size), col1 = end % size;
    if (row0 !== row1 && col0 !== col1 && Math.abs(row1-row0)!==Math.abs(col1-col0)) return;
    const length = Math.max(Math.abs(row1 - row0), Math.abs(col1 - col0)) + 1;
    path = Array.from({ length: Math.min(length, Math.max(...answers.map((word) => word.label.length))) }, (_, step) => (row0 + Math.sign(row1 - row0) * step) * size + col0 + Math.sign(col1 - col0) * step);
    renderCells();
  }
  function foundCells() { const result = new Set(); for (const value of found.values()) value.indices.forEach((index) => result.add(index)); return result; }
  function renderCells() {
    const selected = new Set(path), painted = new Map(); for(const item of found.values())for(const index of item.indices)painted.set(index,item);
    dialog.querySelectorAll('[data-cell]').forEach((cell) => {
      const index = Number(cell.dataset.cell), win = painted.get(index);
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
    if (!dialog?.open || finished || found.size !== wordCount) return;
    finished = true;
    clearInterval(clockId); const elapsed = Math.max(0, Math.floor(((completedAt || Date.now()) - startedAt) / 1000));
    const state = appState(); let earned = false; if(state)state.minigames ||= {records:{},rewards:{}};
    if (state?.minigames) {
      state.minigames.records ||= {}; state.minigames.rewards ||= {};
      const record = state.minigames.records.word_search || { wins: 0, best: 0, bestScore: 0, level: 1 };
      record.wins++; record.level++; record.bestScore = Math.max(record.bestScore || 0, wordCount * 100 + Math.max(0, 300 - elapsed));
      record.best = record.best ? Math.min(record.best, elapsed) : elapsed; state.minigames.records.word_search = record;
      const today = new Date().toISOString().slice(0, 10) + ':word_search'; state.minigames.rewards[today] ||= 0;
      if (state.minigames.rewards[today] < 3) { state.minigames.rewards[today]++; api.reward('apple', 1, starCount, 3); earned = true; } else api.save?.();
    }
    const formatted = String(Math.floor(elapsed / 60)).padStart(2, '0') + ':' + String(elapsed % 60).padStart(2, '0');
    screen('<header class="ws-header"><div><small>MEADOW MARKETS</small><h1>Wonderful word finding!</h1></div><button class="ws-close" data-close aria-label="Back to games">×</button></header><section class="ws-win"><div class="ws-win-stars" aria-label="' + starCount + ' stars">' + '★'.repeat(Math.min(starCount, 6)) + '</div><h2>Well done!</h2><p>You found all <strong>' + wordCount + '</strong> words in <strong>' + formatted + '</strong>.</p><p class="ws-earned">' + starCount + ' words · Score ' + (wordCount*100+Math.max(0,300-elapsed)) + (earned ? ' · Reward collected!' : ' · Practice round') + '</p><div class="ws-win-actions"><button class="ws-again" data-again>Play again</button><button class="ws-thanks" data-thanks>No thank you</button></div></section><div class="ws-live" data-live role="status" aria-live="polite">A lovely word search!</div>', 'ws-result');
    bindClose(); dialog.querySelector('[data-again]').addEventListener('click', newRound); dialog.querySelector('[data-thanks]').addEventListener('click', () => { close(); api.menu?.(); }); animateStars();
    if (window.speechSynthesis) window.speechSynthesis.cancel(); speakText('Well done! You found all ' + wordCount + ' words! Great job!'); audio('reward');
  }
  function bindClose() { dialog.querySelector('[data-close]').addEventListener('click', close); }
  function close() { clearInterval(clockId); clearTimeout(winTimer); clockId = 0; winTimer = 0; if (resizeHandler) window.removeEventListener('resize', resizeHandler); resizeHandler = null; if (window.speechSynthesis) window.speechSynthesis.cancel(); dialog.close(); }
  function attach(options) { api = options; dialog = document.querySelector(dialogId); if (!dialog) { dialog=document.createElement("dialog");dialog.id="word-search-dialog";dialog.className="word-search-dialog";dialog.setAttribute("aria-label","Meadow Word Search");document.body.append(dialog); } dialog.addEventListener('cancel', () => { clearInterval(clockId); clearTimeout(winTimer); clockId = 0; winTimer = 0; if (resizeHandler) window.removeEventListener('resize', resizeHandler); resizeHandler = null; if (window.speechSynthesis) window.speechSynthesis.cancel(); }); }
  window.meadowWordSearch = { attach, open, topics };
})();
