(() => {
  'use strict';
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const rainbow = ['#ef5350', '#ff9f43', '#f5cf45', '#50af68', '#42a6d8', '#7165c8', '#d65da8'];
  const farmers = ['jade', 'rhys', 'jay'];
  let guide = 'jade', lastHint = 0, maskSamples = [];
  const brushWidth = box => Math.max(16, Math.min(box.width, box.height) * .12);
  const farmerFor = letter => farmers[Math.max(0, alphabet.indexOf(String(letter).toUpperCase())) % 3];
  const guideName = () => guide[0].toUpperCase() + guide.slice(1);
  const cue = kind => 'letter-' + guide + '-' + kind;
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
  function speak(id) { return window.meadowAudio?.speak(id) || Promise.resolve(0); }
  function shell(title, body) {
    cleanup();
    dialog.classList.toggle('balloon-dialog', mode === 'balloons');
    dialog.innerHTML = `<main class="writing-desk"><header class="writing-head"><img class="writing-guide" src="assets/generated/guides/${guide}.webp" alt="Farmer ${guideName()}"><div><small>MEADOW MARKET LITTLES · FARMER ${guideName().toUpperCase()}’S LETTER DESK</small><h1>${title}</h1></div><button class="writing-close" type="button" aria-label="Back to games">×</button></header><section class="writing-page">${body}</section></main>`;
    $('.writing-close').onclick = close; if (!dialog.open) dialog.showModal();
    if (mode === 'balloons') $('.writing-head small').textContent = 'MEADOW MARKET LITTLES';
  }
  function start(modeName) {
    mode = modeName; index = 0; strokes = []; guide = 'jade'; lastHint = 0;
    if (mode === 'alphabet') { name = ''; queue = [...alphabet].flatMap(letter => [letter, letter.toLowerCase()]); showTrace(); return; }
    if (mode === 'balloons') { balloonStart(); return; }
    namePrompt();
  }
  function shuffled(items) { const result = [...items]; for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; } return result; }
  function balloonStart() { balloonSequence = shuffled(alphabet).slice(0, 6); index = 0; balloonBusy = false; showBalloons(); }
  function showBalloons() {
    if (index >= balloonSequence.length) { balloonDone(); return; }
    const wanted = balloonSequence[index], choices = shuffled(balloonSequence);
    guide = farmerFor(wanted);
    shell('Letter balloon pop!', `<div class="balloon-instruction"><img src="assets/generated/guides/${guide}.webp" alt="Farmer ${guideName()}"><div><div class="balloon-speech">Find the letter <strong>${wanted}!</strong></div><button class="writing-button balloon-hear" type="button" data-hear>🔊 Hear again</button></div></div><div class="writing-progress" aria-label="Balloons found"><span class="balloon-count">0 / ${balloonSequence.length}</span><span class="balloon-stars" aria-hidden="true">${balloonSequence.map(() => '<span>☆</span>').join('')}</span></div><div class="balloon-field" aria-label="Choose the letter ${wanted}">${choices.map((letter, i) => `<button class="letter-balloon balloon-color-${i % 6}" type="button" data-balloon="${letter}" aria-label="Balloon with letter ${letter}" style="--balloon-delay:${(i % 4) * -.65}s"><span>${letter}</span><i aria-hidden="true"></i></button>`).join('')}</div><p class="writing-message" role="status" aria-live="polite">Tap the balloon with ${wanted}.</p>`);
    $('[data-hear]').onclick = () => { if (!balloonBusy) sayBalloon(balloonSequence[index]); };
    dialog.querySelectorAll('[data-balloon]').forEach(button => button.onclick = () => popBalloon(button, balloonSequence[index]));
    sayBalloon(wanted);
  }
  function sayBalloon(letter) { speak('letter-find-' + letter.toLowerCase()); }
  function popBalloon(button, wanted) {
    if (balloonBusy) return;
    const picked = button.dataset.balloon;
    if (picked !== wanted) { button.classList.remove('balloon-wrong'); void button.offsetWidth; button.classList.add('balloon-wrong'); const note = $('.writing-message'); if (note) note.textContent = `That is ${picked}. Let’s find ${wanted}.`; speak([cue('wrong'), 'letter-find-' + wanted.toLowerCase()]); return; }
    balloonBusy = true; $('.balloon-count').textContent = (index + 1) + ' / ' + balloonSequence.length; const star = dialog.querySelectorAll('.balloon-stars span')[index]; if (star) { star.textContent = '★'; star.classList.add('earned'); } button.classList.add('balloon-pop'); button.disabled = true; window.meadowAudio?.play('reward'); const note = $('.writing-message'); if (note) note.textContent = `Pop! You found ${wanted}!`;
    const round = index, currentToken = token; Promise.resolve(speak(cue('success'))).then(duration => { if (!dialog.open || token !== currentToken || round !== index) return; setTimeout(() => { if (!dialog.open || token !== currentToken || round !== index) return; index++; balloonBusy = false; advanceBalloon(); }, Math.max(1600, (duration || 0) * 1000 + 400)); });
  }
  function advanceBalloon() {
    if (index >= balloonSequence.length) { balloonDone(); return; }
    const wanted = balloonSequence[index]; guide = farmerFor(wanted);
    dialog.querySelectorAll('.writing-guide,.balloon-instruction>img').forEach(img => { img.src = 'assets/generated/guides/' + guide + '.webp'; img.alt = 'Farmer ' + guideName(); });
    $('.balloon-speech').innerHTML = 'Find the letter <strong>' + wanted + '!</strong>';
    $('.balloon-field').setAttribute('aria-label', 'Choose the letter ' + wanted);
    $('.writing-message').textContent = 'Tap the balloon with ' + wanted + '.';
    sayBalloon(wanted);
  }
  function balloonDone() { window.meadowAudio?.play('reward'); shell('Balloon letter star!', '<div class="writing-congrats"><div class="writing-stars" aria-hidden="true">✦ ✦ ✦</div><h2>You found every letter balloon!</h2><p>Lovely listening and letter finding!</p><button class="writing-button writing-primary" type="button" data-again>Play again</button><button class="writing-button" type="button" data-close>Back to games</button></div>'); $('[data-again]').onclick = () => start('balloons'); $('[data-close]').onclick = close; speak(cue('balloonsdone')); }
  function namePrompt() {
    shell('Write my name', '<div class="writing-intro"><div class="writing-preview-name" aria-hidden="true"><span>A</span><span>m</span><span>y</span></div><h2>A grown-up, type the child’s name</h2><p>The name is used just for this game and is not saved or sent anywhere.</p><form class="writing-name-form"><label for="writing-name">Child’s first name</label><input id="writing-name" name="name" autocomplete="off" maxlength="16" required aria-describedby="writing-name-help"><small id="writing-name-help">Up to 12 letters. Spaces and hyphens are okay.</small><button class="writing-button writing-primary" type="submit">Let’s write!</button></form></div>');
    $('.writing-name-form').onsubmit = event => { event.preventDefault(); const typed = $('#writing-name').value.normalize('NFC').trim().replace(/[^\p{L}\p{M} '-]/gu, '').replace(/\s+/g, ' ').slice(0, 16); const letters = [...typed].filter(char => /[\p{L}\p{M}]/u.test(char)); if (!letters.length || letters.length > 12) { $('#writing-name-help').textContent = 'Please enter a name with 1 to 12 letters.'; return; } name = typed; queue = letters.map((letter, position) => position === 0 ? letter.toLocaleUpperCase() : letter.toLocaleLowerCase()); index = 0; strokes = []; showTrace(); };
  }
  function showTrace() {
    if (index >= queue.length) { mode === 'alphabet' ? alphabetDone() : nameDone(); return; }
    totalPath = 0; coverage = new Set();
    const current = queue[index], pair = mode === 'alphabet' ? current === current.toUpperCase() ? current + '  ' + current.toLowerCase() : current.toUpperCase() + '  ' + current : [...name].join('');
    const caption = mode === 'alphabet' ? `Letter ${Math.floor(index / 2) + 1} of 26 · ${index % 2 ? 'little letter' : 'capital letter'}` : `Letter ${index + 1} of ${queue.length} · ${esc(name)}`;
    guide = farmerFor(current);
    shell(mode === 'alphabet' ? 'Rainbow letter tracing' : 'Write my name', `<div class="writing-progress">${caption}</div><div class="writing-letter-pair" aria-label="${esc(pair)}">${mode === 'alphabet' ? `<span class="pair-current">${esc(current)}</span><span class="pair-other">${esc(current === current.toUpperCase() ? current.toLowerCase() : current.toUpperCase())}</span>` : `<span class="pair-name">${esc(name)}</span>`}</div><p class="writing-instruction">Follow the dotted letter with your finger. Watch the rainbow colours!</p><div class="writing-canvas-wrap"><canvas class="writing-canvas" aria-label="Trace the letter ${esc(current)}"></canvas></div><p class="writing-message" role="status" aria-live="polite">Start anywhere on the letter. Take your time!</p><div class="writing-actions"><button class="writing-button" type="button" data-clear>Try again</button><button class="writing-button" type="button" data-hear-letter>Hear the letter</button></div>`);
    canvas = $('.writing-canvas'); ctx = canvas.getContext('2d', { alpha: true, desynchronized: true }); mask = document.createElement('canvas'); maskCtx = mask.getContext('2d', { willReadFrequently: true }); target = current;
    canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onMove); canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onUp); canvas.addEventListener('lostpointercapture', () => { if (drawing) onUp(); });
    $('[data-clear]').onclick = () => { strokes[index] = []; points = []; pathLength = totalPath = 0; coverage.clear(); renderCanvas(); message('Here is a fresh letter. Follow the dotted line.'); };
    $('[data-hear-letter]').onclick = () => speakLetter(current);
    const resize = () => { if (!dialog.open || !canvas.isConnected) return; sizeCanvas(); renderCanvas(); };
    resizeObserver = new ResizeObserver(resize); resizeObserver.observe($('.writing-canvas-wrap')); requestAnimationFrame(resize); speakLetter(current);
  }
  function speakLetter(letter) { const key = String(letter).toLowerCase(); return speak(/^[a-z]$/.test(key) ? 'letter-trace-' + key : cue('unknown')); }
  function hint(kind) { if (performance.now() - lastHint < 5000) return; lastHint = performance.now(); speak(cue(kind)); }
  function sizeCanvas() {
    const box = canvas.getBoundingClientRect(); if (!box.width || !box.height) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1), width = Math.round(box.width * dpr), height = Math.round(box.height * dpr);
    if (canvas.width === width && canvas.height === height) return;
    canvas.width = width; canvas.height = height; mask.width = width; mask.height = height; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); maskCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const fontSize = targetFontSize = traceFontSize(box);
    maskCtx.clearRect(0, 0, box.width, box.height); maskCtx.font = `900 ${fontSize}px "Comic Sans MS", "Trebuchet MS", system-ui, sans-serif`; maskCtx.textAlign = 'center'; maskCtx.textBaseline = 'middle'; maskCtx.fillStyle = '#fff';
    const handPath = tracingPath(target, box.width / 2, box.height / 2, fontSize);
    if (handPath) { maskCtx.strokeStyle = '#fff'; maskCtx.lineWidth = fontSize * .14; maskCtx.lineCap = 'round'; maskCtx.lineJoin = 'round'; maskCtx.stroke(handPath); } else maskCtx.fillText(target, box.width / 2, box.height / 2, box.width * 0.84);
    maskPixels = maskCtx.getImageData(0, 0, mask.width, mask.height).data; expectedCoverage = countMaskCells(box.width, box.height); coverage.clear(); (strokes[index] || []).forEach(strokeCoverage);
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
    maskSamples = []; const dpr = mask.width / width;
    for (let row = 0; row < 48; row++) for (let col = 0; col < 64; col++) {
      const x = (col + .5) * width / 64, y = (row + .5) * height / 48;
      if (maskPixels[(Math.floor(y * dpr) * mask.width + Math.floor(x * dpr)) * 4 + 3] > 20) maskSamples.push({ x: x / width, y: y / height });
    }
    return Math.max(1, maskSamples.length);
  }
  function strokeCoverage(stroke) {
    const box = canvas.getBoundingClientRect(), radius = brushWidth(box) / 2;
    const pixels = stroke.map(p => ({ x: p.x * box.width, y: p.y * box.height }));
    let hits = 0;
    maskSamples.forEach((sample, key) => {
      if (coverage.has(key)) return;
      const x = sample.x * box.width, y = sample.y * box.height;
      for (let i = 0; i < pixels.length; i++) {
        const a = pixels[Math.max(0, i - 1)], b = pixels[i], dx = b.x - a.x, dy = b.y - a.y;
        const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
        if (Math.hypot(x - a.x - t * dx, y - a.y - t * dy) <= radius) { coverage.add(key); hits++; break; }
      }
    });
    return hits;
  }
  function touchesLetter(point) {
    if (onGlyph(point)) return true;
    const box = canvas.getBoundingClientRect(), radius = brushWidth(box) / 2;
    return maskSamples.some(p => Math.hypot((p.x - point.x) * box.width, (p.y - point.y) * box.height) <= radius);
  }
  function renderCanvas() { drawGuide(); }
  function paintStroke(stroke) {
    if (!stroke?.length) return; const box = canvas.getBoundingClientRect(); ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = brushWidth(box);
    if (stroke.length === 1) { ctx.fillStyle = rainbow[0]; ctx.beginPath(); ctx.arc(stroke[0].x * box.width, stroke[0].y * box.height, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); ctx.restore(); return; }
    for (let i = 1; i < stroke.length; i++) { const a = stroke[i - 1], b = stroke[i], grad = ctx.createLinearGradient(a.x * box.width, a.y * box.height, b.x * box.width, b.y * box.height); const phase = (i / stroke.length) * rainbow.length; grad.addColorStop(0, rainbow[Math.floor(phase) % rainbow.length]); grad.addColorStop(1, rainbow[Math.ceil(phase) % rainbow.length]); ctx.strokeStyle = grad; ctx.beginPath(); ctx.moveTo(a.x * box.width, a.y * box.height); ctx.lineTo(b.x * box.width, b.y * box.height); ctx.stroke(); }
    ctx.restore();
  }
  function pointFromEvent(event) { const box = canvas.getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)), y: Math.max(0, Math.min(1, (event.clientY - box.top) / box.height)) }; }
  function onDown(event) { if (!dialog.open || drawing) return; const p = pointFromEvent(event); if (!touchesLetter(p)) { message('Touch the dotted letter to start.'); return; } drawing = true; canvas.setPointerCapture(event.pointerId); points = [p]; pathLength = 0; paintStroke(points); message('Lovely tracing! Keep following the letter.'); }
  function onMove(event) { if (!drawing) return; const p = pointFromEvent(event), prev = points.at(-1); if (!prev) return; const box = canvas.getBoundingClientRect(); pathLength += Math.hypot((p.x - prev.x) * box.width, (p.y - prev.y) * box.height); points.push(p); if (points.length % 3 === 0) { ctx.clearRect(0, 0, box.width, box.height); drawGuide(); paintStroke(points); } else paintStroke(points.slice(-2)); }
  function onUp(event) {
    if (!drawing) return; drawing = false; if (event && canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    const box = canvas.getBoundingClientRect(), hits = points.filter(touchesLetter).length, ratio = points.length ? hits / points.length : 0;
    if (pathLength >= Math.max(14, Math.min(box.width, box.height) * .07) && ratio >= .35) {
      if (!Array.isArray(strokes[index])) strokes[index] = []; strokes[index].push(points.map(p => ({ ...p }))); totalPath += pathLength; strokeCoverage(points); drawGuide();
      if (totalPath >= targetFontSize * .5 && coverage.size >= Math.max(4, Math.ceil(expectedCoverage * .55))) { window.meadowAudio?.play('reward'); finishLetter(false); }
      else { message('Nice tracing! Follow another part of the letter.'); hint('more'); }
    } else { drawGuide(); message('Good try! Follow more of the dotted letter.'); hint('retry'); }
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
    speak(cue('next'));
  }
  function alphabetDone() {
    window.meadowAudio?.play('reward'); shell('Alphabet helper!', '<div class="writing-congrats"><div class="writing-stars" aria-hidden="true">✦ ✦ ✦</div><h2>You traced all the letters!</h2><p>Big letters and little letters, A to Z. What a lovely job!</p><button class="writing-button writing-primary" type="button" data-again>Trace again</button><button class="writing-button" type="button" data-close>Back to games</button></div>'); $('[data-again]').onclick = () => start('alphabet'); $('[data-close]').onclick = close; speak(cue('alphabetdone'));
  }
  function nameDone() {
    window.meadowAudio?.play('reward'); let letterIndex = 0; const letters = [...name].map(char => /[\p{L}\p{M}]/u.test(char) ? `<canvas class="writing-result-letter" data-result="${letterIndex++}" aria-label="Your letter ${esc(char)}"></canvas>` : `<span class="writing-name-separator">${esc(char)}</span>`).join('');
    shell('My name!', `<div class="writing-name-result"><div class="writing-stars" aria-hidden="true">✦ ✦ ✦</div><h2>You wrote your name!</h2><div class="writing-result-name" aria-label="${esc(name)}">${letters}</div><p>Every rainbow letter was made by you!</p><button class="writing-button writing-primary" type="button" data-again>Write my name again</button><button class="writing-button" type="button" data-close>Back to games</button></div>`);
    dialog.querySelectorAll('[data-result]').forEach((mini, i) => renderThumbnail(mini, strokes[i] || [], queue[i])); $('[data-again]').onclick = () => start('name'); $('[data-close]').onclick = close; speak(cue('namedone'));
  }
  function renderThumbnail(mini, stroke, letter) {
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = 112, h = 144; mini.width = w * dpr; mini.height = h * dpr; const c = mini.getContext('2d'); c.scale(dpr, dpr); c.font = '900 118px "Comic Sans MS", "Trebuchet MS", system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = 'rgba(255,252,242,.75)'; c.fillText(letter, 56, 72, 102); c.lineWidth = 3; c.lineCap = 'round'; c.strokeStyle = '#bc965d'; c.setLineDash([2, 4]); const handPath = tracingPath(letter, 56, 72, 92); if (handPath) c.stroke(handPath); else c.strokeText(letter, 56, 72, 102); c.setLineDash([]);
    if (!Array.isArray(stroke)) return; for (const segment of stroke) { if (!segment?.length) continue; c.lineWidth = 14; c.lineCap = 'round'; c.lineJoin = 'round'; for (let i = 1; i < segment.length; i++) { const a = segment[i - 1], b = segment[i]; c.strokeStyle = rainbow[i % rainbow.length]; c.beginPath(); c.moveTo(a.x * w, a.y * h); c.lineTo(b.x * w, b.y * h); c.stroke(); } }
  }
  function open(which) { ensureDialog(); mode = which === 'name' ? 'name' : which === 'balloons' ? 'balloons' : 'alphabet'; start(mode); }
  window.meadowWritingGame = { open };
})();
