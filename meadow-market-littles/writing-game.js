(() => {
  'use strict';
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const rainbow = ['#ef5350', '#ff9f43', '#f5cf45', '#50af68', '#42a6d8', '#7165c8', '#d65da8'];
  let dialog, mode = 'alphabet', queue = [], index = 0, name = '', strokes = [], drawing = false, canvas, ctx, mask, maskCtx, maskPixels, target, points = [], pathLength = 0, totalPath = 0, expectedCoverage = 1, coverage = new Set(), targetFontSize = 0, resizeObserver, token = 0, balloonBusy = false, balloonSequence = [];
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = selector => dialog?.querySelector(selector);
  function ensureDialog() {
    if (dialog) return;
    dialog = document.createElement('dialog'); dialog.className = 'writing-dialog'; dialog.setAttribute('aria-label', 'Meadow Market Littles letter writing');
    document.body.append(dialog); dialog.addEventListener('cancel', event => { event.preventDefault(); close(); }); dialog.addEventListener('close', cleanup);
  }
  function cleanup() { token++; drawing = false; resizeObserver?.disconnect(); resizeObserver = null; window.meadowAudio?.stopVoice(); }
  function close() { cleanup(); dialog?.close(); }
  function speak(text) { try { const synth = window.speechSynthesis; if (!synth || !window.SpeechSynthesisUtterance) return; let prefs = {}; try { prefs = JSON.parse(localStorage.getItem('meadow-littles-audio-v1') || '{}'); } catch {} if (prefs.muted || Number(prefs.voice ?? .8) <= 0) return; synth.cancel(); const utterance = new SpeechSynthesisUtterance(text), voices = synth.getVoices?.() || []; utterance.voice = voices.find(v => /^en-AU/i.test(v.lang)) || voices.find(v => /^en-GB/i.test(v.lang)) || null; utterance.lang = utterance.voice?.lang || 'en-AU'; utterance.rate = 0.78; utterance.pitch = 1.08; utterance.volume = Math.max(0, Math.min(1, Number(prefs.voice ?? .8))); synth.speak(utterance); } catch {} }
  function shell(title, body) {
    cleanup();
    dialog.innerHTML = `<main class="writing-desk"><header class="writing-head"><div><small>MEADOW MARKET LITTLES · FARMER JADE’S WRITING DESK</small><h1>${title}</h1></div><button class="writing-close" type="button" aria-label="Back to games">×</button></header><section class="writing-page">${body}</section></main>`;
    $('.writing-close').onclick = close; if (!dialog.open) dialog.showModal();
  }
  function start(modeName) {
    mode = modeName; index = 0; strokes = [];
    if (mode === 'alphabet') { name = ''; queue = [...alphabet].flatMap(letter => [letter, letter.toLowerCase()]); showTrace(); return; }
    if (mode === 'balloons') { balloonStart(); return; }
    namePrompt();
  }
  function balloonStart() { balloonSequence = [...alphabet].sort(() => Math.random() - .5).slice(0, 8); index = 0; balloonBusy = false; showBalloons(); }
  function showBalloons() {
    if (index >= balloonSequence.length) { balloonDone(); return; }
    const wanted = balloonSequence[index], distractors = [...alphabet].filter(letter => letter !== wanted).sort(() => Math.random() - .5).slice(0, 5), choices = [...distractors, wanted].sort(() => Math.random() - .5);
    shell('Letter balloon pop!', `<div class="balloon-instruction"><img src="assets/generated/guides/jade.webp" alt="Farmer Jade"><div><div class="balloon-speech">Find the letter <strong>${wanted}!</strong></div><button class="writing-button balloon-hear" type="button" data-hear>🔊 Hear again</button></div></div><div class="writing-progress">Balloon ${index + 1} of ${balloonSequence.length}</div><div class="balloon-field" aria-label="Choose the letter ${wanted}">${choices.map((letter, i) => `<button class="letter-balloon balloon-color-${i % 6}" type="button" data-balloon="${letter}" aria-label="Balloon with letter ${letter}" style="--balloon-delay:${(i % 4) * -.65}s"><span>${letter}</span><i aria-hidden="true"></i></button>`).join('')}</div><p class="writing-message" role="status" aria-live="polite">Tap the balloon with ${wanted}.</p>`);
    $('[data-hear]').onclick = () => sayBalloon(wanted);
    dialog.querySelectorAll('[data-balloon]').forEach(button => button.onclick = () => popBalloon(button, wanted));
    sayBalloon(wanted);
  }
  function sayBalloon(letter) { speak(`Find the letter ${letter}.`); }
  function popBalloon(button, wanted) {
    if (balloonBusy) return;
    const picked = button.dataset.balloon;
    if (picked !== wanted) { button.classList.remove('balloon-wrong'); void button.offsetWidth; button.classList.add('balloon-wrong'); const note = $('.writing-message'); if (note) note.textContent = `That is ${picked}. Let’s find ${wanted}.`; speak(`That is ${picked}. Find ${wanted}.`); return; }
    balloonBusy = true; button.classList.add('balloon-pop'); button.disabled = true; window.meadowAudio?.play('reward'); const note = $('.writing-message'); if (note) note.textContent = `Pop! You found ${wanted}!`;
    speak(`Pop! You found ${wanted}!`); const round = index, currentToken = token; setTimeout(() => { if (!dialog.open || token !== currentToken || round !== index) return; index++; balloonBusy = false; showBalloons(); }, 2000);
  }
  function balloonDone() { window.meadowAudio?.play('game-result-win'); shell('Balloon letter star!', '<div class="writing-congrats"><div class="writing-stars" aria-hidden="true">✦ ✦ ✦</div><h2>You found every letter balloon!</h2><p>Lovely listening and letter finding!</p><button class="writing-button writing-primary" type="button" data-again>Play again</button><button class="writing-button" type="button" data-close>Back to games</button></div>'); $('[data-again]').onclick = () => start('balloons'); $('[data-close]').onclick = close; speak('You found every letter balloon. Great job!'); }
  function namePrompt() {
    shell('Write my name', '<div class="writing-intro"><div class="writing-preview-name" aria-hidden="true"><span>A</span><span>m</span><span>y</span></div><h2>A grown-up, type the child’s name</h2><p>The name is used just for this game and is not saved or sent anywhere.</p><form class="writing-name-form"><label for="writing-name">Child’s first name</label><input id="writing-name" name="name" autocomplete="off" maxlength="16" required aria-describedby="writing-name-help"><small id="writing-name-help">Up to 12 letters. Spaces and hyphens are okay.</small><button class="writing-button writing-primary" type="submit">Let’s write!</button></form></div>');
    $('.writing-name-form').onsubmit = event => { event.preventDefault(); const typed = $('#writing-name').value.normalize('NFC').trim().replace(/[^\p{L}\p{M} '-]/gu, '').replace(/\s+/g, ' ').slice(0, 16); const letters = [...typed].filter(char => /[\p{L}\p{M}]/u.test(char)); if (!letters.length || letters.length > 12) { $('#writing-name-help').textContent = 'Please enter a name with 1 to 12 letters.'; return; } name = typed; queue = letters.map((letter, position) => position === 0 ? letter.toLocaleUpperCase() : letter.toLocaleLowerCase()); index = 0; strokes = []; showTrace(); };
  }
  function showTrace() {
    if (index >= queue.length) { mode === 'alphabet' ? alphabetDone() : nameDone(); return; }
    totalPath = 0; coverage = new Set();
    const current = queue[index], pair = mode === 'alphabet' ? current === current.toUpperCase() ? current + '  ' + current.toLowerCase() : current.toUpperCase() + '  ' + current : [...name].join('');
    const caption = mode === 'alphabet' ? `Letter ${Math.floor(index / 2) + 1} of 26 · ${index % 2 ? 'little letter' : 'capital letter'}` : `Letter ${index + 1} of ${queue.length} · ${esc(name)}`;
    shell(mode === 'alphabet' ? 'Rainbow letter tracing' : 'Write my name', `<div class="writing-progress">${caption}</div><div class="writing-letter-pair" aria-label="${esc(pair)}">${mode === 'alphabet' ? `<span class="pair-current">${esc(current)}</span><span class="pair-other">${esc(current === current.toUpperCase() ? current.toLowerCase() : current.toUpperCase())}</span>` : `<span class="pair-name">${esc(name)}</span>`}</div><p class="writing-instruction">Follow the dotted letter with your finger. Watch the rainbow colours!</p><div class="writing-canvas-wrap"><canvas class="writing-canvas" aria-label="Trace the letter ${esc(current)}"></canvas></div><p class="writing-message" role="status" aria-live="polite">Start anywhere on the letter. Take your time!</p><div class="writing-actions"><button class="writing-button" type="button" data-clear>Try again</button><button class="writing-button" type="button" data-hear-letter>Hear the letter</button></div>`);
    canvas = $('.writing-canvas'); ctx = canvas.getContext('2d', { alpha: true, desynchronized: true }); mask = document.createElement('canvas'); maskCtx = mask.getContext('2d', { willReadFrequently: true }); target = current;
    canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onMove); canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onUp); canvas.addEventListener('lostpointercapture', () => { if (drawing) onUp(); });
    $('[data-clear]').onclick = () => { strokes[index] = []; points = []; pathLength = totalPath = 0; coverage.clear(); renderCanvas(); message('Here is a fresh letter. Follow the dotted line.'); };
    $('[data-hear-letter]').onclick = () => speakLetter(current);
    const resize = () => { if (!dialog.open || !canvas.isConnected) return; sizeCanvas(); renderCanvas(); };
    resizeObserver = new ResizeObserver(resize); resizeObserver.observe($('.writing-canvas-wrap')); requestAnimationFrame(resize); speakLetter(current);
  }
  function speakLetter(letter) { speak(`This is ${letter}. Trace the letter with your finger.`); }
  function sizeCanvas() {
    const box = canvas.getBoundingClientRect(); if (!box.width || !box.height) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1), width = Math.round(box.width * dpr), height = Math.round(box.height * dpr);
    if (canvas.width === width && canvas.height === height) return;
    canvas.width = width; canvas.height = height; mask.width = width; mask.height = height; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); maskCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const fontSize = targetFontSize = traceFontSize(box);
    maskCtx.clearRect(0, 0, box.width, box.height); maskCtx.font = `900 ${fontSize}px "Comic Sans MS", "Trebuchet MS", system-ui, sans-serif`; maskCtx.textAlign = 'center'; maskCtx.textBaseline = 'middle'; maskCtx.fillStyle = '#fff';
    const handPath = tracingPath(target, box.width / 2, box.height / 2, fontSize);
    if (handPath) { maskCtx.strokeStyle = '#fff'; maskCtx.lineWidth = fontSize * .14; maskCtx.lineCap = 'round'; maskCtx.lineJoin = 'round'; maskCtx.stroke(handPath); } else maskCtx.fillText(target, box.width / 2, box.height / 2, box.width * 0.84);
    maskPixels = maskCtx.getImageData(0, 0, mask.width, mask.height).data; expectedCoverage = countMaskCells(box.width, box.height);
    drawGuide();
  }
  function drawGuide() {
    if (!ctx || !canvas?.width) return;
    const box = canvas.getBoundingClientRect(), w = box.width, h = box.height;
    ctx.clearRect(0, 0, w, h); ctx.save(); ctx.font = maskCtx.font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const fontSize = traceFontSize({ width: w, height: h }), handPath = tracingPath(target, w / 2, h / 2, fontSize);
    if (handPath) { ctx.setLineDash([Math.max(3, Math.min(w, h) * .009), Math.max(6, Math.min(w, h) * .017)]); ctx.lineWidth = Math.max(4, fontSize * .14); ctx.strokeStyle = '#bc965d'; ctx.stroke(handPath); ctx.setLineDash([]); }
    else { ctx.fillStyle = 'rgba(255,252,242,.65)'; ctx.fillText(target, w / 2, h / 2, w * 0.84); ctx.setLineDash([Math.max(3, Math.min(w, h) * .009), Math.max(6, Math.min(w, h) * .017)]); ctx.lineWidth = Math.max(3, Math.min(w, h) * .012); ctx.strokeStyle = '#bc965d'; ctx.strokeText(target, w / 2, h / 2, w * .84); ctx.setLineDash([]); }
    ctx.restore(); (strokes[index] || []).forEach(paintStroke);
  }
  function traceFontSize(box) { return Math.min(box.width * (mode === 'name' ? 0.66 : 0.82), box.height * 0.96, 760); }
  function tracingPath(letter, x, y, size) {
    if (letter !== 'a') return null;
    const p = new Path2D(); p.moveTo(x + size * .19, y - size * .38); p.lineTo(x + size * .19, y + size * .38); p.bezierCurveTo(x - size * .02, y + size * .43, x - size * .34, y + size * .34, x - size * .34, y + size * .04); p.bezierCurveTo(x - size * .34, y - size * .28, x + size * .06, y - size * .4, x + size * .19, y - size * .18); return p;
  }
  function countMaskCells(width, height) {
    let count = 0; const dpr = mask.width / width;
    for (let row = 0; row < 16; row++) for (let col = 0; col < 24; col++) {
      let filled = false;
      for (const oy of [.2, .5, .8]) for (const ox of [.2, .5, .8]) {
        const x = Math.min(mask.width - 1, Math.floor((col + ox) * width / 24 * dpr)), y = Math.min(mask.height - 1, Math.floor((row + oy) * height / 16 * dpr));
        if (maskPixels[(y * mask.width + x) * 4 + 3] > 20) { filled = true; break; }
      }
      if (filled) count++;
    }
    return Math.max(1, count);
  }
  function renderCanvas() { drawGuide(); }
  function paintStroke(stroke) {
    if (!stroke?.length) return; const box = canvas.getBoundingClientRect(); ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(8, Math.min(box.width, box.height) * .052);
    if (stroke.length === 1) { ctx.fillStyle = rainbow[0]; ctx.beginPath(); ctx.arc(stroke[0].x * box.width, stroke[0].y * box.height, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); ctx.restore(); return; }
    for (let i = 1; i < stroke.length; i++) { const a = stroke[i - 1], b = stroke[i], grad = ctx.createLinearGradient(a.x * box.width, a.y * box.height, b.x * box.width, b.y * box.height); const phase = (i / stroke.length) * rainbow.length; grad.addColorStop(0, rainbow[Math.floor(phase) % rainbow.length]); grad.addColorStop(1, rainbow[Math.ceil(phase) % rainbow.length]); ctx.strokeStyle = grad; ctx.beginPath(); ctx.moveTo(a.x * box.width, a.y * box.height); ctx.lineTo(b.x * box.width, b.y * box.height); ctx.stroke(); }
    ctx.restore();
  }
  function pointFromEvent(event) { const box = canvas.getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)), y: Math.max(0, Math.min(1, (event.clientY - box.top) / box.height)) }; }
  function onDown(event) { if (!dialog.open || drawing) return; const p = pointFromEvent(event); if (!onGlyph(p)) { message('Touch the dotted letter to start.'); return; } drawing = true; canvas.setPointerCapture(event.pointerId); points = [p]; pathLength = 0; paintStroke(points); message('Lovely tracing! Keep following the letter.'); }
  function onMove(event) { if (!drawing) return; const p = pointFromEvent(event), prev = points.at(-1); if (!prev) return; const box = canvas.getBoundingClientRect(); pathLength += Math.hypot((p.x - prev.x) * box.width, (p.y - prev.y) * box.height); points.push(p); if (points.length % 3 === 0) { ctx.clearRect(0, 0, box.width, box.height); drawGuide(); paintStroke(points); } else paintStroke(points.slice(-2)); }
  function onUp(event) {
    if (!drawing) return; drawing = false; if (event && canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    const hits = points.filter(onGlyph).length, ratio = points.length ? hits / points.length : 0, box = canvas.getBoundingClientRect();
    if (pathLength >= Math.max(14, Math.min(box.width, box.height) * .07) && ratio >= .48) {
      if (!Array.isArray(strokes[index])) strokes[index] = []; strokes[index].push(points.map(p => ({ ...p }))); totalPath += pathLength; points.forEach(p => { if (onGlyph(p)) coverage.add(`${Math.floor(p.x * 24)}:${Math.floor(p.y * 16)}`); }); drawGuide();
      if (totalPath >= targetFontSize * .62 && coverage.size >= Math.max(4, Math.ceil(expectedCoverage * .5))) { window.meadowAudio?.play('reward'); finishLetter(false); }
      else { message('Nice tracing! Follow another part of the letter.'); speak('Nice tracing! Follow another part of the letter.'); }
    } else { drawGuide(); message('Good try! Follow more of the dotted letter.'); speak('Good try! Follow the dotted letter.'); }
    points = []; pathLength = 0;
  }
  function onGlyph(point) {
    const box = canvas.getBoundingClientRect(), x = Math.floor(point.x * box.width * (mask.width / box.width)), y = Math.floor(point.y * box.height * (mask.height / box.height));
    if (x < 0 || y < 0 || x >= mask.width || y >= mask.height) return false;
    return !!maskPixels && maskPixels[(y * mask.width + x) * 4 + 3] > 20;
  }
  function message(text) { const el = $('.writing-message'); if (el) el.textContent = text; }
  function finishLetter(shown) {
    if (!Array.isArray(strokes[index])) strokes[index] = [];
    
    shell(mode === 'alphabet' ? 'Lovely writing!' : 'Lovely writing!', `<div class="writing-congrats"><div class="writing-stars" aria-hidden="true">✦ ✧ ✦</div><h2>Good job!</h2><p>Let’s do the next letter!</p><div class="writing-celebrate-letter">${esc(target)}</div><button class="writing-button writing-primary" type="button" data-next>Next letter</button></div>`);
    const doneToken = token;
    $('[data-next]').onclick = () => { if (doneToken !== token) return; index++; showTrace(); };
    speak('Good job! Let’s do the next letter!');
  }
  function alphabetDone() {
    window.meadowAudio?.play('game-result-win'); shell('Alphabet helper!', '<div class="writing-congrats"><div class="writing-stars" aria-hidden="true">✦ ✦ ✦</div><h2>You traced all the letters!</h2><p>Big letters and little letters, A to Z. What a lovely job!</p><button class="writing-button writing-primary" type="button" data-again>Trace again</button><button class="writing-button" type="button" data-close>Back to games</button></div>'); $('[data-again]').onclick = () => start('alphabet'); $('[data-close]').onclick = close; speak('You traced all the letters. What a lovely job!');
  }
  function nameDone() {
    window.meadowAudio?.play('game-result-win'); let letterIndex = 0; const letters = [...name].map(char => /[\p{L}\p{M}]/u.test(char) ? `<canvas class="writing-result-letter" data-result="${letterIndex++}" aria-label="Your letter ${esc(char)}"></canvas>` : `<span class="writing-name-separator">${esc(char)}</span>`).join('');
    shell('My name!', `<div class="writing-name-result"><div class="writing-stars" aria-hidden="true">✦ ✦ ✦</div><h2>You wrote your name!</h2><div class="writing-result-name" aria-label="${esc(name)}">${letters}</div><p>Every rainbow letter was made by you!</p><button class="writing-button writing-primary" type="button" data-again>Write my name again</button><button class="writing-button" type="button" data-close>Back to games</button></div>`);
    dialog.querySelectorAll('[data-result]').forEach((mini, i) => renderThumbnail(mini, strokes[i] || [], queue[i])); $('[data-again]').onclick = () => start('name'); $('[data-close]').onclick = close; speak(`You wrote ${name}! Great job!`);
  }
  function renderThumbnail(mini, stroke, letter) {
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = 112, h = 144; mini.width = w * dpr; mini.height = h * dpr; const c = mini.getContext('2d'); c.scale(dpr, dpr); c.font = '900 118px "Comic Sans MS", "Trebuchet MS", system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = 'rgba(255,252,242,.75)'; c.fillText(letter, 56, 72, 102); c.lineWidth = 3; c.lineCap = 'round'; c.strokeStyle = '#bc965d'; c.setLineDash([2, 4]); const handPath = tracingPath(letter, 56, 72, 92); if (handPath) c.stroke(handPath); else c.strokeText(letter, 56, 72, 102); c.setLineDash([]);
    if (!Array.isArray(stroke)) return; for (const segment of stroke) { if (!segment?.length) continue; c.lineWidth = 8; c.lineCap = 'round'; c.lineJoin = 'round'; for (let i = 1; i < segment.length; i++) { const a = segment[i - 1], b = segment[i]; c.strokeStyle = rainbow[i % rainbow.length]; c.beginPath(); c.moveTo(a.x * w, a.y * h); c.lineTo(b.x * w, b.y * h); c.stroke(); } }
  }
  function open(which) { ensureDialog(); mode = which === 'name' ? 'name' : which === 'balloons' ? 'balloons' : 'alphabet'; start(mode); }
  window.meadowWritingGame = { open };
})();
