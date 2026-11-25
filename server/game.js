import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { GAME_PHASES, CARD_TYPES, WIN_RATIO, ROOM_CODE_LENGTH } from '../shared/constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cardsData = JSON.parse(readFileSync(join(__dirname, 'data', 'cards.json'), 'utf-8'));

// ─── Helpers ────────────────────────────────────────────────────────────────

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomItems(arr, count) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Anime sub-packs selection
const ANIME_SUBPACKS = ['anime_sao', 'anime_rezero', 'anime_kny', 'anime_mahou'];
const ANIME_NAMES = {
  anime_sao: 'Sword Art Online',
  anime_rezero: 'Re:Zero',
  anime_kny: 'Клинок, рассекающий демонов',
  anime_mahou: 'Махо Сёдзё',
};

/**
 * Get card pool for a pack. Falls back to base if pack not found.
 */
function getPackCards(packId) {
  const base = (cardsData.packs && cardsData.packs.base) || cardsData;
  const pack = (cardsData.packs && cardsData.packs[packId]) || {};
  return {
    catastrophes: pack.catastrophes?.length ? pack.catastrophes : base.catastrophes || [],
    professions: pack.professions?.length ? pack.professions : base.professions || [],
    health: pack.health?.length ? pack.health : base.health || [],
    hobbies: pack.hobbies?.length ? pack.hobbies : base.hobbies || [],
    baggage: pack.baggage?.length ? pack.baggage : base.baggage || [],
    facts: pack.facts?.length ? pack.facts : base.facts || [],
    biology: pack.biology?.length ? pack.biology : base.biology || [],
    bunkers: pack.bunkers?.length ? pack.bunkers : base.bunkers || [],
    specials: pack.specials?.length ? pack.specials : base.specials || [],
  };
}

