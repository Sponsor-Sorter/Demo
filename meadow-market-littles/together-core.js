(() => {
  'use strict';
  const games = {
    connectfour: { name: 'Harvest Four', text: 'Take turns dropping an apple or a sunflower into a column. Join four across, up or diagonally to win.' },
    tictactoe: { name: 'Three in the Meadow', text: 'Take turns placing your apple or sunflower. Join three in a row to win.' },
    rps: { name: 'Rock, Paper, Scissors', text: 'Choose secretly. Rock beats scissors, scissors beat paper, and paper beats rock. First to three points wins.' },
    memoryduel: { name: 'Harvest Memory Match', text: 'Take turns turning over two cards. A matching pair is yours, and you go again. Find the most pairs to win.' },
    meadowrace: { name: 'Little Meadow Race', text: 'Take turns rolling the friendly one, two or three. Move your farmer along the path. First to the barn wins!' },
    harvestbasket: { name: 'Pick-a-Pair Baskets', text: 'Take turns picking fruit from the market. Remember where each fruit is hiding. Four of the same fruit fills your basket and wins!' },
    memorygarden: { name: 'Big Garden Memory', text: 'Take turns finding matching garden pictures. Remember where each card is hiding. Find the most pairs to win!' }
  };
  const produce = ['apple', 'carrot', 'tomato', 'corn', 'pumpkin', 'strawberry'];
  const gameBoardSize = game => ({ connectfour: 42, tictactoe: 9, meadowrace: 0, harvestbasket: 16, memoryduel: 12, memorygarden: 16, rps: 9 })[game] ?? 9;
  function shuffled(items, random) { const out = items.slice(); for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; } return out; }
  function fresh(game, round = 1, scores = [0, 0], random = Math.random) {
    if (!games[game]) throw Error('Unknown game');
    let deck = [], market = [];
    if (game === 'memoryduel') deck = shuffled(produce.flatMap(item => [item, item]), random);
    if (game === 'memorygarden') deck = shuffled(['apple', 'carrot', 'tomato', 'corn', 'pumpkin', 'strawberry', 'pear', 'banana'].flatMap(item => [item, item]), random);
    if (game === 'harvestbasket') market = shuffled(['apple', 'carrot', 'tomato', 'corn'].flatMap(item => Array(4).fill(item)), random);
    return { game, round, scores: scores.slice(), board: Array(gameBoardSize(game)).fill(0), turn: 1, winner: 0, revision: 0, picks: [null, null], points: [0, 0], deck, market, baskets: [[], []], positions: [0, 0], lastRoll: 0, flipped: [], matched: [], last: [] };
  }
  function line(board, index, width, height, length) {
    const who = board[index], x = index % width, y = Math.floor(index / width);
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      let n = 1;
      for (const sign of [-1, 1]) for (let k = 1; k < length; k++) {
        const xx = x + dx * k * sign, yy = y + dy * k * sign;
        if (xx < 0 || xx >= width || yy < 0 || yy >= height || board[yy * width + xx] !== who) break;
        n++;
      }
      if (n >= length) return true;
    }
    return false;
  }
  function apply(current, player, action) {
    if (![1, 2].includes(player) || current.winner || !action || typeof action !== 'object') return null;
    const s = JSON.parse(JSON.stringify(current));
    if (s.game === 'rps') {
      if (s.picks[player - 1] || !['rock', 'paper', 'scissors'].includes(action.choice)) return null;
      if (s.picks.every(Boolean)) s.picks = [null, null];
      s.picks[player - 1] = action.choice;
      if (s.picks.every(Boolean)) {
        const [a, b] = s.picks; s.last = [a, b];
        if (a !== b) { const won = ({ rock: 'scissors', paper: 'rock', scissors: 'paper' })[a] === b ? 1 : 2; s.points[won - 1]++; if (s.points[won - 1] >= 3) s.winner = won; }
      }
    } else {
      if (player !== s.turn) return null;
      if (s.game === 'memoryduel' || s.game === 'memorygarden') {
        const cell = action.cell, total = s.deck.length;
        if (s.flipped.length === 2) s.flipped = [];
        if (!Number.isInteger(cell) || cell < 0 || cell >= total || s.matched.includes(cell) || s.flipped.includes(cell)) return null;
        s.flipped.push(cell);
        if (s.flipped.length === 2) {
          const [a, b] = s.flipped;
          if (s.deck[a] === s.deck[b]) { s.matched.push(a, b); s.points[player - 1]++; s.flipped = []; if (s.matched.length === total) s.winner = s.points[0] === s.points[1] ? 'draw' : s.points[0] > s.points[1] ? 1 : 2; }
          else s.turn = 3 - player;
        }
      } else if (s.game === 'meadowrace') {
        if (![1, 2, 3].includes(action.spaces)) return null;
        s.lastRoll = action.spaces; s.positions[player - 1] = Math.min(20, s.positions[player - 1] + action.spaces);
        if (s.positions[player - 1] >= 20) s.winner = player; else s.turn = 3 - player;
      } else if (s.game === 'harvestbasket') {
        const cell = action.cell;
        if (!Number.isInteger(cell) || cell < 0 || cell >= s.market.length || s.board[cell]) return null;
        s.board[cell] = player; const fruit = s.market[cell]; s.baskets[player - 1].push(fruit); s.points[player - 1]++;
        if (s.baskets[player - 1].filter(item => item === fruit).length >= 4) s.winner = player;
        else if (s.board.every(Boolean)) s.winner = 'draw'; else s.turn = 3 - player;
      } else {
        let cell = action.cell;
        if (s.game === 'connectfour') {
          if (!Number.isInteger(action.column) || action.column < 0 || action.column > 6) return null;
          cell = -1; for (let y = 5; y >= 0; y--) if (!s.board[y * 7 + action.column]) { cell = y * 7 + action.column; break; }
          if (cell < 0) return null;
        } else if (!Number.isInteger(cell) || cell < 0 || cell >= 9) return null;
        if (s.board[cell]) return null;
        s.board[cell] = player;
        if (line(s.board, cell, s.game === 'connectfour' ? 7 : 3, s.game === 'connectfour' ? 6 : 3, s.game === 'connectfour' ? 4 : 3)) s.winner = player;
        else if (s.board.every(Boolean)) s.winner = 'draw'; else s.turn = 3 - player;
      }
    }
    if (s.winner && s.winner !== 'draw') s.scores[s.winner - 1]++;
    s.revision++;
    return s;
  }
  function nextRps(s) { if (s.game !== 'rps' || s.winner || !s.picks.every(Boolean)) return null; return { ...s, picks: [null, null], last: [], revision: s.revision + 1 }; }
  function view(s, player) {
    const out = JSON.parse(JSON.stringify(s));
    if (s.game === 'rps' && !s.picks.every(Boolean)) out.picks = out.picks.map((v, i) => i === player - 1 ? v : v ? 'ready' : null);
    if (s.game === 'memoryduel' || s.game === 'memorygarden') out.deck = out.deck.map((v, i) => out.flipped.includes(i) || out.matched.includes(i) ? v : null);
    return out;
  }
  function validView(s) {
    const n = x => Number.isSafeInteger(x) && x >= 0 && x < 1000000;
    if (!s || !games[s.game] || !n(s.revision) || !n(s.round) || ![1, 2].includes(s.turn) || ![0, 1, 2, 'draw'].includes(s.winner) || !['scores', 'points'].every(k => Array.isArray(s[k]) && s[k].length === 2 && s[k].every(n)) || !Array.isArray(s.board) || s.board.length !== gameBoardSize(s.game) || !s.board.every(x => [0, 1, 2].includes(x)) || !Array.isArray(s.picks) || s.picks.length !== 2 || !s.picks.every(x => [null, 'ready', 'rock', 'paper', 'scissors'].includes(x))) return false;
    const foods = new Set([...produce, 'pear', 'banana']);
    if (!Array.isArray(s.deck) || s.deck.length !== (s.game === 'memoryduel' ? 12 : s.game === 'memorygarden' ? 16 : 0) || !s.deck.every(x => x === null || foods.has(x)) || !['flipped', 'matched'].every(k => Array.isArray(s[k]) && s[k].length <= s.deck.length && s[k].every(x => Number.isInteger(x) && x >= 0 && x < s.deck.length)) || !Array.isArray(s.last) || s.last.length > 2 || !s.last.every(x => ['rock', 'paper', 'scissors'].includes(x))) return false;
    if (s.game === 'meadowrace' && (!Array.isArray(s.positions) || s.positions.length !== 2 || !s.positions.every(x => Number.isInteger(x) && x >= 0 && x <= 20) || ![0, 1, 2, 3].includes(s.lastRoll))) return false;
    if (s.game === 'harvestbasket' && (!Array.isArray(s.market) || s.market.length !== 16 || !s.market.every(x => ['apple', 'carrot', 'tomato', 'corn'].includes(x)) || !Array.isArray(s.baskets) || s.baskets.length !== 2 || !s.baskets.every(b => Array.isArray(b) && b.length <= 16 && b.every(x => ['apple', 'carrot', 'tomato', 'corn'].includes(x))))) return false;
    return true;
  }
  window.meadowTogetherCore = { games, fresh, apply, nextRps, view, line, validView };
})();
