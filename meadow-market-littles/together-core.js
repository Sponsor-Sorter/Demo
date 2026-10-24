(() => {
  'use strict';
  const games = {
    connectfour: { name: 'Harvest Four', text: 'Take turns dropping an apple or a sunflower into a column. Join four across, up or diagonally to win.' },
    tictactoe: { name: 'Three in the Meadow', text: 'Take turns placing your apple or sunflower. Join three in a row to win.' },
    rps: { name: 'Rock, Paper, Scissors', text: 'Choose secretly. Rock beats scissors, scissors beat paper, and paper beats rock. First to three points wins.' },
    memoryduel: { name: 'Harvest Memory Match', text: 'Take turns turning over two cards. A matching pair is yours, and you go again. Find the most pairs to win.' },
    meadowrace: { name: 'Little Meadow Race', text: 'Take turns rolling the friendly one, two or three. Move your farmer along the path. First to the barn wins!' },
    harvestbasket: { name: 'Pick-a-Pair Baskets', text: 'Take turns picking fruit from the market. Remember where each fruit is hiding. Four of the same fruit fills your basket and wins!' },
    memorygarden: { name: 'Big Garden Memory', text: 'Take turns finding matching garden pictures. Remember where each card is hiding. Find the most pairs to win!' },
    animalrescue: { name: 'Animal Rescue Trail', text: 'Guide a farm friend along the right path, then build what the trail needs. Help all three friends get home together. Your jobs swap after each rescue.' },
    picnicpartners: { name: 'Picnic Partners', text: 'Work together to fill a picnic basket. One friend finds the food on the picture list; the other packs it in. Swap jobs as you go.' },
    gardenhelpers: { name: 'Garden Helpers', text: 'Choose the picture seed together, then give it a drink of water. Swap jobs and help three little plants grow.' },
    cozyhome: { name: 'Build a Cozy Home', text: 'Help three farm friends feel at home. One player chooses a cosy item; the other puts it in the right place. Then swap jobs.' },
    animalband: { name: 'Barnyard Band', text: 'Choose a farm friend to add a sound to your song. Your partner plays it, then you swap jobs. Make a little tune together.' },
    storywagon: { name: 'Story Wagon', text: 'Take turns choosing a farm friend, a place and a fun thing to do. Make three little stories together. There are no wrong choices.' }
  };
  const produce = ['apple', 'carrot', 'tomato', 'corn', 'pumpkin', 'strawberry'];
  const gameBoardSize = game => ({ connectfour: 42, tictactoe: 9, meadowrace: 0, harvestbasket: 16, memoryduel: 12, memorygarden: 16, rps: 9 })[game] ?? 0;
  const cooperative = {
    animalrescue: [
      { animal: 'sheep', home: 'meadow', crossing: 'stream', tool: 'plank' },
      { animal: 'duck', home: 'pond', crossing: 'mud', tool: 'stones' },
      { animal: 'hen', home: 'coop', crossing: 'gate', tool: 'gate' }
    ],
    picnicpartners: ['apple', 'strawberry', 'carrot'],
    gardenhelpers: ['corn', 'carrot', 'tomato'],
    cozyhome: [
      { animal: 'sheep', need: 'rest', item: 'blanket' },
      { animal: 'hen', need: 'nest', item: 'straw' },
      { animal: 'goat', need: 'snack', item: 'apple' }
    ],
    animalband: [],
    storywagon: ['friend', 'place', 'adventure']
  };
  const cooperativeGames = new Set(Object.keys(cooperative));
  function shuffled(items, random) { const out = items.slice(); for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; } return out; }
  function fresh(game, round = 1, scores = [0, 0], random = Math.random) {
    if (!games[game]) throw Error('Unknown game');
    let deck = [], market = [];
    if (game === 'memoryduel') deck = shuffled(produce.flatMap(item => [item, item]), random);
    if (game === 'memorygarden') deck = shuffled(['apple', 'carrot', 'tomato', 'corn', 'pumpkin', 'strawberry', 'pear', 'banana'].flatMap(item => [item, item]), random);
    if (game === 'harvestbasket') market = shuffled(['apple', 'carrot', 'tomato', 'corn'].flatMap(item => Array(4).fill(item)), random);
    const sharedGoal = game === 'animalrescue' ? 3 : game === 'animalband' ? 4 : 3;
    return { game, round, scores: scores.slice(), board: Array(gameBoardSize(game)).fill(0), turn: 1, winner: 0, revision: 0, picks: [null, null], points: [0, 0], deck, market, baskets: [[], []], positions: [0, 0], lastRoll: 0, flipped: [], matched: [], last: [], sharedGoal, shared: 0, guidePlayer: 1, phase: ({ animalrescue: 'guide', picnicpartners: 'choose', gardenhelpers: 'plant', cozyhome: 'choose', animalband: 'choose', storywagon: 'friend' })[game] || 'guide', selected: '', items: [] };
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
    if (cooperativeGames.has(s.game)) {
      if (player !== s.turn || typeof action.choice !== 'string') return null;
      const task = cooperative[s.game][s.shared];
      const options = s.game === 'storywagon'
        ? (s.phase === 'friend' ? ['hen', 'cow', 'sheep', 'goat'] : s.phase === 'place' ? ['meadow', 'orchard', 'pond'] : ['picnic', 'puddles', 'dance'])
        : s.game === 'animalrescue'
        ? (s.phase === 'guide' ? ['meadow', 'pond', 'coop'] : ['plank', 'stones', 'gate'])
        : s.game === 'picnicpartners' ? (s.phase === 'choose' ? produce : ['pack'])
        : s.game === 'gardenhelpers' ? (s.phase === 'plant' ? ['corn', 'carrot', 'tomato'] : ['water'])
        : s.game === 'cozyhome' ? (s.phase === 'choose' ? ['blanket', 'straw', 'apple'] : ['place'])
        : (s.phase === 'choose' ? ['hen', 'cow', 'sheep', 'goat'] : ['play']);
      if (!options.includes(action.choice)) return null;
      const expected = s.game === 'storywagon' ? ''
        : s.game === 'animalrescue' ? (s.phase === 'guide' ? task.home : task.tool)
        : s.game === 'picnicpartners' ? (s.phase === 'choose' ? task : 'pack')
        : s.game === 'gardenhelpers' ? (s.phase === 'plant' ? task : 'water')
        : s.game === 'cozyhome' ? (s.phase === 'choose' ? task.item : 'place')
        : (s.phase === 'choose' ? '' : 'play');
      if (expected && action.choice !== expected) {
        s.feedback = 'TRY';
        s.revision++;
        return s;
      }
      s.feedback = '';
      if (s.game === 'storywagon') {
        s.items.push(action.choice);
        if (s.phase === 'friend') { s.phase = 'place'; s.turn = 3 - player; }
        else if (s.phase === 'place') { s.phase = 'adventure'; s.turn = 3 - player; }
        else {
          s.shared++;
          s.feedback = 'NICE';
          if (s.shared >= s.sharedGoal) s.winner = 'together';
          else { s.guidePlayer = 3 - s.guidePlayer; s.turn = s.guidePlayer; s.phase = 'friend'; }
        }
      } else if (s.phase === 'guide' || s.phase === 'choose' || s.phase === 'plant') {
        s.selected = action.choice;
        s.phase = ({ animalrescue: 'bridge', picnicpartners: 'pack', gardenhelpers: 'water', cozyhome: 'place', animalband: 'play' })[s.game];
        s.turn = 3 - player;
      } else {
        if (s.game === 'animalband') s.items.push(s.selected);
        s.shared++;
        s.feedback = 'NICE';
        s.selected = '';
        if (s.shared >= s.sharedGoal) s.winner = 'together';
        else {
          s.guidePlayer = 3 - s.guidePlayer;
          s.turn = s.guidePlayer;
          s.phase = ({ animalrescue: 'guide', picnicpartners: 'choose', gardenhelpers: 'plant', cozyhome: 'choose', animalband: 'choose' })[s.game];
        }
      }
      s.revision++;
      return s;
    }
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
    if (!s || !games[s.game] || !n(s.revision) || !n(s.round) || ![1, 2].includes(s.turn) || ![0, 1, 2, 'draw', 'together'].includes(s.winner) || !['scores', 'points'].every(k => Array.isArray(s[k]) && s[k].length === 2 && s[k].every(n)) || !Array.isArray(s.board) || s.board.length !== gameBoardSize(s.game) || !s.board.every(x => [0, 1, 2].includes(x)) || !Array.isArray(s.picks) || s.picks.length !== 2 || !s.picks.every(x => [null, 'ready', 'rock', 'paper', 'scissors'].includes(x))) return false;
    if (cooperativeGames.has(s.game)) {
      const goals = { animalrescue: 3, picnicpartners: 3, gardenhelpers: 3, cozyhome: 3, animalband: 4, storywagon: 3 };
      const phases = { animalrescue: ['guide', 'bridge'], picnicpartners: ['choose', 'pack'], gardenhelpers: ['plant', 'water'], cozyhome: ['choose', 'place'], animalband: ['choose', 'play'], storywagon: ['friend', 'place', 'adventure'] };
      const selected = { animalrescue: ['meadow', 'pond', 'coop', 'plank', 'stones', 'gate'], picnicpartners: produce, gardenhelpers: ['corn', 'carrot', 'tomato'], cozyhome: ['blanket', 'straw', 'apple'], animalband: ['hen', 'cow', 'sheep', 'goat'], storywagon: ['hen', 'cow', 'sheep', 'goat', 'meadow', 'orchard', 'pond', 'picnic', 'puddles', 'dance'] };
      const itemSets = { animalband: ['hen', 'cow', 'sheep', 'goat'], storywagon: selected.storywagon };
      const itemLimit = s.game === 'storywagon' ? goals.storywagon * 3 : s.sharedGoal;
      const storyExpectedItems = s.game === 'storywagon' ? (s.winner === 'together' ? s.shared * 3 : s.shared * 3 + ({ friend: 0, place: 1, adventure: 2 })[s.phase]) : 0;
      if (!Number.isInteger(s.shared) || s.shared < 0 || s.shared > goals[s.game] || s.sharedGoal !== goals[s.game] || ![1, 2].includes(s.guidePlayer) || !phases[s.game].includes(s.phase) || typeof s.selected !== 'string' || (s.selected && !selected[s.game].includes(s.selected)) || !Array.isArray(s.items) || s.items.length > itemLimit || !s.items.every(x => itemSets[s.game]?.includes(x)) || (s.winner === 'together') !== (s.shared === s.sharedGoal) || (!['animalband', 'storywagon'].includes(s.game) && s.items.length !== 0) || (s.game === 'animalband' && s.items.length !== s.shared) || (s.game === 'storywagon' && s.items.length !== storyExpectedItems)) return false;
    } else if (s.winner === 'together') return false;
    const foods = new Set([...produce, 'pear', 'banana']);
    if (!Array.isArray(s.deck) || s.deck.length !== (s.game === 'memoryduel' ? 12 : s.game === 'memorygarden' ? 16 : 0) || !s.deck.every(x => x === null || foods.has(x)) || !['flipped', 'matched'].every(k => Array.isArray(s[k]) && s[k].length <= s.deck.length && s[k].every(x => Number.isInteger(x) && x >= 0 && x < s.deck.length)) || !Array.isArray(s.last) || s.last.length > 2 || !s.last.every(x => ['rock', 'paper', 'scissors'].includes(x))) return false;
    if (s.game === 'meadowrace' && (!Array.isArray(s.positions) || s.positions.length !== 2 || !s.positions.every(x => Number.isInteger(x) && x >= 0 && x <= 20) || ![0, 1, 2, 3].includes(s.lastRoll))) return false;
    if (s.game === 'harvestbasket' && (!Array.isArray(s.market) || s.market.length !== 16 || !s.market.every(x => ['apple', 'carrot', 'tomato', 'corn'].includes(x)) || !Array.isArray(s.baskets) || s.baskets.length !== 2 || !s.baskets.every(b => Array.isArray(b) && b.length <= 16 && b.every(x => ['apple', 'carrot', 'tomato', 'corn'].includes(x))))) return false;
    return true;
  }
  window.meadowTogetherCore = { games, cooperativeGames, fresh, apply, nextRps, view, line, validView };
})();