function shuffleArray(arr) {
  const pool = [...arr];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

function deduplicateCards(arr) {
  if (!arr || arr.length === 0) return [];
  const seen = new Set();
  const unique = [];
  for (const card of arr) {
    if (!card) continue;
    const key = card.text ?? card.id;
    if (key !== undefined && seen.has(key)) continue;
    if (key !== undefined) seen.add(key);
    unique.push(card);
  }
  return unique;
}

const MAIN_TRAIT_SLOTS = [
  { handKey: 'profession', packKey: 'professions' },
  { handKey: 'health', packKey: 'health' },
  { handKey: 'hobby', packKey: 'hobbies' },
  { handKey: 'baggage', packKey: 'baggage' },
  { handKey: 'fact', packKey: 'facts' },
  { handKey: 'biology', packKey: 'biology' },
];

const MAX_GOOD_PER_PLAYER = 2; // At most 1/3 of 6 main traits

export function dealCards(playerIds, packCards) {
  const hands = {};

  // Build deduplicated, shuffled quality buckets for each of the 6 main trait categories
  const categoryBuckets = {};
  for (const { packKey } of MAIN_TRAIT_SLOTS) {
    const uniquePool = shuffleArray(deduplicateCards(packCards[packKey]));
    const buckets = { good: [], neutral: [], bad: [] };
    for (const card of uniquePool) {
      const q = card.quality === 'good' || card.quality === 'bad' ? card.quality : 'neutral';
      buckets[q].push(card);
    }
    categoryBuckets[packKey] = buckets;
  }

  // Deal unique specials without wrap-around
  const uniqueSpecials = shuffleArray(deduplicateCards(packCards.specials));

  playerIds.forEach((playerId, index) => {
    // Target ~1-2 good (max 2 = 1/3 of 6), ~2 neutral, ~2-3 bad
    const goodTarget = Math.random() < 0.5 ? 1 : 2;
    const neutralTarget = 2;
    const badTarget = 6 - goodTarget - neutralTarget; // 2 or 3

    const desiredQualities = [
      ...Array(goodTarget).fill('good'),
      ...Array(neutralTarget).fill('neutral'),
      ...Array(badTarget).fill('bad'),
    ];
    const shuffledSlots = shuffleArray(MAIN_TRAIT_SLOTS);

    const hand = {
      profession: null,
      health: null,
      hobby: null,
      baggage: null,
      fact: null,
      biology: null,
      special: uniqueSpecials[index] ? { ...uniqueSpecials[index] } : null,
      // Which cards are publicly revealed
      revealed: {
        profession: false,
        health: false,
        hobby: false,
        baggage: false,
        fact: false,
        biology: false,
        special: false,
      },
    };

    let playerGoodCount = 0;

    shuffledSlots.forEach(({ handKey, packKey }, slotIdx) => {
      const buckets = categoryBuckets[packKey];
      const desired = desiredQualities[slotIdx];

      let fallbackOrder;
      if (desired === 'good') {
        fallbackOrder = playerGoodCount < MAX_GOOD_PER_PLAYER
          ? ['good', 'neutral', 'bad']
          : ['neutral', 'bad', 'good'];
      } else if (desired === 'neutral') {
        fallbackOrder = playerGoodCount < MAX_GOOD_PER_PLAYER
          ? ['neutral', 'bad', 'good']
          : ['neutral', 'bad'];
      } else {
        fallbackOrder = playerGoodCount < MAX_GOOD_PER_PLAYER
          ? ['bad', 'neutral', 'good']
          : ['bad', 'neutral'];
      }

      let picked = null;
      for (const q of fallbackOrder) {
        if (buckets[q].length > 0) {
          picked = buckets[q].pop();
          break;
        }
      }

      // Extreme fallback if a category only has 'good' cards left
      if (!picked && buckets.good.length > 0) {
        picked = buckets.good.pop();
      }

      if (picked) {
        if (picked.quality === 'good') playerGoodCount++;
        hand[handKey] = { ...picked };
      }
    });

    hands[playerId] = hand;
  });

  return hands;
}

// ─── Bot names ──────────────────────────────────────────────────────────────

const BOT_NAMES = [
  'БОТ-АЛЬФА', 'БОТ-БРАВО', 'БОТ-ЧАРЛИ', 'БОТ-ДЕЛЬТА', 'БОТ-ЭХО',
  'БОТ-ФОКСТРОТ', 'БОТ-ГОЛЬФ', 'БОТ-ОТЕЛЬ', 'БОТ-ИНДИГО', 'БОТ-ДЖУЛИЕТ',
];

// ─── BunkerGame ─────────────────────────────────────────────────────────────

export class BunkerGame {
  constructor() {
    // roomCode → room object
    this.rooms = new Map();
  }

  // ── Room management ──────────────────────────────────────────────────────

  createRoom(hostSocketId, packId = 'base', testMode = false) {
    let roomCode;
    do {
      roomCode = generateRoomCode();
    } while (this.rooms.has(roomCode));

    // Handle anime pack: randomly pick sub-pack
    let actualPackId = packId;
    let animeName = null;
    if (packId === 'anime') {
      actualPackId = randomItem(ANIME_SUBPACKS);
      animeName = ANIME_NAMES[actualPackId] || actualPackId;
    }

    const room = {
      code: roomCode,
      hostId: hostSocketId,
      phase: GAME_PHASES.LOBBY,
      players: new Map(), // socketId → player obj
      eliminatedPlayers: [],
      round: 0,
      catastrophe: null,
      bunker: null,
      hands: {},        // socketId → hand
      votes: {},        // socketId → targetId
      specialUsed: {},  // socketId → bool (per round)
      immunePlayers: new Set(),
      phantomVotes: {}, // targetId → bonus count
      packId: actualPackId,
      selectedPackLabel: packId,
      animeName,
      testMode: testMode || false,
      bots: [],         // array of bot socket IDs
      chatHistory: [],
      createdAt: Date.now(),
    };

    this.rooms.set(roomCode, room);
    return { roomCode, animeName };
  }

  joinRoom(roomCode, socketId, username, isBot = false, customization = null, avatarUrl = null) {
    const room = this._getRoom(roomCode);

    if (room.phase !== GAME_PHASES.LOBBY) {
      throw new Error('Игра уже началась');
    }

    const player = {
      id: socketId,
      username,
      avatarUrl: avatarUrl || null,
      connected: true,
      joinedAt: Date.now(),
      isBot: isBot || false,
      customization: customization || null,
    };

    room.players.set(socketId, player);
    return this.getRoomState(roomCode, socketId);
  }

  // Add bots to a room (test mode)
  addBots(roomCode, count = 5) {
    const room = this._getRoom(roomCode);
    const botIds = [];
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5).slice(0, count);

    for (let i = 0; i < count; i++) {
      const botId = `bot_${uuidv4().slice(0, 8)}`;
      const botName = names[i] || `БОТ-${i + 1}`;
      this.joinRoom(roomCode, botId, botName, true);
      room.bots.push(botId);
      botIds.push(botId);
    }

    return botIds;
  }

  // Bots randomly reveal cards
  botRevealCards(roomCode) {
    const room = this._getRoom(roomCode);
    const results = [];

    for (const botId of room.bots) {
      const hand = room.hands[botId];
      if (!hand) continue;

      // Bot reveals 1-2 random unrevealed cards
      const unrevealed = Object.entries(hand.revealed)
        .filter(([type, v]) => !v && type !== 'special')
        .map(([type]) => type);

      if (unrevealed.length === 0) continue;

      const toReveal = randomItems(unrevealed, Math.min(2, unrevealed.length));
      for (const cardType of toReveal) {
        hand.revealed[cardType] = true;
        results.push({ botId, cardType, card: hand[cardType] });
      }
    }

    return results;
  }

  // Bots vote randomly (excluding themselves and the specified exclude list)
  botVote(roomCode, excludeIds = []) {
    const room = this._getRoom(roomCode);
    const activePlayers = this._getActivePlayers(room);

    for (const botId of room.bots) {
      // Skip eliminated bots
      const botPlayer = room.players.get(botId);
      if (!botPlayer || botPlayer.eliminated) continue;

      // Pick a random target (not self, not excluded, not eliminated)
      const targets = activePlayers.filter(p => p.id !== botId && !excludeIds.includes(p.id));
      if (targets.length === 0) continue;

      const target = randomItem(targets);
      room.votes[botId] = target.id;
    }
  }

  leaveRoom(roomCode, socketId) {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    if (room.phase === GAME_PHASES.LOBBY) {
      // In lobby: completely delete player from the room
      room.players.delete(socketId);
      delete room.hands[socketId];
    } else {
      // During active match: mark as disconnected so their slot/cards remain
      if (room.players.has(socketId)) {
        room.players.get(socketId).connected = false;
      }
    }

    // If host leaves and game hasn't started — migrate host
    if (room.hostId === socketId && room.phase === GAME_PHASES.LOBBY) {
      const remaining = [...room.players.values()].filter(p => p.connected && p.id !== socketId && !p.isBot);
      if (remaining.length > 0) {
        room.hostId = remaining[0].id;
      } else {
        this.rooms.delete(roomCode);
        return null;
      }
    }

    return room;
  }

  // ── Game flow ────────────────────────────────────────────────────────────

  startGame(roomCode, requesterId) {
    const room = this._getRoom(roomCode);

    if (room.hostId !== requesterId) throw new Error('Только хост может начать игру');
    if (room.phase !== GAME_PHASES.LOBBY) throw new Error('Игра уже запущена');

    const activePlayers = [...room.players.values()].filter(p => p.connected);
    if (activePlayers.length < 2) throw new Error('Нужно минимум 2 игрока');

    // Get pack-specific cards
    const packCards = getPackCards(room.packId);

    // Pick scenario (capacity strictly set to 2 survivors)
    room.catastrophe = packCards.catastrophes?.length ? { ...randomItem(packCards.catastrophes) } : null;
    room.bunker = packCards.bunkers?.length ? { ...randomItem(packCards.bunkers), capacity: 2 } : { capacity: 2 };

    // Deal cards
    const playerIds = activePlayers.map(p => p.id);
    room.hands = dealCards(playerIds, packCards);

    room.phase = GAME_PHASES.PLAYING;
    room.round = 1;
    room.specialUsed = {};
    room.votes = {};
    room.immunePlayers = new Set();
    room.phantomVotes = {};

    // Turn queue: human host goes first, then bots/others
    room.turnQueue = [...playerIds];
    room.revealedThisRound = new Set();
    room.currentTurnPlayerId = room.turnQueue[0] || null;
    room.isExplaining = false;

    return room;
  }

  revealCard(roomCode, playerId, cardType) {
    const room = this._getRoom(roomCode);
    this._assertPlaying(room);

    // Turn check
    if (room.currentTurnPlayerId && room.currentTurnPlayerId !== playerId) {
      const currentP = room.players.get(room.currentTurnPlayerId);
      throw new Error(`Сейчас ход игрока ${currentP?.username || 'другого участника'}!`);
    }

    // Round 1 restriction: only profession can be revealed (unless player already revealed profession)
    if (room.round === 1 && !room.hands[playerId]?.revealed?.profession && cardType !== 'profession') {
      throw new Error('В 1-м раунде можно раскрыть только Профессию!');
    }

    const hand = room.hands[playerId];
    if (!hand) throw new Error('Игрок не найден');

    const validTypes = Object.values(CARD_TYPES).filter(t => t !== CARD_TYPES.SPECIAL);
    if (!validTypes.includes(cardType) && cardType !== CARD_TYPES.SPECIAL) {
      throw new Error(`Неизвестный тип карты: ${cardType}`);
    }

    if (hand.revealed[cardType]) throw new Error('Эта карта уже раскрыта');

    hand.revealed[cardType] = true;
    room.revealedThisRound.add(playerId);
    room.isExplaining = true;

    return {
      playerId,
      cardType,
      card: hand[cardType],
      isExplaining: true,
      currentTurnPlayerId: room.currentTurnPlayerId,
    };
  }

  finishExplanation(roomCode, playerId) {
    const room = this._getRoom(roomCode);
    this._assertPlaying(room);

    if (room.currentTurnPlayerId !== playerId) {
      throw new Error('Сейчас не ваш ход для завершения объяснения');
    }

    room.isExplaining = false;

    // Advance turn to next unrevealed player
    const activePlayers = this._getActivePlayers(room);
    const unrevealedActive = activePlayers.filter(p => !room.revealedThisRound.has(p.id));

    let roundComplete = false;
    let noKickRound = false;

    if (unrevealedActive.length === 0) {
      // Everyone in this round has revealed and explained!
      roundComplete = true;

      // Round 1 No-Kick Rule: After round 1, no one is eliminated!
      if (room.round === 1) {
        noKickRound = true;
        room.round = 2; // Advance to round 2 immediately!
        room.turnQueue = activePlayers.map(p => p.id);
        room.revealedThisRound = new Set();
        room.currentTurnPlayerId = room.turnQueue[0] || null;
      } else {
        room.currentTurnPlayerId = null;
      }
    } else {
      // Find next player in turn queue
      const currentIndex = room.turnQueue.indexOf(playerId);
      let nextId = null;
      for (let offset = 1; offset < room.turnQueue.length; offset++) {
        const candidateId = room.turnQueue[(currentIndex + offset) % room.turnQueue.length];
        if (unrevealedActive.some(p => p.id === candidateId)) {
          nextId = candidateId;
          break;
        }
      }
      room.currentTurnPlayerId = nextId || unrevealedActive[0].id;
    }

    return {
      playerId,
      roundComplete,
      noKickRound,
      nextTurnPlayerId: room.currentTurnPlayerId,
      roundNumber: room.round,
    };
  }

  botPlayTurn(roomCode, botId) {
    const room = this._getRoom(roomCode);
    const hand = room.hands[botId];
    if (!hand) return null;

    let cardType = 'profession';
    if (room.round === 1) {
      cardType = 'profession';
    } else {
      const unrevealed = Object.entries(hand.revealed)
        .filter(([type, v]) => !v && type !== 'special')
        .map(([type]) => type);
      if (unrevealed.length > 0) {
        cardType = randomItem(unrevealed);
      }
    }

    return this.revealCard(roomCode, botId, cardType);
  }

  startVoting(roomCode, requesterId) {
    const room = this._getRoom(roomCode);
    if (room.hostId !== requesterId) throw new Error('Только хост может начать голосование');
    if (room.phase !== GAME_PHASES.PLAYING) throw new Error('Голосование можно начать только во время игры');

    room.phase = GAME_PHASES.VOTING;
    room.votes = {};
    room.phantomVotes = {};

    // If bots exist, bots auto-vote
    if (room.bots && room.bots.length > 0) {
      this.botVote(roomCode);
    }

    return room;
  }

  vote(roomCode, voterId, targetId) {
    const room = this._getRoom(roomCode);
    if (room.phase !== GAME_PHASES.VOTING) throw new Error('Сейчас не время для голосования');
    if (!room.players.has(voterId)) throw new Error('Голосующий не в комнате');
    if (!room.players.has(targetId)) throw new Error('Цель не в комнате');
    if (room.eliminatedPlayers.some(e => e.id === voterId)) throw new Error('Изгнанные не могут голосовать');
    if (room.eliminatedPlayers.some(e => e.id === targetId)) throw new Error('Нельзя голосовать за изгнанного');

    room.votes[voterId] = targetId;

    return { voterId, targetId };
  }

  endVoting(roomCode, requesterId) {
    const room = this._getRoom(roomCode);
    if (requesterId && room.hostId !== requesterId) throw new Error('Только хост может завершить голосование');
    if (room.phase !== GAME_PHASES.VOTING) throw new Error('Голосование не идёт');

    // Count votes
    const tally = {}; // targetId → count
    for (const [voterId, targetId] of Object.entries(room.votes)) {
      tally[targetId] = (tally[targetId] || 0) + 1;
    }

    // Apply phantom votes (from POISON special)
    for (const [targetId, bonus] of Object.entries(room.phantomVotes)) {
      tally[targetId] = (tally[targetId] || 0) + bonus;
    }

    // Find max votes (exclude immune players)
    const activePlayers = this._getActivePlayers(room);
    let maxVotes = 0;
    let eliminated = null;

    for (const player of activePlayers) {
      if (room.immunePlayers.has(player.id)) continue;
      const count = tally[player.id] || 0;
      if (count > maxVotes) {
        maxVotes = count;
        eliminated = player;
      }
    }

    // Handle tie: break tie decisively so voting always produces a result
    const topCount = maxVotes;
    const tied = activePlayers.filter(p => !room.immunePlayers.has(p.id) && (tally[p.id] || 0) === topCount);
    if (tied.length > 1) {
      // Prioritize the candidate voted by the host/requester if they are among tied
      const hostVote = room.votes[requesterId || room.hostId];
      const match = tied.find(p => p.id === hostVote);
      if (match) {
        eliminated = match;
      } else {
        eliminated = randomItem(tied);
      }
    }

    if (eliminated) {
      room.eliminatedPlayers.push({ ...eliminated, eliminatedRound: room.round });
      room.players.get(eliminated.id).eliminated = true;
    }

    room.phase = GAME_PHASES.PLAYING;
    room.round += 1;
    room.votes = {};
    room.phantomVotes = {};
    room.immunePlayers = new Set();
    room.specialUsed = {};

    // Reset turn queue for the new round
    const remainingActive = this._getActivePlayers(room);
    room.turnQueue = remainingActive.map(p => p.id);
    room.revealedThisRound = new Set();
    room.currentTurnPlayerId = room.turnQueue[0] || null;

    const winResult = this.checkWin(roomCode);

    return {
      eliminated: eliminated || null,
      tally,
      tie: tied.length > 1,
      winResult,
    };
  }

  nextRound(roomCode, requesterId) {
    const room = this._getRoom(roomCode);
    if (room.hostId !== requesterId) throw new Error('Только хост может перейти к следующему раунду');
    if (room.phase !== GAME_PHASES.PLAYING) throw new Error('Переход невозможен в данной фазе');

    room.round += 1;
    room.specialUsed = {};

    return room;
  }

  checkWin(roomCode) {
    const room = this._getRoom(roomCode);
    const activePlayers = this._getActivePlayers(room);
    const bunkerCapacity = 2; // Strict rule: exactly 2 survivors enter the bunker

    // Win condition: survivors <= bunker capacity (2)
    if (activePlayers.length <= bunkerCapacity) {
      room.phase = GAME_PHASES.ENDED;
      return {
        gameOver: true,
        survivors: activePlayers,
        eliminated: room.eliminatedPlayers,
        bunker: room.bunker,
        catastrophe: room.catastrophe,
      };
    }

    return { gameOver: false };
  }

  useSpecialCard(roomCode, playerId, action, targetId) {
    const room = this._getRoom(roomCode);
    this._assertPlaying(room);

    const hand = room.hands[playerId];
    if (!hand) throw new Error('Игрок не найден');
    if (hand.revealed.special) throw new Error('Спецкарта уже использована/раскрыта');
    if (room.specialUsed[playerId]) throw new Error('Вы уже использовали спецкарту в этом раунде');

    const special = hand.special;
    if (special.action !== action) {
      throw new Error(`Действие ${action} не соответствует вашей спецкарте (${special.action})`);
    }

    room.specialUsed[playerId] = true;
    hand.revealed.special = true;

    let result = { playerId, action, special };

    switch (action) {
      case 'immunity':
        room.immunePlayers.add(playerId);
        result.message = `${room.players.get(playerId)?.username} получил иммунитет`;
        break;

      case 'reveal': {
        if (!targetId) throw new Error('Нужно указать цель');
        const targetHand = room.hands[targetId];
        if (!targetHand) throw new Error('Цель не найдена');
        const unrevealed = Object.entries(targetHand.revealed).find(([, v]) => !v);
        if (!unrevealed) throw new Error('У цели нет скрытых карт');
        const [cardType] = unrevealed;
        targetHand.revealed[cardType] = true;
        result.targetId = targetId;
        result.cardType = cardType;
        result.card = targetHand[cardType];
        result.message = `${room.players.get(playerId)?.username} раскрыл карту ${room.players.get(targetId)?.username}`;
        break;
      }

      case 'swap': {
        if (!targetId) throw new Error('Нужно указать цель');
        const targetHand2 = room.hands[targetId];
        if (!targetHand2) throw new Error('Цель не найдена');
        const types = Object.values(CARD_TYPES).filter(t => !hand.revealed[t] && !targetHand2.revealed[t]);
        if (types.length === 0) throw new Error('Нет доступных карт для обмена');
        const swapType = randomItem(types);
        const tmp = hand[swapType];
        hand[swapType] = targetHand2[swapType];
        targetHand2[swapType] = tmp;
        result.targetId = targetId;
        result.swapType = swapType;
        result.message = `${room.players.get(playerId)?.username} обменялся картой с ${room.players.get(targetId)?.username}`;
        break;
      }

      case 'peek': {
        if (!targetId) throw new Error('Нужно указать цель');
        const targetHand3 = room.hands[targetId];
        if (!targetHand3) throw new Error('Цель не найдена');
        const unrevealedPeek = Object.entries(targetHand3.revealed)
          .filter(([, v]) => !v)
          .map(([k]) => ({ type: k, card: targetHand3[k] }));
        result.peek = unrevealedPeek;
        result.targetId = targetId;
        result.privateOnly = true;
        result.message = `${room.players.get(playerId)?.username} использовал шпионаж`;
        break;
      }

      case 'skip_vote':
        result.skipVote = true;
        result.message = `${room.players.get(playerId)?.username} пропустил голосование`;
        break;

      case 'double_vote':
        room.doubleVotePlayers = room.doubleVotePlayers || new Set();
        room.doubleVotePlayers.add(playerId);
        result.message = `${room.players.get(playerId)?.username} получил двойной голос`;
        break;

      case 'revive': {
        if (!targetId) throw new Error('Нужно указать изгнанного игрока для возвращения');
        const idx = room.eliminatedPlayers.findIndex(e => e.id === targetId);
        if (idx === -1) throw new Error('Игрок не был изгнан');
        const revived = room.eliminatedPlayers.splice(idx, 1)[0];
        room.players.get(targetId).eliminated = false;
        result.revivedPlayer = revived;
        result.message = `${room.players.get(playerId)?.username} вернул ${revived.username} в бункер`;
        break;
      }

      case 'poison': {
        if (!targetId) throw new Error('Нужно указать цель');
        room.phantomVotes[targetId] = (room.phantomVotes[targetId] || 0) + 2;
        result.targetId = targetId;
        result.message = `${room.players.get(playerId)?.username} использовал яд (скрытно)`;
        result.privateOnly = true;
        break;
      }

      default:
        throw new Error(`Неизвестное действие: ${action}`);
    }

    return result;
  }

  // ── Chat ─────────────────────────────────────────────────────────────────

  addChatMessage(roomCode, playerId, text) {
    const room = this._getRoom(roomCode);
    const player = room.players.get(playerId);
    if (!player) throw new Error('Игрок не найден');

    const msg = {
      id: uuidv4(),
      playerId,
      username: player.username,
      text: text.substring(0, 500),
      ts: Date.now(),
    };
    room.chatHistory.push(msg);
    if (room.chatHistory.length > 200) room.chatHistory.shift();

    return msg;
  }

  // ── State getters ─────────────────────────────────────────────────────────

  getRoomState(roomCode, requesterId) {
    const room = this._getRoom(roomCode);
    const players = [...room.players.values()].map(p => {
      const hand = room.hands[p.id];
      return {
        id: p.id,
        username: p.username,
        avatarUrl: p.avatarUrl || null,
        connected: p.connected,
        eliminated: p.eliminated || false,
        isHost: p.id === room.hostId,
        isBot: p.isBot || false,
        customization: p.customization || null,
        hand: hand ? this._serializeHand(hand, p.id === requesterId) : null,
      };
    });

    return {
      code: room.code,
      phase: room.phase,
      round: room.round,
      hostId: room.hostId,
      catastrophe: room.catastrophe,
      bunker: room.bunker,
      players,
      eliminatedCount: room.eliminatedPlayers.length,
      chatHistory: room.chatHistory.slice(-50),
      packId: room.packId,
      selectedPackLabel: room.selectedPackLabel,
      animeName: room.animeName,
      testMode: room.testMode,
      currentTurnPlayerId: room.currentTurnPlayerId || null,
      isExplaining: room.isExplaining || false,
      turnQueue: room.turnQueue || [],
      revealedThisRound: Array.from(room.revealedThisRound || []),
    };
  }

  getRoomByPlayer(socketId) {
    for (const [code, room] of this.rooms.entries()) {
      if (room.players.has(socketId)) return { code, room };
    }
    return null;
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  _getRoom(roomCode) {
    const room = this.rooms.get(roomCode?.toUpperCase());
    if (!room) throw new Error(`Комната ${roomCode} не найдена`);
    return room;
  }

  _assertPlaying(room) {
    if (room.phase !== GAME_PHASES.PLAYING) {
      throw new Error('Действие недоступно в данной фазе игры');
    }
  }

  _getActivePlayers(room) {
    return [...room.players.values()].filter(p => !p.eliminated && p.connected);
  }

  _serializeHand(hand, isOwner) {
    const result = { revealed: hand.revealed };

    const types = ['profession', 'health', 'hobby', 'baggage', 'fact', 'biology', 'special'];
    for (const type of types) {
      if (isOwner || hand.revealed[type]) {
        result[type] = hand[type];
      } else {
        result[type] = null;
      }
    }

    return result;
  }
}
